# 📄 TexLiteCollab

A lightweight real-time collaborative LaTeX editor for up to 4 users, built with React + Firebase + Rust (Axum + Tectonic).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, CodeMirror 6, Firebase SDK v10 |
| Realtime DB | Firebase Firestore (onSnapshot) |
| Backend | Rust 2021, Axum 0.7, Tectonic 0.16 |
| Compiler | Tectonic (LaTeX → PDF, no TeX installation needed) |

---

## Project Structure

```
texlitecollab/
├── frontend/               React + Vite app
│   ├── src/
│   │   ├── components/     LatexEditor, PdfPreview, Toolbar, UserList
│   │   ├── hooks/          useRoom, useCompile
│   │   ├── lib/            firebase.js, room.js, user.js
│   │   └── pages/          HomePage, RoomPage
│   ├── .env.example
│   └── package.json
├── backend/                Rust Axum server
│   ├── src/main.rs
│   └── Cargo.toml
├── firestore.rules
├── firebase.json
├── .env.example
└── init-firestore-rules.md
```

---

## Prerequisites

- Node.js 18+
- Rust (stable, via https://rustup.rs)
- A Firebase project with Firestore enabled (see `init-firestore-rules.md`)

> **Note on Tectonic:** The first `cargo build` will download Tectonic's TeX bundle (~200 MB). Subsequent builds are cached.

---

## Local Setup

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd texlitecollab

# Frontend env
cp .env.example frontend/.env
# Edit frontend/.env with your Firebase config values
```

### 2. Start the Rust backend

```bash
cd backend
cargo run --release
# Server starts on http://localhost:3001
```

### 3. Start the React frontend

```bash
cd frontend
npm install
npm run dev
# App starts on http://localhost:5173
```

### 4. Open the app

Navigate to http://localhost:5173 → click **Create New Room**.

---

## Testing with Multiple Users

1. Open http://localhost:5173 in your browser → Create a room
2. Copy the room URL from the toolbar (🔗 button)
3. Open 2–4 browser tabs (or different browsers) and paste the URL
4. Each tab gets a random username + color
5. Type in any tab — all others update in real time
6. Click **▶ Compile** to generate a PDF preview

---

## Compile to PDF

The **▶ Compile** button sends the current LaTeX source to the Rust backend (`POST /compile`).

- The backend uses **Tectonic** to compile LaTeX → PDF entirely in-process (no `pdflatex` needed)
- The PDF is returned as base64 and rendered in an `<iframe>`
- Compilation errors are shown in the preview panel
- Enable **Auto-compile** to recompile 2 seconds after each change

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
# Push to GitHub, import repo in vercel.com
# Set environment variables in Vercel dashboard (same as .env)
```

### Backend → Railway

1. Push the `backend/` folder to a GitHub repo
2. Create a new Railway project → **Deploy from GitHub**
3. Set `RUST_LOG=info` in Railway environment variables
4. Railway auto-detects Rust and builds with `cargo build --release`
5. Update `VITE_BACKEND_URL` in your Vercel frontend env to the Railway URL

### Backend → Fly.io

```bash
cd backend
fly launch          # follow prompts
fly deploy
```

---

## API Reference

### `POST /compile`

**Request:**
```json
{ "latex": "\\documentclass{article}..." }
```

**Success response:**
```json
{ "pdf": "<base64-encoded PDF bytes>" }
```

**Error response:**
```json
{ "error": "Compile error: undefined control sequence..." }
```

---

## Firestore Data Model

```
rooms/{roomId}
  content:     string        Full LaTeX source
  lastUpdated: Timestamp     Server timestamp of last edit
  users:       Array<User>   Active users (max 4)

User {
  id:     string   UUID (stored in sessionStorage)
  name:   string   Random adjective + animal
  color:  string   Hex color
  cursor: number   Caret position in document
}
```

---

## Security Notes

- Firestore rules enforce max 4 users per room and block all other collections
- LaTeX input is validated (must contain `\documentclass`) before compilation
- No user authentication — rooms are identified by URL only; keep room IDs private
- For production, tighten Firestore rules to require auth

---

## License

MIT
