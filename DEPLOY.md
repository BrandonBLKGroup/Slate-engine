# Slate Engine — Deployment Guide

## What This Is
A single Railway service that automatically renders listing graphics and creates videos.
When a client submits a listing in the portal, this service generates the graphic and uploads it back — zero human involvement.

## Architecture
```
Client submits listing in portal
  → Supabase inserts graphic row (status: "generating")
  → Supabase webhook fires to Slate Engine
  → Engine renders 1200x1200 graphic with Puppeteer
  → Uploads PNG to Supabase Storage
  → Updates graphic row (status: "ready", file_url set)
  → Client sees finished graphic in My Graphics tab
```

Same flow for videos with FFmpeg instead of Puppeteer.

## Step 1: Deploy to Railway

### Option A: GitHub (recommended)
1. Create new repo: `BrandonBLKGroup/slate-engine`
2. Push the code from the ZIP
3. In Railway dashboard → New Project → Deploy from GitHub repo
4. Railway auto-detects the Dockerfile and builds

### Option B: Railway CLI
```bash
cd slate-engine
railway init
railway up
```

## Step 2: Set Environment Variables in Railway

Go to your Railway project → Variables tab → Add these:

```
SUPA_URL=https://jdztwoaaissvauuyodfb.supabase.co
SUPA_SERVICE_KEY=<your-supabase-service-role-key>
SPARTAN2_URL=https://gunicorn-app-production-c290.up.railway.app
PORT=3000
```

**IMPORTANT:** You need the Supabase SERVICE ROLE key (not the anon key).
Find it in Supabase → Settings → API → service_role key.
This gives the backend full database access without RLS restrictions.

## Step 3: Set Up Supabase Webhooks

In Supabase Dashboard → Database → Webhooks → Create new:

### Webhook 1: Graphics
- Name: `graphic_render_trigger`
- Table: `graphics`
- Events: INSERT
- Type: HTTP Request
- Method: POST
- URL: `https://<your-railway-url>/webhook`
- Headers: `Content-Type: application/json`

### Webhook 2: Videos
- Name: `video_render_trigger`
- Table: `video_requests`
- Events: INSERT
- Type: HTTP Request
- Method: POST
- URL: `https://<your-railway-url>/webhook`
- Headers: `Content-Type: application/json`

Replace `<your-railway-url>` with your Railway deployment URL.

## Step 4: Test It

1. Log into the portal at app.slatesocialrem.com
2. Go to Add Listing, fill in details, upload photos, submit
3. Go to My Graphics — you should see status "generating"
4. Wait 15-30 seconds
5. Refresh — graphic should now show as "ready" with the rendered image

## How It Works

### Graphics
- Reads the client's template style from the database
- Builds a full HTML page matching that template at 1200x1200 pixels
- Uses real listing photos, address, specs, price
- Includes the client's brokerage bar (logo, name, license, disclaimer)
- Renders with Puppeteer (headless Chrome)
- Optimizes with Sharp
- Uploads to Supabase Storage
- BLK Group custom template routes to Spartan 2 instead

### Videos
- Downloads all photos from the video request
- Resizes to 1080x1080 (square for Instagram)
- Creates crossfade transitions between photos
- Renders with FFmpeg
- Uploads MP4 to Supabase Storage

### Supported Templates
All 8 preset styles render automatically:
- Bold & Dark (hero_bottom)
- Clean & Minimal (photo_top)
- Luxury Gold (split_left)
- Elegant & Warm (framed_center)
- Modern Blue (grid_banner)
- Earthy & Natural (organic_cutout)
- Magazine Editorial (magazine)
- Polaroid Stack (polaroid)

## Monitoring
- Railway logs show all render activity
- Each render logs: template used, listing ID, render time
- Errors are caught and graphic status set to "error"
- Health check at /health for Railway monitoring
