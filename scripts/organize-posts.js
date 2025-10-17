const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const postsDir = path.join(__dirname, '..', 'src', 'posts');
const isPost = (name) => /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(name);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const entries = fs.readdirSync(postsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name).filter(isPost);

  if (files.length === 0) {
    console.log('No top-level dated posts found to move.');
    return;
  }

  const years = Array.from(new Set(files.map((n) => n.slice(0, 4))));
  years.forEach((y) => ensureDir(path.join(postsDir, y)));

  let moved = 0;
  for (const filename of files) {
    const year = filename.slice(0, 4);
    const src = path.join(postsDir, filename);
    const dst = path.join(postsDir, year, filename);

    if (fs.existsSync(dst)) {
      // Already moved
      continue;
    }

    const result = spawnSync('git', ['mv', src, dst], { stdio: 'inherit' });
    if (result.status !== 0) {
      console.error(`Failed to move ${src} -> ${dst}`);
      process.exit(result.status || 1);
    }
    moved += 1;
  }

  console.log(`Moved ${moved} post(s).`);
}

main();


