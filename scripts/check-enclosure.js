#!/usr/bin/env node
// Usage: node scripts/check-enclosure.js <mp3-url>
// Prints the file size (bytes) and duration, and a ready-to-paste
// `enclosure:` front matter line: "<url> <bytes> audio/mpeg"

const https = require('https');
const http = require('http');
const { spawnSync } = require('child_process');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/check-enclosure.js <mp3-url>');
  process.exit(1);
}

function headSize(target) {
  return new Promise((resolve, reject) => {
    const lib = target.startsWith('https') ? https : http;
    const req = lib.request(target, { method: 'HEAD' }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        resolve(headSize(res.headers.location));
        return;
      }
      const len = res.headers['content-length'];
      if (!len) {
        reject(new Error(`No content-length header (status ${res.statusCode})`));
        return;
      }
      resolve(parseInt(len, 10));
    });
    req.on('error', reject);
    req.end();
  });
}

function ffprobeDuration(target) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    target,
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr.trim()}`);
  }
  return parseFloat(result.stdout.trim());
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

(async () => {
  try {
    const [bytes, duration] = await Promise.all([
      headSize(url),
      Promise.resolve().then(() => ffprobeDuration(url)),
    ]);

    console.log(`Size:     ${bytes} bytes (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`Duration: ${formatDuration(duration)}`);
    console.log('');
    console.log('enclosure front matter:');
    console.log(`enclosure: "${url} ${bytes} audio/mpeg"`);
  } catch (err) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
})();
