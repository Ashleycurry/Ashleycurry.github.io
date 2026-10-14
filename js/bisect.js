/* Bisect · 二分 —— https://github.com/LiuXiu233/hexo-theme-bisect
   每个功能都是渐进增强：脚本加载失败时，页面照样可读、可跳转。 */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const root = document.documentElement;
const CONFIG = (() => {
  try { return JSON.parse($('#bs-config').textContent); } catch (e) { return {}; }
})();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const T = Object.assign({
  copy: 'Copy', copied: 'Copied', failed: 'Copy failed',
  empty: 'Nothing found.', unavailable: 'Search index not found.',
  kindTitle: 'Title', kindTag: 'Tag', kindText: 'Text',
  cmdTheme: 'Toggle light and dark', cmdRandom: 'Read a random post', cmdTop: 'Back to top', cmdArchive: 'Open the archive'
}, CONFIG.i18n || {});

// 视图转场：不支持或被跳过时直接更新，不留未处理的 Promise
function transition(update) {
  if (!document.startViewTransition || reduced.matches) { update(); return; }
  const t = document.startViewTransition(update);
  t.ready.catch(() => {});
  t.finished.catch(() => {});
}

/* ---------- 深浅色：分界线扫过整屏 ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式 */ } }
};
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches;

function applyTheme(next) {
  root.dataset.theme = next;
  store.set('bs-theme', next);
  syncComments();
  renderMermaid(true);
}

$$('[data-theme-toggle]').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    transition(() => applyTheme(next));
  });
});
systemDark.addEventListener('change', () => { if (!root.dataset.theme) { syncComments(); renderMermaid(true); } });

/* ---------- 顶栏：下滑隐藏，上滑出现 ---------- */
const header = $('[data-header]');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  if (!header || root.classList.contains('menu-open')) return;
  header.classList.toggle('is-hidden', y > lastY && y > 240);
  lastY = y;
}, { passive: true });

/* ---------- 菜单 ---------- */
const menuBtn = $('[data-menu-toggle]');
function setMenu(open) {
  root.classList.toggle('menu-open', open);
  menuBtn && menuBtn.setAttribute('aria-expanded', String(open));
  if (open) header && header.classList.remove('is-hidden');
}
menuBtn && menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
$$('.bs-nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));

/* ---------- 回到顶部 ---------- */
$$('[data-to-top]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
}));

/* ---------- 首页：可以拖动的分界线 ---------- */
(function hero() {
  const el = $('[data-hero]');
  if (!el) return;
  const handle = $('.bs-hero__handle', el);
  const MIN = 40, MAX = 80;
  const initial = parseFloat(getComputedStyle(el).getPropertyValue('--split')) || 62;
  let base = initial, current = initial, target = initial, raf = 0, dragging = false;
  const desktop = matchMedia('(min-width: 900px)');

  const set = v => {
    current = v;
    root.style.setProperty('--split', v.toFixed(2) + '%');
    el.style.setProperty('--split', v.toFixed(2) + '%');
    handle.setAttribute('aria-valuenow', Math.round(v));
    handle.setAttribute('aria-valuetext', Math.round(v) + '%');
  };
  const tick = () => {
    const d = target - current;
    if (Math.abs(d) < .02) { set(target); raf = 0; return; }
    set(current + d * (dragging ? .5 : .12));
    raf = requestAnimationFrame(tick);
  };
  const go = v => {
    target = Math.min(MAX, Math.max(MIN, v));
    if (reduced.matches) { set(target); return; }
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const pct = x => (x - el.getBoundingClientRect().left) / el.clientWidth * 100;

  // 指针靠近时，线轻轻偏向指针
  el.addEventListener('pointermove', e => {
    if (dragging || !desktop.matches || e.pointerType !== 'mouse') return;
    const p = pct(e.clientX);
    go(base + Math.max(-3, Math.min(3, (p - base) * .08)));
  });
  el.addEventListener('pointerleave', () => { if (!dragging) go(base); });

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('is-dragging');
    root.classList.add('is-dragging-split');
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    base = Math.min(MAX, Math.max(MIN, pct(e.clientX)));
    go(base);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('is-dragging');
    root.classList.remove('is-dragging-split');
  };
  handle.addEventListener('pointerup', end);
  // 标题太长或太短时自动缩放，让它横跨分界线
  const title = $('[data-hero-title]', el);
  const fit = () => {
    if (!title) return;
    const ink = $('.bs-hero__t--ink', title);
    title.style.fontSize = '';
    if (!desktop.matches) return;
    const range = document.createRange();
    range.selectNodeContents(ink);
    const w = range.getBoundingClientRect().width, max = el.clientWidth;
    const size = parseFloat(getComputedStyle(title).fontSize);
    let ratio = 1;
    if (w > max * .94) ratio = (max * .9) / w;
    else if (w < max * .66) ratio = (max * .72) / w;
    if (ratio !== 1) title.style.fontSize = Math.max(40, Math.min(300, size * ratio)) + 'px';
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit);
  addEventListener('resize', fit);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('dblclick', () => { base = initial; go(base); });
  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') base -= step;
    else if (e.key === 'ArrowRight') base += step;
    else if (e.key === 'Home') base = MIN;
    else if (e.key === 'End') base = MAX;
    else return;
    e.preventDefault();
    base = Math.min(MAX, Math.max(MIN, base));
    go(base);
  });
})();

/* ---------- 首页：按分类筛选 ---------- */
(function filter() {
  const buttons = $$('[data-filter]');
  if (!buttons.length) return;
  const rows = $$('.bs-row');
  const years = $$('.bs-year');
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.filter;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    const run = () => {
      rows.forEach(r => { r.hidden = key !== '*' && !r.dataset.cats.split('|').includes(key); });
      years.forEach(y => { y.hidden = !$$('.bs-row', y).some(r => !r.hidden); });
    };
    transition(run);
  }));
})();

/* ---------- 缩略图：悬停时才加载原图 ---------- */
$$('.bs-row__link').forEach(link => {
  const load = () => {
    const img = link.querySelector('img[data-src]');
    if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
  };
  link.addEventListener('pointerenter', load, { once: true });
  link.addEventListener('focus', load, { once: true });
});

/* ---------- 文章页：进度线与目录高亮 ---------- */
(function reading() {
  const prose = $('[data-prose]');
  const fill = $('.bs-progress');
  if (!prose || !fill || !$('.bs-post')) return;
  const links = $$('.bs-rail .bs-toc-link');
  const heads = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = prose.getBoundingClientRect();
    const view = innerHeight;
    const p = Math.min(1, Math.max(0, (view * .35 - r.top) / (r.height - view * .5)));
    fill.style.setProperty('--p', p.toFixed(4));
    let active = -1;
    heads.forEach((h, i) => { if (h.getBoundingClientRect().top < view * .3) active = i; });
    links.forEach((a, i) => {
      a.classList.toggle('is-active', i === active);
      a.classList.toggle('is-read', i < active);
    });
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
})();

/* ---------- 正文增强：代码块、表格、图片 ---------- */
(function prose() {
  const box = $('[data-prose]');
  if (!box) return;

  $$('figure.highlight', box).forEach(fig => {
    const lang = (fig.className.match(/highlight\s+(\S+)/) || [])[1] || 'code';
    const bar = document.createElement('div');
    bar.className = 'bs-code__bar';
    const label = document.createElement('span');
    const caption = fig.querySelector('figcaption');
    if (caption) label.append(...caption.childNodes);
    else label.textContent = lang === 'plaintext' ? 'text' : lang;
    const copy = document.createElement('button');
    copy.className = 'bs-code__copy';
    copy.type = 'button';
    copy.textContent = T.copy;
    bar.append(label, copy);
    fig.prepend(bar);
    const btn = bar.querySelector('button');
    btn.addEventListener('click', async () => {
      const code = fig.querySelector('.code pre') || fig.querySelector('pre');
      const text = Array.from(code.querySelectorAll('.line')).map(l => l.textContent).join('\n') || code.textContent;
      try { await navigator.clipboard.writeText(text); btn.textContent = T.copied; }
      catch (e) { btn.textContent = T.failed; }
      setTimeout(() => { btn.textContent = T.copy; }, 1600);
    });
  });

  $$('table', box).forEach(t => {
    if (t.closest('figure.highlight') || t.parentElement.classList.contains('bs-table')) return;
    const wrap = document.createElement('div');
    wrap.className = 'bs-table';
    t.replaceWith(wrap);
    wrap.append(t);
  });

  let n = 0;
  const zoom = document.createElement('dialog');
  zoom.className = 'bs-zoom';
  zoom.innerHTML = '<img alt="">';
  zoom.addEventListener('click', () => zoom.close());
  document.body.append(zoom);
  $$('img', box).forEach(img => {
    if (img.closest('a')) return;
    const alt = (img.getAttribute('alt') || '').trim();
    if (alt && !/^image-\d+/.test(alt)) {
      n++;
      const next = img.parentElement.tagName === 'P' ? img.parentElement.nextElementSibling : null;
      const hasCaption = next && next.matches('p') && next.children.length === 1 && next.firstElementChild.tagName === 'SMALL';
      if (!hasCaption) {
        const cap = document.createElement('span');
        cap.className = 'bs-cap';
        cap.innerHTML = `<b>FIG.${String(n).padStart(2, '0')}</b>`;
        cap.append(document.createTextNode(alt));
        (img.parentElement.tagName === 'P' ? img.parentElement : img).after(cap);
      }
    }
    img.addEventListener('click', () => {
      const z = zoom.querySelector('img');
      z.src = img.currentSrc || img.src;
      z.alt = alt;
      zoom.showModal();
    });
  });
})();

/* ---------- 赞赏 ---------- */
$$('[data-reward-toggle]').forEach(btn => btn.addEventListener('click', () => {
  const box = document.getElementById(btn.getAttribute('aria-controls'));
  if (!box) return;
  box.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
  box.hidden = !box.hidden;
  btn.setAttribute('aria-expanded', String(!box.hidden));
}));

/* ---------- 评论：utterances 或 giscus，快看到时才加载 ---------- */
function syncComments() {
  const dark = isDark();
  const u = $('.utterances-frame');
  if (u) u.contentWindow.postMessage({ type: 'set-theme', theme: dark ? 'github-dark' : 'github-light' }, 'https://utteranc.es');
  const g = $('iframe.giscus-frame');
  if (g) g.contentWindow.postMessage({ giscus: { setConfig: { theme: dark ? 'dark' : 'light' } } }, 'https://giscus.app');
}
(function comments() {
  const box = $('[data-comments-box]');
  const cfg = CONFIG.comments;
  if (!box || !cfg || !cfg.options || !cfg.options.repo) return;
  const o = cfg.options;
  const load = () => {
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    const set = (k, v) => { if (v !== undefined && v !== null && v !== '') s.setAttribute(k, v); };
    if (cfg.provider === 'giscus') {
      s.src = 'https://giscus.app/client.js';
      set('data-repo', o.repo); set('data-repo-id', o.repo_id);
      set('data-category', o.category); set('data-category-id', o.category_id);
      set('data-mapping', o.mapping || 'pathname'); set('data-strict', o.strict ?? 0);
      set('data-reactions-enabled', o.reactions ?? 1); set('data-emit-metadata', 0);
      set('data-input-position', o.input_position || 'top');
      set('data-theme', isDark() ? 'dark' : 'light');
      set('data-lang', o.lang || (Array.isArray(CONFIG.lang) ? CONFIG.lang[0] : CONFIG.lang) || 'en');
      set('data-loading', 'lazy');
    } else {
      s.src = 'https://utteranc.es/client.js';
      set('repo', o.repo); set('issue-term', o.issue_term || 'pathname'); set('label', o.label);
      set('theme', isDark() ? 'github-dark' : 'github-light');
    }
    box.append(s);
  };
  if (!('IntersectionObserver' in window)) return load();
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); load(); }
  }, { rootMargin: '600px 0px' });
  io.observe(box);
})();

/* ---------- Chatra：页面空闲后再载入，默认不显示气泡 ---------- */
(function chat() {
  const cfg = CONFIG.chatra;
  if (!cfg || !cfg.enable || !cfg.id) return;
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    window.ChatraID = cfg.id;
    window.ChatraSetup = { startHidden: true };
    window.Chatra = window.Chatra || function () { (window.Chatra.q = window.Chatra.q || []).push(arguments); };
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://call.chatra.io/chatra.js';
    document.head.append(s);
  };
  $$('[data-chat-open]').forEach(btn => btn.addEventListener('click', () => {
    load();
    window.Chatra('show');
    window.Chatra('openChat', true);
  }));
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 2500));
  addEventListener('load', () => idle(load, { timeout: 5000 }));
})();

/* ---------- Mermaid：只在有图表的页面加载 ---------- */
let mermaidReady = null;
function renderMermaid(rerender) {
  const blocks = $$('pre > code.mermaid, .bs-mermaid');
  const cfg = CONFIG.mermaid;
  if (!blocks.length || !cfg || !cfg.enable) return;
  if (!mermaidReady) {
    mermaidReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = cfg.js;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
  }
  mermaidReady.then(() => {
    const graphs = $$('pre > code.mermaid').map(code => {
      const div = document.createElement('div');
      div.className = 'bs-mermaid mermaid';
      div.dataset.src = code.textContent;
      code.parentElement.replaceWith(div);
      return div;
    });
    const all = rerender ? $$('.bs-mermaid') : graphs;
    all.forEach(d => { d.removeAttribute('data-processed'); d.textContent = d.dataset.src; });
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: isDark()
        ? { primaryColor: '#1747e6', primaryTextColor: '#f4f9fd', primaryBorderColor: '#4fd1ff', lineColor: '#8fa8c4', background: '#14203a', mainBkg: '#1747e6', textColor: '#eaf6ff' }
        : { primaryColor: '#1747e6', primaryTextColor: '#f4f9fd', primaryBorderColor: '#0f172a', lineColor: '#0f172a', background: '#e8f1f9', mainBkg: '#1747e6', textColor: '#0f172a' }
    });
    window.mermaid.run({ nodes: all });
  }).catch(() => { /* 图表加载失败时保留源码 */ });
}
renderMermaid(false);

/* ---------- ⌘K 搜索与命令 ---------- */
(function search() {
  const dlg = $('#bs-search');
  if (!dlg || !dlg.showModal) return;
  const input = $('#bs-search-input');
  const list = $('#bs-search-list');
  let data = null, items = [], sel = 0, failed = false;

  const commands = [
    { k: 'theme', t: T.cmdTheme, run: () => $('[data-theme-toggle]').click() },
    { k: 'random', t: T.cmdRandom, run: async () => { await loadData(); const p = data[Math.floor(Math.random() * data.length)]; if (p) location.href = p.url; } },
    { k: 'top', t: T.cmdTop, run: () => scrollTo({ top: 0 }) },
    { k: 'archive', t: T.cmdArchive, run: () => { location.href = (CONFIG.root || '/') + 'archives/'; } }
  ];

  async function loadData() {
    if (data) return data;
    const res = await fetch(CONFIG.search);
    if (!res.ok) throw new Error('search index ' + res.status);
    const text = await res.text();
    const strip = html => { const d = document.createElement('template'); d.innerHTML = html || ''; return d.content.textContent.replace(/\s+/g, ' ').trim(); };
    if (/^\s*[\[{]/.test(text)) {
      const json = JSON.parse(text);
      data = (Array.isArray(json) ? json : json.posts || []).map(p => ({
        title: p.title || '', url: p.url || p.path || '#', content: strip(p.content || p.text || ''),
        tags: (p.tags || []).map(t => t.name || t), cats: (p.categories || []).map(c => c.name || c)
      }));
      return data;
    }
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    data = Array.from(xml.querySelectorAll('entry')).map(e => ({
      title: e.querySelector('title')?.textContent || '',
      url: e.querySelector('url')?.textContent || e.querySelector('link')?.getAttribute('href') || '#',
      content: strip(e.querySelector('content')?.textContent || ''),
      tags: Array.from(e.querySelectorAll('tags tag')).map(t => t.textContent),
      cats: Array.from(e.querySelectorAll('categories category')).map(t => t.textContent)
    }));
    return data;
  }

  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mark = (s, q) => {
    const i = s.toLowerCase().indexOf(q);
    return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
  };

  function paint() {
    list.innerHTML = items.length
      ? items.map((it, i) => `<li class="bs-search__item" role="option" aria-selected="${i === sel}"><a href="${esc(it.url)}">${it.html}</a></li>`).join('')
      : '';
    if (!items.length && input.value.trim()) list.innerHTML = `<li class="bs-search__empty">${esc(failed ? T.unavailable : T.empty)}</li>`;
    const cur = list.children[sel];
    cur && cur.scrollIntoView({ block: 'nearest' });
  }

  async function query() {
    const raw = input.value.trim();
    sel = 0;
    if (raw.startsWith('>')) {
      const q = raw.slice(1).trim().toLowerCase();
      items = commands.filter(c => c.k.startsWith(q) || c.t.includes(q)).map(c => ({
        url: '#', cmd: c,
        html: `<span class="bs-search__item-k">&gt; ${c.k}</span><span class="bs-search__item-t">${c.t}</span>`
      }));
      return paint();
    }
    if (!raw) { items = []; return paint(); }
    try { await loadData(); failed = false; } catch (e) { failed = true; items = []; return paint(); }
    const q = raw.toLowerCase();
    items = data.map(p => {
      const inTitle = p.title.toLowerCase().includes(q);
      const tag = p.tags.concat(p.cats).find(t => t.toLowerCase().includes(q));
      const ci = p.content.toLowerCase().indexOf(q);
      if (!inTitle && !tag && ci < 0) return null;
      const score = (inTitle ? 100 : 0) + (tag ? 30 : 0) + (ci >= 0 ? 10 : 0);
      const snippet = ci >= 0 ? (ci > 30 ? '…' : '') + p.content.slice(Math.max(0, ci - 30), ci + 80) : p.content.slice(0, 90);
      const kind = inTitle ? T.kindTitle : tag ? T.kindTag + ' · ' + tag : T.kindText;
      return {
        url: p.url, score,
        html: `<span class="bs-search__item-k">${esc(kind)}</span><span class="bs-search__item-t">${mark(p.title, q)}</span><span class="bs-search__item-s">${mark(snippet, q)}</span>`
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 20);
    paint();
  }

  const open = () => {
    if (dlg.open) return;
    setMenu(false);
    dlg.showModal();
    input.select();
    loadData().catch(() => {});
  };
  $$('[data-search-open]').forEach(b => b.addEventListener('click', open));
  addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); open(); }
  });
  input.addEventListener('input', query);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[sel];
      if (!it) return;
      if (it.cmd) { dlg.close(); it.cmd.run(); } else location.href = it.url;
    }
  });
  list.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const i = Array.from(list.children).indexOf(a.parentElement);
    if (items[i] && items[i].cmd) { e.preventDefault(); dlg.close(); items[i].cmd.run(); }
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();
