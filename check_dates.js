const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

function getFiles(dir) {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files = dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });
  return Array.prototype.concat(...files);
}

const postsDir = path.join(process.cwd(), 'src/posts');
const files = getFiles(postsDir).filter(f => f.endsWith('.md'));

console.log(`Checking ${files.length} files...`);

let errors = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  try {
    const parsed = matter(content);
    const date = parsed.data.date;
    if (date) {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            console.error(`Invalid date in ${file}: ${date}`);
            errors++;
        }
    }
  } catch (e) {
    console.error(`Error parsing ${file}: ${e.message}`);
    errors++;
  }
});

if (errors === 0) {
    console.log("All dates valid.");
} else {
    console.log(`Found ${errors} errors.`);
    process.exit(1);
}
