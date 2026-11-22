// Image loading + simple sprite-strip animation helpers.
const cache = new Map();

export function img(src) {
  return cache.get(src)?.image;
}

export function load(src) {
  if (cache.has(src)) return cache.get(src).promise;
  const image = new Image();
  const promise = new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load ' + src));
  });
  image.src = encodeURI(src);
  cache.set(src, { image, promise });
  return promise;
}

// Collect every { src } found anywhere inside an object tree.
export function collectSrcs(obj, out = new Set()) {
  if (!obj || typeof obj !== 'object') return out;
  if (typeof obj.src === 'string') out.add(obj.src);
  for (const v of Object.values(obj)) if (v && typeof v === 'object') collectSrcs(v, out);
  return out;
}

export async function loadAll(srcs, onProgress) {
  const list = [...srcs];
  let done = 0;
  await Promise.all(list.map((s) => load(s).catch((e) => console.warn(e.message)).finally(() => onProgress?.(++done / list.length))));
}

export function frameCount(def) {
  const im = img(def.src);
  if (!im || !def.fw) return 1;
  return Math.max(1, Math.floor(im.width / def.fw));
}

// Draw frame `f` of a strip with its anchor at (x, y). flip mirrors horizontally around the anchor.
export function drawFrame(ctx, def, f, x, y, flip = false, alpha = 1, override = null) {
  const im = override || img(def.src);
  if (!im) return;
  const fw = def.fw || im.width, fh = def.fh || im.height;
  const n = def.fw ? Math.max(1, Math.floor(im.width / fw)) : 1;
  const sx = ((f % n) + n) % n * fw;
  const ax = def.ax ?? fw / 2, ay = def.ay ?? fh;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(im, sx, 0, fw, fh, -ax, -ay, fw, fh);
    ctx.restore();
  } else {
    ctx.drawImage(im, sx, 0, fw, fh, Math.round(x - ax), Math.round(y - ay), fw, fh);
  }
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// A playing animation: tracks time and returns the current frame.
export class Anim {
  constructor(def, fps = 10, loop = true) { this.set(def, fps, loop); }
  set(def, fps = 10, loop = true) {
    if (this.def === def) return this;
    this.def = def; this.fps = fps; this.loop = loop; this.t = 0; this.done = false;
    return this;
  }
  update(dt) { this.t += dt; }
  get frame() {
    const n = frameCount(this.def);
    const f = Math.floor(this.t * this.fps);
    if (!this.loop && f >= n) { this.done = true; return n - 1; }
    return f % n;
  }
  // true once per completed loop
  get loops() { return Math.floor(this.t * this.fps / frameCount(this.def)); }
  draw(ctx, x, y, flip, alpha) { drawFrame(ctx, this.def, this.frame, x, y, flip, alpha); }
}

// A pure-white copy of a sprite sheet, used to flash units when they take a hit.
const whiteCache = new Map();
export function whiteSheet(src) {
  if (whiteCache.has(src)) return whiteCache.get(src);
  const im = img(src); if (!im || !im.complete) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  whiteCache.set(src, c);
  return c;
}
