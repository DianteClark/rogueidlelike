// The home island: owns terrain, entities, resources and jobs; runs the simulation; saves/loads.
import { Terrain } from './terrain.js';
import { generateIsland, newSeed } from './generate.js';
import { Tree, GoldStone, Building, Sheep, Fx, FloatText, Decor, cx, foot } from './entities.js';
import { Pawn, JOBS } from './pawn.js';
import { BUILDINGS, NATURE, FX, ICONS, TILE } from '../data/art.js';
import { img } from '../engine/assets.js';
import { KINGDOMS, mod } from '../data/kingdoms.js';
import { makeHero, SUMMON_COST, FREE_SUMMONS, TEAM_SIZE, BASE_ROSTER, levelCost, MAX_LEVEL, addXp } from '../game/heroes.js';
import { REGIONS } from '../data/units.js';

const T = TILE;
export const SAVE_KEY = 'tinycrowns.save.v2';
const MAX_SHEEP = 6;
const PAWN_COST = 10;          // meat for a new pawn
const EAT_EVERY = 30;          // seconds per meat per pawn
export const OFFLINE_CAP_H = 12;

// per-worker income per minute, used for offline progress (about half of what they make live)
const OFFLINE_RATE = { wood: 8, gold: 5, meat: 7 };

export class World {
  constructor(events = {}, kingdom = 'blue') {
    this.events = events; // { toast(msg), changed() }
    this.kingdom = KINGDOMS[kingdom] ? kingdom : 'blue';
    this.color = KINGDOMS[this.kingdom].color;
    this.res = { wood: 20, gold: 0, meat: 20 };
    this.jobs = { wood: 1, gold: 0, meat: 1, build: 1 };
    this.trees = []; this.stones = []; this.buildings = []; this.sheep = []; this.pawns = [];
    this.decor = []; this.effects = [];
    this.time = 0; this.hungry = false; this.eatT = 0; this.arriveT = 0; this.sheepT = 0;
    this.placing = null;
    this.heroes = []; this.team = []; this.freeSummons = FREE_SUMMONS;
    this.campaign = { region: 0, stage: 1, best: 0 };
    this.clouds = Array.from({ length: 3 }, (_, i) => ({ i: (i * 3) % 8, x: Math.random() * 2000 - 600, y: Math.random() * 1600, s: 7 + Math.random() * 6 }));
  }

  // ---------------------------------------------------------------- setup
  init(save, seed) {
    this.seed = save?.seed ?? seed ?? newSeed();
    const gen = generateIsland(this.seed);
    this.terrain = new Terrain(gen.map, { color: gen.colors.flat, highColor: gen.colors.high });
    this.pen = gen.pen;
    const L = gen.layout, tr = this.terrain;
    this.castle = this.addBuilding(new Building('castle', L.castle.x, L.castle.y, { color: this.color }));
    L.trees.forEach(([x, y], i) => { const t = new Tree(x, y, (x * 7 + y * 3 + i) % 4); this.trees.push(t); tr.occupied[y][x] = t; });
    L.stones.forEach(([x, y, s]) => { const g = new GoldStone(x, y, s); this.stones.push(g); tr.occupied[y][x] = g; });
    L.bushes.forEach(([x, y], i) => this.decor.push(new Decor(NATURE.bushes[i % 4], x, y, { ox: (i % 3 - 1) * 14 })));
    L.rocks.forEach(([x, y], i) => this.decor.push(new Decor(NATURE.rocks[i % 4], x, y)));
    L.waterRocks.forEach(([x, y], i) => this.decor.push(new Decor(NATURE.waterRocks[i % 4], x, y)));
    this.decor.push(new Decor(NATURE.duck, L.duck[0], L.duck[1], { fps: 4, bob: true }));

    let pawnCount = 3, buildings = L.buildings;
    if (save) {
      this.res = { ...this.res, ...save.res };
      this.jobs = { ...this.jobs, ...save.jobs };
      pawnCount = save.pawns ?? pawnCount;
      buildings = save.buildings ?? buildings;
      save.trees?.forEach((s, i) => { if (this.trees[i]) { this.trees[i].stock = s[0]; this.trees[i].regrow = s[1]; } });
      save.stones?.forEach((s, i) => { if (this.stones[i]) { this.stones[i].stock = s[0]; this.stones[i].regrow = s[1]; } });
      this.heroes = save.heroes ?? [];
      this.team = (save.team ?? []).filter((id) => this.heroes.some((h) => h.id === id));
      this.freeSummons = save.freeSummons ?? 0;
      this.campaign = { ...this.campaign, ...save.campaign };
    }
    for (const b of buildings) this.addBuilding(new Building(b.type, b.x, b.y, { progress: b.progress ?? 1, variant: b.variant ?? 0, color: this.color }));
    const sheepN = save?.sheep ?? L.sheep.length;
    for (let i = 0; i < sheepN; i++) {
      const p = L.sheep[i] ? { x: L.sheep[i][0], y: L.sheep[i][1] } : this.randomPenTile();
      if (p) this.sheep.push(new Sheep(this, p.x, p.y));
    }
    const door = this.castle.door;
    for (let i = 0; i < pawnCount; i++) this.pawns.push(new Pawn(this, door.x + (i % 3) - 1, door.y + 1, this.color));
    this.assignJobs();
  }

  addBuilding(b) {
    this.buildings.push(b);
    for (const c of b.cells()) if (this.terrain.inside(c.x, c.y)) this.terrain.occupied[c.y][c.x] = b;
    return b;
  }

  // ---------------------------------------------------------------- economy
  get pawnCap() {
    return 4 + this.buildings.filter((b) => b.done && b.def.pawns).reduce((s, b) => s + b.def.pawns, 0);
  }
  get jobTotal() { return Object.values(this.jobs).reduce((a, b) => a + b, 0); }
  get idleCount() { return Math.max(0, this.pawns.length - this.jobTotal); }

  setJob(job, delta) {
    const next = Math.max(0, this.jobs[job] + delta);
    if (delta > 0 && this.idleCount <= 0) return false;
    this.jobs[job] = next;
    this.assignJobs();
    return true;
  }

  // make the pawns' actual jobs match the requested counts, changing as few pawns as possible
  assignJobs() {
    let total = this.jobTotal;
    // if pawns were lost, trim jobs from the end
    for (const k of ['build', 'gold', 'meat', 'wood']) while (total > this.pawns.length && this.jobs[k] > 0) { this.jobs[k]--; total--; }
    const want = { ...this.jobs };
    const keep = [];
    for (const p of this.pawns) {
      if (p.job !== 'idle' && want[p.job] > 0) { want[p.job]--; keep.push(p); }
    }
    for (const p of this.pawns) {
      if (keep.includes(p)) continue;
      const job = Object.keys(want).find((k) => want[k] > 0);
      if (job) { want[job]--; p.setJob(job); } else p.setJob('idle');
    }
    this.events.changed?.();
  }

  mod(key, fallback = 1) { return mod(this.kingdom, key, fallback); }

  // building cost after kingdom modifiers
  costOf(type) {
    const def = BUILDINGS[type]; if (!def.cost) return null;
    const out = { ...def.cost };
    if (out.wood) out.wood = Math.round(out.wood * this.mod('woodCost'));
    if (def.defense) for (const k in out) out[k] = Math.round(out[k] * this.mod('defenseCost'));
    return out;
  }

  canAfford(cost) { return !cost || Object.entries(cost).every(([k, v]) => this.res[k] >= v); }
  pay(cost) { for (const [k, v] of Object.entries(cost || {})) this.res[k] -= v; this.events.changed?.(); }

  deposit(kind, amount, x, y) {
    this.res[kind] += amount;
    this.effects.push(new FloatText('+' + amount, x + 18, y, ICONS[kind]));
    this.events.gained?.(kind);
    this.events.changed?.();
  }

  fx(def, x, y) { this.effects.push(new Fx(def, x, y)); }

  removeSheep(s) {
    s.gone = true;
    this.fx(FX.dust, s.px, s.py);
    this.sheep = this.sheep.filter((x) => x !== s);
  }

  randomPenTile() {
    for (let i = 0; i < 30; i++) {
      const P = this.pen;
      const x = P.x0 + Math.floor(Math.random() * (P.x1 - P.x0 + 1));
      const y = P.y0 + Math.floor(Math.random() * (P.y1 - P.y0 + 1));
      if (this.terrain.walkable(x, y) && this.terrain.level[y][x] === 0) return { x, y };
    }
    return null;
  }

  onBuilt(b) {
    this.fx(FX.dustBig, cx(b.x + b.w / 2 - 0.5), foot(b.y));
    this.events.toast?.(`${b.def.name} finished!${b.def.pawns ? ` Room for ${b.def.pawns} more pawns.` : ''}`);
    this.events.changed?.();
  }

  // ---------------------------------------------------------------- heroes
  get rosterCap() { return BASE_ROSTER; }
  get summonCost() { return this.freeSummons > 0 ? null : { gold: SUMMON_COST }; }

  summon() {
    if (this.heroes.length >= this.rosterCap) { this.events.toast?.('Roster full'); return null; }
    if (this.freeSummons > 0) this.freeSummons--;
    else if (this.canAfford(this.summonCost)) this.pay(this.summonCost);
    else { this.events.toast?.('Not enough gold'); return null; }
    const h = makeHero({}, this.kingdom);
    this.heroes.push(h);
    if (this.team.length < TEAM_SIZE) this.team.push(h.id);
    this.events.changed?.();
    return h;
  }

  hero(id) { return this.heroes.find((h) => h.id === id); }

  toggleTeam(id) {
    if (this.team.includes(id)) this.team = this.team.filter((x) => x !== id);
    else if (this.team.length < TEAM_SIZE) this.team.push(id);
    else { this.events.toast?.('Team is full (5)'); return; }
    this.events.changed?.();
  }

  levelUp(id) {
    const h = this.hero(id); if (!h || h.level >= MAX_LEVEL) return;
    const cost = levelCost(h);
    if (!this.canAfford(cost)) { this.events.toast?.('Not enough gold'); return; }
    this.pay(cost); h.level++; h.xp = 0;
    this.events.changed?.();
  }

  // ---------------------------------------------------------------- campaign
  // idle gold per minute from the furthest stage cleared
  get campaignRate() { return Math.round(this.campaign.best * 1.5 * 10) / 10; }

  winStage(stage, survivors) {
    const R = REGIONS[this.campaign.region];
    const gold = Math.round((25 + stage * 10) * this.mod('lootMul'));
    const xp = 20 + stage * 8;
    this.res.gold += gold;
    const heroes = this.team.map((id) => this.hero(id)).filter(Boolean).map((hero) => ({ hero, levels: addXp(hero, xp) }));
    let recruits = 0, unlocked = null;
    if (stage === this.campaign.stage) {
      if (stage % 3 === 0) recruits = 1;
      if (stage === R.stages) { recruits = 2; unlocked = `${R.name} conquered!`; }
      this.freeSummons += recruits;
      this.campaign.best = Math.max(this.campaign.best, stage);
      if (stage < R.stages) this.campaign.stage = stage + 1;
    }
    this.events.changed?.();
    this.save();
    return { gold, xp, heroes, recruits, unlocked, survivors };
  }

  dismiss(id) {
    this.heroes = this.heroes.filter((h) => h.id !== id);
    this.team = this.team.filter((x) => x !== id);
    this.res.gold += 15;
    this.events.changed?.();
  }

  // ---------------------------------------------------------------- building placement
  startPlacing(type, view) {
    const def = BUILDINGS[type];
    const c = { x: Math.floor((view.x + view.w / 2) / T), y: Math.floor((view.y + view.h / 2) / T) };
    this.placing = { type, x: c.x - Math.floor(def.w / 2), y: c.y, variant: Math.floor(Math.random() * 3) };
    this.placing.ok = this.placementOk();
  }

  movePlacing(wx, wy) {
    if (!this.placing) return;
    const def = BUILDINGS[this.placing.type];
    this.placing.x = Math.floor(wx / T) - Math.floor(def.w / 2);
    this.placing.y = Math.floor(wy / T) + (def.h > 1 ? 0 : 0);
    this.placing.ok = this.placementOk();
  }

  placementOk() {
    const p = this.placing, def = BUILDINGS[p.type], tr = this.terrain;
    let lvl = null;
    for (let i = 0; i < def.w; i++) for (let j = 0; j < def.h; j++) {
      const x = p.x + i, y = p.y - j;
      if (!tr.walkable(x, y)) return false;
      if (this.sheepOrPawnOn(x, y)) { /* units step aside, fine */ }
      if (lvl === null) lvl = tr.level[y][x]; else if (tr.level[y][x] !== lvl) return false;
      if (tr.stair[y][x]) return false;
    }
    const door = { x: p.x + Math.floor(def.w / 2), y: p.y + 1 };
    return tr.walkable(door.x, door.y);
  }

  sheepOrPawnOn() { return false; }

  confirmPlacing() {
    const p = this.placing; if (!p || !p.ok) return false;
    const cost = this.costOf(p.type);
    if (!this.canAfford(cost)) { this.events.toast?.('Not enough resources'); return false; }
    this.pay(cost);
    const b = this.addBuilding(new Building(p.type, p.x, p.y, { progress: 0, variant: p.variant, color: this.color }));
    this.fx(FX.dust, cx(b.x + b.w / 2 - 0.5), foot(b.y));
    this.placing = null;
    this.heroes = []; this.team = []; this.freeSummons = FREE_SUMMONS;
    this.campaign = { region: 0, stage: 1, best: 0 };
    if (this.jobs.build === 0) this.events.toast?.('Assign a Builder in Pawns to construct it');
    this.events.changed?.();
    return true;
  }

  cancelPlacing() { this.placing = null; }

  // ---------------------------------------------------------------- simulation
  update(dt) {
    this.time += dt;
    for (const t of this.trees) t.update(dt);
    for (const s of this.stones) s.update(dt);
    for (const s of this.sheep) s.update(dt);
    for (const p of this.pawns) p.update(dt);
    for (const d of this.decor) d.update(dt);
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter((e) => !e.gone);
    for (const c of this.clouds) { c.x += c.s * dt; if (c.x > this.terrain.w * T + 200) { c.x = -700; c.y = Math.random() * this.terrain.h * T; } }

    // food
    this.eatT += dt;
    const eatEvery = EAT_EVERY / this.mod('eat') / Math.max(1, this.pawns.length);
    while (this.eatT >= eatEvery) {
      this.eatT -= eatEvery;
      if (this.res.meat > 0) this.res.meat--;
      this.events.changed?.();
    }
    const wasHungry = this.hungry;
    this.hungry = this.res.meat <= 0;
    if (this.hungry && !wasHungry) this.events.toast?.('Your pawns are hungry! Add a Shepherd.');

    // new pawns arrive when there is room and food
    this.arriveT += dt;
    if (this.arriveT > 15) {
      this.arriveT = 0;
      if (this.pawns.length < this.pawnCap && this.res.meat >= PAWN_COST + 5) {
        this.res.meat -= PAWN_COST;
        const d = this.castle.door;
        const p = new Pawn(this, d.x, d.y, this.color);
        this.pawns.push(p);
        this.fx(FX.dust, p.px, p.py);
        this.events.toast?.('A new pawn joined your kingdom!');
        this.assignJobs();
      }
    }

    // idle gold from campaign progress
    this.campGold = (this.campGold || 0) + this.campaignRate / 60 * dt;
    if (this.campGold >= 1) { const g = Math.floor(this.campGold); this.campGold -= g; this.res.gold += g; this.events.changed?.(); }

    // sheep breed back slowly
    this.sheepT += dt;
    if (this.sheepT > 20) {
      this.sheepT = 0;
      if (this.sheep.length < MAX_SHEEP && this.sheep.length >= 1) {
        const p = this.randomPenTile();
        if (p) { const s = new Sheep(this, p.x, p.y); this.sheep.push(s); this.fx(FX.dust, s.px, s.py); }
      }
    }
  }

  // ---------------------------------------------------------------- drawing
  draw(ctx, view) {
    const tr = this.terrain;
    tr.drawWater(ctx, view);
    tr.drawFoam(ctx, this.time, view);
    tr.drawStatic(ctx);

    const pad = 260;
    const vis = (e) => {
      const x = e.px ?? (e.x + (e.w || 1) / 2) * T, y = e.sortY;
      return x > view.x - pad && x < view.x + view.w + pad && y > view.y - 40 && y < view.y + view.h + pad;
    };
    const list = [...this.decor, ...this.trees, ...this.stones, ...this.buildings, ...this.sheep, ...this.pawns, ...this.effects.filter((e) => !(e instanceof FloatText))]
      .filter(vis);
    list.sort((a, b) => a.sortY - b.sortY);
    for (const e of list) e.draw(ctx);
    for (const b of this.buildings) b.drawOver(ctx);
    if (this.placing) this.drawGhost(ctx);
    this.drawClouds(ctx);
    for (const e of this.effects) if (e instanceof FloatText) e.draw(ctx);

  }

  // Clouds float above everything; each casts a soft shadow onto whatever is below it.
  drawClouds(ctx) {
    if (!this.cloudShadows) {
      this.cloudShadows = NATURE.clouds.map((d) => {
        const im = img(d.src); if (!im) return null;
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#12303c'; g.fillRect(0, 0, c.width, c.height);
        return c;
      });
    }
    for (const c of this.clouds) {
      const sh = this.cloudShadows[c.i];
      if (sh) { ctx.globalAlpha = 0.16; ctx.drawImage(sh, Math.round(c.x + 40), Math.round(c.y + 170)); }
    }
    ctx.globalAlpha = 0.92;
    for (const c of this.clouds) {
      const im = img(NATURE.clouds[c.i].src);
      if (im) ctx.drawImage(im, Math.round(c.x), Math.round(c.y));
    }
    ctx.globalAlpha = 1;
  }

  drawGhost(ctx) {
    const p = this.placing, def = BUILDINGS[p.type];
    ctx.fillStyle = p.ok ? 'rgba(120,255,140,.28)' : 'rgba(255,80,80,.32)';
    for (let i = 0; i < def.w; i++) for (let j = 0; j < def.h; j++) ctx.fillRect((p.x + i) * T + 2, (p.y - j) * T + 2, T - 4, T - 4);
    const ghost = new Building(p.type, p.x, p.y, { variant: p.variant, color: this.color });
    ctx.globalAlpha = 0.7; ghost.draw(ctx); ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- input
  tap(wx, wy) {
    if (this.placing) { this.movePlacing(wx, wy); return; }
    const hitPawn = this.pawns.find((p) => Math.abs(p.px - wx) < 28 && wy < p.py + 8 && wy > p.py - 70);
    if (hitPawn) { this.events.toast?.(`${JOBS[hitPawn.job].name}${hitPawn.carry ? ' — carrying ' + hitPawn.carry : ''}`); return; }
    const hitB = [...this.buildings].reverse().find((b) => b.contains(wx, wy));
    if (hitB) { this.events.building?.(hitB); return; }
  }

  // ---------------------------------------------------------------- save / offline
  serialize() {
    return {
      v: 2, t: Date.now(), kingdom: this.kingdom, seed: this.seed,
      res: this.res, jobs: this.jobs, pawns: this.pawns.length,
      buildings: this.buildings.filter((b) => b !== this.castle).map((b) => ({ type: b.type, x: b.x, y: b.y, progress: b.progress, variant: b.variant })),
      trees: this.trees.map((t) => [t.stock, Math.round(t.regrow)]),
      stones: this.stones.map((s) => [s.stock, Math.round(s.regrow)]),
      sheep: this.sheep.length,
      heroes: this.heroes, team: this.team, freeSummons: this.freeSummons, campaign: this.campaign,
    };
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); } catch (e) { /* storage full or private mode */ }
  }

  static loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
  }

  // Apply income for the time the app was closed. Returns a summary or null.
  applyOffline(seconds) {
    const capH = this.mod('idleCapH', OFFLINE_CAP_H);
    const capped = Math.min(seconds, capH * 3600);
    if (capped < 60) return null;
    const min = capped / 60;
    const gain = {};
    for (const k of ['wood', 'gold', 'meat']) gain[k] = Math.floor((this.jobs[k] || 0) * OFFLINE_RATE[k] * min * (k === 'gold' ? 1 + this.mod('goldBonus', 0) / 3 : 1));
    const eaten = Math.floor(this.pawns.length * min * 60 / EAT_EVERY * this.mod('eat') * 0.5);
    gain.meat -= Math.min(eaten, gain.meat + this.res.meat);
    gain.gold += Math.floor(this.campaignRate * min * 0.8);
    for (const k in gain) this.res[k] = Math.max(0, this.res[k] + gain[k]);
    // trees/stones regrow while away
    for (const n of [...this.trees, ...this.stones]) { n.regrow -= capped; if (n.regrow <= 0 && n.stock <= 0) n.stock = n.max; }
    // building work continues offline at half speed
    const builders = this.jobs.build || 0;
    let buildTime = builders * capped * 0.5;
    for (const b of this.buildings) {
      if (b.done || buildTime <= 0) continue;
      const need = (1 - b.progress) * b.def.build;
      const used = Math.min(need, buildTime);
      b.progress = Math.min(1, b.progress + used / b.def.build); buildTime -= used;
    }
    return { seconds: capped, gain, capped: seconds > capped, capH };
  }
}
