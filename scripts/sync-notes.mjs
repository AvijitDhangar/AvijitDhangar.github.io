// Pulls published notes (dg-publish: true) and images from the Obsidian garden repo.
//   BLOG_REPO        owner/name of the notes repo        (default AvijitDhangar/blog)
//   BLOG_BRANCH      branch                              (default main)
//   BLOG_TOKEN       read-only token, only if the repo is private
//   BLOG_LOCAL_PATH  use an existing local clone instead of cloning
//   SKIP_SYNC=1      do nothing (keep whatever is in content/garden)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseFrontmatter } from './frontmatter.mjs';

if (process.env.SKIP_SYNC) { console.log('[sync] SKIP_SYNC set, leaving content untouched'); process.exit(0); }

const ROOT = process.cwd();
const REPO = process.env.BLOG_REPO || 'AvijitDhangar/blog';
const BRANCH = process.env.BLOG_BRANCH || 'main';
const TOKEN = process.env.BLOG_TOKEN || '';
const OUT_NOTES = path.join(ROOT, 'content/garden');
const OUT_IMG = path.join(ROOT, 'public/garden-img');
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const TEMPLATE_ASSETS = /^(tree-\d+\.svg|outgoing\.svg|default-note-icon\.svg|fonts\/)/;

let src = process.env.BLOG_LOCAL_PATH;
if (!src) {
  src = path.join(ROOT, '.cache/blog');
  fs.rmSync(src, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(src), { recursive: true });
  const url = TOKEN
    ? `https://x-access-token:${TOKEN}@github.com/${REPO}.git`
    : `https://github.com/${REPO}.git`;
  console.log(`[sync] cloning ${REPO}@${BRANCH}${TOKEN ? ' (with token)' : ''}`);
  try {
    execFileSync('git', ['clone', '--quiet', '--no-tags', '--branch', BRANCH, url, src], { stdio: ['ignore', 'inherit', 'inherit'] });
  } catch {
    console.error(`[sync] could not clone ${REPO}. If it is private, set BLOG_TOKEN (read-only).`);
    process.exit(1);
  }
}

const notesRoot = path.join(src, 'src/site/notes');
const imgRoot = path.join(src, 'src/site/img');
if (!fs.existsSync(notesRoot)) { console.error(`[sync] ${notesRoot} not found`); process.exit(1); }

fs.rmSync(OUT_NOTES, { recursive: true, force: true });
fs.rmSync(OUT_IMG, { recursive: true, force: true });
fs.mkdirSync(OUT_NOTES, { recursive: true });
fs.mkdirSync(OUT_IMG, { recursive: true });

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const gitDate = (file, args) => {
  try {
    const out = execFileSync('git', ['-C', src, 'log', '--format=%aI', ...args, '--', path.relative(src, file)], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return out;
  } catch { return []; }
};

const meta = {};
let published = 0, skipped = 0;
for (const file of walk(notesRoot)) {
  const rel = path.relative(notesRoot, file).split(path.sep).join('/');
  if (IMG_EXT.test(file)) { // attachments stored next to notes
    fs.mkdirSync(path.dirname(path.join(OUT_IMG, rel)), { recursive: true });
    fs.copyFileSync(file, path.join(OUT_IMG, rel));
    continue;
  }
  if (!rel.endsWith('.md') || /(^|\/)notes\.(json|11tydata)/.test(rel)) continue;
  const { data } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  if (data['dg-publish'] !== true && data['dg-publish'] !== 'true') { skipped++; continue; }
  const dest = path.join(OUT_NOTES, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  const dates = gitDate(file, []);
  meta[rel] = { updated: dates[0] || null, added: dates[dates.length - 1] || null };
  published++;
}
fs.writeFileSync(path.join(OUT_NOTES, '_meta.json'), JSON.stringify(meta, null, 2));

let images = 0;
if (fs.existsSync(imgRoot)) {
  for (const file of walk(imgRoot)) {
    const rel = path.relative(imgRoot, file).split(path.sep).join('/');
    if (TEMPLATE_ASSETS.test(rel) || !IMG_EXT.test(rel)) continue;
    const dest = path.join(OUT_IMG, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
    images++;
  }
}
console.log(`[sync] ${published} published notes, ${skipped} skipped (no dg-publish), ${images} images`);
