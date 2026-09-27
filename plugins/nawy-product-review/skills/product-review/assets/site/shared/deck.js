// Product review — the engine every week's page loads. It shows one page at a time, 1600 wide and zoomed to the
// window (an overview fits one screen, a feature's page scrolls); ← → move between pages, F goes full screen. Links to
// "#<page id>" jump (overview card → the feature's page, back button → the overview). It also counts metrics up, draws
// charts from data-chart, plays the demo video of the open page only, and opens screenshots full size.
(() => {
  const deck = document.querySelector('.deck');
  const slides = [...deck.querySelectorAll('.slide')];
  // Pages go by data-page, not id, so the browser never jumps a long page down to its own anchor.
  slides.forEach((s, i) => { s.dataset.page = s.id || `page-${i + 1}`; s.removeAttribute('id'); });
  history.scrollRestoration = 'manual'; // a page always opens at its top, reload included
  const SECTIONS = { cover: 'Cover', updates: 'Updates', released: 'Released', testing: 'Testing', progress: 'In progress', next: 'Next' };

  // Zoom the pages so an overview (1600×900) fits the window above the bar; longer pages scroll.
  const fit = () => deck.style.setProperty('--scale', Math.min((innerWidth - 40) / 1600, (innerHeight - 84) / 900));
  addEventListener('resize', fit);
  fit();

  // The bar: a button per section, the count, prev / next and full screen.
  const bar = document.createElement('nav');
  bar.className = 'bar';
  bar.innerHTML = `<div class="sections"></div><span class="spacer"></span>
    <button class="ctrl" data-go="-1" aria-label="Previous slide">←</button><span class="count"></span>
    <button class="ctrl" data-go="1" aria-label="Next slide">→</button><button class="ctrl" data-full>Present ⤢</button>`;
  const progress = Object.assign(document.createElement('div'), { className: 'progress' });
  document.body.append(bar, progress);
  const firstOf = {};
  slides.forEach((s, i) => { const k = s.dataset.section || 'cover'; if (!(k in firstOf)) firstOf[k] = i; });
  Object.keys(SECTIONS).filter((k) => k in firstOf).forEach((k) => {
    const b = document.createElement('button');
    b.textContent = SECTIONS[k];
    b.dataset.section = k;
    b.addEventListener('click', () => show(firstOf[k]));
    bar.querySelector('.sections').append(b);
  });

  let current = -1;
  const show = (i) => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === current) return;
    slides[current]?.classList.remove('active');
    slides[current]?.querySelectorAll('video').forEach((v) => v.pause());
    current = i;
    const s = slides[i];
    s.classList.add('active');
    scrollTo(0, 0);
    s.querySelectorAll('video').forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); });
    s.querySelectorAll('[data-count]').forEach(countUp);
    s.querySelectorAll('[data-chart]:not(.drawn)').forEach(drawChart);
    bar.querySelector('.count').textContent = `${i + 1} / ${slides.length}`;
    progress.style.setProperty('--done', (i + 1) / slides.length);
    const section = s.dataset.section || 'cover';
    bar.querySelectorAll('.sections button').forEach((b) => b.classList.toggle('on', b.dataset.section === section));
    history.replaceState(null, '', `#${s.dataset.page}`);
  };

  addEventListener('keydown', (e) => {
    if (document.querySelector('.lightbox')) { if (e.key === 'Escape') document.querySelector('.lightbox').remove(); return; }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; // ↑ ↓ Space PageUp PageDown scroll a long page
    if (step) { e.preventDefault(); show(current + step); }
    else if (e.key === 'f' || e.key === 'F') present();
  });
  bar.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) show(current + Number(go.dataset.go));
    if (e.target.closest('[data-full]')) present();
  });
  // Present: inside the reviews hub the hub puts this page's frame in full screen (a frame asking for itself is refused
  // by some browsers); on its own, the page goes full screen. Safari's prefixed calls as a fallback.
  const host = window.frameElement ? window.parent.document : document;
  const fsElement = () => host.fullscreenElement ?? host.webkitFullscreenElement;
  const present = () => {
    if (fsElement()) return (host.exitFullscreen ?? host.webkitExitFullscreen)?.call(host);
    const el = window.frameElement ?? document.documentElement;
    (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  };
  const onFullscreen = () => {
    const on = !!fsElement();
    document.documentElement.classList.toggle('presenting', on);
    bar.querySelector('[data-full]').textContent = on ? 'Exit full screen' : 'Present ⤢';
    fit();
  };
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => host.addEventListener(ev, onFullscreen));

  // In full screen the bar hides until the mouse moves.
  let idle;
  addEventListener('mousemove', () => { bar.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => bar.classList.add('idle'), 2000); });

  // Jumps between slides, and screenshots opened full size.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    const to = link && slides.findIndex((s) => `#${s.dataset.page}` === link.getAttribute('href'));
    if (link && to >= 0) { e.preventDefault(); show(to); return; }
    const img = e.target.closest('.shots img, img.zoomable');
    if (img) {
      const box = Object.assign(document.createElement('div'), { className: 'lightbox' });
      box.append(Object.assign(document.createElement('img'), { src: img.src, alt: img.alt }));
      box.addEventListener('click', () => box.remove());
      document.body.append(box);
    }
  });

  // Every demo video gets a full screen button beside its download link.
  document.querySelectorAll('.demo').forEach((fig) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'full', textContent: 'Full screen ⤢' });
    b.addEventListener('click', () => {
      const v = fig.querySelector('video');
      (v.requestFullscreen ?? v.webkitRequestFullscreen ?? v.webkitEnterFullscreen)?.call(v)?.catch?.(() => {});
    });
    fig.querySelector('figcaption')?.append(b);
  });

  // Icons: data-icon="<name>" puts the icon in front of an element (paths from Tabler Icons, MIT).
  const ICONS = {
    pain: '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/><path d="M12 16h.01"/>',
    enhancement: '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/>',
    objective: '<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>',
    metric: '<path d="M3 17l6 -6l4 4l8 -8"/><path d="M14 7l7 0l0 7"/>',
    built: '<path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/>',
    how: '<path d="M7 4v16l13 -8z"/>',
    numbers: '<path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M4 20h14"/>',
  };
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const paths = ICONS[el.dataset.icon];
    if (paths) el.insertAdjacentHTML('afterbegin', `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`);
  });

  // Metrics count up: data-count="1234" (optional data-decimals, data-prefix, data-suffix).
  function countUp(el) {
    const end = Number(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    const fmt = (v) => `${el.dataset.prefix || ''}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${el.dataset.suffix || ''}`;
    const start = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 900);
      el.textContent = fmt(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Charts: data-chart='{"type":"bar"|"line","labels":[…],"series":[{"name":"…","values":[…]}],"unit":"%","target":100}'
  const PALETTE = ['#015C9A', '#7DCBC1', '#FF7043', '#00BDCF', '#1E4164'];
  function drawChart(el) {
    const c = JSON.parse(el.dataset.chart);
    const W = 1000, H = 440, L = 86, R = 24, T = 40, B = 60;
    const all = c.series.flatMap((s) => s.values).concat(c.target ?? []);
    const max = niceMax(Math.max(...all, 0));
    const x = (i, n) => L + (c.type === 'bar' ? ((i + 0.5) * (W - L - R)) / n : (n === 1 ? 0.5 : i / (n - 1)) * (W - L - R));
    const y = (v) => T + (1 - v / max) * (H - T - B);
    const unit = c.unit || '';
    const fmt = (v) => `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`;
    let svg = '';
    for (let k = 0; k <= 4; k++) {
      const v = (max * k) / 4;
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#E6E6E6"/><text x="${L - 12}" y="${y(v) + 5}" text-anchor="end" font-size="22" fill="#5B6573">${fmt(v)}</text>`;
    }
    const n = c.labels.length;
    const step = Math.max(1, Math.ceil(n / 12));
    c.labels.forEach((l, i) => { if (i % step === 0) svg += `<text x="${x(i, n)}" y="${H - 18}" text-anchor="middle" font-size="22" fill="#5B6573">${l}</text>`; });
    if (c.target != null) svg += `<line x1="${L}" x2="${W - R}" y1="${y(c.target)}" y2="${y(c.target)}" stroke="#5B6573" stroke-dasharray="6 6"/>`;
    c.series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      if (c.type === 'bar') {
        const group = ((W - L - R) / n) * 0.7;
        const w = group / c.series.length;
        s.values.forEach((v, i) => {
          const bx = x(i, n) - group / 2 + si * w;
          svg += `<rect x="${bx}" y="${y(v)}" width="${w - 4}" height="${y(0) - y(v)}" rx="6" fill="${color}"><animate attributeName="height" from="0" to="${y(0) - y(v)}" dur=".7s"/><animate attributeName="y" from="${y(0)}" to="${y(v)}" dur=".7s"/></rect>`;
          if (n <= 14) svg += `<text x="${bx + (w - 4) / 2}" y="${y(v) - 10}" text-anchor="middle" font-size="22" font-weight="600" fill="#1E4164">${fmt(v)}</text>`;
        });
      } else {
        const pts = s.values.map((v, i) => `${x(i, n)},${y(v)}`).join(' ');
        const len = 4000;
        svg += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"><animate attributeName="stroke-dashoffset" from="${len}" to="0" dur="1.1s" fill="freeze"/></polyline>`;
        s.values.forEach((v, i) => {
          svg += `<circle cx="${x(i, n)}" cy="${y(v)}" r="7" fill="#fff" stroke="${color}" stroke-width="4"/>`;
          if (n <= 14) svg += `<text x="${x(i, n)}" y="${y(v) - 18}" text-anchor="middle" font-size="22" font-weight="600" fill="#1E4164">${fmt(v)}</text>`;
        });
      }
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${c.title || 'Chart'}">${svg}</svg>` +
      (c.series.length > 1 ? `<div class="legend">${c.series.map((s, si) => `<span><i style="background:${s.color || PALETTE[si % PALETTE.length]}"></i>${s.name}</span>`).join('')}</div>` : '');
    el.classList.add('drawn');
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v);
  }

  const fromHash = () => { const i = slides.findIndex((s) => `#${s.dataset.page}` === location.hash); show(i >= 0 ? i : 0); };
  addEventListener('hashchange', fromHash);
  fromHash();
})();
