// Things that live on the island: resource nodes, buildings, sheep, pawns, effects.
import { Anim, drawFrame, img } from '../engine/assets.js';
import { NATURE, FX, BUILDINGS, buildingSrc, TILE, pawnArt } from '../data/art.js';

const T = TILE;
export const cx = (x) => x * T + T / 2;   // tile → world centre
export const cy = (y) => y * T + T / 2;
export const foot = (y) => y * T + T - 8; // tile → where feet stand

// ---------------------------------------------------------------- resource nodes
export class Tree {
  constructor(x, y, kind = 0) {
    this.kind = kind; this.x = x; this.y = y;
    this.max = 6; this.stock = this.max; this.regrow = 0;
    this.anim = new Anim(NATURE.trees[kind]); this.anim.t = Math.random() * 5;
    this.shake = 0; this.workers = 0;
  }
  get alive() { return this.stock > 0; }
  hit() { this.shake = 0.25; }
  take(world) {
    this.stock--;
    if (this.stock <= 0) { this.regrow = 90; world.fx(FX.dustBig, cx(this.x), foot(this.y)); }
  }
  update(dt) {
    this.anim.update(dt);
    if (this.shake > 0) this.shake -= dt;
    if (!this.alive) { this.regrow -= dt; if (this.regrow <= 0) this.stock = this.max; }
  }
  get sortY() { return foot(this.y); }
  draw(ctx) {
    const sx = this.shake > 0 ? Math.sin(this.shake * 60) * 2 : 0;
    if (this.alive) this.anim.draw(ctx, cx(this.x) + sx, foot(this.y) + 4);
    else drawFrame(ctx, NATURE.stumps[this.kind], 0, cx(this.x), foot(this.y) + 4);
  }
}

export class GoldStone {
  constructor(x, y, size = 3) {
    this.x = x; this.y = y; this.size = size;           // 1..6 → art variant and stock
    this.max = 4 + size * 3; this.stock = this.max; this.regrow = 0; this.shine = new Anim(NATURE.goldShine[size - 1]);
    this.shineWait = 2 + Math.random() * 6; this.workers = 0; this.shake = 0;
  }
  get alive() { return this.stock > 0; }
  hit() { this.shake = 0.2; }
  take(world) {
    this.stock--;
    if (this.stock <= 0) { this.regrow = 150; world.fx(FX.dust, cx(this.x), foot(this.y)); }
  }
  update(dt) {
    if (this.shake > 0) this.shake -= dt;
    if (!this.alive) { this.regrow -= dt; if (this.regrow <= 0) this.stock = this.max; return; }
    this.shineWait -= dt;
    if (this.shineWait <= 0) { this.shine.update(dt); if (this.shine.loops >= 1) { this.shine.t = 0; this.shineWait = 3 + Math.random() * 6; } }
  }
  get sortY() { return foot(this.y); }
  draw(ctx) {
    if (!this.alive) { drawFrame(ctx, NATURE.rocks[1], 0, cx(this.x), foot(this.y), false, 0.9); return; }
    const sx = this.shake > 0 ? Math.sin(this.shake * 70) * 2 : 0;
    const def = this.shineWait <= 0 ? NATURE.goldShine[this.size - 1] : NATURE.goldStones[this.size - 1];
    drawFrame(ctx, def, this.shineWait <= 0 ? this.shine.frame : 0, cx(this.x) + sx, foot(this.y));
  }
}

// ---------------------------------------------------------------- buildings
export class Building {
  constructor(type, x, y, { progress = 1, variant = 0, color = 'Blue' } = {}) {
    this.type = type; this.def = BUILDINGS[type];
    this.x = x; this.y = y; this.w = this.def.w; this.h = this.def.h;
    this.progress = progress; this.variant = variant; this.color = color;
    const file = this.def.variants ? this.def.variants[variant % this.def.variants.length] : this.def.file;
    this.src = buildingSrc(file, color);
    this.workers = 0;
  }
  get done() { return this.progress >= 1; }
  get door() { return { x: this.x + Math.floor(this.w / 2), y: this.y + 1 }; }
  cells() {
    const out = [];
    for (let i = 0; i < this.w; i++) for (let j = 0; j < this.h; j++) out.push({ x: this.x + i, y: this.y - j });
    return out;
  }
  contains(wx, wy) {
    const im = img(this.src); if (!im) return false;
    const left = (this.x + this.w / 2) * T - im.width / 2, bottom = (this.y + 1) * T + this.def.sink;
    return wx >= left && wx <= left + im.width && wy >= bottom - im.height && wy <= bottom;
  }
  update() {}
  get sortY() { return (this.y + 1) * T - 4; }
  draw(ctx) {
    const im = img(this.src); if (!im) return;
    const left = Math.round((this.x + this.w / 2) * T - im.width / 2);
    const bottom = (this.y + 1) * T + this.def.sink;
    if (this.done) { ctx.drawImage(im, left, bottom - im.height); return; }
    // under construction: faded silhouette, with the built part revealed from the bottom up
    ctx.globalAlpha = 0.35; ctx.drawImage(im, left, bottom - im.height); ctx.globalAlpha = 1;
    const shown = Math.floor(im.height * this.progress);
    if (shown > 0) ctx.drawImage(im, 0, im.height - shown, im.width, shown, left, bottom - shown, im.width, shown);
  }
  // progress bar for buildings under construction
  drawOver(ctx) {
    if (this.done) return;
    const im = img(this.src); if (!im) return;
    const x = (this.x + this.w / 2) * T - 40, y = (this.y + 1) * T + this.def.sink - im.height - 14;
    ctx.fillStyle = 'rgba(30,30,40,.6)'; ctx.fillRect(x, y, 80, 10);
    ctx.fillStyle = '#f5d76e'; ctx.fillRect(x + 2, y + 2, 76 * this.progress, 6);
  }
}

// ---------------------------------------------------------------- sheep
export class Sheep {
  constructor(world, x, y) {
    this.world = world; this.px = cx(x); this.py = foot(y);
    this.anim = new Anim(NATURE.sheepIdle); this.anim.t = Math.random() * 3;
    this.state = 'idle'; this.wait = 1 + Math.random() * 4; this.flip = Math.random() < 0.5;
    this.target = null; this.claimed = null; this.gone = false;
  }
  get tx() { return Math.floor(this.px / T); }
  get ty() { return Math.floor(this.py / T); }
  update(dt) {
    this.anim.update(dt);
    if (this.claimed) { this.anim.set(NATURE.sheepIdle); return; }
    if (this.state === 'idle' || this.state === 'graze') {
      this.wait -= dt;
      if (this.wait <= 0) {
        const r = Math.random();
        if (r < 0.35) { this.state = 'graze'; this.anim.set(NATURE.sheepGrass); this.wait = 1.2 + Math.random() * 2; }
        else if (r < 0.8) {
          const p = this.world.randomPenTile();
          if (p) { this.target = { x: cx(p.x) + (Math.random() - .5) * 30, y: foot(p.y) }; this.state = 'walk'; this.anim.set(NATURE.sheepMove); }
          else this.wait = 1;
        } else { this.state = 'idle'; this.anim.set(NATURE.sheepIdle); this.wait = 2 + Math.random() * 3; }
      }
    } else if (this.state === 'walk') {
      const dx = this.target.x - this.px, dy = this.target.y - this.py, d = Math.hypot(dx, dy);
      if (d < 2) { this.state = 'idle'; this.anim.set(NATURE.sheepIdle); this.wait = 2 + Math.random() * 4; return; }
      const sp = 26 * dt;
      this.px += dx / d * Math.min(sp, d); this.py += dy / d * Math.min(sp, d);
      if (Math.abs(dx) > 1) this.flip = dx < 0;
    }
  }
  get sortY() { return this.py; }
  draw(ctx) { this.anim.draw(ctx, this.px, this.py, this.flip); }
}

// ---------------------------------------------------------------- one-shot effects & floating text
export class Fx {
  constructor(def, x, y) { this.anim = new Anim(def, 12, false); this.x = x; this.y = y; }
  get gone() { return this.anim.done; }
  update(dt) { this.anim.update(dt); }
  get sortY() { return this.y + 1; }
  draw(ctx) { this.anim.draw(ctx, this.x, this.y); }
}

export class FloatText {
  constructor(text, x, y, icon) { this.text = text; this.x = x; this.y = y; this.t = 0; this.icon = icon; }
  get gone() { return this.t > 1.3; }
  update(dt) { this.t += dt; }
  get sortY() { return 1e9; }
  draw(ctx) {
    const a = Math.min(1, (1.3 - this.t) * 3), y = this.y - 30 - this.t * 34;
    ctx.globalAlpha = a;
    if (this.icon) { const im = img(this.icon); if (im) ctx.drawImage(im, this.x - 40, y - 30, 40, 40); }
    ctx.font = '28px BoldPixels, sans-serif';
    ctx.lineWidth = 6; ctx.strokeStyle = '#2a2420'; ctx.fillStyle = '#fff6d8';
    ctx.strokeText(this.text, this.x, y); ctx.fillText(this.text, this.x, y);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- decorations
export class Decor {
  constructor(def, x, y, { fps = 8, ox = 0, oy = 0, bob = false } = {}) {
    this.anim = new Anim(def, fps); this.anim.t = Math.random() * 3;
    this.px = cx(x) + ox; this.py = foot(y) + oy; this.bob = bob; this.flat = !!def.flat;
  }
  update(dt) { this.anim.update(dt); }
  get sortY() { return this.py - 20; }
  draw(ctx) {
    const b = this.bob ? Math.sin(this.anim.t * 2) * 2 : 0;
    this.anim.draw(ctx, this.px, this.py + b);
  }
}

export { pawnArt };
