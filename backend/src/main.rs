use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use std::process::Command;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

#[derive(Deserialize)]
struct Asset {
    name:   String,
    base64: String,
}

#[derive(Deserialize)]
struct CompileRequest {
    latex:  String,
    #[serde(default)]
    assets: Vec<Asset>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum CompileResponse {
    Ok  { pdf: String },
    Err { error: String },
}

async fn health_handler() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn compile_handler(Json(body): Json<CompileRequest>) -> impl IntoResponse {
    let latex = body.latex.trim().to_string();

    if latex.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(CompileResponse::Err { error: "LaTeX content is empty.".into() }),
        );
    }

    info!("Compiling LaTeX ({} bytes, {} assets)", latex.len(), body.assets.len());

    let result = tokio::task::spawn_blocking(move || {
        compile_latex(&latex, &body.assets)
    }).await;

    match result {
        Ok(Ok(pdf_bytes)) => {
            info!("Compilation succeeded ({} bytes PDF)", pdf_bytes.len());
            (StatusCode::OK, Json(CompileResponse::Ok { pdf: B64.encode(&pdf_bytes) }))
        }
        Ok(Err(e)) => {
            error!("Compilation failed: {}", e);
            (StatusCode::UNPROCESSABLE_ENTITY, Json(CompileResponse::Err { error: e }))
        }
        Err(e) => {
            error!("Spawn error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(CompileResponse::Err {
                error: "Internal server error.".into(),
            }))
        }
    }
}

fn compile_latex(latex: &str, assets: &[Asset]) -> Result<Vec<u8>, String> {
    let tmp      = tempfile::tempdir().map_err(|e| format!("Temp dir error: {e}"))?;
    let tex_path = tmp.path().join("input.tex");
    let pdf_path = tmp.path().join("input.pdf");

    // Write every asset image into the temp dir so \includegraphics can find them
    for asset in assets {
        // Sanitize filename — remove path separators
        let safe_name = std::path::Path::new(&asset.name)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png")
            .to_string();

        let img_path = tmp.path().join(&safe_name);
        match B64.decode(&asset.base64) {
            Ok(bytes) => {
                if let Err(e) = std::fs::write(&img_path, &bytes) {
                    error!("Failed to write asset {}: {}", safe_name, e);
                } else {
                    info!("Wrote asset: {} ({} bytes)", safe_name, bytes.len());
                }
            }
            Err(e) => error!("Failed to decode asset {}: {}", safe_name, e),
        }
    }

    let patched = auto_inject(latex);
    std::fs::write(&tex_path, &patched).map_err(|e| format!("Write error: {e}"))?;

    let tectonic_bin = find_tectonic();

    let output = Command::new(&tectonic_bin)
        .arg("--outdir")
        .arg(tmp.path())
        .arg("--print")
        .arg(&tex_path)
        .output()
        .map_err(|e| format!(
            "Could not run tectonic ('{}'): {e}\nMake sure tectonic is installed and in PATH.",
            tectonic_bin
        ))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let raw    = format!("{}{}", stdout, stderr);
        let clean  = filter_output(&raw);
        return Err(clean.trim().to_string());
    }

    std::fs::read(&pdf_path).map_err(|e| format!("Could not read PDF output: {e}"))
}

fn has_package(latex: &str, pkg: &str) -> bool {
    latex.contains(&format!(r"\usepackage{{{}}}", pkg))
}

fn has_tikzlib(latex: &str, lib: &str) -> bool {
    latex.contains(&format!("usetikzlibrary{{{}}}", lib))
        || (latex.contains("usetikzlibrary") && latex.contains(lib))
}

fn auto_inject(latex: &str) -> String {
    // Find \begin{document} — injections must go BEFORE it
    let doc_start = match latex.find(r"\begin{document}") {
        Some(pos) => pos,
        None => return latex.to_string(), // no \begin{document} — don't touch it
    };

    // Only look at the preamble for existing packages
    let preamble = &latex[..doc_start];

    let packages: &[(&str, &str)] = &[
        (r"\multirow",           "multirow"),
        (r"\cellcolor",          "colortbl"),
        (r"\rowcolor",           "colortbl"),
        (r"\blindtext",          "blindtext"),
        (r"\Blindtext",          "blindtext"),
        (r"\begin{tcolorbox}",   "tcolorbox"),
        (r"\tcbox",              "tcolorbox"),
        (r"\begin{lstlisting}",  "listings"),
        (r"\lstset",             "listings"),
        (r"\begin{tikzpicture}", "tikz"),
        (r"\begin{axis}",        "pgfplots"),
        (r"\pgfplotsset",        "pgfplots"),
        (r"\fancyhf",            "fancyhdr"),
        (r"\pagestyle{fancy}",   "fancyhdr"),
        (r"\begin{multicols}",   "multicol"),
        (r"\geometry{",          "geometry"),
        (r"\hypersetup",         "hyperref"),
        (r"\includegraphics",    "graphicx"),
        (r"\toprule",            "booktabs"),
        (r"\midrule",            "booktabs"),
        (r"\bottomrule",         "booktabs"),
        (r"\begin{subfigure}",   "subcaption"),
        (r"\caption{",           "caption"),
        (r"\definecolor",        "xcolor"),
        (r"\textcolor",          "xcolor"),
        (r"\colorbox",           "xcolor"),
        (r"\begin{enumerate}[",  "enumitem"),
        (r"\begin{itemize}[",    "enumitem"),
        (r"\begin{figure}[H]",   "float"),
        (r"\begin{table}[H]",    "float"),
    ];

    let tikzlibs: &[(&str, &str)] = &[
        ("diamond",       "shapes"),
        ("ellipse",       "shapes"),
        ("cylinder",      "shapes.geometric"),
        (">=stealth",     "arrows.meta"),
        (">=latex",       "arrows.meta"),
        ("fit=",          "fit"),
        ("calc",          "calc"),
        ("positioning",   "positioning"),
        ("node distance", "positioning"),
        ("mindmap",       "mindmap"),
        ("shadows",       "shadows"),
        ("decorations",   "decorations.pathmorphing"),
    ];

    let mut pkg_inject: Vec<&str> = Vec::new();
    let mut lib_inject: Vec<&str> = Vec::new();

    for (trigger, pkg) in packages {
        // trigger must appear somewhere in the full doc (body needs the package)
        // but the package must NOT already be in the preamble
        if latex.contains(trigger) && !has_package(preamble, pkg)
            && !pkg_inject.contains(pkg) {
            pkg_inject.push(pkg);
        }
    }

    if latex.contains(r"\begin{tikzpicture}") || latex.contains(r"\tikz") {
        for (trigger, lib) in tikzlibs {
            if latex.contains(trigger) && !has_tikzlib(preamble, lib)
                && !lib_inject.contains(lib) {
                lib_inject.push(lib);
            }
        }
    }

    if pkg_inject.is_empty() && lib_inject.is_empty() {
        return latex.to_string();
    }

    info!("Auto-injecting packages: {:?}", pkg_inject);
    info!("Auto-injecting tikzlibs: {:?}", lib_inject);

    let mut injection = String::new();
    for pkg in &pkg_inject {
        injection.push_str(&format!("\\usepackage{{{}}}\n", pkg));
    }
    for lib in &lib_inject {
        injection.push_str(&format!("\\usetikzlibrary{{{}}}\n", lib));
    }

    // Insert injection immediately before \begin{document}
    let mut result = latex.to_string();
    result.insert_str(doc_start, &injection);
    result
}

fn filter_output(raw: &str) -> String {
    let noise = [
        "fontconfig error",
        "cannot load default config",
        "no such file: (null)",
        "inputenc package ignored",
        "rerun to get",
        "running in backwards compatibility mode",
        "note: running tex",
        "latex2e",
        "l3 programming layer",
        "document class:",
        "(size",
        "(article.cls",
        "(inputenc.sty",
        "(graphicx.sty",
        "(hyperref.sty",
        "(geometry.sty",
        "(amsmath.sty",
        "for additional information on amsmath",
        "(amstext.sty",
        "(amsbsy.sty",
        "(amsopn.sty",
        "(amssymb.sty",
        "(amsfonts.sty",
        "patch level",
    ];

    raw.lines()
        .filter(|line| {
            let l = line.to_lowercase();
            !noise.iter().any(|n| l.contains(n))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn find_tectonic() -> String {
    if Command::new("tectonic").arg("--version").output().is_ok() {
        return "tectonic".to_string();
    }
    let scoop_user = format!(
        "{}\\scoop\\shims\\tectonic.exe",
        std::env::var("USERPROFILE").unwrap_or_default()
    );
    if std::path::Path::new(&scoop_user).exists() {
        return scoop_user;
    }
    let scoop_global = "C:\\ProgramData\\scoop\\shims\\tectonic.exe".to_string();
    if std::path::Path::new(&scoop_global).exists() {
        return scoop_global;
    }
    "tectonic".to_string()
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/compile", post(compile_handler))
        .layer(cors);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);
    info!("TexLiteCollab backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
