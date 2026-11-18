// Parses the frontmatter of notes pushed by the Obsidian Digital Garden plugin.
// The plugin writes a JSON object between the --- lines; plain YAML works too.
import YAML from 'yaml';

export function parseFrontmatter(text) {
  const src = text.replace(/^\uFEFF/, '');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const raw = m[1].trim();
  let data = {};
  try {
    data = raw.startsWith('{') ? JSON.parse(raw) : YAML.parse(raw) || {};
  } catch {
    try { data = YAML.parse(raw) || {}; } catch { data = {}; }
  }
  return { data: data && typeof data === 'object' ? data : {}, body: src.slice(m[0].length) };
}
