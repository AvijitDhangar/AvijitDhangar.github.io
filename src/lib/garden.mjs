// Reads synced notes, understands Obsidian syntax, and builds the site's content graph.
import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';
import { parseFrontmatter } from '../../scripts/frontmatter.mjs';
import { withBase } from './url.mjs';
import { projects, experiments } from '../data/projects.mjs';

const ROOT = process.cwd();
const NOTES_DIR = path.join(ROOT, 'content/garden');
const IMG_DIR = path.join(ROOT, 'public/garden-img');
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const WRITING = ['essay', 'article', 'note', 'reflection', 'guide', 'review', 'story', 'resource', 'resources'];
const HUE_PALETTE = ['#1f9d6a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#d946ef', '#f97316'];
function getHue(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return HUE_PALETTE[Math.abs(hash) % HUE_PALETTE.length];
}

export const slugify = (s) =>
  String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’'`]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

const walk = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const asArray = (v) => v == null || v === '' ? [] : Array.isArray(v) ? v.filter((x) => x != null).map(String)
  : String(v).split(',').map((s) => s.trim()).filter(Boolean);

const asBool = (v) => v === true || v === 'true';

// \( \) and \[ \] -> $ and $$ for remark-math; strip %% comments %%
function preprocess(src) {
  return src.split(/(```[\s\S]*?```)/g).map((part, i) => i % 2 ? part : part
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\((.+?)\\\)/g, (_, m) => `$${m}$`)).join('');
}

const CALLOUT_CLASS = {
  quote: 'quote', cite: 'quote', warning: 'warn', caution: 'warn', danger: 'warn', error: 'warn', bug: 'warn', failure: 'warn',
  tip: 'tip', hint: 'tip', success: 'tip', check: 'tip', done: 'tip',
  important: 'important', example: 'important',
};

function trimWords(s, n) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

// Parses dates from frontmatter props, tags (e.g. date/2026-11-17, #2026-11-17, 2026-11-17), or inline body hashtags
function parseDateTag(props, tags, body, fallback) {
  // 1. Direct frontmatter props
  const direct = props.created || props.date || props.dateTag || props['date-tag'] || props.timestamp;
  if (direct) {
    const s = String(direct).trim();
    const m = s.match(/\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/);
    if (m) {
      const parts = m[1].replace(/[/.]/g, '-').split('-');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }

  // 2. From frontmatter tags (e.g. "date/2026-11-17", "created/2026-11-17", "2026-11-17", "date-2026-11-17")
  for (const t of tags) {
    const s = String(t).trim();
    const m = s.match(/(?:date[/-]|created[/-]|^)(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
    if (m) {
      const parts = m[1].replace(/[/.]/g, '-').split('-');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }

  // 3. From inline body hashtag date tags: #date/2026-11-17, #created/2026-11-17, #2026-11-17, #date-2026-11-17
  if (body) {
    const m = body.match(/#(?:date[/-]|created[/-]|date:)?(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/i);
    if (m) {
      const parts = m[1].replace(/[/.]/g, '-').split('-');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }

  // 4. Git metadata fallback
  if (fallback) return String(fallback).slice(0, 10);
  return null;
}

let cache;
export function getGarden() {
  if (!cache) cache = build();
  return cache;
}

function build() {
  const warnings = [];
  const meta = fs.existsSync(path.join(NOTES_DIR, '_meta.json'))
    ? JSON.parse(fs.readFileSync(path.join(NOTES_DIR, '_meta.json'), 'utf8')) : {};
  const images = new Map(); // lowercased basename -> web path
  for (const f of walk(IMG_DIR)) {
    const rel = path.relative(IMG_DIR, f).split(path.sep).join('/');
    images.set(path.basename(rel).toLowerCase(), withBase('garden-img/' + rel.split('/').map(encodeURIComponent).join('/')));
  }

  // ---- Phase 1: read metadata -------------------------------------------------
  let notes = [];
  for (const file of walk(NOTES_DIR)) {
    if (!file.endsWith('.md')) continue;
    const id = path.relative(NOTES_DIR, file).split(path.sep).join('/').replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!asBool(data['dg-publish'])) continue; // belt and braces; sync already filters
    const props = { ...(data['dg-note-properties'] || {}) };
    for (const [k, v] of Object.entries(data)) if (!k.startsWith('dg-') && k !== 'permalink' && !(k in props)) props[k] = v;
    for (const k of Object.keys(props)) if (props[k] === null) delete props[k];

    const title = path.basename(id);
    const parts = id.split('/');
    const parent = parts.length > 1 ? parts[parts.length - 2] : '';
    const tags = asArray(data.tags).concat(asArray(props.tags));
    const inStory = /(^|\/)story(\/|$)/i.test(id);
    const inCuriosity = /(^|\/)curiosit(y|ies)(\/|$)/i.test(id);
    const inGuides = /(^|\/)guides?(\/|$)/i.test(id);
    const inResources = /(^|\/)resources?(\/|$)/i.test(id);

    let type = String(props.type || '').toLowerCase();
    if (type === 'interest' || type === 'topic' || type === 'curiosity') type = 'topic';
    if (!type) {
      if (inStory) type = 'story';
      else if (inCuriosity) type = 'topic';
      else if (inGuides) type = 'guide';
      else if (inResources) type = 'resource';
      else if (/(^|\/)articles?(\/|$)/i.test(id)) type = 'article';
      else type = 'note';
    }

    let series = props.series ? String(props.series) : '';
    if (!series && inStory && parent && !/^story$/i.test(parent) && !/^blog$/i.test(parent)) series = parent;

    let order = Number(props.order);
    if (!Number.isFinite(order)) {
      const m = title.match(/chapter\s*(\d+)/i);
      order = m ? Number(m[1]) : /blurb/i.test(title) ? 0 : 999;
    }

    const m = meta[id + '.md'] || {};
    const date = parseDateTag(props, tags, body, m.added);

    const noteTopics = asArray(props.topics ?? props.topic ?? (type === 'topic' ? title : null));

    notes.push({
      id, title, body, props, tags, type, series, order,
      topics: noteTopics,
      status: String(props.status || '').toLowerCase(),
      featured: asBool(props.featured),
      description: props.description ? String(props.description) : '',
      date: date,
      dateTag: date,
      updated: m.updated ? m.updated.slice(0, 10) : null,
      customSlug: data['dg-permalink'] || props['dg-permalink'] || '',
      isIndex: /^index$/i.test(title),
      isEntry: tags.includes('gardenEntry'),
    });
  }
  notes = notes.filter((n) => !n.isEntry);

  // ---- slugs and URLs -----------------------------------------------------------
  const used = new Set();
  for (const n of notes) {
    const isTopic = n.type === 'topic' || n.type === 'interest';
    let base = slugify(n.customSlug ? String(n.customSlug).split('/').filter(Boolean).pop() : (isTopic ? (n.topics[0] || n.title) : n.title));
    if (!base) base = 'note';
    const scope = isTopic ? 'i:' : n.type === 'exploration' ? 'e:' : 'w:';
    let slug = base, k = 2;
    if (n.series && !isTopic && n.type !== 'exploration') slug = `${slugify(n.series)}/${base}`;
    while (used.has(scope + slug)) slug = `${base}-${k++}`;
    used.add(scope + slug);
    n.slug = slug;
    n.kind = isTopic ? 'topic' : n.type === 'exploration' ? 'exploration' : 'writing';
  }

  // ---- topics ---------------------------------------------------------------------
  const canonMap = new Map();
  for (const n of notes) {
    for (const t of n.topics) {
      const s = slugify(t);
      if (!canonMap.has(s)) canonMap.set(s, String(t).trim());
    }
  }
  const canon = (t) => canonMap.get(slugify(t)) || String(t).trim();
  for (const n of notes) {
    n.topics = [...new Set(n.topics.map(canon))];
    if (n.kind === 'exploration' && !n.topics.length) n.topics = ['Other'];
    n.topicSlugs = n.topics.map(slugify);
    n.url = n.kind === 'topic' ? withBase(`curiosities/${slugify(n.topics[0] || n.title)}/`)
      : n.kind === 'exploration' ? withBase(`curiosities/${n.topicSlugs[0] || 'misc'}/${n.slug}/`)
      : withBase(`library/${n.slug}/`);
  }

  // ---- link resolver -------------------------------------------------------------
  const byPath = new Map(notes.map((n) => [n.id.toLowerCase(), n]));
  const byBase = new Map();
  for (const n of notes) { const k = n.title.toLowerCase(); byBase.set(k, [...(byBase.get(k) || []), n]); }
  const resolve = (name, from) => {
    const key = name.trim().replace(/\.md$/i, '').toLowerCase();
    if (byPath.has(key)) return byPath.get(key);
    const cands = byBase.get(path.basename(key)) || [];
    if (cands.length <= 1) return cands[0];
    const dir = path.dirname(from.id);
    return cands.find((c) => path.dirname(c.id) === dir) || cands[0];
  };
  const findImage = (name) => images.get(path.basename(name).toLowerCase());

  // ---- Phase 2: render ------------------------------------------------------------
  const backlinks = new Map(notes.map((n) => [n.id, new Map()]));
  function obsidian(note, state) {
    return () => (tree) => {
      // callouts
      visit(tree, 'blockquote', (bq) => {
        const first = bq.children[0];
        if (!first || first.type !== 'paragraph') return;
        const t = first.children[0];
        const m = t && t.type === 'text' && t.value.match(/^\[!([\w-]+)\][+-]?[ \t]*(.*)$/);
        if (!m) return;
        const type = m[1].toLowerCase();
        const title = m[2].trim() || type.charAt(0).toUpperCase() + type.slice(1);
        first.children.shift();
        if (first.children[0]?.type === 'break') first.children.shift();
        if (!first.children.length) bq.children.shift();
        bq.children.unshift({ type: 'paragraph', data: { hName: 'div', hProperties: { className: ['callout-title'] } }, children: [{ type: 'text', value: title }] });
        bq.data = { hName: 'div', hProperties: { className: ['callout', `callout-${CALLOUT_CLASS[type] || 'info'}`], 'data-callout': type } };
      });
      // wikilinks and embeds
      visit(tree, 'text', (node, index, parent) => {
        if (!parent || parent.type === 'link' || !node.value.includes('[[')) return;
        const re = /(!?)\[\[([^\]]+?)\]\]/g;
        const out = []; let last = 0, m;
        while ((m = re.exec(node.value))) {
          if (m.index > last) out.push({ type: 'text', value: node.value.slice(last, m.index) });
          last = m.index + m[0].length;
          const [targetPart, ...aliasParts] = m[2].split('|');
          const alias = aliasParts.join('|').trim();
          const [name, heading] = targetPart.split('#');
          if (m[1] && IMG_EXT.test(name.trim())) {
            const src = findImage(name.trim());
            const width = /^\d+$/.test(alias) ? Number(alias) : undefined;
            if (src) out.push({ type: 'image', url: src, alt: alias && !width ? alias : path.basename(name.trim()), data: { hProperties: { loading: 'lazy', ...(width ? { width } : {}) } } });
            else { state.missingImages.push(name.trim()); out.push({ type: 'emphasis', data: { hName: 'span', hProperties: { className: ['missing-image'] } }, children: [{ type: 'text', value: `image not available: ${path.basename(name.trim())}` }] }); }
            continue;
          }
          const target = name.trim() ? resolve(name, note) : note;
          const display = alias || (heading ? `${name.trim() || note.title} › ${heading}` : path.basename(name.trim()));
          if (target) {
            state.links.add(target.id);
            if (target.id !== note.id) backlinks.get(target.id).set(note.id, note);
            const hash = heading ? '#' + slugify(heading) : '';
            out.push({ type: 'link', url: target.url + hash, children: [{ type: 'text', value: display }],
              data: { hProperties: { className: ['wikilink'], 'data-preview-title': target.title, 'data-preview': target.excerptPending ? '' : (target.description || '') } } });
          } else {
            warnings.push(`Unpublished or missing link [[${name.trim()}]] in "${note.id}"`);
            out.push({ type: 'emphasis', data: { hName: 'span', hProperties: { className: ['uninitialized'], title: 'Not written yet' } }, children: [{ type: 'text', value: display }] });
          }
        }
        if (!out.length) return;
        if (last < node.value.length) out.push({ type: 'text', value: node.value.slice(last) });
        parent.children.splice(index, 1, ...out);
        return index + out.length;
      });
      // standard markdown images: ![alt](image.png)
      visit(tree, 'image', (img) => {
        if (img.url && !img.url.startsWith('http://') && !img.url.startsWith('https://') && !img.url.startsWith('/') && !img.url.startsWith('data:')) {
          const resolved = findImage(img.url);
          if (resolved) img.url = resolved;
        }
      });
      // headings, excerpt, plain text
      const slugger = new GithubSlugger();
      state.headings = [];
      visit(tree, 'heading', (h) => {
        const text = toString(h);
        const id = slugger.slug(text);
        if (h.depth >= 2 && h.depth <= 3) state.headings.push({ depth: h.depth, text, id });
        if (!state.firstHeading) state.firstHeading = text;
      });
      for (const c of tree.children) {
        if (c.type !== 'paragraph') continue;
        const meaningful = c.children.filter((x) => !(x.type === 'text' && !x.value.trim()));
        if (!meaningful.length || meaningful.every((x) => x.type === 'link' || x.type === 'break')) continue;
        const text = toString(c).trim();
        if (text.length > 30) { state.excerpt = trimWords(text, 190); break; }
      }
      state.text = toString(tree).replace(/\s+/g, ' ').slice(0, 8000);
      state.words = toString(tree).split(/\s+/).filter(Boolean).length;
    };
  }

  const render = (note) => {
    const state = { links: new Set(), missingImages: [], headings: [], excerpt: '', text: '', words: 0, firstHeading: '' };
    const file = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkBreaks).use(obsidian(note, state))
      .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeSlug).use(rehypeKatex)
      .use(rehypeHighlight, { detect: false, ignoreMissing: true }).use(rehypeStringify)
      .processSync(preprocess(note.body));
    note.html = String(file);
    note.headings = state.headings;
    note.excerpt = note.description || state.excerpt;
    note.text = state.text;
    note.readingMinutes = Math.max(1, Math.round(state.words / 220));
    note.subtitle = /^\s*#{1,3}\s/.test(note.body) ? state.firstHeading : '';
    note.linksOut = [...state.links];
    state.missingImages.forEach((m) => warnings.push(`Missing image "${m}" in "${note.id}"`));
  };
  // two passes so hover previews know every target's excerpt
  notes.forEach(render);
  notes.forEach((n) => { n.description = n.description || n.excerpt; });
  notes.forEach(render);
  for (const n of notes) n.backlinks = [...backlinks.get(n.id).values()];

  // ---- groupings --------------------------------------------------------------------
  const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title);
  const listed = (n) => !n.isIndex && n.status !== 'archived' && n.kind !== 'topic';
  const writing = notes.filter((n) => n.kind === 'writing' && listed(n));
  const seriesMap = new Map();
  for (const n of notes.filter((x) => x.series && x.kind === 'writing')) {
    const s = seriesMap.get(n.series) || { title: n.series, slug: slugify(n.series), notes: [], index: null };
    n.isIndex ? (s.index = n) : s.notes.push(n);
    seriesMap.set(n.series, s);
  }
  const series = [...seriesMap.values()].map((s) => ({ ...s, notes: s.notes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)) }));
  for (const s of series) {
    const chapters = s.notes.filter((n) => !/blurb/i.test(n.title));
    const formatNote = (note) => {
      if (!note) return null;
      const chNum = chapters.indexOf(note) + 1;
      return {
        id: note.id,
        slug: note.slug,
        title: note.title,
        subtitle: note.subtitle || note.title,
        url: note.url,
        readingMinutes: note.readingMinutes,
        date: note.date,
        chapterNumber: chNum > 0 ? chNum : null,
        isBlurb: /blurb/i.test(note.title)
      };
    };

    s.notes.forEach((n, i) => {
      const currentChNum = chapters.indexOf(n) + 1;
      n.seriesInfo = {
        title: s.title,
        slug: s.slug,
        prev: formatNote(s.notes[i - 1]),
        next: formatNote(s.notes[i + 1]),
        position: currentChNum > 0 ? currentChNum : null,
        total: chapters.length,
        cover: s.slug === 'triggered-lives' ? withBase('covers/triggered-lives.png') : null,
        chapters: s.notes.map((ch) => ({
          ...formatNote(ch),
          isCurrent: ch.id === n.id,
        }))
      };
    });
  }
  // library list shows each series once (as a single entry) plus standalone writing
  const seriesEntry = (s) => ({ kind: 'series', title: s.title, slug: s.slug, url: withBase(`series/${s.slug}/`), type: 'story', count: s.notes.length,
    cover: s.slug === 'triggered-lives' ? withBase('covers/triggered-lives.png') : null,
    description: (s.notes.find((n) => /blurb/i.test(n.title)) || s.notes[0])?.excerpt || '', date: s.notes.map((n) => n.date).filter(Boolean).sort().pop() || null,
    topics: [...new Set(s.notes.flatMap((n) => n.topics))], featured: s.notes.some((n) => n.featured), readingMinutes: s.notes.reduce((a, n) => a + n.readingMinutes, 0) });
  const libraryItems = [...writing.filter((n) => !n.series), ...series.map(seriesEntry)].sort(byDateDesc);

  const explorations = notes.filter((n) => n.kind === 'exploration' && listed(n));
  const topicNotes = notes.filter((n) => n.kind === 'topic');

  const topicMap = new Map();
  const ensure = (name, extra = {}) => {
    const s = slugify(name);
    if (!topicMap.has(s)) topicMap.set(s, { slug: s, name: canon(name), hue: getHue(name), note: null, ...extra });
    return topicMap.get(s);
  };
  for (const n of notes) n.topics.forEach((t) => ensure(t));
  for (const n of topicNotes) {
    const name = n.props.topic || n.title;
    if (name) ensure(name);
  }
  for (const t of topicMap.values()) {
    t.note = topicNotes.find((n) => n.topicSlugs.includes(t.slug) || slugify(n.title) === t.slug) || null;
    if (t.note) {
      if (t.note.props.hue) t.hue = t.note.props.hue;
      if (t.note.props.topic || t.note.title) t.name = t.note.props.topic || t.note.title;
    }
    t.explorations = explorations.filter((n) => n.topicSlugs.includes(t.slug));
    t.current = t.explorations.filter((n) => n.status !== 'past');
    t.past = t.explorations.filter((n) => n.status === 'past');
    t.guides = libraryItems.filter((n) => (n.type === 'guide' || n.type === 'guides') && n.topics.map(slugify).includes(t.slug));
    t.resources = libraryItems.filter((n) => (n.type === 'resource' || n.type === 'resources') && n.topics.map(slugify).includes(t.slug));
    t.articles = libraryItems.filter((n) => (n.type === 'article' || n.type === 'essay' || n.type === 'story') && n.topics.map(slugify).includes(t.slug));
    t.notes = libraryItems.filter((n) => (n.type === 'note' || n.type === 'reflection' || n.type === 'review') && n.topics.map(slugify).includes(t.slug));
    t.writing = libraryItems.filter((n) => n.topics.map(slugify).includes(t.slug));
    t.projects = projects.filter((p) => (p.topics || []).map(slugify).includes(t.slug));
    t.experiments = experiments.filter((p) => (p.topics || []).map(slugify).includes(t.slug));
  }
  // Only topics with actual published content will have pages and cards
  const topics = [...topicMap.values()].filter((t) => t.slug !== 'other' && (t.note || t.explorations.length || t.writing.length || t.projects.length || t.experiments.length));

  // photos dropped into public/gallery
  const galleryDir = path.join(ROOT, 'public/gallery');
  let captions = {};
  try { captions = JSON.parse(fs.readFileSync(path.join(galleryDir, 'captions.json'), 'utf8')); } catch {}
  const photos = walk(galleryDir).filter((f) => IMG_EXT.test(f)).sort().map((f) => {
    const name = path.basename(f);
    return { src: withBase('gallery/' + encodeURIComponent(name)), caption: captions[name] || name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') };
  });

  const current = explorations.filter((n) => n.status === 'current').sort((a, b) => Number(b.featured) - Number(a.featured) || byDateDesc(a, b))[0] || null;

  const recent = [
    ...libraryItems.map((n) => ({ ...n, label: n.type === 'story' ? 'Story' : n.type.charAt(0).toUpperCase() + n.type.slice(1), url: n.url })),
    ...explorations.map((n) => ({ ...n, label: 'Exploration' })),
  ].filter((n) => n.date).sort(byDateDesc);

  return { notes, libraryItems, series, explorations, topics, topicMap, photos, current, recent, projects, experiments, warnings: [...new Set(warnings)], byTypeCount: Object.fromEntries(WRITING.map((t) => [t, writing.filter((n) => n.type === t).length])) };
}
