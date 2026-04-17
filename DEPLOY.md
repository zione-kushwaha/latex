# Deployment Guide

## Overview

| Service    | What                        | URL after deploy                        |
|------------|-----------------------------|-----------------------------------------|
| Vercel     | React frontend              | `https://texlitecollab.vercel.app`      |
| Fly.io     | Rust backend (PDF compiler) | `https://texlitecollab-backend.fly.dev` |
| Firebase   | Firestore realtime DB       | (managed by Google)                     |

---

## 1. Prerequisites

- GitHub repo with this code pushed to `main`
- [Vercel account](https://vercel.com) (free)
- [Fly.io account](https://fly.io) (free tier works)
- Firebase project with Firestore enabled

---

## 2. Deploy Backend → Fly.io

### First-time setup (run once locally)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Create the app (from the backend/ folder)
cd backend
flyctl apps create texlitecollab-backend

# Deploy
flyctl deploy
```

### Get your API token for GitHub Actions

```bash
flyctl auth token
```

Copy the token — you'll add it as `FLY_API_TOKEN` in GitHub secrets.

### Verify it's running

```bash
curl https://texlitecollab-backend.fly.dev/health
# → ok
```

---

## 3. Deploy Frontend → Vercel

### First-time setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project (from frontend/ folder)
cd frontend
vercel link
```

This creates `.vercel/project.json` with your `orgId` and `projectId`.

### Get tokens for GitHub Actions

```bash
# Get org and project IDs
cat frontend/.vercel/project.json
# → { "orgId": "...", "projectId": "..." }

# Create a Vercel token at: https://vercel.com/account/tokens
```

### Set environment variables in Vercel dashboard

Go to your Vercel project → Settings → Environment Variables and add:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_BACKEND_URL   →  https://texlitecollab-backend.fly.dev
```

---

## 4. GitHub Actions Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add all of these:

| Secret name                       | Where to get it                              |
|-----------------------------------|----------------------------------------------|
| `FLY_API_TOKEN`                   | `flyctl auth token`                          |
| `VERCEL_TOKEN`                    | vercel.com/account/tokens                    |
| `VERCEL_ORG_ID`                   | `cat frontend/.vercel/project.json`          |
| `VERCEL_PROJECT_ID`               | `cat frontend/.vercel/project.json`          |
| `VITE_FIREBASE_API_KEY`           | Firebase Console → Project Settings          |
| `VITE_FIREBASE_AUTH_DOMAIN`       | Firebase Console → Project Settings          |
| `VITE_FIREBASE_PROJECT_ID`        | Firebase Console → Project Settings          |
| `VITE_FIREBASE_STORAGE_BUCKET`    | Firebase Console → Project Settings          |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console → Project Settings        |
| `VITE_FIREBASE_APP_ID`            | Firebase Console → Project Settings          |
| `VITE_BACKEND_URL`                | `https://texlitecollab-backend.fly.dev`      |

---

## 5. How CI/CD works after setup

```
git push origin main
        │
        ├─► ci.yml          — builds frontend + checks backend on every push/PR
        ├─► deploy-backend.yml  — deploys to Fly.io if backend/ changed
        └─► deploy-frontend.yml — deploys to Vercel if frontend/ changed
```

- PRs run CI only (no deploy)
- Merging to `main` triggers deploy automatically
- You can also trigger manually via GitHub → Actions → Run workflow

---

## 6. Scaling on Fly.io

The default config uses `auto_stop_machines = true` which means the machine
sleeps when idle (free tier). First request after sleep takes ~3s to wake up.

To keep it always on:

```bash
cd backend
flyctl scale count 1
# then in fly.toml set: min_machines_running = 1
```

---

## 7. Custom domain (optional)

**Vercel:** Project → Settings → Domains → Add domain

**Fly.io:**
```bash
flyctl certs add api.yourdomain.com
```
Then add a CNAME record pointing to `texlitecollab-backend.fly.dev`.
