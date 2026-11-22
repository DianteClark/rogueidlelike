// Campaign sea chart: each stage is a little island; sail along the route, tap an island to fight there.
import { Terrain } from '../world/terrain.js';
import { TILE, TERRAIN, NATURE, ICONS } from '../data/art.js';
import { REGIONS, ENEMIES, stageEnemies, KING_AVATAR } from '../data/units.js';
import { KINGDOMS } from '../data/kingdoms.js';
import { power } from '../game/heroes.js';
import { img, drawFrame, loadAll, collectSrcs } from '../engine/assets.js';
import { rng } from '../world/generate.js';

const T = TILE;
export const MAP_W = 10, MAP_H = 17;
const enc = (s) => encodeURI(s);
const $ = (s) => document.getElementById(s);

// Stage islands zig-zag up the chart. Positions are tile coords of each island's top-left.
const NODES = [
  [1, 14], [5, 14], [7, 11], [3, 11], [1, 8], [5, 8], [7, 5], [3, 5], [1, 2], [5, 1],
];

function chart(region) {
  const rows = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill('.'));
  NODES.forEach(([x, y], i) => {
    const boss = i === region.stages - 1;
    const w = boss ? 3 : 2, h = boss ? 3 : 2;
    for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) if (rows[y + j] && x + k < MAP_W) rows[y + j][x + k] = 'g';
  });
  return rows.map((r) => r.join(''));
}

export class MapScreen {
  constructor(game) {
    this.game = game; this.time = 0; this.sel = null;
    this.ui = $('mapui');
    $('map-close').onclick = () => this.close();
    this.ui.addEventListener('click', (e) => {
      const b = e.target.closest('[data-map]'); if (!b || b.disabled) return;
      if (b.dataset.map === 'fight') { const s = this.sel; this.close(true); this.game.startBattle(s); }
    });
  }

  get world() { return this.game.world; }

  async open() {
    const c = this.world.campaign, R = REGIONS[c.region];
    if (!this.terrain || this.regionIdx !== c.region) {
      await loadAll(collectSrcs({ t: [TERRAIN.tilemap(R.terrain), TERRAIN.foam], n: [NATURE.bushes, NATURE.rocks] }));
      this.terrain = new Terrain(chart(R), { color: R.terrain });
      this.terrain.buildStatic();
      this.regionIdx = c.region;
      const r = rng(7);
      this.decor = NODES.map(([x, y], i) => ({ def: (r() < 0.6 ? NATURE.bushes : NATURE.rocks)[i % 4], x: (x + (r() < 0.5 ? 0.3 : 1.5)) * T, y: (y + 0.4) * T }));
    }
    const enemySrcs = new Set(Object.values(ENEMIES).map((e) => e.avatar));
    enemySrcs.add(KING_AVATAR(KINGDOMS[this.world.kingdom].color));
    await loadAll(enemySrcs);
    this.sel = Math.min(c.stage, R.stages);
    this.game.map = this;
    this.game.camera.locked = true;
    document.body.classList.add('mapping');
    this.ui.classList.remove('hidden');
    this.render();
  }

  close(toBattle) {
    this.game.map = null;
    this.game.camera.locked = false;
    this.ui.classList.add('hidden');
    if (!toBattle) document.body.classList.remove('mapping');
    else setTimeout(() => document.body.classList.remove('mapping'), 300);
  }

  nodeCenter(i) {
    const R = REGIONS[this.regionIdx], boss = i === R.stages - 1, [x, y] = NODES[i];
    return { x: (x + (boss ? 1.5 : 1)) * T, y: (y + (boss ? 1.5 : 1)) * T };
  }

  // screen → chart coords use the transform from the last draw
  tap(sx, sy) {
    if (!this.view) return;
    const { ox, oy, zoom } = this.view;
    const x = (sx - ox) / zoom, y = (sy - oy) / zoom;
    const R = REGIONS[this.regionIdx], c = this.world.campaign;
    for (let i = 0; i < R.stages; i++) {
      const p = this.nodeCenter(i);
      if (Math.hypot(p.x - x, p.y - y) < 80) {
        if (i + 1 > c.stage) { this.game.hud.toast('Clear the previous stage first'); return; }
        this.sel = i + 1; this.render(); return;
      }
    }
  }

  render() {
    const w = this.world, c = w.campaign, R = REGIONS[c.region], s = this.sel;
    const foes = [...new Set(stageEnemies(c.region, s))].map((id) => `<img src="${enc(ENEMIES[id].avatar)}" alt="">`).join('');
    const team = w.team.map((id) => w.hero(id)).filter(Boolean);
    const tp = team.reduce((a, h) => a + power(h), 0);
    const cleared = s <= c.best;
    $('map-title').textContent = R.name;
    $('map-body').innerHTML = `
      <h2>${s === R.stages ? 'Boss — the Troll' : 'Stage ' + s}${cleared ? ' <small style="color:#3d7a2a">(cleared)</small>' : ''}</h2>
      <div class="foes">${foes}</div>
      <p>Team power <b>${tp}</b> · ${team.length}/5 heroes · idle loot ${w.campaignRate} gold/min</p>
      <button class="bigbtn" style="width:100%" data-map="fight" ${team.length ? '' : 'disabled'}>${team.length ? (cleared ? 'Replay' : 'Battle!') : 'Recruit heroes first'}</button>`;
  }

  update(dt) { this.time += dt; }

  draw(ctx, cw, ch, dpr, safeTop) {
    const R = REGIONS[this.regionIdx], c = this.world.campaign;
    const zoom = Math.min(cw / (MAP_W * T), (ch - safeTop - 330) / (MAP_H * T));
    const ox = (cw - MAP_W * T * zoom) / 2, oy = safeTop + 60;
    this.view = { ox, oy, zoom };
    const s = zoom * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#47ABA9'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(s, 0, 0, s, Math.round(ox * dpr), Math.round(oy * dpr));
    ctx.imageSmoothingEnabled = false;

    // dotted sailing route
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 6; ctx.setLineDash([10, 14]); ctx.lineDashOffset = -this.time * 20;
    ctx.beginPath();
    for (let i = 0; i < R.stages; i++) { const p = this.nodeCenter(i); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke(); ctx.setLineDash([]);

    this.terrain.drawFoam(ctx, this.time, { x: -T, y: -T, w: (MAP_W + 2) * T, h: (MAP_H + 2) * T });
    this.terrain.drawStatic(ctx);
    for (const d of this.decor) drawFrame(ctx, d.def, 0, d.x, d.y);

    const king = img(KING_AVATAR(KINGDOMS[this.world.kingdom].color));
    for (let i = 0; i < R.stages; i++) {
      const p = this.nodeCenter(i), n = i + 1;
      const done = n <= c.best, cur = n === c.stage && !done, locked = n > c.stage;
      // stage badge
      ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = done ? '#5d9e43' : cur ? '#f0a73a' : locked ? 'rgba(60,60,70,.65)' : '#c9c2b0';
      ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = n === this.sel ? '#fff' : '#2a2420'; ctx.stroke();
      ctx.font = '26px BoldPixels, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(i === R.stages - 1 ? '☠' : String(n), p.x, p.y + 1);
      if (n === this.sel && king) {
        const bob = Math.sin(this.time * 4) * 5;
        ctx.drawImage(king, p.x - 44, p.y - 118 + bob, 88, 88);
      }
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
}

export { ICONS };
