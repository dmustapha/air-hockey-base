# Deployment Plan: Air Hockey to Railway (WebSocket) + Vercel (Frontend)

> **Status**: Ready to deploy
> **Estimated Time**: 30-60 minutes
> **Created**: 2026-01-22

---

## Quick Deploy Checklist

- [ ] Fix health check path in `railway.json` (change to `/api/health`)
- [ ] Push code to GitHub
- [ ] Create Railway project from GitHub repo
- [ ] Set Railway root directory to `server`
- [ ] Add Railway environment variables
- [ ] Generate Railway domain
- [ ] Create Vercel project from GitHub repo
- [ ] Add Vercel environment variables (use Railway URL)
- [ ] Deploy Vercel
- [ ] Update Railway `ALLOWED_ORIGINS` with Vercel URL
- [ ] Test health endpoint
- [ ] Test WebSocket connection
- [ ] Test full multiplayer game flow

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │    VERCEL        │         │         RAILWAY              │  │
│  │                  │         │                              │  │
│  │  Next.js App     │◄───────►│  Express Server              │  │
│  │  ├─ /            │  wss:// │  ├─ WebSocket (/ws)          │  │
│  │  ├─ /game        │         │  ├─ REST API (/api/*)        │  │
│  │  └─ /join        │         │  ├─ Physics Engine           │  │
│  │                  │         │  └─ Room Manager             │  │
│  │  Static Assets   │         │                              │  │
│  │  Edge Functions  │         │  Mock Linera Service         │  │
│  │                  │         │  (in-memory game data)       │  │
│  └──────────────────┘         └──────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Pre-Deployment Code Fix

### Fix Health Check Path

**File**: `server/railway.json`

Change from:
```json
{
  "deploy": {
    "healthcheckPath": "/health"
  }
}
```

To:
```json
{
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "on_failure"
  }
}
```

### Push to GitHub

```bash
git add -A
git commit -m "Fix health check path for Railway deployment"
git push origin main
```

---

## Step 2: Railway Deployment (WebSocket Server)

### 2.1 Create Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify email

### 2.2 Create Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway access
4. Select `air-hockey` repository

### 2.3 Configure Service
1. Click on the created service
2. Go to **Settings** tab
3. Set **Root Directory**: `server`

### 2.4 Add Environment Variables

Go to **Variables** tab and add:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` (update later) |

**Do NOT set** `LINERA_APPLICATION_ID` - keeps server in mock mode.

### 2.5 Generate Public Domain
1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy URL (e.g., `air-hockey-server-production.up.railway.app`)

Your WebSocket URL will be:
```
wss://air-hockey-server-production.up.railway.app/ws
```

### 2.6 Verify Deployment
```bash
curl https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/health
```

Expected:
```json
{"status":"healthy","timestamp":"2026-01-22T10:00:00.000Z"}
```

---

## Step 3: Vercel Deployment (Frontend)

### 3.1 Create Account
1. Go to https://vercel.com
2. Sign up with GitHub

### 3.2 Import Project
1. Click **"Add New"** → **"Project"**
2. Select `air-hockey` repository
3. Click **"Import"**

### 3.3 Configure Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `.` (root) |
| Build Command | `npm run build` |
| Output Directory | `.next` |

### 3.4 Add Environment Variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_WS_URL` | `wss://YOUR-RAILWAY-DOMAIN.up.railway.app/ws` |
| `NEXT_PUBLIC_USE_MOCK_LINERA` | `true` |

**Important**: Replace `YOUR-RAILWAY-DOMAIN` with your actual Railway URL!

### 3.5 Deploy
1. Click **"Deploy"**
2. Wait for build (1-3 minutes)
3. Copy deployed URL (e.g., `your-app.vercel.app`)

---

## Step 4: Post-Deployment Configuration

### Update Railway CORS

1. Go to Railway → Your project → **Variables**
2. Update `ALLOWED_ORIGINS`:
   ```
   https://your-app.vercel.app
   ```
3. Railway will auto-redeploy

---

## Step 5: Test Everything

### Test Health Endpoint
```bash
curl https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/health
```

### Test WebSocket (requires wscat)
```bash
npm install -g wscat
wscat -c wss://YOUR-RAILWAY-DOMAIN.up.railway.app/ws
```

### Test Full Game Flow
1. Open `https://your-app.vercel.app`
2. Open browser DevTools (F12) → Console
3. Look for: `[MultiplayerContext] Connecting to...`
4. Create a multiplayer game
5. Copy room code
6. Open incognito window, paste room code to join
7. Verify both players see each other and can play!

---

## Environment Variables Reference

### Railway (Server)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `ALLOWED_ORIGINS` | Yes | Your Vercel URL |
| `PORT` | No | Railway auto-sets |

### Vercel (Frontend)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WS_URL` | Yes | `wss://YOUR-RAILWAY-DOMAIN/ws` |
| `NEXT_PUBLIC_USE_MOCK_LINERA` | No | Set to `true` |

---

## Troubleshooting

### WebSocket Connection Failed

1. Check `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
2. Ensure URL ends with `/ws`
3. Verify Railway is running (check dashboard)
4. Check CORS - add Vercel domain to `ALLOWED_ORIGINS`

### Health Check Failing

1. Verify `railway.json` uses `/api/health`
2. Check Railway logs for errors
3. Test locally: `cd server && npm run dev`

### Build Fails on Vercel

1. Check Vercel logs for specific error
2. Test locally: `npm run build`
3. TypeScript errors should be ignored (configured)

---

## Cost

| Service | Free Tier |
|---------|-----------|
| **Railway** | $5/month credit (~500 hours) |
| **Vercel** | Free for hobby projects |

Both should remain free for moderate usage (<1000 daily users).

---

## Next Steps After Deployment

1. ✅ Verify multiplayer works across devices
2. 📊 Set up monitoring (Railway provides basic metrics)
3. 🔒 Consider custom domain with SSL
4. 📦 Implement Supabase for persistence (see `supabase-integration-plan.md`)
