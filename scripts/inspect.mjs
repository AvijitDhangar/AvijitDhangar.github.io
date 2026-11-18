import { getGarden } from '../src/lib/garden.mjs';
const g = getGarden();
console.log('NOTES', g.notes.length, '| library items', g.libraryItems.length, '| series', g.series.map((s) => `${s.title}(${s.notes.length})`).join(','));
for (const n of g.notes) console.log(`- ${n.type.padEnd(8)} ${n.url}  [${n.title}] ${n.date || '-'} ${n.readingMinutes}min links:${n.linksOut.length} back:${n.backlinks.length}`);
console.log('\nWARNINGS'); g.warnings.forEach((w) => console.log(' ', w));
const w = g.notes.find((n) => n.title === 'System of Goals'); console.log('\nEXCERPT:', w.excerpt); console.log('HEADINGS', w.headings.slice(0, 3));
const c = g.notes.find((n) => n.title === 'Chapter 1'); console.log('SUBTITLE', c.subtitle, '| series', JSON.stringify({ ...c.seriesInfo, prev: c.seriesInfo.prev?.title, next: c.seriesInfo.next?.title }));
console.log('HTML sample:', w.html.slice(0, 500));
