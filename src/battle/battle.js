// Auto-battle: your campaign team vs a stage of enemies on a small island arena.
// Units pick targets, walk into range, attack on their animation's hit frame, and die in a puff.
// The player can fire the King's Rally, change speed, or retreat.
import { Anim, drawFrame, frameCount, img, whiteSheet, loadAll, collectSrcs } from '../engine/assets.js';
import { Terrain } from '../world/terrain.js';
import { rng } from '../world/generate.js';
import { TILE, FX, TERRAIN, NATURE } from '../data/art.js';
import { ENEMIES, stageEnemies, stageScale, regionOf } from '../data/units.js';
import { heroStats, heroDef, canFight } from '../game/heroes.js';
import { teamSynergies, applyBonuses } from '../game/synergy.js';
import { mod, KINGDOMS } from '../data/kingdoms.js';

const T = TILE;
export const ARENA_W = 10, ARENA_H = 16;
const RALLY_CHARGE = 14; // seconds to fill the King's meter

// Arena layout. With a hill, the enemy side has a plateau (rows 2-4) whose cliff faces your heroes;
// the only way up is a staircase on one side.
function arenaMap(seed, hill) {
  const R = rng(seed);
  const left = R() < 0.5;
  const px0 = left ? 3 : 2, px1 = left ? 7 : 6;           // plateau columns
  const sx = left ? px0 - 1 : px1 + 1;                     // stair column
  const rows = [];
  for (let y = 0; y < ARENA_H; y++) {
    let row = '';
    for (let x = 0; x < ARENA_W; x++) {
      const edge = x === 0 || y === 0 || x === ARENA_W - 1 || y === ARENA_H - 1;
      const nearEdge = x === 1 || y === 1 || x === ARENA_W - 2 || y === ARENA_H - 2;
      let c = edge || (nearEdge && R() < 0.3 && !(hill && y <= 6)) ? '.' : 'g';
      if (hill && y >= 2 && y <= 4 && x >= px0 && x <= px1) c = 'h';
      if (hill && y === 4 && x === sx) c = 's';
      if (hill && y >= 1 && y <= 6 && (x === 1 || x === ARENA_W - 2)) c = 'g';
      row += c;
    }
    rows.push(row);
  }
  return rows;
}

const headFor = (def) => ({ 192: 74, 256: 100, 320: 118, 384: 200 }[def.fh] || 80);

export class Unit {
  constructor(b, side, kind, art, stats, x, y, extra = {}) {
    this.b = b; this.side = side; this.kind = kind; this.art = art;
    this.s = stats; this.hp = stats.hp; this.max = stats.hp;
    this.x = x; this.y = y; this.flip = side === 'enemy';
    this.anim = new Anim(art.idle); this.anim.t = Math.random();
    this.cool = 0.3 + Math.random() * 0.6; this.state = 'idle'; this.target = null;
    this.flash = 0; this.dead = false; this.fade = 1; this.shield = 0; this.hitDone = false;
    this.attackIdx = 0;
    Object.assign(this, extra);
    this.head = headFor(art.idle) * (this.scale || 1);
  }
  get alive() { return !this.dead; }
  get sortY() { return this.y; }
  get px() { return this.x; }
  get foes() { return this.side === 'hero' ? this.b.enemies : this.b.heroes; }
  get friends() { return this.side === 'hero' ? this.b.heroes : this.b.enemies; }

  update(dt) {
    this.anim.update(dt);
    if (this.flash > 0) this.flash -= dt * 4;
    if (this.dead) { this.fade -= dt * (this.art.dead ? 0.35 : 1.4); return; }
    this.cool -= dt * this.rateMul();
    if (this.regen) this.heal(this.max * this.regen * dt, true);

    let healer = false;
    if (this.s.heal) {
      const hurt = this.friends.filter((u) => u.alive && u.hp < u.max * 0.95).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
      if (hurt) { this.target = hurt; healer = true; }
      else if (!this.target || this.target.dead || this.target.side === this.side) this.target = this.nearest(this.foes);
    } else if (!this.target || this.target.dead) {
      this.target = this.nearest(this.foes);
    }
    this.healing = healer;
    if (this.state !== 'attack' && this.b.steer?.(this, dt)) return;
    const t = this.target;
    if (this.state === 'attack') {
      const n = frameCount(this.anim.def);
      const f = Math.floor(this.anim.t * 10);
      if (!this.hitDone && f >= Math.min(this.art.hitFrame, n - 1)) { this.hitDone = true; this.strike(); }
      if (f >= n) { this.state = 'idle'; this.anim.set(this.art.idle); }
      return;
    }
    if (!t) { this.anim.set(this.art.idle); return; }
    const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 4) this.flip = dx < 0;
    const hi = this.b.levelAt?.(this.x, this.y) > 0 && this.s.range > 2 ? 1.5 : 0; // high ground: ranged units see farther
    const reach = ((healer || !this.s.heal ? this.s.range : 1) + hi) * T * 0.75 + 26;
    const wp = this.b.waypoint?.(this, t);
    if (wp && !(this.s.range > 2 && d <= reach)) {
      const wx = wp.x - this.x, wy = wp.y - this.y, wd = Math.hypot(wx, wy) || 1;
      this.move(wx / wd, wy / wd, dt); return;
    }
    if (d > reach) { this.move(dx / d, dy / d, dt); return; }
    if (this.cool <= 0) {
      this.state = 'attack'; this.hitDone = false; this.anim.def = null;
      const atk = this.art.attack[this.attackIdx++ % this.art.attack.length];
      this.anim.set(atk, 10, false);
      this.cool = this.s.rate;
    } else this.anim.set(this.art.idle);
  }

  move(nx, ny, dt) {
    this.anim.set(this.art.run);
    let vx = nx * this.s.speed, vy = ny * this.s.speed;
    // keep a little personal space from friends
    for (const o of this.friends) {
      if (o === this || o.dead) continue;
      const ox = this.x - o.x, oy = this.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < 50) { vx += ox / od * 70; vy += oy / od * 70; }
    }
    const nx2 = this.x + vx * dt, ny2 = this.y + vy * dt;
    if (this.b.canStand(nx2, ny2, this)) { this.x = nx2; this.y = ny2; }
    else if (this.b.canStand(nx2, this.y, this)) this.x = nx2;
    else if (this.b.canStand(this.x, ny2, this)) this.y = ny2;
  }

  nearest(list) {
    let best = null, bd = Infinity;
    for (const u of list) { if (u.dead) continue; const d = Math.hypot(u.x - this.x, u.y - this.y); if (d < bd) { bd = d; best = u; } }
    return best;
  }

  rateMul() { return (1 + (this.haste || 0)) * (this.frenzy && this.hp < this.max / 2 ? 1 + this.frenzy : 1); }

  strike() {
    const t = this.target; if (!t || t.dead) return;
    if (this.healing) {
      if (t.side !== this.side) return;
      t.heal(this.s.heal);
      if (this.art.healFx) this.b.fx(this.art.healFx, t.x, t.y);
      return;
    }
    const proj = this.projectile;
    if (proj) { this.b.projectiles.push(new Projectile(this, t, proj)); return; }
    if (t.side === 'castle') { this.b.damage(this, t); if (this.art.splash) this.b.shake = 0.35; return; }
    const targets = this.art.splash ? this.foes.filter((u) => !u.dead && Math.hypot(u.x - t.x, u.y - t.y) < this.art.splash * T) : [t];
    for (const u of targets) this.b.damage(this, u);
    if (this.art.splash) this.b.shake = 0.35;
  }

  heal(n, quiet) {
    if (this.dead) return;
    const before = this.hp;
    this.hp = Math.min(this.max, this.hp + n);
    if (!quiet && this.hp - before >= 1) this.b.text('+' + Math.round(this.hp - before), this.x, this.y - this.head, '#8af08a');
  }

  draw(ctx) {
    if (this.fade <= 0) return;
    const def = this.dead && this.art.dead ? this.art.dead : this.anim.def;
    const frame = this.dead && this.art.dead ? Math.min(Math.floor(this.anim.t * 10), frameCount(def) - 1) : this.anim.frame;
    const a = this.dead ? Math.max(0, Math.min(1, this.fade)) : 1;
    // shadow
    ctx.fillStyle = 'rgba(20,40,40,.22)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y - 2, 22 * (this.scale || 1), 7 * (this.scale || 1), 0, 0, Math.PI * 2); ctx.fill();
    // team ring so your monster heroes never get mixed up with enemy monsters
    if (!this.dead) {
      ctx.globalAlpha = 0.85; ctx.lineWidth = 3;
      ctx.strokeStyle = this.side === 'hero' ? (this.b.ringColor || '#7fd6ff') : '#e05a4a';
      ctx.beginPath(); ctx.ellipse(this.x, this.y - 2, 24 * (this.scale || 1), 8 * (this.scale || 1), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.scale && this.scale !== 1) {
      ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.scale, this.scale);
      drawFrame(ctx, def, frame, 0, 0, this.flip, a);
      if (this.flash > 0) { const w = whiteSheet(def.src); if (w) drawFrame(ctx, def, frame, 0, 0, this.flip, Math.min(1, this.flash) * 0.8, w); }
      ctx.restore();
    } else {
      drawFrame(ctx, def, frame, this.x, this.y, this.flip, a);
      if (this.flash > 0) { const w = whiteSheet(def.src); if (w) drawFrame(ctx, def, frame, this.x, this.y, this.flip, Math.min(1, this.flash) * 0.8, w); }
    }
  }

  drawBar(ctx) {
    if (this.dead) return;
    const w = this.boss ? 90 : 44, x = this.x - w / 2, y = this.y - this.head - 10;
    ctx.fillStyle = 'rgba(25,25,35,.7)'; ctx.fillRect(x - 2, y - 2, w + 4, 10);
    ctx.fillStyle = this.side === 'hero' ? '#6fd16a' : '#e05a4a';
    ctx.fillRect(x, y, w * Math.max(0, this.hp / this.max), 6);
    if (this.shield > 0) { ctx.fillStyle = '#9fd3ff'; ctx.fillRect(x, y - 4, w * Math.min(1, this.shield / this.max), 3); }
  }
}

export class Projectile {
  constructor(from, to, p) {
    this.from = from; this.to = to; this.p = p;
    this.x = from.x + (from.flip ? -20 : 20); this.y = from.y - from.head * 0.55;
    this.t = 0; this.done = false;
  }
  update(dt, b) {
    this.t += dt;
    const tx = this.to.x, ty = this.to.y - this.to.head * 0.5;
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    const step = this.p.speed * dt;
    this.angle = Math.atan2(dy, dx);
    if (d <= step || this.to.dead) { this.done = true; if (!this.to.dead) b.damage(this.from, this.to); return; }
    this.x += dx / d * step; this.y += dy / d * step;
  }
  draw(ctx) {
    const im = img(this.p.src); if (!im) return;
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.p.rotate) ctx.rotate(this.angle);
    if (this.p.spin) {
      const n = Math.max(1, Math.floor(im.width / (this.p.fw || im.height)));
      const f = Math.floor(this.t * 14) % n, fw = this.p.fw || im.height;
      ctx.drawImage(im, f * fw, 0, fw, im.height, -fw / 2, -im.height / 2, fw, im.height);
    } else ctx.drawImage(im, -im.width / 2, -im.height / 2);
    ctx.restore();
  }
}

class Fx {
  constructor(def, x, y) { this.anim = new Anim(def, 12, false); this.x = x; this.y = y; }
  update(dt) { this.anim.update(dt); }
  get done() { return this.anim.done; }
  draw(ctx) { this.anim.draw(ctx, this.x, this.y); }
}

export class Battle {
  constructor({ world, stage, onEnd }) {
    const ro = regionOf(stage);
    this.world = world; this.regionIdx = ro.idx; this.stage = stage; this.local = ro.local; this.onEnd = onEnd;
    this.region = ro.region;
    this.hill = ro.local % 2 === 0 && !ro.boss;
    this.terrain = new Terrain(arenaMap(stage * 977 + 13, this.hill), { color: this.region.terrain, highColor: this.region.terrain === 4 ? 1 : 3 });
    if (this.hill) for (let y = 0; y < ARENA_H; y++) for (let x = 0; x < ARENA_W; x++) if (this.terrain.stair[y][x] === 1) this.stairTop = { x, y };
    this.time = 0; this.speed = 1; this.rally = 0; this.rallyBuff = 0; this.over = null; this.shake = 0;
    this.heroes = []; this.enemies = []; this.projectiles = []; this.effects = []; this.texts = [];
    this.decor = [];
  }

  // Load every sprite this fight needs, then set up the board.
  async prepare() {
    const w = this.world, k = w.kingdom;
    const team = w.team.map((id) => w.hero(id)).filter((h) => h && canFight(h));
    this.team = team;
    const enemyIds = stageEnemies(this.regionIdx, this.local);
    const srcs = collectSrcs({ fx: FX, t: [TERRAIN.tilemap(this.region.terrain), TERRAIN.foam, TERRAIN.shadow], d: [NATURE.bushes, NATURE.rocks] });
    for (const h of team) { const c = heroDef(h.cls); collectSrcs(c.art(h.color), srcs); if (c.projectile) srcs.add(c.projectile.src); }
    for (const id of enemyIds) { const e = ENEMIES[id]; collectSrcs(e.art, srcs); if (e.projectile) srcs.add(e.projectile.src); }
    await loadAll(srcs);
    this.terrain.buildStatic();

    // heroes: tanks in front, damage behind, ranged and support at the back
    const order = { Tank: 0, Melee: 1, Ranged: 2, Support: 3 };
    team.sort((a, b) => order[heroDef(a.cls).role] - order[heroDef(b.cls).role]);
    const rows = { Tank: 11.4, Melee: 12, Ranged: 13.2, Support: 13.4 };
    const dmg = mod(k, 'heroDamage');
    this.synergy = teamSynergies(team, k);
    this.ringColor = KINGDOMS[k]?.hex;
    team.forEach((h, i) => {
      const c = heroDef(h.cls), st = heroStats(h);
      st.atk = Math.round(st.atk * dmg * (1 + (w.relicBonus || 0)));
      const x = (1.8 + (i + 0.5) * ((ARENA_W - 3.6) / team.length)) * T;
      const u = new Unit(this, 'hero', h.cls, c.art(h.color), st, x, rows[c.role] * T, { projectile: c.projectile, hero: h });
      applyBonuses(u, h, this.synergy, k);
      this.heroes.push(u);
    });

    const scale = stageScale(this.stage);
    enemyIds.forEach((id, i) => {
      const e = ENEMIES[id];
      const sc = e.boss ? 1 : scale; // bosses are tuned by hand
      const st = { ...e.stats, hp: Math.round(e.stats.hp * sc), atk: Math.round(e.stats.atk * sc), def: Math.round(e.stats.def * sc) };
      const cols = Math.min(enemyIds.length, 4), row = Math.floor(i / cols);
      const x = e.boss ? (ARENA_W / 2) * T : (1.8 + ((i % cols) + 0.5) * ((ARENA_W - 3.6) / cols)) * T;
      let y = e.boss ? 3.6 * T : (3.2 + row * 1.2) * T;
      // with a hill, ranged foes hold the high ground and melee foes wait below the cliff
      if (this.hill && !e.boss) y = (e.stats.range > 2 ? 3.4 : 6.9 + row * 0.6) * T;
      this.enemies.push(new Unit(this, 'enemy', id, e.art, st, x, y, { projectile: e.projectile, boss: e.boss, scale: e.scale }));
    });

    // a few decorations around the edges
    const R = rng(this.stage * 31 + 7);
    for (let i = 0; i < 5; i++) {
      const x = R() < 0.5 ? 1 : ARENA_W - 2, y = 2 + Math.floor(R() * (ARENA_H - 4));
      if (this.terrain.land[y][x] && !(this.hill && y <= 6)) this.decor.push({ def: R() < 0.6 ? NATURE.bushes[i % 4] : NATURE.rocks[i % 4], x: x * T + 32, y: y * T + 56, anim: new Anim(R() < 0.6 ? NATURE.bushes[i % 4] : NATURE.rocks[i % 4], 8) });
    }
    return team.length > 0;
  }

  // terrain: level of the tile under a point (0 ground, 1 plateau), and where you can stand
  levelAt(x, y) {
    if (!this.hill) return 0;
    const tx = Math.floor(x / T), ty = Math.floor((y - 4) / T);
    return this.terrain.inside(tx, ty) ? this.terrain.level[ty][tx] : -9;
  }
  canStand(x, y, u) {
    if (!this.hill) return x > 1.4 * T && x < (ARENA_W - 1.4) * T && y > 2 * T && y < (ARENA_H - 1.2) * T;
    const tr = this.terrain, tx = Math.floor(x / T), ty = Math.floor((y - 4) / T);
    if (!tr.inside(tx, ty) || tr.level[ty][tx] < 0) return false;
    if (!u) return true;
    const cx = Math.floor(u.x / T), cy = Math.floor((u.y - 4) / T);
    if (!tr.inside(cx, cy) || tr.level[cy][cx] === tr.level[ty][tx]) return true;
    return !!(tr.stair[ty][tx] || tr.stair[cy][cx]);   // only the stairs change level
  }
  // when a unit's target is on another level, walk to the stairs first
  waypoint(u, t) {
    if (!this.hill || !t) return null;
    const a = this.levelAt(u.x, u.y), b = this.levelAt(t.x, t.y);
    if (a === b || a < 0 || b < 0) return null;
    const s = this.stairTop, top = { x: (s.x + 0.5) * T, y: (s.y + 0.7) * T }, foot = { x: (s.x + 0.5) * T, y: (s.y + 1.7) * T };
    const onStairs = Math.abs(u.x - top.x) < T * 0.5 && u.y > top.y - T * 0.6 && u.y < foot.y + T * 0.3;
    if (onStairs) return a === 0 ? top : foot;
    return a === 0 ? foot : top;
  }

  damage(from, to) {
    if (to.dead) return;
    let dmg = from.s.atk * (0.9 + Math.random() * 0.2);
    if (to.side !== 'castle' && this.levelAt(from.x, from.y) > this.levelAt(to.x, to.y)) dmg *= 1.25; // high ground
    let crit = false;
    if (Math.random() < 0.05 + (from.crit || 0)) { dmg *= 1.8; crit = true; }
    if (from.side === 'hero' && this.rallyBuff > 0) dmg *= 1.4;
    dmg = Math.max(1, dmg - to.s.def * 0.5);
    if (to.shield > 0) { const absorbed = Math.min(to.shield, dmg); to.shield -= absorbed; dmg -= absorbed; }
    to.hp -= dmg; to.flash = 1;
    if (from.lifesteal) from.heal(dmg * from.lifesteal, true);
    this.text(String(Math.round(dmg)) + (crit ? '!' : ''), to.x + (Math.random() - 0.5) * 20, to.y - to.head, crit ? '#ffd24a' : '#fff', crit ? 30 : 24);
    // knockback
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    to.x += dx / d * 4; to.y += dy / d * 4;
    if (to.hp <= 0) this.kill(to);
  }

  kill(u) {
    u.dead = true; u.hp = 0; u.anim.t = 0;
    if (u.side === 'enemy') this.world.markDefeated?.(u.kind);
    this.fx(u.boss ? FX.explosion : FX.dustBig, u.x, u.y);
  }

  fx(def, x, y) { this.effects.push(new Fx(def, x, y)); }
  text(s, x, y, color = '#fff', size = 24) { this.texts.push({ s, x, y, color, size, t: 0 }); }

  useRally() {
    if (this.rally < 1 || this.over) return false;
    this.rally = 0; this.rallyBuff = 6; this.flashScreen = 1;
    for (const u of this.heroes) if (!u.dead) u.heal(u.max * 0.3);
    return true;
  }

  update(rawDt) {
    if (this.over) { this.tick(rawDt); return; }
    const dt = rawDt * this.speed;
    this.time += dt;
    this.rally = Math.min(1, this.rally + dt / RALLY_CHARGE);
    if (this.rallyBuff > 0) this.rallyBuff -= dt;
    for (const u of this.heroes) u.update(dt);
    for (const u of this.enemies) u.update(dt);
    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter((p) => !p.done);
    this.tick(dt);
    if (this.time > 0.8) {
      if (this.enemies.every((u) => u.dead)) this.finish(true);
      else if (this.time > 150) { this.timedOut = true; this.finish(false); }
      else if (this.heroes.every((u) => u.dead)) this.finish(false);
    }
  }

  tick(dt) {
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter((e) => !e.done);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < 0.9);
    for (const d of this.decor) d.anim.update(dt);
    if (this.shake > 0) this.shake -= dt;
    if (this.flashScreen > 0) this.flashScreen -= dt * 2;
    if (this.over) for (const u of [...this.heroes, ...this.enemies]) if (u.dead) u.update(dt);
  }

  finish(win) {
    this.over = win ? 'win' : 'lose';
    setTimeout(() => this.onEnd?.(win, this), 1100);
  }

  draw(ctx) {
    const tr = this.terrain;
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    tr.drawWater(ctx, { x: -T * 4, y: -T * 4, w: (ARENA_W + 8) * T, h: (ARENA_H + 8) * T });
    tr.drawFoam(ctx, this.time, { x: -T, y: -T, w: (ARENA_W + 2) * T, h: (ARENA_H + 2) * T });
    tr.drawStatic(ctx);
    for (const d of this.decor) d.anim.draw(ctx, d.x, d.y);
    const all = [...this.heroes, ...this.enemies].sort((a, b) => a.y - b.y);
    for (const u of all) u.draw(ctx);
    for (const e of this.effects) e.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    for (const u of all) u.drawBar(ctx);
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, (0.9 - t.t) * 4);
      ctx.font = `${t.size}px BoldPixels, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#1e1a18'; ctx.fillStyle = t.color;
      const y = t.y - t.t * 40;
      ctx.strokeText(t.s, t.x, y); ctx.fillText(t.s, t.x, y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'start';
  }
}
