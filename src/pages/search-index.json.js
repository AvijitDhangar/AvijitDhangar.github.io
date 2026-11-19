import { getGarden } from '../lib/garden.mjs';
import { projects } from '../data/projects.mjs';
import { withBase } from '../lib/url.mjs';
export function GET() {
  const g = getGarden();
  const out = [
    ...g.notes.filter((n) => n.status !== 'archived' && n.kind !== 'interest' && !n.isIndex).map((n) => ({ title: n.title, url: n.url, type: (n.kind === 'rabbithole' || n.kind === 'exploration') ? 'rabbit hole' : n.type, topics: n.topics, description: n.excerpt, text: n.text })),
    ...g.topics.filter((t) => t.slug !== 'other').map((t) => ({ title: t.name, url: withBase(`curiosities/${t.slug}/`), type: 'topic', topics: [], description: '', text: '' })),
    ...projects.map((p) => ({ title: p.title, url: withBase('workshop/'), type: 'project', topics: p.topics || [], description: p.description, text: (p.tech || []).join(' ') })),
  ];
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}
