// Nawy feature demo video, the JavaScript renderer (Mac, Windows, Linux). Same storyboard and same look as
// demo_video.swift: the product's real screens in a laptop, told in order. Per step the camera glides to what matters,
// a spotlight and a label point at it, a cursor moves and clicks, and a caption under the laptop says the step,
// between a title card and an outro, in Nawy's colours.
//
//   node demo_video.mjs <storyboard.json> <out.mp4>              render the video (1920×1080, 30 fps, H.264)
//   node demo_video.mjs <storyboard.json> --stills 2,6.5 <dir>   render single frames as PNGs, to check the framing
//   node demo_video.mjs --grid <image|video> <out.png> [sec]     a labelled pixel grid over the image (or a video frame)
//
// Needs Node 18+ and, once, `npm install` in this folder: @napi-rs/canvas draws, ffmpeg-static encodes and decodes.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let canvasLib, ffmpegPath;
try {
  canvasLib = await import('@napi-rs/canvas');
  ffmpegPath = (await import('ffmpeg-static')).default;
} catch {
  console.error(`First run: install the renderer's two packages:\n  cd "${here}" && npm install`);
  process.exit(1);
}
if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error(`ffmpeg didn't download (npm blocked its install step). In "${here}" run:\n  npm approve-scripts ffmpeg-static && npm rebuild ffmpeg-static`);
  process.exit(1);
}
const { createCanvas, loadImage, GlobalFonts, ImageData } = canvasLib;

const W = 1920, H = 1080, FPS = 30;
const screen = { x: 320, y: 64, w: 1280, h: 800 }; // the laptop's 16:10 screen
const aspect = screen.w / screen.h;
const sceneFade = 0.5, cardFade = 0.6, zoomTime = 1.1, moveTime = 0.9;
const NAVY = '#1E4164', BLUE = '#015C9A', MUTED = '#5B6573', TEAL = '#7DCBC1';

// Fonts: Poppins when the skill has it, else the system's sans-serif.
const skillDir = resolve(here, '..');
let family = 'sans-serif';
const fontsDir = join(skillDir, 'assets/fonts');
if (existsSync(fontsDir)) {
  for (const f of readdirSync(fontsDir)) if (/\.(ttf|otf)$/i.test(f) && GlobalFonts.registerFromPath(join(fontsDir, f), 'Poppins')) family = 'Poppins';
}
const font = (size, weight = 400) => `${weight} ${size}px ${family}`;

const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const box = (a) => (Array.isArray(a) && a.length === 4 ? { x: a[0], y: a[1], w: a[2], h: a[3] } : null);
const inset = (r, d) => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });
function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fillRRect(c, x, y, w, h, r, style) { c.beginPath(); rrect(c, x, y, w, h, r); c.fillStyle = style; c.fill(); }
function wrap(c, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && c.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const spacedWidth = (c, s, gap) => [...s].reduce((w, ch) => w + c.measureText(ch).width + gap, -gap);
function spaced(c, s, x, y, gap) { for (const ch of s) { c.fillText(ch, x, y); x += c.measureText(ch).width + gap; } }

// A screen recording, decoded by ffmpeg one frame per output frame; jumping back reopens it (only stills do that).
function probe(path) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-i', path], { encoding: 'utf8' });
  const size = /Video:[^\n]*?, (\d{2,5})x(\d{2,5})/.exec(r.stderr ?? '');
  if (!size) throw new Error(`cannot read video ${path}`);
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr);
  return { w: +size[1], h: +size[2], duration: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0 };
}
class VideoFrames {
  constructor(path, from = 0, to, speed = 1) {
    const p = probe(path);
    Object.assign(this, { path, from, speed, w: p.w, h: p.h, to: to ?? p.duration, index: -1, proc: null, last: null });
    this.canvas = createCanvas(p.w, p.h);
  }
  open(i) {
    this.close();
    const start = this.from + (i / FPS) * this.speed;
    this.proc = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(start), '-i', this.path,
      '-t', String(Math.max(0.1, this.to - start + 0.5)), '-vf', `fps=${FPS / this.speed}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
      { stdio: ['ignore', 'pipe', 'inherit'] });
    Object.assign(this, { chunks: [], buffered: 0, ended: false, index: i - 1 });
    const frame = this.w * this.h * 4;
    this.proc.stdout.on('data', (d) => {
      this.chunks.push(d); this.buffered += d.length;
      if (this.buffered > frame * 2) this.proc.stdout.pause(); // hold at most two frames in memory
      this.wake?.();
    });
    this.proc.stdout.on('end', () => { this.ended = true; this.wake?.(); });
  }
  async readFrame() {
    const size = this.w * this.h * 4;
    while (this.buffered < size && !this.ended) { this.proc.stdout.resume(); await new Promise((r) => (this.wake = r)); }
    if (this.buffered < size) return false;
    const all = Buffer.concat(this.chunks), frame = all.subarray(0, size), rest = all.subarray(size);
    this.chunks = rest.length ? [rest] : []; this.buffered = rest.length;
    this.canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.buffer, frame.byteOffset, size), this.w, this.h), 0, 0);
    this.index++; this.last = this.canvas;
    this.proc.stdout.resume();
    return true;
  }
  async at(t) {
    const i = Math.round(t * FPS);
    if (!this.proc || i < this.index || i > this.index + 90) this.open(i);
    while (this.index < i) if (!(await this.readFrame())) break;
    return this.last;
  }
  close() { this.proc?.stdout.destroy(); this.proc?.kill('SIGKILL'); } // not SIGTERM: ffmpeg would wait on the unread pipe
}

class Renderer {
  constructor(board, base) {
    Object.assign(this, { board, base, items: [], accent: board.accent ?? '#FF7043' });
    this.canvas = createCanvas(W, H); this.ctx = this.canvas.getContext('2d');
    this.layer = createCanvas(W, H); this.cardLayer = createCanvas(W, H);
    this.introDur = board.intro ? board.intro.seconds ?? 2.8 : 0;
    this.outroDur = board.outro ? board.outro.seconds ?? 2.6 : 0;
  }
  get total() { const l = this.items.at(-1); return this.introDur + (l ? l.start + l.dur : 0) + this.outroDur; }
  async load() {
    const logoPath = join(skillDir, 'assets/nawy-logo.png');
    this.logo = existsSync(logoPath) ? await loadImage(logoPath) : null;
    const path = (p) => (isAbsolute(p) ? p : join(this.base, p));
    let start = 0;
    for (const [i, s] of this.board.scenes.entries()) {
      let still = null, video = null, size;
      if (s.image) {
        try { still = await loadImage(path(s.image)); } catch { throw new Error(`scene ${i + 1}: cannot read image ${s.image}`); }
        size = { w: still.width, h: still.height };
      } else if (s.video) {
        video = new VideoFrames(path(s.video), s.from, s.to, s.speed);
        size = { w: video.w, h: video.h };
      } else throw new Error(`scene ${i + 1}: needs an image or a video`);
      // Timing: the camera settles, then the cursor clicks, then the spotlight lands; each is overridable.
      const view0 = box(s.view) ? this.fit(box(s.view), size) : this.defaultView(size);
      const view1 = box(s.zoom) ? this.fit(box(s.zoom), size) : null;
      const zoomAt = s.zoomAt ?? 0.5;
      const settle = view1 ? zoomAt + zoomTime : 0.4;
      const clickAt = s.click ? s.clickAt ?? settle + 1.0 : null;
      const highlightAt = s.highlight ? s.highlightAt ?? (clickAt != null ? clickAt + 0.25 : settle + 0.2) : null;
      const last = Math.max(settle, clickAt ?? 0, (highlightAt ?? 0) + 0.45);
      const dur = s.seconds ?? (video ? (video.to - video.from) / video.speed : Math.max(3.2, last + 2.0));
      this.items.push({ scene: s, start, dur, still, video, size, view0, view1, zoomAt, clickAt, highlightAt });
      start += dur;
    }
  }
  close() { this.items.forEach((it) => it.video?.close()); }

  // A view is the part of the image on screen, at the screen's 16:10; bigger than the image leaves white margins.
  fit(r, img) {
    let w = r.w, h = r.h;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    let x = r.x + r.w / 2 - w / 2, y = r.y + r.h / 2 - h / 2;
    x = w <= img.w ? Math.min(Math.max(0, x), img.w - w) : (img.w - w) / 2;
    y = h <= img.h ? Math.min(Math.max(0, y), img.h - h) : (img.h - h) / 2;
    return { x, y, w, h };
  }
  // Default: a long page shows its top at full width; anything else is shown whole.
  defaultView(img) {
    if (img.h > (img.w / aspect) * 1.15) return { x: 0, y: 0, w: img.w, h: img.w / aspect };
    return this.fit({ x: 0, y: 0, w: img.w, h: img.h }, img);
  }
  camera(it, t) {
    if (!it.view1) return it.view0;
    const a = it.view0, b = it.view1, u = ease((t - it.zoomAt) / zoomTime);
    const w = a.w * Math.pow(b.w / a.w, u), h = w / aspect;
    const cx = a.x + a.w / 2 + (b.x + b.w / 2 - a.x - a.w / 2) * u, cy = a.y + a.h / 2 + (b.y + b.h / 2 - a.y - a.h / 2) * u;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  toScreen(p, v) { const s = screen.w / v.w; return { x: screen.x + (p.x - v.x) * s, y: screen.y + (p.y - v.y) * s }; }
  toScreenRect(r, v) { const a = this.toScreen(r, v), s = screen.w / v.w; return { x: a.x, y: a.y, w: r.w * s, h: r.h * s }; }

  async frame(time) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    const { intro, outro } = this.board;
    if (intro && time < this.introDur) return this.drawCard(c, intro, time, 1);
    const t = time - this.introDur;
    const i = this.items.findIndex((it) => t < it.start + it.dur);
    if (i >= 0) {
      const local = t - this.items[i].start;
      await this.drawScene(c, i, local);
      if (i === 0 && intro && local < cardFade) this.drawCard(c, intro, this.introDur, 1 - ease(local / cardFade));
      return;
    }
    if (!this.items.length) { if (outro) this.drawCard(c, outro, t, 1); return; } // cards only
    const last = this.items.length - 1, u = t - (this.items[last].start + this.items[last].dur);
    await this.drawScene(c, last, this.items[last].dur);
    if (outro) this.drawCard(c, outro, u, ease(u / cardFade));
  }

  async drawScene(c, i, t) {
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F5F7FA'); bg.addColorStop(1, '#E2EAF3');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const rise = i === 0 && this.board.intro ? 70 * (1 - ease(t / 0.9)) : 0; // the laptop rises in after the title
    c.save();
    c.translate(0, rise);
    this.drawLaptop(c);
    if (i > 0 && t < sceneFade) {
      await this.drawScreen(c, i - 1, this.items[i - 1].dur);
      const L = this.layer.getContext('2d');
      L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.clearRect(0, 0, W, H); L.translate(0, rise);
      await this.drawScreen(L, i, t);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = ease(t / sceneFade); c.drawImage(this.layer, 0, 0); c.restore();
    } else await this.drawScreen(c, i, t);
    this.drawCursor(c, i, t);
    c.restore();
    if (i > 0 && t < 0.35) this.drawCaption(c, i - 1, 1 - ease(t / 0.35), 0);
    const u = ease((t - 0.2) / 0.45);
    this.drawCaption(c, i, u, 18 * (1 - u));
  }

  drawLaptop(c) {
    const lid = inset(screen, -18);
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.22)'; c.shadowBlur = 60; c.shadowOffsetY = 24;
    fillRRect(c, lid.x, lid.y, lid.w, lid.h, 26, '#1B2027');
    c.restore();
    c.beginPath(); c.arc(lid.x + lid.w / 2, lid.y + 9, 4, 0, Math.PI * 2); c.fillStyle = '#3A4048'; c.fill();
    const base = { x: lid.x - 120, y: lid.y + lid.h - 2, w: lid.w + 240, h: 24 };
    const g = c.createLinearGradient(0, base.y, 0, base.y + base.h);
    g.addColorStop(0, '#E6EAEE'); g.addColorStop(1, '#AAB2BC');
    fillRRect(c, base.x, base.y, base.w, base.h, 12, g);
    fillRRect(c, base.x + base.w / 2 - 120, base.y, 240, 9, 4, '#97A0AA');
  }

  async drawScreen(c, i, t) {
    const it = this.items[i], v = this.camera(it, t), s = screen.w / v.w;
    const img = it.still ?? (await it.video.at(Math.min(t, it.dur)));
    c.save();
    c.beginPath(); rrect(c, screen.x, screen.y, screen.w, screen.h, 6); c.clip();
    c.fillStyle = '#fff'; c.fillRect(screen.x, screen.y, screen.w, screen.h);
    if (img) {
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(img, screen.x - v.x * s, screen.y - v.y * s, it.size.w * s, it.size.h * s);
    }
    const hb = box(it.scene.highlight);
    const a = hb && it.highlightAt != null ? ease((t - it.highlightAt) / 0.45) : 0;
    if (a > 0) {
      const r = inset(this.toScreenRect(hb, v), -10);
      c.beginPath(); c.rect(screen.x, screen.y, screen.w, screen.h); rrect(c, r.x, r.y, r.w, r.h, 12);
      c.fillStyle = `rgba(0,0,0,${0.45 * a})`; c.fill('evenodd');
      const pulse = (1 - ease((t - it.highlightAt) / 0.8)) * 16; // the ring snaps onto the target
      c.beginPath(); rrect(c, r.x - pulse, r.y - pulse, r.w + 2 * pulse, r.h + 2 * pulse, 12 + pulse);
      c.lineWidth = 5; c.strokeStyle = this.accent; c.globalAlpha = a; c.stroke(); c.globalAlpha = 1;
      if (it.scene.label) this.drawLabel(c, it.scene.label, r, a);
    }
    c.restore();
  }

  drawLabel(c, label, r, alpha) {
    c.font = font(26, 600);
    const ph = 26 * 1.3 + 16, pw = c.measureText(label).width + 36;
    let y = r.y - ph - 14;
    if (y < screen.y + 10) y = r.y + r.h + 14;
    if (y + ph > screen.y + screen.h - 10) y = r.y + 10;
    const x = Math.min(Math.max(r.x, screen.x + 12), screen.x + screen.w - pw - 12), py = y + 8 * (1 - alpha);
    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
    fillRRect(c, x, py, pw, ph, ph / 2, this.accent);
    c.shadowColor = 'transparent';
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, x + 18, py + ph / 2 + 1);
    c.restore();
  }

  cursorStart(i) {
    const prev = this.items[i - 1];
    if (prev?.scene.click) return this.toScreen({ x: prev.scene.click[0], y: prev.scene.click[1] }, this.camera(prev, prev.dur));
    return { x: screen.x + screen.w / 2 + 260, y: screen.y + screen.h - 110 };
  }
  drawCursor(c, i, t) {
    const it = this.items[i], click = it.scene.click;
    if (!click || it.clickAt == null) return;
    const target = this.toScreen({ x: click[0], y: click[1] }, this.camera(it, t)), from = this.cursorStart(i);
    const u = ease((t - (it.clickAt - moveTime)) / moveTime);
    const p = { x: from.x + (target.x - from.x) * u, y: from.y + (target.y - from.y) * u };
    const carried = i > 0 && this.items[i - 1].scene.click;
    const alpha = carried ? 1 : ease((t - (it.clickAt - moveTime - 0.3)) / 0.3);
    if (alpha <= 0) return;
    if (t >= it.clickAt && t - it.clickAt < 0.5) { // click ripple
      const k = (t - it.clickAt) / 0.5, rad = 12 + 40 * k;
      c.save(); c.globalAlpha = 0.5 * (1 - k); c.fillStyle = this.accent;
      c.beginPath(); c.arc(p.x, p.y, rad, 0, Math.PI * 2); c.fill(); c.restore();
    }
    const press = t >= it.clickAt && t - it.clickAt < 0.14 ? 0.86 : 1;
    c.save();
    c.globalAlpha = alpha; c.translate(p.x, p.y); c.scale(1.3 * press, 1.3 * press);
    c.beginPath();
    [[0, 0], [0, 30], [7.5, 23.5], [12.5, 35], [17, 33], [12, 21.5], [21.5, 21.5]].forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
    c.fillStyle = '#fff'; c.fill();
    c.shadowColor = 'transparent'; c.lineWidth = 1.6; c.strokeStyle = '#000'; c.stroke();
    c.restore();
  }

  drawCaption(c, i, alpha, dy) {
    const cap = this.items[i].scene.caption;
    if (!cap || alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.font = font(34, 600); const tw = Math.min(1400, c.measureText(cap.title).width);
    c.font = font(24, 400); const sw = cap.text ? Math.min(1400, c.measureText(cap.text).width) : 0;
    const steps = this.board.steps ?? true, circle = steps ? 52 : 0, gap = steps ? 22 : 0;
    const L1 = 46, L2 = cap.text ? 34 : 0, textH = L1 + (cap.text ? 2 + L2 : 0);
    const w = circle + gap + Math.max(tw, sw) + 64, h = Math.max(circle, textH) + 36;
    const x = (W - w) / 2, y = 930 + dy;
    c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 30; c.shadowOffsetY = 8;
    fillRRect(c, x, y, w, h, 18, '#fff');
    c.shadowColor = 'transparent';
    c.textBaseline = 'middle';
    if (steps) {
      const cx = x + 32 + circle / 2, cy = y + h / 2;
      c.beginPath(); c.arc(cx, cy, circle / 2, 0, Math.PI * 2); c.fillStyle = BLUE; c.fill();
      c.font = font(24, 600); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(String(i + 1), cx, cy + 1); c.textAlign = 'left';
    }
    const tx = x + 32 + circle + gap, ty = y + h / 2 - textH / 2;
    c.font = font(34, 600); c.fillStyle = NAVY; c.fillText(cap.title, tx, ty + L1 / 2, 1400);
    if (cap.text) { c.font = font(24, 400); c.fillStyle = MUTED; c.fillText(cap.text, tx, ty + L1 + 2 + L2 / 2, 1400); }
    c.restore();
  }

  // Title and outro cards: navy, the logo on a white badge (never recoloured), the logo's colours along the bottom.
  drawCard(c, card, t, alpha) {
    if (alpha <= 0) return;
    const L = this.cardLayer.getContext('2d');
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.clearRect(0, 0, W, H);
    const g = L.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#24507A'); g.addColorStop(1, NAVY);
    L.fillStyle = g; L.fillRect(0, 0, W, H);
    ['#7DCBC1', '#00BDCF', '#015C9A', '#FF5E00'].forEach((col, k) => { L.fillStyle = col; L.fillRect((k * W) / 4, H - 10, W / 4, 10); });
    const blocks = [];
    if (this.logo) {
      const lh = 60, lw = (this.logo.width * lh) / this.logo.height, bw = lw + 64, bh = lh + 40;
      blocks.push({ h: bh, gap: 56, draw: (y) => { fillRRect(L, (W - bw) / 2, y, bw, bh, 18, '#fff'); L.drawImage(this.logo, (W - bw) / 2 + 32, y + 20, lw, lh); } });
    }
    const lines = (text, size, weight, color, maxWidth, lineHeight, gap) => {
      L.font = font(size, weight);
      const ls = wrap(L, text, maxWidth), lh = size * lineHeight;
      blocks.push({ h: ls.length * lh, gap, draw: (y) => {
        L.font = font(size, weight); L.fillStyle = color; L.textAlign = 'center'; L.textBaseline = 'middle';
        ls.forEach((ln, k) => L.fillText(ln, W / 2, y + lh * k + lh / 2)); L.textAlign = 'left';
      } });
    };
    if (card.kicker) {
      const k = card.kicker.toUpperCase();
      blocks.push({ h: 34, gap: 18, draw: (y) => { L.font = font(24, 600); L.fillStyle = TEAL; L.textBaseline = 'middle'; spaced(L, k, (W - spacedWidth(L, k, 4)) / 2, y + 17, 4); } });
    }
    lines(card.title, 84, 700, '#fff', 1500, 1.15, 22);
    if (card.text) lines(card.text, 34, 400, '#C9D6E3', 1400, 1.4, 0);
    let y = (H - blocks.reduce((s, b) => s + b.h + b.gap, 0)) / 2;
    blocks.forEach((b, k) => {
      const u = ease((t - 0.15 - 0.12 * k) / 0.6);
      L.save(); L.globalAlpha = u; b.draw(y + 26 * (1 - u)); L.restore();
      y += b.h + b.gap;
    });
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.drawImage(this.cardLayer, 0, 0); c.restore();
  }
}

// --grid: the image (or a recording's frame) with lines every 100 px, labelled, heavier every 500 — read coordinates off it.
async function grid(input, out, t) {
  let img, w, h;
  if (/\.(mov|mp4|m4v|webm)$/i.test(input)) {
    const v = new VideoFrames(resolve(input), t, undefined, 1);
    img = await v.at(0); w = v.w; h = v.h; v.close();
  } else { img = await loadImage(resolve(input)); w = img.width; h = img.height; }
  const cv = createCanvas(w, h), c = cv.getContext('2d');
  c.drawImage(img, 0, 0, w, h);
  const fs = Math.max(12, w / 120);
  c.font = font(fs, 600); c.textBaseline = 'top';
  for (const [axis, length] of [[0, w], [1, h]]) {
    for (let v = 100; v < length; v += 100) {
      const major = v % 500 === 0;
      c.fillStyle = `rgba(255,0,153,${major ? 0.8 : 0.35})`;
      if (axis === 0) c.fillRect(v, 0, major ? 2 : 1, h); else c.fillRect(0, v, w, major ? 2 : 1);
      const label = String(v), lw = c.measureText(label).width;
      for (let k = 0; k < (axis === 0 ? h : w); k += 500) {
        const x = axis === 0 ? v + 3 : k + 3, y = axis === 0 ? k + 3 : v + 3;
        c.fillStyle = 'rgba(204,0,115,0.9)'; c.fillRect(x, y, lw + 8, fs * 1.3 + 2);
        c.fillStyle = '#fff'; c.fillText(label, x + 4, y + 1);
      }
    }
  }
  writeFileSync(out, await cv.encode('png'));
  console.log(`✓ ${out} — ${w}×${h} px`);
}

const args = process.argv.slice(2);
if (args[0] === '--grid' && args.length >= 3) { await grid(args[1], args[2], Number(args[3] ?? 0)); process.exit(0); }
if (args.length < 2) {
  console.log('usage: node demo_video.mjs <storyboard.json> <out.mp4> | <storyboard.json> --stills 2,6.5 <dir> | --grid <image|video> <out.png> [sec]');
  process.exit(1);
}
const boardPath = resolve(args[0]);
let board;
try { board = JSON.parse(readFileSync(boardPath, 'utf8')); } catch (e) { console.error(`storyboard: ${e.message}`); process.exit(1); }
const r = new Renderer(board, dirname(boardPath));
try { await r.load(); } catch (e) { console.error(e.message); process.exit(1); }

if (args[1] === '--stills' && args.length === 4) {
  mkdirSync(args[3], { recursive: true });
  for (const t of args[2].split(',').map(Number).filter((n) => !Number.isNaN(n))) {
    await r.frame(t);
    const out = join(args[3], `still-${t.toFixed(2).padStart(5, '0')}.png`);
    writeFileSync(out, await r.canvas.encode('png'));
    console.log(`✓ ${out}`);
  }
  console.log(`total ${r.total.toFixed(1)}s; scenes start at ${r.items.map((it) => (r.introDur + it.start).toFixed(1)).join(', ')}`);
  r.close();
  process.exit(0);
}

const out = resolve(args[1]);
const ff = spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`,
  '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.round(r.total * FPS);
for (let n = 0; n < frames; n++) {
  await r.frame(n / FPS);
  const px = Buffer.from(r.ctx.getImageData(0, 0, W, H).data); // a copy: the canvas memory can go before ffmpeg reads it
  if (!ff.stdin.write(px)) await once(ff.stdin, 'drain');
}
ff.stdin.end();
const [code] = await once(ff, 'close');
r.close();
console.log(code === 0 ? `✓ ${out} — ${board.scenes.length} scene(s), ${r.total.toFixed(1)}s` : `✗ ffmpeg exited with ${code}`);
process.exit(code === 0 ? 0 : 1);
