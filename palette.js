/* Palettes: one set of colour roles for the page, its charts and the globe's shaders, so they always agree.
   Choose with ?palette=name (remembered on this device). Earthlight is the current default, chosen by the reader on
   2026-10-09; "glass" is the look the Observatory shipped with. All are studies; none is final. */
(() => {
  'use strict';
  const P = {
    glass: {
      label: 'Night glass',
      css: { space: '#04060e', 'space-rgb': '4,6,14', 'deep-rgb': '12,15,32', ink: '#eef0fa', ink1: '#e3e5f1', ink2: '#cfd3e6', muted: '#aab0c8', faint: '#6f7592',
        mauve: '#ebbadc', 'mauve-rgb': '235,186,220', glow: '#ffd8ae', 'glow-rgb': '255,216,174', hot: '#fff3e6', up: '#a9e4d1', 'up-rgb': '169,228,209',
        down: '#f3a6b8', 'down-rgb': '243,166,184', down2: '#f6c3cf', 'line-rgb': '222,216,246', line: 'rgba(222,216,246,.18)',
        glass: 'rgba(14,18,38,.52)', 'glass-strong': 'rgba(12,15,32,.82)', 'lean-l': '#8fa8ff', 'lean-c': '#e7e2f2', 'lean-r': '#ff9a86', 'lean-l2': '#b6c4ff', 'lean-r2': '#ffc0b0',
        'series-1': '#dcd6f5', 'series-2': '#ebbadc', 'series-3': '#ffd8ae', cool: '#b9c6ff', warm: '#ffe4c8', warm2: '#ffc58f' },
      gl: { ocean0: [.030, .050, .140], ocean1: [.11, .17, .38], ground0: [.26, .22, .40], ground1: [.92, .80, .94], tint: [.92, .86, 1.06], nightSea: [.010, .016, .045], nightLand: [.060, .045, .095],
        dayNight: [.10, .10, .20], term: [.58, .30, .44], lights: [1, .80, .55], rim0: [.05, .07, .22], rim1: [.52, .40, .86], atm0: [.16, .20, .58], atm1: [.78, .58, .98], atmD0: [.55, .62, .95], atmD1: [.85, .72, 1],
        skyHi: [.09, .11, .25], skyLo: [.018, .028, .080], sunset: [1, .55, .34], skyGlow: [.42, .26, .54], starInk: [.20, .16, .34], star: [.86, .88, 1], band: [.80, .68, 1], bandDay: [.42, .30, .62],
        mw0: [.20, .20, .42], mw1: [.52, .42, .62], haze0: [.10, .10, .22], haze1: [.22, .16, .30], dustStar: [.80, .82, 1] },
      hex: { clear: 0x04060e, coast: 0xe6c4ec, dust: 0xb9b6e8, fig: 0xcfc6ff, ecl: 0xd9c8ff, axis: 0xbfb6e6, figs: 0xc9c2f0, aspCool: 0xa9c8ff, aspHot: 0xff9fb4, aspConj: 0xffd9a8 },
      coastA: .34, glowStd: 3.2,
    },
    // Night Earth from orbit: cool neutral land, a thin vivid blue atmosphere, sodium city light as the one warm note.
    earthlight: {
      label: 'Earthlight',
      css: { space: '#04060d', 'space-rgb': '4,6,13', 'deep-rgb': '9,12,22', ink: '#f1f4f7', ink1: '#e2e7ec', ink2: '#c4cbd3', muted: '#9ca5af', faint: '#636c77',
        mauve: '#aab4ec', 'mauve-rgb': '170,180,236', glow: '#d6dcff', 'glow-rgb': '214,220,255', hot: '#f4f5ff', up: '#7fd6b0', 'up-rgb': '127,214,176',
        down: '#f28ba0', 'down-rgb': '242,139,160', down2: '#f8c2cd', 'line-rgb': '204,208,232', line: 'rgba(204,208,232,.15)',
        glass: 'rgba(8,12,20,.52)', 'glass-strong': 'rgba(7,10,17,.85)', 'lean-l': '#82a8ff', 'lean-c': '#e6eaee', 'lean-r': '#f2909f', 'lean-l2': '#b9cfff', 'lean-r2': '#f8c4cc',
        'series-1': '#6f7fae', 'series-2': '#aab4ec', 'series-3': '#e6e9ff', cool: '#b2bff0', warm: '#e6e9ff', warm2: '#cfd6ff' },
      gl: { ocean0: [.008, .016, .045], ocean1: [.035, .062, .150], ground0: [.14, .145, .18], ground1: [.84, .84, .90], tint: [.97, .97, 1.03], nightSea: [.004, .008, .018], nightLand: [.022, .026, .032],
        dayNight: [.08, .10, .13], term: [.30, .28, .42], lights: [1, .80, .52], rim0: [.025, .035, .12], rim1: [.36, .42, .84], atm0: [.07, .09, .38], atm1: [.44, .48, .90], atmD0: [.52, .58, .95], atmD1: [.78, .80, .98],
        skyHi: [.06, .08, .21], skyLo: [.010, .018, .048], sunset: [1, .56, .30], skyGlow: [.32, .30, .54], starInk: [.12, .14, .20], star: [.90, .94, 1], band: [.72, .74, 1], bandDay: [.32, .34, .62],
        mw0: [.14, .18, .30], mw1: [.40, .46, .60], haze0: [.07, .09, .15], haze1: [.14, .17, .24], dustStar: [.85, .90, 1],
        glint: [.92, .94, 1], gratCol: [.58, .62, .92], haze: [.30, .36, .80] },
      hex: { clear: 0x03060c, coast: 0xd6dbee, dust: 0xbfcad8, fig: 0xc8cdf6, ecl: 0xcbd0f6, axis: 0xaebdd4, figs: 0xb8cbea, aspCool: 0x96c2ff, aspHot: 0xf2909f, aspConj: 0xe6e9ff },
      coastA: .28, glowStd: 2.2, relief: 2.8, grat: .055,
    },
    // An instrument at night: graphite and white, one signal colour for what needs you.
    graphite: {
      label: 'Graphite',
      css: { space: '#0b0b0c', 'space-rgb': '11,11,12', 'deep-rgb': '18,18,20', ink: '#f4f4f1', ink1: '#e7e7e3', ink2: '#cbcbc6', muted: '#9e9e99', faint: '#676762',
        mauve: '#ff7a1a', 'mauve-rgb': '255,122,26', glow: '#ff7a1a', 'glow-rgb': '255,122,26', hot: '#fff1e6', up: '#7fdcaa', 'up-rgb': '127,220,170',
        down: '#ff5a52', 'down-rgb': '255,90,82', down2: '#ffb3ad', 'line-rgb': '235,235,230', line: 'rgba(235,235,230,.14)',
        glass: 'rgba(16,16,18,.55)', 'glass-strong': 'rgba(14,14,16,.86)', 'lean-l': '#8eb2ff', 'lean-c': '#e9e9e4', 'lean-r': '#ff8d6a', 'lean-l2': '#c3d3ff', 'lean-r2': '#ffc4b0',
        'series-1': '#e9e9e4', 'series-2': '#9e9e99', 'series-3': '#ff7a1a', cool: '#c3d3ff', warm: '#ffd2b0', warm2: '#ff9a52' },
      gl: { ocean0: [.020, .020, .024], ocean1: [.065, .068, .076], ground0: [.13, .13, .13], ground1: [.84, .84, .82], tint: [1, 1, 1], nightSea: [.008, .008, .010], nightLand: [.026, .026, .026],
        dayNight: [.10, .10, .10], term: [.55, .26, .08], lights: [1, .52, .18], rim0: [.03, .03, .035], rim1: [.55, .57, .62], atm0: [.10, .105, .12], atm1: [.66, .68, .74], atmD0: [.60, .62, .66], atmD1: [.82, .83, .86],
        skyHi: [.07, .07, .08], skyLo: [.016, .016, .018], sunset: [1, .48, .16], skyGlow: [.28, .26, .24], starInk: [.14, .14, .14], star: [.92, .92, .92], band: [.75, .75, .75], bandDay: [.35, .35, .35],
        mw0: [.18, .18, .19], mw1: [.42, .42, .42], haze0: [.08, .08, .085], haze1: [.15, .15, .15], dustStar: [.88, .88, .88] },
      hex: { clear: 0x0b0b0c, coast: 0xe6e6e1, dust: 0xcfcfcf, fig: 0xdedede, ecl: 0xd8d8d8, axis: 0xbdbdbd, figs: 0xc8c8c8, aspCool: 0xbfd2ff, aspHot: 0xff8a5c, aspConj: 0xffb07a },
      coastA: .26, glowStd: 1.1,
    },
    // A sea chart at night: deep teal water, bone land, brass and lamp-gold.
    deepsea: {
      label: 'Deep sea',
      css: { space: '#031014', 'space-rgb': '3,16,20', 'deep-rgb': '6,24,30', ink: '#eef5f2', ink1: '#e0ebe6', ink2: '#c4d4ce', muted: '#94aaa3', faint: '#5f736d',
        mauve: '#e6c88c', 'mauve-rgb': '230,200,140', glow: '#ffcf74', 'glow-rgb': '255,207,116', hot: '#fff4dc', up: '#7fe0c4', 'up-rgb': '127,224,196',
        down: '#ff8b73', 'down-rgb': '255,139,115', down2: '#ffc3b4', 'line-rgb': '190,226,216', line: 'rgba(190,226,216,.16)',
        glass: 'rgba(6,24,30,.52)', 'glass-strong': 'rgba(5,20,25,.84)', 'lean-l': '#7fb2ff', 'lean-c': '#e7efea', 'lean-r': '#ff8f70', 'lean-l2': '#b8d4ff', 'lean-r2': '#ffc4b2',
        'series-1': '#bfe0d6', 'series-2': '#e6c88c', 'series-3': '#ffcf74', cool: '#a9d8ff', warm: '#ffe2b0', warm2: '#ffc070' },
      gl: { ocean0: [.008, .040, .050], ocean1: [.025, .15, .17], ground0: [.20, .19, .15], ground1: [.90, .86, .74], tint: [1, .97, .90], nightSea: [.004, .018, .024], nightLand: [.032, .030, .024],
        dayNight: [.06, .11, .12], term: [.55, .36, .16], lights: [1, .80, .45], rim0: [.01, .06, .07], rim1: [.22, .72, .72], atm0: [.02, .20, .26], atm1: [.40, .86, .86], atmD0: [.45, .80, .82], atmD1: [.75, .92, .90],
        skyHi: [.03, .12, .15], skyLo: [.008, .030, .036], sunset: [1, .62, .32], skyGlow: [.20, .38, .38], starInk: [.10, .18, .18], star: [.88, .96, .94], band: [.70, .92, .88], bandDay: [.25, .45, .45],
        mw0: [.10, .22, .24], mw1: [.36, .50, .50], haze0: [.05, .12, .13], haze1: [.12, .18, .18], dustStar: [.84, .95, .92] },
      hex: { clear: 0x031014, coast: 0xe8dcc0, dust: 0xbcd8d0, fig: 0xcfe8e0, ecl: 0xd8e6d8, axis: 0xb0ccc4, figs: 0xc0dcd4, aspCool: 0x9cdcff, aspHot: 0xff9a7a, aspConj: 0xffd38a },
      coastA: .30, glowStd: 2.4,
    },
  };
  let name = 'earthlight';
  try {
    const q = new URLSearchParams(location.search).get('palette');
    if (q && P[q]) { name = q; localStorage.setItem('sixseven.palette', q); }
    else { const s = localStorage.getItem('sixseven.palette'); if (s && P[s]) name = s; }
  } catch (e) { /* storage blocked: use the default */ }
  if (window.SIX_SEVEN_PALETTE_NAME && P[window.SIX_SEVEN_PALETTE_NAME]) name = window.SIX_SEVEN_PALETTE_NAME;
  // Typography studies, chosen the same way: ?type=helvetica|archivo, remembered on this device.
  const TYPES = { helvetica: 'Helvetica', archivo: 'Archivo' };
  let type = 'helvetica';
  try {
    const tq = new URLSearchParams(location.search).get('type');
    if (tq && TYPES[tq]) { type = tq; localStorage.setItem('sixseven.type', tq); }
    else { const ts = localStorage.getItem('sixseven.type'); if (ts && TYPES[ts]) type = ts; }
  } catch (e) { /* storage blocked: use the default */ }
  document.documentElement.dataset.type = type;
  const pal = P[name], root = document.documentElement.style;
  for (const [k, v] of Object.entries(pal.css)) root.setProperty('--' + k, v);
  document.documentElement.dataset.palette = name;
  window.SIX_SEVEN_PALETTE = { name, ...pal, all: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.label])), type, types: TYPES };
})();
