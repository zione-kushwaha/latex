# Firebase Setup Guide

## 1. Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it (e.g. `texlitecollab`)
3. Disable Google Analytics (not needed) → **Create project**

## 2. Enable Firestore

1. In the left sidebar → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll apply rules next)
4. Select a region close to you → **Enable**

## 3. Register a Web App

1. Project Overview → click the **</>** (Web) icon
2. App nickname: `texlitecollab-web` → **Register app**
3. Copy the `firebaseConfig` object — you'll need these values for `.env`

## 4. Fill in your .env

```bash
cd frontend
cp ../.env.example .env
# Edit .env and paste your Firebase config values
```

## 5. Deploy Firestore Security Rules

Install Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
firebase login
```

From the project root (`texlitecollab/`):
```bash
firebase use --add   # select your project
firebase deploy --only firestore:rules
```

This deploys `firestore.rules` which:
- Allows anyone to read/write rooms
- Enforces max 4 users per room
- Blocks all other collections

## 6. Verify

In the Firebase Console → **Firestore → Rules** tab, you should see the deployed rules.

## Firestore Document Structure

```
rooms/{roomId}
  content:     string   — full LaTeX source
  lastUpdated: timestamp
  users: [
    { id: string, name: string, color: string, cursor: number }
  ]
```
