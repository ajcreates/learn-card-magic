# Learn Card Magic 🃏

> **https://ajcreates.dev/learn-card-magic**

A static Astro site for beginners learning card magic with tutorials, blog posts, and a searchable video gallery. A corresponding YouTube channel with performance videos is also linked.

## Setup

```bash
npm install
npm run dev        # localhost:4321/learn-card-magic
npm run build      # builds to dist/
npm run preview    # preview production build
```

## YouTube Sync

To sync your YouTube playlist locally:

```bash
YOUTUBE_API_KEY=your_key YOUTUBE_PLAYLIST_ID=PLxxxxxxx node scripts/sync-youtube.mjs
```

In GitHub Actions, set these as:
- **Secret:** `YOUTUBE_API_KEY`
- **Variable:** `YOUTUBE_PLAYLIST_ID`

The sync runs automatically every day at 06:00 UTC. Trigger manually via **Actions → Sync YouTube Playlist → Run workflow**.

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via the deploy workflow.

Enable GitHub Pages:  
**Settings → Pages → Source: GitHub Actions**
