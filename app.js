(() => {
  'use strict';
  const F = window.SIX_SEVEN_FIXTURE, E = window.SIX_SEVEN_EDITION || {}, S = window.SIX_SEVEN_SKY, P = window.SIX_SEVEN_PERSONAL || null;
  const H = window.SIX_SEVEN_READING || { title: 'The heavens', chart_line: [], themes: [], numerology: { universal: [] }, written: false };
  const M = window.SIX_SEVEN_META || { label: 'Six Seven', long: '', short: '', open_utc: new Date().toISOString(), status: {} };
  const B = window.SIX_SEVEN_BRIEF || { headline: ['The day', ''], chapters: [], beats: [] };
  const MONEY = window.SIX_SEVEN_MONEY || null;
  const KD = window.SIX_SEVEN_DECK || null;
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const $ = (s, el = document) => el.querySelector(s);
  const D = Math.PI / 180;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = () => innerWidth <= 760;
  const quote = label => F.quotes.find(q => q.label === label);
  const pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
  // Colours come from the active palette (palette.js), so the page, its charts and the globe always agree.
  const PAL = window.SIX_SEVEN_PALETTE || { gl: {}, hex: {}, coastA: .34, glowStd: 3.2 };
  const cssVar = k => getComputedStyle(document.documentElement).getPropertyValue('--' + k).trim();
  const PC = Object.fromEntries(['glow', 'mauve', 'up', 'down', 'down2', 'hot', 'ink', 'lean-l', 'lean-c', 'lean-r', 'lean-l2', 'lean-r2', 'series-1', 'series-2', 'series-3', 'cool', 'warm', 'warm2']
    .map(k => [k.replace(/-(\w)/g, (_, c) => c.toUpperCase()), cssVar(k)]));
  const lineA = a => `rgba(${cssVar('line-rgb')},${a})`, downA = a => `rgba(${cssVar('down-rgb')},${a})`;
  const gv = (k, d) => `vec3(${(PAL.gl[k] || d).map(x => (+x).toFixed(3)).join(',')})`;
  const places = F.marks.filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lon));
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  let hvLabels = null, hvLit = new Set();
  let flight = null, dragging = null, home = null, realignAt = 0, skyHome = null, skyRealignAt = 0, quietUntil = 0, chapter = -1, selected = null, started = false, renderer = null, markers = [], coast = null, distMul = 1;
  let viewMode = 'orbit', trans = null, think = null, thinkDone = false, skyBlend = 0, pulseAt = -1e9, skySince = 0;
  const skyLook = { az: 100, alt: 24 };
  const pings = [];

  // ---------- The sky, in words (computed from sky.js, never hand-typed) ----------
  const NAKED = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const upBodies = S.bodies.filter(b => b.alt > 0 && NAKED.includes(b.name));
  const compass = az => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(az / 45) % 8];
  function sep(a, b) {
    const a1 = a.alt * D, a2 = b.alt * D, dz = (a.az - b.az) * D;
    return Math.acos(Math.min(1, Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dz))) / D;
  }
  function skyProse() {
    const m = S.moon, out = [];
    const near = upBodies.map(b => ({ b, d: sep(m, b) })).sort((x, y) => x.d - y.d)[0];
    let first = `The Moon, ${Math.round(m.illumination)}% lit and ${m.waxing ? 'waxing' : 'waning'}, sits in the ${compass(m.az)}`;
    if (near && near.d < 10) first += `, about ${Math.round(near.d)}° ${m.alt > near.b.alt ? 'above' : 'beside'} ${near.b.name}`;
    out.push(first + '.');
    const rest = upBodies.filter(b => !near || near.d >= 10 || b !== near.b).sort((a, b) => b.alt - a.alt);
    if (rest.length) out.push(rest.map((b, i) => `${b.name} ${i ? 'is' : 'stands'} ${Math.round(b.alt)}° up in the ${compass(b.az)}`).join(', ') + '.');
    out.push(`The Sun clears the horizon at ${S.sunrise_local}.`);
    return out.join(' ');
  }

  // ---------- Chapters: the Brief as exported by observatory.py, then Explore and the heavens ----------
  function skyTitle() {
    const m = S.moon, near = upBodies.map(b => ({ b, d: sep(m, b) })).sort((x, y) => x.d - y.d)[0];
    if (m.alt > 0 && near && near.d < 10) return `The Moon over ${near.b.name}<br><em>at first light.</em>`;
    if (m.alt > 0) return `The Moon in the ${compass(m.az)}<br><em>at first light.</em>`;
    const top = [...upBodies].sort((x, y) => y.alt - x.alt)[0];
    return top ? `${top.name} in the ${compass(top.az)}<br><em>at first light.</em>` : 'The sky<br><em>at first light.</em>';
  }
  let cn = 1;
  const EDAY0 = M.date ? new Date(M.date + 'T12:00:00Z') : null;
  const CH_SAY = { 'Inside tech': 'Tech stocks', 'Outliers': 'Unusual moves', 'Beyond stocks': 'Currencies', 'Raw materials': 'Metals, oil and crops' };
  const CHAPTERS = [
    { id: 'day', label: 'The day', eyebrow: `Morning brief\u2003${EDAY0 ? EDAY0.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : M.long}`, title: E.headline_wire ? `${esc(E.headline)}<br><em>${esc(E.headline_wire)}</em>` : `${esc(E.headline || B.headline[0]).replace(/([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)/g, '<span class="nw">$1</span>')}`, long: !E.headline_wire && (E.headline || '').length > 44, wire: !!E.headline_wire,
      body: '', quotes: [], view: { lat: 24, lon: -96, dist: 3.35 } },
    ...B.chapters.map(c => ({ ...c, label: CH_SAY[c.label] || c.label, view: c.view || { lat: 24, lon: -60, dist: 3.4 }, eyebrow: `0${cn++}\u2003${CH_SAY[c.label] || c.label}` })),
    { id: 'explore', label: 'The map', eyebrow: `0${cn++}\u2003The map`, title: `${places.length} places<br><em>in today’s news and markets.</em>`,
      body: 'Drag the planet. Tap a light to see what the record holds there. Brighter means more stories and moves point there.',
      quotes: [], view: { lat: 18, lon: -20, dist: 3.25 } },
    { id: 'heavens', label: 'The heavens', eyebrow: `0${cn}\u2003The heavens\u2003${M.long}`, title: H.title,
      body: '', quotes: [], view: { lat: 16, lon: -48, dist: 6.4 }, heavens: true },
    { id: 'sky', parent: 'heavens', label: 'Above you', eyebrow: `0${cn}\u2003The heavens\u2003above ${S.observer.name}, ${S.observer.local}`,
      title: skyTitle(), body: skyProse(), quotes: [], sky: true }
  ];
  const IDX = id => CHAPTERS.findIndex(c => c.id === id);
  // The edition says which day it is and, when it isn't today's, how old it is. Edition numbers read as machine counts.
  const EDAY = M.date ? new Date(M.date + 'T12:00:00Z') : null;
  const editionWord = (() => {
    if (!EDAY) return unDot(M.label, 'edition');
    const now = new Date(), today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()), age = Math.round((today - Date.UTC(EDAY.getUTCFullYear(), EDAY.getUTCMonth(), EDAY.getUTCDate())) / 864e5);
    const day = EDAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
    return age <= 0 ? `Today’s brief, ${day}` : age === 1 ? `Yesterday’s brief, ${day}` : `Brief from ${day}, ${age} days ago`;
  })();
  document.querySelectorAll('[data-edition-label]').forEach(n => { n.textContent = editionWord; });
  { const sp = $('[data-spend]'), x = M.spend; if (sp && x && x.month != null) { sp.hidden = false; sp.innerHTML = `Model spend <b>$${x.day.toFixed(2)}</b> on ${M.short} · $${x.month.toFixed(2)} this month · daily cap $${x.cap.toFixed(2)}`; } }
  // Looks: the palette studies, switchable here so they can be judged on real days. The choice is remembered on this device.
  { const box = $('[data-look-list]'); if (box && PAL.all) { for (const [k, label] of Object.entries(PAL.all)) { const u = new URL(location.href); u.searchParams.set('palette', k); const a = el('a', '', label); a.href = u.search; if (k === PAL.name) a.setAttribute('aria-current', 'true'); box.append(a); } $('[data-looks]').hidden = false; } }
  { const box = $('[data-type-list]'); if (box && PAL.types) { for (const [k, label] of Object.entries(PAL.types)) { const u = new URL(location.href); u.searchParams.set('type', k); const a = el('a', '', label); a.href = u.search; if (k === PAL.type) a.setAttribute('aria-current', 'true'); box.append(a); } $('[data-types]').hidden = false; } }
  // The archive: every exported edition, newest first. A link reloads the page on that day's file.
  fetch('data/index.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(list => {
    const box = $('[data-edition-list]'); if (!box || !list.length) return;
    for (const e of list.slice(0, 12)) {
      const a = el('a', '', new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
      a.href = `?edition=${e.date}`; a.title = `${e.label}${e.written ? '' : ' · no written read'}`; if (e.date === M.date) a.setAttribute('aria-current', 'page');
      box.append(a);
    }
    $('[data-editions]').hidden = false;
  }).catch(() => {});
  $('#world')?.setAttribute('aria-label', `The Earth on ${M.long}. Drag to turn it.`);
  { const fs = $('.fine-sky'); if (fs) fs.textContent = `Sky over ${S.observer.name} at ${S.observer.local}, ${M.long}, from Six Seven’s star and planet code · tradition is shown as tradition and kept out of the market read`; }

  // ---------- The reasoning, as beats (observatory.py builds them from measured data; the model's case against joins when it ran) ----------
  const BEATS = B.beats;
  function chainItem(b, i) {
    const li = document.createElement('li'); li.dataset.i = i;
    const head = document.createElement('div'); head.className = 'head';
    const c = document.createElement('span'); c.className = 'claim'; c.textContent = b.claim; head.append(c);
    if (b.stars != null) { const n = Math.max(0, Math.min(3, +b.stars || 0)), st = document.createElement('span'); st.className = 'stars'; st.append(Object.assign(document.createElement('b'), { textContent: '✦'.repeat(n) }), Object.assign(document.createElement('i'), { textContent: '✦'.repeat(3 - n) })); head.append(st); }
    if (b.figs) {
      const f = document.createElement('span'); f.className = 'figs';
      for (const l of b.figs) { const q = quote(l); if (!q) continue; const s = document.createElement('span'); const k = document.createElement('i'); k.textContent = figName(l); const mv = ownMove(l, q.change_pct), v = document.createElement('b'); v.textContent = pct(mv); v.className = mv >= 0 ? 'pos' : 'neg'; s.append(k, v); f.append(s); }
      head.append(f);
    }
    li.append(head);
    if (b.note) { const n = document.createElement('p'); n.className = 'note'; n.textContent = b.note; li.append(n); }
    return li;
  }
  function renderFullChain() { renderFront(false); }
  // The front page: what happened in plain sentences, the three numbers that matter, the case against, and how sure the
  // read is. Built from the measured beats, so it's true by construction; nothing here is a model figure.
  const SURE = { 0: 'Not sure', 1: 'Not very sure', 2: 'Fairly sure', 3: 'Sure' };
  const INBOX = window.SIX_SEVEN_INBOX?.payload || null;
  const EVENT_SAY = { 'CPI': ['The inflation report', 'It moves interest rates, and with them most of the market.'], 'FOMC decision': ['The Fed’s rate decision', 'It sets the price of money for everything else.'],
    'Nonfarm payrolls': ['The jobs report', 'The clearest read on whether the economy is speeding up or slowing.'], 'PCE price index': ['The Fed’s favourite inflation gauge', 'It shapes what the Fed does next.'] };
  function frontRows() {
    const rows = [], add = (k, text, go, where) => { if (text) rows.push({ k, text, go, where }); };
    const t = (KD?.tripwires || []).find(w => w.state === 'tripped');
    const nxt = (KD?.calendar || []).find(e => e.tier === 1);
    if (nxt) { const [nm, why] = EVENT_SAY[nxt.name] || [nxt.name, nxt.why]; add('Coming up', `${nm} ${nxt.days_away === 0 ? 'today' : nxt.days_away === 1 ? 'tomorrow' : `in ${nxt.days_away} days`}. ${why}`, M.public ? null : () => window.SixSevenDeck?.open(), M.public ? null : 'Alerts'); }
    if (WM) {
      const big = (WM.top_changes || []).filter(c => c.articles >= 250 && typeof c.tone_vs_baseline === 'number').sort((a, b) => Math.abs(b.tone_vs_baseline) - Math.abs(a.tone_vs_baseline))[0];
      if (big) add('The world', moodSentence(big), () => openMood(), 'Map');
      const al = WM_PLACED.filter(c => typeof c.tone_vs_baseline === 'number' && Math.abs(c.tone_vs_baseline) >= 1).map(c => ({ c, l: skyLineNear(c.lat, c.lon) })).find(x => x.l);
      if (al) add('The sky', `By tradition, ${al.l.body} is ${ANGLE_SAY[al.l.angle]} over ${al.c.name} today, where the news turned ${al.c.tone_vs_baseline < 0 ? 'darker' : 'brighter'}. Tradition, not measurement.`, () => openMood(), 'Map');
    }
    if (DESK_BY.outliers?.has?.()) add('Unusual', DESK_BY.outliers.find(), () => openDesk('outliers'), 'Analysis');
    if (E.since_yesterday) add('What changed', E.since_yesterday, () => inspectRoot('read'), 'The full analysis');
    const groups = {}; X.headlines.forEach(h => { if (h.story != null) (groups[h.story] ||= []).push(h); });
    const big = Object.values(groups).sort((a, b) => new Set(b.map(h => h.source)).size - new Set(a.map(h => h.source)).size)[0];
    if (big && new Set(big.map(h => h.source)).size >= 3) add('Most covered', `${big[0].title.replace(/([^.!?…”’])$/, '$1.')} Covered by ${new Set(big.map(h => h.source)).size} outlets, left to right.`, () => inspect('headline', big[0].i), 'The story');
    const R = KD?.record; if (R?.graded_dedup) add('Track record', `The read has called ${R.hits_dedup} of its last ${R.graded_dedup} graded calls right. ${R.open ? `${R.open} more are open.` : ''}`.trim(), () => openDesk('record'), 'Analysis');
    // Always last, always shown: whether this morning's feeds and the written read arrived. Opens the data tree.
    const hl = window.SixSevenAnalysis?.health?.(), out = rows.slice(0, (phone() ? 5 : 8) - (hl ? 1 : 0));
    if (hl) out.push({ k: 'Sources', text: `${hl.lit === hl.expected ? `All ${hl.expected} sources delivered.` : `${hl.lit} of ${hl.expected} sources delivered. Missing: ${hl.missing.join(', ')}.`}${hl.written ? '' : ' The written read didn’t pass its checks.'}`, go: () => openDesk('data'), where: 'Analysis' });
    return out;
  }
  function renderFront(anim) {
    const box = $('[data-front]'); if (!box) return; box.replaceChildren(); box.hidden = false;
    // one line on the market, with the index's own figure
    const said = BEATS.filter(b => !b.call && b.stars == null && !/^The case against|^No written read/.test(b.claim));
    let text = '';
    said.forEach(b => { const c = b.claim.trim(); if (/^…/.test(c)) text = text.replace(/…\s*$/, '') + ', ' + c.replace(/^…\s*/, ''); else text += (text ? ' ' : '') + c; });
    text = text.replace(/…\s*$/, '.').replace(/\s+/g, ' ').trim();
    const f0 = (BEATS.find(b => b.figs?.length)?.figs || [])[0], q0 = f0 && quote(f0);
    if (q0) text = text.replace(new RegExp(`^((?:The )?${figName(f0).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (?:fell|rose|slipped|gained|dropped|climbed))`), `$1 ${Math.abs(ownMove(f0, q0.change_pct)).toFixed(2)}%`);
    if (text) box.append(el('p', 'f-lead', text));
    // Today's reads: the morning's connected arguments, each played as a guided build (reads.js)
    const RD = window.SixSevenReads;
    if (RD?.has()) {
      const k = el('div', 'f-reads-k'); k.append(el('span', '', 'Today\u2019s reads'));
      const all = el('button', '', 'Play all'); all.type = 'button'; all.addEventListener('click', () => RD.open(0)); k.append(all); box.append(k);
      const rl = el('div', 'f-reads');
      RD.list().forEach((r, i) => { const b = el('button', 'f-read'); b.type = 'button'; b.append(el('span', 'n', String(i + 1)), el('span', 't', r.title), el('span', 'p', 'Play')); b.addEventListener('click', () => RD.open(i)); rl.append(b); });
      box.append(rl);
    }
    const list = el('div', 'f-rows');
    for (const r of frontRows()) {
      const row = el(r.go ? 'button' : 'div', 'f-row' + (r.go ? '' : ' static')); if (r.go) { row.type = 'button'; row.addEventListener('click', r.go); row.title = `Open in ${r.where}`; }
      row.append(el('span', 'f-k', r.k), el('span', 'f-t', r.text)); if (r.where) row.append(el('span', 'f-where', r.where)); list.append(row);
    }
    box.append(list);
    const conf = BEATS.find(b => b.stars != null), foot = el('div', 'f-foot');
    if (conf) foot.append(el('span', 'f-sure', `${SURE[Math.max(0, Math.min(3, +conf.stars || 0))]} about today’s read. ${(conf.note || '').replace(/ independent sources back it\.?/, ' sources agree.')}`));
    const walk = el('button', 'f-go', 'Walk through the day'); walk.type = 'button'; walk.addEventListener('click', () => go(1));
    foot.append(walk); box.append(foot);
    box.classList.toggle('in', !!anim);
    if (!phone()) requestAnimationFrame(() => { const rail = $('#chapters')?.getBoundingClientRect().top || innerHeight; let n = list.children.length;
      const keep = RD?.has() ? 1 : 3;
      // trim from the bottom, but the Sources line stays: it's the morning's health check
      const src = [...list.children].find(c => c.querySelector('.f-k')?.textContent === 'Sources');
      while (n > keep && foot.getBoundingClientRect().bottom > rail - 18) { (src && list.lastElementChild === src ? src.previousElementSibling : list.lastElementChild)?.remove(); n--; } });
  }


  // ---------- Story UI ----------
  const chaptersEl = $('#chapters');
  let railN = 0;
  CHAPTERS.forEach((c, i) => {
    if (c.parent) return;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
    b.innerHTML = `<span class="n">0${railN++}</span><span class="t"></span>`;
    b.querySelector('.t').textContent = c.label;
    b.addEventListener('click', () => go(i));
    chaptersEl.append(b);
  });
  function railUI(i) {
    const id = CHAPTERS[i]?.parent || CHAPTERS[i]?.id;
    chaptersEl.querySelectorAll('button').forEach(b => CHAPTERS[+b.dataset.i].id === id ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'));
    const cur = chaptersEl.querySelector('[aria-current]');
    if (cur && chaptersEl.scrollWidth > chaptersEl.clientWidth) chaptersEl.scrollTo({ left: Math.max(0, cur.offsetLeft - 16), behavior: reduced ? 'auto' : 'smooth' });
  }
  function renderTradition() {
    const t = S.tradition, box = $('[data-tradition]'); box.replaceChildren();
    const lab = document.createElement('span'); lab.className = 'label'; lab.textContent = 'Tradition · kept out of the market read'; box.append(lab);
    const dl = document.createElement('dl');
    const row = (k, v) => { const d = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; d.append(dt, dd); dl.append(d); };
    row(`${t.sun_sign.glyph}\uFE0E Sun in ${t.sun_sign.name}`, t.sun_sign.associated_with);
    row(`☾ Moon in ${t.moon_sign.name}`, t.moon_sign.associated_with);
    row(`Day ${t.numerology.day}`, t.numerology.day_meaning);
    if (t.aspects[0]) { const a = t.aspects[0]; row(`${a.a} ${a.glyph} ${a.b} · ${a.orb.toFixed(1)}°`, a.tradition); }
    box.append(dl);
    const p = document.createElement('p'); p.className = 'none';
    p.textContent = S.notable.length ? `Notable today: ${S.notable.map(n => n.label).join(', ')}.` : 'Notable today: none. Six Seven only flags stations, exact slow-planet aspects, new and full moons, and master numbers.';
    box.append(p);
  }
  // Separators: a label's parts get a wide gap, the way a broadcast graphic splits them; small meta lines use commas, so
  // they read as speech. Mid-dots read as template filler.
  function unDot(s, cls = '') {
    if (typeof s !== 'string' || !s.includes(' · ')) return s;
    if (/(^|\s)(label|imeta|edition)(\s|$)/.test(cls)) return s.replace(/ · /g, '\u2003');
    if (/(^|\s)(meta|dx-find|when|isrc|m-note|inote|tx)(\s|$)/.test(cls)) return s.replace(/ · /g, ', ');
    return s;
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = unDot(String(text), cls || ''); return e; }
  function renderHeavens() {
    const box = $('[data-heavens]'); box.replaceChildren();
    box.append(el('p', 'hv-char', H.character));
    const chips = el('div', 'hv-chart'); H.chart_line.forEach(c => chips.append(el('span', '', c))); box.append(chips);
    box.append(el('p', 'hv-moon', H.moon_note));
    if (P) {
      const me = el('section', 'hv-me'); me.append(el('span', 'label', 'Your sky today'), el('h3', 'hv-me-head', P.headline));
      const mol = el('ol', 'hv-themes personal');
      for (const t of P.transits) {
        const li = el('li'); li.tabIndex = 0;
        li.append(el('h3', '', t.title), el('span', 'from', t.drawn_from), el('p', '', t.reading));
        li.addEventListener('mouseenter', () => highlight(t.refs)); li.addEventListener('focus', () => highlight(t.refs));
        li.addEventListener('mouseleave', () => highlight([])); li.addEventListener('blur', () => highlight([]));
        mol.append(li);
      }
      me.append(mol, el('p', 'hv-sr', P.solar_return), el('p', 'hv-caveat', P.caveat));
      box.append(me);
      box.append(el('span', 'label hv-world', 'The world’s sky'));
    }
    const ol = el('ol', 'hv-themes');
    for (const t of H.themes) {
      const li = el('li'); li.dataset.refs = t.refs.join('|'); li.tabIndex = 0;
      li.append(el('h3', '', t.title), el('span', 'from', t.drawn_from), el('p', '', t.reading));
      li.addEventListener('mouseenter', () => highlight(t.refs)); li.addEventListener('focus', () => highlight(t.refs));
      li.addEventListener('mouseleave', () => highlight([])); li.addEventListener('blur', () => highlight([]));
      ol.append(li);
    }
    box.append(ol);
    const num = el('section', 'hv-num'); num.append(el('span', 'label', 'Numerology'));
    const row = el('div', 'nums');
    for (const n of H.numerology.universal) { const d = el('div'); d.append(el('b', '', String(n.value)), el('span', '', n.label + (n.card ? ` · ${n.card}` : ''))); d.title = n.meaning; row.append(d); }
    num.append(row, el('p', '', H.numerology.reading));
    if (P) {
      const prow = el('div', 'nums personal');
      for (const n of P.numbers) { const d = el('div'); d.append(el('b', '', String(n.value)), el('span', '', n.label)); d.title = n.meaning; prow.append(d); }
      num.append(el('span', 'label sub', 'Yours'), prow, el('p', '', P.numerology_reading));
    } else if (!M.public) {
    }
    box.append(num);
    if (!P && !M.public) {
    }
    const tn = el('section', 'hv-tension'); tn.append(el('span', 'label', 'Where they disagree'), el('p', '', H.tension)); box.append(tn);
    const ec = el('section', 'hv-echo'); ec.append(el('span', 'label', 'Echo'), el('p', '', H.echo)); box.append(ec);
    box.append(el('p', 'hv-src', `Chart for ${S.chart.for} · whole-sign houses · traditional dignities and sect · positions from Six Seven’s own planet code. Reading drafted for this mockup; in the product it comes from the Heavens desk. Kept separate from the market read.`));
  }
  function renderStory(c) {
    $('#story').dataset.chapter = c.id;
    $('[data-eyebrow]').textContent = c.eyebrow;
    $('[data-title]').innerHTML = c.title; $('[data-title]').classList.toggle('long', !!c.long); $('[data-title]').classList.toggle('wire', !!c.wire);
    $('[data-body]').textContent = c.body; $('[data-body]').hidden = !c.body;
    $('[data-note]').textContent = c.note || ''; $('[data-note]').hidden = !c.note;
    const sw = $('[data-hvswitch]'); sw.hidden = !(c.heavens || c.parent === 'heavens');
    sw.querySelectorAll('[data-hv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hv === c.id)));
    const dp = $('[data-deeper]'); dp.hidden = !(c.deep && DESK_BY[c.deep]); if (!dp.hidden) { dp.textContent = `Go deeper: ${DESK_BY[c.deep].name}`; dp.dataset.desk = c.deep; }
    const q = $('[data-quotes]'); q.replaceChildren();
    for (const label of c.quotes) {
      const item = quote(label); if (!item) continue;
      const d = document.createElement('div');
      const s = document.createElement('span'); s.textContent = figName(label);
      const mv = ownMove(label, item.change_pct), v = document.createElement('strong'); v.textContent = pct(mv); v.className = mv >= 0 ? 'pos' : 'neg';
      d.append(s, v); q.append(d);
    }
    $('[data-chain]').replaceChildren(); $('[data-replay]').hidden = true;
    if (c.id === 'day') { if (thinkDone) renderFront(false); else $('[data-front]').hidden = true; }
    else { $('[data-front]').replaceChildren(); $('[data-front]').hidden = true; }
    $('[data-measured]').hidden = !c.sky;
    $('[data-tradition]').replaceChildren();
    if (c.heavens) renderHeavens(); else $('[data-heavens]').replaceChildren();
    $('.story').scrollTop = 0;
  }

  // ---------- Money call ----------

  // ---------- Time and the Sun ----------
  // The record stores only the date. Earth chapters run from the NYSE open (13:30 UTC); the sky chapter runs from
  // 06:42 EDT in the observer's city, when the brief arrives. Both clocks advance at real rate.
  const OPEN = Date.parse(M.open_utc), SKYT = Date.parse(S.when_utc);
  const t0 = performance.now();
  function subsolar(ms) {
    const n = ms / 86400000 + 2440587.5 - 2451545.0;
    const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * D;
    const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D, eps = (23.439 - 0.0000004 * n) * D;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    let lon = (ra / D - (280.46061837 + 360.98564736629 * n)) % 360; if (lon > 180) lon -= 360; if (lon < -180) lon += 360;
    return { lat: dec / D, lon };
  }
  const pad = n => String(n).padStart(2, '0');
  // The clock: your real local time, and whether US stock markets are open right now (NYSE hours and 2026 holidays).
  const NYSE_OFF = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25', '2027-01-01']);
  function marketState(now = new Date()) {
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })), mins = et.getHours() * 60 + et.getMinutes();
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, trading = d => d.getDay() % 6 !== 0 && !NYSE_OFF.has(iso(d));
    if (trading(et) && mins >= 570 && mins < 960) { const left = 960 - mins; return { open: true, say: left <= 60 ? `Markets close in ${left} min` : 'US markets open' }; }
    const next = new Date(et); if (!(trading(et) && mins < 570)) do next.setDate(next.getDate() + 1); while (!trading(next));
    const when = iso(next) === iso(et) ? 'today' : (next - et) < 2 * 864e5 && next.getDay() === (et.getDay() + 1) % 7 ? 'tomorrow' : next.toLocaleDateString('en-US', { weekday: 'long' });
    return { open: false, say: `Markets open ${when}, 9:30 ET` };
  }
  function clockTick() {
    const now = new Date(), ms = marketState(now);
    $('[data-sun]').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    $('[data-sun-zone]').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
    $('[data-short-pill]').textContent = ms.say; $('[data-status]').classList.toggle('open', ms.open);
  }
  clockTick();
  const skyLine = $('[data-skyline]');
  skyLine.textContent = `☾ ${S.chart.moon_phase} Moon in ${S.moon.sign.name} · day ${S.tradition.numerology.day} · ${S.chart.ascendant.sign} rising`;
  $('.skylink').addEventListener('click', () => go(IDX('heavens')));
  document.querySelectorAll('[data-hv]').forEach(b => b.addEventListener('click', () => go(CHAPTERS.findIndex(c => c.id === b.dataset.hv))));
  $('[data-deeper]').addEventListener('click', e => openDesk(e.currentTarget.dataset.desk));

  // ---------- One inspector, a command bar, and two modes ----------
  // Everything you can open (a place, an instrument, a headline, the read, the indexes) opens in one panel with one
  // layout, in the left column where the story lives. The globe answers by flying to whatever is inspected.
  const X = window.SIX_SEVEN_EXPLORE || { instruments: [], headlines: [] };
  const LEANS = ['left', 'lean-left', 'center', 'lean-right', 'right'];
  const LEAN_LABEL = { left: 'Left', 'lean-left': 'Lean left', center: 'Center', 'lean-right': 'Lean right', right: 'Right', straight: 'Wire or market desk' };
  const inst = Object.fromEntries(X.instruments.map(i => [i.label, i]));
  const byStory = {}; X.headlines.forEach((h, i) => { h.i = i; (byStory[h.story] ||= []).push(h); });
  const globe = { look: null, clear: null, explore: null };
  const RATES = new Set(['^TNX', '^IRX', '^TYX']);
  const fmtN = (v, d = 2) => v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPrice = i => RATES.has(i.symbol) ? `${i.price.toFixed(3)}%` : fmtN(i.price, i.desk === 'fx' && i.price < 20 ? 4 : i.price >= 1000 ? 0 : 2);
  const fmtCap = v => v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${fmtN(v, 0)}`;
  const DESK = { indices: 'US indices', futures: 'Futures', crypto: 'Crypto', rates: 'Rates', sectors: 'Sectors', fx: 'Currencies', africa: 'Africa', global: 'Global indices', curve: 'Curve & volatility', commodities: 'Commodities', watchlist: 'Watchlist' };
  // words that refer to an instrument in prose and headlines (used for "in today's read" and related headlines)
  const ALIAS = { 'S&P 500': ['S&P'], 'Crude Oil': ['crude', 'oil'], 'USD/JPY': ['yen'], 'Dollar Index': ['dollar'], 'Semiconductors': ['semis', 'semiconductor', 'chip'], 'Nasdaq 100': ['Nasdaq'], '10-Year Treasury': ['10-year', 'Treasury', 'yields'], 'Corn': ['corn', 'grains'], 'Wheat': ['wheat', 'grains'], 'Natural Gas': ['natural gas'], 'Nikkei 225': ['Nikkei'], 'Hang Seng': ['Hang Seng'], 'Alphabet': ['Alphabet', 'Google'], 'Meta': ['Meta'], 'TSMC': ['TSMC', 'Taiwan Semiconductor'] };
  const words = l => (ALIAS[l] || [l]).map(w => new RegExp(`(^|[^A-Za-z])${w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![A-Za-z])`, 'i'));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.append(e); return e; };
  let sparkN = 0;
  function spark(series, w, h, big) {
    const s = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: big ? 'spark big' : 'spark', 'aria-hidden': 'true' });
    if (!series || series.length < 2) return s;
    const lo = Math.min(...series), hi = Math.max(...series), pad = big ? 6 : 2;
    const x = i => pad + i * (w - 2 * pad) / (series.length - 1), y = v => h - pad - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (h - 2 * pad);
    const d = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    if (big) {
      const id = 'spk' + (++sparkN), g = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, svgEl('defs', {}, s));
      svgEl('stop', { offset: 0, 'stop-color': PC.mauve, 'stop-opacity': .16 }, g); svgEl('stop', { offset: 1, 'stop-color': PC.mauve, 'stop-opacity': 0 }, g);
      svgEl('path', { d: `${d}L${x(series.length - 1)} ${h}L${x(0)} ${h}Z`, class: 'area', fill: `url(#${id})` }, s);
    }
    svgEl('path', { d, class: 'ln' + (series.at(-1) >= series[0] ? ' up' : ' down') }, s);
    svgEl('circle', { cx: x(series.length - 1), cy: y(series.at(-1)), r: big ? 3.4 : 1.8, class: 'end' }, s);
    return s;
  }
  function when(p) {
    const t = Date.parse(p && /^\d{4}-\d\d-\d\d \d/.test(p) ? p.replace(' ', 'T') + 'Z' : p);
    if (!p || isNaN(t)) return '';
    return new Date(t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  }
  function leanBar(items) {
    const bar = el('div', 'lean');
    LEANS.forEach(l => { const slot = el('span', 'slot'); slot.title = LEAN_LABEL[l]; if (items.some(h => h.lean === l)) slot.classList.add('on'); bar.append(slot); });
    const cap = el('div', 'lean-cap'); cap.append(el('span', '', 'Left'), el('span', '', 'Center'), el('span', '', 'Right'));
    const w = el('div', 'lean-wrap'); w.append(bar, cap); return w;
  }
  const inspEl = $('#insp'), inspBody = $('[data-insp-body]'), crumbs = $('[data-insp-crumbs]');
  let stack = [], uiMode = 'brief', hlFilter = 'all';
  const rowBtn = (cls, onClick) => { const b = el('button', 'irow ' + (cls || '')); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const sectionHead = t => el('span', 'label isec', t);

  // Lens data. Weather is the observed record for the day (the edition's desk kept no readings); see build_weather.py.
  const WX = window.SIX_SEVEN_WEATHER;
  const wxWhen = () => WX ? `${new Date(WX.at_utc).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET · ${WX.source}.` : '';
  const wxName = w => w.label.replace(/ \(.+\)$/, '').replace(', NY', '');
  const shortChannel = b => (b || '').split('—').pop().trim();
  const INST_FOR = b => { const t = (b || '').toLowerCase(), out = [];
    for (const [k, l] of [['crude', 'Crude Oil'], ['natural gas', 'Natural Gas'], ['wheat', 'Wheat'], ['corn', 'Corn'], ['grains', 'Wheat'], ['grains', 'Corn'], ['coffee', 'Coffee'], ['gold', 'Gold']]) if (t.includes(k) && inst[l] && !out.includes(inst[l])) out.push(inst[l]);
    return out; };
  const LEAN_GROUP = { left: 'left', 'lean-left': 'left', center: 'center', 'lean-right': 'right', right: 'right', straight: 'wire' };
  const LEAN_COL = { left: PC.leanL, center: PC.leanC, right: PC.leanR, wire: lineA(.4) };

  // ---------- Depth: the desks under the read ----------
  // Every figure comes from depth.js (parsed from the served edition's own blocks), explore.js or deck.js.
  const DP = window.SIX_SEVEN_DEPTH;
  // The world's mood: GDELT's measure of how each country's news coverage sounds, against its own recent baseline.
  // Media measurement, not people's feelings. The planetary lines are tradition and are labelled as such.
  const WM = window.SIX_SEVEN_WORLD || null;
  const WM_CH = Object.fromEntries((WM?.top_changes || []).map(c => [c.country, c]));
  const WM_LIST = WM ? (Array.isArray(WM.countries) ? WM.countries : Object.entries(WM.countries).map(([k, v]) => ({ country: k, ...v }))) : [];
  const WM_PLACED = WM_LIST.filter(c => c.places?.length && c.articles >= 120).map(c => {
    const pl = c.places[0], at = typeof pl === 'string' ? (places.find(p => p.place === pl) || null) : pl;
    return at && Number.isFinite(at.lat) ? { ...c, ...(WM_CH[c.country] || {}), lat: at.lat, lon: at.lon, at: at.name || at.place || pl } : null;
  }).filter(Boolean);
  const ANGLE_SAY = { MC: 'overhead', IC: 'underfoot', ASC: 'rising', DSC: 'setting' };
  function skyLineNear(lat, lon) {
    let best = null;
    for (const l of WM?.sky?.lines || []) for (const q of l.points || []) {
      const d = Math.acos(Math.min(1, Math.sin(lat * D) * Math.sin(q.lat * D) + Math.cos(lat * D) * Math.cos(q.lat * D) * Math.cos((lon - q.lon) * D))) / D;
      if (!best || d < best.d) best = { d, body: l.body, angle: l.angle };
    }
    return best && best.d < 3.5 ? best : null;
  }
  const moodWord = c => { const d = c.tone_vs_baseline; if (typeof d !== 'number') return null; const a = Math.abs(d); if (a < .5) return 'about as usual'; return `${a >= 2 ? 'much ' : a >= 1 ? '' : 'a little '}more ${d < 0 ? 'negative' : 'positive'} than usual`; };
  function moodSentence(c) {
    const w = moodWord(c); if (!w) return `News about ${c.name} sounds ${c.tone < -1.5 ? 'negative' : c.tone > 1 ? 'positive' : 'mixed'} today.`;
    let s2 = `News about ${c.name} sounds ${w}`;
    if (typeof c.protest_vs_baseline === 'number' && c.protest_vs_baseline >= 5) s2 += `, with more protests reported (${c.protest})`;
    else if (typeof c.articles_vs_baseline_pct === 'number' && Math.abs(c.articles_vs_baseline_pct) >= 50) s2 += `, on ${Math.abs(Math.round(c.articles_vs_baseline_pct))}% ${c.articles_vs_baseline_pct > 0 ? 'more' : 'fewer'} stories`;
    return s2 + '.';
  }
  const figName = l => { const n = (FX_NAME[l] || SAY_NAME[l] || l).replace(/^The /, ''); return n[0].toUpperCase() + n.slice(1); };
  const FX_NAME = { 'USD/KES': 'Kenya’s shilling', 'USD/JPY': 'The yen', 'USD/ZAR': 'The rand', 'USD/BRL': 'Brazil’s real', 'USD/INR': 'The rupee', 'USD/CNY': 'The yuan', 'USD/MXN': 'Mexico’s peso', 'USD/NGN': 'Nigeria’s naira', 'USD/EGP': 'Egypt’s pound', 'USD/CHF': 'The Swiss franc' };
  const SAY_NAME = { 'Semiconductors': 'Chip stocks', 'Tech Sector': 'Tech stocks', '10-Year Treasury': 'The 10-year yield', 'Dollar Index': 'The dollar', 'Nasdaq 100': 'The Nasdaq 100' };
  const groupName = l => { const n = SAY_NAME[l] || l; return n.startsWith('The ') ? 'the ' + n.slice(4) : SAY_NAME[l] ? n.toLowerCase() : n; };
  const sayName = l => FX_NAME[l] || SAY_NAME[l] || l;
  // A currency quoted per dollar (USD/XXX) moves the other way from its quote, by 1/(1+m) - 1.
  const ownMove = (l, m) => FX_NAME[l] && l.startsWith('USD/') ? (1 / (1 + m / 100) - 1) * 100 : m;
  const moveSay = (l, m) => { const v = ownMove(l, m); return `${sayName(l)} ${v >= 0 ? 'rose' : 'fell'} ${Math.abs(v).toFixed(2)}%${FX_NAME[l] ? ' against the dollar' : ''}`; };
  const signed = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%';
  const watchNames = X.instruments.filter(i => i.desk === 'watchlist' && i.trailing_pe && i.sma_200);
  const bySymbol = s => X.instruments.find(i => i.symbol === s);
  const sharedSet = () => { const g = {}; X.headlines.forEach(h => (g[h.story] ||= new Set()).add(h.source)); return new Set(X.headlines.filter(h => g[h.story].size > 1)); };
  const leanTally = () => { const t = { left: 0, center: 0, right: 0, wire: 0 }; X.headlines.forEach(h => t[LEAN_GROUP[h.lean] || 'wire']++); return t; };
  // The Depth registry. Each desk: a 2–3 word name, one finding, a column (VIEWS.desk) and, optionally, a globe
  // gesture (gesture) or a stage chart (STAGES). A desk with no data for this edition simply isn't listed.
  const sign = v => (v >= 0 ? '+' : '−');
  const energyRow = k => (DP?.energy?.rows || []).find(r => r.key === k);
  const weekSay = r => Math.abs(r.change) < .05 ? 'Flat on the week' : `${r.change >= 0 ? 'Up' : 'Down'} ${Math.abs(r.change).toLocaleString('en-US', { maximumFractionDigits: 1 })} on the week`;
  const seasonSay = r => { const s2 = r.seasonal; if (!s2) return ''; const d = (r.value / s2.avg - 1) * 100; return Math.abs(d) < 2 ? 'close to normal for this week of the year' : `${Math.abs(d).toFixed(0)}% ${d > 0 ? 'above' : 'below'} the five-year average for this week`; };
  const AFX = { 'USD/ZAR': 'South Africa', 'USD/NGN': 'Nigeria', 'USD/EGP': 'Egypt', 'USD/KES': 'Kenya' };
  const DESK_LIST = [
    { key: 'regime', name: 'Today’s market mood', has: () => KD?.regime?.axes?.length, meta: 'Five measures of whether investors are reaching for risk or pulling back',
      find: () => `${(KD.regime.title || 'Not measured').replace(/^./, c => c.toUpperCase())}. ${KD.regime.gloss || ''}`.trim() },
    { key: 'outliers', name: 'Unusual moves', has: () => DP?.outliers?.length, meta: 'Markets that moved far more than they usually do',
      find: () => { const o = DP.outliers[0]; return `${moveSay(o.label, o.move)}, about ${Math.round(o.sigma)} times a normal day.`; } },
    { key: 'together', name: 'Markets moving together', has: () => DP?.together?.length, meta: () => `Pairs that rise and fall in step, over ${DP.together[0].sessions} sessions`,
      find: () => { const t = DP.together[0]; return `${t.a} and ${t.b} move in step more than any other pair.`; } },
    { key: 'against', name: 'Stocks breaking from their group', has: () => DP?.against?.length, meta: 'Stocks that broke from their group today',
      find: () => { const a = DP.against[0]; return `${a.label} ${a.gap >= 0 ? 'beat' : 'trailed'} ${groupName(a.vs)} by ${Math.abs(a.gap).toFixed(1)} points.`; } },
    { key: 'rules', name: 'Do the usual patterns hold?', has: () => DP?.crossdesk?.results?.length, meta: () => `Textbook relationships, tested over ${DP.crossdesk.lookback} sessions`,
      find: () => `${DP.crossdesk.held} of ${DP.crossdesk.tested} textbook relationships are holding.` },
    { key: 'cost', name: 'Big tech: price vs. profit', stage: true, has: () => watchNames.length, meta: () => `${watchNames.length} big tech names, priced against profit`,
      find: () => { const t = [...watchNames].sort((a, b) => b.trailing_pe - a.trailing_pe)[0]; return `${t.label} costs ${Math.round(t.trailing_pe)} times a year of its profit.`; } },
    { key: 'energy', name: 'Oil and gas stockpiles', stage: true, has: () => DP?.energy?.rows?.length, meta: 'US stockpiles against the same week in past years',
      find: () => { const r = energyRow('crude') || DP.energy.rows[0]; return `${r.label} ${r.change >= 0 ? 'rose' : 'fell'} ${Math.abs(r.change).toFixed(1)}${r.unit.startsWith('M') ? 'M' : ''} last week, ${seasonSay(r) || 'with no seasonal comparison'}.`; } },
    { key: 'housing', name: 'US housing market', stage: true, has: () => DP?.real_estate?.rows?.length, meta: 'The national market, from the St. Louis Fed',
      find: () => { const r = DP.real_estate.rows[0]; return `${r.label}: ${r.value}${r.unit === '%' ? '%' : ' ' + r.unit}, ${r.change >= 0 ? 'up' : 'down'} ${Math.abs(r.change).toFixed(2)}${r.unit === '%' ? ' points' : ''}.`; } },
    { key: 'africa', name: 'African economies', has: () => DP?.africa?.countries?.length, meta: () => `${DP.africa.countries.length} economies and what each supplies`,
      find: () => { const fx = (DP.africa.fx || []).filter(q => q.change_pct != null).sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))[0]; return fx ? `${moveSay(fx.label, fx.change_pct)}.` : `${DP.africa.countries.length} economies on the desk.`; } },
    { key: 'sport', name: 'Sports', has: () => DP?.sporting?.rows?.length, meta: () => `${DP.sporting.rows.length} games, the books, and the tradition's picks`,
      find: () => { const g = [...DP.sporting.rows].sort((a, b) => (b.disagreement || 0) - (a.disagreement || 0))[0]; return `Books disagree most on ${g.matchup}.`; } },
    { key: 'sources', name: 'Who’s reporting what', stage: true, has: () => DP?.feeds?.length, meta: () => `${DP.feeds.length} outlets, placed left to right`,
      find: () => `Only ${sharedSet().size} of ${X.headlines.length} stories ran at more than one outlet.` },
    { key: 'record', name: 'How our calls did', stage: true, has: () => KD?.record?.claims?.length, meta: 'Every call, and what happened',
      find: () => `${KD.record.hits_dedup} of ${KD.record.graded_dedup} calls came true.` },
    { key: 'data', name: 'Where the data comes from', has: () => window.SixSevenAnalysis?.has('data'), meta: 'Every source, and what it gave this morning',
      find: () => window.SixSevenAnalysis.first('data') },
  ];
  const DESKS = DESK_LIST.filter(d => { try { return !!d.has(); } catch (e) { return false; } }).map(d => ({ ...d, meta: typeof d.meta === 'function' ? d.meta() : d.meta }));
  const DESK_BY = Object.fromEntries(DESKS.map(d => [d.key, d]));
  // ---------- Money: the flagship. Splits are fixed policy (portfolio.py); everything else is arithmetic or the record ----------
  const fmt$ = v => v == null || isNaN(v) ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
  const fmtC = v => v == null || isNaN(v) ? '—' : Math.abs(v) < 1000 ? `$${v.toFixed(2)}` : fmt$(v);
  const SEC_FIX = [];
  const secName = n => { let t = String(n || ''); for (const [re, to] of SEC_FIX) if (re.test(t)) { t = t.replace(re, to); if (!/^(iShares|Dick)/.test(to)) return t; }
    return t.replace(/\b(INC|CORP|CO|AG|LTD|PLC)\b\.?$/,'').trim().split(/\s+/).map(w => /^(ETF|broker|MSCI|ADR|AG|AI|II|III)$/.test(w) || /[a-z]/.test(w) ? w : w[0] + w.slice(1).toLowerCase()).join(' ').replace(/ & /g, ' & '); };
  const usdCents = v => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;
  const monthName = ym => new Date(ym + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const fmtK = v => v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : fmt$(v);
  // Money's opening answers three things in order: what comes first, the read's view of today, and where new cash goes.
  // It speaks Orbit's words: a market by its plain name, a level with its unit, the reader's own rule quoted as written.
  const MSAY = { '10-Year Treasury': 'The 10-year yield', '30-Year': 'The 30-year yield', '3-Month': 'The 3-month yield', 'Semiconductors': 'Chip stocks', 'Dollar Index': 'The dollar' };
  const mInst = sym => X.instruments.find(i => i.symbol === sym);
  const mLabel = sym => mInst(sym)?.label || sym;
  const mName = sym => MSAY[mLabel(sym)] || mLabel(sym);
  const mRate = sym => /Treasury|Year|Month/.test(mInst(sym)?.label || '');
  const mLvl = (v, sym) => mRate(sym) ? `${v.toFixed(2)}%` : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2);
  const mRule = s => (s || '').replace(/\s+--\s+/g, ' — ').trim();
  const lower1 = s => s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
  const CLEAR = { '>': 'at or below', '>=': 'below', '<': 'at or above', '<=': 'above' };
  // Tripped rules, with the full watch record (level, line, series) when the deck carries it.
  function moneyTrip() {
    const all = KD?.tripwires || [], rules = MONEY?.decision?.tripwire_effect?.rules || all.filter(w => w.state === 'tripped');
    const ws = rules.map(r => all.find(w => w.label === r.label) || r);
    return ws.length ? { w: ws[0], all: ws } : null;
  }
  function tripSay(w) {
    const nm = mName(w.symbol);
    if (w.type === 'threshold' && typeof w.value === 'number' && typeof w.line === 'number')
      return { title: `${nm} crossed a line.`, body: `It closed at ${mLvl(w.value, w.symbol)}, ${/</.test(w.operator || '') ? 'below' : 'above'} the ${mLvl(w.line, w.symbol)} line you set${w.sessions_met > 1 ? `, ${w.sessions_met} sessions running` : ''}.`,
        clear: CLEAR[w.operator] ? `Clears when it closes ${CLEAR[w.operator]} ${mLvl(w.line, w.symbol)}.` : null };
    if (w.type === 'streak') return { title: `${nm} hit your streak.`, body: w.streak ? `${w.streak} up days in a row.` : (w.if || ''), clear: null };
    if (w.type === 'range_break') return { title: `${nm} broke out of its range.`, body: typeof w.value === 'number' ? `${mLvl(w.value, w.symbol)}, outside the last ${w.lookback} sessions.` : (w.if || ''), clear: null };
    return { title: `${w.label} went off.`, body: w.if || '', clear: null };
  }
  // The read's view of today. Wait and hold are views too; only buy/sell-type actions make it a move.
  function moneyView() {
    const C = MONEY.call, acts = C.actions || [], moves = acts.filter(a => !['wait', 'hold'].includes(a.action));
    const say = a => `${a.action[0].toUpperCase() + a.action.slice(1)} ${mLabel(a.symbol)}`;
    if (moves.length) return { move: true, title: `${say(moves[0])}.`, short: `The read: ${lower1(say(moves[0]))}.`, act: moves[0], others: moves.slice(1).map(say) };
    if (!C.written) return { title: 'No trade today.', short: 'No trade today.', body: 'The written read didn’t run for this edition, so it has no idea to offer.', others: [] };
    return { title: 'No trade today.', short: 'No trade today.', act: acts[0], body: acts[0]?.recommendation || 'The read found nothing worth acting on. Staying flat is a decision.', others: [] };
  }
  function moneyHeadline() {
    if (!MONEY) return 'Money';
    const t = moneyTrip(), v = moneyView();
    if (t) return 'Check your rule first.';
    return `${esc(v.title)}${v.others.length ? `<em>And ${v.others.length} more from the read.</em>` : ''}`;
  }
  const quotesOf = acts => [...new Set(acts.flatMap(a => a.evidence_ids || []).filter(id => typeof id === 'string' && id.startsWith('quote:')).map(id => id.slice(6)))].map(mInst).filter(Boolean);
  // A small measured line: the series, and the reader's own line across it when there is one.
  function sparkSvg(ser, line, color, w = 260, h = 46) {
    const NS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(NS, 'svg'), mk = (t, a) => { const e2 = document.createElementNS(NS, t); for (const k in a) e2.setAttribute(k, a[k]); sv.append(e2); return e2; };
    sv.setAttribute('class', 'm-spark'); sv.setAttribute('width', w); sv.setAttribute('height', h); sv.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const lo = Math.min(...ser, line ?? Infinity), hi = Math.max(...ser, line ?? -Infinity), pad = (hi - lo) * .15 || .1, Y_ = v => h - 4 - (v - lo + pad) / (hi - lo + 2 * pad) * (h - 8), X_ = i => i / (ser.length - 1) * (w - 6);
    if (line != null) mk('line', { x1: 0, x2: w - 6, y1: Y_(line), y2: Y_(line), stroke: PC.glow, 'stroke-dasharray': '2 4', 'stroke-opacity': .85 });
    mk('path', { d: ser.map((v, i) => `${i ? 'L' : 'M'}${X_(i).toFixed(1)} ${Y_(v).toFixed(1)}`).join(''), fill: 'none', stroke: color, 'stroke-width': 1.6 });
    mk('circle', { cx: X_(ser.length - 1), cy: Y_(ser.at(-1)), r: 2.6, fill: PC.hot });
    return sv;
  }
  function moneyChain(f) {
    const Mo = MONEY, t = moneyTrip(), v = moneyView(), pl = Mo.plan, pr = Mo.profile || {}, ol = el('ol', 'mchain');
    const beat = (k, title, body, when, lead) => { const li = el('li', lead ? 'lead' : ''), d = el('div', 'v'); li.append(el('span', 'k', k), d); if (title) d.append(el('b', '', title)); if (body) d.append(el('p', '', body)); if (when) d.append(el('p', 'when', when)); ol.append(li); return d; };
    if (t) {
      const s2 = tripSay(t.w), d = beat('First', s2.title, `${s2.body} Your rule: ${mRule(t.w.then)}`, s2.clear, true);
      const ser = (t.w.series || []).map(p2 => p2.close).filter(Number.isFinite);
      if (ser.length > 2) d.insertBefore(sparkSvg(ser, typeof t.w.line === 'number' ? t.w.line : null, PC.down), d.children[1] || null);
      if (t.all.length > 1) d.append(el('p', 'when', `${t.all.length - 1 === 1 ? 'One more rule' : `${t.all.length - 1} more rules`} went off too. See Now.`));
    }
    const d = beat('Today', t ? v.title : null, v.move ? v.act.recommendation : v.body, v.act?.invalidation ? `Rethink if ${lower1(v.act.invalidation).replace(/\.?$/, '.')}` : null, !t);
    if (v.others.length) d.append(el('p', 'when', `Also from the read: ${v.others.map(lower1).join(', ')}.`));
    const qs = quotesOf(v.act ? [v.act] : []);
    if (qs.length) { const ev = el('div', 'mev'); for (const i of qs.slice(0, 4)) { const bt = el('button', 'mevb'); bt.type = 'button'; bt.append(el('span', '', i.label), el('span', i.change_pct >= 0 ? 'up' : 'down', pct(i.change_pct))); bt.addEventListener('click', () => inspect('instrument', i.label)); ev.append(bt); } d.append(ev); }
    if (pl) {
      const k = key => pl.buckets.find(x => x.key === key) || { percent: 0, monthly_dollars: 0 }, [r, c, fo] = ['reserve', 'core', 'focused'].map(k);
      beat('New cash', `Hold back ${r.percent}%.`, `Put ${c.percent}% into broad funds and ${fo.percent}% into focused ideas. Of each ${fmt$(pr.monthly)} month, that’s ${fmt$(r.monthly_dollars)}, ${fmt$(c.monthly_dollars)} and ${fmt$(fo.monthly_dollars)}.`,
        `Set by the market’s mood: ${(Mo.policy.find(p => p.current)?.title || 'not measured').toLowerCase()}.`);
    } else beat('New cash', 'No split yet.', 'The market’s mood wasn’t measured, so the plan waits rather than guess.');
    f.append(ol, el('p', 'isrc mcav', 'Views, not orders. Dollar amounts come from your plan, not your accounts.'));
  }
  const MNY = MONEY && MONEY.connected ? [
    { key: 'now', name: 'Today', stage: 'm:now', meta: 'Every reason behind today’s call',
      find: () => { const t = moneyTrip(), v = moneyView(); return t ? `Check your rule first. ${v.short}` : v.title; } },
    { key: 'practice', name: 'Practice record', stage: 'm:practice', meta: 'What following the calls would have made', has: () => MONEY.practice?.trades?.length,
      find: () => { const P = MONEY.practice.summary; return `${usdCents(P.pnl)} on ${P.trades} practice buys. The S&P made ${usdCents(P.spx_pnl)} on the same dates.`; } },
    { key: 'plan', name: 'Where new money goes', stage: 'm:plan', meta: 'How the split shifts with the market’s mood',
      find: () => { const c = MONEY.policy.find(p => p.current); return c ? `${c.title}: ${c.reserve}% held back, ${c.core}% broad, ${c.focused}% focused.` : 'Seven moods, seven splits.'; } },
    { key: 'growth', name: 'How it could grow', stage: 'm:growth', meta: 'Where your contributions could lead', has: () => MONEY.growth,
      find: () => { const y = MONEY.growth.years.find(r => r.years === 10); return y ? `In 10 years: ${fmtK(y.values[0])} with no growth, ${fmtK(y.values[2])} at 7% a year.` : ''; } },
    { key: 'ideas', name: 'Open calls', meta: 'Open calls, each with its own clock',
      find: () => MONEY.ideas?.length ? `${MONEY.ideas.length} open call${MONEY.ideas.length === 1 ? '' : 's'}.` : 'No open ideas right now.' },
    { key: 'record', name: 'How our calls did', stage: 'record', meta: 'Every call, and what happened', has: () => KD?.record?.claims?.length,
      find: () => `${KD.record.hits_dedup} of ${KD.record.graded_dedup} calls came true.` },
    { key: 'income', name: 'Extra income', stage: 'm:income', meta: 'Your extra-income goal',
      find: () => { const S2 = MONEY.income?.streams || []; const a = S2.reduce((x, s3) => x + (+s3.monthly || 0) * 12, 0) + (MONEY.portfolio_income?.annual || 0); return S2.length || a ? `${fmt$(a)} of your ${fmt$(MONEY.profile?.goal)} a year.` : `Goal: ${fmt$(MONEY.profile?.goal)} a year. Add your streams to track it.`; } },
    { key: 'payouts', name: 'What your stocks pay', stage: 'm:payouts', meta: 'Dividends broker expects over the next year', has: () => MONEY.portfolio_income?.securities?.length,
      find: () => `${fmtC(MONEY.portfolio_income.annual)} a year, projected by broker.` },
    { key: 'cashflow', name: 'Money in and out', stage: 'm:cashflow', meta: 'In, out, and what’s left to invest',
      find: () => MONEY.cashflow && !MONEY.cashflow.error ? `${fmt$((MONEY.cashflow.monthly_in || 0) - (MONEY.cashflow.monthly_out || 0))} left each month.` : 'Add your monthly in and out to see what’s left.' },
    { key: 'holdings', name: 'What you own', stage: 'm:holdings', meta: 'What you own, priced each morning',
      find: () => MONEY.portfolio_holdings?.positions?.length ? `${fmt$(MONEY.portfolio_holdings.value)} across ${MONEY.portfolio_holdings.positions.length} holdings.` : MONEY.holdings?.length ? `${MONEY.holdings.length} holdings, priced this morning.` : MONEY.portfolio_income?.securities?.length ? `${MONEY.portfolio_income.securities.length} known so far, from broker’s dividend report.` : 'Add what you own to see concentration and drift.' },
  ].filter(d => !d.has || d.has()) : [];
  if (MONEY?.portfolio_holdings?.positions?.length) {
    const i = MNY.findIndex(d => d.key === 'holdings');
    if (i > 0) { const [h] = MNY.splice(i, 1); MNY.unshift({ ...h, name: 'Your money', meta: 'What you own, and what the day did to it' }); }
  }
  // What a holding did in this edition's session: your shares times the measured price change. Matched to a tracked
  // market by name (or ticker, once the import adds one); holdings we don't track are left out, never estimated.
  const holdNorm = s => String(s || '').toLowerCase().replace(/\b(inc|corp|co|ag|plc|ltd|the|holding|com)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const holdMarket = p => (p.ticker ? X.instruments.find(i => i.symbol === p.ticker) : X.instruments.find(i => { const a = holdNorm(i.label), b = holdNorm(p.name); return a && (b === a || b.startsWith(a + ' ')); })) || null;
  const holdDay = p => { const q = holdMarket(p); return q && q.price && q.change_pct != null ? p.quantity * q.price * q.change_pct / (100 + q.change_pct) : null; };
  const SESSION_DAY = (() => { const n = {}; (F.quotes || []).forEach(x => { const d = String(x.as_of || '').slice(0, 10); if (x.ok && d && /watchlist|indices|sectors/.test(x.desk)) n[d] = (n[d] || 0) + 1; });
    const d = Object.keys(n).sort((a, b) => n[b] - n[a])[0]; return d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : 'the last session'; })();
  const usdSigned = v => `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
  const MNY_BY = Object.fromEntries(MNY.map(d => [d.key, d]));
  const HORIZON = { next_session: 'the next session', week: 'a week', month: 'a month' };
  // small luminous scales for the desk columns
  function scaleSvg(w, h) { return svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: 'dscale', 'aria-hidden': 'true' }); }
  function sigmaScale(sigma, max) {
    const W = 300, H = 18, x = v => 4 + v / max * (W - 8), s = scaleSvg(W, H);
    svgEl('line', { x1: 4, x2: W - 4, y1: 9, y2: 9, class: 'ds-track' }, s);
    for (let k = 1; k <= Math.floor(max); k++) svgEl('line', { x1: x(k), x2: x(k), y1: 5, y2: 13, class: k === 1 ? 'ds-one' : 'ds-tick' }, s);
    svgEl('line', { x1: x(0), x2: x(sigma), y1: 9, y2: 9, class: 'ds-bar' }, s);
    svgEl('circle', { cx: x(sigma), cy: 9, r: 3.6, class: 'ds-end' }, s);
    return s;
  }
  function corrScale(v) {
    const W = 300, H = 18, x = q => 4 + (q + 1) / 2 * (W - 8), s = scaleSvg(W, H);
    svgEl('line', { x1: 4, x2: W - 4, y1: 9, y2: 9, class: 'ds-track' }, s);
    svgEl('line', { x1: x(0), x2: x(0), y1: 4, y2: 14, class: 'ds-one' }, s);
    svgEl('line', { x1: x(0), x2: x(v), y1: 9, y2: 9, class: v >= 0 ? 'ds-bar' : 'ds-bar neg' }, s);
    svgEl('circle', { cx: x(v), cy: 9, r: 3.6, class: v >= 0 ? 'ds-end' : 'ds-end neg' }, s);
    return s;
  }
  function pairScale(group, own, lo, hi) {
    const W = 300, H = 22, x = q => 4 + (q - lo) / (hi - lo) * (W - 8), s = scaleSvg(W, H);
    svgEl('line', { x1: 4, x2: W - 4, y1: 11, y2: 11, class: 'ds-track' }, s);
    svgEl('line', { x1: x(0), x2: x(0), y1: 5, y2: 17, class: 'ds-one' }, s);
    svgEl('line', { x1: x(group), x2: x(own), y1: 11, y2: 11, class: own >= group ? 'ds-bar' : 'ds-bar neg' }, s);
    svgEl('circle', { cx: x(group), cy: 11, r: 3.4, class: 'ds-group' }, s);
    svgEl('circle', { cx: x(own), cy: 11, r: 4.2, class: own >= group ? 'ds-end' : 'ds-end neg' }, s);
    return s;
  }
  function openDesk(key) { if (uiMode !== 'depth') setMode('depth'); if (window.SixSevenAnalysis?.has(key)) { window.SixSevenAnalysis.open(key); return; } stack = [{ view: 'depth' }]; inspect('desk', key); }

  const VIEWS = {
    index(arg) {
      const tab = arg || 'places', frag = document.createDocumentFragment();
      const tabs = el('div', 'itabs'); tabs.setAttribute('role', 'tablist');
      for (const [k, t] of [['places', `In the news\u2002${places.length}`], ['markets', `Markets\u2002${X.instruments.length}`], ['headlines', `Who reported it\u2002${X.headlines.length}`], ...(WM ? [['mood', `World mood\u2002${WM_PLACED.length}`]] : []), ...(WX ? [['weather', `Weather\u2002${WX.rows.length}`]] : [])]) {
        const b = el('button', '', t); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(k === tab));
        b.addEventListener('click', () => { stack[stack.length - 1].arg = k; renderInsp(); }); tabs.append(b);
      }
      frag.append(tabs);
      if (uiMode === 'explore') setLens(tab);
      if (tab === 'mood' && WM) {
        frag.append(el('p', 'iline', 'How each country’s news sounds today compared with its own last few days, from GDELT’s count of world coverage. It measures media, not people’s feelings.'));
        frag.append(sectionHead('Biggest shifts'));
        for (const c of (WM.top_changes || []).filter(c => c.articles >= 150).slice(0, 8)) {
          const r = rowBtn('drow', () => inspect('country', c.country)); r.append(el('b', '', c.name), el('span', 'dx-find', moodSentence(c)), el('span', 'meta', `${c.articles.toLocaleString('en-US')} stories`)); frag.append(r);
        }
        const att = WM.attention || {}, langs = { en: 'English', es: 'Spanish', de: 'German', fr: 'French', ja: 'Japanese', ru: 'Russian', zh: 'Chinese', pt: 'Portuguese', it: 'Italian', ar: 'Arabic' };
        const tops = Object.entries(att).map(([k, v]) => [k, (v || []).filter(x => !/^(Main Page|Special:|Wikipedia:|Hauptseite|Portada|Accueil)/.test(x.title))[0]]).filter(x => x[1]);
        if (tops.length) { frag.append(sectionHead('What the world is reading')); for (const [k, x] of tops.slice(0, 8)) { const r = el('a', 'irow drow'); r.href = x.url; r.target = '_blank'; r.rel = 'noopener'; r.append(el('b', '', x.title), el('span', 'meta', `${langs[k] || k} Wikipedia, ${x.views.toLocaleString('en-US')} views`)); frag.append(r); } }
        if (WM.sky?.lines?.length) frag.append(el('p', 'inote', 'The faint lines on the globe are where the Sun, Venus and Jupiter are rising, setting, overhead or underfoot today, as astrocartography draws them. That is tradition, shown beside the measurements, never mixed into them.'));
        frag.append(el('p', 'isrc', `Measured ${WM.source_day}. Baseline: the previous ${WM.baseline_days} days.`));
      } else if (tab === 'weather') {
        for (const w of [...WX.rows].sort((a, b) => b.home - a.home)) {
          const r = rowBtn('wxr', () => inspect('weather', w.label));
          r.append(el('b', '', w.home ? `${wxName(w)}, home` : wxName(w)), el('span', 'chg', `${Math.round(w.temp)}°`), el('span', 'meta', `${w.condition}${w.bears_on ? ' · ' + shortChannel(w.bears_on) : ' · where you are'}`));
          frag.append(r);
        }
        frag.append(el('p', 'isrc', wxWhen()));
      } else if (tab === 'places') {
        const max = Math.max(...places.map(p => p.count));
        for (const p of [...places].sort((a, b) => b.count - a.count)) {
          const r = rowBtn('place', () => inspect('place', p.place));
          const bar = el('i', 'cbar'); bar.style.width = `${p.count / max * 100}%`;
          r.append(el('b', '', p.place), el('span', 'meta', `${p.count} · ${(p.kinds || []).join(', ')}`), bar);
          frag.append(r);
        }
      } else if (tab === 'markets') {
        const groups = {}; X.instruments.forEach(i => (groups[i.desk] ||= []).push(i));
        for (const [desk, list] of Object.entries(groups)) {
          frag.append(sectionHead(DESK[desk] || desk));
          for (const i of list) {
            const r = rowBtn('mkt', () => inspect('instrument', i.label));
            const v = el('span', 'chg ' + (i.change_pct >= 0 ? 'pos' : 'neg'), pct(i.change_pct));
            r.append(el('b', '', i.label), spark(i.series, 64, 18), v);
            frag.append(r);
          }
        }
      } else {
        const chips = el('div', 'ichips');
        for (const [k, t] of [['all', 'All'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['straight', 'Wire']]) {
          const b = el('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(hlFilter === k));
          b.addEventListener('click', () => { hlFilter = k; renderInsp(); }); chips.append(b);
        }
        frag.append(chips);
        const tot = { left: 0, center: 0, right: 0, wire: 0 }; X.headlines.forEach(h => tot[LEAN_GROUP[h.lean] || 'wire']++);
        const cov = el('div', 'cov'); for (const k of Object.keys(tot)) { const seg = el('i'); seg.style.flex = tot[k]; seg.style.background = LEAN_COL[k]; seg.style.color = LEAN_COL[k]; cov.append(seg); }
        frag.append(cov, el('p', 'cov-cap', `Left ${tot.left} · Center ${tot.center} · Right ${tot.right} · Wire ${tot.wire}`));
        const match = h => hlFilter === 'all' || (hlFilter === 'left' ? /left/.test(h.lean) : hlFilter === 'right' ? /right/.test(h.lean) : h.lean === hlFilter);
        const multi = Object.values(byStory).filter(g => g.length > 1);
        if (hlFilter === 'all' && multi.length) {
          frag.append(sectionHead('Widely covered'));
          for (const g of multi) { const h = g[0]; const r = rowBtn('hl', () => inspect('headline', h.i)); r.append(el('b', '', h.title), el('span', 'meta', `${g.length} outlets · ${[...new Set(g.map(x => x.source))].slice(0, 3).join(', ')}`)); frag.append(r); }
          frag.append(sectionHead('All stories'));
        }
        for (const h of X.headlines.filter(match)) {
          const r = rowBtn('hl', () => inspect('headline', h.i));
          const dot = el('i', 'ldot ' + (h.lean || '')); dot.title = LEAN_LABEL[h.lean] || '';
          const m = el('span', 'meta'); m.append(dot, document.createTextNode(h.source + (h.place ? ` · ${h.place}` : '')));
          r.append(el('b', '', h.title), m); frag.append(r);
        }
      }
      return frag;
    },
    read() {
      const f = document.createDocumentFragment();
      f.append(el('span', 'label', `The read · ${M.long}`), el('h2', 'ititle', `${B.headline[0]} ${B.headline[1] || ''}`.trim()));
      if (E.read) {
        const stars = +(E.confidence?.stars || 0);
        f.append(el('p', 'imeta', `Confidence ${['none', 'low', 'moderate', 'high'][Math.max(0, Math.min(3, stars))]} · ${E.independent_support ?? 0} of ${E.sources_total ?? '?'} sources back it independently`));
        f.append(el('p', 'iprose', E.read));
        for (const [t, v] of [['The case against', E.counterpoint], ['Markets', E.markets_gloss], ['Since yesterday', E.since_yesterday], ['Next test', E.next_test]]) if (v) f.append(sectionHead(t), el('p', 'iprose sm', v));
      } else {
        f.append(el('p', 'iprose', 'No written read for this edition. The model desk didn’t run, so the chapters tell the day from measured data alone.'));
        if (E.next_test) f.append(sectionHead('Next test'), el('p', 'iprose sm', E.next_test));
      }
      if (KD?.tripwires) {
        f.append(sectionHead('Your tripwires'));
        for (const w of KD.tripwires) { const r = el('div', 'irow static'); r.append(el('b', '', w.label), el('span', 'state ' + w.state, ({ tripped: 'Went off', holding: 'Not yet', within_reach: 'Close' })[w.state])); f.append(r); }
      }
      return f;
    },
    depth() {
      const f = document.createDocumentFragment();
      const nums = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
      f.append(el('span', 'label', `Analysis\u2003${M.long}`), el('h2', 'ititle', `What the data shows`));
      const checks = DESKS.filter(d => d.key !== 'data').length;
      f.append(el('p', 'iline', `${nums[checks] || checks} checks run every morning, and what each found today. Pick one to see it on the globe.`));
      for (const d of DESKS) { const r = rowBtn('dx', () => (window.SixSevenAnalysis?.has(d.key) ? window.SixSevenAnalysis.open(d.key) : inspect('desk', d.key))); r.append(el('b', '', d.name), el('span', 'dx-find', d.find()), el('span', 'meta', d.meta)); f.append(r); }
      f.append(el('p', 'isrc', `Every figure is the one this edition measured, ${M.long}.`));
      depthScene(null);
      return f;
    },
    desk(key) {
      const d = DESK_BY[key], f = document.createDocumentFragment(); if (!d) return f;
      f.append(el('span', 'label', 'Analysis'), el('h2', 'ititle', d.name));
      const line = html => { const p = el('p', 'iline'); p.innerHTML = html; f.append(p); };
      const row = (title, find, meta, chart, onClick) => { const r = onClick ? rowBtn('drow', onClick) : el('div', 'irow drow static'); r.append(el('b', '', title)); if (find) r.append(el('span', 'dx-find', find)); if (chart) r.append(chart); if (meta) r.append(el('span', 'meta', meta)); f.append(r); };
      if (key === 'regime') {
        line(KD.regime.gloss || 'Five measures, each scored from today’s own numbers.');
        f.append(sectionHead('The five measures'));
        for (const a of KD.regime.axes || []) { const say = AXIS_SAY[a.axis] || [a.axis, 'risk-off', 'risk-on']; row(say[0], Math.abs(a.value) < .15 ? 'Neutral' : a.value < 0 ? `Leaning ${say[1]}` : `Leaning ${say[2]}`, a.detail); }
        f.append(el('p', 'inote', 'This describes today, the way a thermometer does. It doesn’t forecast tomorrow.'));
      } else if (key === 'outliers') {
        const max = Math.ceil(Math.max(...DP.outliers.map(o => o.sigma)));
        line(`A normal day is small for each of these. Today each moved <b>${Math.min(...DP.outliers.map(o => o.sigma)).toFixed(1)} to ${Math.max(...DP.outliers.map(o => o.sigma)).toFixed(1)} times</b> its usual daily swing.`);
        f.append(sectionHead('Today'));
        for (const o of DP.outliers) {
          const i = inst[o.label], where = o.home ? o.home.place : 'No place on the globe: Kenya isn’t in the place list yet';
          row(sayName(o.label), `${moveSay(o.label, o.move)}. A usual day is ${o.typical.toFixed(2)}%.`, `${o.sigma.toFixed(1)}× usual · ${where}`, sigmaScale(o.sigma, max), i ? () => inspect('instrument', o.label) : null);
          if (o.label === 'Coffee') f.append(el('p', 'inote tight', 'This drop may be the futures contract rolling to a later month rather than a real fall. Not verified.'));
        }
        f.append(el('p', 'inote', `Each is measured against its own last ${Math.min(...DP.outliers.map(o => o.sessions))} or more sessions. Size alone isn’t a reason. It tells you where to look.`));
      } else if (key === 'together') {
        line(`Over the last <b>${DP.together[0].sessions} sessions</b>, these pairs rose and fell together most often. 1.0 would be lockstep; 0 is no link at all.`);
        const route = t => t.ha && t.hb ? (t.ha.place === t.hb.place ? `Both based in ${t.ha.place}` : `${t.ha.place} ↔ ${t.hb.place}`) : '';
        f.append(sectionHead('Most in step'));
        DP.together.filter(t => !t.opposite).forEach(t => row(`${t.a} and ${t.b}`, null, `${t.corr >= 0 ? '+' : '−'}${Math.abs(t.corr).toFixed(2)} · ${route(t)}`, corrScale(t.corr)));
        f.append(sectionHead('Most opposite'));
        DP.together.filter(t => t.opposite).forEach(t => row(`${t.a} and ${t.b}`, null, `${t.corr >= 0 ? '+' : '−'}${Math.abs(t.corr).toFixed(2)} · ${route(t)}`, corrScale(t.corr)));
        f.append(el('p', 'inote', 'Moving together isn’t one causing the other. The arcs join where each company is based.'));
      } else if (key === 'against') {
        const all = DP.against.flatMap(a => [a.move, a.vs_move, 0]), lo = Math.floor(Math.min(...all)) - .5, hi = Math.ceil(Math.max(...all)) + .5;
        line('Each of these moved well away from the group it usually travels with. The faint dot is the group; the bright one is the stock.');
        for (const a of DP.against) row(`${a.label} ${a.gap >= 0 ? 'beat' : 'trailed'} ${groupName(a.vs)}`, `${a.label} ${signed(a.move)} against ${signed(a.vs_move)} for ${groupName(a.vs)}.`, `${a.gap >= 0 ? '+' : '−'}${Math.abs(a.gap).toFixed(2)} points${a.home ? ' · ' + a.home.place : ''}`, pairScale(a.vs_move, a.move, lo, hi), () => inspect('instrument', a.label));
        f.append(el('p', 'inote', 'The record has the prices, not the reasons. Check the news before guessing why.'));
      } else if (key === 'cost') {
        line('How much you pay for each dollar a company earned last year, and how far its price has run above its <b>200-day average</b>. Size is company value.');
        const by = [...watchNames].sort((a, b) => b.trailing_pe - a.trailing_pe), run = i => (i.price / i.sma_200 - 1) * 100;
        f.append(sectionHead('Most expensive'));
        by.slice(0, 3).forEach(i => row(i.label, `${Math.round(i.trailing_pe)} times a year of profit, ${Math.abs(run(i)).toFixed(0)}% ${run(i) >= 0 ? 'above' : 'below'} its 200-day.`, null, null, () => inspect('instrument', i.label)));
        f.append(sectionHead('Cheapest'));
        by.slice(-3).reverse().forEach(i => row(i.label, `${i.trailing_pe.toFixed(1)} times a year of profit, ${Math.abs(run(i)).toFixed(0)}% ${run(i) >= 0 ? 'above' : 'below'} its 200-day.`, null, null, () => inspect('instrument', i.label)));
        f.append(el('p', 'inote', 'Price against past profit. Fast growers usually cost more, so a high number isn’t a verdict on its own.'));
      } else if (key === 'rules') {
        const C = DP.crossdesk;
        line(`Each of these was written down in advance with the reason it should hold. <b>${C.held} of ${C.tested}</b> are holding over the last ${C.lookback} sessions. A broken rule of thumb is often the most useful thing here.`);
        const VERD = { strong: 'Holding strongly', holds: 'Holding', 'not showing': 'Not showing up', inverted: 'Running backwards' };
        for (const k of [true, false]) {
          const list = C.results.filter(r => !!r.held === k); if (!list.length) continue;
          f.append(sectionHead(k ? 'Holding' : 'Not holding'));
          for (const r of list) row(r.label, r.why, `${VERD[r.verdict] || r.verdict} · expected ${r.expected > 0 ? 'together' : 'opposite'} · ${sign(r.r)}${Math.abs(r.r).toFixed(2)} over ${r.sample} sessions`, corrScale(r.r));
        }
      } else if (key === 'energy') {
        line('US stockpiles from the EIA. A level means little alone, so each is set against the same week in the last five years.');
        for (const r of DP.energy.rows) row(r.label, `${r.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${r.unit}, ${weekSay(r).toLowerCase()}. ${seasonSay(r) ? seasonSay(r)[0].toUpperCase() + seasonSay(r).slice(1) + '.' : ''}`, r.bears_on ? `Week of ${r.period} · ${r.bears_on}` : `Week of ${r.period}`);
        f.append(el('p', 'inote', 'A stockpile that builds when it usually draws is the signal. Weather on the Gulf is one possible reason, never proof.'));
      } else if (key === 'housing') {
        line('The national market, not any one city. Each is the latest reading from the St. Louis Fed against the one before.');
        for (const r of DP.real_estate.rows) { const better = r.lower_is_better ? r.change < 0 : r.change > 0; row(r.label, `${houseNum(r)}${r.unit !== '%' && r.unit !== 'K' ? ' ' + r.unit : ''}, ${houseChange(r).toLowerCase()}. ${r.change === 0 ? '' : better ? 'Better for buyers.' : 'Worse for buyers.'}`, `${r.caption} · as of ${r.as_of}`); }
      } else if (key === 'africa') {
        const A = DP.africa;
        line(`Why each economy matters to markets, with growth and inflation from the World Bank (${A.source_year}, annual). Today's currency moves are live; the rest is structure.`);
        if (A.fx?.length) { f.append(sectionHead('Currencies today')); for (const q of A.fx) row(FX_NAME[q.label] ? FX_NAME[q.label][0].toUpperCase() + FX_NAME[q.label].slice(1) : q.label, `${moveSay(q.label, q.change_pct)}.`, AFX[q.label] || ''); }
        f.append(sectionHead('Economies'));
        for (const c of A.countries) row(c.name, c.carries, `Growth ${c.growth != null ? c.growth.toFixed(1) + '%' : 'n/a'} · inflation ${c.inflation != null ? c.inflation.toFixed(1) + '%' : 'n/a'} · ${c.growth_year || ''}`);
        f.append(el('p', 'inote', 'The yearly figures explain why a currency move matters. They don’t explain today’s move.'));
      } else if (key === 'sport') {
        line('The books’ consensus on each game, and how far apart they are. Where they disagree is where a reader might look. No picks from the books here.');
        for (const g of DP.sporting.rows) row(g.matchup, `Books favor ${g.favourite}. ${g.books} books, ${g.disagreement > 2 ? 'split' : 'mostly agreed'}.`, `${g.sport} · ${new Date(g.commence).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET`);
        const AP = DP.astro_picks;
        if (AP?.picks?.length) {
          f.append(sectionHead('The tradition’s picks'));
          for (const p of AP.picks) row(`${p.picked} over ${p.opponent}`, p.reasoning, `${p.sport} · ${p.agreed_with_market ? 'agrees with the books' : 'against the books'} · margin ${p.margin.toFixed(1)}`);
          f.append(el('p', 'inote', `Score so far: ${AP.record.hits} of ${AP.record.graded} graded, ${AP.record.n} made. These systems have no shown power over sport; the score is kept so you can check. Picks older than three days can’t be graded, so the brief needs to run most days.`));
        }
      } else if (key === 'sources') {
        const t = leanTally(), cnt = {}; X.headlines.forEach(h => cnt[h.source] = (cnt[h.source] || 0) + 1);
        const live = DP.feeds.filter(fd => cnt[fd.name]).length;
        line(`<b>${live} of ${DP.feeds.length}</b> outlets had stories in this edition, <b>${X.headlines.length}</b> in all. Only <b>${sharedSet().size}</b> ran at more than one outlet. Each line is one outlet’s stories, up to six a run; the lit part is what someone else carried too.`);
        f.append(sectionHead('By lean'));
        const cov = el('div', 'cov'); for (const k of Object.keys(t)) { const seg = el('i'); seg.style.flex = t[k]; seg.style.background = LEAN_COL[k]; seg.style.color = LEAN_COL[k]; cov.append(seg); }
        f.append(cov, el('p', 'cov-cap', `Left ${t.left} · Center ${t.center} · Right ${t.right} · Wire ${t.wire}`));
        f.append(sectionHead('Most stories'));
        Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([n, c]) => { const fd = DP.feeds.find(x => x.name === n); row(n, null, `${c} stor${c === 1 ? 'y' : 'ies'} · ${LEAN_LABEL[fd?.lean] || 'Wire'}`); });
        f.append(el('p', 'inote', 'Lean labels follow AllSides and Ad Fontes. They aren’t filters: a story every side carries is a fact, and a story only one side carries is a choice.'));
        f.append(el('p', 'inote', 'Feeds whose newest story is more than four days old are dropped. A frozen WSJ feed once served an 18-month-old headline as news for weeks.'));
      } else if (key === 'record' && KD) {
        const R = KD.record;
        line(`<b>${R.hits_dedup} of ${R.graded_dedup}</b> calls came true, each counted once. A coin flip gets about half.`);
        f.append(sectionHead('Every call'));
        R.claims.filter(c => !c.duplicate).forEach(c => {
          const i = bySymbol(c.symbol), name = i ? sayName(i.label) : c.symbol;
          row(`${name} ${c.direction}`, `Called ${new Date(c.made_on + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} for ${HORIZON[c.horizon] || c.horizon}. It ${c.move_pct >= 0 ? 'rose' : 'fell'} ${Math.abs(c.move_pct).toFixed(2)}%.`, c.correct === 1 ? 'Right' : c.correct === 0 ? 'Wrong' : 'Still open', null, i ? () => inspect('instrument', i.label) : null);
        });
        if (R.days_quiet != null) f.append(el('p', 'inote', R.days_quiet > 7 ? `No new calls in the ${R.days_quiet} days before this edition.` : R.days_quiet === 0 ? 'A new call was made today.' : `Last call ${R.days_quiet} day${R.days_quiet === 1 ? '' : 's'} before this edition.`));
        f.append(el('p', 'inote', `Astro picks: ${R.astro.hits || 0} of ${R.astro.graded || 0} graded came true, ${R.astro.n} made. A pick can only be graded within three days, so the brief needs to run most days.`));
      }
      depthScene(key);
      return f;
    },
    money() {
      const f = document.createDocumentFragment(), Mo = MONEY;
      f.append(el('span', 'label', `Money · ${M.long}`));
      if (!Mo) {
        if (M.status?.money === 'private') {
          f.append(el('h2', 'ititle', 'Money is private.'), el('p', 'iline', 'Shared editions leave it out entirely: no plan, no figures, no personal call.'));
        } else {
          f.append(el('h2', 'ititle', 'Not kept for this edition.'), el('p', 'iline', M.status?.money === 'missing_run_snapshot' ? 'This edition is older than Money’s daily record. Rebuilding it would mean using today’s numbers for an old date, so it stays empty.' : 'Money didn’t run for this edition.'));
        }
        depthScene(null); return f;
      }
      if (!Mo.connected) {
        f.append(el('h2', 'ititle', 'No plan set up.'), el('p', 'iline', 'Money needs your plan for new cash: what you start with, what you add each month, and the rules you invest by. It stays on this Mac.'));
        depthScene(null); return f;
      }
      const head = el('h2', 'ititle money'); head.innerHTML = moneyHeadline(); f.append(head);
      moneyChain(f);
      f.append(sectionHead('Your money'));
      for (const d of MNY) { const r = rowBtn('dx', () => inspect('mny', d.key)); r.append(el('b', '', d.name), el('span', 'dx-find', d.find()), el('span', 'meta', d.meta)); f.append(r); }
      f.append(el('p', 'isrc', Mo.actions_meta?.note || ''));
      depthScene('m:now');
      return f;
    },
    country(code) {
      const f = document.createDocumentFragment(), c0 = WM_LIST.find(x => x.country === code); if (!c0) return f;
      const c = { ...c0, ...(WM_CH[code] || {}) }, pl = WM_PLACED.find(x => x.country === code), al = pl && skyLineNear(pl.lat, pl.lon);
      f.append(el('span', 'label', 'The world’s mood'), el('h2', 'ititle', c.name), el('p', 'iline', moodSentence(c)));
      const row = (a, b2, m) => { const r = el('div', 'irow drow static'); r.append(el('b', '', a), el('span', 'dx-find', b2)); if (m) r.append(el('span', 'meta', m)); f.append(r); };
      row('Stories today', c.articles.toLocaleString('en-US'), typeof c.articles_vs_baseline_pct === 'number' ? `${c.articles_vs_baseline_pct > 0 ? '+' : ''}${Math.round(c.articles_vs_baseline_pct)}% against the last ${c.baseline_days || WM.baseline_days} days` : null);
      row('Tone of coverage', `${c.tone > 0 ? '+' : ''}${c.tone.toFixed(2)}`, typeof c.tone_vs_baseline === 'number' ? `${c.tone_vs_baseline > 0 ? '+' : ''}${c.tone_vs_baseline.toFixed(2)} against usual (GDELT scale, about −10 to +10)` : 'GDELT scale, about −10 to +10');
      row('Events reported', `${c.protest} protests, ${c.conflict} conflict, ${c.cooperation} cooperation`, `${c.disaster_mentions} disaster mentions`);
      if (al) f.append(el('p', 'inote', `By tradition, ${al.body} is ${ANGLE_SAY[al.angle]} over ${c.name} today (its ${al.angle} line, about ${Math.round(al.d)}° away). Astrocartography is tradition, shown beside the measurement and never mixed into it.`));
      const ev = [...new Set((c.evidence || []).concat(c.event_evidence || []).flatMap(x => String(x).split('<UDIV>')))].slice(0, 4);
      if (ev.length) { f.append(sectionHead('Sample coverage')); for (const u of ev) { const a = el('a', 'irow drow'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep raw */ } a.append(el('b', '', host), el('span', 'meta', 'opens the article')); f.append(a); } }
      f.append(el('p', 'isrc', (WM.limitations || [])[0] || ''));
      return f;
    },
    mny(key) {
      const d = MNY_BY[key], f = document.createDocumentFragment(), Mo = MONEY; if (!d) return f;
      f.append(el('span', 'label', 'Money'), el('h2', 'ititle', d.name));
      const line = html => { const p = el('p', 'iline'); p.innerHTML = html; f.append(p); };
      const row = (title, find, meta, onClick) => { const r = onClick ? rowBtn('drow', onClick) : el('div', 'irow drow static'); r.append(el('b', '', title)); if (find) r.append(el('span', 'dx-find', find)); if (meta) r.append(el('span', 'meta', meta)); f.append(r); };
      const pr = Mo.profile || {}, cur = Mo.policy.find(p => p.current), plan = Mo.plan;
      if (key === 'now') {
        const t = moneyTrip(), v = moneyView(), D = Mo.decision;
        if (t) {
          f.append(sectionHead(t.all.length > 1 ? `First: ${t.all.length} rules went off` : 'First: your rule'));
          t.all.forEach((w, i) => {
            const s2 = tripSay(w); row(s2.title, s2.body, w.label);
            f.append(el('p', 'iprose sm', `Your rule: ${mRule(w.then)}`));
            const when = i === 0 && D?.next_step?.source === 'standing_watch' ? D.next_step.reconsider_when : s2.clear;
            if (when) f.append(el('p', 'inote tight', `Clears ${lower1(when.replace(/^Clears\s+/, ''))}`));
          });
        }
        f.append(sectionHead('Today’s view'));
        if (v.move) for (const a of (Mo.call.actions || []).filter(a => !['wait', 'hold'].includes(a.action))) {
          const p = el('p', 'iline'); p.innerHTML = `<b>${esc(a.action[0].toUpperCase() + a.action.slice(1))} ${esc(mLabel(a.symbol))}.</b> ${esc(a.recommendation || '')}`; f.append(p);
          if (a.invalidation) f.append(el('p', 'inote tight', `Rethink if ${lower1(a.invalidation).replace(/\.?$/, '.')}`));
        } else { const p = el('p', 'iline'); p.innerHTML = `<b>No trade today.</b> ${esc(v.body)}`; f.append(p); if (v.act?.invalidation) f.append(el('p', 'inote tight', `Rethink if ${lower1(v.act.invalidation).replace(/\.?$/, '.')}`)); }
        const acts = Mo.call.actions || [], qs = quotesOf(acts), other = acts.flatMap(a => a.evidence_ids || []).filter(id => !(typeof id === 'string' && id.startsWith('quote:')));
        for (const i of qs) row(i.label, `${pct(i.change_pct)} on the day`, 'Open the market', () => inspect('instrument', i.label));
        if (other.length) f.append(el('p', 'inote tight', `The read also drew on ${other.length === 1 ? 'one other source' : `${other.length} other sources`} from this edition.`));
        f.append(sectionHead('New cash'));
        if (plan) {
          f.append(el('p', 'iprose sm', 'For money you add from here. It doesn’t touch what you already hold.'));
          for (const k of plan.buckets) row(`${k.label} · ${k.percent}%`, k.note, `${fmt$(k.ready_dollars)} of the ${fmt$(pr.ready)} you start with · ${fmt$(k.monthly_dollars)} of each ${fmt$(pr.monthly)} month`);
          f.append(el('p', 'iprose sm', `The market’s measured mood today: ${cur ? cur.title.toLowerCase() : 'not measured'}. In that mood the plan holds back ${cur?.reserve ?? plan.buckets[0].percent}% and keeps ${cur?.focused ?? plan.buckets[2].percent}% for focused ideas.`));
        } else f.append(el('p', 'iprose', 'No split for new cash today: the market’s mood wasn’t measured. The plan waits rather than guess.'));
        const close = (KD?.tripwires || []).filter(w => w.state === 'within_reach');
        if (close.length) { f.append(sectionHead('Close to going off')); for (const w of close) row(w.label, mRule(w.then), 'Close'); }
        const nxt = (KD?.calendar || []).find(e => e.tier === 1);
        if (nxt) { f.append(sectionHead('Coming up')); row(`${nxt.name}, ${nxt.days_away === 0 ? 'today' : nxt.days_away === 1 ? 'tomorrow' : `in ${nxt.days_away} days`}`, nxt.why, 'Scheduled'); }
        const SAID = new Set(['planned_cash_unverified', 'written_market_action_missing', 'measured_regime_missing']);
        const gaps = (D?.limitations || []).filter(l => !SAID.has(l));
        if (gaps.length) { f.append(sectionHead('Missing')); for (const l of gaps) f.append(el('p', 'inote tight', l === 'planning_profile_missing' ? 'No plan is set up, so there’s no new-cash split.' : 'One input for this call is missing.')); }
        f.append(el('p', 'inote', 'Views, not orders. Dollar amounts come from your plan, not your accounts. The split changes when the market’s measured mood changes, not because one headline feels important.'));
      } else if (key === 'plan') {
        line('A plan for <b>new cash only</b>, never your whole portfolio. The split is fixed policy that shifts with the market’s measured mood; the dollars are arithmetic on your plan.');
        f.append(sectionHead('Three buckets'));
        for (const k of (plan?.buckets || [])) row(k.label, k.note);
        f.append(sectionHead('By the market’s mood'));
        for (const p of Mo.policy) row(`${p.title}${p.current ? ' · today' : ''}`, `${p.reserve}% reserve · ${p.core}% core · ${p.focused}% focused`, p.posture);
        f.append(sectionHead('Ground rules'));
        row('Allowed', (pr.allowed || []).map(x => ({ etfs: 'ETFs', spot_crypto: 'spot crypto' })[x] || x.replace(/_/g, ' ')).join(', '));
        row('Never', (pr.prohibited || []).map(x => x.replace(/_/g, ' ')).join(', '));
        if (pr.goal) row('Income goal', `${fmt$(pr.goal)} a year in extra income. An ambition, not a return the plan chases.`);
        if (pr.formal_debt != null) row('Debt', pr.formal_debt ? fmt$(pr.formal_debt) : 'None');
        if (pr.family_obligation) row('Family', pr.family_obligation);
      } else if (key === 'growth' && Mo.growth) {
        const G = Mo.growth;
        line(`These paths start with <b>${fmt$(G.held_value)} already held</b> plus <b>${fmt$(pr.ready)} of planned cash</b>, then add <b>${fmt$(pr.monthly)} a month</b>. Scenarios, not forecasts.`);
        for (const y of G.years) row(`${y.years} year${y.years === 1 ? '' : 's'}`, `${fmt$(y.values[0])} with no growth · ${fmt$(y.values[1])} at 4% · ${fmt$(y.values[2])} at 7%`);
        const target = pr.goal ? pr.goal / .04 : null;
        if (target) {
          const hitAt = r => { const c = G.curve.find(c2 => c2.values[r] >= target); return c ? c.month / 12 : null; };
          f.append(sectionHead('Your income goal'), el('p', 'iprose sm', `A pile of about ${fmt$(target)} could pay ${fmt$(pr.goal)} a year at a 4% draw, a common rule of thumb. On this plan you’d reach it in about ${[[2, '7%'], [1, '4%'], [0, 'contributions alone']].map(([i, t]) => hitAt(i) != null ? `${Math.round(hitAt(i))} years at ${t}`.replace('at contributions alone', 'from contributions alone') : null).filter(Boolean).join(', ')}.`));
        }
        f.append(el('p', 'inote', G.note));
      } else if (key === 'ideas') {
        const I = Mo.ideas || [];
        line(I.length ? `${I.length} open call${I.length === 1 ? '' : 's'}, each graded when its window closes.` : 'No open ideas right now. A focused idea only goes in when its reason, time frame and exit are written down.');
        for (const c of I) { const i = X.instruments.find(x => x.symbol === c.symbol); row(`${i ? i.label : c.symbol} ${c.direction}`, `Called ${c.made_on} for ${HORIZON[c.horizon] || c.horizon}, due ${c.due_on}.${c.since_pct != null ? ` Since then: ${signed(c.since_pct)}.` : ''}`, 'Open', i ? () => inspect('instrument', i.label) : null); }
        f.append(el('p', 'inote', 'Ideas come from the written read, which names a market, a direction and a time frame. Python grades every one; the score is in The record.'));
      } else if (key === 'record' && KD) {
        const R = KD.record;
        line(`<b>${R.hits_dedup} of ${R.graded_dedup}</b> calls came true, each counted once. A coin flip gets about half.`);
        R.claims.filter(c => !c.duplicate).forEach(c => { const i = bySymbol(c.symbol), nm = i ? sayName(i.label) : c.symbol; row(`${nm} ${c.direction}`, `Called ${c.made_on} for ${HORIZON[c.horizon] || c.horizon}.${c.move_pct != null ? ` It ${c.move_pct >= 0 ? 'rose' : 'fell'} ${Math.abs(c.move_pct).toFixed(2)}%.` : ''}`, c.correct === 1 ? 'Right' : c.correct === 0 ? 'Wrong' : 'Still open'); });
      } else if (key === 'income') {
        const S2 = Mo.income?.streams || [], div = Mo.portfolio_income?.annual || 0, annual = S2.reduce((a, s3) => a + (+s3.monthly || 0) * 12, 0) + div;
        line(`Your goal: <b>${fmt$(pr.goal)} a year</b> in extra income, on top of what you earn now. ${annual ? `You’re at <b>${fmtC(annual)}</b>.` : 'Nothing coming in yet.'}`);
        if (div) row('Dividends', `${fmtC(div)} a year, broker’s projection from your holdings.`, null, () => inspect('mny', 'payouts'));
        for (const s3 of S2) row(s3.name, `${fmt$(s3.monthly)} a month${s3.since ? `, since ${s3.since}` : ''}.`, s3.status || '');
        if (!S2.length) f.append(el('p', 'inote', 'Other income, like work on the side, isn’t set up yet. When it is, it stays on this Mac.'));
      } else if (key === 'cashflow') {
        const C = Mo.cashflow;
        if (C && !C.error) { const left = (C.monthly_in || 0) - (C.monthly_out || 0); line(`<b>${fmt$(C.monthly_in)}</b> in, <b>${fmt$(C.monthly_out)}</b> out each month, <b>${fmt$(left)}</b> left. Your plan puts in ${fmt$(pr.monthly)} of it.`); for (const c of (C.categories || [])) row(c.name, `${fmt$(c.monthly)} a month`); }
        else { line('What comes in, what goes out, and what’s left to invest each month.'); f.append(el('p', 'inote', 'Not set up yet. It needs your monthly money in and out, from your bank, and it stays on this Mac.')); }
      } else if (key === 'holdings' && Mo.portfolio_holdings?.positions?.length) {
        const PH = Mo.portfolio_holdings, when = String(PH.as_of || '').replace(/ 0(\d)/, ' $1');
        line(`<b>${fmt$(PH.value)}</b> across ${PH.positions.length} holdings and ${fmtC(PH.cash)} in cash, as of ${esc(when)}. You paid <b>${fmt$(PH.cost)}</b>; it’s up <b>${fmt$(PH.gain)}</b>.`);
        const REG = { US: 'United States', Global: 'Global', International: 'International', 'Non-Traditional': 'Other' };
        for (const [r, nm] of Object.entries(REG)) {
          const rows = PH.positions.filter(x => x.region === r).sort((a, b2) => b2.value - a.value); if (!rows.length) continue;
          f.append(sectionHead(`${nm}, ${fmt$(PH.by_region?.[r] ?? rows.reduce((a, x) => a + x.value, 0))}`));
          for (const x of rows) { const dv = holdDay(x), mk = holdMarket(x), sh = +x.quantity;
            row(secName(x.name), `${fmt$(x.value)}, ${x.pct_portfolio < 1 ? x.pct_portfolio.toFixed(1) : Math.round(x.pct_portfolio)}% of everything. ${sh} share${sh === 1 ? '' : 's'} at an average ${fmtC(x.avg_price)}; ${x.gain >= 0 ? 'up' : 'down'} ${fmt$(Math.abs(x.gain))} since you bought.${dv != null ? ` ${usdSigned(dv)} on ${SESSION_DAY}.` : ''}`, null, mk ? () => inspect('instrument', mk.label) : null); }
        }
        f.append(el('p', 'inote', 'Values are broker’s, from your Portfolio Holdings report. Day changes use your share counts and that day’s measured prices, for the holdings Six Seven tracks.'));
      } else if (key === 'payouts' && Mo.portfolio_income) {
        const PI = Mo.portfolio_income;
        line(`broker expects your holdings to pay <b>${fmtC(PI.annual)}</b> over the next twelve months, about ${fmtC(PI.monthly_average)} a month. A projection, not money received.`);
        f.append(sectionHead('Month by month'));
        for (const m of PI.months) row(monthName(m.month), `${fmtC(m.total)}${m.interest ? `, ${fmtC(m.interest)} of it interest` : ''}`);
        f.append(sectionHead('Who pays it'));
        for (const x of [...PI.securities].sort((a, b2) => b2.annual - a.annual)) { const sh = +x.quantity, n = (x.pay_dates || []).length;
          row(secName(x.name), `${fmtC(x.annual)} a year from ${sh} share${sh === 1 ? '' : 's'}${n ? `, paid ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}` : ''}.`); }
        f.append(el('p', 'inote', PI.note || 'A projection by broker. Dividends can change.'));
      } else if (key === 'practice' && Mo.practice) {
        const P = Mo.practice, Sm = P.summary, nt = P.not_traded || {};
        line(`<b>${usdCents(Sm.pnl)}</b> from ${Sm.trades} practice buys of $${P.stake}, against <b>${usdCents(Sm.spx_pnl)}</b> for the same money in the S&P 500 over the same dates.`);
        f.append(sectionHead('Every practice buy'));
        for (const t of [...P.trades].sort((a, b2) => b2.made_on.localeCompare(a.made_on)))
          row(t.via ? `${t.label}, through ${t.via}` : t.label, `Bought ${fmtDay(t.made_on)}, sold ${fmtDay(t.due_on)}: ${usdCents(t.pnl)}. The S&P over the same dates: ${t.spx_pnl == null ? 'no data' : usdCents(t.spx_pnl)}.`);
        f.append(sectionHead('Graded, not traded'));
        f.append(el('p', 'iprose sm', `${nt.down || 0} down calls and ${nt.flat || 0} flat calls aren’t practice trades, because you don’t short. ${nt.not_investable || 0} more were about things you can’t buy directly, like yields or the fear gauge. Of all of these, ${nt.right || 0} were right.`));
        f.append(el('p', 'inote', P.method));
      } else if (key === 'holdings') {
        const Hd = Mo.holdings;
        if (Hd?.length) { const tot = Hd.reduce((a, h) => a + (h.value || 0), 0); line(`<b>${fmt$(tot)}</b> across ${Hd.length} holding${Hd.length === 1 ? '' : 's'} the brief can price today.`); for (const h of [...Hd].sort((a, b) => (b.value || 0) - (a.value || 0))) row(h.label, h.value != null ? `${fmt$(h.value)} · ${(h.value / tot * 100).toFixed(0)}% of what’s priced${h.change_pct != null ? ` · ${signed(h.change_pct)} today` : ''}` : 'Not priced: the brief doesn’t track this symbol yet.'); }
        else { line('What you own, once your account report is in.'); f.append(el('p', 'inote', 'Not set up yet.')); }
      }
      if (!mOn) depthScene(d.stage || null);
      return f;
    },
    weather(label) {
      const w = WX?.rows.find(r => r.label === label), f = document.createDocumentFragment(); if (!w) return f;
      const name = wxName(w);
      f.append(el('span', 'label', w.home ? 'Weather · home' : 'Weather'), el('h2', 'ititle', name));
      const big = el('div', 'ibig'); big.append(el('strong', '', `${Math.round(w.temp)}°`), el('span', 'chg', w.local ? `${w.condition} at ${w.local} local` : w.condition)); f.append(big);
      const pl = el('p', 'iline'); pl.innerHTML = `High <b>${Math.round(w.high)}°</b>, low <b>${Math.round(w.low)}°</b>. <b>${w.precip.toFixed(2)} in</b> of rain over the day. Wind <b>${Math.round(w.wind)} mph</b>, humidity <b>${w.humidity}%</b>.`; f.append(pl);
      if (w.bears_on) {
        f.append(sectionHead('Why it’s watched'), el('p', 'iprose sm', w.bears_on.replace(' — ', '. It runs through ') + '.'));
        const tied = INST_FOR(w.bears_on);
        if (tied.length) { f.append(sectionHead('Markets it touches')); tied.forEach(i => { const r = rowBtn('mkt', () => inspect('instrument', i.label)); r.append(el('b', '', i.label), spark(i.series, 64, 18), el('span', 'chg ' + (i.change_pct >= 0 ? 'pos' : 'neg'), pct(i.change_pct))); f.append(r); }); }
      }
      const flag = KD?.needs?.find(n => n.source === 'Weather' && n.title.startsWith(name));
      if (flag && !w.notable) f.append(el('p', 'inote', `The brief flagged ${flag.title.split(': ')[1]} here from that morning’s forecast. The archive shows ${w.precip.toFixed(2)} in for the day, far under the 1.5 in flag. The desk didn’t keep its own reading to compare.`));
      f.append(el('p', 'inote', 'Weather is a possible factor, never a cause, and only worth saying when the market agrees.'));
      f.append(el('p', 'isrc', wxWhen()));
      globe.look?.({ place: name, lat: w.lat, lon: w.lon, count: 0 });
      return f;
    },
    place(name) {
      const p = places.find(x => x.place === name) || { place: name, count: 0, kinds: [] };
      const f = document.createDocumentFragment();
      f.append(el('span', 'label', 'Place'), el('h2', 'ititle', p.place), el('p', 'imeta', `${p.count} reference${p.count === 1 ? '' : 's'}${p.kinds?.length ? ' · ' + p.kinds.join(' · ') : ''}`));
      const lead = (p.lead_label || '').trim();
      if (lead) { f.append(el('p', 'iprose', lead.replace(/^([IVX]+)\.\s+/, ''))); const sec = lead.match(/^([IVX]+)\./); if (sec) f.append(el('p', 'isrc', `From the recorded read, section ${sec[1]}`)); }
      const hs = X.headlines.filter(h => h.place === name);
      if (hs.length) { f.append(sectionHead(`Stories here · ${hs.length}`)); hs.slice(0, 8).forEach(h => { const r = rowBtn('hl', () => inspect('headline', h.i)); const m = el('span', 'meta'); m.append(el('i', 'ldot ' + (h.lean || '')), document.createTextNode(h.source)); r.append(el('b', '', h.title), m); f.append(r); }); }
      const ms = X.instruments.filter(i => i.home?.place === name);
      if (ms.length) { f.append(sectionHead('Markets here')); ms.forEach(i => { const r = rowBtn('mkt', () => inspect('instrument', i.label)); r.append(el('b', '', i.label), spark(i.series, 64, 18), el('span', 'chg ' + (i.change_pct >= 0 ? 'pos' : 'neg'), pct(i.change_pct))); f.append(r); }); }
      f.append(el('p', 'inote', 'Places give context. The record doesn’t link this place to a market move.'));
      globe.look?.(places.find(x => x.place === name) || null);
      return f;
    },
    instrument(label) {
      const i = inst[label]; const f = document.createDocumentFragment(); if (!i) return f;
      f.append(el('span', 'label', `${DESK[i.desk] || i.desk} · ${i.symbol}`), el('h2', 'ititle', i.label));
      const big = el('div', 'ibig'); big.append(el('strong', '', fmtPrice(i)), el('span', 'chg ' + (i.change_pct >= 0 ? 'pos' : 'neg'), pct(i.change_pct) + ' today')); f.append(big);
      const sp = spark(i.series, 420, 96, true); sp.setAttribute('aria-label', `${i.label}, last ${i.series.length} sessions`); f.append(sp);
      f.append(el('p', 'isrc', `Last ${i.series.length} sessions to ${M.short} · daily closes from the ledger`));
      if (i.year_high && i.year_low) {
        const pos = (i.price - i.year_low) / (i.year_high - i.year_low);
        const rg = el('div', 'irange'); const track = el('div', 'track'); const dot = el('i'); dot.style.left = `${Math.max(0, Math.min(1, pos)) * 100}%`; track.append(dot);
        const cap = el('div', 'rcap'); cap.append(el('span', '', `Low ${fmtN(i.year_low, i.year_low < 20 ? 3 : 0)}`), el('span', '', `${Math.round(pos * 100)}% of the way up its year`), el('span', '', `High ${fmtN(i.year_high, i.year_high < 20 ? 3 : 0)}`));
        rg.append(track, cap); f.append(sectionHead('Its year'), rg);
      }
      const facts = el('dl', 'ifacts');
      const fact = (k, v) => { if (v == null || v === '') return; const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); facts.append(d); };
      if (i.sma_50) fact('vs 50-day', pct((i.price / i.sma_50 - 1) * 100));
      if (i.sma_200) fact('vs 200-day', pct((i.price / i.sma_200 - 1) * 100));
      if (i.forward_pe) fact('Forward P/E', fmtN(i.forward_pe, 1));
      if (i.market_cap) fact('Market cap', fmtCap(i.market_cap));
      if (i.beta) fact('Beta', fmtN(i.beta, 2));
      if (i.dividend_yield) fact('Dividend yield', `${fmtN(i.dividend_yield, 2)}%`);
      if (facts.childElementCount) f.append(facts);
      // The same facts as a sentence, so the panel reads instead of tabulating.
      const vs = (a, b) => { const d = (a / b - 1) * 100; return `${Math.abs(d).toFixed(1)}% ${d >= 0 ? 'above' : 'below'}`; };
      const said = [];
      if (i.sma_50 && i.sma_200) said.push(`Trading <b>${vs(i.price, i.sma_50)}</b> its 50-day average and <b>${vs(i.price, i.sma_200)}</b> its 200-day.`);
      else if (i.sma_50) said.push(`Trading <b>${vs(i.price, i.sma_50)}</b> its 50-day average.`);
      const val = [];
      if (i.market_cap) val.push(`worth <b>${fmtCap(i.market_cap)}</b>`);
      if (i.forward_pe) val.push(`priced at <b>${fmtN(i.forward_pe, 1)} times</b> next year’s earnings`);
      if (i.beta) val.push(`moving about <b>${fmtN(i.beta, 1)}×</b> as much as the market`);
      if (val.length) said.push(val.join(', ').replace(/^./, c => c.toUpperCase()) + '.');
      if (said.length) { const pl = el('p', 'iline'); pl.innerHTML = said.join(' '); f.append(pl); }
      const res = words(i.label);
      const sentence = ((E.read || '').match(/[^.!?—]+[.!?—]?/g) || []).find(s => res.some(r => r.test(s)));
      if (sentence) { f.append(sectionHead('In today’s read')); f.append(el('p', 'iquote', sentence.trim())); }
      const hs = X.headlines.filter(h => res.some(r => r.test(h.title)));
      if (hs.length) { f.append(sectionHead(`In the news · ${hs.length}`)); hs.slice(0, 6).forEach(h => { const r = rowBtn('hl', () => inspect('headline', h.i)); const m = el('span', 'meta'); m.append(el('i', 'ldot ' + (h.lean || '')), document.createTextNode(h.source)); r.append(el('b', '', h.title), m); f.append(r); }); }
      if (i.home) { const r = rowBtn('home', () => inspect('place', i.home.place)); r.append(el('span', 'label', gazHQ(i) ? 'Headquarters' : 'Trades in'), el('b', '', i.home.place + ' →')); f.append(r); }
      globe.look?.(i.home ? (places.find(x => x.place === i.home.place) || { place: i.home.place, lat: i.home.lat, lon: i.home.lon, count: 0 }) : null);
      return f;
    },
    headline(idx) {
      const h = X.headlines[idx]; const f = document.createDocumentFragment(); if (!h) return f;
      f.append(el('span', 'label', `${h.source} · ${LEAN_LABEL[h.lean] || ''}`), el('h2', 'ititle hl', h.title));
      f.append(el('p', 'imeta', [when(h.published), h.beat].filter(Boolean).join(' · ')));
      if (h.link) { const a = el('a', 'iopen', 'Open the article ↗'); a.href = h.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; f.append(a); }
      const group = byStory[h.story] || [h];
      f.append(sectionHead(group.length > 1 ? `Who covered it · ${group.length}` : 'Who covered it'), leanBar(group));
      if (group.length > 1) group.filter(x => x !== h).forEach(x => { const r = rowBtn('hl', () => inspect('headline', x.i)); const m = el('span', 'meta'); m.append(el('i', 'ldot ' + (x.lean || '')), document.createTextNode(x.source)); r.append(el('b', '', x.title), m); f.append(r); });
      else f.append(el('p', 'inote', h.lean === 'straight' ? 'One wire or market desk carried it in this record.' : `Only ${h.source} carried it in this record. A story one side runs is an editorial choice worth noticing.`));
      if (h.place) { const r = rowBtn('home', () => inspect('place', h.place)); r.append(el('span', 'label', 'Placed at'), el('b', '', h.place)); f.append(r); }
      globe.look?.(h.place ? (places.find(x => x.place === h.place) || { place: h.place, lat: h.lat, lon: h.lon, count: 0 }) : null);
      return f;
    }
  };
  const gazHQ = i => i.desk === 'watchlist';
  const TITLE = e => e.view === 'money' ? 'Money' : e.view === 'mny' ? (MNY_BY[e.arg]?.name || 'Money') : e.view === 'depth' ? 'Analysis' : e.view === 'desk' ? (DESK_BY[e.arg]?.name || 'Desk') : e.view === 'index' ? (uiMode === 'explore' ? 'Map' : 'Index') : e.view === 'country' ? (WM_LIST.find(x => x.country === e.arg)?.name || 'Country') : e.view === 'read' ? 'The full analysis' : e.view === 'place' ? e.arg : e.view === 'instrument' ? e.arg : e.view === 'headline' ? (X.headlines[e.arg]?.source || 'Headline') : e.view === 'weather' ? (WX ? wxName(WX.rows.find(r => r.label === e.arg) || { label: e.arg }) : e.arg) : e.view;
  function renderInsp() {
    const top = stack.at(-1); if (!top) return;
    if ((uiMode === 'depth' || uiMode === 'money') && !['desk', 'depth', 'money', 'mny'].includes(top.view)) clearDepth();
    inspBody.replaceChildren(VIEWS[top.view](top.arg));
    crumbs.replaceChildren(...stack.map((e, k) => { const s = el('span', k === stack.length - 1 ? 'cur' : '', TITLE(e)); return s; }));
    $('[data-insp-back]').hidden = stack.length < 2;
    crumbs.style.visibility = stack.length < 2 && top.view !== 'index' ? 'hidden' : '';
    $('[data-insp-close]').hidden = uiMode !== 'brief' && !mOn && stack.length < 2;
    inspEl.hidden = false; document.body.classList.add('insp-open'); inspBody.scrollTop = 0;
    if (['index', 'read'].includes(top.view)) globe.look?.(null);
  }
  function inspect(view, arg) {
    if (think) finishThinking();
    if (!stack.length && uiMode !== 'brief' && !mOn) stack = [rootFor()];
    if (['mny', 'desk'].includes(view) && stack.at(-1)?.view === view) stack.pop();  // sibling sections replace, not stack
    stack.push({ view, arg }); renderInsp();
  }
  function inspectRoot(view, arg) { stack = uiMode !== 'brief' && !['index', 'depth', 'money'].includes(view) ? [rootFor(), { view, arg }] : [{ view, arg }]; renderInsp(); }
  function insBack() { if (stack.length > 1) { stack.pop(); renderInsp(); } else closeInsp(); }
  function closeInsp() {
    if (mOn) { stack = []; inspEl.hidden = true; document.body.classList.remove('insp-open'); moneyGo(mIdx); return; }
    if (uiMode !== 'brief') { stack = [['index', 'depth', 'money'].includes(stack[0]?.view) ? stack[0] : rootFor()]; renderInsp(); return; }
    stack = []; inspEl.hidden = true; document.body.classList.remove('insp-open'); globe.look?.(null);
  }
  $('[data-insp-back]').addEventListener('click', insBack);
  $('[data-insp-close]').addEventListener('click', () => { stack = stack.slice(0, 1); closeInsp(); });
  $('[data-read-full]').addEventListener('click', () => inspectRoot('read'));

  // Modes: Brief is the guided story; Explore is the free globe with its lenses; Depth is the desks under the read.
  const rootFor = () => uiMode === 'depth' ? { view: 'depth' } : uiMode === 'money' ? { view: 'money' } : { view: 'index', arg: lens };
  function setMode(m) {
    if (m === 'money' && M.public) return;
    if (m === uiMode) return;
    const was = uiMode; uiMode = m;
    document.body.classList.toggle('mode-explore', m === 'explore'); document.body.classList.toggle('mode-depth', m === 'depth'); document.body.classList.toggle('mode-money', m === 'money'); document.body.classList.toggle('browse', m !== 'brief');
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    if (was === 'depth' || was === 'money') clearDepth();
    if (was === 'money') moneyExit();
    if (was === 'explore') setLens('places');
    if (m !== 'brief' && think) finishThinking();
    if (m === 'explore') { stack = [{ view: 'index', arg: 'places' }]; renderInsp(); globe.explore?.(); }
    else if (m === 'depth') { deselect(); globe.depth?.(); stack = [{ view: 'depth' }]; renderInsp(); }
    else if (m === 'money') { deselect(); globe.depth?.(); if (MCH.length) { stack = []; inspEl.hidden = true; document.body.classList.remove('insp-open'); moneyEnter(); } else { stack = [{ view: 'money' }]; renderInsp(); } }
    else { stack = []; inspEl.hidden = true; document.body.classList.remove('insp-open'); globe.look?.(null); globe.brief?.(); }
  }
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // Status pill: one quiet line, details on click
  const pill = $('[data-status]'), pop = $('.status-pop');
  const togglePop = open => { const o = open ?? pop.hidden; pop.hidden = !o; pill.setAttribute('aria-expanded', String(o)); };
  pill.addEventListener('click', e => { e.stopPropagation(); togglePop(); });
  addEventListener('click', e => { if (!pop.hidden && !e.target.closest('.status-pop, [data-status]')) togglePop(false); });
  pop.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { togglePop(false); go(isNaN(+b.dataset.go) ? IDX(b.dataset.go) : +b.dataset.go); }));
  $('[data-deck-bar]')?.addEventListener('click', () => window.SixSevenDeck?.open());

  // Command bar
  const cmd = $('#cmd'), cmdQ = $('#cmd-q'), cmdList = $('.cmd-list');
  let cmdItems = [], cmdActive = 0, cmdShown = [];
  function buildCmd() {
    const it = [];
    CHAPTERS.forEach((c, i) => it.push({ type: 'Chapter', label: c.label, sub: c.eyebrow.replace(/^\d+ · /, ''), run: () => go(i) }));
    MNY.forEach(d => it.push({ type: 'Money', label: `Money: ${d.name}`, sub: d.find(), keys: `money ${d.key} ${d.meta} cash invest plan income`, run: () => { setMode('money'); inspect('mny', d.key); } }));
    DESKS.forEach(d => it.push({ type: 'Analysis', label: d.name, sub: d.find(), keys: `depth ${d.key} ${d.meta}`, run: () => openDesk(d.key) }));
    it.push({ type: 'View', label: 'The full analysis', sub: 'The whole written read and the case against it', keys: 'read counterpoint confidence', run: () => inspectRoot('read') });
    for (const [k, t] of [['markets', 'All markets'], ['headlines', 'All headlines'], ['places', 'All places']]) it.push({ type: 'View', label: t, sub: 'The map', keys: k, run: () => { setMode('explore'); stack = [{ view: 'index', arg: k }]; renderInsp(); } });
    it.push({ type: 'Mode', label: uiMode === 'explore' ? 'Back to today' : 'Open the map', sub: uiMode === 'explore' ? 'The morning brief' : 'The globe, with everything placed on it', keys: 'mode brief explore', run: () => setMode(uiMode === 'explore' ? 'brief' : 'explore') });
    it.push({ type: 'Mode', label: 'Walk through the day', sub: 'The brief, one chapter at a time', keys: 'walk tour chapters story', run: () => { setMode('brief'); go(1); } });
    places.forEach(p => it.push({ type: 'Place', label: p.place, sub: `${p.count} reference${p.count === 1 ? '' : 's'}`, run: () => inspect('place', p.place) }));
    X.instruments.forEach(i => it.push({ type: 'Market', label: i.label, sub: `${i.symbol} · ${pct(i.change_pct)}`, keys: `${i.symbol} ${i.desk} ${(ALIAS[i.label] || []).join(' ')}`, run: () => inspect('instrument', i.label) }));
    (S.chart?.bodies || []).forEach(b => it.push({ type: 'Planet', label: b.name, sub: `${Math.round(b.degree)}° ${b.sign}${b.retrograde ? ' ℞' : ''}`, keys: 'planet heavens astrology', run: () => { go(IDX('heavens')); setTimeout(() => highlight([b.name]), 1600); } }));
    X.headlines.forEach(h => it.push({ type: 'Headline', label: h.title, sub: h.source, keys: h.source, run: () => inspect('headline', h.i) }));
    return it;
  }
  const CAP = { Chapter: 5, Money: 4, Analysis: 4, View: 4, Mode: 2, Place: 5, Market: 6, Planet: 3, Headline: 6 };
  const BOOST = { Chapter: 3, Money: 3, Analysis: 3, View: 3, Mode: 2, Place: 2, Market: 2, Planet: 1, Headline: 0 };
  function score(q, item) {
    const t = `${item.label} ${item.keys || ''}`.toLowerCase(); let s = 0;
    for (const w of q.split(/\s+/).filter(Boolean)) { const k = t.indexOf(w); if (k < 0) return -1; s += k === 0 ? 6 : /[^a-z0-9]/.test(t[k - 1]) ? 4 : 1; }
    return s + BOOST[item.type];
  }
  function renderCmd() {
    const q = cmdQ.value.trim().toLowerCase(); const groups = [];
    if (!q) {
      groups.push(['Jump to', [...cmdItems.filter(i => i.type === 'Chapter'), cmdItems.find(i => i.label === 'Alerts')].filter(Boolean)]);
      groups.push(['Biggest movers', [...cmdItems.filter(i => i.type === 'Market')].sort((a, b) => Math.abs(inst[b.label].change_pct) - Math.abs(inst[a.label].change_pct)).slice(0, 4)]);
      groups.push(['Most referenced places', cmdItems.filter(i => i.type === 'Place').sort((a, b) => parseInt(b.sub) - parseInt(a.sub)).slice(0, 4)]);
    } else {
      const scored = cmdItems.map(i => [score(q, i), i]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0]);
      const by = {}; for (const [, i] of scored) { (by[i.type] ||= []); if (by[i.type].length < CAP[i.type]) by[i.type].push(i); }
      const order = [...new Set(scored.map(([, i]) => i.type))];
      for (const t of order) groups.push([t === 'Market' ? 'Markets' : t === 'Headline' ? 'Headlines' : t === 'Chapter' ? 'Chapters' : t === 'Place' ? 'Places' : t === 'Planet' ? 'Planets' : t === 'View' ? 'Views' : 'Actions', by[t]]);
    }
    cmdList.replaceChildren(); cmdShown = []; let n = 0;
    for (const [g, list] of groups) {
      if (!list?.length) continue;
      cmdList.append(el('li', 'cg', g));
      for (const i of list) {
        const li = el('li', 'ci'); li.setAttribute('role', 'option'); li.dataset.k = n;
        li.append(el('b', '', i.label), el('span', '', i.sub || ''));
        if (i.type === 'Market') { const ins = inst[i.label]; li.append(spark(ins.series, 54, 16)); }
        li.addEventListener('mousemove', () => setActive(+li.dataset.k)); li.addEventListener('click', () => runCmd(+li.dataset.k));
        cmdList.append(li); cmdShown.push(i); n++;
      }
    }
    if (!n) cmdList.append(el('li', 'cempty', `Nothing in this edition matches “${cmdQ.value.trim()}”.`));
    setActive(0);
  }
  function setActive(k) { cmdActive = Math.max(0, Math.min(cmdShown.length - 1, k)); cmdList.querySelectorAll('.ci').forEach(li => li.setAttribute('aria-selected', String(+li.dataset.k === cmdActive))); cmdList.querySelector(`.ci[data-k="${cmdActive}"]`)?.scrollIntoView({ block: 'nearest' }); }
  function runCmd(k) { const it = cmdShown[k]; closeCmd(); it?.run(); }
  function openCmd() { cmdItems = buildCmd(); cmd.hidden = false; document.body.classList.add('cmd-open'); cmdQ.value = ''; renderCmd(); setTimeout(() => cmdQ.focus(), 0); }
  function closeCmd() { cmd.hidden = true; document.body.classList.remove('cmd-open'); }
  cmdQ.addEventListener('input', renderCmd);
  cmdQ.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(cmdActive + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(cmdActive - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdActive); }
    else if (e.key === 'Escape') { e.preventDefault(); closeCmd(); }
  });
  cmd.addEventListener('click', e => { if (e.target === cmd) closeCmd(); });
  $('[data-cmd-open]').addEventListener('click', openCmd);

  // ---------- 3D world ----------
  function fallback() { document.body.classList.add('fallback'); chapter = 0; thinkDone = true; renderStory(CHAPTERS[0]); railUI(0); renderFullChain(); }
  if (!window.THREE) { fallback(); return; }
  const canvas = $('#world');
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { fallback(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(PAL.hex.clear ?? 0x04060e, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.002, 200);

  // lat/lon → position, matching THREE.SphereGeometry's equirectangular UVs (u = 0 at lon −180).
  function vec(lat, lon, r = 1) {
    const phi = (lon + 180) * D, th = lat * D;
    return new THREE.Vector3(-Math.cos(phi) * Math.cos(th) * r, Math.sin(th) * r, Math.sin(phi) * Math.cos(th) * r);
  }

  const lightVecs = [];
  for (let i = 0; i < 34; i++) { const m = places[i]; const p = m ? vec(m.lat, m.lon) : new THREE.Vector3(0, 1, 0); lightVecs.push(new THREE.Vector4(p.x, p.y, p.z, m ? Math.min(15, m.count) : 0)); }

  const sunDir = new THREE.Vector3(1, 0, 0), Y_UP = new THREE.Vector3(0, 1, 0);
  let arriveAt = 0;
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { day: { value: null }, sun: { value: sunDir }, camPos: { value: new THREE.Vector3() }, lights: { value: lightVecs }, boost: { value: 1 }, gain: { value: 1 }, dayMode: { value: 0 },
      texel: { value: new THREE.Vector2(1 / 4096, 1 / 2048) }, relief: { value: PAL.relief ?? 3 }, grat: { value: PAL.grat ?? .05 },
      nightTex: { value: null }, nightOn: { value: 0 }, city: { value: 1 }, cloudTex: { value: null }, cloudAmt: { value: 0 },
      glow: { value: new THREE.Color(1, 1, 1) }, glowAmt: { value: 0 } },
    extensions: { derivatives: true },
    vertexShader: `varying vec3 vN; varying vec2 vUv; varying vec3 vW;
      void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D day; uniform vec3 sun; uniform vec3 camPos; uniform vec4 lights[34]; uniform float boost; uniform float gain; uniform float dayMode;
      uniform vec2 texel; uniform float relief; uniform float grat; uniform sampler2D nightTex; uniform float nightOn; uniform float city; uniform sampler2D cloudTex; uniform float cloudAmt; uniform vec3 glow; uniform float glowAmt;
      varying vec3 vN; varying vec2 vUv; varying vec3 vW;
      float lumAt(vec2 uv){ return dot(texture2D(day,uv).rgb,vec3(.30,.55,.15)); }
      void main(){
        vec3 n=normalize(vN); vec3 t=texture2D(day,vUv).rgb; vec3 V=normalize(camPos-vW);
        float L=dot(n,sun); float dayAmt=smoothstep(-.20,.32,L);
        float lum=dot(t,vec3(.30,.55,.15)); float land=smoothstep(.07,.19,t.r+t.g-t.b*1.12);
        // The map's own relief: its brightness gradient read as slope and lit by the real sun.
        vec2 d=texel*1.5;
        float gx=lumAt(vUv+vec2(d.x,0.))-lumAt(vUv-vec2(d.x,0.)), gy=lumAt(vUv+vec2(0.,d.y))-lumAt(vUv-vec2(0.,d.y));
        vec3 east=normalize(cross(vec3(0.,1.,0.),n)+vec3(1e-5,0.,0.)), north=cross(n,east);
        vec3 bn=normalize(n-(east*gx+north*gy)*relief*land);
        float near=(lumAt(vUv+vec2(d.x*2.,0.))+lumAt(vUv-vec2(d.x*2.,0.))+lumAt(vUv+vec2(0.,d.y*2.))+lumAt(vUv-vec2(0.,d.y*2.)))*.25;
        float detail=clamp((lum-near)*3.,-.25,.25);
        vec3 ocean=mix(${gv('ocean0',[.030,.050,.140])},${gv('ocean1',[.11,.17,.38])},clamp(lum*1.8,0.,1.));
        vec3 ground=mix(${gv('ground0',[.26,.22,.40])},${gv('ground1',[.92,.80,.94])},clamp(pow(lum,.85)*1.25+detail,0.,1.));
        vec3 graded=mix(ocean,ground,land); graded=mix(graded,t*${gv('tint',[.92,.86,1.06])},.22);
        vec3 lit=graded*(.16+1.12*pow(max(mix(L,dot(bn,sun),land),0.),.85));
        vec3 night=graded*.15+mix(${gv('nightSea',[.010,.016,.045])},${gv('nightLand',[.060,.045,.095])},land);
        night=mix(night, graded*.55+${gv('dayNight',[.10,.10,.20])}, dayMode);
        vec3 col=mix(night,lit,dayAmt);
        // Real clouds cast shadows: the cloud map, nudged away from the sun, darkens the ground under it.
        vec3 sunT=sun-n*dot(sun,n); vec2 off=vec2(-dot(sunT,east)/6.2832,-dot(sunT,north)/3.1416)*.006;
        float sh=smoothstep(.42,.88,texture2D(cloudTex,vUv+off).r)*(1.-smoothstep(.62,.88,abs(vUv.y-.5)*2.));
        col*=1.-sh*.45*cloudAmt*dayAmt;
        col+=exp(-pow(L/.12,2.))*${gv('term',[.58,.30,.44])}*.07;
        // The sun's glint on open water.
        vec3 H=normalize(sun+V); float nh=max(dot(n,H),0.);
        float rip=fract(sin(dot(floor(vUv*vec2(4096.,2048.)),vec2(12.9898,78.233)))*43758.5453);
        col+=(pow(nh,700.)*.55*(.25+1.5*rip*rip)+pow(nh,60.)*.012)*(1.-land)*smoothstep(-.05,.25,L)*${gv('glint',[.85,.82,1])};
        // A graticule every 15 degrees: an instrument's grid that curves with the sphere.
        float fres=pow(1.-max(dot(n,V),0.),3.2);
        vec2 gg=vec2(vUv.x*24.,vUv.y*12.); vec2 fw=max(fwidth(gg),vec2(1e-4)); vec2 ff=abs(fract(gg-.5)-.5)/fw;
        float grid=(1.-min(min(ff.x,ff.y),1.))*smoothstep(.97,.80,abs(n.y));
        col+=grid*${gv('gratCol',[.62,.58,.92])}*grat*(.30+.70*dayAmt)*(1.-fres);
        // The real night: city lights from NASA's Black Marble, only where the sun has set.
        float nlum=dot(texture2D(nightTex,vUv).rgb,vec3(.30,.55,.15));
        col+=smoothstep(.10,.62,nlum)*nightOn*(1.-smoothstep(-.16,.10,L))*${gv('lights',[1,.80,.55])}*city*1.1;
        // Places as beacons: a sharp core, a fine ring, a faint halo.
        float g=0.;
        for(int i=0;i<34;i++){ vec4 m=lights[i]; float on=step(.5,m.w); float a=acos(clamp(dot(n,m.xyz),-1.,1.)); float r=.0024+.00028*m.w;
          g+=on*((1.0+.06*m.w)*exp(-pow(a/r,2.))+(.05+.008*m.w)*exp(-pow(a/(r*6.),2.))); }
        col+=g*(1.-dayAmt*.78)*${gv('lights',[1,.80,.55])}*boost*gain;
        // Atmosphere: haze over the lit limb, then the rim itself.
        col+=pow(1.-max(dot(n,V),0.),1.8)*dayAmt*${gv('haze',[.45,.40,.85])}*.20;
        float rs=smoothstep(-.35,.55,L);
        col+=fres*mix(mix(${gv('rim0',[.05,.07,.22])},${gv('rim1',[.52,.40,.86])},rs),glow*(.10+.62*rs),glowAmt)*.75;
        gl_FragColor=vec4(col,1.);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), earthMat));

  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { sun: { value: sunDir }, fade: { value: 1 }, dayMode: { value: 0 }, glow: { value: new THREE.Color(1, 1, 1) }, glowAmt: { value: 0 } },
    vertexShader: `varying vec3 vNv; varying vec3 vNw; void main(){ vNv=normalize(normalMatrix*normal); vNw=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 sun; uniform float fade; uniform float dayMode; uniform vec3 glow; uniform float glowAmt; varying vec3 vNv; varying vec3 vNw;
      void main(){ float i=pow(clamp(.72-dot(vNv,vec3(0.,0.,1.)),0.,1.),3.6); float s=smoothstep(-.45,.6,dot(vNw,sun));
        vec3 c=mix(mix(${gv('atm0',[.16,.20,.58])},${gv('atm1',[.78,.58,.98])},s),glow*(.22+.70*s),glowAmt*(.45+.55*s)); float k=i*(.35+1.1*s)*fade;
        gl_FragColor = dayMode > .5 ? vec4(mix(${gv('atmD0',[.55,.62,.95])},${gv('atmD1',[.85,.72,1])},s), clamp(k*.9,0.,.85)) : vec4(c*k,1.); }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.075, 96, 64), atmoMat);
  scene.add(atmo);

  // ---------- The day's mood as light: the market's measured mood carried by the planet's glow ----------
  // The clouds are the real sky (below), so the mood lives in light instead: the atmosphere's rim warms toward pale
  // champagne on reach-for-risk days, stays cool on mixed ones and turns rose on pull-back days, with low pulses of light
  // where the day's biggest drops were on tense days. The mood is the measured regime (regime.py); the pulse places are
  // the homes of the worst measured moves. Nothing here is invented. ?mood=risk_off previews another mood.
  const SKYMOOD = { risk_off: { glow: [1, .52, .64], amt: .62, flick: 1 }, lean_off: { glow: [.96, .64, .76], amt: .40, flick: .6 },
    mixed: { glow: [.74, .78, 1], amt: .14, flick: .3 }, rotation: { glow: [.70, .80, 1], amt: .18, flick: .25 },
    lean_on: { glow: [1.10, 1.03, .92], amt: .40, flick: 0 }, risk_on: { glow: [1.24, 1.14, .98], amt: .62, flick: 0 } };
  const moodKey = (() => { const q = new URLSearchParams(location.search).get('mood'); return SKYMOOD[q] ? q : SKYMOOD[KD?.regime?.label] ? KD.regime.label : 'mixed'; })();
  const skyMood = SKYMOOD[moodKey];
  for (const m of [earthMat, atmoMat]) { m.uniforms.glow.value.setRGB(...skyMood.glow); m.uniforms.glowAmt.value = skyMood.amt; }
  const stressAt = (X?.instruments || []).filter(i => i.home && i.change_pct <= -2).sort((a, b) => a.change_pct - b.change_pct).slice(0, 6)
    .map(i => { const v = vec(i.home.lat, i.home.lon).normalize(); return new THREE.Vector4(v.x, v.y, v.z, 1); });
  while (stressAt.length < 6) stressAt.push(new THREE.Vector4(0, 1, 0, 0));
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, flick: { value: skyMood.flick }, stress: { value: stressAt }, fade: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float time; uniform float flick; uniform vec4 stress[6]; uniform float fade;
      varying vec3 vP; varying vec3 vN;
      void main(){
        vec3 p=normalize(vP); float f=0.;
        for(int i=0;i<6;i++){ vec4 s=stress[i]; float d=acos(clamp(dot(p,s.xyz),-1.,1.));
          f+=s.w*exp(-pow(d/.07,2.))*pow(max(0.,sin(time*1.3+float(i)*2.17)),8.); }
        gl_FragColor=vec4(vec3(1.,.55,.66)*f*flick*1.6,f*flick*.45*fade);
      }`,
    transparent: true, depthWrite: false
  });
  const hazeShell = new THREE.Mesh(new THREE.SphereGeometry(1.012, 128, 96), hazeMat); hazeShell.renderOrder = 2; scene.add(hazeShell);

  // ---------- Real clouds: this morning's satellite cloud map (EUMETSAT, via matteason's CC0 Live Cloud Maps) ----------
  // The pipeline saves it beside the edition as data/clouds/<date>.jpg; with no file there are simply no clouds. It's an
  // infrared image, so only bright cloud tops are kept and the cold poles fade out. On the night side the clouds go dark
  // and dim the city lights under them, as real clouds do. ?sky=none hides them.
  const SKY = new URLSearchParams(location.search).get('sky');
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, sun: { value: sunDir }, fade: { value: 0 },
      lblA: { value: Array.from({ length: 40 }, () => new THREE.Vector4()) }, lblB: { value: Array.from({ length: 40 }, () => new THREE.Vector4()) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv=uv; vP=position; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 sun; uniform float fade; uniform vec4 lblA[40]; uniform vec4 lblB[40]; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){
        float c=texture2D(map,vUv).r, lat=abs(vUv.y-.5)*2.;
        float a=smoothstep(.42,.88,c)*(1.-smoothstep(.62,.88,lat));
        // A cartographer's knockout: cloud thins in a soft oval under each visible place name, so names stay legible.
        vec3 d=normalize(vP); float clear=0.;
        for(int i=0;i<40;i++){ vec4 A=lblA[i]; vec4 B=lblB[i]; if(B.y<.01) continue;
          vec3 e=normalize(cross(vec3(0.,1.,0.),A.xyz)+vec3(1e-5,0.,0.)), nn=cross(A.xyz,e); vec3 q=d-A.xyz*dot(d,A.xyz);
          float dx=dot(q,e)/(A.w*1.2), dy=dot(q,nn)/(B.x*2.4); clear=max(clear,exp(-(dx*dx+dy*dy)*1.4)*B.y*step(0.,dot(d,A.xyz))); }
        a*=1.-.72*clear;
        float L=dot(normalize(vN),sun), day=smoothstep(-.16,.28,L);
        vec3 col=mix(${gv('cloudNight',[.035,.04,.085])},${gv('cloudDay',[.97,.97,1.0])}*(.70+.30*max(L,0.)),day);
        gl_FragColor=vec4(col,a*fade*mix(.45,.84,day));
      }`,
    transparent: true, depthWrite: false
  });
  const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(1.004, 160, 110), cloudMat); cloudShell.renderOrder = 1; cloudShell.visible = false; scene.add(cloudShell);
  let cloudsReady = false;
  if (M.date && SKY !== 'none') new THREE.TextureLoader().load(`data/clouds/${M.date}.jpg`, tex => { tex.anisotropy = 4; cloudMat.uniforms.map.value = tex; earthMat.uniforms.cloudTex.value = tex; cloudsReady = true;
    const fe = document.querySelector('.fine-earth'); if (fe) fe.textContent = fe.textContent.replace('Black Marble.', 'Black Marble. Clouds: contains modified EUMETSAT data.'); }, undefined, () => {});

  // ---------- The traditional planetary lines (astrocartography), shown only in the World mood lens ----------
  let skyLinesG = null;
  if (WM?.sky?.lines?.length) {
    skyLinesG = new THREE.Group(); skyLinesG.visible = false; scene.add(skyLinesG);
    const COLB = { Sun: 0xfff1d6, Venus: 0xf3b8d0, Jupiter: 0xaab4ec };
    for (const l of WM.sky.lines) {
      const pts = (l.points || []).filter(q => Number.isFinite(q.lat) && Number.isFinite(q.lon)); if (pts.length < 2) continue;
      const arr = []; for (let k = 1; k < pts.length; k++) { if (Math.abs(pts[k].lon - pts[k - 1].lon) > 180) continue; const a = vec(pts[k - 1].lat, pts[k - 1].lon, 1.004), b2 = vec(pts[k].lat, pts[k].lon, 1.004); arr.push(a.x, a.y, a.z, b2.x, b2.y, b2.z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const m = new THREE.LineDashedMaterial({ color: COLB[l.body] || 0xffffff, transparent: true, opacity: l.angle === 'MC' || l.angle === 'IC' ? .32 : .22, dashSize: .012, gapSize: .01, depthWrite: false });
      const ln = new THREE.LineSegments(g, m); ln.computeLineDistances(); skyLinesG.add(ln);
    }
  }
  // The world's mood as atmosphere: a soft field over each country, rose where coverage sounds darker than the world's
  // average today, cool where brighter, deeper where it also turned darker than its own usual. Drifts like weather.
  let moodMat = null, moodShell = null;
  if (WM_PLACED.length) {
    const avg = WM_PLACED.reduce((a, c) => a + c.tone * c.articles, 0) / WM_PLACED.reduce((a, c) => a + c.articles, 0);
    const pts = [], vals = [];
    for (const c of [...WM_PLACED].sort((a, b) => b.articles - a.articles).slice(0, 48)) {
      const v = vec(c.lat, c.lon).normalize(), rel = Math.max(-1, Math.min(1, (c.tone - avg) / 2.2)), usual = typeof c.tone_vs_baseline === 'number' ? Math.max(-1, Math.min(1, c.tone_vs_baseline / 2)) : 0;
      pts.push(new THREE.Vector4(v.x, v.y, v.z, Math.min(1, Math.log10(c.articles) / 4.4))); vals.push(new THREE.Vector4(rel, usual, 0, 0));
    }
    while (pts.length < 48) { pts.push(new THREE.Vector4(0, 1, 0, 0)); vals.push(new THREE.Vector4(0, 0, 0, 0)); }
    moodMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, fade: { value: 0 }, pts: { value: pts }, vals: { value: vals }, dark: { value: new THREE.Color(PC.down) }, light: { value: new THREE.Color(PC.up) }, sun: { value: sunDir } },
      vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float time; uniform float fade; uniform vec4 pts[48]; uniform vec4 vals[48]; uniform vec3 dark; uniform vec3 light; uniform vec3 sun; varying vec3 vP; varying vec3 vN;
        float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
        float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n3(p); p*=2.03; a*=.5; } return s; }
        void main(){
          vec3 p=normalize(vP); float neg=0., pos=0., deep=0.;
          for(int i=0;i<48;i++){ vec4 q=pts[i]; if(q.w<=0.) continue; float d=acos(clamp(dot(p,q.xyz),-1.,1.)); float g=exp(-pow(d/(.07+.07*q.w),2.))*q.w;
            float v=vals[i].x; neg+=max(-v,0.)*g; pos+=max(v,0.)*g; deep+=max(-vals[i].y,0.)*g; }
          float c=.55+.45*fbm(p*4.+vec3(time*.012,0.,time*.008)), lit=.45+.55*smoothstep(-.3,.4,dot(normalize(vN),sun));
          neg=clamp(neg+deep*.8,0.,1.6); pos=clamp(pos,0.,1.2);
          vec3 col=(dark*neg+light*pos*.8)/max(neg+pos,.001);
          float a=clamp((neg+pos*.8)*.55*c,0.,.62)*lit;
          gl_FragColor=vec4(col*(.75+.4*lit), a*fade);
        }`,
      transparent: true, depthWrite: false
    });
    moodShell = new THREE.Mesh(new THREE.SphereGeometry(1.008, 128, 96), moodMat); moodShell.renderOrder = 3; moodShell.visible = false; scene.add(moodShell);
  }
  function openMood() { setMode('explore'); stack = [{ view: 'index', arg: 'mood' }]; renderInsp(); }

  // ---------- Weather on the globe: a forecast-style field from the edition's world grid ----------
  // Temperature as colour, rain and snow as brighter bands, isobars every 4 hPa, highs and lows named by the nearest place.
  // The grid is measured (Open-Meteo, collected by the morning run into weather.grid); nothing here is interpolated beyond
  // the texture's own smoothing between grid points.
  let wxGrid = null;
  const wxMat = new THREE.ShaderMaterial({
    uniforms: { field: { value: null }, g1: { value: new THREE.Vector4(75, 5, -180, 5) }, g2: { value: new THREE.Vector2(28, 72) }, fade: { value: 0 }, sun: { value: sunDir } },
    extensions: { derivatives: true },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D field; uniform vec4 g1; uniform vec2 g2; uniform float fade; uniform vec3 sun; varying vec3 vP; varying vec3 vN;
      vec3 ramp(float t){
        vec3 c0=vec3(.34,.42,.96), c1=vec3(.38,.76,.98), c2=vec3(.44,.86,.66), c3=vec3(.96,.88,.46), c4=vec3(.99,.62,.36), c5=vec3(.93,.32,.34);
        if(t<-10.) return c0; if(t<0.) return mix(c0,c1,(t+10.)/10.); if(t<10.) return mix(c1,c2,t/10.); if(t<20.) return mix(c2,c3,(t-10.)/10.);
        if(t<28.) return mix(c3,c4,(t-20.)/8.); if(t<36.) return mix(c4,c5,(t-28.)/8.); return c5; }
      void main(){
        vec3 p=normalize(vP); float lat=degrees(asin(clamp(p.y,-1.,1.))); float lon=degrees(atan(p.z,-p.x))-180.;
        float row=(g1.x-lat)/g1.y, col=(lon-g1.z)/g1.w;
        if(row<-.5||row>g2.x-.5) discard;
        vec4 f=texture2D(field,vec2((col+.5)/g2.y,(row+.5)/g2.x));
        float tC=f.r*85.-40., pr=f.g*f.g*8., pm=940.+f.b*120.;
        vec3 c=ramp(tC); float a=.32;
        float rain=smoothstep(.08,1.4,pr); c=mix(c, tC<.5?vec3(.93,.96,1.):vec3(.58,.76,1.), rain*.75); a+=rain*.34;
        float q=pm/4., w=max(fwidth(q),1e-4), iso=1.-smoothstep(0.,w*1.3,abs(fract(q-.5)-.5));
        float L=dot(normalize(vN),sun), lit=.4+.6*smoothstep(-.3,.4,L);
        float edge=smoothstep(-.5,1.2,row)*smoothstep(g2.x-.5,g2.x-2.,row);
        gl_FragColor=vec4(c*lit+vec3(.95)*iso*.4*lit,(a+iso*.22)*fade*edge);
      }`,
    transparent: true, depthWrite: false
  });
  const wxShell = new THREE.Mesh(new THREE.SphereGeometry(1.006, 160, 120), wxMat); wxShell.renderOrder = 3; wxShell.visible = false; scene.add(wxShell);
  // Moving wind, an optional preview (off by default): streaks that drift with the grid's measured 10 m wind.
  let windOn = false, wind = null;
  function windAt(lat, lon) {
    const G = wxGrid?.grid, F = wxGrid?.fields; if (!G || !F?.wind_u) return null;
    const r = (G.lat0 - lat) / Math.abs(G.dlat), c = ((lon - G.lon0) / G.dlon % G.nlon + G.nlon) % G.nlon;
    if (r < 0 || r > G.nlat - 1) return null;
    const r0 = Math.floor(r), c0 = Math.floor(c), fr = r - r0, fc = c - c0, r1 = Math.min(G.nlat - 1, r0 + 1), c1 = (c0 + 1) % G.nlon;
    const v = (A, rr, cc) => A[rr * G.nlon + cc] ?? 0, mix = A => (v(A, r0, c0) * (1 - fc) + v(A, r0, c1) * fc) * (1 - fr) + (v(A, r1, c0) * (1 - fc) + v(A, r1, c1) * fc) * fr;
    return [mix(F.wind_u) / 10, mix(F.wind_v) / 10];
  }
  function windBuild() {
    const N = phone() ? 1400 : 3000, pos = new Float32Array(N * 6), col = new Float32Array(N * 6), P = [];
    const spawn = q => { q.lat = Math.asin(Math.random() * 1.7 - .85) / D; q.lon = Math.random() * 360 - 180; q.age = 0; q.life = 60 + Math.random() * 120; return q; };
    for (let i = 0; i < N; i++) { const q = spawn({}); q.age = Math.random() * q.life; P.push(q); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const line = new THREE.LineSegments(g, m); line.renderOrder = 4; line.frustumCulled = false; scene.add(line);
    wind = { P, g, m, line, spawn };
  }
  function windStep(dt) {
    if (!wind) return; const { P, g, spawn } = wind, pos = g.attributes.position.array, col = g.attributes.color.array, a = new THREE.Vector3(), b = new THREE.Vector3();
    P.forEach((q, i) => {
      let w = windAt(q.lat, q.lon); q.age++;
      if (!w || q.age > q.life) { spawn(q); w = windAt(q.lat, q.lon) || [0, 0]; }
      const k = .22, cl = Math.max(.2, Math.cos(q.lat * D)), sp = Math.hypot(w[0], w[1]);
      q.lat = Math.max(-80, Math.min(80, q.lat + w[1] * k * dt)); q.lon = ((q.lon + w[0] * k * dt / cl + 540) % 360) - 180;
      a.copy(vec(q.lat, q.lon, 1.009)); b.copy(vec(q.lat + w[1] * .16, q.lon + w[0] * .16 / cl, 1.009));
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
      const life = Math.sin(Math.PI * q.age / q.life), br = life * Math.min(1, .35 + sp / 10);
      col.set([0, 0, 0, br, br, br], i * 6);
    });
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }
  // The grid comes from the edition's pointer; without one, only a grid from the edition's own day is used.
  function wxLoad() {
    const g = WX?.grid, path = g?.path || (M.date ? `weather/${M.date}.json` : null); if (!path) return;
    fetch(`data/${path}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.fields || !d.grid) return;
      if (!g?.path && !(String(d.time || '').startsWith(M.date))) return;
      const { nlat, nlon, lat0, dlat, lon0, dlon } = d.grid, n = nlat * nlon, buf = new Uint8Array(4 * n), F = d.fields, cl = v => Math.max(0, Math.min(255, Math.round(v)));
      for (let i = 0; i < n; i++) {
        const t = F.t2m[i] == null ? 10 : F.t2m[i] / 10, pr = F.precip[i] == null ? 0 : F.precip[i] / 10, pm = F.pmsl[i] == null ? 1013 : F.pmsl[i] / 10;
        buf.set([cl((t + 40) / 85 * 255), cl(Math.sqrt(Math.min(pr, 8) / 8) * 255), cl((pm - 940) / 120 * 255), cl((F.cloud?.[i] ?? 0) * 2.55)], i * 4);
      }
      const tex = new THREE.DataTexture(buf, nlon, nlat, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
      wxMat.uniforms.field.value = tex; wxMat.uniforms.g1.value.set(lat0, Math.abs(dlat), lon0, dlon); wxMat.uniforms.g2.value.set(nlat, nlon);
      wxGrid = d; if (lens === 'weather') { lens = null; setLens('weather'); }
    }).catch(() => {});
  }

  // Crisp coastlines from the record's basemap rings, drawn just above the surface.
  {
    const pts = [];
    for (const ring of F.world || []) {
      if (!Array.isArray(ring)) continue;
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i];
        if (Math.abs(a[0] - b[0]) > 180) continue;
        const pa = vec(a[1], a[0], 1.0016), pb = vec(b[1], b[0], 1.0016);
        pts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    coast = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PAL.hex.coast ?? 0xe6c4ec, transparent: true, opacity: PAL.coastA ?? .34, depthWrite: false }));
    scene.add(coast);
  }

  // Faint dust far behind, purely atmospheric (not a star chart).
  const dust = (() => {
    const n = 1400, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 30, s = Math.sqrt(1 - u * u); arr.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: PAL.hex.dust ?? 0xb9b6e8, size: 1.1, sizeAttenuation: false, transparent: true, opacity: .32, depthWrite: false }));
    scene.add(p); return p;
  })();

  // ---------- The sky over the observer (real positions from sky.js) ----------
  const UP = vec(S.observer.lat, S.observer.lon, 1).normalize();
  const NORTH = new THREE.Vector3(0, 1, 0).sub(UP.clone().multiplyScalar(UP.y)).normalize();
  const EAST = new THREE.Vector3().crossVectors(NORTH, UP).normalize();
  const EYE = UP.clone().multiplyScalar(1.008);
  const SKY_R = 40;
  function dirAltAz(alt, az) {
    const a = alt * D, z = az * D;
    return new THREE.Vector3().addScaledVector(EAST, Math.cos(a) * Math.sin(z)).addScaledVector(NORTH, Math.cos(a) * Math.cos(z)).addScaledVector(UP, Math.sin(a)).normalize();
  }
  const skyPoint = (alt, az) => EYE.clone().addScaledVector(dirAltAz(alt, az), SKY_R);
  const SUN_SKY = dirAltAz(S.sun.alt, S.sun.az);
  const skyGroup = new THREE.Group(); skyGroup.visible = false; scene.add(skyGroup);
  const backdropMat = new THREE.ShaderMaterial({
    uniforms: { up: { value: UP }, sunD: { value: SUN_SKY }, center: { value: EYE }, fade: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 up; uniform vec3 sunD; uniform vec3 center; uniform float fade; varying vec3 vW;
      void main(){ vec3 d=normalize(vW-center); float alt=dot(d,up); float sc=dot(d,sunD);
        vec3 col=mix(${gv('skyHi',[.09,.11,.25])},${gv('skyLo',[.018,.028,.080])},smoothstep(-.02,.75,alt));
        col+=pow(max(sc,0.),12.)*smoothstep(.22,-.03,alt)*${gv('sunset',[1,.55,.34])}*.9;
        col+=pow(max(sc,0.),3.)*smoothstep(.45,0.,alt)*${gv('skyGlow',[.42,.26,.54])}*.38;
        gl_FragColor=vec4(col,fade); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false
  });
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(46, 64, 32), backdropMat);
  backdrop.position.copy(EYE); backdrop.renderOrder = -1; skyGroup.add(backdrop);

  // Stars and planets: brightness honours the dawn (the Sun is just below the horizon), so faint stars fade out.
  function visibility(alt, az, mag) {
    if (alt < 1) return 0;
    const glow = Math.max(0, dirAltAz(alt, az).dot(SUN_SKY));
    const limit = 2.6 - 1.7 * Math.pow(glow, 3) - (alt < 12 ? (12 - alt) / 12 * 0.9 : 0);
    return clamp01((limit - mag) / 1.1);
  }
  const PLANET_MAG = { Mercury: 0, Venus: -4, Mars: 1.5, Jupiter: -2.2, Saturn: 0.6 };
  const skyObjs = [];
  for (const s of S.stars) { const a = visibility(s.alt, s.az, s.mag); if (a > 0.02) skyObjs.push({ p: skyPoint(s.alt, s.az), size: Math.max(1.6, 5.2 - s.mag * 1.3), alpha: a, color: PAL.gl.star || [0.86, 0.88, 1] }); }
  for (const b of upBodies) skyObjs.push({ p: skyPoint(b.alt, b.az), size: b.name === 'Jupiter' ? 8.5 : 6.2, alpha: clamp01(visibility(b.alt, b.az, PLANET_MAG[b.name] ?? 1) + 0.25), color: b.name === 'Mars' ? [1, .72, .58] : [1, .95, .86] });
  const starMat = new THREE.ShaderMaterial({
    uniforms: { fade: { value: 0 }, pr: { value: renderer.getPixelRatio() }, ink: { value: 0 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float pr;
      void main(){ vA=aAlpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*pr; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float fade; uniform float ink; varying float vA; varying vec3 vC;
      void main(){ float r=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,r); a=a*a; gl_FragColor=vec4(mix(vC, ${gv('starInk',[.20,.16,.34])}, ink), a*vA*fade); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(skyObjs.flatMap(o => [o.p.x, o.p.y, o.p.z]), 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(skyObjs.map(o => o.size), 1));
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(skyObjs.map(o => o.alpha), 1));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(skyObjs.flatMap(o => o.color), 3));
    skyGroup.add(new THREE.Points(geo, starMat));
  }
  // Constellation figures, only where every star in a segment is above the horizon.
  const starBy = Object.fromEntries(S.stars.map(s => [s.name, s]));
  const figVisible = [];
  const figMat = new THREE.LineBasicMaterial({ color: PAL.hex.fig ?? 0xcfc6ff, transparent: true, opacity: 0, depthWrite: false });
  {
    const pts = [];
    for (const f of S.figures) {
      const segs = f.segments.filter(([a, b]) => starBy[a] && starBy[b] && starBy[a].alt > 3 && starBy[b].alt > 3);
      if (segs.length < f.segments.length * 0.6 || !segs.length) continue;
      const members = new Set(segs.flat());
      figVisible.push({ name: f.name, members: [...members].map(n => starBy[n]) });
      for (const [a, b] of segs) { const pa = skyPoint(starBy[a].alt, starBy[a].az), pb = skyPoint(starBy[b].alt, starBy[b].az); pts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    skyGroup.add(new THREE.LineSegments(geo, figMat));
  }

  // DOM labels for the sky
  const skyLabels = $('#skylabels');
  const skyTags = [];
  function tag(cls, p, html) { const el = document.createElement('div'); el.className = 'sk ' + cls; if (html) el.innerHTML = html; skyLabels.append(el); skyTags.push({ el, p }); return el; }
  for (const b of upBodies) {
    const el = tag('planet', skyPoint(b.alt, b.az), '<b></b><span></span>');
    el.querySelector('b').textContent = b.name; el.querySelector('span').textContent = `${Math.round(b.alt)}° up`;
  }
  for (const f of figVisible) {
    // centroid as a vector mean, so figures straddling north (azimuth 359°/1°) label correctly
    const p = new THREE.Vector3(); f.members.forEach(m => p.add(skyPoint(m.alt, m.az))); p.divideScalar(f.members.length);
    tag('figure', p).textContent = f.name;
  }
  const sunTag = tag('sun', skyPoint(0.6, S.sun.az), '<b>Sun</b><span></span>'); sunTag.querySelector('span').textContent = `rises ${S.sunrise_local}`;
  const moonP = skyPoint(S.moon.alt, S.moon.az), sunFar = EYE.clone().addScaledVector(SUN_SKY, SKY_R);
  const moonTag = tag('moon', moonP, '<canvas width="68" height="68"></canvas><b>Moon</b><span></span>');
  moonTag.querySelector('span').textContent = `${Math.round(S.moon.illumination)}%, ${S.moon.waxing ? 'waxing' : 'waning'}`;
  const moonCanvas = moonTag.querySelector('canvas');
  function drawMoon(ang) {
    const c = moonCanvas.getContext('2d'), s = moonCanvas.width, r = s * 0.36, k = S.moon.illumination / 100;
    c.clearRect(0, 0, s, s); c.save(); c.translate(s / 2, s / 2); c.rotate(ang);
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = 'rgba(150,160,205,.16)'; c.fill();
    c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    c.ellipse(0, 0, Math.max(0.01, Math.abs(r * (1 - 2 * k))), r, 0, Math.PI / 2, -Math.PI / 2, k < 0.5);
    c.shadowColor = 'rgba(255,236,210,.9)'; c.shadowBlur = s * 0.12; c.fillStyle = PC.hot; c.fill(); c.restore();
  }

  // ---------- The heavens: a celestial sphere around the Earth (real stars, the zodiac belt, the planets) ----------
  // Equatorial coordinates map onto the Earth-fixed frame through sidereal time: a body at RA/Dec sits above the
  // point on Earth where it is directly overhead (lat = Dec, lon = RA − GMST). Built for the NYSE open, then turned
  // with the clock, so the sky stays honest as the Earth turns.
  const SR = 1.62, EPS = S.sphere.eps * D;
  const wrapLon = l => ((l + 540) % 360) - 180;
  const gmstDeg = ms => (280.46061837 + 360.98564736629 * (ms / 86400000 + 2440587.5 - 2451545.0)) % 360;
  const G0 = gmstDeg(OPEN);
  function eclToEq(lon, lat) {
    const l = lon * D, b = lat * D;
    const ra = Math.atan2(Math.sin(l) * Math.cos(EPS) - Math.tan(b) * Math.sin(EPS), Math.cos(l));
    const dec = Math.asin(Math.sin(b) * Math.cos(EPS) + Math.cos(b) * Math.sin(EPS) * Math.sin(l));
    return { ra: (ra / D + 360) % 360, dec: dec / D };
  }
  const eqPoint = (ra, dec, r = SR) => vec(dec, ((ra - G0 + 540) % 360) - 180, r);
  const eclPoint = (lon, lat = 0, r = SR) => { const q = eclToEq(lon, lat); return eqPoint(q.ra, q.dec, r); };
  const heaven = new THREE.Group(); scene.add(heaven);
  const hvMats = [];
  // zodiac belt: the ecliptic ±8°, brightest along the Sun's path
  const bandMat = new THREE.ShaderMaterial({
    uniforms: { fade: { value: 0 }, dayMode: { value: 0 } },
    vertexShader: `attribute float side; varying float vS; void main(){ vS=side; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float fade; uniform float dayMode; varying float vS; void main(){ float a=pow(1.-abs(vS),1.7)*.17; gl_FragColor = dayMode > .5 ? vec4(${gv('bandDay',[.42,.30,.62])}, a*fade*1.6) : vec4(${gv('band',[.80,.68,1])}*a*fade,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  {
    const pos = [], side = [], idx = [], rows = [-8, -4, 0, 4, 8], N = 180;
    for (let i = 0; i <= N; i++) for (const b of rows) { const p = eclPoint(i * 2, b); pos.push(p.x, p.y, p.z); side.push(b / 8); }
    for (let i = 0; i < N; i++) for (let r = 0; r < rows.length - 1; r++) { const a = i * rows.length + r, c = (i + 1) * rows.length + r; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1)); g.setIndex(idx);
    heaven.add(new THREE.Mesh(g, bandMat));
  }
  function lineMat(color, base) { const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }); m.userData.base = base; hvMats.push(m); return m; }
  {
    const pts = []; for (let i = 0; i < 360; i += 2) { const a = eclPoint(i), b = eclPoint(i + 2); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let k = 0; k < 12; k++) { const a = eclPoint(k * 30, -8), b = eclPoint(k * 30, 8); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    heaven.add(new THREE.LineSegments(g, lineMat(PAL.hex.ecl ?? 0xd9c8ff, 0.42)));
    // the celestial axis through the poles, armillary-style
    const ax = new THREE.BufferGeometry(); const n1 = eqPoint(0, 90, SR * 1.16), n2 = eqPoint(0, -90, SR * 1.16);
    ax.setAttribute('position', new THREE.Float32BufferAttribute([n1.x, n1.y, n1.z, n2.x, n2.y, n2.z], 3));
    heaven.add(new THREE.LineSegments(ax, lineMat(PAL.hex.axis ?? 0xbfb6e6, 0.28)));
  }
  // real stars and the constellation figures on the shell
  const hvStarMat = starMat.clone(); hvStarMat.uniforms = { fade: { value: 0 }, pr: { value: renderer.getPixelRatio() }, ink: { value: 0 } };
  {
    const st = S.sphere.stars, P = [], Sz = [], A = [], C = [];
    for (const s of st) { const p = eqPoint(s.ra, s.dec); P.push(p.x, p.y, p.z); Sz.push(Math.max(1.4, 4.6 - s.mag * 1.2)); A.push(Math.min(1, 0.55 + (2.2 - s.mag) * 0.2)); C.push(...(PAL.gl.star || [0.86, 0.88, 1])); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(Sz, 1));
    g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(A, 1)); g.setAttribute('aColor', new THREE.Float32BufferAttribute(C, 3));
    heaven.add(new THREE.Points(g, hvStarMat));
    const byName = Object.fromEntries(st.map(s => [s.name, s])), pts = [];
    for (const f of S.figures) for (const [a, b] of f.segments) { if (!byName[a] || !byName[b]) continue; const pa = eqPoint(byName[a].ra, byName[a].dec), pb = eqPoint(byName[b].ra, byName[b].dec); pts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    heaven.add(new THREE.LineSegments(lg, lineMat(PAL.hex.figs ?? 0xc9c2f0, 0.16)));
  }
  // planets on the belt
  const hvBodies = S.chart.bodies.map(b => ({ ...b, p: eclPoint(b.lon, b.lat) }));
  const hvPlanetMat = starMat.clone(); hvPlanetMat.uniforms = { fade: { value: 0 }, pr: { value: renderer.getPixelRatio() }, ink: { value: 0 } };
  {
    const COL = { Sun: [1, .86, .6], Moon: [1, .97, .92], Mars: [1, .66, .55], Venus: [1, .95, .85], Jupiter: [1, .93, .82], Saturn: [.95, .9, .78], Mercury: [.9, .92, 1], Uranus: [.75, .95, 1], Neptune: [.7, .8, 1] };
    const SIZE = { Sun: 16, Moon: 0, Jupiter: 10, Venus: 10, Saturn: 8, Mars: 8, Mercury: 7, Uranus: 6, Neptune: 6 };
    const list = hvBodies.filter(b => SIZE[b.name]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap(b => [b.p.x, b.p.y, b.p.z]), 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(list.map(b => SIZE[b.name]), 1));
    g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(list.map(() => 1), 1));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(list.flatMap(b => COL[b.name] || [1, 1, 1]), 3));
    heaven.add(new THREE.Points(g, hvPlanetMat));
  }
  // aspects as great-circle arcs across the shell; harmonious in cool light, hard ones warm
  const hvByName = Object.fromEntries(hvBodies.map(b => [b.name, b]));
  const ECL_POLE = eclPoint(0, 90, 1).normalize();
  // The heavens shot: lifted ~19° above the ecliptic plane so the belt reads as a ring, facing the Moon–Jupiter side
  {
    const inPlane = eclPoint(126, 0, 1).normalize(), dir = inPlane.multiplyScalar(Math.cos(19 * D)).add(ECL_POLE.clone().multiplyScalar(Math.sin(19 * D))).normalize();
    const hvView = { lat: Math.asin(dir.y) / D, lon: wrapLon(Math.atan2(dir.z, -dir.x) / D - 180), dist: 7.3 };
    CHAPTERS.find(c => c.heavens).view = hvView;
  }
  const arcs = [];
  const ASP_COL = { Trine: PAL.hex.aspCool ?? 0xa9c8ff, Sextile: PAL.hex.aspCool ?? 0xa9c8ff, Square: PAL.hex.aspHot ?? 0xff9fb4, Opposition: PAL.hex.aspHot ?? 0xff9fb4, Conjunction: PAL.hex.aspConj ?? 0xffd9a8 };
  const aspList = [...S.chart.aspects.filter(a => a.orb <= 5), { a: 'Moon', b: 'Jupiter', aspect: 'Conjunction', orb: S.chart.moon_to_jupiter, applying: true }];
  for (const a of aspList) {
    const A = hvByName[a.a], B = hvByName[a.b]; if (!A || !B) continue;
    const ua = A.p.clone().normalize(), ub = B.p.clone().normalize(), ang = ua.angleTo(ub), pts = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48, s1 = Math.sin((1 - t) * ang) / Math.sin(ang), s2 = Math.sin(t * ang) / Math.sin(ang);
      // bow the arc out of the belt: harmonious aspects rise above it, hard aspects dip below, conjunctions a small lift
      const lift = (a.aspect === 'Square' || a.aspect === 'Opposition' ? -1 : 1) * (a.aspect === 'Conjunction' ? 0.12 : 0.32) * Math.sin(Math.PI * t);
      const q = ua.clone().multiplyScalar(s1).add(ub.clone().multiplyScalar(s2)).normalize().multiplyScalar(SR).addScaledVector(ECL_POLE, lift * SR);
      pts.push(q.x, q.y, q.z);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = lineMat(ASP_COL[a.aspect] || 0xffffff, 0.22);
    heaven.add(new THREE.Line(g, m));
    arcs.push({ key: `${a.a}–${a.b}`, keys: [`${a.a}–${a.b}`, `${a.b}–${a.a}`], m, names: [a.a, a.b] });
  }
  // labels: planets (glyph + name), the twelve signs (quiet), the Moon as a phase-correct crescent
  hvLabels = $('#heavenlabels'); const hvTags = [];
  const ZG = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'], ZN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  for (let k = 0; k < 12; k++) { const e = el('div', 'hz'); e.textContent = ZG[k] + '\uFE0E'; e.title = ZN[k]; hvLabels.append(e); hvTags.push({ el: e, p: eclPoint(k * 30 + 15, 11), kind: 'sign' }); }
  for (const b of hvBodies) {
    if (b.name === 'Moon') continue;
    const e = el('div', 'hp'); e.dataset.name = b.name;
    e.append(el('i', '', b.glyph + '\uFE0E'), el('b', '', b.name), el('span', '', `${Math.round(b.degree)}° ${b.sign}${b.retrograde ? ' ℞' : ''}`));
    hvLabels.append(e); hvTags.push({ el: e, p: b.p, kind: 'planet', name: b.name });
  }
  const hvMoon = el('div', 'hp moon'); hvMoon.dataset.name = 'Moon';
  const hvMoonCanvas = document.createElement('canvas'); hvMoonCanvas.width = hvMoonCanvas.height = 56;
  hvMoon.append(hvMoonCanvas, el('b', '', 'Moon'), el('span', '', `${Math.round(hvByName.Moon.degree)}° ${hvByName.Moon.sign} · ${S.chart.moon_phase}`));
  hvLabels.append(hvMoon); hvTags.push({ el: hvMoon, p: hvByName.Moon.p, kind: 'planet', name: 'Moon' });
  function highlight(refs) {
    if (!hvLabels) return;
    hvLit = new Set(refs);
    hvLabels.querySelectorAll('.hp').forEach(e => e.classList.toggle('hi', hvLit.has(e.dataset.name) || [...hvLit].some(r => r.includes('–') && r.split('–').includes(e.dataset.name))));
    hvLabels.classList.toggle('focusing', hvLit.size > 0);
  }
  // your natal planets as gold rings on the belt, so a transit is literally visible (Jupiter sitting on your Venus)
  const natalMat = new THREE.ShaderMaterial({
    uniforms: { fade: { value: 0 }, pr: { value: renderer.getPixelRatio() } },
    vertexShader: `uniform float pr; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=13.*pr; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float fade; void main(){ float r=length(gl_PointCoord-.5); float a=smoothstep(.06,.0,abs(r-.36)); gl_FragColor=vec4(1.,.84,.6,a*fade*.9); }`,
    transparent: true, depthWrite: false
  });
  if (P) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.natal.flatMap(n => { const q = eclPoint(n.lon, 0); return [q.x, q.y, q.z]; }), 3));
    heaven.add(new THREE.Points(g, natalMat));
    for (const n of P.natal) {
      const e = el('div', 'hp natal'); e.dataset.name = 'natal:' + n.name;
      e.append(el('i', '', n.glyph + '\uFE0E'), el('b', '', 'your ' + n.name));
      hvLabels.append(e); hvTags.push({ el: e, p: eclPoint(n.lon, 0), kind: 'natal', name: 'natal:' + n.name });
    }
  }
  let heavensOn = true, hv = 0;
  $('[data-layer]').addEventListener('click', e => { heavensOn = !heavensOn; e.currentTarget.setAttribute('aria-pressed', String(heavensOn)); e.currentTarget.textContent = `Heavens layer · ${heavensOn ? 'on' : 'off'}`; });
  const v3b = new THREE.Vector3();
  function hiddenByEarth(p) {
    const o = camera.position; v3b.copy(p).sub(o); const L = v3b.length(); v3b.divideScalar(L);
    const b = o.dot(v3b), c = o.lengthSq() - 1.0, disc = b * b - c; if (disc < 0) return false;
    const t = -b - Math.sqrt(disc); return t > 0 && t < L;
  }
  const hvWorld = new THREE.Vector3();
  function drawCrescent(cv, ang, k) {
    const c = cv.getContext('2d'), s = cv.width, r = s * 0.34; c.clearRect(0, 0, s, s); c.save(); c.translate(s / 2, s / 2); c.rotate(ang);
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = 'rgba(150,160,205,.18)'; c.fill();
    c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); c.ellipse(0, 0, Math.max(0.01, Math.abs(r * (1 - 2 * k))), r, 0, Math.PI / 2, -Math.PI / 2, k < 0.5);
    c.shadowColor = 'rgba(255,236,210,.9)'; c.shadowBlur = s * 0.14; c.fillStyle = PC.hot; c.fill(); c.restore();
  }
  function updateHeavens() {
    hvLabels.style.opacity = String(clamp01((hv - 0.25) / 0.55));
    hvLabels.classList.toggle('full', hv > 0.7);
    if (hv < 0.05) return;
    const blocks = [$('.bar'), leftPanel(), $('.call')].map(e => e.getBoundingClientRect());
    const hits = r => blocks.some(q => r.right > q.left - 6 && r.left < q.right + 6 && r.bottom > q.top - 6 && r.top < q.bottom + 6);
    // nearest labels claim space first; later ones try a small nudge, then step aside
    const placed = [], over = r => placed.some(q => r.right > q.left - 2 && r.left < q.right + 2 && r.bottom > q.top - 1 && r.top < q.bottom + 1);
    const order = hvTags.map(t => { hvWorld.copy(t.p).applyMatrix4(heaven.matrixWorld); return { t, w: hvWorld.clone(), d: hvWorld.distanceTo(camera.position) + (t.kind === 'sign' ? 100 : t.kind === 'natal' ? (hvLit.has(t.name) ? -50 : 60) : 0) }; }).sort((a, b) => a.d - b.d);
    for (const { t, w } of order) {
      const s = toScreen(w);
      if (!s.front || hiddenByEarth(w)) { t.el.style.display = 'none'; continue; }
      t.el.style.display = 'block'; t.el.style.visibility = 'hidden';
      let ok = false;
      for (const dy of [0, 15, -15, 30]) {
        t.el.style.transform = `translate(${s.x}px,${s.y + dy}px)`;
        const r = t.el.getBoundingClientRect();
        if (r.right > 0 && r.left < innerWidth && !hits(r) && !over(r)) { placed.push(r); ok = true; break; }
      }
      t.el.style.visibility = ok ? 'visible' : 'hidden';
    }
    const m = toScreen(hvWorld.copy(hvByName.Moon.p).applyMatrix4(heaven.matrixWorld)), sp = toScreen(hvWorld.copy(hvByName.Sun.p).applyMatrix4(heaven.matrixWorld));
    drawCrescent(hvMoonCanvas, Math.atan2(sp.y - m.y, sp.x - m.x), S.moon.illumination / 100);
  }

  // ---------- Background: a very faint Milky Way along the galaxy's real plane ----------
  // Galactic north pole RA 192.859° Dec +27.128°, galactic centre RA 266.405° Dec −28.936° (J2000). The band is procedural
  // texture placed on the true plane, so the empty black reads as deep sky without inventing data.
  const galaxy = new THREE.Group(); scene.add(galaxy);
  const mwMat = new THREE.ShaderMaterial({
    uniforms: { gp: { value: eqPoint(192.859, 27.128, 1).normalize() }, gc: { value: eqPoint(266.405, -28.936, 1).normalize() }, fade: { value: 1 } },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 gp; uniform vec3 gc; uniform float fade; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d=normalize(vD); float b=asin(clamp(dot(d,gp),-1.,1.));
        float band=exp(-pow(b/.19,2.)); float core=pow(max(dot(d,gc),0.),4.)*exp(-pow(b/.26,2.));
        float cloud=fbm(d*5.5+3.1); float rift=smoothstep(.55,.75,fbm(d*9.+11.))*exp(-pow(b/.05,2.));
        float glow=(band*(.55+.9*cloud)+core*1.1)*(1.-.75*rift);
        // a faint all-sky haze so no view is a flat void, plus the band where the galaxy really is
        float haze=.30*pow(fbm(d*2.6+7.7),2.2)+.08;
        vec3 c=mix(${gv('mw0',[.20,.20,.42])},${gv('mw1',[.52,.42,.62])},cloud)*glow*.16+mix(${gv('haze0',[.10,.10,.22])},${gv('haze1',[.22,.16,.30])},cloud)*haze*.20;
        // fine star dust, denser toward the plane
        vec3 g=floor(d*640.); float r=h(g); float thr=.9952-.008*band; float st=step(thr,r)*(r-thr)/(1.-thr);
        c+=${gv('dustStar',[.80,.82,1])}*st*.22;
        gl_FragColor=vec4(c*fade,1.);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const mw = new THREE.Mesh(new THREE.SphereGeometry(90, 96, 64), mwMat); mw.renderOrder = -2; galaxy.add(mw);

  // ---------- The orrery: the deck as a camera move ----------
  let orreryOpen = false, beforeOrrery = null;
  const camRight = new THREE.Vector3(), origin = new THREE.Vector3(0, 0, 0), edge = new THREE.Vector3();
  function orreryDist() {
    const H = innerHeight, W = innerWidth, target = phone() ? Math.min(W * .21, 84) : Math.min(H * .18, W * .115);
    return H / (2 * Math.tan(16 * D) * target) / distMul;
  }
  addEventListener('orrery', e => {
    if (e.detail.open) {
      if (think) finishThinking();
      orreryOpen = true; beforeOrrery = { chapter, mode: uiMode };
      stack = []; inspEl.hidden = true; document.body.classList.remove('insp-open'); deselect(); highlight([]); togglePop(false);
      const v = { lat: 14, lon: cam.lon, dist: orreryDist() };
      if (viewMode === 'sky' || (viewMode === 'trans' && trans.toMode === 'sky')) startTrans(poseOrbit(v), 'orbit', 3000, () => Object.assign(cam, v));
      else flyTo(v, 2200);
      quietUntil = performance.now() + 2400;
    } else {
      orreryOpen = false;
      const b = beforeOrrery || { chapter: 0, mode: 'brief' };
      if (b.mode === 'explore') { stack = [{ view: 'index', arg: 'places' }]; renderInsp(); globe.explore(); }
      else { const c = CHAPTERS[b.chapter] || CHAPTERS[0]; if (c.sky) go(b.chapter); else { flyTo(c.view, 2000); if (c.place) setTimeout(() => { if (!orreryOpen) selectPlace(c.place, false); }, 1600); } }
    }
  });
  function layoutOrrery() {
    const c = toScreen(origin);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const e = toScreen(edge.copy(camRight));
    window.SixSevenDeck?.layout(c.x, c.y, Math.hypot(e.x - c.x, e.y - c.y));
  }

  const look = 'glass';

  // ---------- Camera ----------
  const cam = { lat: 8, lon: -168, dist: 14 };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const wrap = l => ((l + 540) % 360) - 180;
  function flyTo(view, ms) {
    home = { lat: view.lat, lon: view.lon, dist: view.dist }; realignAt = 0;
    if (reduced || ms === 0) { Object.assign(cam, view); flight = null; return; }
    const from = { ...cam }, dLon = wrap(view.lon - from.lon);
    const arc = Math.min(1.4, Math.hypot(dLon, view.lat - from.lat) / 80);
    flight = { from, to: view, dLon, arc, start: performance.now(), ms: ms ?? (1900 + arc * 900) };
  }
  const dummy = new THREE.PerspectiveCamera();
  function poseOrbit(view) { home = { lat: view.lat, lon: view.lon, dist: view.dist }; const p = vec(view.lat, view.lon, view.dist * distMul); dummy.position.copy(p); dummy.up.set(0, 1, 0); dummy.lookAt(0, 0, 0); return { pos: p, quat: dummy.quaternion.clone(), fov: 32 }; }
  function poseSky(drift = 0) {
    const look = dirAltAz(skyLook.alt + Math.sin(drift / 9000) * 1.2, skyLook.az + Math.sin(drift / 7000) * 2.6);
    dummy.position.copy(EYE); dummy.up.copy(UP); dummy.lookAt(EYE.clone().add(look));
    return { pos: EYE.clone(), quat: dummy.quaternion.clone(), fov: phone() ? 64 : 70 };
  }
  function startTrans(to, toMode, ms, after) {
    trans = { from: { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov }, to, toMode, start: performance.now(), ms: reduced ? 0 : ms, after, ctrl: UP.clone().multiplyScalar(2.6) };
    viewMode = 'trans'; flight = null;
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    distMul = phone() ? 1.58 : 1.05;
    if (phone()) camera.setViewOffset(w, h, 0, h * 0.17, w, h); else camera.setViewOffset(w, h, -w * 0.15, 0, w, h);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ---------- Markers, pings, leader line and card ----------
  const marksEl = $('#marks'), leader = $('#leader'), leaderPath = leader.querySelector('path'), leaderDot = leader.querySelector('circle');
  markers = places.map(m => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mk'; b.dataset.name = m.place; b.setAttribute('aria-label', `${m.place}, ${m.count} references`);
    b.style.setProperty('--r', `${Math.round(9 + Math.min(14, m.count) * .9)}px`);
    b.addEventListener('click', e => { e.stopPropagation(); inspect('place', m.place); });
    marksEl.append(b);
    return { m, b, p: vec(m.lat, m.lon, 1.002) };
  });
  // Places a few miles apart (San Francisco and Silicon Valley) would draw two rings almost on top of each other, which
  // reads as one ring drawn off-centre. Keep the busier one's ring; the other stays reachable from the map and search.
  { const kept = [];
    for (const x of [...markers].sort((a, b) => b.m.count - a.m.count)) {
      const near = kept.find(k => k.p.angleTo(x.p) < 1.6 * D);
      if (near) { x.dup = true; x.b.hidden = true; near.b.setAttribute('aria-label', `${near.b.getAttribute('aria-label')}, with ${x.m.place} nearby`); } else kept.push(x);
    } }
  function ping(name) {
    const m = places.find(p => p.place === name); if (!m) return;
    const el = document.createElement('div'); el.className = 'ping'; marksEl.append(el);
    pings.push({ el, p: vec(m.lat, m.lon, 1.002), until: performance.now() + 2600 });
  }
  // Focus: the place (or a market's home) the globe is pointing at. 'tag' is a small label on the globe used by the
  // story chapters; 'insp' draws a leader from the place to the inspector.
  let selMode = 'tag';
  const ptag = $('#ptag');
  function pingAt(lat, lon) { const e = document.createElement('div'); e.className = 'ping'; marksEl.append(e); pings.push({ el: e, p: vec(lat, lon, 1.002), until: performance.now() + 2600 }); }
  function focusOn(target, mode, fly) {
    selected = target; selMode = mode;
    markers.forEach(x => x.b.classList.toggle('sel', x.m.place === target.place));
    if (mode === 'tag') {
      ptag.replaceChildren(); const b = el('b', '', target.place); const s2 = el('span', '', `${target.count} ref${target.count === 1 ? '' : 's'}`);
      const o = el('button', '', 'Open'); o.type = 'button'; o.addEventListener('click', () => inspect('place', target.place));
      ptag.append(b, s2, o); ptag.hidden = false;
    } else ptag.hidden = true;
    if (!places.includes(target)) pingAt(target.lat, target.lon);
    if (fly) {
      if (viewMode !== 'orbit') return;
      flyTo({ lat: Math.max(-55, Math.min(60, target.lat - 3)), lon: target.lon + (phone() ? 0 : 7), dist: 2.3 });
      quietUntil = performance.now() + 9000;
    }
  }
  function selectPlace(name, fly) {
    const m = places.find(p => p.place === name); if (!m) return;
    if (fly) inspect('place', name); else focusOn(m, 'tag', false);
  }
  function deselect() { selected = null; markers.forEach(x => x.b.classList.remove('sel')); ptag.hidden = true; leader.style.display = 'none'; }
  globe.look = target => { if (!target) { if (selected && selMode === 'insp') deselect(); return; } focusOn(target, 'insp', true); };
  globe.explore = () => {
    const v = { lat: 20, lon: -40, dist: 3.6 };
    highlight([]); chapter = IDX('explore'); railUI(chapter); document.body.dataset.chapter = 'explore';
    if (viewMode === 'sky' || (viewMode === 'trans' && trans.toMode === 'sky')) startTrans(poseOrbit(v), 'orbit', 3000, () => Object.assign(cam, v));
    else flyTo(v);
    quietUntil = performance.now() + 2600;
  };
  globe.brief = () => markChapter(chapter < 0 ? 0 : chapter);
  globe.depth = () => {
    highlight([]); const v = { lat: 16, lon: cam.lon, dist: 4.1 };
    if (viewMode === 'sky' || (viewMode === 'trans' && trans.toMode === 'sky')) startTrans(poseOrbit(v), 'orbit', 3000, () => Object.assign(cam, v));
  };

  // ---------- Lenses: in Explore, the index tab decides what the lights on the globe mean ----------
  const lensEl = $('#lens'), lensKey = $('#lens-key');
  const KEYS = {
    places: ['Places', 'Lights are places in the record. Brighter means more stories and moves point there.'],
    markets: ['Markets', 'Where each market trades or is based. Mint rose today, pink fell. Bigger means more of them there.'],
    headlines: ['Who covered it', 'Each ring is the stories placed there, split by the outlet’s lean: blue left, white center, coral right, grey wire.'],
    mood: ['The world’s mood', 'The glow over each country is how its news sounds today: rose where it’s darker than the world’s average, cool where it’s brighter, deeper where it also turned darker than usual. Faint lines are the traditional planetary lines (tradition, not measurement).'],
    weather: ['Weather', 'The places whose weather reaches a price, plus home.'],
  };
  let lens = 'places', lensItems = [], lensGain = 1;
  const tempCol = t => t >= 88 ? PC.warm2 : t >= 75 ? PC.warm : t >= 60 ? PC.ink : PC.cool;
  const sgnPct = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%';
  // build() draws the marker and returns its radius r and the label's offset from the point
  function pointItem(host, cls, p, pri, open, build) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ln ' + cls;
    const { r, off } = build(b); b.addEventListener('click', e => { e.stopPropagation(); open(); }); host.append(b);
    return { b, p, pri, r, off, top: cls === 'wx' ? -13 : -10, side: 1, tx: b.querySelector('.tx'), w: 0, h: 0 };
  }
  const lensItem = (cls, lat, lon, pri, open, build) => pointItem(lensEl, cls, vec(lat, lon, 1.004), pri, open, build);
  const lensText = (b, title, sub, left) => { const t = el('span', 'tx'); t.style.left = left + 'px'; t.append(el('b', '', title)); if (sub) t.append(el('span', '', sub)); b.append(t); };
  function buildLens(kind) {
    lensEl.replaceChildren(); lensItems = [];
    if (kind === 'markets') {
      const homes = {}; X.instruments.forEach(i => { if (i.home) (homes[i.home.place] ||= { ...i.home, list: [] }).list.push(i); });
      for (const h of Object.values(homes)) {
        const avg = h.list.reduce((a, i) => a + i.change_pct, 0) / h.list.length, top = [...h.list].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
        lensItems.push(lensItem('mk2', h.lat, h.lon, Math.abs(top[0].change_pct) + h.list.length * .15, () => inspect('place', h.place), b => {
          const sz = 7 + Math.min(14, h.list.length * 1.4); b.style.setProperty('--s', sz + 'px'); b.style.setProperty('--c', avg >= 0 ? PC.up : PC.down);
          b.append(el('i', 'dot')); b.setAttribute('aria-label', `${h.place}: ${h.list.length} market${h.list.length === 1 ? '' : 's'}`);
          lensText(b, h.place, top.slice(0, 2).map(i => `${i.label} ${sgnPct(i.change_pct)}`).join(' · ') + (h.list.length > 2 ? ` · ${h.list.length - 2} more` : ''), sz / 2 + 8);
          return { r: sz / 2 + 2, off: sz / 2 + 8 };
        }));
      }
    } else if (kind === 'mood' && WM) {
      const avgT = WM_PLACED.reduce((a, c) => a + c.tone * c.articles, 0) / WM_PLACED.reduce((a, c) => a + c.articles, 0);
      const keep = new Set([...WM_PLACED].sort((a, b) => (Math.abs(b.tone_vs_baseline || 0) * 3 + Math.abs(b.tone - avgT)) - (Math.abs(a.tone_vs_baseline || 0) * 3 + Math.abs(a.tone - avgT))).slice(0, 12).map(c => c.country));
      for (const c of WM_PLACED.filter(c => keep.has(c.country))) {
        const d = typeof c.tone_vs_baseline === 'number' ? c.tone_vs_baseline : 0, al = Math.abs(d) >= 1 ? skyLineNear(c.lat, c.lon) : null, sz = 6 + Math.min(16, Math.log10(c.articles) * 4);
        lensItems.push(lensItem('mk2', c.lat, c.lon, Math.abs(d) * 3 + Math.log10(c.articles), () => inspect('country', c.country), b => {
          b.classList.add('mood-l'); b.style.setProperty('--c', c.tone - avgT < -.6 || d <= -1 ? PC.down : c.tone - avgT > .6 || d >= 1 ? PC.up : PC.series2);
          b.append(el('i', 'tick')); b.setAttribute('aria-label', `${c.name}: ${moodWord(c) || 'no baseline'}`);
          const vsWorld = c.tone - avgT < -.6 ? 'darker than the world today' : c.tone - avgT > .6 ? 'brighter than the world today' : 'near the world’s average';
          lensText(b, c.name, `${moodWord(c) || vsWorld}${al ? `. By tradition, ${al.body} ${ANGLE_SAY[al.angle]}` : ''}`, 10);
          return { r: 3, off: 10 };
        }));
      }
    } else if (kind === 'weather' && WX) {
      for (const w of WX.rows) {
        lensItems.push(lensItem('wx', w.lat, w.lon, (w.home ? 5 : 0) + (w.notable ? 10 : 0) + (w.bears_on ? 1 : 0), () => inspect('weather', w.label), b => {
          b.style.setProperty('--c', tempCol(w.temp)); b.append(el('span', 'num', `${Math.round(w.temp)}°`));
          b.setAttribute('aria-label', `${wxName(w)}, ${Math.round(w.temp)} degrees, ${w.condition}`);
          lensText(b, w.home ? `${wxName(w)}, home` : wxName(w), `${w.condition}${w.bears_on ? ', ' + shortChannel(w.bears_on) : ''}`, 24);
          return { r: 15, off: 24 };
        }));
      }
      // the day's strongest highs and lows from the world grid, named by the nearest known place
      const sys = (wxGrid?.systems || []).slice().sort((a, b2) => Math.abs(b2.pmsl - 10130) - Math.abs(a.pmsl - 10130)).slice(0, 8);
      for (const q of sys) {
        const low = q.kind === 'low';
        lensItems.push(lensItem('wx wxs', q.lat, q.lon, 4 + Math.abs(q.pmsl - 10130) / 100, () => {}, b => {
          b.style.setProperty('--c', low ? PC.cool : PC.warm); b.append(el('span', 'num', low ? 'L' : 'H'));
          lensText(b, `${low ? 'Low' : 'High'} ${Math.round(q.pmsl / 10)} hPa`, q.near ? `near ${q.near}` : 'open water', 24);
          return { r: 13, off: 24 };
        }));
      }
    } else if (kind === 'headlines') {
      const by = {}; X.headlines.forEach(h => { if (h.place) (by[h.place] ||= { place: h.place, lat: h.lat, lon: h.lon, hs: [] }).hs.push(h); });
      for (const g of Object.values(by)) {
        const c = { left: 0, center: 0, right: 0, wire: 0 }; g.hs.forEach(h => c[LEAN_GROUP[h.lean] || 'wire']++);
        const n = g.hs.length, most = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
        lensItems.push(lensItem('md', g.lat, g.lon, n, () => inspect('place', g.place), b => {
          const R = 5 + Math.min(15, n * 1.5), C = 2 * Math.PI * R, sv = svgEl('svg', { width: R * 2 + 8, height: R * 2 + 8, viewBox: `${-R - 4} ${-R - 4} ${R * 2 + 8} ${R * 2 + 8}` });
          sv.style.transform = `translate(${-R - 4}px,${-R - 4}px)`;
          let f = 0; for (const k of ['left', 'center', 'right', 'wire']) { if (!c[k]) continue; svgEl('circle', { r: R, fill: 'none', stroke: LEAN_COL[k], 'stroke-width': 2.4, 'stroke-dasharray': `${Math.max(.5, c[k] / n * C - (n > 1 ? 2 : 0))} ${C}`, 'stroke-dashoffset': String(-f * C), transform: 'rotate(-90)' }, sv); f += c[k] / n; }
          svgEl('circle', { r: 1.8, fill: PC.hot }, sv); b.append(sv);
          b.setAttribute('aria-label', `${g.place}: ${n} stories`);
          lensText(b, g.place, `${n} stor${n === 1 ? 'y' : 'ies'} · mostly ${most === 'wire' ? 'wire services' : most}`, R + 8);
          return { r: R + 2, off: R + 8 };
        }));
      }
    }
  }
  function setLens(kind) {
    if (!KEYS[kind]) kind = 'places';
    if (kind === lens && (kind === 'places' || lensItems.length)) return;
    lens = kind; document.body.dataset.lens = kind; buildLens(kind);
    if (lensItems.length && uiMode === 'explore' && viewMode === 'orbit') {
      const c = lensItems.reduce((a, x) => a.add(x.p), new THREE.Vector3()).normalize();
      const lat = Math.asin(c.y) / D, lon = Math.atan2(c.z, -c.x) / D - 180;  // inverse of vec()
      const to = lon + (phone() ? 0 : 6); flyTo({ lat: Math.max(-40, Math.min(50, lat)), lon: cam.lon + (((to - cam.lon) % 360 + 540) % 360 - 180), dist: 3.4 }); quietUntil = performance.now() + 4000;
    }
    lensKey.replaceChildren(el('b', '', KEYS[kind][0]), document.createTextNode(KEYS[kind][1]));
    lensGain = kind === 'places' ? 1 : .12;
    wxShell.visible = kind === 'weather' && !!wxGrid;
    if (kind === 'weather' && wxGrid) {
      const when = wxGrid.time ? new Date(wxGrid.time + 'Z').toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET' : '';
      lensKey.replaceChildren(el('b', '', 'Weather'), document.createTextNode(`Colour is temperature, bright bands are rain and snow, fine lines are pressure. H and L mark the strongest highs and lows. The labelled cities are where weather reaches a price.${when ? ` World weather as of ${when}, from Open-Meteo.` : ''}`));
    }
    if (skyLinesG) skyLinesG.visible = kind === 'mood';
    if (kind === 'weather' && wxGrid?.fields?.wind_u) {
      const t = el('button', 'wind-toggle', windOn ? 'Hide the wind' : 'Show the wind'); t.type = 'button';
      t.addEventListener('click', () => { windOn = !windOn; if (windOn && !wind) windBuild(); t.textContent = windOn ? 'Hide the wind' : 'Show the wind'; });
      lensKey.append(t);
    }
  }
  document.body.dataset.lens = 'places'; lensKey.replaceChildren(el('b', '', KEYS.places[0]), document.createTextNode(KEYS.places[1]));
  // Each frame: hide markers under the interface, then place labels by priority. A label tries the right side, then the
  // left, and hides (until hover) if both would cover another marker, another label or the interface.
  const box = e => { if (!e || e.hidden || getComputedStyle(e).opacity === '0') return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left - 6, y: r.top - 4, w: r.width + 12, h: r.height + 8 } : null; };
  const hit = (a, q) => a.x < q.x + q.w && q.x < a.x + a.w && a.y < q.y + q.h && q.y < a.y + a.h;
  function placeLens() { if (uiMode === 'explore') placeItems(lensItems); else if (uiMode === 'depth' || uiMode === 'money') placeItems(gestItems); }
  function placeItems(items) {
    if (!items.length) return;
    const pr = inspEl.hidden ? null : inspEl.getBoundingClientRect();
    const walls = [lensKey, $('.call'), $('.bar .ctl'), $('.bar .brand'), $('.fine'), $('.status')].map(box).filter(Boolean);
    const vis = [];
    for (const x of items) {
      let s = facing(x.p) ? toScreen(x.p) : null;
      if (s && pr && s.x > pr.left - 10 && s.x < pr.right + 14 && s.y > pr.top && s.y < pr.bottom) s = null;
      if (s && walls.some(q => s.x > q.x && s.x < q.x + q.w && s.y > q.y && s.y < q.y + q.h)) s = null;
      x.b.style.display = s ? 'block' : 'none'; if (!s) continue;
      x.b.style.transform = `translate(${s.x}px,${s.y}px)`; x.s = s; vis.push(x);
    }
    const marks = vis.map(x => ({ x: x.s.x - x.r, y: x.s.y - x.r, w: x.r * 2, h: x.r * 2, own: x })), placed = [];
    for (const x of vis.sort((a, b) => b.pri - a.pri)) {
      if (!x.w) { const t = x.tx.firstChild; x.w = x.tx.offsetWidth; x.h = x.tx.offsetHeight; x.cw = t.offsetWidth; x.ch = t.offsetHeight; }
      let ok = null;
      for (const [side, small] of [[1, false], [-1, false], [1, true], [-1, true]]) {
        const w = small ? x.cw : x.w, h = small ? x.ch : x.h;
        const bx = side > 0 ? x.s.x + x.off : x.s.x - x.off - w, b = { x: bx - 3, y: x.s.y + x.top - 2, w: w + 6, h: h + 4, side, small, w0: w };
        if (b.x < 4 || b.x + b.w > innerWidth - 4) continue;
        if (pr && b.x < pr.right + 8 && b.y < pr.bottom && b.y + b.h > pr.top) continue;
        if (walls.some(q => hit(b, q)) || placed.some(q => hit(b, q)) || marks.some(m => m.own !== x && hit(b, m))) continue;
        ok = b; break;
      }
      x.b.classList.toggle('hide-t', !ok); x.b.classList.toggle('compact', !!ok?.small);
      if (ok) { placed.push(ok); const key = ok.side + (ok.small ? 's' : ''); if (x.at !== key) { x.at = key; x.tx.style.left = (ok.side > 0 ? x.off : -x.off - ok.w0) + 'px'; x.tx.style.textAlign = ok.side > 0 ? 'left' : 'right'; } }
    }
  }
  // ---------- Depth in the scene: pillars and arcs on the planet, charts on the stage ----------
  const gestG = new THREE.Group(); scene.add(gestG);
  const gestEl = $('#gest'), stageSvg = $('#stage');
  let gestItems = [], gestParts = [], gestT0 = 0, deskOn;
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.22, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const GV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
  const beamMat = (color, k) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: GV,
    uniforms: { color: { value: new THREE.Color(color) }, grow: { value: 0 }, k: { value: k } },
    fragmentShader: 'uniform vec3 color; uniform float grow, k; varying vec2 vUv; void main(){ if (vUv.y > grow) discard; float a = (pow(1. - vUv.y, 1.5) * .8 + .2) * k; gl_FragColor = vec4(color * a, 1.); }' });
  // A pillar of light standing on the surface; height carries the size of the move.
  function pillar(lat, lon, h, color, delay) {
    const n = vec(lat, lon).normalize(), g = new THREE.Group();
    g.position.copy(n).multiplyScalar(1.001); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.0028, .0048, h, 10, 1, true), beamMat(color, 1.5)); core.position.y = h / 2;
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(.008, .016, h, 14, 1, true), beamMat(color, .2)); halo.position.y = h / 2;
    const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); tip.position.y = h; tip.scale.setScalar(.075);
    const foot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); foot.scale.setScalar(.05);
    g.add(core, halo, tip, foot); gestG.add(g);
    gestParts.push({ mats: [core.material, halo.material], tip, delay });
    return n.clone().multiplyScalar(1.001 + h);
  }
  // An arc between two places, lifted off the surface, with a light that travels along it.
  function arcLine(a, b, lift, color, dashed, delay) {
    const pa = vec(a.lat, a.lon), pb = vec(b.lat, b.lon), pts = [];
    for (let i = 0; i <= 80; i++) { const t = i / 80; pts.push(pa.clone().lerp(pb, t).normalize().multiplyScalar(1.002 + lift * Math.sin(Math.PI * t))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: GV,
      uniforms: { color: { value: new THREE.Color(color) }, grow: { value: 0 }, time: { value: 0 }, dash: { value: dashed ? 1 : 0 }, phase: { value: Math.random() } },
      fragmentShader: 'uniform vec3 color; uniform float grow, time, dash, phase; varying vec2 vUv; void main(){ if (vUv.x > grow) discard; if (dash > .5 && fract(vUv.x * 48.) > .55) discard; float p = exp(-pow((vUv.x - fract(time * .2 + phase)) * 10., 2.)); gl_FragColor = vec4(color * (.38 + 1.2 * p), 1.); }' });
    gestG.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 140, .0028, 6, false), mat));
    gestParts.push({ mats: [mat], delay });
    return curve.getPoint(.5);
  }
  function animateGest(now) {
    for (const g of gestParts) {
      const t = clamp01((now - gestT0 - g.delay) / 1300), e = 1 - Math.pow(1 - t, 3);
      for (const m of g.mats) { m.uniforms.grow.value = e; if (m.uniforms.time) m.uniforms.time.value = now / 1000; }
      if (g.tip) g.tip.material.opacity = smooth(.8, 1, t);
    }
  }
  function clearGesture() {
    for (const o of gestG.children.slice()) { o.traverse(n => { n.geometry?.dispose(); n.material?.dispose(); }); gestG.remove(o); }
    gestParts = []; gestItems = []; gestEl.replaceChildren();
  }
  function frameOn(points, dist, tilt = 0, all = false) {
    const mean = ps => ps.reduce((a, p) => a.add(p.clone().normalize()), new THREE.Vector3()).normalize();
    let c = mean(points); const near = points.filter(p => p.angleTo(c) < 1.1); if (!all && near.length && near.length < points.length) c = mean(near);
    const lat = Math.asin(c.y) / D - tilt, to = Math.atan2(c.z, -c.x) / D - 180 + (phone() ? 0 : 8);
    if (viewMode === 'orbit') flyTo({ lat: Math.max(-45, Math.min(50, lat)), lon: cam.lon + (((to - cam.lon) % 360 + 540) % 360 - 180), dist });
    quietUntil = performance.now() + 6000;
  }
  const gestLabel = (p3, pri, title, sub, open) => gestItems.push(pointItem(gestEl, 'gl', p3, pri, open || (() => {}), b => { lensText(b, title, sub, 12); return { r: 5, off: 12 }; }));
  function gesture(key) {
    gestT0 = performance.now(); const pts = [];
    if (key === 'outliers') {
      const seen = {};
      DP.outliers.forEach((o, i) => {
        if (!o.home) return;
        const k = seen[o.home.place] = (seen[o.home.place] || 0) + 1, lat = o.home.lat - (k - 1) * 3.4, lon = o.home.lon + (k - 1) * 5.5;
        const v = ownMove(o.label, o.move), top = pillar(lat, lon, .07 + .085 * o.sigma, v >= 0 ? PC.up : PC.down, i * 170);
        pts.push(vec(lat, lon));
        const nm = sayName(o.label).replace(/^The /, ''), short = nm[0].toUpperCase() + nm.slice(1);
        gestLabel(top, o.sigma, short, `${signed(v)}, ${o.sigma.toFixed(1)}× a normal day`, () => inst[o.label] && inspect('instrument', o.label));
      });
      frameOn(pts, phone() ? 4.4 : 3.7, phone() ? -14 : 16);
    } else if (key === 'together') {
      const routes = {};
      DP.together.forEach((t, i) => {
        if (!t.ha || !t.hb || t.ha.place === t.hb.place) return;
        const rk = [t.ha.place, t.hb.place].sort().join('|'), r = routes[rk] ||= { a: t.ha, b: t.hb, pairs: [] }; r.pairs.push(t);
        const span = vec(t.ha.lat, t.ha.lon).angleTo(vec(t.hb.lat, t.hb.lon));
        const mid = arcLine(t.ha, t.hb, .06 + .34 * span / Math.PI + .075 * (r.pairs.length - 1), t.opposite ? PC.down : PC.mauve, t.opposite, i * 200); r.top = mid;
        for (const h of [t.ha, t.hb]) if (!pts.some(q => q.u === h.place)) pts.push(Object.assign(vec(h.lat, h.lon), { u: h.place }));
      });
      for (const r of Object.values(routes)) { const best = r.pairs[0], n = r.pairs.length; gestLabel(r.top, n, `${best.a} · ${best.b} ${best.corr >= 0 ? '+' : '−'}${Math.abs(best.corr).toFixed(2)}`, n > 1 ? `${r.a.place} ↔ ${r.b.place} · ${n} pairs on this route` : `${r.a.place} ↔ ${r.b.place}`); }
      const main = DP.together.find(t => t.ha && t.hb && t.ha.place !== t.hb.place);
      frameOn(main ? [vec(main.ha.lat, main.ha.lon), vec(main.hb.lat, main.hb.lon)] : pts, phone() ? 5.4 : 4.6, phone() ? -12 : 12, true);
    } else if (key === 'rules') {
      const homeOf = sym => X.instruments.find(i => i.symbol === sym)?.home;
      const routes = {};
      DP.crossdesk.results.forEach((r, i) => {
        const ha = homeOf(r.a), hb = homeOf(r.b); if (!ha || !hb || ha.place === hb.place) return;
        const rk = [ha.place, hb.place].sort().join('|'), ro = routes[rk] ||= { a: ha, b: hb, list: [] }; ro.list.push(r);
        const span = vec(ha.lat, ha.lon).angleTo(vec(hb.lat, hb.lon));
        ro.top = arcLine(ha, hb, .06 + .3 * span / Math.PI + .07 * (ro.list.length - 1), r.held ? PC.mauve : PC.down, !r.held, i * 160);
        for (const h of [ha, hb]) if (!pts.some(q => q.u === h.place)) pts.push(Object.assign(vec(h.lat, h.lon), { u: h.place }));
      });
      for (const ro of Object.values(routes)) gestLabel(ro.top, ro.list.length, ro.list.map(r => r.label).join(' · '), `${ro.a.place} ↔ ${ro.b.place} · ${ro.list.filter(r => r.held).length} of ${ro.list.length} holding`);
      frameOn(pts, phone() ? 5.4 : 4.4, phone() ? -10 : 10, true);
    } else if (key === 'africa') {
      for (const c of DP.africa.countries) {
        if (!c.place) continue;
        const fx = (DP.africa.fx || []).find(q => AFX[q.label] === c.name), v = fx ? ownMove(fx.label, fx.change_pct) : null;
        gestItems.push(pointItem(gestEl, 'mk2', vec(c.place.lat, c.place.lon, 1.004), (c.gdp || 0) / 1e11 + (fx ? 3 : 0), () => {}, b => {
          const sz = 8 + Math.min(12, Math.sqrt((c.gdp || 0) / 1e10)); b.style.setProperty('--s', sz + 'px'); b.style.setProperty('--c', v == null ? PC.leanC : v >= 0 ? PC.up : PC.down); b.append(el('i', 'dot'));
          lensText(b, c.name, `${c.carries.split('—')[0].trim()}${v != null ? ` · currency ${signed(v)}` : ''}`, sz / 2 + 8); return { r: sz / 2 + 2, off: sz / 2 + 8 };
        }));
        pts.push(vec(c.place.lat, c.place.lon));
      }
      frameOn(pts, 3.1, phone() ? -8 : 6, true);
    } else if (key === 'against') {
      const at = {};
      DP.against.forEach(a => { if (a.home) (at[a.home.place] ||= { h: a.home, list: [] }).list.push(a); });
      for (const g of Object.values(at)) {
        const net = g.list.reduce((s, a) => s + a.gap, 0);
        gestItems.push(pointItem(gestEl, 'mk2', vec(g.h.lat, g.h.lon, 1.004), Math.max(...g.list.map(a => Math.abs(a.gap))), () => inspect('instrument', g.list[0].label), b => {
          const sz = 9 + g.list.length * 3; b.style.setProperty('--s', sz + 'px'); b.style.setProperty('--c', net >= 0 ? PC.up : PC.down); b.append(el('i', 'dot'));
          lensText(b, g.h.place, g.list.map(a => `${a.label} ${a.gap >= 0 ? '+' : '−'}${Math.abs(a.gap).toFixed(1)} pts`).join(' · '), sz / 2 + 8);
          return { r: sz / 2 + 2, off: sz / 2 + 8 };
        }));
        pts.push(vec(g.h.lat, g.h.lon));
      }
      frameOn(pts, 3.0);
    }
  }
  function clearDepth() { deskOn = undefined; clearGesture(); stageSvg.replaceChildren(); document.body.classList.remove('stage-open'); }
  function depthScene(key) {
    if (key === deskOn) return;
    clearDepth(); deskOn = key;
    if (!key) { if ((uiMode === 'depth' || uiMode === 'money') && viewMode === 'orbit') { flyTo({ lat: 16, lon: cam.lon, dist: 4.1 }); quietUntil = performance.now() + 3000; } return; }
    if (STAGES[key]) {
      document.body.classList.add('stage-open'); requestAnimationFrame(() => { if (deskOn === key) drawStage(key); });
      if (viewMode === 'orbit') flyTo({ lat: 8, lon: cam.lon + 25, dist: 6 });
      return;
    }
    gesture(key);
  }

  // ---------- the stage: a large chart in the scene, the planet stepped back behind it ----------
  function stageBox() {
    const W = innerWidth, H = innerHeight;
    if (phone()) return { x: 26, y: 112, w: W - 46, h: Math.max(150, H * .43 - 132) };
    const r = inspEl.hidden ? { right: W * .36 } : inspEl.getBoundingClientRect(), x0 = Math.max(r.right + 110, W * .42);
    return { x: x0, y: 160, w: W - W * .034 - x0 - 10, h: H - 160 - 170 };
  }
  const txt = (p, x, y, s, cls, anchor) => { const t = svgEl('text', { x, y, class: cls, 'text-anchor': anchor || 'start' }, p); t.textContent = typeof s === 'string' ? s.replace(/ · /g, /st-axt/.test(cls) ? '\u2003' : ', ') : s; return t; };
  const STAGES = { outliers: stageNormal, rules: stagePairs, regime: stageCompass, 'm:road': stageRoad, cost: stageCost, energy: stageEnergy, housing: stageHousing, sources: stageSources, record: stageRecord,
    'm:now': stageNow, 'm:plan': stagePolicy, 'm:growth': stageGrowth, 'm:income': stageIncome, 'm:practice': stagePractice, 'm:payouts': stagePayouts, 'm:cashflow': stageCash, 'm:holdings': stageHoldings };
  function drawStage(key) {
    stageSvg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    stageSvg.innerHTML = `<defs><filter id="st-glow" filterUnits="userSpaceOnUse" x="-40" y="-40" width="${innerWidth + 80}" height="${innerHeight + 80}"><feGaussianBlur stdDeviation="${PAL.glowStd ?? 3.2}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="st-lean" x1="0" x2="1"><stop offset="0" stop-color="${PC.leanL}"/><stop offset=".5" stop-color="${PC.leanC}"/><stop offset="1" stop-color="${PC.leanR}"/></linearGradient></defs>`;
    const b = stageBox(); STAGES[key]?.(b);
  }
  addEventListener('resize', () => { if (deskOn && STAGES[deskOn]) drawStage(deskOn); });
  function stageCost(b) {
    const g = svgEl('g', {}, stageSvg), list = watchNames, run = i => (i.price / i.sma_200 - 1) * 100, small = phone();
    const lx0 = Math.log(8), lx1 = Math.log(Math.max(...list.map(i => i.trailing_pe)) * 1.35);
    const ys = list.map(run), y0 = Math.min(-20, Math.floor(Math.min(...ys) / 20) * 20), y1 = Math.max(40, Math.ceil(Math.max(...ys) / 20) * 20);
    const X_ = v => b.x + (Math.log(v) - lx0) / (lx1 - lx0) * b.w, Y_ = v => b.y + b.h - (v - y0) / (y1 - y0) * b.h;
    for (const t of [10, 20, 50, 100, 200, 400]) if (Math.log(t) <= lx1) { svgEl('line', { x1: X_(t), x2: X_(t), y1: b.y, y2: b.y + b.h, class: 'st-line' }, g); txt(g, X_(t), b.y + b.h + 22, `${t}×`, 'st-ax', 'middle'); }
    for (let v = y0; v <= y1; v += 20) { svgEl('line', { x1: b.x, x2: b.x + b.w, y1: Y_(v), y2: Y_(v), class: v === 0 ? 'st-zero' : 'st-line' }, g); if (small) txt(g, b.x + 2, Y_(v) - 5, v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`, 'st-ax'); else txt(g, b.x - 10, Y_(v) + 4, v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`, 'st-ax', 'end'); }
    txt(g, b.x + b.w, b.y + b.h + (small ? 40 : 48), 'Price ÷ a year of profit →', 'st-axt', 'end');
    txt(g, b.x, b.y - 20, '↑ Above its 200-day average', 'st-axt');
    const maxCap = Math.max(...list.map(i => i.market_cap || 0)), placed = [];
    [...list].sort((a, c) => (c.market_cap || 0) - (a.market_cap || 0)).forEach((i, k) => {
      const x = X_(i.trailing_pe), y = Y_(run(i)), r = (small ? 3 : 5) + (small ? 9 : 17) * Math.sqrt((i.market_cap || 0) / maxCap);
      const dot = svgEl('g', { class: 'hit in', style: `animation-delay:${180 + k * 60}ms` }, g);
      svgEl('circle', { cx: x, cy: y, r, class: 'st-dot ' + (i.change_pct >= 0 ? 'up' : 'down') }, dot);
      svgEl('circle', { cx: x, cy: y, r: 1.8, class: 'st-core' }, dot);
      svgEl('title', {}, dot).textContent = `${i.label}: ${i.trailing_pe.toFixed(1)} times a year of profit, ${Math.abs(run(i)).toFixed(0)}% ${run(i) >= 0 ? 'above' : 'below'} its 200-day average, worth ${fmtCap(i.market_cap)}. Today ${pct(i.change_pct)}.`;
      dot.addEventListener('click', () => inspect('instrument', i.label));
      placed.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
    });
    [...list].sort((a, c) => (c.market_cap || 0) - (a.market_cap || 0)).forEach(i => {
      const x = X_(i.trailing_pe), y = Y_(run(i)), r = (small ? 3 : 5) + (small ? 9 : 17) * Math.sqrt((i.market_cap || 0) / maxCap), w = i.label.length * (small ? 6.2 : 7.3) + 6, h = 15;
      for (const [lx, ly, an] of [[x + r + 6, y + 5, 'start'], [x - r - 6, y + 5, 'end'], [x, y - r - 7, 'middle'], [x, y + r + 16, 'middle']]) {
        const bx = an === 'start' ? lx : an === 'end' ? lx - w : lx - w / 2, box = { x: bx, y: ly - 12, w, h };
        if (bx < 4 || bx + w > innerWidth - 4 || placed.some(q => hit(box, q) && !(Math.abs(q.x + q.w / 2 - x) < .5 && Math.abs(q.y + q.h / 2 - y) < .5))) continue;
        placed.push(box); txt(g, lx, ly, i.label, 'st-t in', an); break;
      }
    });
  }
  // Energy: each stockpile on its own seasonal band (five-year low to high for this week), the average marked,
  // this week's level lit.
  function stageEnergy(b) {
    const g = svgEl('g', {}, stageSvg), rows = DP.energy.rows, small = phone(), gap = b.h / rows.length;
    rows.forEach((r, i) => {
      const s2 = r.seasonal, y = b.y + gap * (i + .55), sg = svgEl('g', { class: 'in', style: `animation-delay:${150 + i * 120}ms` }, g);
      txt(sg, b.x, y - 26, r.label, 'st-name');
      txt(sg, b.x + b.w, y - 26, `${r.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${r.unit}`, 'st-pct', 'end');
      if (!s2) { txt(sg, b.x, y + 4, 'No seasonal comparison', 'st-s'); return; }
      const lo = Math.min(s2.low, r.value) * .995, hi = Math.max(s2.high, r.value) * 1.005, X_ = v => b.x + (v - lo) / (hi - lo) * b.w;
      svgEl('line', { x1: b.x, x2: b.x + b.w, y1: y, y2: y, class: 'st-line' }, sg);
      svgEl('rect', { x: X_(s2.low), y: y - 5, width: Math.max(2, X_(s2.high) - X_(s2.low)), height: 10, rx: 5, fill: lineA(.14) }, sg);
      svgEl('line', { x1: X_(s2.avg), x2: X_(s2.avg), y1: y - 11, y2: y + 11, stroke: lineA(.6) }, sg);
      svgEl('circle', { cx: X_(r.value), cy: y, r: 6, fill: r.build ? PC.glow : PC.up, filter: 'url(#st-glow)' }, sg);
      txt(sg, b.x, y + 26, `${weekSay(r)} · ${seasonSay(r)}`, small ? 'st-s' : 'st-t');
    });
    txt(g, b.x, b.y - 20, 'Band: five-year range for this week · tick: average · light: now', 'st-axt');
  }
  const houseNum = r => r.unit === '%' ? `${r.value}%` : `${(+r.value).toLocaleString('en-US', { maximumFractionDigits: r.value >= 100 ? 0 : 1 })}${r.unit === 'K' ? 'K' : ''}`;
  const houseChange = r => r.change === 0 ? 'Unchanged' : `${r.change >= 0 ? 'Up' : 'Down'} ${Math.abs(r.change) >= 10 ? Math.abs(r.change).toFixed(0) : Math.abs(r.change).toFixed(2)}${r.unit === '%' ? ' pts' : ''}`;
  // Housing: the five national readings as one cluster of large, quiet numbers.
  function stageHousing(b) {
    const g = svgEl('g', {}, stageSvg), rows = DP.real_estate.rows, small = phone(), cols = small ? 2 : 3, cw = b.w / cols, rh = small ? 92 : 150;
    rows.forEach((r, i) => {
      const x = b.x + (i % cols) * cw, y = b.y + 40 + Math.floor(i / cols) * rh, sg = svgEl('g', { class: 'in', style: `animation-delay:${150 + i * 110}ms` }, g);
      const better = r.lower_is_better ? r.change < 0 : r.change > 0;
      txt(sg, x, y, houseNum(r), 'st-big');
      txt(sg, x, y + (small ? 22 : 30), r.label, 'st-name');
      txt(sg, x, y + (small ? 40 : 52), `${houseChange(r)}${r.change === 0 ? '' : better ? ' · better for buyers' : ' · worse for buyers'}`, r.change === 0 ? 'st-s' : better ? 'st-s hit-t' : 'st-s miss-t');
    });
  }
  // ---------- Money on the stage ----------
  // A big measured level, a name, and its recent path; optionally the reader's own line across it.
  function stageLevel(g, b, topH, small, o) {
    const lw = small ? 0 : 230, top = svgEl('g', { class: 'in' }, g), ser = o.ser;
    txt(top, b.x, b.y + 4, o.label, 'st-axt');
    txt(top, b.x, b.y + (small ? 50 : 76), o.big, 'st-big');
    txt(top, b.x, b.y + (small ? 72 : 108), o.name, 'st-name');
    if (!small && o.note) txt(top, b.x, b.y + 130, o.note, 'st-s');
    if (!ser || ser.length < 3) return;
    const cx = b.x + lw, cw = b.w - lw - (small || o.line == null ? 0 : 100), cy0 = b.y + (small ? 92 : 24), ch = topH - (small ? 120 : 84);
    const lo = Math.min(...ser, o.line ?? Infinity), hi = Math.max(...ser, o.line ?? -Infinity), pad = (hi - lo) * .18 || .1;
    const Y_ = x => cy0 + ch - (x - lo + pad) / (hi - lo + 2 * pad) * ch, X_ = k => cx + k / (ser.length - 1) * cw;
    const path = ser.map((x, k) => `${k ? 'L' : 'M'}${X_(k).toFixed(1)} ${Y_(x).toFixed(1)}`).join('');
    if (o.line != null) {
      svgEl('path', { d: `${path}L${X_(ser.length - 1).toFixed(1)} ${Y_(o.line).toFixed(1)}L${cx} ${Y_(o.line).toFixed(1)}Z`, fill: downA(.09), class: 'in', style: 'animation-delay:220ms' }, g);
      svgEl('line', { x1: cx, x2: cx + cw, y1: Y_(o.line), y2: Y_(o.line), stroke: PC.glow, 'stroke-dasharray': '3 6', opacity: .85, class: 'in' }, g);
      txt(g, small ? cx + cw : cx + cw + 12, Y_(o.line) + (small ? -8 : 4), o.lineLabel, 'st-s2 in', small ? 'end' : 'start');
    }
    svgEl('path', { d: path, fill: 'none', stroke: o.color, 'stroke-width': 2, filter: 'url(#st-glow)', class: 'in', style: 'animation-delay:160ms' }, g);
    svgEl('circle', { cx: X_(ser.length - 1), cy: Y_(ser.at(-1)), r: 4.5, fill: PC.hot, filter: 'url(#st-glow)', class: 'in', style: 'animation-delay:420ms' }, g);
    if (o.foot) txt(g, cx, cy0 + ch + (small ? 22 : 30), o.foot, 'st-s in');
  }
  function stageNow(b) {
    const Mo = MONEY, pl = Mo.plan, pr = Mo.profile || {}, g = svgEl('g', {}, stageSvg), small = phone(), t = moneyTrip(), v = moneyView();
    const topH = small ? b.h : Math.min(300, b.h * .52), w = t?.w, ser = (w?.series || []).map(p => p.close).filter(Number.isFinite), q = v.act && quotesOf([v.act])[0];
    if (w && w.type === 'threshold' && typeof w.line === 'number' && ser.length > 2)
      stageLevel(g, b, topH, small, { label: 'First · your line', big: mLvl(w.value ?? ser.at(-1), w.symbol), name: mName(w.symbol), note: w.sessions_met > 1 ? `${w.sessions_met} sessions past your line` : 'Past your line today',
        ser, line: w.line, lineLabel: `your line ${mLvl(w.line, w.symbol)}`, foot: tripSay(w).clear, color: PC.down });
    else if (t) { const top = svgEl('g', { class: 'in' }, g), s2 = tripSay(t.w); txt(top, b.x, b.y + 4, 'First · your rule', 'st-axt'); txt(top, b.x, b.y + (small ? 44 : 60), s2.title, 'st-name'); if (s2.body) txt(top, b.x, b.y + (small ? 66 : 86), s2.body, 'st-s'); }
    else if (v.move && q) stageLevel(g, b, topH, small, { label: 'Today · the read’s market', big: pct(q.change_pct), name: q.label, note: `on the day · ${q.series?.length || 0} sessions shown`, ser: q.series, color: q.change_pct >= 0 ? PC.up : PC.down });
    else { const top = svgEl('g', { class: 'in' }, g), cur = Mo.policy.find(p => p.current);
      txt(top, b.x, b.y + 4, 'Today · the market’s mood', 'st-axt');
      txt(top, b.x, b.y + (small ? 50 : 76), cur ? cur.title : 'Not measured', small ? 'st-name' : 'st-big');
      txt(top, b.x, b.y + (small ? 74 : 112), v.move ? `The read: ${lower1(v.title)}` : 'The read sees no trade worth making.', 'st-lead'); }
    if (small || !pl) return;
    // New cash: one bar for the proportion, an even legend below it so no label ever runs off the edge.
    const y1 = b.y + topH + 46, COL = { reserve: PC.series1, core: PC.series2, focused: PC.series3 }, gap = 6, W = b.w - gap * (pl.buckets.length - 1), cw = b.w / pl.buckets.length;
    const low = svgEl('g', { class: 'in', style: 'animation-delay:240ms' }, g);
    svgEl('line', { x1: b.x, x2: b.x + b.w, y1: y1 - 30, y2: y1 - 30, class: 'st-line' }, low);
    txt(low, b.x, y1, 'New cash, if you add it', 'st-axt');
    txt(low, b.x + b.w, y1, (Mo.policy.find(p => p.current)?.title || '').toLowerCase(), 'st-s', 'end');
    let x = b.x;
    pl.buckets.forEach((k, i) => {
      const bw = W * k.percent / 100, s3 = svgEl('g', { class: 'in', style: `animation-delay:${320 + i * 140}ms` }, g), lx = b.x + i * cw;
      if (bw > 0) svgEl('rect', { x, y: y1 + 22, width: bw, height: 8, rx: 4, fill: COL[k.key] || PC.ink, filter: 'url(#st-glow)', opacity: .92 }, s3);
      svgEl('circle', { cx: lx + 4, cy: y1 + 68, r: 3.5, fill: COL[k.key] || PC.ink }, s3);
      txt(s3, lx + 16, y1 + 73, k.label, 'st-name'); txt(s3, lx, y1 + 112, `${k.percent}%`, 'st-pct');
      txt(s3, lx, y1 + 138, `${fmt$(k.monthly_dollars)} of each ${fmt$(pr.monthly)} month`, 'st-t');
      txt(s3, lx, y1 + 158, `${fmt$(k.ready_dollars)} of the ${fmt$(pr.ready)} you start with`, 'st-s');
      x += bw + gap;
    });
  }
  function stagePolicy(b) {
    const g = svgEl('g', {}, stageSvg), P2 = MONEY.policy, small = phone(), lw = small ? 118 : 200, rh = Math.min(64, b.h / P2.length), COL = [PC.series1, PC.series2, PC.series3];
    txt(g, b.x, b.y - 20, 'New cash, by the market’s mood · reserve, core, focused', 'st-axt');
    P2.forEach((p, i) => {
      const y = b.y + rh * (i + .6), s2 = svgEl('g', { class: 'in', style: `animation-delay:${120 + i * 80}ms`, opacity: p.current ? 1 : .42 }, g);
      txt(s2, b.x, y + 5, p.title, p.current ? 'st-name' : 'st-t');
      let x = b.x + lw; const W = b.w - lw - 16;
      [p.reserve, p.core, p.focused].forEach((v, k) => { const w = W * v / 100; svgEl('rect', { x, y: y - (p.current ? 5 : 3), width: Math.max(1, w - 4), height: p.current ? 10 : 6, rx: 3, fill: COL[k], filter: p.current ? 'url(#st-glow)' : null }, s2); if (p.current || !small) txt(s2, x, y - 10, `${v}%`, 'st-s2'); x += w; });
      if (p.current) txt(s2, b.x + b.w, y + 22, `today · ${p.posture.toLowerCase()}`, 'st-s hit-t', 'end');
    });
  }
  function stageGrowth(b) {
    const G = MONEY.growth, pr = MONEY.profile || {}, g = svgEl('g', {}, stageSvg), small = phone();
    const curve = G.curve, maxV = Math.max(...curve.map(c => c.values[2])) * 1.06, X_ = m => b.x + m / 360 * b.w, Y_ = v => b.y + b.h - v / maxV * b.h;
    const nice = [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6].filter(v => v < maxV);
    for (const v of nice.slice(-4)) { svgEl('line', { x1: b.x, x2: b.x + b.w, y1: Y_(v), y2: Y_(v), class: 'st-line' }, g); txt(g, small ? b.x + 2 : b.x - 10, small ? Y_(v) - 5 : Y_(v) + 4, fmtK(v), 'st-ax', small ? 'start' : 'end'); }
    for (let y = 0; y <= 30; y += 5) txt(g, X_(y * 12), b.y + b.h + 22, y ? `${y}y` : 'now', 'st-ax', 'middle');
    const path = r => curve.map((c, i) => `${i ? 'L' : 'M'}${X_(c.month).toFixed(1)} ${Y_(c.values[r]).toFixed(1)}`).join('');
    svgEl('path', { d: path(2) + curve.slice().reverse().map(c => `L${X_(c.month).toFixed(1)} ${Y_(c.values[0]).toFixed(1)}`).join('') + 'Z', fill: `rgba(${cssVar('mauve-rgb')},.07)`, class: 'in' }, g);
    const COL = [PC.series1, PC.series2, PC.series3], NAME = ['put in', 'at 4%', 'at 7%'];
    [0, 1, 2].forEach(r => { svgEl('path', { d: path(r), fill: 'none', stroke: COL[r], 'stroke-width': r ? 2 : 1.4, 'stroke-dasharray': r ? null : '4 5', filter: r ? 'url(#st-glow)' : null, class: 'in', style: `animation-delay:${200 + r * 160}ms` }, g);
      const end = curve[curve.length - 1]; txt(g, X_(end.month) - 4, Y_(end.values[r]) - 8, `${fmtK(end.values[r])} ${NAME[r]}`, r ? 'st-t' : 'st-s', 'end'); });
    const target = pr.goal ? pr.goal / .04 : null;
    if (target && target < maxV) {
      svgEl('line', { x1: b.x, x2: b.x + b.w, y1: Y_(target), y2: Y_(target), stroke: PC.glow, 'stroke-dasharray': '2 6', opacity: .8 }, g);
      txt(g, b.x + 8, Y_(target) - 8, `${fmtK(target)}: enough to pay ${fmt$(pr.goal)} a year at a 4% draw`, 'st-s2');
      const hit = curve.find(c => c.values[2] >= target); if (hit) { svgEl('circle', { cx: X_(hit.month), cy: Y_(target), r: 5, fill: PC.glow, filter: 'url(#st-glow)' }, g); txt(g, X_(hit.month), Y_(target) + 22, `about ${Math.round(hit.month / 12)} years at 7%`, 'st-t', 'middle'); }
    }
    txt(g, b.x, b.y - 20, `${fmt$(pr.ready)} to start, ${fmt$(pr.monthly)} a month · scenarios, not forecasts`, 'st-axt');
  }
  function stageIncome(b) {
    const pr = MONEY.profile || {}, S2 = MONEY.income?.streams || [], annual = S2.reduce((a, s3) => a + (+s3.monthly || 0) * 12, 0) + (MONEY.portfolio_income?.annual || 0), g = svgEl('g', { class: 'in' }, stageSvg);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) * .34, C = 2 * Math.PI * r, frac = pr.goal ? Math.min(1, annual / pr.goal) : 0;
    svgEl('circle', { cx, cy, r, fill: 'none', stroke: lineA(.14), 'stroke-width': 10 }, g);
    if (frac > 0) svgEl('circle', { cx, cy, r, fill: 'none', stroke: PC.glow, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': `${C * frac} ${C}`, transform: `rotate(-90 ${cx} ${cy})`, filter: 'url(#st-glow)' }, g);
    txt(g, cx, cy - 4, fmt$(annual), 'st-big', 'middle'); txt(g, cx, cy + 30, `of ${fmt$(pr.goal)} a year in extra income`, 'st-lead', 'middle');
    if (!S2.length) txt(g, cx, cy + 58, 'Add your first stream to start the ring', 'st-s', 'middle');
  }
  function stageCash(b) {
    const C = MONEY.cashflow, pr = MONEY.profile || {}, g = svgEl('g', { class: 'in' }, stageSvg);
    if (!C || C.error) { txt(g, b.x, b.y + 60, 'In, out, left.', 'st-big'); txt(g, b.x, b.y + 96, 'Add data/money/cashflow.json to see what’s left to invest each month.', 'st-lead'); return; }
    const left = (C.monthly_in || 0) - (C.monthly_out || 0), W = b.w, x0 = b.x, y = b.y + b.h * .5, mx = Math.max(C.monthly_in || 1, 1);
    [['In', C.monthly_in, PC.up], ['Out', C.monthly_out, PC.down], ['Left', left, PC.glow], ['Planned contribution', pr.monthly, PC.mauve]].forEach(([t, v, col], i) => {
      const yy = y - 90 + i * 62; txt(g, x0, yy - 12, t, 'st-name'); svgEl('rect', { x: x0, y: yy, width: Math.max(2, W * Math.max(0, v) / mx), height: 8, rx: 4, fill: col, filter: 'url(#st-glow)' }, g); txt(g, x0 + W, yy - 12, fmt$(v), 'st-t', 'end');
    });
  }
  // The practice record: the running total of $100 practice buys against the same money in the S&P, then every trade.
  function stagePractice(b) {
    const P = MONEY.practice, g = svgEl('g', { class: 'in' }, stageSvg); if (!P?.trades?.length) return;
    const T = [...P.trades].sort((a, c) => a.due_on.localeCompare(c.due_on)), cp = [0], cs = [0];
    T.forEach(t => { cp.push(cp[cp.length - 1] + t.pnl); cs.push(cs[cs.length - 1] + (t.spx_pnl || 0)); });
    const ch = b.h * .36, top = b.y + 18, lo = Math.min(0, ...cp, ...cs), hi = Math.max(...cp, ...cs), X = i => b.x + i / T.length * (b.w - 120), Y = v => top + (hi - v) / Math.max(1, hi - lo) * ch;
    svgEl('line', { x1: b.x, x2: b.x + b.w - 120, y1: Y(0), y2: Y(0), stroke: lineA(.25) }, g);
    const path = arr => 'M' + arr.map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L');
    svgEl('path', { d: path(cs), fill: 'none', stroke: PC.series2, 'stroke-width': 1.6, opacity: .7 }, g);
    svgEl('path', { d: path(cp), fill: 'none', stroke: PC.glow, 'stroke-width': 2.4, filter: 'url(#st-glow)' }, g);
    txt(g, X(T.length) + 10, Y(cp[T.length]) + 4, `${usdCents(cp[T.length])} following the calls`, 'st-t');
    txt(g, X(T.length) + 10, Y(cs[T.length]) + 4, `${usdCents(cs[T.length])} the S&P`, 'st-s2');
    const ly = top + ch + 72, rh = Math.min(26, (b.y + b.h - ly) / (T.length + 1));
    txt(g, b.x, ly - 14, 'Bought', 'st-ax'); txt(g, b.x + 92, ly - 14, 'What', 'st-ax'); txt(g, b.x + b.w * .72, ly - 14, 'Practice', 'st-ax', 'end'); txt(g, b.x + b.w, ly - 14, 'S&P, same dates', 'st-ax', 'end');
    T.forEach((t, i) => { const y = ly + i * rh;
      txt(g, b.x, y, fmtDay(t.made_on), 'st-s2');
      txt(g, b.x + 92, y, t.via ? `${t.label}, through ${t.via}` : t.label, 'st-name');
      const v = txt(g, b.x + b.w * .72, y, usdCents(t.pnl), 'st-t', 'end'); v.style.fill = t.pnl >= 0 ? PC.up : PC.down;
      txt(g, b.x + b.w, y, t.spx_pnl == null ? '—' : usdCents(t.spx_pnl), 'st-s2', 'end'); });
  }
  // What the stocks pay: broker's projection month by month, and who pays it.
  function stagePayouts(b) {
    const PI = MONEY.portfolio_income, g = svgEl('g', { class: 'in' }, stageSvg); if (!PI?.months?.length) return;
    const M = PI.months, mx = Math.max(...M.map(m => m.total)), bw = Math.min(46, (b.w * .56) / M.length - 10), base = b.y + b.h * .62, H = b.h * .48;
    M.forEach((m, i) => {
      const x = b.x + i * (bw + 10), h = Math.max(2, m.total / mx * H), top = m.total === mx;
      svgEl('rect', { x, y: base - h, width: bw, height: h, rx: 3, fill: top ? PC.glow : PC.mauve, opacity: top ? .95 : .55, class: 'in', style: `animation-delay:${80 + i * 40}ms` }, g);
      txt(g, x + bw / 2, base + 22, monthName(m.month).slice(0, 1), 'st-ax', 'middle');
      if (top) txt(g, x + bw / 2, base - h - 10, fmtC(m.total), 'st-t', 'middle');
    });
    txt(g, b.x, base + 52, `Next 12 months, ${monthName(M[0].month)} to ${monthName(M[M.length - 1].month)}. broker’s projection.`, 'st-s2');
    const lx = b.x + b.w * .64, top = [...PI.securities].sort((a, c) => c.annual - a.annual), rh = Math.min(30, b.h / (top.length + 1)), tmax = top[0].annual;
    txt(g, lx, b.y + 10, 'Who pays it, a year', 'st-ax');
    top.forEach((s, i) => { const y = b.y + 34 + i * rh;
      txt(g, lx, y + 4, secName(s.name), 'st-name');
      svgEl('rect', { x: lx, y: y + 9, width: Math.max(2, (b.w * .32) * s.annual / tmax), height: 4, rx: 2, fill: PC.mauve, opacity: .7 }, g);
      txt(g, b.x + b.w, y + 4, fmtC(s.annual), 'st-t', 'end'); });
  }
  function stageHoldings(b) {
    const Hd = MONEY.holdings, g = svgEl('g', { class: 'in' }, stageSvg);
    const PI = MONEY.portfolio_income, PH = MONEY.portfolio_holdings;
    if (PH?.positions?.length) {
      const rows = [...PH.positions].sort((a, c) => c.value - a.value), rh = Math.min(34, b.h / (rows.length + 1.6)), bx = b.x + b.w * .4, bwid = b.w * .34, mx = rows[0].value;
      txt(g, b.x, b.y + 8, 'Holding', 'st-ax'); txt(g, bx, b.y + 8, 'Share of everything', 'st-ax'); txt(g, b.x + b.w, b.y + 8, 'Since you bought', 'st-ax', 'end');
      rows.forEach((h, i) => { const y = b.y + 34 + i * rh, big = i === 0;
        txt(g, b.x, y + 4, secName(h.name), 'st-name');
        svgEl('rect', { x: bx, y: y - 4, width: Math.max(2, bwid * h.value / mx), height: 8, rx: 4, fill: big ? PC.glow : PC.mauve, opacity: big ? .95 : .6, class: 'in', style: `animation-delay:${60 + i * 35}ms` }, g);
        txt(g, bx + Math.max(2, bwid * h.value / mx) + 8, y + 4, `${h.pct_portfolio < 1 ? h.pct_portfolio.toFixed(1) : Math.round(h.pct_portfolio)}%`, 'st-t');
        txt(g, b.x + b.w, y + 4, `${h.gain >= 0 ? '+' : '−'}${Math.abs(Math.round(h.gain_pct)).toLocaleString('en-US')}%`, 'st-t', 'end'); });
      txt(g, b.x, b.y + 34 + rows.length * rh + 6, `broker’s values as of ${String(PH.as_of).replace(/ 0(\d)/, ' $1')}. Bars are each holding’s share of the whole account.`, 'st-s2');
      return;
    }
    if (!Hd?.length && PI?.securities?.length) {
      const rows = [...PI.securities].sort((a, c) => c.annual - a.annual), rh = Math.min(40, b.h / (rows.length + 1.5));
      txt(g, b.x, b.y + 8, 'Holding', 'st-ax'); txt(g, b.x + b.w * .62, b.y + 8, 'Shares', 'st-ax', 'end'); txt(g, b.x + b.w, b.y + 8, 'Dividends a year', 'st-ax', 'end');
      rows.forEach((s, i) => { const y = b.y + 38 + i * rh;
        txt(g, b.x, y, secName(s.name), 'st-name'); txt(g, b.x + b.w * .62, y, String(+s.quantity), 'st-t', 'end'); txt(g, b.x + b.w, y, fmtC(s.annual), 'st-t', 'end');
        svgEl('line', { x1: b.x, x2: b.x + b.w, y1: y + rh * .45, y2: y + rh * .45, stroke: lineA(.1) }, g); });
      txt(g, b.x, b.y + 38 + rows.length * rh + 10, 'Dividend payers only, from broker’s Expected Cash Flow report. Values arrive with Portfolio Holdings.', 'st-s2');
      return;
    }
    if (!Hd?.length) { txt(g, b.x, b.y + 60, 'What you own.', 'st-big'); txt(g, b.x, b.y + 96, 'Add data/money/holdings.json to see concentration and drift.', 'st-lead'); return; }
    const priced = Hd.filter(h => h.value != null).sort((a, c) => c.value - a.value), tot = priced.reduce((a, h) => a + h.value, 0), rh = Math.min(54, b.h / Math.max(1, priced.length));
    priced.forEach((h, i) => { const y = b.y + rh * (i + .7), w = (b.w - 200) * h.value / tot; txt(g, b.x, y + 4, h.label, 'st-name'); svgEl('rect', { x: b.x + 180, y: y - 4, width: Math.max(2, w), height: 8, rx: 4, fill: PC.mauve, filter: 'url(#st-glow)' }, g); txt(g, b.x + b.w, y + 4, `${(h.value / tot * 100).toFixed(0)}%`, 'st-t', 'end'); });
  }

  function stageSources(b) {
    const g = svgEl('g', {}, stageSvg), cnt = {}, shr = {}, small = phone(), SH = sharedSet(); X.headlines.forEach(h => { cnt[h.source] = (cnt[h.source] || 0) + 1; if (SH.has(h)) shr[h.source] = (shr[h.source] || 0) + 1; });
    const BAND = [['left', .08, 'Left'], ['lean-left', .29, 'Leans left'], ['center', .5, 'Center'], ['lean-right', .71, 'Leans right'], ['right', .92, 'Right']];
    const COLOR = { left: PC.leanL, 'lean-left': PC.leanL2, center: PC.leanC, 'lean-right': PC.leanR2, right: PC.leanR, straight: PC.series1 };
    const base = b.y + b.h * .64, wire = b.y + b.h, maxC = Math.max(...Object.values(cnt)), placed = [];
    svgEl('line', { x1: b.x, x2: b.x + b.w, y1: base, y2: base, stroke: 'url(#st-lean)', 'stroke-width': 1.4, opacity: .75 }, g);
    BAND.forEach(([, f, t]) => txt(g, b.x + f * b.w, base + 24, t, 'st-ax', 'middle'));
    let k = 0;
    const stem = (fd, x, y0, scale) => {
      const c = cnt[fd.name] || 0, sh = shr[fd.name] || 0, h = c ? 8 + scale * c / maxC : 5, hs = c ? h * sh / c : 0, s = svgEl('g', { class: 'in', style: `animation-delay:${80 + k++ * 22}ms` }, g);
      svgEl('line', { x1: x, x2: x, y1: y0, y2: y0 - h, stroke: COLOR[fd.lean], 'stroke-width': 1.4, opacity: c ? .3 : .16 }, s);
      if (sh) { svgEl('line', { x1: x, x2: x, y1: y0, y2: y0 - hs, stroke: COLOR[fd.lean], 'stroke-width': 2.4, filter: 'url(#st-glow)' }, s); svgEl('circle', { cx: x, cy: y0 - hs, r: 2.6, fill: PC.hot }, s); }
      svgEl('title', {}, s).textContent = `${fd.name}: ${c} stor${c === 1 ? 'y' : 'ies'}, ${sh} also carried elsewhere · ${LEAN_LABEL[fd.lean] || 'Wire'}`;
      if (sh || c >= (small ? 99 : 6) && false) { const w = fd.name.length * 6.3 + 4, box = { x: x - w / 2, y: y0 - h - 25, w, h: 15 }; if (!placed.some(q => hit(box, q)) && box.x > 2 && box.x + w < innerWidth - 2) { placed.push(box); txt(s, x, y0 - h - 12, fd.name, 'st-s2', 'middle'); } }
    };
    const spread = (list, cx, span) => { const n = list.length, step = Math.min(small ? 9 : 16, span / Math.max(1, n - 1)); const order = [...list].sort((a, c) => (cnt[c.name] || 0) - (cnt[a.name] || 0)); return order.map((fd, i) => [fd, cx + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * step]); };
    for (const [lean, f] of BAND) spread(DP.feeds.filter(fd => fd.lean === lean), b.x + f * b.w, b.w * .18).forEach(([fd, x]) => stem(fd, x, base, b.h * .5));
    const wires = DP.feeds.filter(fd => fd.lean === 'straight');
    svgEl('line', { x1: b.x + b.w * .3, x2: b.x + b.w * .7, y1: wire, y2: wire, class: 'st-line' }, g);
    txt(g, b.x + b.w * .5, wire + 22, 'Wire and market desks · no lean', 'st-ax', 'middle');
    spread(wires, b.x + b.w * .5, b.w * .36).forEach(([fd, x]) => stem(fd, x, wire, b.h * .2));
  }
  function stageRecord(b) {
    if (!KD) return;
    const g = svgEl('g', {}, stageSvg), list = KD.record.claims.filter(c => !c.duplicate), small = phone();
    const T = c => Date.parse(c.made_on + 'T12:00:00Z'), t0 = Math.min(...list.map(T)), t1 = Math.max(...list.map(T)), pad = Math.max(864e5 * 2, (t1 - t0) * .12);
    const m = Math.ceil(Math.max(2, ...list.map(c => Math.abs(c.move_pct))) * 1.2);
    const X_ = v => b.x + (v - t0 + pad) / (t1 - t0 + 2 * pad) * b.w, Y_ = v => b.y + b.h / 2 - v / m * (b.h / 2 - 34);
    svgEl('line', { x1: b.x, x2: b.x + b.w, y1: Y_(0), y2: Y_(0), class: 'st-zero' }, g);
    for (const v of [m * .5, -m * .5]) { const r = Math.round(v); svgEl('line', { x1: b.x, x2: b.x + b.w, y1: Y_(r), y2: Y_(r), class: 'st-line' }, g); if (small) txt(g, b.x + 2, Y_(r) - 5, `${r > 0 ? '+' : '−'}${Math.abs(r)}%`, 'st-ax'); else txt(g, b.x - 10, Y_(r) + 4, `${r > 0 ? '+' : '−'}${Math.abs(r)}%`, 'st-ax', 'end'); }
    txt(g, b.x, b.y - 20, 'What each called market did over its window', 'st-axt');
    const per = {}; list.forEach(c => (per[c.made_on] ||= []).push(c));
    for (const [d, cs] of Object.entries(per)) {
      txt(g, X_(T(cs[0])), b.y + b.h + 22, new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), 'st-ax', 'middle');
      cs.forEach((c, i) => {
        const x = X_(T(c)) + (i - (cs.length - 1) / 2) * (small ? 22 : 38), y = Y_(c.move_pct), ok = c.correct === 1, s = svgEl('g', { class: 'in', style: `animation-delay:${200 + i * 90}ms` }, g);
        svgEl('line', { x1: x, x2: x, y1: Y_(0), y2: y, class: ok ? 'st-stem hit-c' : 'st-stem miss-c', filter: 'url(#st-glow)' }, s);
        svgEl('circle', { cx: x, cy: y, r: 4.2, class: ok ? 'st-mark hit-c' : 'st-mark miss-c' }, s);
        txt(s, x, Y_(0) + (c.move_pct >= 0 ? 18 : -10), c.direction === 'up' ? '↑' : c.direction === 'down' ? '↓' : '→', 'st-call', 'middle');
        const i2 = bySymbol(c.symbol), nm = i2 ? (SAY_NAME[i2.label] || i2.label) : c.symbol;
        txt(s, x, y + (c.move_pct >= 0 ? -12 : 22), `${ok ? '✓' : '✕'} ${nm}`, ok ? 'st-t hit-t' : 'st-t miss-t', 'middle');
        svgEl('title', {}, s).textContent = `${nm}: called ${c.direction} for ${HORIZON[c.horizon] || c.horizon} on ${d}; it moved ${pct(c.move_pct)}. ${ok ? 'Right.' : 'Wrong.'}`;
      });
    }
    if (!small) txt(g, b.x + b.w, b.y + b.h + 22, '↑ ↓ the call · line: what happened', 'st-ax', 'end');
  }



  // ---------- Map names: countries and seas, labelled the way an atlas does it ----------
  // Label points are hand-placed near each country's visual centre. Rank decides how far out a name shows:
  // 1 from the overview, 2 a little closer, 3 only up close. Oceans always show (one label per ocean at a time).
  // Names never cover a place marker, its name or the interface; the busiest-first marker names win.
  const GEO = [
    // oceans
    ['Pacific Ocean', 22, -148, 0, 'o'], ['Pacific Ocean', -24, -122, 0, 'o'], ['Pacific Ocean', 8, 168, 0, 'o'],
    ['Atlantic Ocean', 30, -42, 0, 'o'], ['Atlantic Ocean', -20, -16, 0, 'o'], ['Indian Ocean', -22, 78, 0, 'o'],
    ['Southern Ocean', -60, 25, 0, 'o'], ['Southern Ocean', -60, -110, 0, 'o'], ['Southern Ocean', -60, 145, 0, 'o'],
    ['Arctic Ocean', 82, -10, 0, 'o'], ['Arctic Ocean', 80, 150, 0, 'o'],
    // seas, gulfs, bays
    ['Mediterranean Sea', 34.4, 18, 2, 's'], ['Caribbean Sea', 15, -75, 2, 's'], ['Gulf of Mexico', 25, -90, 2, 's'],
    ['South China Sea', 13, 114, 2, 's'], ['Arabian Sea', 15, 64, 2, 's'], ['Bay of Bengal', 15, 88, 2, 's'],
    ['Persian Gulf', 27, 51, 2, 's'], ['Red Sea', 20, 38.6, 2, 's'], ['Black Sea', 43.2, 34.5, 2, 's'],
    ['Caspian Sea', 41.6, 50.8, 2, 's'], ['Sea of Japan', 40, 135, 2, 's'], ['Coral Sea', -16, 154, 2, 's'],
    ['Tasman Sea', -38, 160, 2, 's'], ['Bering Sea', 58, -178, 2, 's'], ['Gulf of Guinea', 2, 3, 2, 's'],
    ['Hudson Bay', 60, -85, 2, 's'], ['Gulf of Alaska', 56.5, -145, 2, 's'], ['Philippine Sea', 20, 132, 2, 's'],
    ['North Sea', 56, 3, 3, 's'], ['Baltic Sea', 57.5, 19.4, 3, 's'], ['East China Sea', 29, 125.5, 3, 's'],
    ['Labrador Sea', 59, -54, 3, 's'], ['Norwegian Sea', 69, 3, 3, 's'], ['Barents Sea', 74, 40, 3, 's'],
    ['Gulf of Aden', 12.4, 48, 3, 's'], ['Mozambique Channel', -18, 41.2, 3, 's'],
    // the Americas
    ['Canada', 58, -102, 1, 'c'], ['United States', 39, -98, 1, 'c'], ['Mexico', 23.5, -102, 1, 'c'], ['Greenland', 72, -40, 1, 'c'],
    ['Brazil', -10, -53, 1, 'c'], ['Argentina', -35, -65, 1, 'c'], ['Peru', -9.5, -75, 2, 'c'], ['Colombia', 4, -73, 2, 'c'],
    ['Venezuela', 7, -66, 2, 'c'], ['Chile', -24, -69.6, 2, 'c'], ['Bolivia', -17, -64.5, 2, 'c'], ['Ecuador', -1.5, -78.3, 3, 'c'],
    ['Paraguay', -23.3, -58, 3, 'c'], ['Uruguay', -32.8, -56, 3, 'c'], ['Cuba', 21.6, -79, 3, 'c'], ['Guatemala', 15.6, -90.3, 3, 'c'],
    // Europe
    ['United Kingdom', 53.5, -2, 2, 'c'], ['Ireland', 53.2, -8, 3, 'c'], ['France', 46.6, 2.4, 1, 'c'], ['Spain', 40.2, -3.6, 2, 'c'],
    ['Portugal', 39.6, -8, 3, 'c'], ['Germany', 51, 10.3, 1, 'c'], ['Italy', 42.8, 12.6, 2, 'c'], ['Netherlands', 52.2, 5.6, 3, 'c'],
    ['Belgium', 50.6, 4.6, 3, 'c'], ['Switzerland', 46.8, 8.2, 3, 'c'], ['Austria', 47.6, 14.1, 3, 'c'], ['Poland', 52, 19.4, 2, 'c'],
    ['Czechia', 49.8, 15.5, 3, 'c'], ['Hungary', 47.1, 19.4, 3, 'c'], ['Romania', 45.9, 24.9, 3, 'c'], ['Bulgaria', 42.7, 25.3, 3, 'c'],
    ['Greece', 39.3, 22, 3, 'c'], ['Serbia', 44, 20.8, 3, 'c'], ['Ukraine', 49, 31.4, 2, 'c'], ['Belarus', 53.7, 28, 3, 'c'],
    ['Sweden', 62.5, 16, 2, 'c'], ['Norway', 61.5, 9, 2, 'c'], ['Finland', 63.5, 26.5, 2, 'c'], ['Denmark', 56, 9.3, 3, 'c'],
    ['Iceland', 64.9, -18.6, 3, 'c'], ['Lithuania', 55.3, 23.9, 3, 'c'], ['Latvia', 56.9, 24.6, 3, 'c'], ['Estonia', 58.7, 25.5, 3, 'c'],
    // Middle East and Asia
    ['Russia', 61, 95, 1, 'c'], ['China', 35, 103, 1, 'c'], ['India', 22, 79, 1, 'c'], ['Kazakhstan', 48, 67, 1, 'c'],
    ['Mongolia', 46.8, 103, 2, 'c'], ['Indonesia', -2.5, 118, 1, 'c'], ['Japan', 36.5, 138.5, 1, 'c'], ['Saudi Arabia', 24, 45, 1, 'c'],
    ['Iran', 32.5, 54, 1, 'c'], ['Turkey', 39, 35, 1, 'c'], ['Iraq', 33, 43.7, 2, 'c'], ['Syria', 35, 38.5, 3, 'c'],
    ['Jordan', 31.2, 36.5, 3, 'c'], ['Israel', 31.4, 34.9, 3, 'c'], ['Lebanon', 33.9, 35.9, 3, 'c'], ['Yemen', 15.9, 47.6, 2, 'c'],
    ['Oman', 21, 57, 2, 'c'], ['United Arab Emirates', 23.9, 54.3, 3, 'c'], ['Qatar', 25.3, 51.2, 3, 'c'], ['Kuwait', 29.3, 47.6, 3, 'c'],
    ['Afghanistan', 33.8, 66, 2, 'c'], ['Pakistan', 30, 69.5, 2, 'c'], ['Uzbekistan', 41.5, 64, 3, 'c'], ['Turkmenistan', 39, 59.5, 3, 'c'],
    ['Nepal', 28.3, 84, 3, 'c'], ['Bangladesh', 23.8, 90.3, 3, 'c'], ['Sri Lanka', 7.8, 80.7, 3, 'c'], ['Myanmar', 21.5, 96, 2, 'c'],
    ['Thailand', 15.5, 101, 2, 'c'], ['Laos', 19.5, 102.5, 3, 'c'], ['Vietnam', 16, 107.5, 2, 'c'], ['Cambodia', 12.7, 104.9, 3, 'c'],
    ['Malaysia', 4, 102, 2, 'c'], ['Philippines', 12.5, 122.5, 2, 'c'], ['Taiwan', 23.7, 121, 2, 'c'], ['South Korea', 36.4, 127.9, 2, 'c'],
    ['North Korea', 40.2, 127.2, 3, 'c'], ['Papua New Guinea', -6.5, 145, 2, 'c'],
    // Oceania
    ['Australia', -25, 134, 1, 'c'], ['New Zealand', -42, 172.5, 2, 'c'],
    // Africa
    ['Egypt', 26.5, 30, 1, 'c'], ['Libya', 27, 17, 1, 'c'], ['Algeria', 28, 2.6, 1, 'c'], ['Morocco', 31.8, -6.5, 2, 'c'],
    ['Tunisia', 34, 9.5, 3, 'c'], ['Mali', 17.5, -2, 2, 'c'], ['Niger', 17.5, 9.5, 2, 'c'], ['Chad', 15.5, 18.7, 2, 'c'],
    ['Sudan', 15.5, 30, 1, 'c'], ['South Sudan', 7.3, 30.2, 3, 'c'], ['Ethiopia', 8.6, 39.6, 1, 'c'], ['Somalia', 5, 46, 2, 'c'],
    ['Kenya', 0.5, 37.9, 2, 'c'], ['Tanzania', -6.3, 34.8, 2, 'c'], ['Uganda', 1.3, 32.4, 3, 'c'], ['DR Congo', -2.9, 23.6, 1, 'c'],
    ['Congo', -0.7, 15.2, 3, 'c'], ['Gabon', -0.8, 11.6, 3, 'c'], ['Cameroon', 5.7, 12.4, 3, 'c'], ['Central African Republic', 6.6, 20.9, 3, 'c'],
    ['Nigeria', 9.6, 8.1, 1, 'c'], ['Ghana', 7.9, -1.1, 3, 'c'], ['Côte d’Ivoire', 7.6, -5.5, 3, 'c'], ['Senegal', 14.5, -14.5, 3, 'c'],
    ['Mauritania', 20.3, -10.3, 2, 'c'], ['Burkina Faso', 12.3, -1.7, 3, 'c'], ['Guinea', 10.4, -10.9, 3, 'c'], ['Eritrea', 15.4, 38.9, 3, 'c'],
    ['Angola', -12.3, 17.5, 2, 'c'], ['Zambia', -13.5, 27.8, 2, 'c'], ['Zimbabwe', -19, 29.8, 3, 'c'], ['Mozambique', -17.3, 35.5, 2, 'c'],
    ['Malawi', -13.2, 34.3, 3, 'c'], ['Namibia', -22.1, 17.2, 2, 'c'], ['Botswana', -22.2, 23.8, 3, 'c'], ['South Africa', -29, 24.7, 1, 'c'],
    ['Madagascar', -19.4, 46.7, 2, 'c'],
  ];
  // The names are drawn onto the planet itself, in light: they curve along their line of latitude, foreshorten toward
  // the limb and turn with the globe, the way an engraved globe carries its names. Countries in spaced capitals,
  // seas and oceans in spaced italics. Textures are made only when a name first comes into reach.
  const geoG = new THREE.Group(); scene.add(geoG);
  const GEO_ORDER = { o: 0, c: 1, s: 2 };
  const GEO_STYLE = {
    o:  { caps: false, italic: true,  weight: 300, track: .42, h: .058, alpha: .55,  color: PC.mauve },
    s:  { caps: false, italic: true,  weight: 400, track: .16, h: .033, alpha: .74,  color: PC.mauve },
    c1: { caps: true,  italic: false, weight: 500, track: .3,  h: .038, alpha: .86, color: PC.ink },
    c2: { caps: true,  italic: false, weight: 500, track: .26, h: .033, alpha: .72, color: PC.ink },
    c3: { caps: true,  italic: false, weight: 500, track: .24, h: .029, alpha: .64,  color: PC.ink },
  };
  const geoItems = GEO.map(([name, lat, lon, rank, kind]) => ({ name, lat, lon, rank, kind, p: vec(lat, lon),
    st: GEO_STYLE[kind === 'c' ? 'c' + rank : kind], mesh: null, op: 0 }))
    .sort((a, b) => a.rank - b.rank || GEO_ORDER[a.kind] - GEO_ORDER[b.kind]);
  const geoReach = x => x.kind === 'o' ? 9 : x.kind === 's' ? (x.rank <= 2 ? 4.3 : 3) : (x.rank === 1 ? 5.6 : x.rank === 2 ? 3.8 : 2.9);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function geoBuild(x) {
    const st = x.st, fs = 46, pad = fs * .7, c = document.createElement('canvas'), g = c.getContext('2d');
    const font = `${st.italic ? 'italic ' : ''}${st.weight} ${fs}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.font = font;
    const chars = [...(st.caps ? x.name.toUpperCase() : x.name)], track = fs * st.track, ws = chars.map(ch => g.measureText(ch).width);
    const tw = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    c.width = Math.ceil(tw + pad * 2); c.height = Math.ceil(fs * 1.9);
    g.font = font; g.textBaseline = 'middle';
    const draw = () => { let px = pad; chars.forEach((ch, i) => { g.fillText(ch, px, c.height / 2); px += ws[i] + track; }); };
    g.fillStyle = '#000'; g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = fs * .55; g.globalAlpha = .62; draw();   // a soft dark bed, for city lights and cloud
    g.fillStyle = '#fff'; g.shadowColor = 'rgba(255,255,255,.8)'; g.shadowBlur = fs * .3; g.globalAlpha = .28; draw(); // the glow
    g.shadowBlur = 0; g.globalAlpha = 1; draw();                                                                         // the letters
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = maxAniso;
    // a strip of the sphere: columns follow the line of latitude, rows the meridian
    const hDeg = st.h / D, wDeg = hDeg * c.width / c.height, k = Math.max(.25, Math.cos(x.lat * D));
    const cols = Math.max(8, Math.ceil(wDeg / 1.5)), pos = [], uv = [], idx = [];
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= cols; i++) {
      const s = i / cols, t = j;
      const v = vec(x.lat + (t - .5) * hDeg, x.lon + (s - .5) * wDeg / k, 1.0035);
      pos.push(v.x, v.y, v.z); uv.push(s, t);
    }
    for (let i = 0; i < cols; i++) { const a = i, b = i + 1, c2 = i + cols + 1, d2 = i + cols + 2; idx.push(a, b, d2, a, d2, c2); }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geom.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(st.color), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    x.mesh = new THREE.Mesh(geom, mat); x.mesh.renderOrder = 5; x.mesh.visible = false; geoG.add(x.mesh);
    // the label's ends and top/bottom, for keeping it clear of markers and the interface
    x.ends = [vec(x.lat, x.lon - wDeg / 2 / k), vec(x.lat, x.lon + wDeg / 2 / k), vec(x.lat + hDeg / 2, x.lon), vec(x.lat - hDeg / 2, x.lon)];
    x.wx = wDeg * D / 2; x.wy = hDeg * D / 2;
  }
  const geoDir = new THREE.Vector3();
  function placeGeo(blocks, show = true) {
    const d = cam.dist * (phone() ? 1.12 : 1), placed = [], seen = new Set();
    const quiet = !show || document.body.classList.contains('stage-open') || document.body.classList.contains('arriving');
    geoDir.copy(camera.position).normalize();
    for (const x of geoItems) {
      const c = x.p.dot(geoDir);                       // 1 faces us, 0 sits on the limb
      let target = 0;
      if (!quiet && d < geoReach(x) && c > .3 && !seen.has(x.name)) {
        if (!x.mesh) geoBuild(x);
        const pts = x.ends.map(toScreen), xs = pts.map(q => q.x), ys = pts.map(q => q.y);
        const r = { x: Math.min(...xs) - 4, y: Math.min(...ys) - 3, w: Math.max(...xs) - Math.min(...xs) + 8, h: Math.max(...ys) - Math.min(...ys) + 6 };
        if (r.x > 6 && r.x + r.w < innerWidth - 6 && r.y > 6 && r.y + r.h < innerHeight - 6 && !blocks.some(q => hit(r, q)) && !placed.some(q => hit(r, q))) {
          placed.push(r); seen.add(x.name);
          target = smooth(.3, .55, c);                  // fade toward the limb
        }
      }
      if (!x.mesh) continue;
      x.op += (target - x.op) * .16; if (Math.abs(target - x.op) < .004) x.op = target;
      x.mesh.visible = x.op > .004; x.mesh.material.opacity = x.op * x.st.alpha;
    }
    if (cloudsReady) {
      const shown = geoItems.filter(x => x.mesh && x.op > .02).sort((a, b) => b.op - a.op).slice(0, 40), A = cloudMat.uniforms.lblA.value, B = cloudMat.uniforms.lblB.value;
      for (let i = 0; i < 40; i++) { const x = shown[i]; if (x) { A[i].set(x.p.x, x.p.y, x.p.z, x.wx); B[i].set(x.wy, x.op, 0, 0); } else B[i].set(0, 0, 0, 0); }
    }
  }

  const leftPanel = () => (inspEl.hidden ? $('.story') : inspEl);
  const v3 = new THREE.Vector3();
  function toScreen(p) { v3.copy(p).project(camera); return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, front: v3.z < 1 }; }
  function facing(p) { return p.dot(v3.copy(camera.position).sub(p)) > 0.02; }
  function updateOverlay(now) {
    const earthUI = viewMode === 'orbit' || (viewMode === 'trans' && skyBlend < 0.05);
    marksEl.style.visibility = earthUI ? 'visible' : 'hidden';
    lensEl.style.visibility = gestEl.style.visibility = earthUI ? 'visible' : 'hidden';
    if (!earthUI) placeGeo([], false);
    if (earthUI) placeLens();
    if (earthUI) {
      const named = [], walls = [$('.story'), inspEl, $('.bar'), $('.call'), $('.chapters')].map(box).filter(Boolean), cap = phone() ? 4 : 9;
      for (const x of markers) {
        const vis = !x.dup && facing(x.p);
        x.b.style.display = vis ? 'block' : 'none';
        if (vis) { const s = toScreen(x.p); x.b.style.transform = `translate(${s.x}px,${s.y}px)`; x.s = s; }
        x.b.classList.remove('named');
      }
      if (uiMode === 'brief' || (uiMode === 'explore' && lens === 'places')) {
        for (const x of [...markers].sort((a, b) => b.m.count - a.m.count)) {
          if (named.length >= cap || x.b.style.display === 'none' || !x.s) continue;
          const w = x.m.place.length * 7.2 + 8, r = { x: x.s.x + 16, y: x.s.y - 9, w, h: 18 };
          const hit = q => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y;
          if (named.some(hit) || walls.some(hit) || r.x + r.w > innerWidth - 8) continue;
          named.push(r); x.b.classList.add('named');
        }
      }
      // map names go around everything else: the interface, marker dots and their names, lens labels
      const dots = [...markers, ...lensItems, ...gestItems].filter(x => x.s && x.b.style.display !== 'none').map(x => ({ x: x.s.x - 11, y: x.s.y - 11, w: 22, h: 22 }));
      const lensText = [...lensItems, ...gestItems].filter(x => x.s && x.b.style.display !== 'none' && !x.b.classList.contains('hide-t')).map(x => box(x.tx)).filter(Boolean);
      placeGeo([...walls, ...named, ...dots, ...lensText, ...[lensKey, $('.status'), $('.fine')].map(box).filter(Boolean)]);
      for (let i = pings.length - 1; i >= 0; i--) {
        const pg = pings[i];
        if (now > pg.until) { pg.el.remove(); pings.splice(i, 1); continue; }
        const vis = facing(pg.p); pg.el.style.display = vis ? 'block' : 'none';
        if (vis) { const s = toScreen(pg.p); pg.el.style.transform = `translate(${s.x}px,${s.y}px)`; }
      }
    }
    // sky labels
    const showSky = skyBlend > 0.6;
    skyLabels.style.opacity = showSky ? String(clamp01((skyBlend - 0.6) / 0.4)) : '0';
    if (showSky) {
      // hide any label that would land under the interface (bar, story, money call)
      const blocks = [$('.bar'), leftPanel(), $('.call')].map(el => el.getBoundingClientRect());
      const hits = r => blocks.some(q => r.right > q.left - 6 && r.left < q.right + 6 && r.bottom > q.top - 6 && r.top < q.bottom + 6);
      for (const t of skyTags) {
        const s = toScreen(t.p);
        if (!s.front) { t.el.style.display = 'none'; continue; }
        t.el.style.display = 'block'; t.el.style.visibility = 'hidden'; t.el.style.transform = `translate(${s.x}px,${s.y}px)`;
        const r = t.el.getBoundingClientRect();
        const ok = r.right > 0 && r.left < innerWidth && !hits(r);
        t.el.style.visibility = ok ? 'visible' : 'hidden';
      }
      const a = toScreen(moonP), b = toScreen(sunFar);
      drawMoon(Math.atan2(b.y - a.y, b.x - a.x));
    }
    if (!selected || !earthUI) { leader.style.display = 'none'; ptag.style.opacity = '0'; return; }
    const sp = vec(selected.lat, selected.lon, 1.002);
    if (!facing(sp)) { leader.style.display = 'none'; ptag.style.opacity = '0'; return; }
    const a = toScreen(sp);
    if (selMode === 'tag') {
      leader.style.display = 'none'; ptag.style.opacity = '';
      const w = ptag.offsetWidth; const left = a.x + 16 + w > innerWidth - 16 ? a.x - 16 - w : a.x + 16;
      ptag.style.transform = `translate(${Math.round(left)}px,${Math.round(a.y - 16)}px)`; ptag.classList.toggle('flip', left < a.x);
      return;
    }
    if (phone() || inspEl.hidden) { leader.style.display = 'none'; return; }
    const r = inspEl.getBoundingClientRect(), ex = r.right, ey = Math.min(r.bottom - 40, r.top + 74), mx = ex + (a.x - ex) * 0.5;
    leaderPath.setAttribute('d', `M${a.x} ${a.y} L${mx} ${ey} L${ex} ${ey}`);
    leaderDot.setAttribute('cx', a.x); leaderDot.setAttribute('cy', a.y);
    leader.style.display = 'block';
  }

  // ---------- Thinking: the read plays out after arrival ----------
  function runThinking() {
    stopThinking(); thinkDone = true;
    if (chapter === 0) renderFront(true);
    quietUntil = performance.now() + 2500;
  }
  function stopThinking() { if (think) { clearTimeout(think.timer); think = null; } $('.call').classList.remove('lit'); }
  function finishThinking() {
    const was = !!think; stopThinking(); thinkDone = true;
    $('.call').classList.add('invite'); setTimeout(() => $('.call').classList.remove('invite'), 4200);
    if (chapter === 0) renderFront(false);
    if (was) quietUntil = performance.now() + 2500;
  }
  $('[data-replay]').addEventListener('click', () => { if (chapter !== 0) go(0); runThinking(); });

  // ---------- Chapters ----------
  function markChapter(i, keepCard) {
    chapter = i; railUI(i);
    document.body.dataset.chapter = CHAPTERS[i].id;
    const inner = $('#story');
    if (!started || reduced) renderStory(CHAPTERS[i]);
    else { inner.classList.add('out'); setTimeout(() => { if (chapter === i) { renderStory(CHAPTERS[i]); inner.classList.remove('out'); } }, 420); }
    if (!keepCard) deselect();
  }
  function go(i) {
    i = Math.max(0, Math.min(CHAPTERS.length - 1, i));
    if (uiMode !== 'brief') { if (uiMode === 'depth' || uiMode === 'money') clearDepth(); if (mOn) moneyExit(); if (uiMode === 'explore') setLens('places'); uiMode = 'brief'; document.body.classList.remove('mode-explore', 'mode-depth', 'mode-money', 'browse'); document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === 'brief'))); chapter = -1; }
    stack = []; inspEl.hidden = true; document.body.classList.remove('insp-open');
    if (!renderer) { chapter = i; renderStory(CHAPTERS[i]); railUI(i); return; }
    if (think && i !== 0) finishThinking();
    if (i === chapter && !selected && viewMode !== 'trans') return;
    const c = CHAPTERS[i];
    markChapter(i);
    if (c.sky) { skyLook.az = 100; skyLook.alt = phone() ? 30 : 22; skyHome = { ...skyLook }; startTrans(poseSky(), 'sky', 4200); return; }
    highlight([]);
    const after = () => { if (c.place && chapter === i) selectPlace(c.place, false); };
    if (viewMode === 'sky' || (viewMode === 'trans' && trans.toMode === 'sky')) {
      startTrans(poseOrbit(c.view), 'orbit', 3400, () => { Object.assign(cam, c.view); after(); });
      return;
    }
    flyTo(c.view);
    if (c.place) setTimeout(after, reduced ? 0 : 1500);
    if (i === 0 && !thinkDone && !think) setTimeout(() => { if (chapter === 0 && !think && !thinkDone) runThinking(); }, reduced ? 0 : 900);
    quietUntil = performance.now() + (c.place ? 3200 : 2600);
  }

  // ---------- Input ----------
  let wheelLock = 0;
  addEventListener('wheel', e => {
    if (e.target.closest('.insp, .cmd, .status-pop')) return;
    if (window.SixSevenDeck?.isOpen() || !cmd.hidden) return;
    if (uiMode !== 'brief') { e.preventDefault(); if (viewMode === 'orbit' && !document.body.classList.contains('stage-open')) { flight = null; cam.dist = Math.max(1.9, Math.min(7.5, cam.dist * Math.exp(e.deltaY * 0.0012))); quietUntil = performance.now() + 5000; } return; }
    if (e.deltaY > 0 && chapter === CHAPTERS.length - 1 && performance.now() > wheelLock) { e.preventDefault(); wheelLock = performance.now() + 1100; window.SixSevenDeck?.open(); return; }
    const sc = e.target.closest('.story');
    if (sc && sc.scrollHeight > sc.clientHeight + 4) {
      const atTop = sc.scrollTop <= 0, atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
      if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) return;
    }
    e.preventDefault();
    const now = performance.now(); if (now < wheelLock || Math.abs(e.deltaY) < 8) return;
    wheelLock = now + 1100; go(chapter + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmd.hidden ? openCmd() : closeCmd(); return; }
    if (!cmd.hidden) return;
    if (e.key === 'Escape') { if (window.SixSevenDeck?.isOpen()) window.SixSevenDeck.close(); else if (!pop.hidden) togglePop(false); else if (!inspEl.hidden && (stack.length > 1 || uiMode === 'brief' || mOn)) insBack(); else deselect(); return; }
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === '/') { e.preventDefault(); openCmd(); return; }
    if ((e.key === 'e' || e.key === 'E') && !window.SixSevenDeck?.isOpen()) { setMode(uiMode === 'explore' ? 'brief' : 'explore'); return; }
    if ((e.key === 'm' || e.key === 'M') && !window.SixSevenDeck?.isOpen()) { setMode(uiMode === 'money' ? 'brief' : 'money'); return; }
    if ((e.key === 'd' || e.key === 'D') && !window.SixSevenDeck?.isOpen()) { setMode(uiMode === 'depth' ? 'brief' : 'depth'); return; }
    if (e.key === 'o' || e.key === 'O') { const d = window.SixSevenDeck; if (d) d.isOpen() ? d.close() : d.open(); return; }
    if (window.SixSevenDeck?.isOpen()) return;
    if (mOn && inspEl.hidden) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); moneyGo(mIdx + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); moneyGo(mIdx - 1); }
      return;
    }
    if (uiMode !== 'brief') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(chapter + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(chapter - 1); }
  });
  canvas.addEventListener('pointerdown', e => {
    if (viewMode === 'trans') return;
    if (think) finishThinking();
    realignAt = 0; skyRealignAt = 0;
    dragging = { x: e.clientX, y: e.clientY, lat: cam.lat, lon: cam.lon, az: skyLook.az, alt: skyLook.alt, moved: 0 };
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); flight = null;
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    dragging.moved = Math.max(dragging.moved, Math.hypot(dx, dy));
    if (viewMode === 'sky') { skyLook.az = (dragging.az - dx * 0.12 + 360) % 360; skyLook.alt = Math.max(4, Math.min(72, dragging.alt + dy * 0.12)); return; }
    const k = 0.22 * (cam.dist / 3);
    cam.lon = wrap(dragging.lon - dx * k); cam.lat = Math.max(-65, Math.min(70, dragging.lat + dy * k));
  });
  const endDrag = () => {
    if (!dragging) return;
    canvas.classList.remove('dragging');
    if (dragging.moved < 4 && selected && selMode === 'tag' && !CHAPTERS[chapter]?.place) deselect();
    // After a drag the globe settles back to the framing the page chose: the chapter, the desk or the selected place.
    // Explore with nothing selected is the free-roaming mode, so there it stays where it was left.
    if (dragging.moved >= 4) {
      if (viewMode === 'orbit' && home && (uiMode !== 'explore' || selected)) realignAt = performance.now() + 1500;
      if (viewMode === 'sky' && skyHome) skyRealignAt = performance.now() + 1500;
    }
    dragging = null; quietUntil = performance.now() + 7000;
  };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  let touch = null;
  $('.story').addEventListener('touchstart', e => { touch = e.touches[0].clientX; }, { passive: true });
  $('.story').addEventListener('touchend', e => { if (touch == null) return; const dx = e.changedTouches[0].clientX - touch; if (Math.abs(dx) > 50) go(chapter + (dx < 0 ? 1 : -1)); touch = null; }, { passive: true });

  // ---------- Loop ----------
  let last = performance.now(), lastSec = -1;
  const openSun = new THREE.Vector3(), skySun = new THREE.Vector3();
  const sunVec = ms => { const s = subsolar(ms); return vec(s.lat, s.lon).normalize(); };
  function frame(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const elapsed = now - t0;

    // camera
    if (viewMode === 'trans') {
      const t = trans.ms > 0 ? Math.min(1, (now - trans.start) / trans.ms) : 1, e = ease(t);
      const a = trans.from.pos, c = trans.ctrl, b = trans.to.pos, u = 1 - e;
      camera.position.set(u * u * a.x + 2 * u * e * c.x + e * e * b.x, u * u * a.y + 2 * u * e * c.y + e * e * b.y, u * u * a.z + 2 * u * e * c.z + e * e * b.z);
      camera.quaternion.copy(trans.from.quat).slerp(trans.to.quat, e);
      camera.fov = trans.from.fov + (trans.to.fov - trans.from.fov) * e; camera.updateProjectionMatrix();
      skyBlend = trans.toMode === 'sky' ? smooth(0.35, 0.95, t) : 1 - smooth(0.0, 0.5, t);
      if (t >= 1) { const done = trans; viewMode = done.toMode; trans = null; skyBlend = viewMode === 'sky' ? 1 : 0; skySince = now; done.after?.(); }
    } else if (viewMode === 'sky') {
      if (skyRealignAt && now > skyRealignAt && !dragging && skyHome) {
        const da = ((skyHome.az - skyLook.az + 540) % 360) - 180, dl = skyHome.alt - skyLook.alt;
        skyLook.az = (skyLook.az + da * Math.min(1, dt * 3.2) + 360) % 360; skyLook.alt += dl * Math.min(1, dt * 3.2);
        if (Math.abs(da) < .1 && Math.abs(dl) < .1) skyRealignAt = 0;
      }
      const pose = poseSky(reduced ? 0 : now - skySince);
      camera.position.copy(pose.pos); camera.quaternion.copy(pose.quat);
      if (camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
      skyBlend = 1;
    } else {
      if (flight) {
        const t = Math.min(1, (now - flight.start) / flight.ms), e = ease(t);
        cam.lat = flight.from.lat + (flight.to.lat - flight.from.lat) * e;
        cam.lon = wrap(flight.from.lon + flight.dLon * e);
        cam.dist = flight.from.dist + (flight.to.dist - flight.from.dist) * e + Math.sin(Math.PI * e) * flight.arc;
        if (t >= 1) flight = null;
      } else if (realignAt && now > realignAt && !dragging) {
        realignAt = 0; flyTo({ lat: home.lat, lon: home.lon, dist: cam.dist }, 1500); quietUntil = now + 4000;
      } else if (!dragging && !reduced && now > quietUntil && cmd.hidden) {
        const c = CHAPTERS[chapter];
        cam.lon = wrap(cam.lon - dt * (selected ? 0.25 : 2.2));
      }
      if (camera.fov !== 32) { camera.fov = 32; camera.updateProjectionMatrix(); }
      camera.up.set(0, 1, 0);
      camera.position.copy(vec(cam.lat, cam.lon, cam.dist * distMul));
      camera.lookAt(0, 0, 0);
      skyBlend = 0;
    }

    // sun: earth chapters from the NYSE open, sky from 06:42 in the observer's city; blended through the transition
    openSun.copy(sunVec(OPEN + elapsed)); skySun.copy(sunVec(SKYT + elapsed));
    const timeBlend = viewMode === 'trans' ? (trans.toMode === 'sky' ? smooth(0, 0.7, (now - trans.start) / Math.max(1, trans.ms)) : 1 - smooth(0.3, 1, (now - trans.start) / Math.max(1, trans.ms))) : (viewMode === 'sky' ? 1 : 0);
    sunDir.copy(openSun).lerp(skySun, timeBlend).normalize();
    if (arriveAt) { const t = Math.min(1, (now - arriveAt) / 4200); if (t < 1) sunDir.applyAxisAngle(Y_UP, -(1 - ease(t)) * 2.3); else arriveAt = 0; }
    const sec = Math.floor(elapsed / 1000);
    if (sec !== lastSec) { lastSec = sec; if (sec % 15 === 0) clockTick(); }

    // fades
    skyGroup.visible = skyBlend > 0.001;
    backdropMat.uniforms.fade.value = skyBlend; starMat.uniforms.fade.value = skyBlend; figMat.opacity = 0.2 * skyBlend;
    atmoMat.uniforms.fade.value = 1 - smooth(0.2, 0.8, skyBlend);
    dust.material.opacity = 0.18 * (1 - skyBlend);
    coast.material.opacity = (PAL.coastA ?? .34) * (1 - skyBlend); coast.visible = skyBlend < 0.98;
    const pt = (now - pulseAt) / 1600;
    earthMat.uniforms.gain.value += ((uiMode === 'explore' ? lensGain : uiMode === 'depth' || uiMode === 'money' ? .14 : 1) - earthMat.uniforms.gain.value) * .08;
    if (gestParts.length) animateGest(now);
    earthMat.uniforms.city.value += ((uiMode === 'depth' || uiMode === 'money' ? .55 : 1) - earthMat.uniforms.city.value) * .08;
    wxMat.uniforms.fade.value += ((uiMode === 'explore' && lens === 'weather' && wxGrid ? 1 - skyBlend : 0) - wxMat.uniforms.fade.value) * .06; if (wxMat.uniforms.fade.value < .01 && !(uiMode === 'explore' && lens === 'weather')) wxShell.visible = false; else if (wxGrid && lens === 'weather') wxShell.visible = true;
    if (wind) { const want = windOn && uiMode === 'explore' && lens === 'weather' ? 1 - skyBlend : 0; wind.m.opacity += (want * .85 - wind.m.opacity) * .06; wind.line.visible = wind.m.opacity > .01; if (wind.line.visible) windStep(dt); }
    if (moodMat) { const want = uiMode === 'explore' && lens === 'mood' ? 1 - skyBlend : 0; moodMat.uniforms.fade.value += (want - moodMat.uniforms.fade.value) * .05; moodMat.uniforms.time.value = elapsed / 1000; moodShell.visible = moodMat.uniforms.fade.value > .01; }
    hazeMat.uniforms.time.value = elapsed / 1000; hazeMat.uniforms.fade.value += ((started ? 1 : 0) * (1 - skyBlend) * (uiMode === 'money' || uiMode === 'depth' ? .45 : uiMode === 'explore' && (lens === 'weather' || lens === 'mood') ? .15 : 1) - hazeMat.uniforms.fade.value) * (started ? .025 : .2); hazeShell.visible = hazeMat.uniforms.fade.value > .01;
    if (cloudsReady) { const inLens = uiMode === 'explore' && lens === 'weather', want = (started ? 1 : 0) * (1 - skyBlend) * (inLens ? 1 : uiMode === 'money' || uiMode === 'depth' ? .4 : uiMode === 'explore' ? .55 : 1);
      cloudMat.uniforms.fade.value += (want - cloudMat.uniforms.fade.value) * (started ? .03 : .2); cloudShell.visible = cloudMat.uniforms.fade.value > .01; earthMat.uniforms.cloudAmt.value = cloudMat.uniforms.fade.value; }
    earthMat.uniforms.boost.value = 1 + (pt >= 0 && pt <= 1 ? 1.4 * Math.sin(Math.PI * pt) : 0);
    document.body.classList.toggle('in-sky', skyBlend > 0.5);
    const hvTarget = viewMode === 'sky' || orreryOpen || mOn ? 0 : (CHAPTERS[chapter]?.heavens ? 1 : (heavensOn ? 0.42 : 0)) * (1 - skyBlend);
    hv += (hvTarget - hv) * Math.min(1, dt * 2.6);
    heaven.visible = hv > 0.01;
    heaven.rotation.y = -(gmstDeg(OPEN + elapsed) - G0) * D; galaxy.rotation.y = heaven.rotation.y;
    mwMat.uniforms.fade.value = 1 - skyBlend; natalMat.uniforms.fade.value = (CHAPTERS[chapter]?.heavens ? hv : 0);
    bandMat.uniforms.fade.value = hv; hvStarMat.uniforms.fade.value = hv; hvPlanetMat.uniforms.fade.value = hv;
    for (const m of hvMats) m.opacity = m.userData.base * hv;
    for (const a of arcs) a.m.opacity = (hvLit.size ? (a.keys.some(k => hvLit.has(k)) ? 0.95 : 0.06) : a.m.userData.base) * hv;
    document.body.classList.toggle('heavens-full', hv > 0.7);

    earthMat.uniforms.camPos.value.copy(camera.position);
    if (mOn) placeMoney(now);
    renderer.render(scene, camera);
    updateOverlay(now);
    updateHeavens();
    if (orreryOpen) layoutOrrery();
    requestAnimationFrame(frame);
  }


  // ---------- Money, in chapters: one instrument each, the planet as its dial ----------
  // Now and The plan put the new-cash split around the planet as a ring; the plan's dial turns it through the market's
  // moods. Growth is a road you scrub through time. Ideas stand on the planet where they live. Every figure here is
  // arithmetic on the edition's stored inputs.
  const mScene = $('#mscene'), mRail = $('#mrail'), mHaloEl = $('#mhalo');
  const MCH = MNY.filter(d => !d.has || d.has());
  let mIdx = 0, mOn = false, mMood = null, mRoad = null;
  const halo = new THREE.Group(); halo.visible = false; scene.add(halo);
  let haloNow = null, haloFrom = null, haloAt = 0, haloDone = true, haloLab = [], haloPulse = 0, haloKeys = ['reserve', 'core', 'focused'], haloGoal = null;
  const HALO_R = 1.2, BKEYS = ['reserve', 'core', 'focused'], BNAME = { reserve: 'Reserve', core: 'Core', focused: 'Focused' };
  const BCOL = { reserve: PC.series1, core: PC.series2, focused: PC.series3, goal: PC.glow };
  BNAME.goal = 'Extra income';
  const fmtDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const daysTo = iso => Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(M.date + 'T12:00:00Z')) / 864e5);
  const DIRW = { up: 'to rise', down: 'to fall', flat: 'to hold flat' };
  // The split last seen on this device. Only the newest edition updates it, so browsing the archive doesn't rewrite it.
  function mSeen(sp) {
    let was = null; try { was = JSON.parse(localStorage.getItem('sixseven.money.seen') || 'null'); } catch (e) { /* storage blocked */ }
    try { if (!was || was.date <= M.date) localStorage.setItem('sixseven.money.seen', JSON.stringify({ date: M.date, split: sp })); } catch (e) { /* storage blocked */ }
    return was && was.date < M.date && Array.isArray(was.split) && was.split.some((v, i) => v !== sp[i]) ? was : null;
  }
  const MOODS = ['risk_off', 'lean_off', 'mixed', 'rotation', 'lean_on', 'risk_on'];
  function haloArc(t0, len, r0, r1, color, op) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, Math.max(6, Math.ceil(len * 48)), 1, t0, len),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.renderOrder = 6; m.userData.base = op; halo.add(m);
  }
  // The split as three arcs, clockwise from the top, with a faint full track behind them.
  function haloDraw(pcts, grow) {
    for (const o of halo.children.slice()) { o.geometry.dispose(); o.material.dispose(); halo.remove(o); }
    haloArc(0, Math.PI * 2, HALO_R - .003, HALO_R + .003, PC.ink, haloGoal ? .16 : .09);
    const gap = haloKeys.length > 1 ? .05 : 0, total = Math.PI * 2 - gap * haloKeys.length; let a = Math.PI / 2; haloLab = [];
    haloKeys.forEach((k, i) => {
      const full = total * pcts[i] / 100, len = full * grow;
      if (len > .002) { haloArc(a - len, len, HALO_R - .011, HALO_R + .011, BCOL[k], .95); haloArc(a - len, len, HALO_R - .045, HALO_R + .045, BCOL[k], .1); }
      haloLab.push({ key: k, ang: a - full / 2, pct: pcts[i] });
      a -= full + gap;
    });
  }
  const splitFor = mood => { const p = MONEY.policy.find(x => x.regime === mood); return p ? [p.reserve, p.core, p.focused] : null; };
  function haloTo(pcts, from) { haloFrom = from || (haloNow && pcts ? haloNow.slice() : null); if (from) haloPulse = performance.now() + 4200; haloNow = pcts; haloAt = performance.now(); haloDone = false; halo.visible = !!pcts; }
  function haloLabels() {
    mHaloEl.replaceChildren();
    for (const k of haloKeys) { const n = el('div', 'hl'), w = el('div'), nm = el('span', 'nm'); const dot = el('i'); dot.style.background = BCOL[k]; nm.append(dot, BNAME[k]); w.append(nm, el('b'), el('span', 'dl')); n.append(w); n.dataset.k = k; mHaloEl.append(n); }
  }
  function placeMoney(now) {
    if (!halo.visible || !haloNow) return;
    halo.quaternion.copy(camera.quaternion);
    if (!haloDone) {
      const t = Math.min(1, (now - haloAt) / (haloFrom ? 700 : 1100)), e = ease(t);
      haloDraw(haloFrom ? haloNow.map((v, i) => haloFrom[i] + (v - haloFrom[i]) * e) : haloNow, haloFrom ? 1 : e);
      if (t >= 1) haloDone = true;
    }
    if (now < haloPulse) { const k = .72 + .28 * Math.cos((haloPulse - now) / 4200 * Math.PI * 7); halo.children.forEach((m, i) => { if (i) m.material.opacity = m.userData.base * k; }); }
    const pr = MONEY.profile || {}, q = camera.quaternion;
    mHaloEl.querySelectorAll('.hl').forEach((n, i) => {
      const l = haloLab[i]; if (!l) return;
      const c = Math.cos(l.ang), sn = Math.sin(l.ang), s = toScreen(new THREE.Vector3(c * HALO_R * 1.07, sn * HALO_R * 1.07, 0).applyQuaternion(q)), w = n.firstChild;
      n.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      // each label sits outside the ring on its own side, so it never covers an arc
      w.style.transform = `translate(${c > .3 ? '14px' : c < -.3 ? 'calc(-100% - 14px)' : '-50%'}, ${sn > .3 ? 'calc(-100% - 10px)' : sn < -.3 ? '10px' : '-50%'})`;
      w.style.textAlign = c > .3 ? 'left' : c < -.3 ? 'right' : 'center';
      const pc = Math.round(l.pct);
      if (haloGoal) { n.querySelector('b').textContent = fmt$(haloGoal.have); n.querySelector('.dl').textContent = `a year, of your ${fmt$(haloGoal.goal)} goal`; }
      else { n.querySelector('b').textContent = `${pc}%`; n.querySelector('.dl').textContent = pr.monthly ? `${fmt$(pr.monthly * pc / 100)} of each ${fmt$(pr.monthly)} month` : ''; }
    });
    mHaloEl.querySelectorAll('.md').forEach((n, i) => {
      const ang = (205 + i * (130 / (MOODS.length - 1))) * D;
      const s = toScreen(new THREE.Vector3(Math.cos(ang) * HALO_R * 1.3, Math.sin(ang) * HALO_R * 1.3, 0).applyQuaternion(q));
      n.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    });
  }
  const mView = (dist, lat = 22, lon = -82) => { if (viewMode === 'orbit') flyTo({ lat, lon, dist: phone() ? dist * 1.5 : dist }, 1700); };
  function moneyEnter() {
    mOn = true; mScene.hidden = false; mRail.hidden = false; document.body.classList.add('m-on');
    mRail.replaceChildren(...MCH.map((d, i) => { const b = el('button'); b.type = 'button'; b.append(el('span', 'n', String(i + 1).padStart(2, '0')), el('span', 't', d.name)); b.addEventListener('click', () => moneyGo(i)); return b; }));
    moneyGo(mIdx);
  }
  function moneyExit() { document.body.classList.remove('m-on'); mOn = false; mScene.hidden = true; mRail.hidden = true; halo.visible = false; haloNow = null; mHaloEl.replaceChildren(); mRoad = null; }
  const facts = (...items) => { const f = el('div', 'm-facts'); for (const [v, label, col] of items) { const d = el('div'), sp = el('span'); if (col) { const i = el('i'); i.style.background = col; sp.append(i); } sp.append(label); d.append(el('b', '', v), sp); f.append(d); } return f; };
  function moneyGo(i) {
    if (!MCH.length) return;
    mIdx = Math.max(0, Math.min(MCH.length - 1, i)); const d = MCH[mIdx], Mo = MONEY, pr = Mo.profile || {};
    mRail.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === mIdx ? 'step' : 'false'));
    clearDepth(); mHaloEl.replaceChildren(); halo.visible = false; haloNow = null; mRoad = null; haloKeys = BKEYS; haloGoal = null; haloPulse = 0;
    const body = el('div', 'm-body'), titleEl = $('[data-m-title]'); let title = esc(d.name);
    $('[data-m-eyebrow]').textContent = `Money\u2003${String(mIdx + 1).padStart(2, '0')} / ${String(MCH.length).padStart(2, '0')}`;
    if (d.key === 'now') {
      title = moneyHeadline(); moneyChain(body);
      const sp = splitFor(Mo.policy.find(p => p.current)?.regime) || (Mo.plan ? BKEYS.map(k => Mo.plan.buckets.find(b => b.key === k)?.percent || 0) : null);
      if (sp) {
        const seen = mSeen(sp); haloTo(sp, seen?.split); haloLabels();
        if (seen) { const li = body.querySelector('.mchain li:last-child .v'); li?.append(el('p', 'when m-changed', `Since you last looked on ${fmtDay(seen.date)}, the plan held back ${seen.split[0]}%. Now it holds back ${sp[0]}%.`)); }
      }
      mView(6.6);
    } else if (d.key === 'plan') {
      const cur = Mo.policy.find(p => p.current); mMood = mMood && splitFor(mMood) ? mMood : cur?.regime || 'mixed';
      const show = () => {
        const p = Mo.policy.find(x => x.regime === mMood), today = p?.current;
        titleEl.innerHTML = p ? `${esc(p.title)}.${today ? '<em>The market’s mood today.</em>' : '<em>If the mood turned this way.</em>'}` : 'The plan';
        const b2 = el('div');
        if (p) {
          b2.append(el('p', 'm-lede', `In this mood the plan holds back ${p.reserve}% of new cash, puts ${p.core}% into broad funds and keeps ${p.focused}% for focused ideas.`));
          if (pr.monthly) b2.append(facts([fmt$(pr.monthly * p.reserve / 100), 'held back a month', BCOL.reserve], [fmt$(pr.monthly * p.core / 100), 'into broad funds', BCOL.core], [fmt$(pr.monthly * p.focused / 100), 'for focused ideas', BCOL.focused]));
        }
        const dial = el('div', 'm-dial');
        for (const k of MOODS) { const q = Mo.policy.find(x => x.regime === k); if (!q) continue; const b = el('button', '', q.title); b.type = 'button'; b.setAttribute('aria-pressed', String(k === mMood)); b.addEventListener('click', () => pick(k)); dial.append(b); }
        b2.append(dial, el('p', 'm-note', today ? 'Turn the dial to see the split in another mood.' : 'A what-if. Today’s mood is marked.'));
        $('[data-m-body]').replaceChildren(b2);
        mHaloEl.querySelectorAll('.md').forEach(n => n.setAttribute('aria-pressed', String(n.dataset.k === mMood)));
      };
      const pick = k => { mMood = k; haloTo(splitFor(k)); show(); };
      haloTo(splitFor(mMood));
      for (const k of MOODS) { const q = Mo.policy.find(x => x.regime === k); if (!q) continue; const b = el('button', 'md' + (q.current ? ' today' : '')); b.type = 'button'; b.dataset.k = k; const sp = el('span', '', q.title); if (q.current) sp.append(el('small', '', 'today')); b.append(el('i'), sp); b.addEventListener('click', () => pick(k)); mHaloEl.append(b); }
      mView(7.4, 14); $('[data-m-title]').innerHTML = title; show(); return finish(d, true);
    } else if (d.key === 'growth') {
      const G = Mo.growth, goal = pr.goal ? pr.goal / .04 : null, hit = goal ? G.curve.find(c => c.values[2] >= goal) : null;
      mRoad = c => {
        const yrs = c.month / 12;
        titleEl.innerHTML = `<span class="hero">${fmtK(c.values[2])}</span><em>${c.month ? `in ${yrs % 1 ? yrs.toFixed(1) : yrs} year${yrs === 1 ? '' : 's'}, if it grows 7% a year` : 'where you start'}</em>`;
        const f = $('[data-m-body] .m-facts'); if (f) f.replaceWith(facts([fmtK(c.values[0]), 'with no growth', PC.series1], [fmtK(c.values[1]), 'at 4% a year', PC.series2], [fmtK(c.values[2]), 'at 7% a year', PC.series3]));
      };
      body.append(el('p', 'm-lede', `${fmt$(G.held_value)} already held + ${fmt$(pr.ready)} planned cash = ${fmt$(G.start_value)} to start. Add ${fmt$(pr.monthly)} a month. Drag to move through time.`), el('div', 'm-facts'));
      if (goal) body.append(el('p', 'm-note', hit ? `Your ${fmt$(pr.goal)}-a-year goal needs about ${fmtK(goal)} at a 4% draw. At 7% a year you’d reach it in about ${Math.round(hit.month / 12)} years.` : `Your ${fmt$(pr.goal)}-a-year goal needs about ${fmtK(goal)} at a 4% draw, beyond 30 years at this pace.`));
      body.append(el('p', 'm-note', G.note));
      title = '';
      $('[data-m-body]').replaceChildren(body); depthScene('m:road'); return finish(d, true);
    } else if (d.key === 'ideas') {
      const ideas = Mo.ideas || [], pts = [], ul = el('ul', 'm-list'); gestT0 = performance.now();
      const stand = (c, k, color, sub) => { const inst = mInst(c.symbol); if (!inst?.home) return; const h = .09 + Math.min(.3, Math.abs(c.since_pct ?? c.move_pct ?? 0) * .03); const top = pillar(inst.home.lat, inst.home.lon, h, color, k * 160); pts.push(vec(inst.home.lat, inst.home.lon)); gestLabel(top, 10 - k, mLabel(c.symbol), sub, () => inspect('instrument', mLabel(c.symbol))); };
      if (ideas.length) {
        title = `${ideas.length} open call${ideas.length === 1 ? '' : 's'}.`;
        body.append(el('p', 'm-lede', 'Each call stands where it lives and is graded when its clock runs out.'));
        ideas.forEach((c, k) => {
          const left = daysTo(c.due_on), span = Math.max(1, daysTo(c.due_on) - daysTo(c.made_on)), done = Math.min(1, Math.max(0, 1 - left / span));
          const li = el('li'), clk = el('i', 'clk'); clk.style.setProperty('--f', done.toFixed(3));
          const moved = c.since_pct == null ? 'not priced yet' : Math.abs(c.since_pct) < .005 ? 'no move yet' : `${pct(c.since_pct)} since the call`;
          li.append(el('b', '', `${mLabel(c.symbol)} ${DIRW[c.direction] || c.direction}`), clk, el('span', '', `${left > 1 ? `${left} days left` : left === 1 ? 'due tomorrow' : left === 0 ? 'due today' : 'due'}, ${moved}, made ${fmtDay(c.made_on)}`));
          li.title = c.claim || ''; ul.append(li);
          stand(c, k, c.direction === 'up' ? PC.up : c.direction === 'down' ? PC.down : PC.series1, `${DIRW[c.direction] || ''}, ${left > 0 ? `${left}d left` : 'due'}`);
        });
      } else {
        const last = (KD?.record?.claims || []).filter(c => c.correct != null && !c.duplicate).sort((a, b2) => b2.due_on.localeCompare(a.due_on)).slice(0, 5);
        title = 'No open calls.';
        body.append(el('p', 'm-lede', last.length ? `The last ${last.length} that closed stand on the planet: ${last.filter(c => c.correct).length} came true.` : 'When the read makes a call, it stands here with its own clock until it’s graded.'));
        last.forEach((c, k) => { const li = el('li'); li.append(el('b', '', `${c.correct ? '✓' : '✗'} ${mLabel(c.symbol)} ${DIRW[c.direction] || c.direction}`), el('span', '', `closed ${fmtDay(c.due_on)}${c.move_pct == null ? '' : `, moved ${pct(c.move_pct)}`}`)); ul.append(li); stand(c, k, c.correct ? PC.glow : PC.down, c.correct ? 'came true' : 'missed'); });
      }
      body.append(ul); if (pts.length) frameOn(pts, 3.9, 16); else mView(6.6);
    } else if (d.key === 'practice') {
      const P = Mo.practice, Sm = P.summary, since = new Date(P.since + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
      const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'], w = n => W[n] || String(n);
      title = `${usdCents(Sm.pnl)}.<em>If you’d put $${P.stake} on every buy call since ${esc(since)}.</em>`;
      body.append(el('p', 'm-lede', `${w(Sm.trades)[0].toUpperCase() + w(Sm.trades).slice(1)} practice buys, and ${w(Sm.winners)} made money. The same $${P.stake}s in the S&P 500 over the same days made ${usdCents(Sm.spx_pnl)}, so following the calls came out ${usdCents(Sm.edge)} ${Sm.edge >= 0 ? 'ahead' : 'behind'}.`));
      body.append(facts([usdCents(Sm.pnl), 'following the calls', PC.glow], [usdCents(Sm.spx_pnl), 'the S&P, same dates', PC.series2], [`${Sm.winners} of ${Sm.trades}`, 'made money', PC.up]));
      body.append(el('p', 'm-note', `${w(Sm.trades)[0].toUpperCase() + w(Sm.trades).slice(1)} trades is a small sample: it shows whether the calls have been worth following so far, not what they’ll do next. Down calls aren’t traded, because you don’t short; they stay on the graded record. Gold, oil, corn and small caps count through funds that track them.`));
      depthScene('m:practice');
    } else if (d.key === 'payouts') {
      const PI = Mo.portfolio_income, top = [...PI.securities].sort((a, b2) => b2.annual - a.annual), big = [...PI.months].sort((a, b2) => b2.total - a.total)[0];
      const deferred = PI.securities.every(x => /^Tax-deferred/i.test(x.tax_treatment || ''));
      title = `${fmtC(PI.annual)} a year.<em>What broker expects your stocks to pay. A projection, not money received.</em>`;
      body.append(el('p', 'm-lede', `From ${top.length} holdings, about ${fmtC(PI.monthly_average)} a month on average. The biggest month is ${monthName(big.month)}, at ${fmtC(big.total)}.`));
      if (top.length >= 3) body.append(facts([fmtC(top[0].annual), `from ${secName(top[0].name)}`, PC.glow], [fmtC(top[1].annual), `from ${secName(top[1].name)}`, PC.series2], [fmtC(PI.annual - top[0].annual - top[1].annual), `from the other ${top.length - 2}`, PC.series1]));
      body.append(el('p', 'm-note', `${deferred ? 'All of it is in tax-deferred accounts. ' : ''}Dividends can change, and they aren’t guaranteed.`));
      depthScene('m:payouts');
    } else if (d.key === 'holdings' && Mo.portfolio_holdings?.positions?.length) {
      const PH = Mo.portfolio_holdings, top = [...PH.positions].sort((a, b2) => b2.value - a.value), big = top[0], when = String(PH.as_of || '').replace(/, \d{4}$/, '').replace(/ 0(\d)/, ' $1');
      title = `${fmt$(PH.value)}.<em>What your broker accounts held${when ? `, as of ${esc(when)}` : ''}.</em>`;
      const moved = PH.positions.map(h => ({ h, v: holdDay(h) })).filter(x => x.v != null).sort((a, b2) => Math.abs(b2.v) - Math.abs(a.v)), net = moved.reduce((a, x) => a + x.v, 0);
      body.append(el('p', 'm-lede', `Up ${fmt$(PH.gain)} on the ${fmt$(PH.cost)} you paid. ${secName(big.name)} alone is ${Math.round(big.pct_portfolio)}% of everything.`));
      if (moved.length) body.append(el('p', 'm-lede', `On ${SESSION_DAY}, the ${['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'][moved.length] || moved.length} we track moved ${usdSigned(net)}: ${moved.slice(0, 3).map(x => `${secName(x.h.name)} ${usdSigned(x.v)}`).join(', ')}.`));
      body.append(facts([fmt$(PH.value), 'worth now', PC.glow], moved.length ? [usdSigned(net), `on ${SESSION_DAY}`, net >= 0 ? PC.up : PC.down] : [fmt$(PH.gain), 'gained since you bought', PC.up], [`${Math.round(big.pct_portfolio)}%`, `in ${secName(big.name)}`, PC.series2]));
      body.append(el('p', 'm-note', `${top.length} holdings and ${fmtC(PH.cash)} in cash, across your broker accounts. Values are broker’s, from the report.`));
      depthScene('m:holdings');
    } else if (d.key === 'holdings' && !Mo.holdings?.length && Mo.portfolio_income?.securities?.length) {
      const n = Mo.portfolio_income.securities.length;
      title = 'What you own, so far.';
      body.append(el('p', 'm-lede', `These ${n} come from broker’s dividend report, with how many shares you hold. Holdings that don’t pay dividends, and today’s value for each, arrive with your Portfolio Holdings report.`));
      depthScene('m:holdings');
    } else if (d.key === 'income') {
      const S3 = Mo.income?.streams || [], div = Mo.portfolio_income?.annual || 0, have = S3.reduce((a, x) => a + (+x.monthly || 0) * 12, 0) + div, goal = pr.goal || 0;
      title = have ? `${fmtC(have)} a year.` : 'Add your income.';
      body.append(el('p', 'm-lede', S3.length ? `From ${S3.length} stream${S3.length === 1 ? '' : 's'}${div ? ' and your dividends' : ''}, toward ${fmt$(goal)} a year.`
        : div ? `So far it’s your dividends: ${fmtC(div)} a year, which is broker’s projection. That’s ${(div / goal * 100).toFixed(1)}% of your ${fmt$(goal)} goal.` : `Your goal: ${fmt$(goal)} a year of extra income. Add your streams in data/money/income.json and the ring fills.`));
      if (div && !S3.length) body.append(el('p', 'm-note', 'Other income, like work on the side, goes in data/money/income.json on this Mac.'));
      if (goal) { haloKeys = ['goal']; haloGoal = { have, goal }; haloTo([Math.min(100, have / goal * 100)]); haloLabels(); }
      mView(6.6);
    } else {
      const S2 = { record: 'record', income: 'm:income', cashflow: 'm:cashflow', holdings: 'm:holdings' }[d.key];
      const setup = Mo.setup?.[d.key];
      title = d.key === 'record' ? esc(d.find()) : setup ? `Add your ${d.key === 'cashflow' ? 'cash flow' : d.key}.` : esc(d.name);
      body.append(el('p', 'm-lede', d.key === 'record' ? 'Every call, graded. Tiny moves count as flat, so luck can’t pass for skill.' : setup ? `Add data/money/${d.key}.json on this Mac. It stays private.` : d.find()));
      if (S2 && (!setup || d.key === 'record')) depthScene(S2); else mView(6.6);
    }
    titleEl.innerHTML = title; $('[data-m-body]').replaceChildren(body);
    finish(d);
  }
  function finish(d) {
    $('[data-m-more]').onclick = () => inspect('mny', d.key);
    mScene.classList.remove('in'); void mScene.offsetWidth; mScene.classList.add('in'); mScene.scrollTop = 0;
  }
  // Growth as a road: three paths from today to 30 years, and a marker you drag along it.
  // ---- Unusual moves: every market's move measured against its own normal day ----
  function normalTable() {
    const byLabel = Object.fromEntries((DP?.outliers || []).map(o => [o.label, o]));
    return X.instruments.map(i => {
      if (byLabel[i.label]) return { i, z: byLabel[i.label].sigma, typ: byLabel[i.label].typical, n: byLabel[i.label].sessions };
      const s2 = (i.series || []).filter(Number.isFinite); if (s2.length < 12 || !Number.isFinite(i.change_pct)) return null;
      const r = []; for (let k = 1; k < s2.length - 1; k++) r.push((s2[k] / s2[k - 1] - 1) * 100);
      const m = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
      return sd > 0 ? { i, z: Math.abs(i.change_pct) / sd, typ: sd, n: r.length, est: true } : null;
    }).filter(Boolean);
  }
  const GROUP_OF = { indices: 'Stock markets', global: 'Stock markets', africa: 'Stock markets', watchlist: 'Big tech', sectors: 'Sectors', fx: 'Currencies', rates: 'Interest rates', curve: 'Interest rates', commodities: 'Commodities', futures: 'Commodities', crypto: 'Crypto' };
  function stageNormal(b) {
    const g = svgEl('g', {}, stageSvg), small = phone(), T = normalTable(), groups = {};
    T.forEach(r => (groups[GROUP_OF[r.i.desk] || 'Other'] ||= []).push(r));
    const order = ['Stock markets', 'Big tech', 'Sectors', 'Interest rates', 'Currencies', 'Commodities', 'Crypto', 'Other'].filter(k => groups[k]);
    const maxZ = Math.max(4, Math.ceil(Math.max(...T.map(r => r.z)))), lw = small ? 0 : 130, X_ = z => b.x + lw + Math.min(z, maxZ) / maxZ * (b.w - lw - 10), rh = (b.h - 40) / order.length;
    txt(g, b.x, b.y - 28, 'How big each move was, against that market’s own normal day', 'st-axt');
    txt(g, b.x, b.y - 8, '1× is an ordinary day. Past 2× is unusual. Mint rose, rose fell. Named dots are measured over months; faint ones are estimates.', 'st-s');
    [[0, 1, .035], [1, 2, .06], [2, maxZ, .1]].forEach(([a, c, o]) => svgEl('rect', { x: X_(a), y: b.y + 10, width: X_(c) - X_(a), height: b.h - 40, fill: lineA(o), class: 'in' }, g));
    for (let z = 1; z <= maxZ; z++) { svgEl('line', { x1: X_(z), x2: X_(z), y1: b.y + 10, y2: b.y + b.h - 30, class: 'st-line' }, g); txt(g, X_(z), b.y + b.h - 10, `${z}×`, 'st-ax', 'middle'); }
    const placedL = [];
    order.forEach((k, gi) => {
      const y = b.y + 10 + rh * (gi + .5), rows = groups[k].sort((a, c) => c.z - a.z);
      if (!small) txt(g, b.x, y + 4, k, 'st-name');
      svgEl('line', { x1: X_(0), x2: X_(maxZ), y1: y, y2: y, stroke: lineA(.12) }, g);
      rows.forEach((r, ri) => {
        const mv = ownMove(r.i.label, r.i.change_pct), cx = X_(r.z), jit = ((ri % 3) - 1) * Math.min(7, rh * .18), big = r.z >= 2 && !r.est;
        const dot = svgEl('circle', { cx, cy: y + jit, r: big ? 5.5 : 3.6, fill: mv >= 0 ? PC.up : PC.down, 'fill-opacity': big ? .95 : .55, filter: big ? 'url(#st-glow)' : null, class: 'in hit', style: `animation-delay:${120 + gi * 60}ms` }, g);
        dot.addEventListener('click', () => inspect('instrument', r.i.label));
        const tt = svgEl('title', {}, dot); tt.textContent = `${r.i.label}: ${pct(mv)}, ${r.z.toFixed(1)}× its normal day (normal is about ${r.typ.toFixed(2)}%)${r.est ? `, estimated from the last ${r.n} sessions only` : `, measured over ${r.n} sessions`}`;
        if (big || (ri === 0 && !r.est)) {
          const t2 = `${sayName(r.i.label)} ${r.z.toFixed(1)}×`, w = t2.length * 6.6, right = cx + 8 + w > b.x + b.w, x0 = right ? cx - 8 - w : cx + 8;
          let ty = y + jit - 8; for (let tries = 0; tries < 3 && placedL.some(q => x0 < q.x + q.w && x0 + w > q.x && Math.abs(ty - q.y) < 14); tries++) ty -= 15;
          placedL.push({ x: x0, w, y: ty }); txt(g, right ? cx - 8 : cx + 8, ty, t2, big ? 'st-t' : 'st-s', right ? 'end' : 'start');
        }
      });
    });
  }
  // ---- Market mood: the five measured axes as a compass ----
  const AXIS_SAY = { breadth: ['Breadth', 'more falling', 'more rising'], volatility: ['Fear gauge', 'jumpier', 'calmer'], havens: ['Safe havens', 'money hiding', 'money leaving havens'], curve: ['Bond market', 'cautious', 'confident'], dollar: ['Dollar', 'tightening', 'easing'] };
  function stageCompass(b) {
    const g = svgEl('g', {}, stageSvg), small = phone(), ax = (KD?.regime?.axes || []).filter(a => typeof a.value === 'number');
    if (!ax.length) { txt(g, b.x, b.y + 40, 'The market’s mood wasn’t measured this run.', 'st-lead'); return; }
    const cx = b.x + b.w / 2, cy = b.y + b.h * .5, R = Math.min(b.h * .36, b.w * (small ? .3 : .28)), rr = v => R * (.5 + v * .5);
    txt(g, b.x, b.y - 28, 'The market’s mood, measured five ways', 'st-axt');
    txt(g, b.x, b.y - 8, 'Outward means investors are reaching for risk; inward means they’re pulling back. The middle ring is neutral.', 'st-s');
    [.25, .5, .75, 1].forEach(k => svgEl('circle', { cx, cy, r: R * k, fill: 'none', stroke: lineA(k === .5 ? .35 : .1), 'stroke-dasharray': k === .5 ? '3 5' : null }, g));
    const ang = i => -Math.PI / 2 + i * Math.PI * 2 / ax.length, pt = (i, v) => [cx + Math.cos(ang(i)) * rr(v), cy + Math.sin(ang(i)) * rr(v)];
    ax.forEach((a, i) => { const [x, y] = pt(i, 1); svgEl('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: lineA(.12) }, g); });
    svgEl('path', { d: ax.map((a, i) => `${i ? 'L' : 'M'}${pt(i, a.value).map(n => n.toFixed(1)).join(' ')}`).join('') + 'Z', fill: `rgba(${cssVar('mauve-rgb')},.16)`, stroke: PC.mauve, 'stroke-width': 2, filter: 'url(#st-glow)', class: 'in' }, g);
    ax.forEach((a, i) => {
      const [x, y] = pt(i, a.value), say = AXIS_SAY[a.axis] || [a.axis, 'risk-off', 'risk-on'], [lx, ly] = pt(i, 1.32), anchor = Math.abs(lx - cx) < 20 ? 'middle' : lx > cx ? 'start' : 'end';
      svgEl('circle', { cx: x, cy: y, r: 4.5, fill: a.value >= 0 ? PC.up : PC.down, class: 'in' }, g);
      txt(g, lx, ly, say[0], 'st-name', anchor); txt(g, lx, ly + 18, Math.abs(a.value) < .15 ? 'neutral' : a.value < 0 ? say[1] : say[2], a.value >= 0 ? 'st-s hit-t' : 'st-s miss-t', anchor);
    });
    txt(g, cx, cy + 6, (KD.regime.title || '').replace(/^./, c => c.toUpperCase()), small ? 'st-name' : 'st-pct', 'middle');
    const H2 = KD.regime.history; if (H2?.length && !small) txt(g, b.x, b.y + b.h + 10, `Last ${Math.min(8, H2.length)} sessions: ${H2.slice(-8).map(h => h.label.replace('_', ' ')).join(', ')}`, 'st-s');
  }
  function wrapWords(t, n) { const out = []; let ln = ''; for (const w of String(t).split(/\s+/)) { if ((ln + ' ' + w).trim().length > n) { out.push(ln.trim()); ln = w; } else ln += ' ' + w; } if (ln.trim()) out.push(ln.trim()); return out.slice(0, 4); }
  // ---- Market pairs: relationships that usually hold, and whether they held ----
  function stagePairs(b) {
    const g = svgEl('g', {}, stageSvg), small = phone(), R = (DP?.crossdesk?.results || []).slice().sort((a, c) => (c.held - a.held) || (Math.abs(c.r) - Math.abs(a.r)));
    if (!R.length) { txt(g, b.x, b.y + 40, 'No pairs were tested this run.', 'st-lead'); return; }
    const nm = sym => { const i = X.instruments.find(x => x.symbol === sym); return i ? sayName(i.label) : sym; };
    txt(g, b.x, b.y - 28, `Pairs that usually move together (or apart), over the last ${DP.crossdesk.lookback || ''} sessions`, 'st-axt');
    txt(g, b.x, b.y - 8, 'A bright line means the relationship is holding; a dashed one means it has gone quiet. Thicker is stronger.', 'st-s');
    const rh = Math.min(38, (b.h - 10) / R.length), lx = b.x + (small ? 0 : b.w * .28), rx = b.x + b.w * (small ? .62 : .7);
    R.forEach((r, k) => {
      const y = b.y + 18 + k * rh, s2 = svgEl('g', { class: 'in', style: `animation-delay:${80 + k * 40}ms` }, g), ok = r.held, w = 1 + Math.abs(r.r || 0) * 4;
      txt(s2, lx - 10, y + 4, nm(r.a), ok ? 'st-t' : 'st-s', 'end'); txt(s2, rx + 10, y + 4, nm(r.b), ok ? 'st-t' : 'st-s');
      svgEl('line', { x1: lx, x2: rx, y1: y, y2: y, stroke: ok ? PC.up : PC.down, 'stroke-width': w, 'stroke-opacity': ok ? .85 : .5, 'stroke-dasharray': ok ? null : '4 6', 'stroke-linecap': 'round', filter: ok ? 'url(#st-glow)' : null }, s2);
      svgEl('circle', { cx: lx, cy: y, r: 3, fill: PC.ink }, s2); svgEl('circle', { cx: rx, cy: y, r: 3, fill: PC.ink }, s2);
      const lab = txt(s2, (lx + rx) / 2, y - 7, `${r.expected > 0 ? 'usually together' : 'usually opposite'}, ${ok ? 'holding' : 'quiet'} (${r.r >= 0 ? '+' : '−'}${Math.abs(r.r).toFixed(2)})`, 'st-s', 'middle');
      const tt = svgEl('title', {}, lab); tt.textContent = r.why || '';
    });
  }
  function stageRoad(b) {
    const G = MONEY.growth, pr = MONEY.profile || {}, g = svgEl('g', {}, stageSvg), small = phone();
    const curve = G.curve, maxV = Math.max(...curve.map(c => c.values[2])) * 1.06, X_ = m => b.x + m / 360 * b.w, Y_ = v => b.y + b.h - v / maxV * b.h;
    const nice = [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6].filter(v => v < maxV);
    for (const v of nice.slice(-4)) { svgEl('line', { x1: b.x, x2: b.x + b.w, y1: Y_(v), y2: Y_(v), class: 'st-line' }, g); txt(g, small ? b.x + 2 : b.x - 10, small ? Y_(v) - 5 : Y_(v) + 4, fmtK(v), 'st-ax', small ? 'start' : 'end'); }
    for (let y = 0; y <= 30; y += 5) txt(g, X_(y * 12), b.y + b.h + 22, y ? `${y}y` : 'now', 'st-ax', 'middle');
    const path = r => curve.map((c, i) => `${i ? 'L' : 'M'}${X_(c.month).toFixed(1)} ${Y_(c.values[r]).toFixed(1)}`).join('');
    svgEl('path', { d: path(2) + curve.slice().reverse().map(c => `L${X_(c.month).toFixed(1)} ${Y_(c.values[0]).toFixed(1)}`).join('') + 'Z', fill: `rgba(${cssVar('mauve-rgb')},.06)`, class: 'in' }, g);
    const COL = [PC.series1, PC.series2, PC.series3];
    [0, 1, 2].forEach(r => svgEl('path', { d: path(r), fill: 'none', stroke: COL[r], 'stroke-width': r ? 2 : 1.4, 'stroke-dasharray': r ? null : '4 5', filter: r ? 'url(#st-glow)' : null, class: 'in', style: `animation-delay:${200 + r * 160}ms` }, g));
    const goal = pr.goal ? pr.goal / .04 : null;
    if (goal && goal < maxV) { svgEl('line', { x1: b.x, x2: b.x + b.w, y1: Y_(goal), y2: Y_(goal), stroke: PC.glow, 'stroke-dasharray': '2 6', opacity: .8 }, g); txt(g, b.x + 8, Y_(goal) - 8, `${fmtK(goal)}: your income goal at a 4% draw`, 'st-s2'); }
    const mk = svgEl('g', { class: 'in', style: 'animation-delay:520ms' }, g);
    const ln = svgEl('line', { y1: b.y - 4, y2: b.y + b.h, stroke: PC.ink, 'stroke-opacity': .4, 'stroke-dasharray': '2 4' }, mk);
    const dots = [0, 1, 2].map(r => svgEl('circle', { r: r ? 5 : 3.5, fill: COL[r], filter: r ? 'url(#st-glow)' : null }, mk));
    const set = m => { m = Math.max(0, Math.min(360, Math.round(m / 6) * 6)); const c = curve.find(x => x.month === m) || curve.at(-1), x = X_(c.month);
      ln.setAttribute('x1', x); ln.setAttribute('x2', x); dots.forEach((d2, r) => { d2.setAttribute('cx', x); d2.setAttribute('cy', Y_(c.values[r])); }); mRoad?.(c); };
    const hit = svgEl('rect', { x: b.x - 10, y: b.y - 20, width: b.w + 20, height: b.h + 40, fill: 'transparent', style: 'pointer-events: all; cursor: ew-resize; touch-action: none' }, g);
    const mv = e => { const r = stageSvg.getBoundingClientRect(); set((e.clientX - r.left - b.x) / b.w * 360); };
    hit.addEventListener('pointermove', mv); hit.addEventListener('pointerdown', e => { hit.setPointerCapture?.(e.pointerId); mv(e); });
    set(120);
  }

  // ---------- Start: texture first, then the arrival, then the thinking ----------
  renderStory(CHAPTERS[0]);
  // The ground is the edition's own month: NASA's Blue Marble monthly composites, in the same grade as earth.jpg, so the
  // snow line and the green move with the season. A month that won't load falls back to the September map.
  const MONTH_MAP = M.date ? +M.date.slice(5, 7) : 0;
  const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const loadEarth = (src, onFail) => { const tex = new THREE.TextureLoader().load(src, () => {
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (tex.image?.width) earthMat.uniforms.texel.value.set(1 / tex.image.width, 1 / tex.image.height);
    new THREE.TextureLoader().load('night-lights.jpg', t => { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); earthMat.uniforms.nightTex.value = t; earthMat.uniforms.nightOn.value = 1; }, undefined, () => {});
    earthMat.uniforms.day.value = tex;
    if (src !== window.ORBIT_TEXTURE) { const fe = document.querySelector('.fine-earth'); if (fe) fe.textContent = fe.textContent.replace('Blue Marble', `Blue Marble (${MON_LONG[MONTH_MAP - 1]})`); }
    begin(); wxLoad();
  }, undefined, onFail); };
  if (MONTH_MAP >= 1 && MONTH_MAP <= 12) loadEarth(`earth/${String(MONTH_MAP).padStart(2, '0')}.jpg`, () => loadEarth(window.ORBIT_TEXTURE, fallback));
  else loadEarth(window.ORBIT_TEXTURE, fallback);
  function begin() {
    requestAnimationFrame(frame);
    chapter = 0; railUI(0); document.body.dataset.chapter = 'day';
    if (reduced) { $('#arrival').remove(); started = true; Object.assign(cam, CHAPTERS[0].view); runThinking(); return; }
    document.body.classList.add('arriving'); arriveAt = performance.now();
    const ad = $('[data-arrive-day]'); if (ad && M.date) ad.textContent = new Date(M.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    flyTo(CHAPTERS[0].view, 4200);
    setTimeout(() => $('#arrival').classList.add('gone'), 1500);
    setTimeout(() => { document.body.classList.remove('arriving'); started = true; }, 2600);
    setTimeout(() => $('#arrival')?.remove(), 3000);
    setTimeout(() => { if (chapter === 0 && !thinkDone && !think) runThinking(); }, 3900);
    quietUntil = performance.now() + 4400;
  }
  window.OBSERVATORY = { go, selectPlace, runThinking, inspect, setMode, openCmd, closeCmd, openDesk, openMoney: () => setMode('money'), go, get: () => ({ look, desk: deskOn ?? null, mode: uiMode, insp: stack.map(e => e.view + (e.arg != null ? ':' + e.arg : '')).join(' > '), chapter, viewMode, skyBlend, thinking: !!think, beat: think?.i ?? null, thinkDone, cam: { ...cam }, selected: selected?.place || null, flying: !!flight || viewMode === 'trans' }) };
})();
