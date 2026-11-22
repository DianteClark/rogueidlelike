// Island terrain: parses a text map, autotiles it the way Pixel Frog's tilemap guide describes,
// pre-renders the static layers, and provides walkability + pathfinding.
//
// Map legend:
//   .  water          g  flat ground
//   h  elevated ground (plateau, one level up). Cliffs appear automatically under its south edge.
//   s  stairs (top piece). Put it beside the plateau's bottom row; the piece below it becomes the stair foot.
import { img, drawFrame } from '../engine/assets.js';
import { TERRAIN, TILE } from '../data/art.js';

export const BLOCKED = -9;

export class Terrain {
  constructor(rows, { color = 1, highColor = 3 } = {}) {
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.ch = rows.map((r) => r.padEnd(this.w, '.').split(''));
    this.color = color; this.highColor = highColor;
    this.analyse();
  }

  at(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.ch[y][x]; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  analyse() {
    const { w, h } = this;
    const grid = (v) => Array.from({ length: h }, () => new Array(w).fill(v));
    this.land = grid(false);      // flat ground drawn here
    this.high = grid(false);      // plateau top
    this.cliff = grid(0);         // 0 none, 1 cliff over ground, 2 cliff over water
    this.stair = grid(0);         // 0 none, 1 top, 2 foot
    this.stairSide = grid(0);     // 1 = stairs on the plateau's east side, -1 = west side
    this.level = grid(BLOCKED);   // walk level, or BLOCKED
    this.occupied = grid(null);   // buildings / trees / stones put their reference here

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = this.ch[y][x];
      this.land[y][x] = c === 'g' || c === 'h' || c === 's';
      this.high[y][x] = c === 'h';
      if (c === 's') {
        this.stair[y][x] = 1;
        if (this.inside(x, y + 1)) this.stair[y + 1][x] = 2;
        this.stairSide[y][x] = this.at(x - 1, y) === 'h' ? 1 : -1;
        if (this.inside(x, y + 1)) this.stairSide[y + 1][x] = this.stairSide[y][x];
      }
    }
    for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
      if (this.high[y - 1][x] && !this.high[y][x] && !this.stair[y][x]) this.cliff[y][x] = this.land[y][x] ? 1 : 2;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (this.cliff[y][x]) continue;
      if (this.high[y][x] || this.stair[y][x] === 1) this.level[y][x] = 1;
      else if (this.land[y][x]) this.level[y][x] = 0;
    }
  }

  // --- Walking ---------------------------------------------------------------------------
  walkable(x, y) { return this.inside(x, y) && this.level[y][x] !== BLOCKED && !this.occupied[y][x]; }

  canStep(ax, ay, bx, by) {
    if (!this.walkable(bx, by)) return false;
    const la = this.level[ay][ax], lb = this.level[by][bx];
    if (la === lb) {
      // a stair foot only connects up to its own top, and sideways/down to ground
      return true;
    }
    // level change only along a staircase (top <-> foot)
    return ax === bx && Math.abs(ay - by) === 1 &&
      ((this.stair[ay][ax] === 1 && this.stair[by][bx] === 2) || (this.stair[ay][ax] === 2 && this.stair[by][bx] === 1));
  }

  // Breadth-first path on the tile grid (maps are small). Returns [{x,y}...] excluding start, or null.
  path(sx, sy, goal, maxNodes = 4000) {
    const key = (x, y) => y * this.w + x;
    const isGoal = typeof goal === 'function' ? goal : (x, y) => x === goal.x && y === goal.y;
    if (isGoal(sx, sy)) return [];
    const prev = new Map([[key(sx, sy), -1]]);
    const q = [[sx, sy]];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < q.length && i < maxNodes; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || !this.canStep(x, y, nx, ny)) continue;
        prev.set(k, key(x, y));
        if (isGoal(nx, ny)) {
          const out = [];
          for (let c = k; c !== key(sx, sy); c = prev.get(c)) out.push({ x: c % this.w, y: Math.floor(c / this.w) });
          return out.reverse();
        }
        q.push([nx, ny]);
      }
    }
    return null;
  }

  // Walkable tile next to (x,y) footprint that is reachable — used to stand beside a tree/stone/door.
  standSpots(x, y, w = 1, h = 1) {
    const out = [];
    const top = y - h + 1;
    for (let i = x; i < x + w; i++) { out.push({ x: i, y: y + 1 }); out.push({ x: i, y: top - 1 }); }
    for (let j = top; j <= y; j++) { out.push({ x: x - 1, y: j }); out.push({ x: x + w, y: j }); }
    return out.filter((p) => this.walkable(p.x, p.y));
  }

  // --- Rendering -------------------------------------------------------------------------
  // 16-piece autotile index: picks the column/row inside a 4×4 block from N/E/S/W neighbours.
  static pick(n, e, s, w) {
    const col = w && e ? 1 : !w && e ? 0 : w && !e ? 2 : 3;
    const row = n && s ? 1 : !n && s ? 0 : n && !s ? 2 : 3;
    return [col, row];
  }

  buildStatic() {
    const T = TILE, { w, h } = this;
    const cv = document.createElement('canvas');
    cv.width = w * T; cv.height = h * T;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const tiles = img(TERRAIN.tilemap(this.color).src);
    const high = img(TERRAIN.tilemap(this.highColor).src) || tiles;
    const shadow = img(TERRAIN.shadow.src);
    const blit = (c, r, x, y, sheet = tiles) => g.drawImage(sheet, c * T, r * T, T, T, x * T, y * T, T, T);

    // 1. flat ground
    const L = (x, y) => this.inside(x, y) && this.land[y][x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!this.land[y][x]) continue;
      const [c, r] = Terrain.pick(L(x, y - 1), L(x + 1, y), L(x, y + 1), L(x - 1, y));
      blit(c, r, x, y);
    }
    // 2. shadows: one tile lower than each plateau tile
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (this.high[y][x]) g.drawImage(shadow, x * T - 64, (y + 1) * T - 64);
    }
    // 3. plateau tops (stair tops count as plateau so the edge joins up)
    const H = (x, y) => this.inside(x, y) && (this.high[y][x] || this.stair[y][x] === 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!this.high[y][x]) continue;
      const [c, r] = Terrain.pick(H(x, y - 1), H(x + 1, y), this.inside(x, y + 1) && this.high[y + 1][x], H(x - 1, y));
      blit(5 + c, r, x, y, high);
    }
    // 4. cliffs (stair feet count as cliff so the rock face joins up)
    const C = (x, y) => this.inside(x, y) && (this.cliff[y][x] || this.stair[y][x] === 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = this.cliff[y][x];
      if (!k) continue;
      const we = C(x - 1, y), ea = C(x + 1, y);
      const col = we && ea ? 6 : !we && ea ? 5 : we && !ea ? 7 : 8;
      blit(col, k === 1 ? 4 : 5, x, y, high);
    }
    // 5. stairs
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = this.stair[y][x];
      if (!s) continue;
      blit(this.stairSide[y][x] === 1 ? 3 : 0, s === 1 ? 4 : 5, x, y, high);
    }
    this.staticCanvas = cv;

    // foam spots: land/cliff tiles that touch water, each starting on its own frame
    this.foam = [];
    const wet = (x, y) => !this.inside(x, y) || (!this.land[y][x] && !this.cliff[y][x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!this.land[y][x] && !this.cliff[y][x]) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) for (let dx = -1; dx <= 1; dx++) if (wet(x + dx, y + dy)) { touches = true; break; }
      if (touches) this.foam.push({ x, y, f: Math.floor(Math.random() * 16) });
    }
  }

  drawWater(ctx, view) {
    ctx.fillStyle = '#47ABA9';
    ctx.fillRect(view.x - 2, view.y - 2, view.w + 4, view.h + 4);
  }

  drawFoam(ctx, time, view) {
    const T = TILE, base = Math.floor(time * 10);
    for (const f of this.foam) {
      const px = f.x * T, py = f.y * T;
      if (px + 128 < view.x || py + 128 < view.y || px - 64 > view.x + view.w || py - 64 > view.y + view.h) continue;
      drawFrame(ctx, TERRAIN.foam, base + f.f, px + 32, py + 32, false);
    }
  }

  drawStatic(ctx) { ctx.drawImage(this.staticCanvas, 0, 0); }
}
