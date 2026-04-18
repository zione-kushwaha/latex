# ── Stage 1: Build Rust binary ────────────────────────────────────────────────
FROM rust:1.82-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev libfontconfig1-dev \
    libgraphite2-dev libharfbuzz-dev libicu-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY src ./src
RUN touch src/main.rs && cargo build --release

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates curl \
    libssl3 libfontconfig1 libgraphite2-3 \
    libharfbuzz0b libicu72 zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Download pre-built tectonic binary from GitHub releases
RUN curl -fsSL \
    https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/tectonic \
    && tectonic --version

WORKDIR /app
COPY --from=builder /app/target/release/server ./server

ENV RUST_LOG=info
EXPOSE 3001

CMD ["./server"]
