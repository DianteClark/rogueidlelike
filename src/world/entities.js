// Things that live on the island: resource nodes, buildings, sheep, pawns, effects.
import { Anim, drawFrame, img, tintSheet } from '../engine/assets.js';
import { NATURE, FX, BUILDINGS, buildingArt, TILE } from '../data/art.js';

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
  constructor(type, x, y, { progress = 1, variant = 0, color = 'Blue', set = null } = {}) {
    this.type = type; this.def = BUILDINGS[type];
    this.x = x; this.y = y; this.w = this.def.w; this.h = this.def.h;
    this.progress = progress; this.variant = variant; this.color = color; this.set = set;
    this.art = buildingArt(type, { color, set, variant });
    this.src = this.art.src; this.name = this.art.name; this.sink = this.art.sink;
    this.workers = 0;
  }
  // animated sheets (goblin hut smoke, cave eyes) get one frame per fw pixels
  frameRect(im) {
    const fw = this.art.fw || im.width, n = Math.max(1, Math.floor(im.width / fw));
    const f = n > 1 ? Math.floor(performance.now() / 110) % n : 0;
    return { sx: f * fw, fw };
  }
  get done() { return this.progress >= 1; }
  get working() { return this.done && !this.wrecked; }
  get door() { return { x: this.x + Math.floor(this.w / 2), y: this.y + 1 }; }
  cells() {
    const out = [];
    for (let i = 0; i < this.w; i++) for (let j = 0; j < this.h; j++) out.push({ x: this.x + i, y: this.y - j });
    return out;
  }
  contains(wx, wy) {
    const im = img(this.src); if (!im) return false;
    const { fw } = this.frameRect(im);
    const left = (this.x + this.w / 2) * T - fw / 2, bottom = (this.y + 1) * T + this.sink;
    return wx >= left && wx <= left + fw && wy >= bottom - im.height && wy <= bottom;
  }
  update() {}
  get sortY() { return (this.y + 1) * T - 4; }
  draw(ctx) {
    const im = img(this.src); if (!im) return;
    const { sx, fw } = this.frameRect(im), h = im.height;
    const left = Math.round((this.x + this.w / 2) * T - fw / 2);
    const bottom = (this.y + 1) * T + this.sink;
    if (this.done) {
      ctx.drawImage(im, sx, 0, fw, h, left, bottom - h, fw, h);
      if (this.wrecked) { const d = tintSheet(this.src, '#1a1412'); if (d) { ctx.globalAlpha = 0.5; ctx.drawImage(d, sx, 0, fw, h, left, bottom - h, fw, h); ctx.globalAlpha = 1; } }
      return;
    }
    // under construction: faded silhouette, with the built part revealed from the bottom up
    ctx.globalAlpha = 0.35; ctx.drawImage(im, sx, 0, fw, h, left, bottom - h, fw, h); ctx.globalAlpha = 1;
    const shown = Math.floor(h * this.progress);
    if (shown > 0) ctx.drawImage(im, sx, h - shown, fw, shown, left, bottom - shown, fw, shown);
  }
  // progress bar for buildings under construction
  drawOver(ctx) {
    if (this.wrecked) {
      const t = performance.now() / 100, bx = (this.x + this.w / 2) * T, by = (this.y + 1) * T;
      drawFrame(ctx, FX.fire, Math.floor(t), bx - 30, by - 20);
      drawFrame(ctx, FX.fire, Math.floor(t) + 3, bx + 26, by - 44);
      if (this.repair) {
        ctx.fillStyle = 'rgba(30,30,40,.6)'; ctx.fillRect(bx - 40, by - 110, 80, 10);
        ctx.fillStyle = '#8fd16a'; ctx.fillRect(bx - 38, by - 108, 76 * this.repair, 6);
      }
      return;
    }
    if (this.done) return;
    const im = img(this.src); if (!im) return;
    const x = (this.x + this.w / 2) * T - 40, y = (this.y + 1) * T + this.sink - im.height - 14;
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
    this.px = cx(x) + ox; this.py = foot(y) + oy; this.bob = bob;
  }
  update(dt) { this.anim.update(dt); }
  get sortY() { return this.py - 20; }
  draw(ctx) {
    const b = this.bob ? Math.sin(this.anim.t * 2) * 2 : 0;
    this.anim.draw(ctx, this.px, this.py + b);
  }
}

// The rubber duck: bobs around the coast. Tap it for a little treasure; sometimes it's golden.
export class Duck {
  constructor(world) {
    this.world = world; this.anim = new Anim(NATURE.duck, 4);
    this.visible = false; this.wait = 20 + Math.random() * 40; this.golden = false;
  }
  waterSpots() {
    if (this.spots) return this.spots;
    const tr = this.world.terrain, out = [];
    for (let y = 1; y < tr.h - 1; y++) for (let x = 1; x < tr.w - 1; x++) {
      if (tr.land[y][x] || tr.cliff[y][x]) continue;
      let near = false, touch = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tr.land[y + dy]?.[x + dx]) { near = true; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) touch = true; }
      if (near && !touch) out.push({ x, y });
    }
    return (this.spots = out);
  }
  appear() {
    const s = this.waterSpots(); if (!s.length) return;
    const p = s[Math.floor(Math.random() * s.length)];
    this.px = cx(p.x); this.py = foot(p.y) - 20; this.goal = null;
    this.golden = Math.random() < 0.1;
    this.visible = true; this.life = 90 + Math.random() * 60;
    this.world.fx(FX.splash, this.px, this.py + 20);
  }
  update(dt) {
    this.anim.update(dt);
    if (!this.visible) { this.wait -= dt; if (this.wait <= 0) this.appear(); return; }
    this.life -= dt;
    if (this.life <= 0) { this.visible = false; this.wait = 120 + Math.random() * 180; return; }
    if (!this.goal || Math.hypot(this.goal.x - this.px, this.goal.y - this.py) < 3) {
      const s = this.waterSpots(), p = s[Math.floor(Math.random() * s.length)];
      if (Math.hypot(cx(p.x) - this.px, foot(p.y) - this.py) < 400) this.goal = { x: cx(p.x), y: foot(p.y) - 20 };
      return;
    }
    const dx = this.goal.x - this.px, dy = this.goal.y - this.py, d = Math.hypot(dx, dy);
    this.px += dx / d * 14 * dt; this.py += dy / d * 14 * dt; this.flip = dx < 0;
  }
  hit(wx, wy) {
    if (!this.visible || Math.hypot(wx - this.px, wy - this.py + 10) > 46) return false;
    this.visible = false; this.wait = 180 + Math.random() * 240;
    this.world.fx(FX.splash, this.px, this.py + 20);
    this.world.duckReward(this.golden, this.px, this.py);
    return true;
  }
  get sortY() { return this.py; }
  draw(ctx) {
    const b = Math.sin(this.anim.t * 2.5) * 2;
    ctx.save(); ctx.translate(this.px, this.py + b); ctx.scale(2, 2);
    drawFrame(ctx, NATURE.duck, this.anim.frame, 0, 0, this.flip);
    if (this.golden) {
      if (!Duck.gold) {
        const im = img(NATURE.duck.src);
        if (im) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
          g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,205,60,.65)'; g.fillRect(0, 0, c.width, c.height); Duck.gold = c; }
      }
      if (Duck.gold) drawFrame(ctx, NATURE.duck, this.anim.frame, 0, 0, this.flip, 1, Duck.gold);
    }
    ctx.restore();
    if (this.golden && Math.floor(this.anim.t * 3) % 2) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(this.px + 18, this.py - 44, 4, 4); ctx.fillRect(this.px - 22, this.py - 30, 3, 3); }
  }
}

