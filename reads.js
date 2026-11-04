/* The connected reads. Today's front page lists them; this plays one as a guided build over the dimmed globe: one
   sentence at a time beside a picture that assembles in the order of the reasoning.
   The words come from the morning synthesis (edition.reads). Every figure in a picture is resolved here from the
   evidence a step cites: quotes, headlines, your rules, the read's open calls. The model never supplies a number.
   A read may name its pictures (edition.reads[].pictures, proposed for job 15); until then they're inferred from the
   evidence, deterministically. Rules for the look and motion: docs/SLOP.md. */
(() => {
  'use strict';
  const E = window.SIX_SEVEN_EDITION || {}, X = window.SIX_SEVEN_EXPLORE || {}, D = window.SIX_SEVEN_DECK || {}, FX = window.SIX_SEVEN_FIXTURE || {};
  const READS = (E.reads || []).filter(r => r && r.title && Array.isArray(r.steps) && r.steps.length);
  const api = { has: () => READS.length > 0, list: () => READS, open: () => {}, isOpen: () => false };
  window.SixSevenReads = api;

  // ---------- evidence ----------
  const INS = X.instruments || [], HL = X.headlines || [];
  const bySym = new Map(INS.map(i => [i.symbol, i]));
  const quoteOf = id => (id.startsWith('quote:') ? bySym.get(id.slice(6)) || null : null);
  // Citations count the run's full headline list, fixture.news. explore.headlines drops duplicates, so past the first
  // duplicate the same number means a different article. Public editions name their sources, so they use the right list.
  const PUBLIC = !!window.SIX_SEVEN_META?.public;
  const headlineOf = id => {
    const m = /^headline:(\d+)$/.exec(id); if (!m) return null;
    if (!PUBLIC) return HL[+m[1] - 1] || null;
    const n = (FX.news || [])[+m[1] - 1];
    return n ? HL.find(h => h.link === n.link && h.title === n.title) || n : null;
  };
  const ruleOf = id => (id.startsWith('watch:') ? (D.tripwires || []).find(t => t.label === id.slice(6) || t.symbol === id.slice(6)) || null : null);
  const claimOf = id => (id.startsWith('claim:') ? ((D.record || {}).claims || []).find(c => c.symbol === id.slice(6) && c.correct == null) || null : null);
  // Your holdings (private editions only): matched to a tracked market by its name, or by ticker once the import adds one.
  const PH = (window.SIX_SEVEN_MONEY || {}).portfolio_holdings || null;
  const norm = s => String(s || '').toLowerCase().replace(/\b(inc|corp|co|ag|plc|ltd|the|holding|com)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const marketOf = p => (p.ticker ? bySym.get(p.ticker) : INS.find(i => { const a = norm(i.label), b = norm(p.name); return a && (b === a || b.startsWith(a + ' ')); })) || null;
  const holdingOf = id => (id.startsWith('holding:') && PH ? (PH.positions || []).find(p => p.ticker === id.slice(8) || marketOf(p)?.symbol === id.slice(8)) || null : null);
  // what a holding gained or lost in the session: your shares times the day's measured price change
  const dayMove = p => { const q = marketOf(p); return q && q.price && q.change_pct != null ? p.quantity * q.price * q.change_pct / (100 + q.change_pct) : null; };
  const usd = v => `${v >= 0 ? '+' : '\u2212'}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
  const quotes = steps => [...new Map(steps.flatMap(s => s.ev).map(quoteOf).filter(Boolean).map(q => [q.symbol, q])).values()];
  const SHORT = { 'Russell 2000': 'Small caps', '10-Year Treasury': '10-year yield', 'Semiconductors': 'Chip stocks', 'Nasdaq 100': 'Nasdaq 100' };
  const name = q => SHORT[q.label] || q.label;
  // What a read rests on, so a visitor can check it: each article it cites, once, and the prices it uses.
  const sourcesOf = r => {
    const ids = r.steps.flatMap(s => s.evidence_ids || []);
    const articles = new Map(ids.map(headlineOf).filter(h => h?.link).map(h => [h.link, h]));
    return { articles: [...articles.values()], prices: [...new Set(ids.map(quoteOf).filter(Boolean).map(name))] };
  };
  const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'], count = n => WORD[n] || String(n), Count = n => count(n)[0].toUpperCase() + count(n).slice(1);
  const pct = v => { const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1) + '%'; };
  const lvl = (v, sym) => (sym === '^TNX' || sym === '^IRX' || sym === '^TYX' ? v.toFixed(2) + '%' : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const day = iso => new Date(iso + 'T12:00:00');
  const MON = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // The edition is written before dawn about the previous session; name that session plainly.
  // (the date US stocks carry; currencies, futures and crypto trade overnight, so they can't decide it)
  const LAST = (() => { const n = {}; (FX.quotes || []).forEach(x => { const d = String(x.as_of || '').slice(0, 10); if (x.ok && d && /watchlist|indices|sectors/.test(x.desk)) n[d] = (n[d] || 0) + 1; });
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || (D.tripwires || []).flatMap(t => t.series || []).map(p => p.d).sort().pop(); })();
  const SESSION = LAST ? day(LAST).toLocaleDateString('en-US', { weekday: 'long' }) : 'the last session';
  const rets = s => s.slice(1).map((v, i) => (s[i] ? (v / s[i] - 1) * 100 : 0));
  const EVENT_SAY = { CPI: 'The inflation report', 'FOMC decision': 'The Fed’s rate decision', 'Nonfarm payrolls': 'The jobs report', 'PCE price index': 'The Fed’s favourite inflation gauge' };

  // ---------- steps: the model's, plus what comes next and what would prove it wrong ----------
  const KIND = { trigger: 'news', for_you: 'you', tradition: 'trad' };
  const SAY = { news: 'The news', hit: 'What moved', held: 'What held', so: 'So', world: 'The world', trad: 'By tradition', next: 'What’s next', wrong: 'Would prove it wrong' };
  const SURE = { 0: 'Not sure', 1: 'Not very sure', 2: 'Fairly sure', 3: 'Sure' };
  function stepsOf(r, ri) {
    if (r.fixed) return r.steps.map(s => ({ ev: [], ...s }));
    const out = r.steps.map(s => ({ kind: KIND[s.kind] || s.kind, text: String(s.text || ''), ev: s.evidence_ids || [] })).filter(s => SAY[s.kind]);
    const rule = out.flatMap(s => s.ev).map(ruleOf).find(Boolean), sc = (E.scenarios || [])[0];
    if (rule && sc?.branches?.length) {
      const when = sc.date ? day(sc.date).toLocaleDateString('en-US', { weekday: 'long' }) : null;
      out.push({ kind: 'next', text: `${EVENT_SAY[sc.event] || sc.event}${when ? `, expected ${when},` : ''} decides it.`, ev: [], scenario: sc, rule });
    }
    const rec = D.record || {}, n = Math.max(0, Math.min(3, +r.confidence || 0));
    out.push({ kind: 'wrong', text: r.would_change || 'New evidence that cuts against it.', ev: [],
      sure: `${SURE[n]}.${rec.graded_dedup ? ` The read has been right on ${rec.hits_dedup} of its last ${rec.graded_dedup} graded calls.` : ''}`,
      flags: ri === 0 ? (E.flags || []).slice(0, 2) : [], ...(PUBLIC ? { sources: sourcesOf(r), hold: 16 } : {}) });
    return out;
  }

  // ---------- which picture shows which steps ----------
  function picturesOf(r, steps) {
    const explicit = (r.pictures || []).filter(p => DRAW[p.type] && Array.isArray(p.steps));
    if (explicit.length) return explicit.map(p => ({ type: p.type, idx: p.steps.filter(i => i < steps.length) })).filter(p => p.idx.length);
    const market = steps.filter(s => s.kind === 'hit' || s.kind === 'held'), ms = new Set(quotes(market).map(q => q.symbol));
    const lead = steps.some(s => s.kind === 'world' && s.ev.some(id => headlineOf(id)?.lat != null)) ? 'map'
      : steps.some(s => s.kind === 'news' && s.ev.some(headlineOf)) && market.length ? 'chain'
      : ms.has('^VIX') && ms.has('GC=F') ? 'corners' : 'bars';
    const pics = [];
    steps.forEach((s, i) => {
      const type = s.kind === 'next' || s.ev.some(ruleOf) ? 'rule' : (s.kind === 'wrong' || s.kind === 'so' || s.kind === 'you' || s.kind === 'trad') && pics.length ? pics[pics.length - 1].type : lead;
      if (pics.length && pics[pics.length - 1].type === type) pics[pics.length - 1].idx.push(i); else pics.push({ type, idx: [i] });
    });
    return pics;
  }

  // ---------- drawing ----------
  const NS = 'http://www.w3.org/2000/svg';
  function factory(svg, track) {
    return function el(tag, attrs = {}, o = {}) {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      (o.parent || svg).appendChild(e);
      if (o.text != null) e.textContent = o.text;
      if (o.at != null) { e.classList.add('rx'); if (o.d) e.style.setProperty('--d', o.d + 's'); track.push({ e, at: o.at, until: o.until ?? 99, dim: new Set(o.dim || []), count: o.count, d: o.d || 0, was: false }); }
      return e;
    };
  }
  const tspans = (el, x, y, rows, cls, o = {}, gap = 21) => {
    const t = el('text', { x, y, class: cls, ...(o.anchor ? { 'text-anchor': o.anchor } : {}) }, o);
    rows.forEach((row, i) => { const s = document.createElementNS(NS, 'tspan'); s.setAttribute('x', x); if (i) s.setAttribute('dy', gap); s.textContent = row; t.appendChild(s); });
    return t;
  };
  const wrap = (text, n) => { const out = []; let line = ''; for (const w of String(text).split(/\s+/)) { if ((line + ' ' + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; };
  // where a kind first appears inside this picture (local step index), or never
  const at = (ctx, ...kinds) => { const i = ctx.steps.findIndex(s => kinds.includes(s.kind)); return i < 0 ? 99 : i; };

  const DRAW = {
    // From the news to the companies it hit, to the market that didn't follow, to the open call at stake.
    chain(el, ctx) {
      const news = ctx.steps.filter(s => s.kind === 'news'), hitQ = quotes(ctx.steps.filter(s => s.kind === 'hit')).sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct)).slice(0, 7);
      const heldQ = quotes(ctx.steps.filter(s => s.kind === 'held')).slice(0, 3), you = ctx.steps.find(s => s.kind === 'you');
      const call = you && you.ev.map(claimOf).find(Boolean), aN = at(ctx, 'news'), aH = at(ctx, 'hit'), aD = at(ctx, 'held'), aS = at(ctx, 'so'), aY = at(ctx, 'you'), aW = at(ctx, 'wrong');
      const srcs = [...new Set(news.flatMap(s => s.ev).map(headlineOf).filter(Boolean).map(h => h.source.replace(/ (Top News|Business|Bulletins|World|US)$/, '').replace(/ \(.*\)$/, '')))];
      const nl = wrap(news[0]?.text || 'The news', 20).slice(0, 5);
      tspans(el, 16, 236 - nl.length * 23, nl, 'head', { at: aN, d: .1, dim: ['you'] }, 23);
      if (srcs.length) tspans(el, 16, 296, wrap(`${Count(srcs.length)} outlet${srcs.length > 1 ? 's' : ''}: ${srcs.join(', ')}`, 26).slice(0, 3), 'mut', { at: aN, d: .3, dim: ['you'] }, 18);
      const sx = 182, sy = 250, cx = 372, gap = Math.min(64, 420 / Math.max(1, hitQ.length));
      hitQ.forEach((q, i) => {
        const y = 50 + i * gap, w = Math.min(16, Math.abs(q.change_pct) * 2.4), col = q.change_pct < 0 ? 'var(--down)' : 'var(--up)', mine = call && call.symbol === q.symbol;
        el('path', { d: `M${sx} ${sy} C${sx + 130} ${sy}, ${cx - 140} ${y}, ${cx - 14} ${y}`, stroke: col, 'stroke-width': w.toFixed(1), 'stroke-opacity': .55, fill: 'none', pathLength: 1, class: 'draw' }, { at: aH, d: .2 + i * .12, dim: mine ? [] : ['you'] });
        el('text', { x: cx, y: y + 6, class: 'lab', style: 'font-size:17px' }, { text: name(q), at: aH, d: .5 + i * .12, dim: mine ? [] : ['you'] });
        el('text', { x: cx + 106, y: y + 8, class: 'num', style: `fill:${col}` }, { at: aH, d: .5 + i * .12, count: { v: q.change_pct }, dim: mine ? [] : ['you'] });
      });
      if (hitQ.length) {
        const down = hitQ.filter(q => q.change_pct < 0).length;
        el('text', { x: cx, y: 22, class: 'grp' }, { text: 'What it hit', at: aH, d: .1, dim: ['you'] });
        el('text', { x: cx, y: 50 + hitQ.length * gap + 4, class: 'head', style: 'fill:var(--down)' }, { text: down === hitQ.length ? (hitQ.length === 2 ? 'Both fell' : `All ${count(hitQ.length)} fell`) : `${Count(down)} of ${count(hitQ.length)} fell`, at: aS, d: .2, dim: ['you'] });
      }
      if (heldQ.length) {
        const hx = cx + 248, hy = 430;
        el('path', { d: `M${cx + 180} 210 C${cx + 220} 210, ${cx + 214} ${hy}, ${hx - 12} ${hy}`, class: 'dash' }, { at: aD, d: .1, dim: ['you'] });
        el('text', { x: hx, y: hy - 26, class: 'grp' }, { text: 'What didn’t follow', at: aD, d: .2, dim: ['you'] });
        heldQ.forEach((q, i) => {
          el('text', { x: hx, y: hy + 4 + i * 28, class: 'lab' }, { text: name(q), at: aD, d: .3 + i * .1, dim: ['you'] });
          el('text', { x: hx + 96, y: hy + 6 + i * 28, class: 'num', style: 'font-size:20px' }, { at: aD, d: .3 + i * .1, count: { v: q.change_pct }, dim: ['you'] });
        });
        const fell = heldQ.filter(q => q.change_pct <= -0.2).length;
        el('text', { x: hx, y: hy + 12 + heldQ.length * 28, class: 'head' }, { text: fell ? `${Count(fell)} of ${count(heldQ.length)} fell` : 'None fell', at: aS, d: .4, dim: ['you'] });
        heldQ.forEach((q, i) => el('path', { d: `M${hx - 26} ${hy - 2 + i * 28} h-14`, stroke: 'var(--down)', 'stroke-width': 2 }, { at: aW, d: .2 + i * .1 }));
        tspans(el, hx, hy - 84, ['If these fall too,', 'this read is wrong'], 'lab', { at: aW, d: .4 }, 20).style.fill = 'var(--down)';
      }
      const mine = you ? you.ev.map(holdingOf).filter(p => p && dayMove(p) != null) : [];
      if (mine.length) {
        const tx = cx + 248, net = mine.reduce((a, p) => a + dayMove(p), 0);
        el('text', { x: tx, y: 72, class: 'lab', style: 'fill:var(--glow);font-weight:600' }, { text: 'Your money', at: aY, d: .2 });
        mine.sort((a, b) => Math.abs(dayMove(b)) - Math.abs(dayMove(a))).slice(0, 4).forEach((p, k) => {
          const v = dayMove(p);
          el('text', { x: tx, y: 100 + k * 26, class: 'lab' }, { text: name(marketOf(p)), at: aY, d: .35 + k * .12 });
          el('text', { x: tx + 132, y: 100 + k * 26, class: 'num', style: `font-size:19px;fill:${v >= 0 ? 'var(--up)' : 'var(--down)'}` }, { text: usd(v), at: aY, d: .35 + k * .12 });
        });
        el('text', { x: tx, y: 112 + Math.min(4, mine.length) * 26, class: 'head' }, { text: `${usd(net)} across ${mine.length === 1 ? 'it' : mine.length === 2 ? 'both' : `these ${count(mine.length)}`}`, at: aY, d: .9 });
        if (PH?.value) el('text', { x: tx, y: 134 + Math.min(4, mine.length) * 26, class: 'mut' }, { text: `the ones tracked that day, of $${Math.round(PH.value / 1000)}k`, at: aY, d: 1 });
      } else if (call) {
        const i = hitQ.findIndex(q => q.symbol === call.symbol), y = i < 0 ? 120 : 50 + i * gap, tx = cx + 248;
        el('path', { d: `M${cx + 180} ${y} C${cx + 214} ${y}, ${cx + 214} 90, ${tx - 12} 90`, stroke: 'var(--glow)', 'stroke-width': 2, fill: 'none', pathLength: 1, class: 'draw' }, { at: aY, d: .2 });
        el('text', { x: tx, y: 72, class: 'lab', style: 'fill:var(--glow);font-weight:600' }, { text: 'The read’s open call', at: aY, d: .4 });
        const said = { flat: 'flat', up: 'higher', down: 'lower' }[call.direction] || call.direction;
        tspans(el, tx, 98, [`${name(bySym.get(call.symbol) || { label: call.symbol })} ${said}`, `through ${MON(day(call.due_on))},`, `counted from`, `${SESSION}’s close.`], 'lab', { at: aY, d: .5 }, 21);
      }
    },

    // Fear against hedging: the session lands in a corner, among the last twenty.
    corners(el, ctx) {
      const v = bySym.get('^VIX'), g = bySym.get('GC=F'); if (!v || !g) return DRAW.bars(el, ctx);
      const rv = rets(v.series || []), rg = rets(g.series || []), n = Math.min(20, rv.length, rg.length);
      const pts = Array.from({ length: n }, (_, k) => ({ x: rv[rv.length - n + k], y: rg[rg.length - n + k] }));
      const aH = at(ctx, 'hit'), aD = at(ctx, 'held'), aS = at(ctx, 'so'), cx = 410, cy = 270, X = x => cx + Math.max(-16, Math.min(16, x)) * 16, Y = y => cy - Math.max(-2.4, Math.min(2.4, y)) * 95;
      el('line', { x1: X(-16), x2: X(16), y1: cy, y2: cy, class: 'axis' }, { at: aH });
      el('line', { x1: cx, x2: cx, y1: Y(2.4), y2: Y(-2.4), class: 'axis' }, { at: aH });
      el('text', { x: cx + 8, y: Y(2.4) + 4, class: 'mut' }, { text: 'gold up', at: aH });
      el('text', { x: cx + 8, y: Y(-2.4), class: 'mut' }, { text: 'gold down', at: aH });
      el('text', { x: X(16), y: cy + 22, 'text-anchor': 'end', class: 'mut' }, { text: 'fear gauge up', at: aD });
      el('text', { x: X(-16), y: cy + 22, class: 'mut' }, { text: 'fear gauge down', at: aD });
      el('text', { x: X(-15.5), y: Y(2.2), class: 'grp', style: 'fill:var(--up)' }, { text: 'Hedging, not scared', at: aD, d: .6 });
      el('text', { x: X(15.5), y: Y(2.2), 'text-anchor': 'end', class: 'grp' }, { text: 'Scared and hedging', at: aD, d: .6 });
      el('text', { x: X(15.5), y: Y(-2.25), 'text-anchor': 'end', class: 'grp', style: 'fill:var(--down)' }, { text: 'Scared, not hedging', at: aD, d: .6 });
      el('text', { x: X(-15.5), y: Y(-2.25), class: 'grp' }, { text: 'Calm', at: aD, d: .6 });
      pts.slice(0, -1).forEach((p, k) => el('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: `rgba(204,208,232,${(.18 + .45 * k / n).toFixed(2)})` }, { at: aD, d: .2 + k * .03 }));
      const t = pts[n - 1];
      // first only gold's move is known, then the fear gauge moves the dot sideways into its corner
      el('circle', { cx: X(0), cy: Y(t.y), r: 11, fill: 'var(--up)', class: 'pop' }, { at: aH, until: aD - 1, d: .3 });
      el('text', { x: X(0) + 18, y: Y(t.y) + 5, class: 'lab' }, { text: `Gold ${pct(t.y)}`, at: aH, until: aD - 1, d: .5 });
      el('circle', { cx: X(t.x), cy: Y(t.y), r: 11, fill: 'var(--up)' }, { at: aD, d: .1 });
      tspans(el, X(t.x) + 18, Y(t.y) - 26, [SESSION, `VIX ${pct(t.x)}, gold ${pct(t.y)}`], 'lab', { at: aD, d: .3 }, 20);
      const same = pts.filter(p => Math.sign(p.x) === Math.sign(t.x) && Math.sign(p.y) === Math.sign(t.y)).length;
      el('text', { x: t.x < 0 ? X(-15.5) : X(15.5), y: t.y > 0 ? Y(2.2) + 22 : Y(-2.25) - 22, 'text-anchor': t.x < 0 ? 'start' : 'end', class: 'mut' }, { text: `${same} of the last ${n} sessions landed here`, at: aS, d: .2 });
    },

    // Your rule on the instrument's own scale, the last twenty sessions; then the event that decides it.
    rule(el, ctx) {
      const s = ctx.steps.find(x => x.rule) || ctx.steps.find(x => x.ev.some(ruleOf)), rule = s && (s.rule || s.ev.map(ruleOf).find(Boolean));
      if (!rule) return;
      const ser = (rule.series || []).slice(-20), vals = ser.map(p => p.close).concat(rule.line), nxt = ctx.steps.find(x => x.kind === 'next');
      const lo = Math.min(...vals) - .12, hi = Math.max(...vals) + (nxt ? .3 : .12), x0 = 40, x1 = nxt ? 400 : 720;
      const X = i => x0 + i / Math.max(1, ser.length - 1) * (x1 - x0), Y = v => 60 + (hi - v) / (hi - lo) * 330;
      const aY = at(ctx, 'you'), aN = at(ctx, 'next'), last = ser[ser.length - 1];
      el('line', { x1: x0, x2: 790, y1: Y(rule.line), y2: Y(rule.line), stroke: 'var(--mauve)', 'stroke-width': 2 }, { at: aY, d: .1 });
      el('text', { x: x0, y: Y(rule.line) + 26, class: 'lab', style: 'fill:var(--mauve)' }, { text: `Your line, ${lvl(rule.line, rule.symbol)}`, at: aY, d: .2 });
      el('path', { d: `M${X(0)} ${Y(rule.line)} ` + ser.map((p, i) => `L${X(i).toFixed(1)} ${Y(p.close).toFixed(1)}`).join(' ') + ` L${X(ser.length - 1)} ${Y(rule.line)} Z`, fill: 'var(--mauve)', 'fill-opacity': .1 }, { at: aY, d: .9 });
      el('path', { d: 'M' + ser.map((p, i) => `${X(i).toFixed(1)} ${Y(p.close).toFixed(1)}`).join(' L'), stroke: 'var(--ink)', 'stroke-width': 2, fill: 'none', pathLength: 1, class: 'draw' }, { at: aY, d: .3 });
      el('circle', { cx: X(ser.length - 1), cy: Y(last.close), r: 7, fill: 'var(--ink)' }, { at: aY, d: 1.2 });
      el('text', { x: X(ser.length - 1), y: Y(last.close) - 18, 'text-anchor': 'middle', class: 'num', style: 'font-size:26px' }, { text: lvl(last.close, rule.symbol), at: aY, d: 1.2 });
      el('text', { x: X(0), y: Y(ser[0].close) - 14, class: 'mut' }, { text: MON(day(ser[0].d)), at: aY, d: .3 });
      const over = rule.operator === '>' ? last.close - rule.line : rule.line - last.close;
      el('text', { x: (X(0) + X(ser.length - 1)) / 2, y: Y(rule.line) - 12, 'text-anchor': 'middle', class: 'lab', style: 'fill:var(--glow)' },
        { text: `${over.toFixed(2)} points over, ${rule.sessions_met || ser.length} sessions running`, at: aY, until: aN - 1, d: 1.4 });
      if (!nxt) return;
      const sc = nxt.scenario, hot = sc.branches.find(b => /above/.test(b.label)) || sc.branches[0], cool = sc.branches.find(b => b !== hot);
      const bx = X(ser.length - 1), by = Y(last.close);
      el('path', { d: `M${bx} ${by} C${bx + 60} ${by}, ${bx + 90} ${Y(hi - .08)}, ${bx + 150} ${Y(hi - .08)}`, stroke: 'var(--down)', 'stroke-width': 2.5, fill: 'none', pathLength: 1, class: 'draw' }, { at: aN, d: .2 });
      if (cool) el('path', { d: `M${bx} ${by} C${bx + 60} ${by}, ${bx + 90} ${Y(rule.line)}, ${bx + 150} ${Y(rule.line) + 2}`, stroke: 'var(--up)', 'stroke-width': 2.5, fill: 'none', pathLength: 1, class: 'draw' }, { at: aN, d: .9 });
      const say = b => [b.rule_effect, ...((b.split || []).find(x => x.key === 'reserve') ? [`New money held back: ${(b.split || []).find(x => x.key === 'reserve').percent}%${b.split_status === 'unchanged_pending_new_regime' ? ', unchanged' : ''}.`] : [])];
      el('text', { x: bx + 166, y: Y(hi - .08) - 6, class: 'head', style: 'fill:var(--down)' }, { text: 'If it stays above', at: aN, d: .5 });
      tspans(el, bx + 166, Y(hi - .08) + 18, say(hot).flatMap(t => wrap(t, 30)).slice(0, 4), 'lab', { at: aN, d: .6 }, 20);
      if (cool) {
        el('text', { x: bx + 166, y: Y(rule.line) + 30, class: 'head', style: 'fill:var(--up)' }, { text: 'If it closes at or below', at: aN, d: 1.2 });
        tspans(el, bx + 166, Y(rule.line) + 54, say(cool).flatMap(t => wrap(t, 30)).slice(0, 4), 'lab', { at: aN, d: 1.3 }, 20);
      }
    },

    // Where the news was against where the money moved.
    map(el, ctx) {
      const W = 820, H = 380, top = 20, L0 = -170, L1 = 190, A0 = 72, A1 = -50, X = lon => (lon - L0) / (L1 - L0) * W, Y = lat => top + (A0 - lat) / (A0 - A1) * H;
      const aW = at(ctx, 'world'), aH = at(ctx, 'hit'), aS = at(ctx, 'so');
      if (FX.world) el('path', { d: FX.world.map(r => 'M' + r.map(([lon, lat]) => `${X(lon).toFixed(1)} ${Y(lat).toFixed(1)}`).join('L') + 'Z').join(''), fill: 'rgba(204,208,232,.07)', stroke: 'rgba(204,208,232,.2)', 'stroke-width': .6 }, { at: 0 });
      const news = (FX.marks || []).filter(m => m.count && m.lat != null).sort((a, b) => b.count - a.count).slice(0, 12);
      news.forEach((m, i) => el('circle', { cx: X(m.lon), cy: Y(m.lat), r: 4 + Math.sqrt(m.count) * 4, fill: 'none', stroke: 'var(--ink)', 'stroke-opacity': .7, 'stroke-width': 1.3, class: 'pop' }, { at: aW, d: .2 + i * .07 }));
      news.slice(0, 3).forEach((m, i) => el('text', { x: X(m.lon) + 26, y: Y(m.lat) - 22 + i * 14, class: 'lab' }, { text: `${m.place}, ${m.count}`, at: aW, d: .9 + i * .1 }));
      const money = new Map();
      quotes(ctx.steps.filter(s => s.kind === 'hit')).forEach(q => { const h = q.home; if (!h) return; const m = money.get(h.place) || { ...h, abs: 0, names: [] }; m.abs += Math.abs(q.change_pct); m.names.push(name(q)); money.set(h.place, m); });
      const mm = [...money.values()].sort((a, b) => b.abs - a.abs);
      mm.forEach((m, i) => el('circle', { cx: X(m.lon), cy: Y(m.lat), r: 3 + Math.sqrt(m.abs) * 3.4, fill: 'var(--down)', 'fill-opacity': .8, class: 'pop' }, { at: aH, d: .2 + i * .1 }));
      if (mm[0]) {
        el('text', { x: X(mm[0].lon) - 24, y: Y(mm[0].lat) + 48, 'text-anchor': 'end', class: 'lab', style: 'fill:var(--down);font-weight:600' }, { text: mm[0].place, at: aH, d: .6 });
        el('text', { x: X(mm[0].lon) - 24, y: Y(mm[0].lat) + 68, 'text-anchor': 'end', class: 'mut' }, { text: mm[0].names.slice(0, 4).join(', '), at: aH, d: .7 });
      }
      el('circle', { cx: 24, cy: H + 60, r: 8, fill: 'none', stroke: 'var(--ink)', 'stroke-opacity': .7 }, { at: aW });
      el('text', { x: 40, y: H + 65, class: 'mut' }, { text: 'Headlines about a place', at: aW });
      el('circle', { cx: 250, cy: H + 60, r: 8, fill: 'var(--down)', 'fill-opacity': .8 }, { at: aH });
      el('text', { x: 266, y: H + 65, class: 'mut' }, { text: 'How much the companies based there moved', at: aH });
      if (news[0] && mm[0]) el('path', { d: `M${X(news[0].lon)} ${Y(news[0].lat)} Q${(X(news[0].lon) + X(mm[0].lon)) / 2} ${Math.min(Y(news[0].lat), Y(mm[0].lat)) - 90} ${X(mm[0].lon)} ${Y(mm[0].lat)}`, class: 'dash', style: 'stroke:var(--glow)' }, { at: aS, d: .2 });
    },

    // Two markets that are supposed to move together: their month side by side, then how often they agreed.
    pair(el, ctx) {
      const A = quotes(ctx.steps.filter(s => s.kind === 'hit'))[0], B = quotes(ctx.steps.filter(s => s.kind === 'held'))[0];
      if (!A || !B || !(A.series || []).length || !(B.series || []).length) return DRAW.bars(el, ctx);
      const n = Math.min(A.series.length, B.series.length), sa = A.series.slice(-n), sb = B.series.slice(-n);
      const na = sa.map(v => v / sa[0] * 100), nb = sb.map(v => v / sb[0] * 100), all = na.concat(nb), lo = Math.min(...all) - 1, hi = Math.max(...all) + 1;
      const x0 = 30, x1 = 640, X = i => x0 + i / (n - 1) * (x1 - x0), Y = v => 40 + (hi - v) / (hi - lo) * 290, aH = at(ctx, 'hit'), aD = at(ctx, 'held'), aS = at(ctx, 'so');
      const line = arr => 'M' + arr.map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L');
      el('line', { x1: x0, x2: x1, y1: Y(100), y2: Y(100), class: 'dash' }, { at: aH });
      el('rect', { x: X(n - 2), y: 30, width: X(n - 1) - X(n - 2), height: 310, fill: 'rgba(var(--glow-rgb),.08)' }, { at: aH, d: .1 });
      el('text', { x: (X(n - 2) + X(n - 1)) / 2, y: 22, 'text-anchor': 'middle', class: 'mut' }, { text: SESSION, at: aH, d: .1 });
      el('path', { d: line(na), stroke: 'var(--ink2)', 'stroke-width': 2, fill: 'none', pathLength: 1, class: 'draw' }, { at: aH, d: .2 });
      el('text', { x: x1 + 12, y: Y(na[n - 1]) + 5, class: 'lab' }, { text: `${name(A)} ${pct(A.change_pct)}`, at: aH, d: 1.2 });
      el('path', { d: line(nb), stroke: 'var(--mauve)', 'stroke-width': 2, fill: 'none', pathLength: 1, class: 'draw' }, { at: aD, d: .2 });
      el('text', { x: x1 + 12, y: Y(nb[n - 1]) + 5, class: 'lab', style: 'fill:var(--mauve)' }, { text: `${name(B)} ${pct(B.change_pct)}`, at: aD, d: 1.2 });
      const ra = rets(sa), rb = rets(sb), same = ra.slice(0, -1).map((v, i) => (v > 0) === (rb[i] > 0)), k = same.filter(Boolean).length;
      el('text', { x: x0, y: 392, class: 'grp' }, { text: 'Did they move the same direction? Each day of the month, oldest first', at: aS, d: .1 });
      same.forEach((s, i) => el('rect', { x: x0 + i * 22, y: 406, width: 16, height: 16, rx: 3, fill: s ? 'var(--mauve)' : 'none', stroke: 'var(--mauve)', 'stroke-opacity': .7 }, { at: aS, d: .2 + i * .03 }));
      el('rect', { x: x0 + same.length * 22, y: 406, width: 16, height: 16, rx: 3, fill: 'none', stroke: 'var(--down)', 'stroke-width': 1.5 }, { at: aS, d: .2 + same.length * .03 });
      el('text', { x: x0, y: 454, class: 'lab' }, { text: `Same direction on ${count(k)} of the ${count(same.length)} days before ${SESSION}. A coin would manage about half.`, at: aS, d: 1.2 });
    },

    // The plain fallback: the quotes each step cites, as bars around zero, grouped in step order.
    bars(el, ctx) {
      const groups = ctx.steps.map((s, i) => ({ i, q: quotes([s]) })).filter(g => g.q.length), all = groups.flatMap(g => g.q);
      if (!all.length) return;
      const K = 210 / Math.max(1, ...all.map(q => Math.abs(q.change_pct))), Z = 250, w = Math.min(58, 640 / all.length - 18);
      el('line', { x1: 20, x2: 800, y1: Z, y2: Z, class: 'axis' }, { at: groups[0].i });
      let x = 40;
      groups.forEach(g => { g.q.forEach((q, k) => {
        const h = Math.max(2, Math.abs(q.change_pct) * K), neg = q.change_pct < 0, col = neg ? 'var(--down)' : q.change_pct > 0 ? 'var(--up)' : 'var(--ink2)';
        el('rect', { x, y: neg ? Z : Z - h, width: w, height: h, rx: 2, fill: col, class: 'grow ' + (neg ? 'neg' : 'pos') }, { at: g.i, d: .1 + k * .1 });
        el('text', { x: x + w / 2, y: neg ? Z - 12 : Z + 24, 'text-anchor': 'middle', class: 'lab' }, { text: name(q), at: g.i, d: .1 + k * .1 });
        el('text', { x: x + w / 2, y: neg ? Z + h + 30 : Z - h - 10, 'text-anchor': 'middle', class: 'num' }, { at: g.i, d: .1 + k * .1, count: { v: q.change_pct } });
        x += w + 22; }); x += 30; });
    },
  };

  // ---------- the reader ----------
  const ICON = {
    news: '<circle cx="6" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M11 7.5a6.5 6.5 0 0 1 0 9M14.5 4.5a10.5 10.5 0 0 1 0 15"/>',
    hit: '<path d="M4 18h16"/><path d="M8 18V9l4-4 4 4v9"/>',
    held: '<path d="M3 13h18"/><path d="M7 13V8M12 13V8M17 13V8"/>',
    so: '<circle cx="12" cy="6.5" r="2" fill="currentColor" stroke="none"/><circle cx="6.5" cy="16.5" r="2" fill="currentColor" stroke="none"/><circle cx="17.5" cy="16.5" r="2" fill="currentColor" stroke="none"/>',
    you: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>',
    wrong: '<path d="M3 12h6l3-6 3 12 3-6h3"/>',
    next: '<path d="M3 12h6"/><path d="M9 12c4 0 5-6 12-6M9 12c4 0 5 6 12 6"/>',
    world: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3.2 3.4 3.2 13.6 0 17M12 3.5c-3.2 3.4-3.2 13.6 0 17"/>',
    trad: '<path d="M15.5 4.2a8 8 0 1 0 4.3 12.6A6.6 6.6 0 0 1 15.5 4.2z"/>',
    check: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  };
  const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;
  const MOOD = { news: ['calm'], hit: null, held: ['hold'], so: null, you: ['you'], world: ['world'], trad: ['trad'], next: ['fall', 'hold'], wrong: ['fall'] };
  const TIME = { so: 6.5, you: 7.5, next: 9, wrong: 9 };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
.rd { position: fixed; inset: 0; z-index: 60; display: grid; grid-template-rows: auto 1fr auto; color: var(--ink); background: rgba(var(--space-rgb), .78); opacity: 0; transition: opacity .5s cubic-bezier(.22,.61,.36,1); }
.rd.in { opacity: 1; } .rd[hidden] { display: none; }
.rd-haze, .rd-grain { position: absolute; inset: 0; pointer-events: none; }
.rd-haze i { position: absolute; inset: 0; opacity: 0; transition: opacity 1.6s cubic-bezier(.22,.61,.36,1); } .rd-haze i.on { opacity: 1; }
.rd-haze .fall { background: radial-gradient(42% 46% at 58% 78%, rgba(var(--down-rgb),.15), transparent 70%); }
.rd-haze .hold { background: radial-gradient(34% 40% at 86% 42%, rgba(var(--up-rgb),.11), transparent 70%); }
.rd-haze .calm { background: radial-gradient(48% 52% at 66% 46%, rgba(130,150,235,.13), transparent 72%); }
.rd-haze .you { background: radial-gradient(40% 50% at 18% 52%, rgba(var(--glow-rgb),.10), transparent 72%), radial-gradient(30% 34% at 64% 46%, rgba(var(--mauve-rgb),.10), transparent 70%); }
.rd-haze .world { background: radial-gradient(46% 40% at 64% 26%, rgba(var(--down-rgb),.10), transparent 72%); }
.rd-haze .trad { background: radial-gradient(60% 30% at 50% 100%, rgba(var(--mauve-rgb),.14), transparent 75%); }
.rd-grain { opacity: .07; mix-blend-mode: overlay; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
.rd > header, .rd > main, .rd > footer { position: relative; }
.rd > header { display: flex; align-items: flex-end; gap: 36px; padding: 30px 56px 0; }
.rd-day span { font-size: 14px; color: var(--muted); } .rd-day b { display: block; margin-top: 6px; font-size: 22px; font-weight: 700; letter-spacing: -.02em; max-width: 36ch; }
.rd-tabs { display: flex; gap: 26px; margin-left: auto; }
.rd button { border: 0; background: none; color: var(--ink2); font: 600 15px var(--font); cursor: pointer; padding: 0; }
.rd button:hover { color: var(--ink); }
.rd-tabs button { max-width: 230px; padding: 6px 0; border-bottom: 2px solid transparent; color: var(--muted); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-tabs button b { margin-right: 8px; font-family: var(--display); font-weight: 500; color: var(--faint); }
.rd-tabs button.cur { color: var(--ink); border-color: var(--ink); }
.rd-x { margin-left: 18px; padding-bottom: 8px !important; }
.rd > main { display: grid; grid-template-columns: minmax(340px, 34%) 1fr; gap: 48px; align-items: center; min-height: 0; padding: 0 56px; }
.rd-words { display: flex; flex-direction: column; justify-content: center; min-height: 360px; }
.rd-words > * { transition: opacity .45s cubic-bezier(.22,.61,.36,1), transform .45s cubic-bezier(.22,.61,.36,1); }
.rd-words.swap > * { opacity: 0; transform: translateY(10px); }
.rd-kick { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; font-size: 15px; font-weight: 600; color: var(--muted); }
.rd-kick svg { width: 22px; height: 22px; flex: none; }
.rd-kick[data-kind="you"] { color: var(--glow); } .rd-kick[data-kind="wrong"] { color: var(--down); } .rd-kick[data-kind="trad"] { color: var(--mauve); } .rd-kick[data-kind="so"] { color: var(--ink); }
.rd-say { font-size: clamp(30px, 3.1vw, 48px); font-weight: 700; letter-spacing: -.035em; line-height: 1.04; }
.rd-say .soft { color: var(--muted); }
.rd-words.big .rd-say { font-size: clamp(40px, 4.4vw, 68px); letter-spacing: -.04em; line-height: .99; }
.rd-sub { max-width: 34ch; margin-top: 18px; font-size: 18px; line-height: 1.45; color: var(--ink2); }
.rd-sure { max-width: 40ch; margin-top: 24px; font-size: 15px; line-height: 1.5; color: var(--muted); }
.rd-check { display: flex; gap: 10px; max-width: 44ch; margin-top: 14px; font-size: 14.5px; line-height: 1.5; color: var(--muted); }
.rd-check svg { width: 20px; height: 20px; flex: none; color: var(--down); }
.rd-words [hidden] { display: none; }
.rd-sources { max-width: 52ch; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 15px; line-height: 1.4; color: var(--muted); }
.rd-sources .k { margin: 0 0 2px; font-weight: 600; color: var(--ink2); }
.rd-sources a { display: flex; gap: 10px; padding: 3px 0; color: var(--ink2); text-decoration: none; white-space: nowrap; }
.rd-sources a b { flex: none; font-weight: 600; color: var(--glow); }
.rd-sources a span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.rd-sources a:hover span, .rd-sources a:focus-visible span { text-decoration: underline; }
.rd-sources .px { margin: 6px 0 0; }
.rd-words.with-sources .rd-say { font-size: clamp(26px, 2.5vw, 40px); line-height: 1.08; }
.rd-words.with-sources .rd-sure { margin-top: 14px; }
@media (max-height: 820px) and (min-width: 1101px) { .rd-words.with-sources { align-self: start; min-height: 0; max-height: 100%; overflow-y: auto; justify-content: flex-start; } .rd-words.with-sources .rd-sure { margin-top: 10px; } .rd-sources { margin-top: 10px; padding-top: 8px; } }
.rd-stage svg { display: block; width: 100%; height: calc(100vh - 220px); max-height: 640px; overflow: visible; }
.rd > footer { display: grid; grid-template-columns: minmax(340px, 34%) 1fr; gap: 48px; align-items: end; padding: 0 56px 26px; }
.rd-bars { display: flex; gap: 6px; }
.rd-bars i { position: relative; flex: 1; height: 18px; cursor: pointer; }
.rd-bars i::before, .rd-bars i b { content: ""; position: absolute; left: 0; right: 0; top: 8px; height: 3px; border-radius: 2px; }
.rd-bars i::before { background: var(--line); }
.rd-bars i b { background: var(--ink); transform: scaleX(0); transform-origin: left; }
.rd-bars i.done b { transform: scaleX(1); }
.rd-bars i.cur b { animation: rdFill var(--t, 5s) linear forwards; }
.rd.paused .rd-bars i.cur b { animation: none; transform: scaleX(1); opacity: .5; }
@keyframes rdFill { to { transform: scaleX(1); } }
.rd-ctl { display: flex; gap: 24px; margin-top: 10px; }
.rd-note { justify-self: end; font-size: 12.5px; color: var(--faint); max-width: 60ch; text-align: right; }
.rd svg text { font-family: var(--font); font-size: 16px; font-weight: 500; fill: var(--ink2); }
.rd svg .num { font-family: var(--display); font-weight: 500; font-size: 24px; fill: var(--ink); }
.rd svg .lab { font-size: 16px; fill: var(--ink2); }
.rd svg .mut { font-size: 14.5px; font-weight: 400; fill: var(--muted); }
.rd svg .grp { font-size: 14.5px; font-weight: 600; fill: var(--muted); }
.rd svg .head { font-size: 19px; font-weight: 700; fill: var(--ink); }
.rd svg .axis { stroke: rgba(var(--line-rgb),.34); stroke-width: 1; }
.rd svg .dash { stroke: rgba(var(--line-rgb),.4); stroke-width: 1.2; stroke-dasharray: 3 5; fill: none; }
.rd .rx { opacity: 0; transition: opacity .6s cubic-bezier(.22,.61,.36,1), transform .9s cubic-bezier(.22,.61,.36,1), stroke-dashoffset 1.2s cubic-bezier(.22,.61,.36,1); }
.rd .rx.on { opacity: 1; transition-delay: var(--d, 0s); }
.rd .rx.on.dim { opacity: .15; transition-delay: 0s; }
.rd .draw { stroke-dasharray: 1; stroke-dashoffset: 1; } .rd .draw.on { stroke-dashoffset: 0; }
.rd .grow { transform-box: fill-box; transform: scaleY(0); } .rd .grow.pos { transform-origin: 50% 100%; } .rd .grow.neg { transform-origin: 50% 0; } .rd .grow.on { transform: none; }
.rd .growx { transform-box: fill-box; transform: scaleX(0); } .rd .growx.pos { transform-origin: 0 50%; } .rd .growx.neg { transform-origin: 100% 50%; } .rd .growx.on { transform: none; }
.rd .pop { transform-box: fill-box; transform-origin: 50% 50%; transform: scale(.2); } .rd .pop.on { transform: none; }
@media (max-width: 1100px) {
  .rd { overflow: auto; display: block; }
  .rd > header { flex-wrap: wrap; padding: 22px 22px 0; gap: 14px; } .rd-tabs { margin-left: 0; gap: 18px; flex-wrap: wrap; } .rd-x { margin-left: auto; }
  .rd > main { grid-template-columns: 1fr; gap: 8px; padding: 20px 22px 0; } .rd-words { min-height: 220px; justify-content: flex-start; }
  .rd-stage svg { height: auto; max-height: none; }
  .rd-sources a { display: block; padding: 7px 0; white-space: normal; } .rd-sources a b { display: block; }
  .rd > footer { grid-template-columns: 1fr; gap: 12px; padding: 18px 22px 26px; } .rd-note { justify-self: start; text-align: left; }
}
@media (prefers-reduced-motion: reduce) { .rd .rx, .rd-words > *, .rd-haze i { transition-duration: .01s !important; } .rd-bars i.cur b { animation-duration: .01s; } }
/* While a read is open, the page underneath steps back: only the globe stays, dimmed under the reader. */
body.reading > :not(.rd):not(#world):not(.scrim):not(script):not(style) { opacity: 0 !important; pointer-events: none !important; transition: opacity .4s ease; }
/* Today's reads, on the front page */
.f-reads { margin: 0 0 16px; border-top: 1px solid var(--line); }
.f-read { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 12px; align-items: baseline; width: 100%; padding: 12px 0; border: 0; border-bottom: 1px solid var(--line); background: none; color: inherit; text-align: left; font: inherit; cursor: pointer; }
.f-read .n { font-family: var(--display); font-size: 15px; color: var(--faint); }
.f-read .t { font-size: 17px; font-weight: 600; line-height: 1.3; letter-spacing: -.01em; color: var(--ink); }
.f-read .p { font-size: 14px; font-weight: 600; color: var(--mauve); opacity: .75; transition: opacity .2s; }
.f-read:hover .p, .f-read:focus-visible .p { opacity: 1; }
.f-reads-k { display: flex; justify-content: space-between; align-items: baseline; margin: 4px 0 8px; font-size: 14px; font-weight: 600; color: var(--muted); }
.f-reads-k button { border: 0; background: none; padding: 0; color: var(--mauve); font: 600 14px var(--font); cursor: pointer; }
`;
  document.head.append(css);

  const root = document.createElement('div'); root.className = 'rd'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Today’s reads');
  root.innerHTML = `<div class="rd-haze"><i class="fall"></i><i class="hold"></i><i class="calm"></i><i class="you"></i><i class="world"></i><i class="trad"></i></div><div class="rd-grain"></div>
    <header><div class="rd-day"><span></span><b></b></div><nav class="rd-tabs"></nav><button class="rd-x" type="button">Close</button></header>
    <main><section class="rd-words"><p class="rd-kick"></p><h2 class="rd-say"></h2><p class="rd-sub" hidden></p><p class="rd-sure" hidden></p><p class="rd-check" hidden></p>${PUBLIC ? '<div class="rd-sources" hidden></div>' : ''}</section>
      <section class="rd-stage"><svg viewBox="0 0 820 560" aria-hidden="true"></svg></section></main>
    <footer><div><div class="rd-bars"></div><div class="rd-ctl"><button type="button" data-b>Back</button><button type="button" data-p>Pause</button><button type="button" data-n>Next</button></div></div>
      <p class="rd-note"></p></footer>`;
  document.body.append(root);
  const q = s => root.querySelector(s), svg = q('svg'), words = q('.rd-words'), bars = q('.rd-bars'), tabs = q('.rd-tabs'), hazes = [...root.querySelectorAll('.rd-haze i')];
  q('.rd-day span').textContent = E.date ? day(E.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  q('.rd-day b').textContent = E.headline || '';
  q('.rd-note').textContent = E.reads_prototype ? 'Prototype: Claude wrote these reads to test the format. Every figure is measured from the edition.' : 'Every figure is measured. The words are the morning read’s.';

  const build = list => list.map((r, ri) => { const steps = stepsOf(r, ri); return { r, steps, pics: picturesOf(r, steps) }; });
  const MORNING = build(READS);
  let PLAN = MORNING;
  function setList(plan, meta) {
    PLAN = plan;
    q('.rd-day span').textContent = meta.kicker; q('.rd-day b').textContent = meta.title; q('.rd-note').textContent = meta.note;
    tabs.replaceChildren(...(plan.length > 1 && plan.length <= 5 ? plan.map((p, i) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<b>${i + 1}</b>`; b.append(p.r.title); b.title = p.r.title; b.onclick = () => { stop(); show(i, 0); }; return b; }) : []));
  }
  const MORNING_META = { kicker: q('.rd-day span').textContent, title: E.headline || '', note: q('.rd-note').textContent };

  let ri = -1, si = 0, pic = null, track = [], playing = true, timer = 0, lastFocus = null;
  function drawPic(p) {
    svg.replaceChildren(); track = [];
    const ctx = { steps: p.idx.map(i => PLAN[ri].steps[i]) };
    try { DRAW[p.type](factory(svg, track), ctx, KIT); } catch (e) { console.warn('read picture failed', p.type, e); svg.replaceChildren(); track = []; }
    svg.getBoundingClientRect();
  }
  function countUp(t) {
    const t0 = performance.now() + t.d * 1000;
    const tick = now => { if (!t.e.classList.contains('on')) return; const k = Math.min(1, Math.max(0, (now - t0) / 950)); t.e.textContent = pct(t.count.v * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
    t.e.textContent = pct(0); requestAnimationFrame(tick);
  }
  function show(r, s) {
    if (r !== ri) { ri = r; pic = null; bars.replaceChildren(...PLAN[ri].steps.map((_, i) => { const t = document.createElement('i'); t.append(document.createElement('b')); t.onclick = () => { stop(); show(ri, i); }; return t; }));
      [...tabs.children].forEach((b, i) => b.classList.toggle('cur', i === ri)); }
    si = s;
    const P = PLAN[ri], st = P.steps[si], p = P.pics.find(x => x.idx.includes(si)) || P.pics[0];
    if (p !== pic) { pic = p; drawPic(p); }
    const local = p.idx.indexOf(si), kind = st.kind;
    for (const t of track) {
      const on = local >= t.at && local <= t.until;
      t.e.classList.toggle('on', on); t.e.classList.toggle('dim', on && (t.dim.has(kind) || t.dim.has(local)));
      if (t.count && on && !t.was) countUp(t); t.was = on;
    }
    const qs = quotes([st]), mood = st.mood || MOOD[kind] || (qs.length && qs.filter(x => x.change_pct < 0).length > qs.length / 2 ? ['fall'] : kind === 'so' ? ['fall', 'hold'] : ['hold']);
    hazes.forEach(h => h.classList.toggle('on', mood.includes(h.classList[0])));
    words.classList.add('swap');
    setTimeout(() => {
      const kick = q('.rd-kick'); kick.dataset.kind = kind; kick.innerHTML = icon(st.icon || kind) + `<span>${esc(st.label || SAY[kind] || '')}</span>`;
      const parts = kind === 'so' ? st.text.match(/[^.!?]+[.!?]+/g) : null;
      q('.rd-say').innerHTML = parts && parts.length === 2 ? `<span class="soft">${esc(parts[0].trim())}</span> ${esc(parts[1].trim())}` : esc(st.text);
      const sub = q('.rd-sub'), call = st.ev.map(claimOf).find(Boolean), rule = st.ev.map(ruleOf).find(Boolean), mine = st.ev.map(holdingOf).filter(p => p && dayMove(p) != null);
      const net = mine.reduce((a, p) => a + dayMove(p), 0);
      const subText = mine.length ? `${mine.map(p => `${name(marketOf(p))} ${usd(dayMove(p))}`).join(', ')}. ${usd(net)} across the ${count(mine.length)} of your holdings tracked on ${SESSION}, from your share counts and that day\u2019s prices.` : call ? `${({ flat: 'Flat', up: 'Higher', down: 'Lower' }[call.direction] || call.direction)} through ${MON(day(call.due_on))}, counted from ${SESSION}’s close. Graded on the record either way.`
        : rule ? `${rule.if} It’s ${rule.state === 'tripped' ? 'tripped' : rule.state}. ${rule.then.replace(/\s*--\s*/g, ': ')}` : '';
      sub.hidden = !(st.sub || subText); sub.textContent = st.sub || subText;
      q('.rd-sure').hidden = !st.sure; q('.rd-sure').textContent = st.sure || '';
      const chk = q('.rd-check'), fl = (st.flags || [])[0]; chk.hidden = !fl;
      chk.innerHTML = fl ? icon('check') + `<span>Checked: the written read said “${esc(String(fl.text).slice(0, 140))}”. ${esc(fl.reason || '')}. That line was cut.</span>` : '';
      if (PUBLIC) drawSources(st.sources);
      words.classList.toggle('big', kind === 'so' && st.text.length <= 64); words.classList.remove('swap');
    }, 220);
    const dur = st.hold || TIME[kind] || 5.2;
    [...bars.children].forEach((t, i) => { t.classList.toggle('done', i < si); t.classList.remove('cur'); void t.offsetWidth; t.classList.toggle('cur', i === si); t.style.setProperty('--t', dur + 's'); });
    clearTimeout(timer); if (playing) timer = setTimeout(next, dur * 1000);
  }
  const next = () => { if (si < PLAN[ri].steps.length - 1) show(ri, si + 1); else if (ri < PLAN.length - 1) show(ri + 1, 0); else stop(); };
  const back = () => { if (si > 0) show(ri, si - 1); else if (ri > 0) show(ri - 1, PLAN[ri - 1].steps.length - 1); };
  function drawSources(s) {
    const box = q('.rd-sources'); box.replaceChildren(); box.hidden = !(s?.articles.length || s?.prices.length);
    words.classList.toggle('with-sources', !box.hidden); if (box.hidden) return;
    const line = (cls, text) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; box.append(p); };
    line('k', 'Sources');
    for (const h of s.articles) {
      const a = document.createElement('a'); a.href = h.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.addEventListener('click', stop);
      a.title = h.title; const who = document.createElement('b'); who.textContent = h.source;
      const what = document.createElement('span'); what.textContent = h.title;
      a.append(who, what); box.append(a);
    }
    if (s.prices.length) line('px', `Prices from Yahoo Finance: ${s.prices.join(', ')}.`);
  }
  function stop() { playing = false; clearTimeout(timer); root.classList.add('paused'); q('[data-p]').textContent = 'Play'; }
  function play() { playing = true; root.classList.remove('paused'); q('[data-p]').textContent = 'Pause'; show(ri, si); }
  function open(r = 0, plan = MORNING, meta = MORNING_META) {
    if (!plan.length) return;
    setList(plan, meta);
    lastFocus = document.activeElement; root.hidden = false; document.body.classList.add('reading');
    requestAnimationFrame(() => root.classList.add('in'));
    playing = true; root.classList.remove('paused'); q('[data-p]').textContent = 'Pause';
    ri = -1; show(Math.max(0, Math.min(PLAN.length - 1, r)), 0); q('.rd-x').focus({ preventScroll: true });
  }
  function close() { clearTimeout(timer); root.classList.remove('in'); document.body.classList.remove('reading'); setTimeout(() => { root.hidden = true; }, 450); lastFocus?.focus?.({ preventScroll: true }); }
  q('.rd-x').onclick = close; q('[data-n]').onclick = () => { stop(); next(); }; q('[data-b]').onclick = () => { stop(); back(); }; q('[data-p]').onclick = () => (playing ? stop() : play());
  // While a read is open it owns the keyboard; the app underneath doesn't see these keys.
  addEventListener('keydown', e => {
    if (root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { stop(); next(); } else if (e.key === 'ArrowLeft') { stop(); back(); }
    else if (e.key === ' ') { e.preventDefault(); playing ? stop() : play(); }
    else return;
    e.stopImmediatePropagation();
  }, true);
  const KIT = { tspans, wrap, at, pct, count, Count, name, bySym, INS, rets, SESSION, quotes, NS };
  Object.assign(api, { open: r => open(r), close, isOpen: () => !root.hidden,
    play: (list, i = 0, meta = {}) => open(i, build(list.map(x => ({ ...x, fixed: true }))), { kicker: meta.kicker || '', title: meta.title || '', note: meta.note || 'Every figure is measured from the edition. The sentences are built from the same numbers.' }),
    picture: (nameOf, fn) => { DRAW[nameOf] = fn; } });
})();
