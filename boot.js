/* Boot: fetch one Observatory edition (observatory.py writes them) and hand it to the page as the globals app.js and
   orbit.js read, then load them in order. ?edition=YYYY-MM-DD opens an archived edition; otherwise the latest.
   Served by serve.py at /observatory/ with data under /observatory/data/, or as a static bundle with data/ beside it. */
(() => {
  'use strict';
  const ed = new URLSearchParams(location.search).get('edition');
  const url = `data/${ed && /^\d{4}-\d{2}-\d{2}$/.test(ed) ? ed : 'latest'}.json`;
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(`Couldn’t load ${src}`)); document.body.append(s); });
  const fail = msg => { document.body.classList.add('boot-failed'); document.querySelectorAll('[data-edition-label]').forEach(n => { n.textContent = msg; }); };
  fetch(url, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error(ed ? `No edition for ${ed}` : 'No edition yet. Run brief.py first.'); return r.json(); })
    .then(d => {
      Object.assign(window, {
        SIX_SEVEN_META: d.meta, SIX_SEVEN_FIXTURE: d.fixture, SIX_SEVEN_EDITION: d.edition, SIX_SEVEN_BRIEF: d.brief, SIX_SEVEN_SKY: d.sky,
        SIX_SEVEN_READING: d.reading, SIX_SEVEN_DECK: d.deck, SIX_SEVEN_EXPLORE: d.explore,
        SIX_SEVEN_WEATHER: d.weather, SIX_SEVEN_WORLD: d.world_mood || null, SIX_SEVEN_DEPTH: d.depth, ORBIT_TEXTURE: 'earth.jpg',
      });
      return (d.meta?.public ? Promise.resolve() : load('orbit.js')).then(() => load('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')).then(() => load('reads.js')).then(() => load('analysis.js')).then(() => load('app.js'));
    })
    .catch(e => fail(e.message));
})();
