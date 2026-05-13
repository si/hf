#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const FEED_URL = process.env.RSS_FEED_URL || 'https://pinecast.com/feed/housefinesse';
const POSTS_DIR = path.join(__dirname, '..', 'src', 'posts');
const COVER_IMAGES_DIR = path.join(__dirname, '..', 'src', 'img', 'cover-images');

// ─── XML helpers ─────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  const escaped = tag.replace(':', '\\:');
  const m = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return m ? stripCdata(m[1].trim()) : '';
}

function extractAttr(xml, tag, attr) {
  const escaped = tag.replace(':', '\\:');
  const m = xml.match(new RegExp(`<${escaped}[^>]*\\s${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function stripCdata(str) {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

// ─── HTML → Markdown ─────────────────────────────────────────────────────────

function htmlToMarkdown(html) {
  if (!html) return '';
  let md = html;

  // Ordered lists
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let n = 0;
    return (
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, content) => {
        n++;
        return `${n}. ${content.trim()}\n`;
      }) + '\n'
    );
  });

  // Unordered lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    return (
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, content) => {
        return `- ${content.trim()}\n`;
      }) + '\n'
    );
  });

  // Block elements
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `${c.trim()}\n\n`);
  md = md.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, c) => `**${c.trim()}**\n\n`);
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Inline elements
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  md = md.replace(/<a[^>]*\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  return md.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function parseIsoDate(pubDate) {
  const d = new Date(pubDate);
  if (isNaN(d)) throw new Error(`Invalid date: ${pubDate}`);
  return d.toISOString().split('T')[0];
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractEpisodeCode(title) {
  const m = title.match(/^(HF\d+)/i);
  return m ? m[1].toLowerCase() : null;
}

function episodeSlug(title, author) {
  const code = extractEpisodeCode(title);
  if (code && author) return `${code}-with-${slugify(author)}`;
  if (code) return code;
  return slugify(title);
}

function imageFilename(url) {
  if (!url) return '';
  try {
    return path.basename(new URL(url).pathname);
  } catch {
    return url.split('/').pop().split('?')[0];
  }
}

function normalizeDuration(d) {
  if (!d) return '';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(d)) return d;
  const secs = parseInt(d, 10);
  if (!isNaN(secs) && String(secs) === d.trim()) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return d;
}

// ─── Repo state ───────────────────────────────────────────────────────────────

// Returns { pinecastIds: Set, episodeNumbers: Set, latestDate: Date }
function getRepoState() {
  const pinecastIds = new Set();
  const episodeNumbers = new Set();
  let latestDate = new Date(0);

  if (!fs.existsSync(POSTS_DIR)) return { pinecastIds, episodeNumbers, latestDate };

  for (const entry of fs.readdirSync(POSTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(POSTS_DIR, entry.name))) {
      if (!file.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(POSTS_DIR, entry.name, file), 'utf8');

      const uuid = content.match(/pinecast\.com\/listen\/([a-f0-9-]{36})/);
      if (uuid) pinecastIds.add(uuid[1]);

      const ep = content.match(/^episode:\s*(\d+)/m);
      const season = content.match(/^season:\s*(\d+)/m);
      if (ep && season) episodeNumbers.add(`S${season[1]}E${ep[1]}`);

      const dateMatch = content.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
      if (dateMatch) {
        const d = new Date(dateMatch[1]);
        if (d > latestDate) latestDate = d;
      }
    }
  }

  return { pinecastIds, episodeNumbers, latestDate };
}

// ─── Image download ───────────────────────────────────────────────────────────

async function downloadCoverImage(imageUrl) {
  const filename = imageFilename(imageUrl);
  if (!filename) return filename;

  if (!fs.existsSync(COVER_IMAGES_DIR)) fs.mkdirSync(COVER_IMAGES_DIR, { recursive: true });
  const destPath = path.join(COVER_IMAGES_DIR, filename);

  if (fs.existsSync(destPath)) {
    console.log(`  Cover image already present: ${filename}`);
    return filename;
  }

  const res = await fetch(imageUrl, { headers: { 'User-Agent': 'house-finesse-rss-bot/1.0' } });
  if (!res.ok) {
    console.warn(`  Warning: could not download cover image (${res.status}): ${imageUrl}`);
    return filename;
  }
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
  console.log(`  Downloaded cover image: ${filename}`);
  return filename;
}

// ─── Post file ───────────────────────────────────────────────────────────────

function buildPost(fields) {
  const q = (s) => s.replace(/"/g, '\\"');
  const lines = [
    '---',
    `title: "${q(fields.title)}"`,
    `date: "${fields.date}"`,
    'categories:',
    '  - "shows"',
    `author: "${q(fields.author)}"`,
    'tags:',
    `  - "${slugify(fields.author)}"`,
  ];
  if (fields.enclosure) lines.push(`enclosure: "${fields.enclosure}"`);
  if (fields.coverImage) lines.push(`coverImage: "${fields.coverImage}"`);
  if (fields.redirectFrom) lines.push(`redirectFrom: "${fields.redirectFrom}"`);
  if (fields.episode) lines.push(`episode: ${fields.episode}`);
  if (fields.season) lines.push(`season: ${fields.season}`);
  lines.push(`explicit: "${fields.explicit || 'no'}"`);
  if (fields.duration) lines.push(`duration: "${fields.duration}"`);
  lines.push('---', '', fields.body, '');
  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'house-finesse-rss-bot/1.0' } });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) items.push(m[1]);

  if (items.length === 0) {
    console.log('No items found in feed.');
    return;
  }

  const { pinecastIds, episodeNumbers, latestDate } = getRepoState();
  console.log(`Latest post in repo: ${latestDate.toISOString().split('T')[0]}`);

  let created = 0;

  for (const item of items) {
    const title = extractTag(item, 'title');
    const pubDate = extractTag(item, 'pubDate');
    let date;
    try {
      date = parseIsoDate(pubDate);
    } catch {
      console.warn(`  Skipping item with unparseable date: "${pubDate}"`);
      continue;
    }

    // Only process episodes newer than the most recent post in the repo
    if (new Date(date) <= latestDate) {
      console.log(`  Skipping (not newer than latest post): ${title}`);
      continue;
    }

    const enclosureUrl = extractAttr(item, 'enclosure', 'url');
    const pinecastId = enclosureUrl.match(/pinecast\.com\/listen\/([a-f0-9-]{36})/)?.[1];

    // UUID dedup (secondary safety net)
    if (pinecastId && pinecastIds.has(pinecastId)) {
      console.log(`  Skipping (UUID already in repo): ${title}`);
      continue;
    }

    const author = extractTag(item, 'itunes:author') || extractTag(item, 'author');
    if (!author) {
      console.warn(`  Skipping (no author found): ${title}`);
      continue;
    }

    const episode = extractTag(item, 'itunes:episode');
    const season = extractTag(item, 'itunes:season');

    // Episode number dedup
    if (episode && season && episodeNumbers.has(`S${season}E${episode}`)) {
      console.log(`  Skipping (S${season}E${episode} already in repo): ${title}`);
      continue;
    }

    const duration = normalizeDuration(extractTag(item, 'itunes:duration'));
    const explicit = extractTag(item, 'itunes:explicit') || 'no';
    const body = htmlToMarkdown(extractTag(item, 'description'));

    const enclosureLength = extractAttr(item, 'enclosure', 'length');
    const enclosureType = extractAttr(item, 'enclosure', 'type');
    const enclosure = enclosureUrl
      ? `${enclosureUrl} ${enclosureLength} ${enclosureType}`.trim()
      : '';

    const imageUrl = extractAttr(item, 'itunes:image', 'href');
    const coverImage = await downloadCoverImage(imageUrl);

    const epCode = extractEpisodeCode(title);
    const slug = episodeSlug(title, author);
    const redirectFrom = epCode ? `/${epCode}` : '';
    const year = date.slice(0, 4);
    const filename = `${date}-${slug}.md`;

    const yearDir = path.join(POSTS_DIR, year);
    if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir, { recursive: true });

    const filepath = path.join(yearDir, filename);
    if (fs.existsSync(filepath)) {
      console.log(`  Skipping (file exists): ${filename}`);
      continue;
    }

    fs.writeFileSync(
      filepath,
      buildPost({ title, date, author, enclosure, coverImage, redirectFrom, episode, season, explicit, duration, body }),
      'utf8',
    );
    console.log(`Created: src/posts/${year}/${filename}`);
    created++;
  }

  console.log(created === 0 ? 'No new episodes found.' : `Done. Created ${created} new post(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
