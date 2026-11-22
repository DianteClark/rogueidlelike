// Seeded random island generator. Same seed → same island, so a run's island is stored as just a number.
// Produces a text map (legend in terrain.js) plus a starting layout: castle, a house, a forest,
// gold on a plateau reached by stairs, a sheep meadow and decorations. Every island is checked so
// pawns can actually reach their work; bad rolls are retried with a derived seed.
import { Terrain } from './terrain.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => (Math.random() * 2 ** 31) >>> 0;

const W = 24, H = 28;

export function generateIsland(seed) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const out = tryIsland(rng((seed + attempt * 7919) >>> 0));
    if (out) return { ...out, seed };
  }
  throw new Error('Island generation failed');
}

function tryIsland(R) {
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(R() * arr.length)];
  const grid = (v) => Array.from({ length: H }, () => new Array(W).fill(v));
  const inMargin = (x, y) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // ---- 1. land shape: noisy ellipse + random blobs − bites, smoothed
  let land = grid(false);
  const cx = W / 2 - 0.5 + (R() - 0.5) * 2, cy = H / 2 - 0.5 + (R() - 0.5) * 2;
  const rx = W * (0.34 + R() * 0.06), ry = H * (0.36 + R() * 0.05);
  const blobs = Array.from({ length: ri(4, 7) }, () => {
    const a = R() * Math.PI * 2, d = 0.55 + R() * 0.4;
    return { x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: 2.5 + R() * 3 };
  });
  const bites = Array.from({ length: ri(1, 3) }, () => {
    const a = R() * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx * 1.02, y: cy + Math.sin(a) * ry * 1.02, r: 2 + R() * 2.5 };
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inMargin(x, y)) continue;
    const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (R() - 0.5) * 0.35;
    let l = e < 1 || blobs.some((b) => (x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r);
    if (bites.some((b) => (x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r)) l = false;
    land[y][x] = l;
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = grid(false);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inMargin(x, y)) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && land[y + dy]?.[x + dx]) n++;
      next[y][x] = n >= 5 || (land[y][x] && n >= 4);
    }
    land = next;
  }
  // keep the biggest landmass; fill small lakes
  const comps = components(land, true);
  if (!comps.length) return null;
  const main = comps.sort((a, b) => b.length - a.length)[0];
  if (main.length < 200) return null;
  land = grid(false);
  for (const [x, y] of main) land[y][x] = true;
  for (const lake of components(land, false)) {
    if (lake.length < 8 && !lake.some(([x, y]) => x === 0 || y === 0 || x === W - 1 || y === H - 1)) for (const [x, y] of lake) land[y][x] = true;
  }
  const isLand = (x, y) => land[y]?.[x] === true;
  const solid = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!isLand(x + dx, y + dy)) return false; return true; };

  // ---- 2. plateau: one or two overlapping rectangles, fully inland, upper part of the island
  const high = grid(false);
  let placed = false;
  for (let t = 0; t < 60 && !placed; t++) {
    const rects = [{ w: ri(4, 7), h: ri(3, 4) }];
    if (R() < 0.6) rects.push({ w: ri(3, 5), h: ri(2, 3) });
    rects[0].x = ri(2, W - rects[0].w - 2); rects[0].y = ri(3, Math.floor(H * 0.5));
    if (rects[1]) { rects[1].x = rects[0].x + ri(-2, rects[0].w - 2); rects[1].y = rects[0].y + ri(-2, 1); }
    const cells = new Set();
    for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.add(y * W + x);
    let ok = true;
    for (const k of cells) {
      const x = k % W, y = Math.floor(k / W);
      if (!solid(x, y) || !isLand(x, y + 2) || !isLand(x, y + 3)) { ok = false; break; }
    }
    // each column and row must be one unbroken run (no plateau above a gap above more plateau)
    if (ok) ok = contiguous(cells, true) && contiguous(cells, false);
    if (!ok) continue;
    for (const k of cells) high[Math.floor(k / W)][k % W] = true;
    placed = true;
  }
  if (!placed) return null;
  const isHigh = (x, y) => high[y]?.[x] === true;

  // ---- 3. stairs beside the plateau's bottom row
  const stairs = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isHigh(x, y) || isHigh(x, y + 1)) continue;
    for (const side of [-1, 1]) {
      const sx = x + side;
      if (isHigh(sx, y) || !isLand(sx, y) || isHigh(sx, y - 1) || isHigh(sx, y + 1)) continue;
      if (!isLand(sx, y + 1) || !isLand(sx, y + 2) || !isLand(sx + side, y + 1)) continue;
      stairs.push({ x: sx, y });
    }
  }
  if (!stairs.length) return null;
  const stair = pickOne(stairs);

  const map = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) row += stair.x === x && stair.y === y ? 's' : isHigh(x, y) ? 'h' : isLand(x, y) ? 'g' : '.';
    map.push(row);
  }
  const tr = new Terrain(map);
  const occ = grid(null);
  const free = (x, y, lvl = 0) => tr.inside(x, y) && tr.level[y][x] === lvl && !tr.stair[y][x] && !occ[y][x];
  const lowOrWater = (x, y) => !tr.inside(x, y) || (!tr.high[y][x] && !tr.cliff[y][x] && !tr.stair[y][x]);
  const nearStair = (x, y) => Math.abs(x - stair.x) <= 1 && y >= stair.y - 1 && y <= stair.y + 2;

  // ---- 4. castle near the middle of the open ground
  const mid = centroid(main);
  const castles = [];
  for (let y = 3; y < H - 3; y++) for (let x = 1; x < W - 5; x++) {
    let ok = true;
    // the castle art rises ~2 tiles above its footprint: keep that space clear of plateau and cliffs
    for (let i = 0; i < 5 && ok; i++) for (let j = -3; j <= -2 && ok; j++) if (!lowOrWater(x + i, y + j)) ok = false;
    for (let i = -1; i <= 5 && ok; i++) for (let j = -2; j <= 2 && ok; j++) {
      const inFoot = i >= 0 && i < 5 && j >= -1 && j <= 0;
      if (inFoot || j >= 1 || i === 2) { if (!free(x + i, y + j) || nearStair(x + i, y + j)) ok = false; }
      else if (!(tr.level[y + j]?.[x + i] >= 0)) ok = false;
    }
    if (ok) castles.push({ x, y, d: Math.hypot(x + 2 - mid.x, y - mid.y - 2) + R() * 2 });
  }
  if (!castles.length) return null;
  const castle = castles.sort((a, b) => a.d - b.d)[0];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) occ[castle.y - j][castle.x + i] = 'castle';
  const door = { x: castle.x + 2, y: castle.y + 1 };
  const keepClear = (x, y) => Math.abs(x - door.x) <= 1 && y >= door.y && y <= door.y + 1;

  // ---- 5. a house near the castle
  const houses = [];
  for (let y = 2; y < H - 2; y++) for (let x = 1; x < W - 2; x++) {
    const d = Math.hypot(x - door.x, y - door.y);
    if (d < 3 || d > 7) continue;
    if (!free(x, y) || !free(x + 1, y) || !free(x + 1, y + 1) || keepClear(x, y) || keepClear(x + 1, y)) continue;
    if (nearStair(x, y) || nearStair(x + 1, y)) continue;
    if (![x, x + 1].every((hx) => lowOrWater(hx, y - 1) && lowOrWater(hx, y - 2))) continue;
    if (occ[y - 1]?.[x] || occ[y - 1]?.[x + 1] || occ[y + 1]?.[x - 1] || occ[y]?.[x - 1] || occ[y]?.[x + 2]) continue;
    houses.push({ x, y });
  }
  if (!houses.length) return null;
  const house = pickOne(houses);
  occ[house.y][house.x] = occ[house.y][house.x + 1] = 'house';

  // ---- 6. gold on the plateau
  const highCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tr.level[y][x] === 1 && !tr.stair[y][x] && !nearStair(x, y) && !(Math.abs(x - stair.x) <= 2 && y === stair.y)) highCells.push({ x, y });
  const stones = [];
  for (const size of [5, 3, 2, 1, 4]) {
    const opts = highCells.filter((c) => !occ[c.y][c.x] && stones.every((s) => Math.abs(s[0] - c.x) + Math.abs(s[1] - c.y) >= 2));
    if (!opts.length) break;
    const c = pickOne(opts);
    stones.push([c.x, c.y, size]); occ[c.y][c.x] = 'stone';
    if (stones.length >= 4) break;
  }
  if (stones.length < 2) return null;

  // ---- 7. forest far from the castle, meadow on another side
  const ground = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (free(x, y)) ground.push({ x, y });
  const far = ground.filter((g) => Math.hypot(g.x - door.x, g.y - door.y) > 7);
  if (!far.length) return null;
  const forest = pickOne(far);
  let pen = null, best = -1;
  for (const g of ground) {
    const dd = Math.hypot(g.x - door.x, g.y - door.y);
    if (dd < 4 || dd > 10 || Math.hypot(g.x - forest.x, g.y - forest.y) < 7) continue;
    const box = { x0: g.x - 3, y0: g.y - 2, x1: g.x + 3, y1: g.y + 2 };
    let n = 0;
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) if (free(x, y) && !keepClear(x, y)) n++;
    const score = n + R() * 3;
    if (n >= 14 && score > best) { best = score; pen = box; }
  }
  if (!pen) return null;
  const inPen = (x, y) => x >= pen.x0 && x <= pen.x1 && y >= pen.y0 && y <= pen.y1;

  const trees = [];
  const treeOk = (x, y) => (free(x, y) || free(x, y, 1)) && !keepClear(x, y) && !nearStair(x, y) && !inPen(x, y)
    && Math.hypot(x - door.x, y - door.y) > 3.5 && !N4.some(([dx, dy]) => occ[y + dy]?.[x + dx] === 'tree')
    && !N4.some(([dx, dy]) => occ[y + dy]?.[x + dx] === 'house' || occ[y + dy]?.[x + dx] === 'castle');
  for (const g of [...ground].sort(() => R() - 0.5)) {
    const d = Math.hypot(g.x - forest.x, g.y - forest.y);
    if (d < 6 && R() < 0.75 * (1 - d / 6.5) && treeOk(g.x, g.y)) { trees.push([g.x, g.y]); occ[g.y][g.x] = 'tree'; }
  }
  // a few lone trees by the shore
  const shore = ground.filter((g) => N4.some(([dx, dy]) => !isLand(g.x + dx, g.y + dy)) && Math.hypot(g.x - door.x, g.y - door.y) > 6);
  for (let i = 0; i < 6 && shore.length; i++) { const g = pickOne(shore); if (treeOk(g.x, g.y)) { trees.push([g.x, g.y]); occ[g.y][g.x] = 'tree'; } }

  // ---- 8. reachability: pawns must get from the castle door to trees, gold and the meadow
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (occ[y][x]) tr.occupied[y][x] = occ[y][x];
  const reach = new Set();
  const q = [[door.x, door.y]]; reach.add(door.y * W + door.x);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (!reach.has(k) && tr.canStep(x, y, nx, ny)) { reach.add(k); q.push([nx, ny]); }
    }
  }
  const reachable = (x, y) => reach.has(y * W + x);
  const touch = ([x, y]) => N4.some(([dx, dy]) => reachable(x + dx, y + dy));
  if (trees.filter(touch).length < 8) return null;
  if (stones.filter(touch).length < 2) return null;
  if (!reachable(house.x, house.y + 1)) return null;
  const penTiles = [];
  for (let y = pen.y0; y <= pen.y1; y++) for (let x = pen.x0; x <= pen.x1; x++) if (reachable(x, y)) penTiles.push([x, y]);
  if (penTiles.length < 10) return null;

  // ---- 9. sheep and decorations
  const sheep = [...penTiles].sort(() => R() - 0.5).slice(0, 4);
  const openLand = ground.filter((g) => !occ[g.y][g.x] && !keepClear(g.x, g.y) && !inPen(g.x, g.y));
  const take = (list, n) => [...list].sort(() => R() - 0.5).slice(0, n).map((g) => [g.x, g.y]);
  const water = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (isLand(x, y)) continue;
    let nearLand = false, touching = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isLand(x + dx, y + dy)) { nearLand = true; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) touching = true; }
    if (nearLand && !touching) water.push({ x, y });
  }

  const flat = R() < 0.65 ? 1 : 2, highColor = R() < 0.7 ? 3 : 4;
  return {
    map,
    colors: { flat, high: highColor },
    pen,
    layout: {
      castle: { x: castle.x, y: castle.y },
      buildings: [{ type: 'house', x: house.x, y: house.y, variant: ri(0, 2) }],
      trees, stones, sheep,
      bushes: take(openLand, 7),
      rocks: take(openLand, 4),
      waterRocks: take(water, 5),
    },
  };
}

function components(grid, value) {
  const h = grid.length, w = grid[0].length, seen = new Set(), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grid[y][x] !== value || seen.has(y * w + x)) continue;
    const comp = [], q = [[x, y]]; seen.add(y * w + x);
    while (q.length) {
      const [cx, cy] = q.pop(); comp.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(ny * w + nx) || grid[ny][nx] !== value) continue;
        seen.add(ny * w + nx); q.push([nx, ny]);
      }
    }
    out.push(comp);
  }
  return out;
}

function contiguous(cells, byColumn) {
  const lines = new Map();
  for (const k of cells) {
    const x = k % W, y = Math.floor(k / W);
    const key = byColumn ? x : y, v = byColumn ? y : x;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(v);
  }
  for (const vs of lines.values()) { vs.sort((a, b) => a - b); if (vs[vs.length - 1] - vs[0] + 1 !== vs.length) return false; }
  return true;
}

function centroid(cells) {
  let sx = 0, sy = 0;
  for (const [x, y] of cells) { sx += x; sy += y; }
  return { x: sx / cells.length, y: sy / cells.length };
}
