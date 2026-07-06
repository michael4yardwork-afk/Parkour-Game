# Delta Rush

A high-speed 3D parkour racing game built for the web. Features a course builder, community-shared levels, competitive leaderboards, and a race mode.

**Stack:** React 19 + TypeScript + Three.js (frontend) · Node.js + Express (backend) · PostgreSQL

---

## Deploy to Railway (recommended)

Railway deploys automatically from GitHub on every push. The Express server serves both the API and the built React frontend from a single service.

### 1. Set up a free PostgreSQL database on Neon

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project — pick any name and region
3. Copy the **Connection string** (looks like `postgresql://user:pass@host/db?sslmode=require`)

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **New Project → Deploy from GitHub repo** and select this repository
3. Railway will detect Node.js automatically. Set the following in **Variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Paste your Neon connection string |
   | `JWT_SECRET` | A long random string (generate at [generate-secret.vercel.app/64](https://generate-secret.vercel.app/64)) |
   | `NODE_ENV` | `production` |

4. In **Settings → Build & Deploy**, confirm:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
5. Click **Deploy**. Railway builds the frontend, starts the server, and gives you a public URL.

### 3. Point your Hostinger domain to Railway

1. In Railway, go to your service → **Settings → Networking → Custom Domain** → add your domain (e.g. `deltarush.win`)
2. In Hostinger DNS settings, add a **CNAME record**:
   - **Name:** `@` (or `www`)
   - **Value:** the Railway domain shown (e.g. `xyz.up.railway.app`)
3. DNS propagates within a few minutes. Your domain will now serve the app.

---

## Run locally

**Prerequisites:** Node.js 20+, a PostgreSQL database

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET

# 3. Start the backend and frontend dev servers
npm run server &   # Express API on :3001
npm run dev        # Vite dev server on :5000
```

Open [http://localhost:5000](http://localhost:5000).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing auth tokens |
| `NODE_ENV` | production only | Set to `production` when deploying |
