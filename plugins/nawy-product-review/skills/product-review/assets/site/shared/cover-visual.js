// Product review — the cover drawing: a small isometric district of buildings, a few lit up as updated today.
// Draws into every .cover-visual; used by the landing cover and by each review's cover.
document.querySelectorAll('.cover-visual').forEach((el) => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const size = 50, rows = 8, cols = 8, ox = 420, oy = 150; // fits an 840×560 view
  const faces = { base: ['#2B5A87', '#244C73', '#3A6D9C'], lit: ['#FF8A63', '#E8592F', '#FFB199'], teal: ['#7DCBC1', '#5FB3A8', '#A6DDD6'] };
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([r, c]);
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[1] - b[1]); // back to front
  let svg = '';
  for (const [r, c] of cells) {
    {
      if (rnd() < 0.12) continue; // a street or a garden
      const h = 20 + Math.floor(rnd() * 7) * 16;
      const kind = rnd() < 0.14 ? 'lit' : rnd() < 0.2 ? 'teal' : 'base';
      const [top, left, right] = faces[kind];
      const cx = ox + (c - r) * size, cy = oy + (c + r) * size * 0.5;
      const p = (dx, dy) => `${cx + dx},${cy + dy}`;
      const w = size * 0.82, d = w * 0.5;
      svg += `<g class="bld" style="animation-delay:${((r + c) * 0.05).toFixed(2)}s">
        <polygon points="${p(-w, d - h)} ${p(0, 2 * d - h)} ${p(0, 2 * d)} ${p(-w, d)}" fill="${left}"/>
        <polygon points="${p(0, 2 * d - h)} ${p(w, d - h)} ${p(w, d)} ${p(0, 2 * d)}" fill="${right}"/>
        <polygon points="${p(-w, d - h)} ${p(0, -h)} ${p(w, d - h)} ${p(0, 2 * d - h)}" fill="${top}"/></g>`;
    }
  }
  el.innerHTML = `<svg viewBox="0 0 840 560" aria-hidden="true"><style>.bld{animation:rise .7s ease both}@keyframes rise{from{opacity:0;transform:translateY(24px)}}</style>${svg}</svg>`;
});
