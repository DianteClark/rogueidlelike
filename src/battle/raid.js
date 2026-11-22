// Island raids: monsters land on a beach and march on the castle. Guard heroes and towers defend;
// pawns shelter in the castle. Raiders that reach the castle steal resources and sail away.
import { Unit, Projectile } from './battle.js';
import { Anim, loadAll, collectSrcs } from '../engine/assets.js';
import { ENEMIES, HERO_CLASSES, REGIONS, stageScale } from '../data/units.js';
import { heroStats, heroDef } from '../game/heroes.js';
import { teamSynergies, applyBonuses } from '../game/synergy.js';
import { FX, TILE, FREE } from '../data/art.js';
import { mod } from '../data/kingdoms.js';

const T = TILE;
export const RAID_TIERS = {
  gentle: { name: 'Raid', steal: true, killPawns: false },
};

// The raid the world schedules next, sized from campaign progress.
export function planRaid(world) {
  const best = Math.max(1, world.campaign.best);
  const pool = REGIONS[0].pool.slice(0, Math.min(5, 2 + Math.floor(best / 2)));
  const count = Math.min(7, 2 + Math.floor(best / 2));
  const enemies = Array.from({ length: count }, (_, i) => pool[(i * 7 + best) % pool.length]);
  return { tier: 'gentle', tribe: 'Goblins', enemies, level: Math.max(1, best - 1) };
}

export function raidPower(plan) {
  const sc = stageScale(plan.level);
  return Math.round(plan.enemies.reduce((s, id) => { const e = ENEMIES[id].stats; return s + e.hp * sc * 0.25 + e.atk * sc / e.rate * 6; }, 0));
}

export class Raid {
  constructor(world, plan) {
    this.world = world; this.plan = plan;
    this.heroes = []; this.enemies = []; this.projectiles = []; this.effects = []; this.texts = [];
    this.time = 0; this.over = null; this.rally = 0; this.rallyBuff = 0; this.stolen = { wood: 0, gold: 0, meat: 0 };
  }

  async prepare() {
    const w = this.world, srcs = new Set();
    for (const id of this.plan.enemies) { collectSrcs(ENEMIES[id].art, srcs); if (ENEMIES[id].projectile) srcs.add(ENEMIES[id].projectile.src); }
    for (const h of w.guardHeroes) { const c = heroDef(h.cls); collectSrcs(c.art(h.color), srcs); if (c.projectile) srcs.add(c.projectile.src); }
    srcs.add(`${FREE}Units/Blue Units/Archer/Arrow.png`);
    collectSrcs(FX, srcs);
    await loadAll(srcs);

    // landing beach: shore tile far from the castle that can walk to the door
    const tr = w.terrain, door = w.castle.door;
    const shores = [];
    for (let y = 0; y < tr.h; y++) for (let x = 0; x < tr.w; x++) {
      if (!tr.walkable(x, y) || tr.level[y][x] !== 0) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !tr.land[y + dy]?.[x + dx])) continue;
      const d = Math.hypot(x - door.x, y - door.y);
      if (d > 7) shores.push({ x, y, d });
    }
    shores.sort(() => Math.random() - 0.5);
    for (const s of shores) {
      const p = tr.path(s.x, s.y, door);
      if (p) { this.landing = s; this.route = p; break; }
    }
    if (!this.landing) return false;

    const sc = stageScale(this.plan.level);
    this.plan.enemies.forEach((id, i) => {
      const e = ENEMIES[id];
      const st = { ...e.stats, hp: Math.round(e.stats.hp * sc), atk: Math.round(e.stats.atk * sc), def: Math.round(e.stats.def * sc) };
      const u = new Unit(this, 'enemy', id, e.art, st, (this.landing.x + 0.5) * T + (i % 3 - 1) * 22, (this.landing.y + 0.85) * T + Math.floor(i / 3) * 14,
        { projectile: e.projectile, step: 0, carry: 0 });
      this.enemies.push(u);
      this.fx(FX.splash, u.x, u.y);
    });

    // guard heroes come out of the castle
    const k = w.kingdom;
    const syn = teamSynergies(w.guardHeroes, k);
    w.guardHeroes.forEach((h, i) => {
      const c = heroDef(h.cls), st = heroStats(h);
      st.atk = Math.round(st.atk * mod(k, 'heroDamage'));
      const u = new Unit(this, 'hero', h.cls, c.art(h.color), st, (door.x + 0.5 + (i - 1) * 0.6) * T, (door.y + 0.9) * T, { projectile: c.projectile, hero: h });
      applyBonuses(u, h, syn, k);
      this.heroes.push(u);
    });
    // towers shoot arrows (an invisible archer on top of each finished tower)
    const arrow = { src: `${FREE}Units/Blue Units/Archer/Arrow.png`, speed: 560, rotate: true };
    this.towers = w.buildings.filter((b) => b.type === 'tower' && b.done).map((b) => ({
      x: (b.x + 1) * T, y: (b.y + 1) * T - 150, cool: 0, range: 5.5 * T, atk: Math.round(14 * mod(k, 'defenseCost', 1) ** -1), b,
      arrow, head: 0, dead: false, side: 'hero', s: { atk: 14, def: 0 }, flip: false,
    }));
    return true;
  }

  canStand(x, y) {
    const tr = this.world.terrain, tx = Math.floor(x / T), ty = Math.floor((y - 4) / T);
    return tr.inside(tx, ty) && tr.level[ty][tx] >= 0 && !(tr.occupied[ty][tx] && tr.occupied[ty][tx].def);
  }

  // Custom movement for the island: raiders march along their route until a defender is close.
  steer(u, dt) {
    const door = this.world.castle.door;
    if (u.side === 'enemy') {
      const foe = u.nearest(this.heroes);
      if (foe && Math.hypot(foe.x - u.x, foe.y - u.y) < 4 * T) { u.target = foe; return false; }
      u.target = null;
      if (u.leaving) return this.walkRoute(u, -1, dt);
      if (u.step >= this.route.length) { this.steal(u, dt); return true; }
      return this.walkRoute(u, 1, dt);
    }
    // defenders: fight raiders near the castle, otherwise stand by the door
    if (u.s.heal) return false;
    const foe = u.nearest(this.enemies);
    if (foe && Math.hypot(foe.x - u.x, foe.y - u.y) < 7 * T) { u.target = foe; return false; }
    const hx = (door.x + 0.5) * T, hy = (door.y + 0.9) * T;
    if (Math.hypot(hx - u.x, hy - u.y) > 30) { u.move((hx - u.x) / Math.hypot(hx - u.x, hy - u.y), (hy - u.y) / Math.hypot(hx - u.x, hy - u.y), dt); return true; }
    u.anim.set(u.art.idle); return true;
  }

  walkRoute(u, dir, dt) {
    const i = Math.max(0, Math.min(this.route.length - 1, u.step));
    const node = dir > 0 ? this.route[i] : (u.step >= 0 ? this.route[i] : this.landing);
    const tx = (node.x + 0.5) * T, ty = (node.y + 0.85) * T;
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < 6) {
      u.step += dir;
      if (dir < 0 && u.step < -1) { u.gone = true; u.dead = true; u.fade = 0; this.fx(FX.splash, u.x, u.y); }
      return true;
    }
    u.anim.set(u.art.run); u.flip = dx < 0;
    const sp = u.s.speed * dt;
    u.x += dx / d * Math.min(sp, d); u.y += dy / d * Math.min(sp, d);
    return true;
  }

  steal(u, dt) {
    u.anim.set(u.art.idle);
    u.stealT = (u.stealT || 0) + dt;
    const res = this.world.res;
    if (u.stealT > 0.5) {
      u.stealT = 0;
      const kinds = ['wood', 'gold', 'meat'].filter((k) => res[k] > 0);
      if (kinds.length) {
        const k = kinds[Math.floor(Math.random() * kinds.length)];
        const n = Math.min(res[k], 3 + Math.floor(this.plan.level / 2));
        res[k] -= n; this.stolen[k] += n; u.carry += n; u.loot = { ...(u.loot || {}), [k]: ((u.loot || {})[k] || 0) + n };
        this.text('-' + n + ' ' + k, u.x, u.y - u.head, '#ff8a7a');
        this.world.events.changed?.();
      }
      if (u.carry >= 18 || !kinds.length) { u.leaving = true; u.step = this.route.length - 1; }
    }
  }

  damage(from, to) {
    if (to.dead) return;
    let dmg = from.s.atk * (0.9 + Math.random() * 0.2);
    if (Math.random() < 0.05 + (from.crit || 0)) dmg *= 1.8;
    dmg = Math.max(1, dmg - (to.s.def || 0) * 0.5);
    if (to.shield > 0) { const a = Math.min(to.shield, dmg); to.shield -= a; dmg -= a; }
    to.hp -= dmg; to.flash = 1;
    this.text(String(Math.round(dmg)), to.x, to.y - to.head, '#fff');
    if (to.hp <= 0) {
      to.dead = true; to.hp = 0; to.anim.t = 0;
      if (to.side === 'enemy') this.world.markDefeated?.(to.kind);
      this.fx(FX.dustBig, to.x, to.y);
      if (to.side === 'enemy' && to.loot) for (const [k, n] of Object.entries(to.loot)) { this.world.res[k] += n; this.stolen[k] -= n; }
      if (to.side === 'enemy') { const g = 4 + this.plan.level; this.world.res.gold += g; this.bounty = (this.bounty || 0) + g; this.text('+' + g + ' gold', to.x, to.y - to.head - 24, '#ffd24a'); }
      this.world.events.changed?.();
    }
  }

  fx(def, x, y) { this.effects.push({ anim: new Anim(def, 12, false), x, y }); }
  text(s, x, y, color = '#fff') { this.texts.push({ s, x, y, color, t: 0 }); }

  update(dt) {
    this.time += dt;
    // safety: raiders give up and sail home after two minutes
    if (this.time > 120) for (const u of this.enemies) if (!u.dead && !u.leaving) { u.leaving = true; u.step = Math.min(u.step, this.route.length - 1); }
    for (const u of this.heroes) u.update(dt);
    for (const u of this.enemies) u.update(dt);
    for (const tw of this.towers) {
      tw.cool -= dt;
      if (tw.cool > 0) continue;
      const tgt = this.enemies.filter((e) => !e.dead).sort((a, b) => Math.hypot(a.x - tw.x, a.y - tw.y) - Math.hypot(b.x - tw.x, b.y - tw.y))[0];
      if (tgt && Math.hypot(tgt.x - tw.x, tgt.y - tw.y) < tw.range) { this.projectiles.push(new Projectile(tw, tgt, tw.arrow)); tw.cool = 1.2; }
    }
    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter((p) => !p.done);
    for (const e of this.effects) e.anim.update(dt);
    this.effects = this.effects.filter((e) => !e.anim.done);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < 0.9);
    if (!this.over && this.time > 1 && this.enemies.every((u) => u.dead)) {
      const fled = this.enemies.filter((u) => u.gone).length;
      this.over = fled ? 'robbed' : 'defended';
    }
  }

  // sprites go into the island's y-sorted draw list; overlays drawn on top
  get drawables() { return [...this.heroes, ...this.enemies].filter((u) => u.fade > 0); }
  drawOver(ctx) {
    for (const e of this.effects) e.anim.draw(ctx, e.x, e.y);
    for (const p of this.projectiles) p.draw(ctx);
    for (const u of [...this.heroes, ...this.enemies]) u.drawBar(ctx);
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, (0.9 - t.t) * 4);
      ctx.font = '24px BoldPixels, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#1e1a18'; ctx.fillStyle = t.color;
      ctx.strokeText(t.s, t.x, t.y - t.t * 40); ctx.fillText(t.s, t.x, t.y - t.t * 40);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'start';
  }
}
