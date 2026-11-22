// Pawns: the little workers. Each has a job and runs a small state machine:
// think → walk to work → work (animation loops) → carry back to the castle → deposit → think.
import { Anim } from '../engine/assets.js';
import { TILE, FX, ICONS } from '../data/art.js';
import { pawnArt, cx, foot } from './entities.js';

const T = TILE;
const SPEED = 92;            // world px per second
const LOOP = 0.6;            // one interact animation loop (6 frames at 10 fps)

export const JOBS = {
  wood: { name: 'Woodcutter', work: 'chop', idle: 'idleAxe', run: 'runAxe', carry: 'runWood', loops: 4, yield: 4 },
  gold: { name: 'Miner', work: 'mine', idle: 'idlePick', run: 'runPick', carry: 'runGold', loops: 5, yield: 3 },
  meat: { name: 'Shepherd', work: 'cut', idle: 'idleKnife', run: 'runKnife', carry: 'runMeat', loops: 3, yield: 4 },
  build: { name: 'Builder', work: 'build', idle: 'idleHammer', run: 'runHammer', carry: null },
  idle: { name: 'Villager', work: null, idle: 'idle', run: 'run', carry: null },
};

export class Pawn {
  constructor(world, tx, ty, color = 'Blue') {
    this.world = world;
    this.px = cx(tx); this.py = foot(ty);
    this.art = pawnArt(color);
    this.anim = new Anim(this.art.idle);
    this.job = 'idle';
    this.state = 'think'; this.wait = Math.random();
    this.path = []; this.target = null; this.carry = null; this.flip = false;
    this.workT = 0;
  }

  shelter() {
    if (this.sheltered) return;
    this.release(); this.sheltered = true; this.carry = null;
    if (!this.goTo(this.world.castle.door)) this.hidden = true;
    this.state = 'walk';
  }
  unshelter() {
    if (!this.sheltered) return;
    this.sheltered = false; this.hidden = false; this.state = 'think'; this.wait = Math.random();
    this.world.fx(FX.dust, this.px, this.py);
  }

  get tx() { return Math.floor(this.px / T); }
  get ty() { return Math.floor((this.py - 1) / T); }

  setJob(job) {
    if (this.job === job) return;
    this.release();
    this.job = job;
    if (this.state !== 'walk' || !this.carry) { this.state = 'think'; this.wait = 0.2; this.path = []; }
  }

  release() {
    if (this.target) {
      if (this.target.workers) this.target.workers--;
      if (this.target.claimed === this) this.target.claimed = null;
    }
    this.target = null;
  }

  pose(name) { this.anim.set(this.art[name] || this.art.idle); }

  goTo(goal) {
    const p = this.world.terrain.path(this.tx, this.ty, goal);
    if (!p) return false;
    this.path = p; this.state = 'walk';
    return true;
  }

  update(dt) {
    const w = this.world;
    const speedMul = w.hungry ? 0.65 : 1;
    const workMul = speedMul * w.mod('workSpeed');
    this.anim.update(dt * (this.state === 'work' ? workMul : 1));
    const J = JOBS[this.job];

    if (this.sheltered) {
      if (this.hidden) return;
      if (this.state === 'walk' && this.path.length) {
        this.pose('run');
        const next = this.path[0], tx = cx(next.x), ty = foot(next.y);
        const dx = tx - this.px, dy = ty - this.py, d = Math.hypot(dx, dy), step = SPEED * 1.3 * dt;
        if (Math.abs(dx) > 0.5) this.flip = dx < 0;
        if (d <= step) { this.px = tx; this.py = ty; this.path.shift(); } else { this.px += dx / d * step; this.py += dy / d * step; }
        return;
      }
      this.hidden = true; return;
    }

    if (this.state === 'think') {
      this.wait -= dt;
      this.pose(J.idle);
      if (this.wait > 0) return;
      this.decide();
      return;
    }

    if (this.state === 'walk') {
      this.pose(this.carry ? JOBS[this.carry].carry : J.run);
      const next = this.path[0];
      if (!next) { this.arrive(); return; }
      const tx = cx(next.x), ty = foot(next.y);
      const dx = tx - this.px, dy = ty - this.py, d = Math.hypot(dx, dy);
      const step = SPEED * speedMul * dt;
      if (Math.abs(dx) > 0.5) this.flip = dx < 0;
      if (d <= step) { this.px = tx; this.py = ty; this.path.shift(); if (!this.path.length) this.arrive(); }
      else { this.px += dx / d * step; this.py += dy / d * step; }
      return;
    }

    if (this.state === 'work') {
      const t = this.target;
      if (!t || (t.alive === false) || t.gone || (this.job === 'build' && t.done)) { this.release(); this.state = 'think'; this.wait = 0.3; return; }
      this.pose(J.work);
      this.face(t);
      if (this.job === 'build') {
        t.progress = Math.min(1, t.progress + dt * workMul / t.def.build);
        if (Math.floor(this.anim.t * 10) % 6 === 3 && Math.random() < 0.05) w.fx(FX.dust, this.px + (this.flip ? -20 : 20), this.py);
        if (t.done) { w.onBuilt(t); this.release(); this.state = 'think'; this.wait = 0.5; }
        return;
      }
      const loops = this.anim.loops;
      if (loops > this.workT) { this.workT = loops; t.hit?.(); }
      if (loops >= J.loops) {
        if (this.job === 'meat') { w.removeSheep(t); }
        else t.take(w);
        this.release();
        this.carry = this.job; this.carryAmt = J.yield + (this.job === 'gold' ? w.mod('goldBonus', 0) : 0);
        this.headHome();
      }
    }
  }

  face(t) {
    const x = t.px ?? cx(t.x + (t.w ? t.w / 2 - 0.5 : 0));
    if (Math.abs(x - this.px) > 2) this.flip = x < this.px;
  }

  headHome() {
    const door = this.world.castle.door;
    if (!this.goTo(door)) { this.state = 'think'; this.wait = 1; }
  }

  decide() {
    const w = this.world, tr = w.terrain;
    if (this.carry) { this.headHome(); return; }

    if (this.job === 'wood' || this.job === 'gold') {
      const list = this.job === 'wood' ? w.trees : w.stones;
      const usable = (n) => n.alive && n.workers < 2;
      let found = null;
      const p = tr.path(this.tx, this.ty, (x, y) => {
        for (const n of list) if (usable(n) && Math.abs(n.x - x) + Math.abs(n.y - y) === 1) { found = n; return true; }
        return false;
      });
      if (p && found) { this.target = found; found.workers++; this.path = p; this.state = 'walk'; if (!p.length) this.arrive(); return; }
      this.wander(); return;
    }

    if (this.job === 'meat') {
      // always leave a breeding pair in the meadow
      const spare = w.sheep.length - 2 - w.sheep.filter((s) => s.claimed).length;
      const sheep = spare > 0 ? w.sheep.filter((s) => !s.claimed && !s.gone) : [];
      sheep.sort((a, b) => Math.hypot(a.px - this.px, a.py - this.py) - Math.hypot(b.px - this.px, b.py - this.py));
      for (const s of sheep.slice(0, 3)) {
        const p = tr.path(this.tx, this.ty, (x, y) => Math.abs(s.tx - x) + Math.abs(s.ty - y) === 1);
        if (p) { s.claimed = this; this.target = s; this.path = p; this.state = 'walk'; if (!p.length) this.arrive(); return; }
      }
      this.wander(); return;
    }

    if (this.job === 'build') {
      const sites = w.buildings.filter((b) => !b.done);
      for (const b of sites) {
        const spots = tr.standSpots(b.x, b.y, b.w, b.h);
        const p = tr.path(this.tx, this.ty, (x, y) => spots.some((s) => s.x === x && s.y === y));
        if (p) { this.target = b; b.workers++; this.path = p; this.state = 'walk'; if (!p.length) this.arrive(); return; }
      }
      this.wander(); return;
    }

    this.wander();
  }

  wander() {
    const w = this.world, door = w.castle.door;
    for (let i = 0; i < 8; i++) {
      const x = door.x + Math.round((Math.random() - 0.5) * 8), y = door.y + Math.round(Math.random() * 4);
      if (w.terrain.walkable(x, y) && w.terrain.level[y][x] === 0 && this.goTo({ x, y })) { this.wanderWait = 2 + Math.random() * 4; return; }
    }
    this.state = 'think'; this.wait = 2;
  }

  arrive() {
    this.path = [];
    if (this.carry) {
      this.world.deposit(this.carry, this.carryAmt, this.px, this.py - 60);
      this.carry = null;
      this.state = 'think'; this.wait = 0.15;
      return;
    }
    if (this.target) { this.state = 'work'; this.anim.t = 0; this.workT = 0; this.pose(JOBS[this.job].work); return; }
    this.state = 'think'; this.wait = this.wanderWait || 1; this.wanderWait = 0;
  }

  get sortY() { return this.py; }
  draw(ctx) { this.anim.draw(ctx, this.px, this.py, this.flip); }
}

export { ICONS };
