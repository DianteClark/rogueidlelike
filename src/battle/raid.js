// Island raids: monsters land on a beach and march on the castle. Guard heroes and towers defend;
// pawns shelter in the castle. Raiders that reach the castle steal resources and sail away.
import { Unit, Projectile } from './battle.js';
import { Anim, loadAll, collectSrcs } from '../engine/assets.js';
import { ENEMIES, HERO_CLASSES, REGIONS, stageScale, regionOf, TOTAL_STAGES } from '../data/units.js';
import { heroStats, heroDef, canFight } from '../game/heroes.js';
import { teamSynergies, applyBonuses } from '../game/synergy.js';
import { FX, TILE, FREE } from '../data/art.js';
import { mod, KINGDOMS } from '../data/kingdoms.js';

const T = TILE;
export const RAID_TIERS = {
  gentle: { name: 'Raid' },
  real: { name: 'Big raid' },   // pawns left outside can die, buildings get wrecked
  siege: { name: 'Siege' },     // Blood Moon: a huge horde with a boss attacks the castle itself
};

export function planSiege(world) {
  const n = world.era.sieges;
  const pool = REGIONS[0].pool;
  const boss = n >= 1 && REGIONS[1] && world.campaign.best > REGIONS[0].stages ? 'bear' : 'troll';
  const count = Math.min(14, 8 + n * 2);
  const enemies = [boss, ...Array.from({ length: count }, (_, i) => pool[(i * 3 + n) % pool.length])];
  if (n >= 2) enemies.push('troll');
  return { tier: 'siege', tribe: 'Goblins', enemies, level: 9 + n * 2 };
}

// The raid the world schedules next, sized from campaign progress.
export function planRaid(world) {
  const best = Math.max(1, world.campaign.best);
  // raiders come from the tribes you've provoked: the furthest region you've fought in
  const reg = regionOf(Math.min(best + 1, TOTAL_STAGES));
  const R = Math.random() < 0.6 ? reg.region : REGIONS[Math.floor(Math.random() * (reg.idx + 1))];
  const pool = R.pool.slice(0, Math.min(5, 2 + Math.floor((R === reg.region ? reg.local : 10) / 2)));
  const real = best >= 5 && Math.random() < 0.45;
  const count = Math.min(9, 2 + Math.floor(best / 2) + (real ? 2 : 0));
  const enemies = Array.from({ length: count }, (_, i) => pool[(i * 7 + best) % pool.length]);
  return { tier: real ? 'real' : 'gentle', tribe: R.tribe, enemies, level: Math.max(1, best - 1 + (real ? 1 : 0)) };
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
    this.defenders = (this.plan.tier === 'siege' ? w.heroes.filter(canFight) : w.guardHeroes.filter(canFight)).filter((h) => !w.escorting.includes(h.id));
    for (const h of this.defenders) { const c = heroDef(h.cls); collectSrcs(c.art(h.color), srcs); if (c.projectile) srcs.add(c.projectile.src); }
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
      const e = ENEMIES[id], s2 = e.boss ? 1 + (this.plan.level - 9) * 0.08 : sc;
      const st = { ...e.stats, hp: Math.round(e.stats.hp * s2), atk: Math.round(e.stats.atk * s2), def: Math.round(e.stats.def * s2) };
      const u = new Unit(this, 'enemy', id, e.art, st, (this.landing.x + 0.5) * T + (i % 3 - 1) * 22, (this.landing.y + 0.85) * T + Math.floor(i / 3) * 14,
        { projectile: e.projectile, step: 0, carry: 0, scale: e.scale, boss: e.boss });
      this.enemies.push(u);
      this.fx(FX.splash, u.x, u.y);
    });

    // guard heroes come out of the castle
    const k = w.kingdom;
    const syn = teamSynergies(this.defenders, k);
    this.ringColor = KINGDOMS[k]?.hex;
    this.defenders.forEach((h, i) => {
      const c = heroDef(h.cls), st = heroStats(h);
      st.atk = Math.round(st.atk * mod(k, 'heroDamage') * (1 + (w.relicBonus || 0)));
      const u = new Unit(this, 'hero', h.cls, c.art(h.color), st, (door.x + 0.5 + ((i % 5) - 2) * 0.6) * T, (door.y + 1.1 + Math.floor(i / 5) * 0.5) * T, { projectile: c.projectile, hero: h });
      applyBonuses(u, h, syn, k);
      this.heroes.push(u);
    });
    // towers shoot arrows (an invisible archer on top of each finished tower)
    const arrow = { src: `${FREE}Units/Blue Units/Archer/Arrow.png`, speed: 560, rotate: true };
    this.towers = w.buildings.filter((b) => b.type === 'tower' && b.working).map((b) => ({
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
      if (this.plan.tier !== 'gentle' && !u.leaving && (this.kills || 0) < 3) {
        const prey = this.world.pawns.filter((p) => p.exposed && !p.hidden)
          .sort((a, b) => Math.hypot(a.px - u.x, a.py - u.y) - Math.hypot(b.px - u.x, b.py - u.y))[0];
        if (prey && Math.hypot(prey.px - u.x, prey.py - u.y) < 3.5 * T) {
          const dx = prey.px - u.x, dy = prey.py - u.y, d = Math.hypot(dx, dy);
          if (d < 34) { this.world.killPawn(prey); this.kills = (this.kills || 0) + 1; this.fx(FX.dustBig, prey.px, prey.py); return true; }
          u.anim.set(u.art.run); u.flip = dx < 0; u.x += dx / d * u.s.speed * dt; u.y += dy / d * u.s.speed * dt; return true;
        }
      }
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
    if (this.plan.tier === 'siege') return this.batter(u, dt);
    u.anim.set(u.art.idle);
    u.stealT = (u.stealT || 0) + dt;
    const res = this.world.res;
    if (u.stealT > 0.5) {
      u.stealT = 0;
      // big raids also set buildings near the castle on fire
      u.wreckN = (u.wreckN || 0) + 1;
      if (this.plan.tier === 'real' && u.wreckN % 6 === 0) {
        const near = this.world.buildings.filter((b) => b !== this.world.castle && b.working && Math.hypot((b.x + b.w / 2) * T - u.x, (b.y + 1) * T - u.y) < 7 * T);
        if (near.length) this.world.wreck(near[Math.floor(Math.random() * near.length)]);
      }
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

  // siege raiders pound the castle itself
  batter(u, dt) {
    const w = this.world;
    u.cool -= 0; // attack timing reuses the unit cooldown
    if (u.state === 'attack') return;
    if (u.cool <= 0) {
      const atk = u.art.attack[0];
      u.state = 'attack'; u.hitDone = false; u.anim.def = null; u.anim.set(atk, 10, false); u.cool = u.s.rate;
      u.target = { x: (w.castle.x + 2.5) * T, y: (w.castle.y + 0.5) * T, dead: false, head: 0, hp: 1, max: 1, side: 'castle' };
      u.castleHit = true;
    } else u.anim.set(u.art.idle);
    u.wreckN = (u.wreckN || 0) + dt;
    if (u.wreckN > 9) {
      u.wreckN = 0;
      const near = w.buildings.filter((b) => b !== w.castle && b.working && Math.hypot((b.x + b.w / 2) * T - u.x, (b.y + 1) * T - u.y) < 7 * T);
      if (near.length && Math.random() < 0.5) w.wreck(near[Math.floor(Math.random() * near.length)]);
    }
  }

  damage(from, to) {
    if (to.side === 'castle') {
      const dmg = Math.max(1, from.s.atk * (0.9 + Math.random() * 0.2));
      this.world.hitCastle(dmg);
      this.text(String(Math.round(dmg)), to.x + (Math.random() - 0.5) * 80, to.y - 60, '#ffb0a0');
      if (Math.random() < 0.2) this.fx(FX.dust, to.x + (Math.random() - 0.5) * 120, to.y + 30);
      return;
    }
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
    if (this.time > 120 && this.plan.tier !== 'siege') for (const u of this.enemies) if (!u.dead && !u.leaving) { u.leaving = true; u.step = Math.min(u.step, this.route.length - 1); }
    for (const u of this.heroes) u.update(dt);
    for (const u of this.enemies) u.update(dt);
    for (const tw of this.towers) {
      if (tw.b.wrecked) continue;
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
