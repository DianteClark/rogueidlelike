// Entry point: loads art, builds the world, runs the game loop, handles saving and app lifecycle.
import { loadAll, collectSrcs } from './engine/assets.js';
import { Camera } from './engine/camera.js';
import { World, SAVE_KEY } from './world/world.js';
import { KINGDOMS, loadMeta } from './data/kingdoms.js';
import { chooseKingdom } from './ui/kingdomSelect.js';
import { Hud } from './ui/hud.js';
import { pawnArt, TERRAIN, NATURE, FX, BUILDINGS, buildingSrc, ICONS, TILE } from './data/art.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const game = {
  world: null, hud: null, camera: null, dpr: 1,
  view() { const c = this.camera; return { x: c.x, y: c.y, w: c.w / c.zoom, h: c.h / c.zoom }; },
  save() { this.world?.save(); },
};
window.game = game; // handy for debugging

function resize() {
  game.dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(canvas.clientWidth * game.dpr);
  canvas.height = Math.round(canvas.clientHeight * game.dpr);
  game.camera?.clamp();
}

async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  resize();
  window.addEventListener('resize', resize);

  // shared art (terrain, nature, effects, UI); per-kingdom art loads when a color is picked
  const common = collectSrcs({ t: { m: TERRAIN.tilemap(1), m3: TERRAIN.tilemap(3), s: TERRAIN.shadow, f: TERRAIN.foam }, n: NATURE, fx: FX });
  Object.values(ICONS).forEach((s) => common.add(s));
  const fill = document.getElementById('loadfill');
  await Promise.all([
    loadAll(common, (p) => { fill.style.width = Math.round(p * 90) + '%'; }),
    document.fonts?.load('16px BoldPixels').catch(() => {}),
  ]);

  if (location.hash === '#reset') { localStorage.removeItem(SAVE_KEY); history.replaceState(null, '', location.pathname); }
  const save = World.loadSave();
  const hud = new Hud(game);
  game.hud = hud;
  const cam = new Camera(canvas);
  game.camera = cam;

  let building = 0;
  async function makeWorld(kingdom, saveData) {
    const ticket = ++building;
    await loadAll(colorSrcs(KINGDOMS[kingdom].color));
    if (ticket !== building) return; // a newer pick replaced this one
    const world = new World({
      toast: (m) => hud.toast(m),
      changed: () => hud.refresh(),
      gained: (k) => hud.bump(k),
      building: (b) => hud.showBuilding(b),
    }, kingdom);
    world.init(saveData);
    world.terrain.buildStatic();
    const first = !game.world;
    game.world = world;
    if (first) {
      cam.bounds = { w: world.terrain.w * TILE, h: world.terrain.h * TILE };
      cam.minZoom = Math.max(0.3, cam.w / (world.terrain.w * TILE) * 0.9);
      cam.maxZoom = 1.8;
      cam.zoom = Math.min(cam.maxZoom, Math.max(cam.minZoom, cam.w / (9.5 * TILE)));
      const d = world.castle.door;
      cam.centerOn((d.x + 0.5) * TILE, (d.y - 1) * TILE);
    }
    hud.refresh();
  }

  cam.onTap = (x, y) => {
    if (!game.started) return;
    game.world.tap(x, y);
    if (game.world.placing) hud.render();
  };

  const loop = startLoop();

  if (save) {
    await makeWorld(save.kingdom || 'blue', save);
    document.getElementById('loading').classList.add('done');
    game.started = true;
    if (save.t) {
      const away = game.world.applyOffline((Date.now() - save.t) / 1000);
      if (away) hud.showAway(away);
    }
  } else {
    await makeWorld('blue', null);
    document.getElementById('loading').classList.add('done');
    document.getElementById('hud').style.visibility = 'hidden';
    const meta = loadMeta();
    const pick = await chooseKingdom(meta, (id) => makeWorld(id, null));
    if (game.world.kingdom !== pick) await makeWorld(pick, null);
    document.getElementById('hud').style.visibility = '';
    game.started = true;
    game.world.save();
    hud.toast(`Long live the ${KINGDOMS[pick].name}!`, 3000);
  }
  hud.refresh();

  // lifecycle: save when hidden, catch up when shown again
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (!game.started) return;
    const world = game.world;
    if (document.hidden) { hiddenAt = Date.now(); world.save(); }
    else if (hiddenAt) {
      const away = world.applyOffline((Date.now() - hiddenAt) / 1000);
      hiddenAt = 0; loop.reset();
      if (away) hud.showAway(away);
      hud.refresh();
    }
  });
  window.addEventListener('pagehide', () => game.started && game.world.save());
  setInterval(() => game.started && game.world.save(), 5000);
}

function colorSrcs(color) {
  const srcs = collectSrcs({ a: pawnArt(color) });
  for (const d of Object.values(BUILDINGS)) {
    srcs.add(buildingSrc(d.file, color));
    d.variants?.forEach((v) => srcs.add(buildingSrc(v, color)));
  }
  return srcs;
}

function startLoop() {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game.world) {
      game.camera.update(dt);
      game.world.update(dt);
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { reset() { last = performance.now(); } };
}

function render() {
  const { camera: cam, world, dpr } = game;
  const s = cam.zoom * dpr;
  // snap the camera to whole device pixels so tiles never show seams
  const ox = Math.round(cam.x * s), oy = Math.round(cam.y * s);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#47ABA9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, -ox, -oy);
  ctx.imageSmoothingEnabled = false;
  world.draw(ctx, { x: ox / s, y: oy / s, w: canvas.width / s, h: canvas.height / s });
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').innerHTML = `<p style="color:#fff;padding:24px">Something went wrong loading the game.<br>${e.message}</p>`;
});
