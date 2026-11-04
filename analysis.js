/* Analysis, told the way the reads are: one picture that builds, a plain sentence at each step. No model is involved.
   Every sentence is a template filled from the edition's measured numbers, so it's true by construction. A check that
   isn't rebuilt yet keeps its old panel; app.js asks SixSevenAnalysis.has(key) before opening one. */
(() => {
  'use strict';
  const RD = window.SixSevenReads;
  const api = { has: () => false, open: () => {} };
  window.SixSevenAnalysis = api;
  if (!RD?.play) return;
  const KD = window.SIX_SEVEN_DECK || {}, DP = window.SIX_SEVEN_DEPTH || {}, X = window.SIX_SEVEN_EXPLORE || { instruments: [] };
  const INS = X.instruments || [], bySym = new Map(INS.map(i => [i.symbol, i]));
  const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  // Sentences start with a word, not a figure: "Fourteen of 29", but "of 29" inside one.
  const OPEN = [...WORD, 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const w = n => WORD[n] || String(n), W = n => { const t = OPEN[n] || String(n); return t[0].toUpperCase() + t.slice(1); };
  const times = v => `${Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v))}×`;
  const SHORT = { 'Russell 2000': 'Small caps', '10-Year Treasury': 'The 10-year yield', '3-Month': 'The 3-month yield', '30-Year': 'The 30-year yield', 'VIX': 'The fear gauge',
    'Semiconductors': 'Chip stocks', 'Dollar Index': 'The dollar', 'EAFE Developed': 'Rich markets abroad', 'Emerging Mkts': 'Emerging markets', 'Africa ex-SA ETF': 'Africa beyond South Africa',
    'Crude Oil': 'Crude oil', 'Natural Gas': 'Natural gas' };
  const CUR = { USD: 'dollar', KES: 'Kenyan shilling', ZAR: 'South African rand', NGN: 'Nigerian naira', EGP: 'Egyptian pound', JPY: 'yen', CHF: 'Swiss franc', CNY: 'Chinese yuan',
    INR: 'Indian rupee', BRL: 'Brazilian real', MXN: 'Mexican peso', EUR: 'euro', GBP: 'British pound' };
  const pair = i => { const m = /^([A-Z]{3})\/([A-Z]{3})$/.exec(i.label || ''); return m && CUR[m[1]] && CUR[m[2]] ? [CUR[m[1]], CUR[m[2]]] : null; };
  const cap = s => s[0].toUpperCase() + s.slice(1);
  // Chart name: a currency pair reads as which way it's quoted, so a dot to the right still means the first one rose.
  const nm = i => { const p = pair(i); return p ? `${cap(p[0])} vs ${p[1]}` : SHORT[i.label] || i.label; };
  // Mid-sentence name: "the naira", "crude oil", "the fear gauge", but "Nasdaq" and "TSMC" keep their capitals.
  const mid = i => { const p = pair(i); if (p) return `the ${p[0] === 'dollar' ? p[1] : p[0]}`; const n = nm(i);
    return /^The /.test(n) ? 'the' + n.slice(3) : ['commodities', 'futures'].includes(i.desk) || SHORT[i.label] ? n[0].toLowerCase() + n.slice(1) : n; };
  const moved = (i, v) => { const p = pair(i), dir = v >= 0 ? 'rose' : 'fell', by = `${Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 1)}%`;
    return p ? `The ${p[0]} ${dir} ${by} against the ${p[1]}` : `${nm(i)} ${dir} ${by}`; };
  const GROUP = { watchlist: 'big tech stocks', fx: 'currencies', global: 'stock markets abroad', commodities: 'commodities', indices: 'US stock indexes', africa: 'African markets',
    curve: 'bond yields', sectors: 'US sectors', crypto: 'crypto', futures: 'futures', rates: 'interest rates' };
  const METHOD = { kind: 'method', label: 'How it’s measured', icon: 'check', mood: ['calm'] };

  // ---------- Unusual moves: every market, placed by today's move against its own normal day ----------
  function unusual() {
    const norm = new Map((DP.normal || []).map(r => [r.label, r]));
    const rows = INS.map(i => {
      const n = norm.get(i.label); if (n && Number.isFinite(n.z)) return { i, x: n.z };
      const s = (i.series || []).filter(Boolean); if (s.length < 16 || i.change_pct == null) return null;
      const r = s.slice(1).map((v, k) => (v / s[k] - 1) * 100).slice(0, -1), m = r.reduce((a, v) => a + v, 0) / r.length;
      const sd = Math.sqrt(r.reduce((a, v) => a + (v - m) ** 2, 0) / r.length); return sd > 0 ? { i, x: i.change_pct / sd } : null;
    }).filter(Boolean).sort((a, b) => a.x - b.x);
    if (rows.length < 10) return null;
    const top = [...rows].sort((a, b) => Math.abs(b.x) - Math.abs(a.x))[0], inside = rows.filter(r => Math.abs(r.x) <= 1).length, big = rows.filter(r => Math.abs(r.x) > 2);
    const by = {}; big.forEach(r => { by[r.i.desk] = (by[r.i.desk] || 0) + 1; });
    const [desk, n] = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || [];
    const lead = n >= 2 && n >= big.length / 2 ? desk : null;
    return { key: 'outliers', title: 'Unusual moves', pictures: [{ type: 'swarm', steps: [0, 1, 2, 3] }], steps: [
      { kind: 'hit', label: 'The biggest move', text: `${moved(top.i, top.i.change_pct)}, about ${Math.abs(top.x).toFixed(1)} times its usual move.`, mood: [top.i.change_pct >= 0 ? 'hold' : 'fall'],
        data: { rows, top, lead } },
      { kind: 'held', label: 'Everything else', text: `${W(inside)} of ${w(rows.length)} markets stayed inside a normal day.`, sub: `${W(big.length)} moved more than twice their normal.` },
      { kind: 'so', text: lead ? `The unusual moves were mostly ${GROUP[lead] || lead}. The rest was an ordinary day.` : 'The unusual moves were scattered. Nothing moved as a group.', mood: ['calm'] },
      { ...METHOD, text: 'Each market against its own last month.', sub: 'A normal day is one typical move either way. The typical move is how far that market usually goes in a session.' },
    ] };
  }
  RD.picture('swarm', (el, ctx, K) => {
    const { rows, top, lead } = ctx.steps[0].data, lo = Math.min(-3.5, rows[0].x - .3), hi = Math.max(3.5, rows[rows.length - 1].x + .3);
    const x0 = 40, x1 = 790, X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0), base = 270, r = 8, aH = K.at(ctx, 'hit'), aD = K.at(ctx, 'held'), aS = K.at(ctx, 'so');
    el('rect', { x: X(-1), y: 90, width: X(1) - X(-1), height: 340, fill: 'rgba(var(--line-rgb),.07)' }, { at: aD, d: .1 });
    el('text', { x: X(0), y: 78, 'text-anchor': 'middle', class: 'mut' }, { text: 'a normal day', at: aD, d: .2 });
    el('line', { x1: x0, x2: x1, y1: 452, y2: 452, class: 'axis' }, { at: aH });
    for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) el('text', { x: X(v), y: 476, 'text-anchor': 'middle', class: 'mut', style: 'font-family:var(--display)' }, { text: v === 0 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v)}×`, at: aH });
    el('text', { x: x0, y: 504, class: 'mut' }, { text: 'fell more than usual', at: aH }); el('text', { x: x1, y: 504, 'text-anchor': 'end', class: 'mut' }, { text: 'rose more than usual', at: aH });
    const placed = [];
    const pos = rows.map(m => { const x = X(m.x); let k = 0, y = base;
      for (;;) { y = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 2 + 2); if (!placed.some(p => Math.hypot(p.x - x, p.y - y) < r * 2 + 1.5)) break; k++; }
      placed.push({ x, y }); return { ...m, cx: x, cy: y }; });
    pos.forEach((m, k) => el('circle', { cx: m.cx, cy: m.cy, r, fill: 'rgba(var(--line-rgb),.32)', class: 'pop' }, { at: aH, d: .05 + k * .015 }));
    pos.filter(m => Math.abs(m.x) <= 1).forEach(m => el('circle', { cx: m.cx, cy: m.cy, r, fill: 'rgba(var(--line-rgb),.62)' }, { at: aD, until: aD, d: .3 }));
    if (lead) pos.filter(m => m.i.desk === lead && Math.abs(m.x) > 2).forEach((m, k) => el('circle', { cx: m.cx, cy: m.cy, r, fill: 'var(--down)', class: 'pop' }, { at: aS, d: .2 + k * .08 }));
    const t = pos.find(m => m.i === top.i);
    el('circle', { cx: t.cx, cy: t.cy, r: r + 3, fill: 'none', stroke: 'var(--glow)', 'stroke-width': 2 }, { at: aH, d: .9 });
    K.tspans(el, t.cx + (t.cx > 600 ? -16 : 16), t.cy - 30, [nm(t.i), `${times(t.x)} normal`], 'lab', { at: aH, d: 1, anchor: t.cx > 600 ? 'end' : 'start' }, 20);
    if (lead) { const g = pos.filter(m => m.i.desk === lead && Math.abs(m.x) > 2), mx = g.reduce((a, m) => a + m.cx, 0) / g.length;
      el('text', { x: mx, y: 120, 'text-anchor': 'middle', class: 'head', style: 'fill:var(--down)' }, { text: `Mostly ${GROUP[lead] || lead}`, at: aS, d: .5 }); }
  });

  // ---------- Do the usual patterns hold: textbook pairs, holding or not ----------
  function patterns() {
    const C = DP.crossdesk; if (!C?.results?.length) return null;
    const R = C.results, held = R.filter(x => x.held), broke = R.filter(x => !x.held);
    const flipped = broke.filter(x => x.r * x.expected < 0).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0], quiet = broke.sort((a, b) => Math.abs(a.r) - Math.abs(b.r))[0], star = flipped || quiet;
    const steps = [
      { kind: 'held', label: 'Still holding', text: `${W(held.length)} of ${w(R.length)} textbook relationships are holding.`, sub: `Tested over the last ${C.lookback || R[0].sample} sessions.`, data: { R, star } },
      { kind: 'hit', label: 'Broken', text: broke.length ? `${W(broke.length)} have gone quiet or turned around.` : 'None have broken.', mood: ['fall'] },
    ];
    const said = s => (bySym.get(s) ? mid(bySym.get(s)) : s);
    if (star) steps.push({ kind: 'so', text: `${star.label} isn’t working right now. Don’t lean on ${said(star.a)} to read ${said(star.b)}.`,
      sub: `It’s supposed to move ${star.expected > 0 ? 'with' : 'against'} it. Lately it ${star.r * star.expected < 0 ? 'has done the opposite' : 'barely relates at all'}.`, mood: ['calm'] });
    steps.push({ ...METHOD, text: 'Each pair was written down in advance, with the reason it should hold.', sub: 'Then it’s tested against stored prices. A broken rule of thumb is often the most useful thing here.' });
    return { key: 'rules', title: 'Do the usual patterns hold?', pictures: [{ type: 'pairs', steps: steps.map((_, k) => k) }], steps };
  }
  RD.picture('pairs', (el, ctx, K) => {
    const { R, star } = ctx.steps[0].data, aD = K.at(ctx, 'held'), aH = K.at(ctx, 'hit'), aS = K.at(ctx, 'so'), rh = Math.min(36, 500 / R.length), xa = 230, xb = 590;
    const lab = s => (bySym.get(s) ? nm(bySym.get(s)) : s);
    el('text', { x: xa, y: 24, 'text-anchor': 'end', class: 'grp' }, { text: 'Supposed to move…', at: aD }); el('text', { x: xb, y: 24, class: 'grp' }, { text: '…with or against', at: aD });
    [...R].sort((a, b) => (b.held - a.held) || Math.abs(b.r) - Math.abs(a.r)).forEach((p, k) => {
      const y = 56 + k * rh, is = p === star, ok = p.held, col = ok ? 'var(--glow)' : 'var(--down)';
      const dim = ok ? ['hit', 'so'] : is ? [] : ['so'];
      el('text', { x: xa - 14, y: y + 5, 'text-anchor': 'end', class: 'lab' }, { text: lab(p.a), at: aD, d: k * .03, dim: is ? [] : ['so'] });
      el('text', { x: xb + 14, y: y + 5, class: 'lab' }, { text: lab(p.b), at: aD, d: k * .03, dim: is ? [] : ['so'] });
      el('line', { x1: xa, x2: xb, y1: y, y2: y, stroke: 'rgba(var(--line-rgb),.18)', 'stroke-width': 1.5 }, { at: aD, d: k * .03, dim: is ? [] : ['so'] });
      if (ok) el('line', { x1: xa, x2: xb, y1: y, y2: y, stroke: col, 'stroke-width': 1 + Math.abs(p.r) * 3, 'stroke-linecap': 'round', pathLength: 1, class: 'draw' }, { at: aD, d: .2 + k * .06, dim });
      else el('line', { x1: xa, x2: xb, y1: y, y2: y, stroke: col, 'stroke-width': 2, 'stroke-dasharray': '4 7', opacity: .9 }, { at: aH, d: .1 + k * .05, dim });
      el('text', { x: (xa + xb) / 2, y: y - 7, 'text-anchor': 'middle', class: 'mut', style: 'font-size:13px' },
        { text: ok ? `${p.expected > 0 ? 'together' : 'opposite'}, holding` : p.r * p.expected < 0 ? 'turned around' : 'gone quiet', at: ok ? aD : aH, d: .3 + k * .05, dim });
    });
  });

  // ---------- Today's market mood: five measures, one at a time, then the label ----------
  function mood() {
    const G = KD.regime; if (!G?.axes?.length) return null;
    const AX = {
      breadth: ['How many rose', v => v > .15 ? 'Most markets rose.' : v < -.15 ? 'More markets fell than rose.' : 'Rises and falls were close to even.'],
      volatility: ['The fear gauge', v => v > .15 ? 'The fear gauge eased.' : v < -.15 ? 'The fear gauge rose.' : 'The fear gauge barely moved.'],
      havens: ['Safe havens', v => v < -.15 ? 'Money moved into safe havens.' : v > .15 ? 'Safe havens were sold.' : 'Safe havens were quiet.'],
      curve: ['The bond curve', v => v < -.15 ? 'Long-term yields slipped against short-term ones, a cautious sign.' : v > .15 ? 'Long-term yields rose against short-term ones, a confident sign.' : 'The bond curve barely moved.'],
      dollar: ['The dollar', v => v > .15 ? 'The dollar slipped, which usually helps risk.' : v < -.15 ? 'The dollar firmed, a cautious sign.' : 'The dollar barely moved.'],
    };
    // regime.py writes its detail in desk shorthand (VIX, DXY, bp). Say it in words; drop it if the format ever changes.
    const ch = (v, unit) => `${parseFloat(v) >= 0 ? 'rose' : 'fell'} ${v.replace(/^[+-]/, '')}${unit}`;
    const PLAIN = {
      breadth: d => { const m = /^(\d+) advancing, (\d+) declining of (\d+)$/.exec(d); return m && `${m[1]} rose and ${m[2]} fell, out of ${m[3]} markets.`; },
      volatility: d => { const m = /^VIX ([\d.]+), ([+-][\d.]+)%$/.exec(d); return m && `The VIX, Wall Street’s fear gauge, is at ${m[1]}. It ${ch(m[2], '%')} on the day.`; },
      havens: d => { const out = d.split(', ').map(t => { let m;
          if ((m = /^gold ([+-][\d.]+)%$/.exec(t))) return `gold ${ch(m[1], '%')}`;
          if ((m = /^USD\/(JPY|CHF) ([+-][\d.]+)%$/.exec(t))) return `the ${m[1] === 'JPY' ? 'yen' : 'Swiss franc'} ${parseFloat(m[2]) > 0 ? 'slipped' : 'firmed'}`;
          if ((m = /^30-year yield ([+-][\d.]+) bp$/.exec(t))) return `the 30-year yield ${ch(m[1], ' basis points')}`;
          return null; });
        return out.every(Boolean) && out.length ? cap(out.slice(0, -1).join(', ') + (out.length > 1 ? ' and ' : '') + out[out.length - 1]) + '.' : null; },
      curve: d => { const m = /^10-year–3-month ([+-][\d.]+) pp \((\w+)\), ([+-][\d.]+) bp today$/.exec(d);
        return m && `The 10-year pays ${m[1].replace(/^[+-]/, '')} points ${parseFloat(m[1]) >= 0 ? 'more' : 'less'} than the 3-month. That gap ${Math.sign(parseFloat(m[3])) === Math.sign(parseFloat(m[1])) ? 'widened' : 'narrowed'} by ${m[3].replace(/^[+-]/, '')} basis points today.`; },
      dollar: d => { const m = /^DXY ([+-][\d.]+)%$/.exec(d); return m && `The dollar index ${ch(m[1], '%')}.`; },
    };
    const axes = G.axes.filter(a => AX[a.axis] && Number.isFinite(a.value));
    if (!axes.length) return null;
    const steps = axes.map((a, k) => ({ kind: 'hit', label: AX[a.axis][0], text: AX[a.axis][1](a.value), sub: (PLAIN[a.axis](String(a.detail || '')) || '').replace(/-(?=\d)/g, '−'), mood: [a.value < -.15 ? 'fall' : a.value > .15 ? 'hold' : 'calm'], data: k === 0 ? { axes, AX } : undefined }));
    const gloss = String(G.gloss || '').split(/(?<=\.)\s/)[0];
    steps.push({ kind: 'so', text: `${(G.title || G.label || 'Mixed').replace(/^./, c => c.toUpperCase())}. ${gloss}`.trim(), mood: ['calm'] });
    steps.push({ ...METHOD, text: 'Five measures from today’s own prices.', sub: 'Each is scored from pulling back to reaching for risk. It describes today. It doesn’t forecast.' });
    return { key: 'regime', title: 'Today’s market mood', pictures: [{ type: 'compass', steps: steps.map((_, k) => k) }], steps };
  }
  RD.picture('compass', (el, ctx, K) => {
    const { axes, AX } = ctx.steps[0].data, cx = 470, half = 300, rh = 74, top = 70, aS = K.at(ctx, 'so');
    el('line', { x1: cx, x2: cx, y1: top - 30, y2: top + axes.length * rh - 10, class: 'axis' }, { at: 0 });
    el('text', { x: cx - half, y: top - 36, class: 'mut' }, { text: 'Pulling back', at: 0 }); el('text', { x: cx + half, y: top - 36, 'text-anchor': 'end', class: 'mut' }, { text: 'Reaching for risk', at: 0 });
    axes.forEach((a, k) => {
      const y = top + k * rh, v = Math.max(-1, Math.min(1, a.value)), wd = Math.abs(v) * half, col = v < -.15 ? 'var(--down)' : v > .15 ? 'var(--up)' : 'var(--ink2)';
      el('text', { x: 20, y: y + 24, class: 'lab', style: 'font-size:17px' }, { text: AX[a.axis][0], at: k, dim: [] });
      el('rect', { x: cx - half, y: y + 8, width: half * 2, height: 26, rx: 3, fill: 'rgba(var(--line-rgb),.05)' }, { at: k });
      el('rect', { x: v < 0 ? cx - wd : cx, y: y + 8, width: Math.max(2, wd), height: 26, rx: 3, fill: col, class: 'growx ' + (v < 0 ? 'neg' : 'pos') }, { at: k, d: .15 });
    });
    el('text', { x: cx, y: top + axes.length * rh + 30, 'text-anchor': 'middle', class: 'head' }, { text: ctx.steps[aS]?.text.split('.')[0] || '', at: aS, d: .2 });
  });

  // ---------- shared by the checks below ----------
  const list = a => (a.length < 2 ? a[0] || '' : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), r0 = v => String(Math.round(v)), sgn = v => (v >= 0 ? '+' : '−');
  const lo1 = s => s[0].toLowerCase() + s.slice(1);
  const day = s => new Date(String(s).slice(0, 10) + 'T12:00:00Z');
  const MON = s => day(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const MONTH = s => day(s).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  // a step found by its label inside a picture, or never (99), so a picture can light or dim things at that step
  const stepOf = (ctx, label) => { const i = ctx.steps.findIndex(s => s.label === label); return i < 0 ? 99 : i; };
  const real = a => a.filter(s => s < 99);
  const plays = steps => [{ type: steps[0].pic, steps: steps.map((_, k) => k) }];

  // ---------- Markets moving together: the closest pairs as a web ----------
  function together() {
    const T = DP.together; if (!T?.length) return null;
    const pos = T.filter(t => !t.opposite).sort((a, b) => b.corr - a.corr), neg = T.filter(t => t.opposite).sort((a, b) => a.corr - b.corr);
    const top = pos[0]; if (!top) return null;
    const n = top.sessions, deg = {};
    pos.forEach(t => { deg[t.a] = (deg[t.a] || 0) + 1; deg[t.b] = (deg[t.b] || 0) + 1; });
    const [hub, hn] = Object.entries(deg).sort((a, b) => b[1] - a[1])[0];
    const mates = hn >= 2 ? pos.filter(t => t.a === hub || t.b === hub).map(t => (t.a === hub ? t.b : t.a)) : [];
    const o = neg[0], strong = o && Math.abs(o.corr) >= .3;
    const steps = [{ kind: 'hit', label: 'Most in step', pic: 'web', text: `${top.a} and ${top.b} rise and fall together more than any other pair.`,
      sub: `A link of ${f2(top.corr)} over ${n} sessions, where 1 would be lockstep.`, mood: ['hold'], data: { T, top, hub: mates.length ? hub : null, mates, o } }];
    if (mates.length) steps.push({ kind: 'held', label: 'The middle', text: `${hub} is in ${w(hn)} of the ${w(pos.length)} closest pairs.`, sub: `${list(mates)} ${mates.length > 2 ? 'all' : 'both'} move with it.` });
    if (o) steps.push({ kind: 'hit', label: 'Most opposite', text: `${o.a} and ${o.b} tend to move apart${strong ? '' : ', but only weakly'}.`, sub: `A link of −${f2(Math.abs(o.corr))}. Below zero means opposite.`, mood: ['fall'] });
    steps.push({ kind: 'so', mood: ['calm'], text: `${mates.length ? `When ${hub} moves, ${list(mates)} have usually moved with it.` : `When ${top.a} moves, ${top.b} has usually moved with it.`} ${strong ? `${o.a} and ${o.b} have tended to move in opposite directions.` : 'Nothing here reliably moves in the opposite direction.'}` });
    steps.push({ ...METHOD, text: 'Moving together isn’t one causing the other.', sub: `Each link is how closely two markets’ daily moves tracked over the last ${n} sessions. 1 is lockstep, 0 is no link, below 0 is opposite.` });
    return { key: 'together', title: 'Markets moving together', pictures: plays(steps), steps };
  }
  RD.picture('web', (el, ctx) => {
    const { T, top, hub, mates, o } = ctx.steps[0].data, sM = stepOf(ctx, 'The middle'), sO = stepOf(ctx, 'Most opposite');
    const names = [...new Set(T.flatMap(t => [t.a, t.b]))], cx = 410, cy = 270, rx = 290, ry = 210;
    // Seat names so linked ones sit side by side (fewer crossings); the middle name, if there is one, goes in the middle.
    const adj = new Map(names.map(m => [m, []])); T.forEach(t => { adj.get(t.a).push(t); adj.get(t.b).push(t); });
    const seat = [], seen = new Set(hub ? [hub] : []);
    const visit = (m, posOnly) => { if (seen.has(m)) return; seen.add(m); seat.push(m); adj.get(m).filter(t => !posOnly || !t.opposite).forEach(t => visit(t.a === m ? t.b : t.a, posOnly)); };
    (hub ? mates : [top.a]).forEach(m => visit(m, true)); names.forEach(m => visit(m, true));
    const P = new Map(seat.map((m, k) => { const a = -Math.PI / 2 + (k + .5) / seat.length * Math.PI * 2; return [m, { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }]; }));
    if (hub) P.set(hub, { x: cx, y: cy });
    const hubSet = new Set(hub ? [hub, ...mates] : []), has = (t, m) => t.a === m || t.b === m;
    T.forEach((t, k) => {
      const A = P.get(t.a), B = P.get(t.b), first = t === top;
      const dim = real([first ? 99 : 0, hub && !has(t, hub) ? sM : 99, t !== o ? sO : 99]);
      // a link that would run through the middle name bows around it, so it can't read as a link to that name
      const H = hub && !has(t, hub) ? P.get(hub) : null, len = Math.hypot(B.x - A.x, B.y - A.y);
      const near = H && Math.abs((B.x - A.x) * (A.y - H.y) - (A.x - H.x) * (B.y - A.y)) / len < 40;
      const mx = (A.x + B.x) / 2 - (near ? (B.y - A.y) / len * 90 : 0), my = (A.y + B.y) / 2 + (near ? (B.x - A.x) / len * 90 : 0);
      const line = { d: `M${A.x} ${A.y} Q${2 * mx - (A.x + B.x) / 2} ${2 * my - (A.y + B.y) / 2} ${B.x} ${B.y}`, fill: 'none', stroke: t.opposite ? 'var(--down)' : 'var(--glow)', 'stroke-width': (1 + Math.abs(t.corr) * 7).toFixed(1), 'stroke-linecap': 'round', opacity: .85 };
      el('path', t.opposite ? { ...line, 'stroke-dasharray': '4 9' } : { ...line, pathLength: 1, class: 'draw' }, { at: first ? 0 : t.opposite ? sO : 1, d: .2 + k * .07, dim });
      if (first || t === o) el('text', { x: mx, y: my - 12, 'text-anchor': 'middle', class: 'mut', style: 'font-family:var(--display)' },
        { text: `${t.corr < 0 ? '−' : ''}${f2(Math.abs(t.corr))}`, at: first ? 0 : sO, d: .8, until: first ? 0 : sO });
    });
    names.forEach(m => {
      const p = P.get(m), side = m === hub || p.x < cx - 20 ? 'end' : p.x > cx + 20 ? 'start' : 'middle', dx = side === 'end' ? (m === hub ? -22 : -16) : side === 'start' ? 16 : 0, dy = side === 'middle' ? (p.y <= cy ? -20 : 30) : m === hub ? 26 : 6;
      const dim = real([has(top, m) ? 99 : 0, hub && !hubSet.has(m) ? sM : 99, o && !has(o, m) ? sO : 99]);
      el('circle', { cx: p.x, cy: p.y, r: 6, fill: 'var(--ink)', class: 'pop' }, { at: 0, d: .05, dim });
      el('text', { x: p.x + dx, y: p.y + dy, 'text-anchor': side, class: 'lab', style: 'font-size:17px' }, { text: m, at: 0, d: .1, dim });
    });
    if (hub) el('circle', { cx: P.get(hub).x, cy: P.get(hub).y, r: 14, fill: 'none', stroke: 'var(--glow)', 'stroke-width': 2 }, { at: sM, d: .3 });
  });

  // ---------- Stocks breaking from their group: each stock against its group, on one scale ----------
  const GN = { 'Nasdaq 100': 'the Nasdaq 100', 'Tech Sector': 'the tech sector', Semiconductors: 'chip stocks', 'S&P 500': 'the S&P 500' };
  const gn = l => GN[l] || l;
  const rel = a => ((a.move >= 0) !== (a.vs_move >= 0) ? `${a.move >= 0 ? 'rose' : 'fell'} while ${gn(a.vs)} ${a.vs_move >= 0 ? 'rose' : 'fell'}`
    : a.move >= 0 ? `rose ${a.gap >= 0 ? 'more' : 'less'} than ${gn(a.vs)}` : `fell ${a.gap >= 0 ? 'less' : 'harder'} than ${gn(a.vs)}`);
  function against() {
    const A = DP.against; if (!A?.length) return null;
    const top = [...A].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0], beat = A.filter(a => a.gap >= 0).length;
    const by = {}; A.forEach(a => (by[a.vs + '|' + rel(a)] ||= []).push(a));
    const groups = Object.values(by).filter(g => g.length >= 2).sort((a, b) => b.length - a.length).slice(0, 2);
    const steps = [
      { kind: 'hit', label: 'The biggest break', pic: 'gaps', text: `${top.label} ${top.move >= 0 ? 'rose' : 'fell'} ${f2(Math.abs(top.move))}% while ${gn(top.vs)} ${top.vs_move >= 0 ? 'rose' : 'fell'} ${f2(Math.abs(top.vs_move))}%.`,
        sub: `A gap of ${f1(Math.abs(top.gap))} points.`, mood: [top.gap >= 0 ? 'hold' : 'fall'], data: { A, top, groups } },
      { kind: 'held', label: 'All of them', text: `${W(A.length)} stock${A.length > 1 ? 's' : ''} broke from ${A.length > 1 ? 'their groups' : 'its group'} today.`,
        sub: beat === A.length ? 'All of them did better than their group.' : !beat ? 'All of them did worse than their group.' : `${W(beat)} did better than their group and ${w(A.length - beat)} did worse.` },
    ];
    if (groups.length) steps.push({ kind: 'so', mood: ['calm'], text: groups.map(g => `${list(g.map(a => a.label))} ${rel(g[0])}.`).join(' ') });
    steps.push({ ...METHOD, text: 'Each stock against the group it usually moves with.', sub: 'The record has the prices, not the reasons. Check the news before guessing why.' });
    return { key: 'against', title: 'Stocks breaking from their group', pictures: plays(steps), steps };
  }
  RD.picture('gaps', (el, ctx, K) => {
    const { A, top, groups } = ctx.steps[0].data, sS = K.at(ctx, 'so'), inSo = new Set(groups.flat());
    const rows = [...A].sort((a, b) => a.vs.localeCompare(b.vs) || b.gap - a.gap);
    const all = A.flatMap(a => [a.move, a.vs_move, 0]), lo = Math.floor(Math.min(...all)) - .5, hi = Math.ceil(Math.max(...all)) + .5;
    const x0 = 300, x1 = 730, X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0), rh = Math.min(70, 430 / rows.length), y0 = 92, yEnd = y0 + rows.length * rh;
    el('line', { x1: X(0), x2: X(0), y1: y0 - 34, y2: yEnd - 26, class: 'axis' }, { at: 0 });
    el('text', { x: X(0), y: y0 - 44, 'text-anchor': 'middle', class: 'mut' }, { text: 'no change', at: 0 });
    for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) if (v) el('text', { x: X(v), y: yEnd, 'text-anchor': 'middle', class: 'mut', style: 'font-family:var(--display)' }, { text: `${sgn(v)}${Math.abs(v)}%`, at: 0 });
    el('circle', { cx: 26, cy: 26, r: 6, fill: 'none', stroke: 'rgba(var(--line-rgb),.6)', 'stroke-width': 1.5 }, { at: 0 });
    el('text', { x: 40, y: 31, class: 'mut' }, { text: 'its group', at: 0 });
    el('circle', { cx: 132, cy: 26, r: 7, fill: 'var(--ink)' }, { at: 0 });
    el('text', { x: 146, y: 31, class: 'mut' }, { text: 'the stock', at: 0 });
    rows.forEach((a, k) => {
      const y = y0 + k * rh, col = a.gap >= 0 ? 'var(--up)' : 'var(--down)', right = a.move >= a.vs_move;
      const dim = real([a === top ? 99 : 0, inSo.has(a) ? 99 : sS]);
      el('text', { x: 20, y: y + 2, class: 'lab', style: 'font-size:17px' }, { text: a.label, at: 0, dim });
      el('text', { x: 20, y: y + 22, class: 'mut', style: 'font-size:13.5px' }, { text: `${cap(gn(a.vs))} ${sgn(a.vs_move)}${f2(Math.abs(a.vs_move))}%`, at: 0, dim });
      el('line', { x1: X(a.vs_move), x2: X(a.move), y1: y, y2: y, stroke: col, 'stroke-width': 2.5, 'stroke-opacity': .65, pathLength: 1, class: 'draw' }, { at: 0, d: .35 + k * .08, dim });
      el('circle', { cx: X(a.vs_move), cy: y, r: 7, fill: 'none', stroke: 'rgba(var(--line-rgb),.6)', 'stroke-width': 1.5 }, { at: 0, d: .1 + k * .08, dim });
      el('circle', { cx: X(a.move), cy: y, r: 8, fill: col, class: 'pop' }, { at: 0, d: .7 + k * .08, dim });
      el('text', { x: X(a.move) + (right ? 15 : -15), y: y + 5, 'text-anchor': right ? 'start' : 'end', class: 'mut', style: `fill:${col};font-family:var(--display)` },
        { text: `${sgn(a.move)}${f2(Math.abs(a.move))}%`, at: 0, d: .9 + k * .08, dim });
    });
  });

  // ---------- Big tech: price vs. profit ----------
  function cost() {
    const L = INS.filter(i => i.desk === 'watchlist' && i.trailing_pe > 0 && i.sma_200 > 0 && i.price > 0)
      .map(i => ({ i, name: nm(i), pe: i.trailing_pe, run: (i.price / i.sma_200 - 1) * 100, cap: i.market_cap || 0 }));
    if (L.length < 6) return null;
    const e = [...L].sort((a, b) => b.pe - a.pe), c = [...e].reverse(), u = [...L].sort((a, b) => b.run - a.run), dn = u[u.length - 1];
    const pick = f => L.filter(f).sort((a, b) => b.pe - a.pe), its = (a, s) => (a.length > 1 ? `are${s}their averages` : `is${s}its average`);
    const hot = pick(x => x.pe >= 100 && x.run >= 25), cheapRun = pick(x => x.pe <= 20 && x.run >= 25), richDip = pick(x => x.pe >= 100 && x.run < 0);
    const say = [
      hot.length && `${list(hot.map(x => x.name))} ${its(hot, ' both expensive and well above ')}.`,
      cheapRun.length && `${list(cheapRun.map(x => x.name))} ${its(cheapRun, ' cheap on profit but still well above ')}.`,
      richDip.length && `${list(richDip.map(x => x.name))} ${its(richDip, ' expensive but below ')}.`,
    ].filter(Boolean).slice(0, 2);
    const steps = [
      { kind: 'held', label: 'The field', pic: 'scatter', text: `${W(L.length)} big tech names, each priced against a year of its profit.`,
        sub: 'Higher up costs more. Further right trades further above its average price over the last 200 days. Bigger circles are bigger companies.',
        mood: ['calm'], data: { L, sets: { 'Most expensive': e.slice(0, 3), Cheapest: c.slice(0, 3), 'Furthest above its average': [u[0], dn], so: [...hot, ...cheapRun, ...richDip] } } },
      { kind: 'hit', label: 'Most expensive', text: `${e[0].name} costs ${r0(e[0].pe)} times a year of its profit.`, sub: `${e[1].name} costs ${r0(e[1].pe)} times and ${e[2].name} ${r0(e[2].pe)}.` },
      { kind: 'held', label: 'Cheapest', text: `${c[0].name} costs ${r0(c[0].pe)} times a year of its profit.`, sub: `${c[1].name} costs ${r0(c[1].pe)} times and ${c[2].name} ${r0(c[2].pe)}.` },
      { kind: 'hit', label: 'Furthest above its average', text: `${u[0].name} trades ${r0(u[0].run)}% above its 200-day average.`,
        sub: dn.run < 0 ? `${dn.name} is furthest below, ${r0(-dn.run)}% under it.` : `Even ${dn.name}, the lowest, is ${r0(dn.run)}% above it.` },
      { kind: 'so', mood: ['calm'], text: say.length ? say.join(' ') : 'None of them is both expensive and far above its average.' },
      { ...METHOD, text: 'Price divided by the last year of profit.', sub: 'Fast growers usually cost more, so a high number isn’t a verdict on its own. Expensive here means over 100 times. Well above means 25% or more.' },
    ];
    return { key: 'cost', title: 'Big tech: price vs. profit', pictures: plays(steps), steps };
  }
  RD.picture('scatter', (el, ctx, K) => {
    const { L, sets } = ctx.steps[0].data, at = { ...Object.fromEntries(Object.keys(sets).map(k => [k, stepOf(ctx, k)])), so: K.at(ctx, 'so') };
    const runs = L.map(x => x.run), lo = Math.min(-10, Math.floor(Math.min(...runs) / 10) * 10 - 5), hi = Math.ceil(Math.max(...runs) / 10) * 10 + 5;
    const plo = Math.log10(Math.min(...L.map(x => x.pe)) * .75), phi = Math.log10(Math.max(...L.map(x => x.pe)) * 1.35);
    const x0 = 100, x1 = 770, y0 = 456, y1 = 56, X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0), Y = p => y0 - (Math.log10(p) - plo) / (phi - plo) * (y0 - y1);
    const top = Math.max(...L.map(x => x.cap)) || 1, R = x => 6 + Math.sqrt(x.cap / top) * 20;
    el('text', { x: 20, y: 26, class: 'grp' }, { text: 'Times a year of profit', at: 0 });
    el('text', { x: x1, y: y0 + 58, 'text-anchor': 'end', class: 'grp' }, { text: 'Above or below its 200-day average', at: 0 });
    [10, 20, 50, 100, 200, 500].filter(p => Math.log10(p) > plo && Math.log10(p) < phi).forEach(p => {
      el('line', { x1: x0, x2: x1, y1: Y(p), y2: Y(p), stroke: 'rgba(var(--line-rgb),.08)' }, { at: 0 });
      el('text', { x: x0 - 14, y: Y(p) + 5, 'text-anchor': 'end', class: 'mut', style: 'font-family:var(--display)' }, { text: `${p}×`, at: 0 });
    });
    el('line', { x1: X(0), x2: X(0), y1: y1 - 10, y2: y0, class: 'axis' }, { at: 0 });
    for (let v = Math.ceil(lo / 20) * 20; v <= hi; v += 20) el('text', { x: X(v), y: y0 + 28, 'text-anchor': 'middle', class: 'mut', style: 'font-family:var(--display)' }, { text: v ? `${sgn(v)}${Math.abs(v)}%` : '0', at: 0 });
    const lit = x => Object.entries(sets).filter(([, a]) => a.includes(x)).map(([k]) => at[k]);
    const later = real(Object.values(at)), boxes = [];
    const fits = b => !boxes.some(o => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h) && b.x > 0 && b.x + b.w < 820;
    [...L].sort((a, b) => b.cap - a.cap).forEach((x, k) => {
      const cx = X(x.run), cy = Y(x.pe), r = R(x), on = lit(x), dim = later.filter(s => !on.includes(s));
      el('circle', { cx, cy, r, fill: 'rgba(var(--glow-rgb),.2)', stroke: 'var(--glow)', 'stroke-width': 1.2, class: 'pop' }, { at: 0, d: .1 + k * .05, dim });
      const w8 = x.name.length * 8.6, right = { x: cx + r + 6, y: cy - 9, w: w8, h: 18 }, left = { x: cx - r - 6 - w8, y: cy - 9, w: w8, h: 18 };
      const b = fits(right) ? right : fits(left) ? left : null;
      if (b) { boxes.push(b); el('text', { x: b === right ? b.x : cx - r - 6, y: cy + 5, 'text-anchor': b === right ? 'start' : 'end', class: 'mut', style: 'font-size:14px' }, { text: x.name, at: 0, d: .5 + k * .05, dim: later }); }
    });
    Object.entries(sets).forEach(([key, a]) => {
      if (at[key] >= 99) return;
      const taken = [];
      a.forEach(x => {
        const cx = X(x.run), cy = Y(x.pe), r = R(x), text = x.name + (key === 'Most expensive' || key === 'Cheapest' ? ` ${r0(x.pe)}×` : key === 'Furthest above its average' ? ` ${sgn(x.run)}${r0(Math.abs(x.run))}%` : '');
        const wd = text.length * 9.4, opts = [{ x: cx + r + 8, y: cy, a: 'start' }, { x: cx - r - 8, y: cy, a: 'end' }, { x: cx, y: cy - r - 12, a: 'middle' }, { x: cx, y: cy + r + 22, a: 'middle' }];
        const box = o => ({ x: o.a === 'start' ? o.x : o.a === 'end' ? o.x - wd : o.x - wd / 2, y: o.y - 14, w: wd, h: 22 });
        const ok = o => { const b = box(o); return b.x > 0 && b.x + b.w < 820 && !taken.some(t => b.x < t.x + t.w && t.x < b.x + b.w && b.y < t.y + t.h && t.y < b.y + b.h); };
        const o = opts.find(ok) || opts[0]; taken.push(box(o));
        el('circle', { cx, cy, r: r + 3, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.6 }, { at: at[key], until: at[key], d: .2 });
        el('text', { x: o.x, y: o.y + 6, 'text-anchor': o.a, class: 'lab', style: 'font-size:17px;fill:var(--ink)' }, { text, at: at[key], until: at[key], d: .3 });
      });
    });
  });

  // ---------- Oil and gas stockpiles: each against the same week in recent years ----------
  const STOCK = { crude: ['Crude oil', 'crude', 'Crude oil stocks'], gasoline: ['Gasoline', 'gasoline', 'Gasoline stocks'],
    distillate: ['Diesel and heating oil', 'diesel', 'Diesel and heating oil stocks'], natgas: ['Natural gas', 'natural gas', 'Natural gas in storage'] };
  const UNIT = { 'M bbl': ['million barrels', 1], Bcf: ['billion cubic feet', 0] };
  const where = r => (r.value < r.seasonal.low ? 'low' : r.value > r.seasonal.high ? 'high' : Math.abs(r.seasonal.vs_avg_pct) < 2 ? 'normal' : 'in');
  function energy() {
    const rows = (DP.energy?.rows || []).filter(r => STOCK[r.key] && r.seasonal && Number.isFinite(r.value) && Number.isFinite(r.change));
    if (!rows.length) return null;
    const steps = rows.map((r, k) => {
      const [U, d] = UNIT[r.unit] || [r.unit, 1], v = Math.abs(r.change), p = where(r), s = r.seasonal;
      return { kind: 'hit', icon: 'held', label: STOCK[r.key][0], pic: k ? undefined : 'stocks', mood: ['calm'], data: k ? undefined : { rows },
        text: v < (d ? .05 : 1) ? `${STOCK[r.key][2]} barely moved last week.` : `${STOCK[r.key][2]} ${r.change > 0 ? 'rose' : 'fell'} ${v.toFixed(d)} ${U} last week.`,
        sub: p === 'low' ? 'That’s lower than at this point in any recent year.' : p === 'high' ? 'That’s higher than at this point in any recent year.'
          : p === 'normal' ? 'That’s close to normal for this time of year.' : `That’s ${r0(Math.abs(s.vs_avg_pct))}% ${s.vs_avg_pct < 0 ? 'below' : 'above'} normal for this time of year.` };
    });
    const of = k => rows.filter(r => where(r) === k), sh = a => cap(list(a.map(r => STOCK[r.key][1]))), low = of('low'), high = of('high'), norm = of('normal');
    const say = [low.length && `${sh(low)} stocks are lower than at this point in any recent year.`, high.length && `${sh(high)} stocks are higher than at this point in any recent year.`,
      norm.length && `${sh(norm)} ${norm.length > 1 ? 'are' : 'is'} about normal.`].filter(Boolean).slice(0, 2);
    steps.push({ kind: 'so', mood: ['calm'], text: say.length ? say.join(' ') : 'Every stockpile is inside its usual range for this time of year.' });
    steps.push({ ...METHOD, text: 'US stockpiles, reported each week by the Energy Department.', sub: `Week ending ${MON(rows[0].period)}. Each is set against the same week in recent years. The band is the range and the tick is the average.` });
    return { key: 'energy', title: 'Oil and gas stockpiles', pictures: plays(steps), steps };
  }
  RD.picture('stocks', (el, ctx, K) => {
    const { rows } = ctx.steps[0].data, sS = K.at(ctx, 'so'), rh = Math.min(112, 440 / rows.length), x0 = 330, x1 = 770;
    rows.forEach((r, k) => {
      const s = r.seasonal, was = r.value - r.change, y = 86 + k * rh, odd = ['low', 'high'].includes(where(r)), dim = odd ? [] : real([sS]);
      const lo = Math.min(s.low, r.value, was), hi = Math.max(s.high, r.value, was), pad = (hi - lo) * .12, X = v => x0 + (v - lo + pad) / (hi - lo + pad * 2) * (x1 - x0);
      const [U, d] = UNIT[r.unit] || [r.unit, 1];
      el('text', { x: 20, y: y + 2, class: 'lab', style: 'font-size:17px' }, { text: STOCK[r.key][0], at: k, dim });
      el('text', { x: 20, y: y + 23, class: 'mut', style: 'font-size:13.5px' }, { text: `${r.value.toLocaleString('en-US', { maximumFractionDigits: d })} ${U}`, at: k, dim });
      el('rect', { x: X(s.low), y: y - 8, width: Math.max(4, X(s.high) - X(s.low)), height: 16, rx: 8, fill: 'rgba(var(--line-rgb),.13)' }, { at: k, dim });
      el('line', { x1: X(s.avg), x2: X(s.avg), y1: y - 15, y2: y + 15, stroke: 'rgba(var(--line-rgb),.6)', 'stroke-width': 1.5 }, { at: k, d: .2, dim });
      if (k === 0) {
        el('text', { x: X(s.avg), y: y - 24, 'text-anchor': 'middle', class: 'mut', style: 'font-size:13px' }, { text: 'normal', at: 0, d: .3 });
        el('text', { x: X(s.low), y: y + 36, class: 'mut', style: 'font-size:13px' }, { text: 'range in recent years', at: 0, d: .3 });
      }
      el('circle', { cx: X(was), cy: y, r: 5, fill: 'none', stroke: 'rgba(var(--line-rgb),.5)', 'stroke-width': 1.2 }, { at: k, d: .3, dim });
      el('line', { x1: X(was), x2: X(r.value), y1: y, y2: y, stroke: 'var(--glow)', 'stroke-width': 2, 'stroke-opacity': .6, pathLength: 1, class: 'draw' }, { at: k, d: .45, dim });
      el('circle', { cx: X(r.value), cy: y, r: 8, fill: odd ? 'var(--glow)' : 'var(--ink)', class: 'pop' }, { at: k, d: .8, dim });
      if (odd) el('text', { x: X(r.value), y: y + 32, 'text-anchor': 'middle', class: 'mut', style: 'font-size:13px;fill:var(--glow)' }, { text: where(r) === 'low' ? 'lowest in years' : 'highest in years', at: k, d: 1 });
    });
  });

  // ---------- US housing market: five readings, before and latest ----------
  const HOUSE = {
    MORTGAGE30US: { label: 'Mortgage rates', buyers: -1, fmt: v => `${f2(v)}%`,
      say: r => `The 30-year mortgage rate ${r.change ? `${r.change > 0 ? 'rose' : 'fell'} to ${f2(r.value)}%, from ${f2(r.prior)}%` : `held at ${f2(r.value)}%`}.`, sub: r => `Freddie Mac’s weekly average, ${MON(r.as_of)}.` },
    MSACSR: { label: 'New homes for sale', buyers: 1, fmt: v => `${f1(v)} months`,
      say: r => `Supply of new homes ${r.change ? `${r.change > 0 ? 'rose' : 'fell'} to ${f1(r.value)} months, from ${f1(r.prior)}` : `held at ${f1(r.value)} months`}.`, sub: r => `How long the homes for sale would last at the pace they’re selling. ${MONTH(r.as_of)}.` },
    HOUST: { label: 'Homes started', buyers: 1, fmt: v => `${f2(v / 1000)}M`,
      say: r => `Builders started homes at a pace of ${f2(r.value / 1000)} million a year${r.change ? `, ${r.change > 0 ? 'up' : 'down'} from ${f2(r.prior / 1000)} million` : ''}.`, sub: r => `${MONTH(r.as_of)}, counted at a yearly pace.` },
    CSUSHPINSA: { label: 'Home prices', buyers: -1, fmt: v => f1(v),
      say: r => `Home prices ${r.change ? `${r.change > 0 ? 'rose' : 'fell'} ${f1(Math.abs(r.change / r.prior * 100))}%` : 'held still'} in ${MONTH(r.as_of)}.`, sub: () => 'The Case-Shiller national price index.' },
    RRVRUSQ156N: { label: 'Rentals', buyers: 1, fmt: v => `${f1(v)}%`,
      say: r => `${f1(r.value)}% of rental homes stood empty${r.change ? `, ${r.change > 0 ? 'up' : 'down'} from ${f1(r.prior)}%` : ', unchanged'}.`, sub: r => `Counted once a quarter. This is the quarter from ${MONTH(r.as_of)}.` },
  };
  const verdict = r => (!r.change || !HOUSE[r.series] ? 0 : Math.sign(r.change) * HOUSE[r.series].buyers);
  function housing() {
    const rows = (DP.real_estate?.rows || []).filter(r => HOUSE[r.series] && Number.isFinite(r.value) && Number.isFinite(r.prior));
    if (!rows.length) return null;
    const steps = rows.map((r, k) => ({ kind: 'hit', icon: 'held', label: HOUSE[r.series].label, pic: k ? undefined : 'slopes', data: k ? undefined : { rows },
      text: HOUSE[r.series].say(r), sub: HOUSE[r.series].sub(r), mood: [verdict(r) < 0 ? 'fall' : verdict(r) > 0 ? 'hold' : 'calm'] }));
    const worse = rows.filter(r => verdict(r) < 0), better = rows.filter(r => verdict(r) > 0), held = rows.filter(r => !r.change), lab = a => list(a.map(r => lo1(HOUSE[r.series].label)));
    steps.push({ kind: 'so', mood: ['calm'], text: `${worse.length ? W(worse.length) : 'None'} of ${w(rows.length)} readings moved against people looking for a home.${better.length ? ` ${cap(lab(better))} moved their way.` : held.length ? ` Only ${lab(held)} held still.` : ''}` });
    steps.push({ ...METHOD, text: 'The national market, from the St. Louis Fed.', sub: 'Each reading is the latest against the one before. They come out on different schedules, so the dates differ.' });
    return { key: 'housing', title: 'US housing market', pictures: plays(steps), steps };
  }
  RD.picture('slopes', (el, ctx) => {
    const { rows } = ctx.steps[0].data, rh = Math.min(84, 430 / rows.length), y0 = 104, xb = 420, xa = 450, xz = 590, xl = 612;
    el('text', { x: xb, y: 52, 'text-anchor': 'end', class: 'grp' }, { text: 'Before', at: 0 });
    el('text', { x: xl, y: 52, class: 'grp' }, { text: 'Latest', at: 0 });
    el('text', { x: 800, y: 52, 'text-anchor': 'end', class: 'grp' }, { text: 'As of', at: 0 });
    rows.forEach((r, k) => {
      const H = HOUSE[r.series], y = y0 + k * rh, v = verdict(r), col = v > 0 ? 'var(--up)' : v < 0 ? 'var(--down)' : 'rgba(var(--line-rgb),.45)';
      el('text', { x: 20, y: y + 6, class: 'lab', style: 'font-size:17px' }, { text: H.label, at: k });
      el('text', { x: xb, y: y + 6, 'text-anchor': 'end', class: 'mut', style: 'font-family:var(--display);font-size:16px' }, { text: H.fmt(r.prior), at: k, d: .1 });
      el('line', { x1: xa, x2: xz, y1: y, y2: y, stroke: col, 'stroke-width': 2.5, pathLength: 1, class: 'draw' }, { at: k, d: .25 });
      el('path', { d: `M${xz - 9} ${y - 6} L${xz} ${y} L${xz - 9} ${y + 6}`, fill: 'none', stroke: col, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, { at: k, d: .9 });
      el('text', { x: xl, y: y + 7, class: 'num', style: `font-size:21px;fill:${v ? col : 'var(--ink)'}` }, { text: H.fmt(r.value), at: k, d: 1 });
      el('text', { x: 800, y: y + 6, 'text-anchor': 'end', class: 'mut' }, { text: r.series === 'MORTGAGE30US' ? MON(r.as_of) : MONTH(r.as_of), at: k, d: .1 });
    });
  });

  // ---------- African economies: today's currencies, then what each country supplies ----------
  const AFX = { 'USD/ZAR': 'South Africa', 'USD/NGN': 'Nigeria', 'USD/EGP': 'Egypt', 'USD/KES': 'Kenya' };
  const SUPPLY = { 'South Africa': 'Most of the world’s platinum', Egypt: 'The Suez Canal, and wheat imports', Nigeria: 'Crude oil', Morocco: 'Phosphate for fertilizer',
    Kenya: 'Tea, flowers and East African trade', Ethiopia: 'Coffee', Angola: 'Crude oil, much of it to China', Ghana: 'Cocoa and gold', "Côte d'Ivoire": 'More cocoa than anywhere', Tanzania: 'Gold, and a trade route inland' };
  const WHY = { 'South Africa': 'South Africa mines most of the world’s platinum.', Egypt: 'Egypt runs the Suez Canal and buys more wheat than any other country.',
    Nigeria: 'Nigeria is one of Africa’s biggest oil exporters.', Kenya: 'Kenya is East Africa’s main trade hub.' };
  // a currency's own move against the dollar: USD/KES up 0.79% means the shilling lost 0.78%
  const curMove = q => (/^USD\//.test(q.label) ? (100 / (100 + q.change_pct) - 1) * 100 : q.change_pct);
  const curName = q => { const p = pair(q); return p ? (p[0] === 'dollar' ? p[1] : p[0]) : q.label; };
  function africa() {
    const A = DP.africa; if (!A?.countries?.length) return null;
    const C = A.countries, fx = (A.fx || []).filter(q => q.change_pct != null && AFX[q.label]), mk = A.markets || [];
    const steps = [];
    if (fx.length) {
      const top = [...fx].sort((a, b) => Math.abs(curMove(b)) - Math.abs(curMove(a)))[0], v = curMove(top), rest = fx.filter(q => q !== top);
      steps.push({ kind: 'hit', label: 'Currencies today', text: `The ${curName(top)} ${v < 0 ? 'slipped' : 'firmed'} ${f2(Math.abs(v))}% against the dollar.`, mood: [v < 0 ? 'fall' : 'hold'],
        sub: rest.length ? `${cap(list(rest.map(q => `the ${curName(q)} ${Math.abs(curMove(q)) < .05 ? 'held' : curMove(q) < 0 ? 'slipped' : 'firmed'}`)))}.` : '' });
    }
    const j = mk.find(m => m.label === 'South Africa 40'), afk = mk.find(m => m.label === 'Africa ex-SA ETF');
    if (j?.change_pct != null) steps.push({ kind: 'held', label: 'Stocks', text: `South Africa’s 40 biggest companies ${j.change_pct >= 0 ? 'rose' : 'fell'} ${f2(Math.abs(j.change_pct))}%.`,
      sub: afk?.change_pct != null ? `A fund of African stocks outside South Africa ${Math.abs(afk.change_pct) < .05 ? 'was flat' : `${afk.change_pct > 0 ? 'rose' : 'fell'} ${f2(Math.abs(afk.change_pct))}%`}.` : '' });
    steps.push({ kind: 'world', label: 'What each supplies', text: `${W(C.length)} economies, and what each one supplies the world.`, sub: 'Platinum, oil, cocoa, coffee and the Suez Canal. This is why a move here can travel.' });
    const g = C.filter(c => c.growth != null), inf = C.filter(c => c.inflation != null);
    const fast = [...g].sort((a, b) => b.growth - a.growth)[0], hot = [...inf].sort((a, b) => b.inflation - a.inflation)[0];
    if (fast && hot) steps.push({ kind: 'held', label: 'Growth and prices', text: `${fast.name.replace("'", '’')} grew fastest in ${fast.growth_year || A.source_year}, ${f1(fast.growth)}%.`, sub: `${hot.name.replace("'", '’')} had the highest inflation, ${f1(hot.inflation)}%.` });
    if (fx.length) { const top = [...fx].sort((a, b) => Math.abs(curMove(b)) - Math.abs(curMove(a)))[0];
      if (WHY[AFX[top.label]]) steps.push({ kind: 'so', mood: ['calm'], text: `The ${curName(top)} moved most today. ${WHY[AFX[top.label]]}` }); }
    steps.push({ ...METHOD, text: 'Currencies and stocks are today’s. Growth and inflation are the World Bank’s yearly figures.', sub: 'The yearly figures explain why a currency move matters. They don’t explain today’s move.' });
    steps[0].pic = 'africa'; steps[0].data = { C, fx, j, fast, hot };
    return { key: 'africa', title: 'African economies', pictures: plays(steps), steps };
  }
  RD.picture('africa', (el, ctx, K) => {
    const { C, fx, j, fast, hot } = ctx.steps[0].data, sC = stepOf(ctx, 'Currencies today'), sK = stepOf(ctx, 'Stocks'), sW = stepOf(ctx, 'What each supplies'), sG = stepOf(ctx, 'Growth and prices'), sS = K.at(ctx, 'so');
    const fxOf = new Map(fx.map(q => [AFX[q.label], q])), top = [...fx].sort((a, b) => Math.abs(curMove(b)) - Math.abs(curMove(a)))[0];
    const rh = Math.min(46, 450 / C.length), y0 = 82, start = Math.min(sC, sK, sW);
    el('text', { x: 200, y: 40, class: 'grp' }, { text: 'Supplies', at: sW });
    el('text', { x: 545, y: 40, 'text-anchor': 'end', class: 'grp' }, { text: 'Growth', at: sG });
    el('text', { x: 640, y: 40, 'text-anchor': 'end', class: 'grp' }, { text: 'Inflation', at: sG });
    el('text', { x: 805, y: 40, 'text-anchor': 'end', class: 'grp' }, { text: 'Today', at: Math.min(sC, sK) });
    C.forEach((c, k) => {
      const y = y0 + k * rh, q = fxOf.get(c.name), isSA = c.name === 'South Africa', mover = top && AFX[top.label] === c.name;
      const dim = real([q ? 99 : sC, isSA ? 99 : sK, mover ? 99 : sS]);
      el('text', { x: 20, y, class: 'lab', style: 'font-size:16.5px' }, { text: c.name.replace("'", '’'), at: start, d: k * .04, dim });
      el('text', { x: 200, y, class: 'mut', style: 'font-size:14.5px' }, { text: SUPPLY[c.name] || '', at: sW, d: .1 + k * .05, dim: real([mover ? 99 : sS]) });
      if (c.growth != null) el('text', { x: 545, y, 'text-anchor': 'end', class: 'mut', style: `font-family:var(--display);font-size:15px${c === fast ? ';fill:var(--up)' : ''}` }, { text: `${f1(c.growth)}%`, at: sG, d: .1 + k * .04, dim: real([mover ? 99 : sS]) });
      if (c.inflation != null) el('text', { x: 640, y, 'text-anchor': 'end', class: 'mut', style: `font-family:var(--display);font-size:15px${c === hot ? ';fill:var(--down)' : ''}` }, { text: `${f1(c.inflation)}%`, at: sG, d: .15 + k * .04, dim: real([mover ? 99 : sS]) });
      if (q) { const v = curMove(q); el('text', { x: 805, y, 'text-anchor': 'end', class: 'num', style: `font-size:16px;fill:${v < 0 ? 'var(--down)' : 'var(--up)'}` }, { text: `${curName(q).split(' ').pop()} ${sgn(v)}${f2(Math.abs(v))}%`, at: sC, d: .3 + k * .04, dim }); }
      if (isSA && j?.change_pct != null) el('text', { x: 805, y: y + (q ? 17 : 0), 'text-anchor': 'end', class: 'mut', style: 'font-size:13px' }, { text: `stocks ${sgn(j.change_pct)}${f2(Math.abs(j.change_pct))}%`, at: sK, d: .3, dim: real([sS]) });
    });
  });

  // ---------- Sports: where the books disagree, and the tradition's picks ----------
  function sport() {
    const G = (DP.sporting?.rows || []).slice(0, 8); if (!G.length) return null;
    const AP = DP.astro_picks || {}, P = AP.picks || [], rec = AP.record || {};
    const top = [...G].sort((a, b) => (b.disagreement || 0) - (a.disagreement || 0))[0], bySport = {};
    G.forEach(g => { bySport[g.sport] = (bySport[g.sport] || 0) + 1; });
    const steps = [
      { kind: 'held', label: 'The games', pic: 'games', text: `The books priced ${w(G.length)} game${G.length > 1 ? 's' : ''}.`, sub: `${cap(list(Object.entries(bySport).map(([s, n]) => `${w(n)} ${s}`)))}.`, mood: ['calm'], data: { G, top, P } },
      { kind: 'hit', label: 'Where they disagree', text: `The books disagree most on ${top.matchup}.`, sub: `Most favor the ${top.favourite}, but their prices are furthest apart here.` },
    ];
    if (P.length) { const vs = P.filter(p => !p.agreed_with_market).length;
      steps.push({ kind: 'trad', label: 'The tradition’s picks', text: `The tradition picked ${w(P.length)} game${P.length > 1 ? 's' : ''}${vs ? `, and went against the books on ${w(vs)}` : ', all with the books'}.`, sub: `${P.slice(0, 2).map(p => `${p.picked} over ${p.opponent}`).join('. ')}.` }); }
    if (rec.n) steps.push({ kind: 'trad', label: 'Its score', text: `It has made ${rec.n} picks. ${rec.graded ? `${W(rec.hits || 0)} of ${w(rec.graded)} graded came true.` : 'None have been graded yet.'}`,
      sub: rec.grading_status === 'off' ? 'Grading is paused while the odds feed is off.' : 'A coin gets about half.' });
    steps.push({ ...METHOD, text: 'The books’ consensus on each game, and how far apart they are.', sub: 'The tradition’s picks come from name numerology and the day’s sky. These systems have no shown power over sport, so every pick is graded.' });
    return { key: 'sport', title: 'Sports', pictures: plays(steps), steps };
  }
  RD.picture('games', (el, ctx) => {
    const { G, top, P } = ctx.steps[0].data, sD = stepOf(ctx, 'Where they disagree'), sT = stepOf(ctx, 'The tradition’s picks');
    const pickOf = new Map(P.map(p => [p.matchup, p])), mx = Math.max(3, ...G.map(g => (g.disagreement || 0) * 1.15)), x0 = 470, x1 = 780, X = v => x0 + v / mx * (x1 - x0);
    const rh = Math.min(62, 440 / G.length), y0 = 86;
    el('text', { x: x0, y: 40, class: 'grp' }, { text: 'Books agree', at: 0 }); el('text', { x: x1, y: 40, 'text-anchor': 'end', class: 'grp' }, { text: 'Books split', at: 0 });
    el('line', { x1: x0, x2: x1, y1: 54, y2: 54, class: 'axis' }, { at: 0 });
    G.forEach((g, k) => {
      const y = y0 + k * rh, p = pickOf.get(g.matchup), dim = real([g === top ? 99 : sD]);
      el('text', { x: 20, y, class: 'lab', style: 'font-size:16px' }, { text: g.matchup, at: 0, d: k * .05, dim });
      el('text', { x: 20, y: y + 20, class: 'mut', style: 'font-size:13.5px' }, { text: `${g.sport}, favors the ${g.favourite}`, at: 0, d: k * .05, dim });
      el('line', { x1: x0, x2: x1, y1: y - 5, y2: y - 5, stroke: 'rgba(var(--line-rgb),.08)' }, { at: 0, dim });
      el('circle', { cx: X(g.disagreement || 0), cy: y - 5, r: 4 + (g.books || 4) / 2, fill: g === top ? 'var(--glow)' : 'rgba(var(--line-rgb),.55)', class: 'pop' }, { at: 0, d: .3 + k * .06, dim });
      if (p) el('text', { x: x0, y: y + 20, class: 'mut', style: 'font-size:13.5px;fill:var(--mauve)' }, { text: `Tradition: ${p.picked}${p.agreed_with_market ? '' : ', against the books'}`, at: sT, d: .2 + k * .06 });
    });
  });

  // ---------- Who's reporting what: every outlet, left to right ----------
  const LEANS = [['left', 'Left'], ['lean-left', 'Lean left'], ['center', 'Center'], ['lean-right', 'Lean right'], ['right', 'Right'], ['straight', 'Wire']];
  function sources() {
    const H = X.headlines || [], F = DP.feeds || []; if (!H.length || !F.length) return null;
    const g = {}, cnt = {}; H.forEach(h => { (g[h.story] ||= new Set()).add(h.source); cnt[h.source] = (cnt[h.source] || 0) + 1; });
    const shared = H.filter(h => g[h.story].size > 1), live = F.filter(f => cnt[f.name]).length, sharedBy = new Set(shared.map(h => h.source));
    const [story, outlets] = Object.entries(g).sort((a, b) => b[1].size - a[1].size)[0], title = H.find(h => String(h.story) === story)?.title || '';
    const LG = { left: 'left', 'lean-left': 'left', center: 'center', 'lean-right': 'right', right: 'right' }, t = { left: 0, center: 0, right: 0, wire: 0 };
    H.forEach(h => { t[LG[h.lean] || 'wire']++; });
    const LN = { left: 'Left-leaning', center: 'Center', right: 'Right-leaning', wire: 'Wire and market desks' }, order = Object.entries(t).sort((a, b) => b[1] - a[1]);
    const single = Math.round((H.length - shared.length) / H.length * 10);
    const steps = [
      { kind: 'held', label: 'Who reported', pic: 'spectrum', text: `${W(live)} of ${w(F.length)} outlets had stories in this edition, ${H.length} in all.`, sub: 'Each dot is an outlet, placed by its lean. Bigger dots ran more stories.', mood: ['calm'],
        data: { F, cnt, sharedBy, outlets: outlets.size > 1 ? outlets : new Set() } },
      { kind: 'hit', label: 'Shared stories', text: `Only ${shared.length} of ${H.length} headlines covered a story another outlet also ran.`, sub: 'The lit outlets ran at least one of them.' },
    ];
    if (outlets.size > 1) steps.push({ kind: 'news', label: 'The widest story', text: `The most widely carried story ran at ${w(outlets.size)} outlets.`, sub: `“${title}”` });
    steps.push({ kind: 'held', label: 'By lean', text: `${LN[order[0][0]]} outlets carried the most, ${order[0][1]} stories.`.replace('desks outlets', 'desks'),
      sub: order.slice(1).map(([k, v]) => `${LN[k]}: ${v}.`).join(' ') });
    steps.push({ kind: 'so', mood: ['calm'], text: `${single >= 10 ? 'Almost every headline' : `${W(single)} in ten headlines`} covered a story only one outlet ran. What an outlet chooses to cover is its own kind of lean.` });
    steps.push({ ...METHOD, text: 'Lean labels follow AllSides and Ad Fontes Media.', sub: 'They aren’t filters. A feed whose newest story is more than four days old is dropped.' });
    return { key: 'sources', title: 'Who’s reporting what', pictures: plays(steps), steps };
  }
  RD.picture('spectrum', (el, ctx) => {
    const { F, cnt, sharedBy, outlets } = ctx.steps[0].data, sH = stepOf(ctx, 'Shared stories'), sW = stepOf(ctx, 'The widest story'), sL = stepOf(ctx, 'By lean');
    const xs = [100, 228, 380, 532, 650, 770], base = 440, gap = 25;
    const pos = new Map(); let hubX = 0;
    LEANS.forEach(([lean, label], c) => {
      const col = F.filter(f => (f.lean in { left: 1, 'lean-left': 1, center: 1, 'lean-right': 1, right: 1 } ? f.lean : 'straight') === lean).sort((a, b) => (cnt[b.name] || 0) - (cnt[a.name] || 0));
      const two = col.length > 15, tot = col.reduce((a, f) => a + (cnt[f.name] || 0), 0);
      el('text', { x: xs[c], y: base + 46, 'text-anchor': 'middle', class: 'grp' }, { text: label, at: 0 });
      el('text', { x: xs[c], y: base + 72, 'text-anchor': 'middle', class: 'num', style: 'font-size:18px' }, { text: String(tot), at: sL, d: .1 + c * .08 });
      col.forEach((f, k) => {
        const n = cnt[f.name] || 0, x = xs[c] + (two ? (k % 2 ? 15 : -15) : 0), y = base - (two ? Math.floor(k / 2) : k) * gap;
        pos.set(f.name, { x, y });
        const dim = real([sharedBy.has(f.name) ? 99 : sH, outlets.has(f.name) ? 99 : sW]);
        el('circle', { cx: x, cy: y, r: n ? 3.5 + Math.sqrt(n) * 1.7 : 4, fill: n ? 'rgba(var(--line-rgb),.6)' : 'none', stroke: 'rgba(var(--line-rgb),.45)', 'stroke-width': n ? 0 : 1.2, class: 'pop' }, { at: 0, d: .05 + k * .03, dim });
        if (sharedBy.has(f.name)) el('circle', { cx: x, cy: y, r: 3.5 + Math.sqrt(n) * 1.7, fill: 'var(--glow)' }, { at: sH, d: .2 + k * .03, dim: real([outlets.has(f.name) ? 99 : sW]) });
      });
    });
    const W8 = [...outlets].map(o => pos.get(o)).filter(Boolean); if (!W8.length || sW >= 99) return;
    hubX = W8.reduce((a, p) => a + p.x, 0) / W8.length;
    const hub = { x: hubX, y: 34 };
    el('circle', { cx: hub.x, cy: hub.y, r: 5, fill: 'var(--glow)' }, { at: sW, until: sW, d: .2 });
    [...outlets].forEach((o, k) => { const p = pos.get(o); if (!p) return;
      el('path', { d: `M${p.x} ${p.y} C${p.x} ${(p.y + hub.y) / 2}, ${hub.x} ${(p.y + hub.y) / 2 + 40}, ${hub.x} ${hub.y}`, fill: 'none', stroke: 'var(--glow)', 'stroke-width': 1.4, 'stroke-opacity': .55, pathLength: 1, class: 'draw' }, { at: sW, until: sW, d: .3 + k * .1 });
      const left = p.x > 700;
      el('text', { x: p.x + (left ? -14 : 14), y: p.y + 5, 'text-anchor': left ? 'end' : 'start', class: 'lab', style: 'font-size:13.5px;fill:var(--ink)' }, { text: o.replace(/\s*\(.*\)$/, ''), at: sW, until: sW, d: .9 + k * .1 });
    });
  });

  // ---------- How our calls did ----------
  function record() {
    const R = KD.record; if (!R?.claims?.length || !R.graded_dedup) return null;
    const C = R.claims.filter(c => !c.duplicate).sort((a, b) => a.made_on.localeCompare(b.made_on)), open = C.filter(c => c.correct == null), rate = R.hits_dedup / R.graded_dedup;
    const DN = { up: 'Up calls', down: 'Down calls', flat: 'Flat calls' };
    const dir = ['up', 'down', 'flat'].map(d => { const g = C.filter(c => c.direction === d && c.correct != null); return { d, n: g.length, hit: g.filter(c => c.correct === 1).length }; }).filter(x => x.n);
    const best = [...dir].sort((a, b) => b.hit / b.n - a.hit / a.n || b.n - a.n)[0];
    const symName = (s, first) => { const i = bySym.get(s); return i ? (first ? nm(i) : mid(i)) : s; };
    const steps = [
      { kind: 'hit', label: 'The score', pic: 'tally', text: `${W(R.hits_dedup)} of ${w(R.graded_dedup)} calls came true.`, mood: [rate >= .5 ? 'hold' : 'fall'],
        sub: `Each call is counted once.${open.length ? ` ${W(open.length)} more ${open.length > 1 ? 'are' : 'is'} still open.` : ''}`, data: { C, dir } },
      { kind: 'held', label: 'Against a coin', text: `That’s ${r0(rate * 100)}%. A coin flip gets about half.` },
    ];
    if (dir.length > 1) steps.push({ kind: 'held', label: 'By direction', text: `${DN[best.d]} did best: ${w(best.hit)} of ${w(best.n)} came true.`, sub: dir.filter(x => x !== best).map(x => `${DN[x.d]}: ${w(x.hit)} of ${w(x.n)}.`).join(' ') });
    if (open.length) steps.push({ kind: 'next', label: 'Still open', text: `${W(open.length)} call${open.length > 1 ? 's are' : ' is'} still open.`,
      sub: `${list([...open.slice(0, 4).map((c, k) => `${symName(c.symbol, !k)} ${c.direction} by ${MON(c.due_on)}`), ...(open.length > 4 ? [`${w(open.length - 4)} more`] : [])])}.` });
    steps.push({ kind: 'so', mood: ['calm'], text: `${rate >= .55 ? 'Better than a coin so far' : rate <= .45 ? 'Worse than a coin so far' : 'About a coin flip so far'}.${R.graded_dedup < 50 ? ' The sample is still small, so this can swing.' : ''}` });
    steps.push({ ...METHOD, text: 'Each call names a market, a direction and a date.', sub: 'The outcome is measured from prices, not judged. Moves under 1% count as flat, so luck can’t pass for skill.' });
    return { key: 'record', title: 'How our calls did', pictures: plays(steps), steps };
  }
  RD.picture('tally', (el, ctx) => {
    const { C, dir } = ctx.steps[0].data, sC = stepOf(ctx, 'Against a coin'), sD = stepOf(ctx, 'By direction'), sO = stepOf(ctx, 'Still open');
    const rowsD = ['up', 'down', 'flat'].filter(d => C.some(c => c.direction === d)), most = Math.max(...rowsD.map(d => C.filter(c => c.direction === d).length));
    const sp = Math.min(30, 560 / most), x0 = 130, DN = { up: 'Up', down: 'Down', flat: 'Flat' };
    [['var(--up)', 'came true', true], ['var(--down)', 'didn’t', false], ['rgba(var(--line-rgb),.55)', 'still open', null]].forEach(([col, txt, k], i) => {
      el('circle', { cx: 26 + i * 130, cy: 26, r: 6, fill: k ? col : 'none', stroke: col, 'stroke-width': 1.6, 'stroke-dasharray': k == null ? '2 2.6' : 'none' }, { at: 0 });
      el('text', { x: 40 + i * 130, y: 31, class: 'mut' }, { text: txt, at: 0 });
    });
    rowsD.forEach((d, r) => {
      const y = 110 + r * 82, g = C.filter(c => c.direction === d), t = dir.find(x => x.d === d);
      el('text', { x: 20, y: y + 6, class: 'lab', style: 'font-size:17px' }, { text: DN[d], at: 0 });
      g.forEach((c, k) => {
        const x = x0 + k * sp, col = c.correct === 1 ? 'var(--up)' : c.correct === 0 ? 'var(--down)' : 'rgba(var(--line-rgb),.55)', dim = real([c.correct == null ? 99 : sO]);
        el('circle', { cx: x, cy: y, r: Math.min(9, sp / 2 - 2), fill: c.correct === 1 ? col : 'none', stroke: col, 'stroke-width': 1.8, 'stroke-dasharray': c.correct == null ? '2 2.6' : 'none', class: 'pop' }, { at: 0, d: .05 + k * .03, dim });
      });
      if (t) el('text', { x: 805, y: y + 6, 'text-anchor': 'end', class: 'num', style: 'font-size:19px' }, { text: `${t.hit} of ${t.n}`, at: sD, d: .2 + r * .1 });
    });
    const graded = C.filter(c => c.correct != null), hits = graded.filter(c => c.correct === 1).length, cw = Math.min(22, 650 / graded.length), yb = 110 + rowsD.length * 82 + 40;
    graded.forEach((c, k) => el('rect', { x: x0 + k * cw, y: yb, width: cw - 3, height: 22, rx: 2, fill: k < hits ? 'var(--up)' : 'rgba(var(--line-rgb),.14)' }, { at: sC, d: .1 + k * .025 }));
    const half = x0 + graded.length / 2 * cw - 1.5;
    el('line', { x1: half, x2: half, y1: yb - 12, y2: yb + 34, stroke: 'var(--ink)', 'stroke-width': 1.5 }, { at: sC, d: .9 });
    el('text', { x: half, y: yb - 20, 'text-anchor': 'middle', class: 'mut' }, { text: 'a coin flip', at: sC, d: 1 });
    el('text', { x: 20, y: yb + 16, class: 'lab', style: 'font-size:15px' }, { text: 'Came true', at: sC });
    rowsD.forEach((d, r) => {
      const g = C.filter(c => c.direction === d), runs = [];
      g.forEach((c, k) => { if (c.correct != null) return; const i = bySym.get(c.symbol), name = i ? nm(i) : c.symbol, last = runs[runs.length - 1];
        if (last && last.name === name && last.to === k - 1) last.to = k; else runs.push({ name, from: k, to: k }); });
      runs.forEach((u, n) => el('text', { x: x0 + (u.from + u.to) / 2 * sp, y: 110 + r * 82 + 30 + (n % 2) * 16, 'text-anchor': 'middle', class: 'mut', style: 'font-size:12.5px' }, { text: u.name, at: sO, until: sO, d: .2 }));
    });
  });

  // ---------- Where the data comes from: every source as a branch, with what it gave this edition ----------
  let HEALTH = null;
  function dataTree() {
    const ME = window.SIX_SEVEN_META || {}, ST = ME.status || {}, WX = window.SIX_SEVEN_WEATHER || {}, WM = window.SIX_SEVEN_WORLD || {}, SK = window.SIX_SEVEN_SKY || {};
    const IN = window.SIX_SEVEN_INBOX || {}, LF = window.SIX_SEVEN_LIFE || {}, FN = window.SIX_SEVEN_FANTASY || {}, MO = window.SIX_SEVEN_MONEY || {};
    const H = X.headlines || [], F = DP.feeds || [], live = new Set(H.map(h => h.source)).size, n = v => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : +v || 0);
    const en = n(DP.energy?.rows), re = n(DP.real_estate?.rows), af = n(DP.africa?.countries), games = n(DP.sporting?.rows), wxN = n(WX.rows), ctry = n(WM.countries);
    const pos = n(MO.portfolio_holdings?.positions) || n(MO.holdings), mail = n(IN.payload?.items), cal = +LF.calendar || 0, leagues = n(FN.leagues), rules = n(KD.tripwires);
    const L = [
      ['Markets', 'Yahoo Finance', `${INS.length} prices each morning`, INS.length > 0],
      ['Markets', 'Finnhub', 'live prices in market hours', true],
      ['News', `${F.length} news outlets`, `${H.length} headlines`, H.length > 0],
      ['News', 'Web search', 'sneaker drops, social trends', ST.commerce === 'ok' || ST.social === 'ok'],
      ['The world', 'Open-Meteo', `weather in ${wxN} places`, wxN > 0],
      ['The world', 'Energy Department', `${en} fuel stockpiles`, en > 0],
      ['The world', 'St. Louis Fed', `${re} housing readings`, re > 0],
      ['The world', 'World Bank', `${af} African economies`, af > 0],
      ['The world', 'GDELT', `news mood in ${ctry} countries`, ctry > 0],
      ['The world', 'Wikipedia', 'what the world is reading', n(WM.attention) > 0],
      ['The world', 'The Odds API', games ? `${games} games` : 'off for now', games > 0],
      ['The world', 'Fed and BLS calendars', `${n(KD.calendar)} dates ahead`, n(KD.calendar) > 0],
      ['The sky', 'Worked out here', `${n(SK.stars)} stars, the planets`, n(SK.stars) > 0],
    ].map(([g, name, gives, on, mine]) => ({ g, name, gives, on: !!on, mine })).filter(x => !(ME.public && x.mine));
    if (L.length < 6) return null;
    // A branch that's switched off or not built yet isn't expected to deliver; anything else that's faint is a miss.
    L.forEach(x => { x.exp = !(x.name === 'SEC filings' || (x.name === 'The Odds API' && ST.sporting === 'off')); });
    const exp = L.filter(x => x.exp), lit = exp.filter(x => x.on).length, missing = exp.filter(x => !x.on).map(x => x.name), sporting = ST.sporting === 'off' ? ' Sports odds are off for now.' : '';
    HEALTH = { lit, expected: exp.length, missing, written: ST.synthesis === 'ok' };
    const say = {
      Markets: ['held', `Yahoo Finance gives ${INS.length} market prices each morning.`, 'Finnhub adds live prices for 24 US names while markets are open.'],
      News: ['news', `The news comes from ${F.length} outlets, left to right.`, `${W(live)} of them had stories this morning, ${H.length} in all.${ST.commerce === 'ok' ? ' A web search adds sneaker drops and social trends.' : ''}`],
      'The world': ['world', `Weather in ${wxN} places, fuel stockpiles, housing and ${af} African economies.`, `The news mood in ${ctry} countries from GDELT, and what people read on Wikipedia.${sporting}`],
      'The sky': ['trad', 'The sky isn’t fetched. It’s worked out here.', `The Sun, the Moon, the planets and ${n(SK.stars)} stars, from published orbits and star positions.`],
    };
    const groups = [...new Set(L.map(x => x.g))];
    const steps = [{ kind: 'held', label: 'Everything it reads', pic: 'tree', text: 'Everything Six Seven reads, on one tree.', sub: `${lit === exp.length ? `All ${exp.length} working branches delivered for this edition.` : `${W(lit)} of ${exp.length} working branches delivered. Missing: ${list(missing)}.`} Faint ones are switched off or not built yet.`, mood: ['calm'], data: { L, groups } }];
    groups.forEach(g => { const [kind, text, sub] = say[g]; steps.push({ kind, label: g, text, sub, mood: kind === 'held' || kind === 'news' ? ['calm'] : [kind === 'trad' ? 'trad' : kind === 'you' ? 'you' : 'world'] }); });
    steps.push({ kind: 'so', label: 'The words', mood: ['calm'], text: 'Claude writes the words from all of this. It never writes a number.',
      sub: ST.synthesis === 'ok' ? 'Every figure on the page comes from a source on this tree.' : 'This morning its read didn’t pass the checks, so the page shows only measured facts.' });
    steps.push({ ...METHOD, text: 'Every count here comes from this edition.', sub: 'A faint branch delivered nothing this morning. Every source is a public feed or API, but Yahoo Finance’s is unofficial: it can change or stop without notice.' });
    return { key: 'data', title: 'Where the data comes from', pictures: plays(steps), steps };
  }
  RD.picture('tree', (el, ctx, K) => {
    const { L, groups } = ctx.steps[0].data, sW = stepOf(ctx, 'The words'), cx = 410, cy = 280;
    const RIGHT = ['Markets', 'News', 'The world'], at = Object.fromEntries(groups.map(g => [g, stepOf(ctx, g)]));
    const own = real(Object.values(at));
    // leaves sit in two columns that bow outward, evenly spaced, with a little air between branches
    const place = (side, gs) => {
      const items = gs.flatMap((g, k) => L.filter(x => x.g === g).map((x, i) => ({ x, gap: k && !i }))), slots = items.length + items.filter(i => i.gap).length * .6;
      const step = Math.min(44, 470 / Math.max(1, slots - 1)), top = cy - step * (slots - 1) / 2; let s = 0;
      items.forEach(it => { if (it.gap) s += .6; const y = top + s * step, k = Math.min(.95, Math.abs(y - cy) / 300); it.x.px = cx + side * (150 + 70 * Math.sqrt(1 - k * k)); it.x.py = y; s++; });
    };
    place(1, groups.filter(g => RIGHT.includes(g))); place(-1, groups.filter(g => !RIGHT.includes(g)));
    el('circle', { cx, cy, r: 26, fill: 'rgba(var(--glow-rgb),.12)', stroke: 'var(--glow)', 'stroke-width': 1.5 }, { at: 0 });
    el('circle', { cx, cy, r: 9, fill: 'var(--glow)', class: 'pop' }, { at: 0, d: .1 });
    el('text', { x: cx, y: cy + 64, 'text-anchor': 'middle', class: 'head', style: 'font-size:16px' }, { text: 'Six Seven', at: 0, d: .2 });
    el('circle', { cx, cy, r: 40, fill: 'none', stroke: 'var(--mauve)', 'stroke-width': 1.5, 'stroke-dasharray': '3 5' }, { at: sW, d: .2 });
    el('text', { x: cx, y: cy - 52, 'text-anchor': 'middle', class: 'lab', style: 'font-size:15px;fill:var(--mauve)' }, { text: 'Claude writes the words', at: sW, d: .4 });
    groups.forEach((g, gi) => {
      const kids = L.filter(x => x.g === g), side = RIGHT.includes(g) ? 1 : -1, gx = cx + side * 92, gy = kids.reduce((a, x) => a + x.py, 0) / kids.length;
      const dim = own.filter(s => s !== at[g]), anyOn = kids.some(x => x.on);
      el('path', { d: `M${cx + side * 26} ${cy} C${cx + side * 60} ${cy}, ${gx - side * 40} ${gy}, ${gx} ${gy}`, fill: 'none', stroke: anyOn ? 'rgba(var(--line-rgb),.55)' : 'rgba(var(--line-rgb),.18)', 'stroke-width': 2.4, pathLength: 1, class: 'draw' }, { at: 0, d: .2 + gi * .1, dim });
      el('circle', { cx: gx, cy: gy, r: 5, fill: 'var(--ink)' }, { at: 0, d: .5 + gi * .1, dim });
      el('text', { x: gx, y: gy - 13, 'text-anchor': 'middle', class: 'grp', style: 'font-size:14px;fill:var(--ink2)' }, { text: g, at: 0, d: .6 + gi * .1, dim });
      kids.forEach((x, k) => {
        const col = x.on ? 'var(--ink)' : 'var(--faint)', t0 = .8 + gi * .12 + k * .05;
        el('path', { d: `M${gx} ${gy} C${(gx + x.px) / 2} ${gy}, ${(gx + x.px) / 2} ${x.py}, ${x.px} ${x.py}`, fill: 'none', stroke: x.on ? 'rgba(var(--glow-rgb),.55)' : 'rgba(var(--line-rgb),.14)', 'stroke-width': 1.4, 'stroke-dasharray': x.on ? 'none' : '2 4', ...(x.on ? { pathLength: 1, class: 'draw' } : {}) }, { at: 0, d: t0, dim });
        el('circle', { cx: x.px, cy: x.py, r: 4.5, fill: x.on ? 'var(--glow)' : 'none', stroke: x.on ? 'none' : 'var(--faint)', 'stroke-width': 1.2, class: 'pop' }, { at: 0, d: t0 + .3, dim });
        const tx = x.px + side * 12, an = side > 0 ? 'start' : 'end';
        el('text', { x: tx, y: x.py - 1, 'text-anchor': an, class: 'lab', style: `font-size:15px;fill:${col}` }, { text: x.name, at: 0, d: t0 + .35, dim });
        el('text', { x: tx, y: x.py + 15, 'text-anchor': an, class: 'mut', style: `font-size:12.5px${x.on ? '' : ';fill:var(--faint)'}` }, { text: x.gives, at: 0, d: t0 + .4, dim });
      });
    });
  });

  // ---------- open ----------
  const BUILD = { regime: mood, outliers: unusual, together, against, rules: patterns, cost, energy, housing, africa, sport, sources, record, data: dataTree };
  const LIST = Object.values(BUILD).map(f => { try { return f(); } catch (e) { console.warn('analysis check failed', e); return null; } }).filter(Boolean);
  api.has = key => LIST.some(r => r.key === key);
  api.first = key => LIST.find(r => r.key === key)?.steps[0].text || '';
  api.health = () => HEALTH;
  // One check at a time, named in the header: twelve won't fit as tabs, and the list they're picked from is right behind.
  api.open = key => { const r = LIST.find(x => x.key === key); if (r) RD.play([r], 0, { kicker: 'Analysis', title: r.title }); };
})();
