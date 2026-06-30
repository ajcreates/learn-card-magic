#!/usr/bin/env node
/**
 * sync-youtube.mjs
 * Fetches all videos from a YouTube playlist and syncs them to src/content/videos/
 * - Creates new YAML files for new videos
 * - Updates view counts + metadata for existing videos
 * - Regenerates public/llms.txt with updated video list
 *
 * Required env vars:
 *   YOUTUBE_API_KEY         — YouTube Data API v3 key
 *   YOUTUBE_PLAYLIST_ID     — The playlist ID to sync (e.g. PLxxxxxxx)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VIDEOS_DIR = path.join(ROOT, 'src/content/videos');
const LLMS_FILE = path.join(ROOT, 'public/llms.txt');

const API_KEY = process.env.YOUTUBE_API_KEY;
const PLAYLIST_ID = process.env.YOUTUBE_PLAYLIST_ID;

if (!API_KEY) {
  console.error('❌ YOUTUBE_API_KEY is required');
  process.exit(1);
}
if (!PLAYLIST_ID) {
  console.error('❌ YOUTUBE_PLAYLIST_ID is required');
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function toYaml(obj) {
  // Simple YAML serialiser — sufficient for our flat structure
  return Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map(i => `  - "${i.replace(/"/g, '\\"')}"`).join('\n')}`;
      }
      if (typeof v === 'number') return `${k}: ${v}`;
      return `${k}: "${String(v).replace(/"/g, '\\"')}"`;
    })
    .join('\n');
}

function inferDifficulty(tags, title) {
  const text = [...tags, title].join(' ').toLowerCase();
  if (text.includes('advanced') || text.includes('expert')) return 'advanced';
  if (text.includes('intermediate') || text.includes('sleight')) return 'intermediate';
  return 'beginner';
}

// ─── YouTube API ────────────────────────────────────────────────────────────

async function fetchPlaylistItems(playlistId) {
  const items = [];
  let pageToken = '';

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', API_KEY);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`YouTube API error (playlistItems): ${res.status} ${err}`);
    }
    const data = await res.json();
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return items;
}

async function fetchVideoStats(videoIds) {
  const stats = {};
  // API allows up to 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics,snippet');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`YouTube API error (videos): ${res.status} ${err}`);
    }
    const data = await res.json();
    for (const item of data.items || []) {
      stats[item.id] = {
        viewCount: parseInt(item.statistics?.viewCount || '0', 10),
        tags: item.snippet?.tags || [],
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        publishedAt: (item.snippet?.publishedAt || '').slice(0, 10),
      };
    }
  }
  return stats;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🎬 Syncing playlist: ${PLAYLIST_ID}`);

  // 1. Fetch playlist items
  const items = await fetchPlaylistItems(PLAYLIST_ID);
  console.log(`  Found ${items.length} videos in playlist`);

  if (items.length === 0) {
    console.log('  Nothing to sync.');
    return;
  }

  // 2. Fetch video stats
  const videoIds = items.map(i => i.contentDetails.videoId);
  const statsMap = await fetchVideoStats(videoIds);

  // 3. Sync each video
  let created = 0;
  let updated = 0;
  const syncedVideos = [];

  for (const item of items) {
    const videoId = item.contentDetails.videoId;
    const stats = statsMap[videoId];
    if (!stats) continue;

    const existingFiles = fs.readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.yaml'));
    const existingFile = existingFiles.find(f => {
      const content = fs.readFileSync(path.join(VIDEOS_DIR, f), 'utf-8');
      return content.includes(`youtubeId: "${videoId}"`);
    });

    const slug = existingFile
      ? existingFile.replace('.yaml', '')
      : slugify(stats.title);

    const ytTags = stats.tags.slice(0, 8).map(t => t.toLowerCase());
    const difficulty = inferDifficulty(ytTags, stats.title);

    const videoData = {
      youtubeId: videoId,
      title: stats.title,
      description: stats.description.split('\n')[0].slice(0, 200),
      tags: ytTags.length > 0 ? ytTags : ['card magic'],
      difficulty,
      viewCount: stats.viewCount,
      publishedAt: stats.publishedAt,
      slug,
    };

    const yamlContent = toYaml(videoData);
    const filePath = path.join(VIDEOS_DIR, `${slug}.yaml`);

    if (existingFile) {
      fs.writeFileSync(filePath, yamlContent);
      updated++;
    } else {
      fs.writeFileSync(filePath, yamlContent);
      created++;
    }

    syncedVideos.push({ slug, title: stats.title, difficulty });
  }

  console.log(`  ✅ Created: ${created}, Updated: ${updated}`);

  // 4. Regenerate llms.txt video section
  updateLlmsTxt(syncedVideos);
  console.log('  📄 Updated llms.txt');
}

function updateLlmsTxt(videos) {
  if (!fs.existsSync(LLMS_FILE)) return;

  const current = fs.readFileSync(LLMS_FILE, 'utf-8');
  const videoLines = videos
    .map(v => `- /learn-card-magic/videos/${v.slug}/ — ${v.title} (${v.difficulty})`)
    .join('\n');

  const updated = current.replace(
    /### Video Gallery\n[\s\S]*?(?=\n### |\n## |$)/,
    `### Video Gallery\nVideo demonstrations and tutorials, sourced from YouTube.\n- /learn-card-magic/videos/ — Full gallery with search, filter, and sort\n${videoLines}\n\n`
  );

  fs.writeFileSync(LLMS_FILE, updated);
}

main().catch(err => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
