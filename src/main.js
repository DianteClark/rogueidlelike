// Entry point: loads art, builds the world, runs the game loop, handles saving and app lifecycle.
import { loadAll, collectSrcs } from './engine/assets.js';
import { Camera } from './engine/camera.js';
import { World, SAVE_KEY } from './world/world.js';
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

  // load every image the island needs
  const srcs = collectSrcs({ a: pawnArt('Blue'), t: { m: TERRAIN.tilemap(1), m3: TERRAIN.tilemap(3), s: TERRAIN.shadow, f: TERRAIN.foam }, n: NATURE, fx: FX });
  for (const d of Object.values(BUILDINGS)) {
    srcs.add(buildingSrc(d.file));
    d.variants?.forEach((v) => srcs.add(buildingSrc(v)));
  }
  Object.values(ICONS).forEach((s) => srcs.add(s));
  const fill = document.getElementById('loadfill');
  await Promise.all([
    loadAll(srcs, (p) => { fill.style.width = Math.round(p * 100) + '%'; }),
    document.fonts?.load('700 16px Pixelify').catch(() => {}),
  ]);

  if (location.hash === '#reset') { localStorage.removeItem(SAVE_KEY); history.replaceState(null, '', location.pathname); }
  const save = World.loadSave();
  const hud = new Hud(game);
  game.hud = hud;
  const world = new World({
    toast: (m) => hud.toast(m),
    changed: () => hud.refresh(),
    gained: (k) => hud.bump(k),
    building: (b) => hud.showBuilding(b),
  });
  game.world = world;
  world.init(save);
  world.terrain.buildStatic();

  const cam = new Camera(canvas);
  game.camera = cam;
  cam.bounds = { w: world.terrain.w * TILE, h: world.terrain.h * TILE };
  cam.minZoom = Math.max(0.3, cam.w / (world.terrain.w * TILE) * 0.9);
  cam.maxZoom = 1.8;
  cam.zoom = Math.min(cam.maxZoom, Math.max(cam.minZoom, cam.w / (9.5 * TILE)));
  const d = world.castle.door;
  cam.centerOn((d.x + 0.5) * TILE, (d.y - 1) * TILE);
  cam.onTap = (x, y) => {
    world.tap(x, y);
    if (world.placing) hud.render();
  };

  if (save?.t) {
    const away = world.applyOffline((Date.now() - save.t) / 1000);
    if (away) hud.showAway(away);
  }
  hud.refresh();

  document.getElementById('loading').classList.add('done');

  // lifecycle: save when hidden, catch up when shown again
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); world.save(); }
    else if (hiddenAt) {
      const away = world.applyOffline((Date.now() - hiddenAt) / 1000);
      hiddenAt = 0; last = performance.now();
      if (away) hud.showAway(away);
      hud.refresh();
    }
  });
  window.addEventListener('pagehide', () => world.save());
  setInterval(() => world.save(), 5000);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    cam.update(dt);
    world.update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
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
