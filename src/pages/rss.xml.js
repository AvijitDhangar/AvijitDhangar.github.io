import { getGarden } from '../lib/garden.mjs';
import { site } from '../data/site.mjs';
const x = (s) => String(s || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
export function GET() {
  const g = getGarden();
  const items = g.recent.slice(0, 30).map((n) => `<item><title>${x(n.title)}</title><link>${x(site.url.replace(/\/$/, '') + n.url)}</link><description>${x(n.description)}</description>${n.date ? `<pubDate>${new Date(n.date).toUTCString()}</pubDate>` : ''}</item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${x(site.name)}</title><link>${x(site.url)}</link><description>${x(site.tagline)}</description>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml' } });
}
