const $ = (s, r = document) => r.querySelector(s);

// theme + menu
$('#theme')?.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  document.documentElement.dataset.themeTransition = next === 'dark' ? 'to-dark' : 'to-light';
  document.documentElement.style.backgroundColor = next === 'dark' ? '#071013' : '#f1f8f3';
  try { localStorage.setItem('theme', next); } catch {}
});
const menu = $('#menu'), nav = $('#nav');
menu?.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });

// search (Ctrl/Cmd+K)
const dlg = $('#search');
if (dlg) {
  const input = $('input', dlg), list = $('ul', dlg);
  let index = null, sel = 0, hits = [];
  const load = async () => { if (index) return; try { index = await (await fetch(dlg.dataset.index)).json(); } catch { index = []; } };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const render = () => {
    const q = input.value.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    hits = !tokens.length ? (index || []).slice(0, 8).map((e) => ({ e, snip: e.description })) :
      (index || []).map((e) => {
        const t = e.title.toLowerCase(), tp = (e.topics || []).join(' ').toLowerCase(), body = (e.text || '').toLowerCase();
        let score = 0;
        for (const k of tokens) {
          const s = (t.includes(k) ? 5 : 0) + (tp.includes(k) ? 3 : 0) + (body.includes(k) ? 1 : 0);
          if (!s) return null; score += s;
        }
        const at = body.indexOf(tokens[0]);
        const snip = at > -1 && !t.includes(tokens[0]) ? '…' + e.text.slice(Math.max(0, at - 40), at + 90) + '…' : e.description;
        return { e, score, snip };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);
    sel = 0;
    list.innerHTML = hits.length ? hits.map((h, i) => `<li><a href="${h.e.url}" class="${i ? '' : 'sel'}">${esc(h.e.title)}<small>${esc(h.e.type)}${h.snip ? ' · ' + esc(h.snip.slice(0, 120)) : ''}</small></a></li>`).join('') : '<li class="none">Nothing found. Try a different word.</li>';
  };
  const open = async () => { dlg.showModal(); await load(); render(); input.select(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dlg.open) { dlg.close(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? dlg.close() : open(); }
  });
  document.querySelectorAll('[data-open-search]').forEach((b) => b.addEventListener('click', open));
  input.addEventListener('input', render);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  input.addEventListener('keydown', (e) => {
    const links = [...list.querySelectorAll('a')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!links.length) return;
      links[sel]?.classList.remove('sel'); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links[sel].classList.add('sel'); links[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && links[sel]) { location.href = links[sel].href; }
  });
}

// hover previews for internal links
let tip, tipTimer;
document.addEventListener('mouseover', (e) => {
  const a = e.target.closest?.('a.wikilink[data-preview]');
  if (!a || !a.dataset.preview) return;
  clearTimeout(tipTimer);
  tip?.remove();
  tip = document.createElement('div'); tip.className = 'preview';
  tip.innerHTML = `<b></b><span></span>`; tip.firstChild.textContent = a.dataset.previewTitle; tip.lastChild.textContent = a.dataset.preview;
  document.body.append(tip);
  const r = a.getBoundingClientRect();
  tip.style.left = Math.min(window.scrollX + r.left, window.scrollX + innerWidth - tip.offsetWidth - 12) + 'px';
  tip.style.top = window.scrollY + r.bottom + 8 + 'px';
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest?.('a.wikilink')) {
    if (tip) {
      const cur = tip;
      cur.classList.add('out');
      tipTimer = setTimeout(() => { cur.remove(); if (tip === cur) tip = null; }, 150);
    }
  }
});

// code blocks: language badge + copy button
document.querySelectorAll('.prose pre').forEach((pre) => {
  const code = pre.querySelector('code'); if (!code) return;
  const lang = [...code.classList].find((c) => c.startsWith('language-'))?.slice(9);
  if (lang) { const l = document.createElement('span'); l.className = 'lang'; l.textContent = lang; pre.prepend(l); }
  const b = document.createElement('button'); b.className = 'copy'; b.type = 'button'; b.textContent = 'Copy';
  b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(code.innerText); b.textContent = 'Copied'; } catch { b.textContent = 'Press Ctrl+C'; } setTimeout(() => (b.textContent = 'Copy'), 1600); });
  pre.prepend(b);
});

// ambigram logo 180deg flip on click
let logoRotation = 0;
const brand = $('.brand');
const logoImg = $('.nav-ambigram-logo');
if (brand && logoImg) {
  brand.addEventListener('click', (e) => {
    logoRotation += 180;
    logoImg.style.setProperty('--logo-rot', `${logoRotation}deg`);

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const targetPath = (new URL(brand.href, window.location.origin)).pathname.replace(/\/$/, '') || '/';

    if (currentPath === targetPath) {
      e.preventDefault();
    } else {
      e.preventDefault();
      setTimeout(() => {
        window.location.href = brand.href;
      }, 450);
    }
  });
}

const footLogo = $('.ambigram-logo');
if (footLogo) {
  let footRot = 0;
  footLogo.addEventListener('click', () => {
    footRot += 180;
    footLogo.style.setProperty('--logo-rot', `${footRot}deg`);
  });
}

// Reading progress tracker (floating circular pill)
const content = $('.prose');
const pill = $('#reading-pill');
const ring = $('#ring-fill');
const pillText = $('#reading-pill-text');

if (content && pill) {
  const updateProgress = () => {
    const rect = content.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const contentTop = rect.top + window.scrollY;
    const contentHeight = rect.height;

    const start = contentTop - 70;
    const end = contentTop + contentHeight - windowHeight;
    const current = window.scrollY;

    let progress = 0;
    if (end > start) {
      if (current <= start) {
        progress = 0;
      } else if (current >= end) {
        progress = 100;
      } else {
        progress = Math.min(100, Math.max(0, Math.round(((current - start) / (end - start)) * 100)));
      }
    } else {
      progress = current > start ? 100 : 0;
    }

    if (ring && pillText) {
      ring.style.strokeDashoffset = `${100 - progress}`;
      pillText.textContent = `${progress}%`;
    }

    if (current > start + 60) {
      pill.classList.add('visible');
    } else {
      pill.classList.remove('visible');
    }
  };

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  pill.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
