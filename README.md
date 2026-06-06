# Life Analytics Dashboard

A mobile-first PWA + native app (Expo + React Native) that tracks daily habits in under 30 seconds and auto-generates a Life Score, streaks, GitHub-style heatmaps, trends, predictions, and correlations.

Single-user (no auth). Stack: **Expo / React Native** • **FastAPI** • **MongoDB**.

---

## 1. Required environment variables

### `backend/.env`

| Variable    | Required | Description                                                              | Example                                                 |
| ----------- | -------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `MONGO_URL` | yes      | MongoDB connection string. Local Mongo, Atlas, or any Mongo-compatible URI. | `mongodb://localhost:27017` or `mongodb+srv://...` |
| `DB_NAME`   | yes      | Database name. Created automatically on first write.                     | `life_analytics`                                        |

### `frontend/.env`

| Variable                  | Required | Description                                                                                                       | Example                       |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `EXPO_PUBLIC_BACKEND_URL` | yes      | Public URL where the FastAPI backend is reachable from the browser / device. **No trailing slash.** The app appends `/api/...` itself. | `http://localhost:8001` or `https://api.yourdomain.com` |

> Anything prefixed with `EXPO_PUBLIC_` is embedded into the JS bundle at build time. Do **not** put server secrets in the frontend `.env`.

The other `EXPO_PACKAGER_*` and `EXPO_TUNNEL_*` variables you may see in the Emergent preview environment are only used by Emergent's hosted Metro tunnel and are **not** needed when you run the app yourself.

---

## 2. Example `.env` files

Both example files are committed at:

* `backend/.env.example`
* `frontend/.env.example`

Copy them to real `.env` files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

---

## 3. MongoDB setup

Pick **one** of the following.

### Option A — Local MongoDB (fastest for dev)

* macOS (Homebrew): `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
* Ubuntu/Debian: [official install guide](https://www.mongodb.com/docs/manual/administration/install-on-linux/)
* Windows: install MongoDB Community Edition, run as a service.

Then in `backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="life_analytics"
```

### Option B — Docker (zero-install)

```bash
docker run -d --name life-mongo -p 27017:27017 -v life_mongo_data:/data/db mongo:7
```

Same `MONGO_URL` as Option A.

### Option C — MongoDB Atlas (free cloud tier)

1. Create an account at <https://www.mongodb.com/cloud/atlas>.
2. Create a free M0 cluster.
3. Network Access → "Allow access from anywhere" (or your IP).
4. Database Access → create a user/password.
5. "Connect" → "Drivers" → copy the connection string. It looks like:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. In `backend/.env`:

   ```env
   MONGO_URL="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
   DB_NAME="life_analytics"
   ```

No schema migrations are needed — the app seeds 15 default habits on the first API call automatically.

---

## 4. Local development

### Prerequisites

* **Python 3.11+**
* **Node 20+** and **Yarn**
* MongoDB running (see section 3)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # then edit if needed
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Sanity check: <http://localhost:8001/api/habits> should return JSON (and will seed defaults on first hit).

### Frontend

```bash
cd frontend
yarn install
cp .env.example .env                                 # set EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
npx expo start
```

Then:

* press **w** → open in browser (PWA)
* press **i** / **a** → iOS simulator / Android emulator
* scan the QR with the **Expo Go** app on your phone (use your LAN IP for `EXPO_PUBLIC_BACKEND_URL`, e.g. `http://192.168.1.20:8001`)

---

## 5. Deployment

The app is two independent services. Pick a target for each.

### 5.1 Backend (FastAPI)

The backend is a stateless ASGI app. Any platform that runs a long-running Python process works.

**Start command (every platform):**

```
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Set env vars `MONGO_URL` and `DB_NAME` on the platform.

| Platform              | Notes                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Railway**           | New Project → Deploy from GitHub repo → set root to `backend/` → add `MONGO_URL`, `DB_NAME` → it auto-detects Python and runs the command above. Optionally add a Railway-managed MongoDB plugin. |
| **Render**            | New Web Service → Python → root dir `backend/` → build `pip install -r requirements.txt` → start `uvicorn server:app --host 0.0.0.0 --port $PORT` → add env vars. |
| **Fly.io**            | `fly launch` inside `backend/`, set secrets with `fly secrets set MONGO_URL=... DB_NAME=...`.                                          |
| **Emergent (in-app)** | Click the **Publish** button at the top-right of the Emergent editor — it deploys both backend and frontend together.                  |
| **Docker / VPS**      | Build a 3-line Dockerfile (`FROM python:3.11-slim`, copy + `pip install`, run uvicorn). Deploy anywhere. |

Health check path: `GET /api/` returns `{"ok": true}`.

CORS is already wide-open (`allow_origins=["*"]`) so your frontend domain doesn't need to be whitelisted.

### 5.2 Frontend (Expo)

Three deploy targets — pick what you need:

#### a) PWA / Web (recommended for "Life Analytics Dashboard")

Build a static web bundle:

```bash
cd frontend
# Make sure EXPO_PUBLIC_BACKEND_URL in .env points at your DEPLOYED backend URL first.
npx expo export --platform web
# Output: dist/
```

Deploy the `dist/` folder to any static host:

| Host           | Command / steps                                                                  |
| -------------- | -------------------------------------------------------------------------------- |
| **Vercel**     | `vercel --prod` (set Output Directory = `dist`)                                  |
| **Netlify**    | `netlify deploy --dir=dist --prod`                                               |
| **Cloudflare Pages** | Connect repo, build command `cd frontend && yarn install && npx expo export --platform web`, output `frontend/dist`. |
| **GitHub Pages** | Push `frontend/dist` to a `gh-pages` branch.                                   |

The `app.json` already declares the PWA manifest (`display: standalone`, theme color, etc.), so users can "Add to Home Screen" on iOS/Android.

#### b) Native iOS / Android binaries

Use **EAS Build** (Expo's cloud build service):

```bash
cd frontend
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios       # produces an .ipa
eas build --platform android   # produces an .aab / .apk
```

Submit with `eas submit --platform ios` / `--platform android`.

(If you're on the Emergent platform, the **Publish** button does the iOS/Android build flow for you and prompts for the required credentials.)

#### c) Quick demo via Expo Go

`npx expo start --tunnel` and share the QR. Anyone with the Expo Go app can open it instantly. Backend must be reachable from the internet (not `localhost`) for this to work.

### 5.3 End-to-end example (Render + Vercel + Atlas)

1. Create a MongoDB Atlas free cluster → grab the `mongodb+srv://...` URL.
2. Push your repo to GitHub.
3. **Render**: New Web Service → root `backend/` → start cmd `uvicorn server:app --host 0.0.0.0 --port $PORT` → env: `MONGO_URL`, `DB_NAME=life_analytics`. Deploy. Note the public URL, e.g. `https://life-api.onrender.com`.
4. In `frontend/.env` set `EXPO_PUBLIC_BACKEND_URL=https://life-api.onrender.com`.
5. `cd frontend && npx expo export --platform web`.
6. **Vercel**: deploy `frontend/dist`. Done.

---

## Where do `MONGO_URL` and `DB_NAME` come from?

* **`MONGO_URL`** — the connection string for **whatever MongoDB instance you choose** to run against. It does *not* come bundled with the app; you provide it via `backend/.env` (local) or platform env vars (deployed). Three common sources:
  * local `mongod` → `mongodb://localhost:27017`
  * Docker `mongo:7` container → same as local
  * MongoDB Atlas (free tier in the cloud) → `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/...`
* **`DB_NAME`** — a name **you choose**. MongoDB creates the database lazily on the first write. Use anything memorable, e.g. `life_analytics` or `life_analytics_prod`.

Both values are only ever read by `backend/server.py` and never exposed to the frontend.

---

## Project structure

```
backend/
  server.py             # FastAPI app: habits, checkins, analytics
  requirements.txt
  .env.example          # template for backend/.env

frontend/
  app/                  # Expo Router screens (file-based routing)
    _layout.tsx
    index.tsx           # redirects to (tabs)
    (tabs)/
      _layout.tsx       # bottom tab nav
      index.tsx         # Dashboard
      check-in.tsx      # Daily Check-In
      insights.tsx      # Trends, correlations, prediction
      history.tsx       # Timeline of past days
      settings.tsx      # Habit & category CRUD
  src/
    components/         # LifeScoreRing, Heatmap, TrendChart, Checkbox, DateStrip, Toast
    lib/                # api.ts, theme.ts
  app.json              # Expo + PWA manifest config
  .env.example          # template for frontend/.env
```

## API quick reference

* `GET /api/habits` — list active habits (seeds 15 defaults on first call)
* `POST /api/habits` `{ name, category }` — create
* `PUT /api/habits/{id}` `{ name?, category?, archived? }` — update
* `DELETE /api/habits/{id}` — delete
* `GET /api/checkins/{YYYY-MM-DD}` — fetch a day
* `POST /api/checkins` `{ date, completed_habit_ids[], mood?, energy?, notes? }` — idempotent upsert by `date`
* `GET /api/checkins?start=YYYY-MM-DD&end=YYYY-MM-DD` — list
* `GET /api/analytics/dashboard` — life score, category scores, streaks, 180-day heatmap
* `GET /api/analytics/insights` — 12-week trend, top habits, correlations, narratives, prediction
