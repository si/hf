#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const FEED_URL = process.env.RSS_FEED_URL || 'https://pinecast.com/feed/housefinesse';
const POSTS_DIR = path.join(__dirname, '..', 'src', 'posts');

function extractTag(xml, tag) {
  // Handles optional namespace prefix (e.g. itunes:duration)
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
  // "HF322 with DJ Tai" -> "hf322"
  const m = title.match(/^(HF\d+)/i);
  return m ? m[1].toLowerCase() : null;
}

function deriveCoverImage(title, author) {
  // "HF322", "Taiwo" -> "HF322_with_Taiwo.jpg"
  const m = title.match(/^(HF\d+)/i);
  if (!m) return '';
  return `${m[1].toUpperCase()}_with_${author.replace(/\s+/g, '_')}.jpg`;
}

// Collect Pinecast UUIDs already referenced in existing posts to avoid duplicates
function getExistingPinecastIds() {
  const ids = new Set();
  if (!fs.existsSync(POSTS_DIR)) return ids;
  for (const entry of fs.readdirSync(POSTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const yearDir = path.join(POSTS_DIR, entry.name);
    for (const file of fs.readdirSync(yearDir)) {
      if (!file.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(yearDir, file), 'utf8');
      const m = content.match(/pinecast\.com\/listen\/([a-f0-9-]{36})/);
      if (m) ids.add(m[1]);
    }
  }
  return ids;
}

function buildFrontmatter(fields) {
  const lines = [
    '---',
    `title: "${fields.title.replace(/"/g, '\\"')}"`,
    `date: "${fields.date}"`,
    'categories:',
    '  - "shows"',
    `author: "${fields.author.replace(/"/g, '\\"')}"`,
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
  lines.push('---', '', fields.description, '');
  return lines.join('\n');
}

async function main() {
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'house-finesse-rss-bot/1.0' },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const items = [];
  let m;
  while ((m = itemRegex.exec(xml)) !== null) items.push(m[1]);

  if (items.length === 0) {
    console.log('No items found in feed.');
    return;
  }

  const existing = getExistingPinecastIds();
  let created = 0;

  for (const item of items) {
    const enclosureUrl = extractAttr(item, 'enclosure', 'url');
    const pinecastId = enclosureUrl.match(/pinecast\.com\/listen\/([a-f0-9-]{36})/)?.[1];

    if (!pinecastId) continue;
    if (existing.has(pinecastId)) continue;

    const title = extractTag(item, 'title');
    const pubDate = extractTag(item, 'pubDate');
    const date = parseIsoDate(pubDate);
    const year = date.slice(0, 4);

    const author = extractTag(item, 'itunes:author') || extractTag(item, 'author');
    const duration = extractTag(item, 'itunes:duration');
    const episode = extractTag(item, 'itunes:episode');
    const season = extractTag(item, 'itunes:season');
    const explicit = extractTag(item, 'itunes:explicit') || 'no';
    const description = extractTag(item, 'description');

    const enclosureLength = extractAttr(item, 'enclosure', 'length');
    const enclosureType = extractAttr(item, 'enclosure', 'type');
    const enclosure = enclosureUrl
      ? `${enclosureUrl} ${enclosureLength} ${enclosureType}`.trim()
      : '';

    const episodeCode = extractEpisodeCode(title);
    const coverImage = deriveCoverImage(title, author);
    const redirectFrom = episodeCode ? `/${episodeCode}` : '';
    const slug = slugify(title);
    const filename = `${date}-${slug}.md`;

    const yearDir = path.join(POSTS_DIR, year);
    if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir, { recursive: true });

    const filepath = path.join(yearDir, filename);
    if (fs.existsSync(filepath)) {
      console.log(`Skipping (file exists): ${filename}`);
      continue;
    }

    const content = buildFrontmatter({
      title,
      date,
      author,
      enclosure,
      coverImage,
      redirectFrom,
      episode,
      season,
      explicit,
      duration,
      description,
    });

    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Created: src/posts/${year}/${filename}`);
    created++;
  }

  if (created === 0) {
    console.log('No new episodes found.');
  } else {
    console.log(`Done. Created ${created} new post(s).`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
