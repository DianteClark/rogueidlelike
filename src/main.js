// Entry point: loads art, builds the world, runs the game loop, handles saving and app lifecycle.
import { loadAll, collectSrcs } from './engine/assets.js';
import { Camera } from './engine/camera.js';
import { World, SAVE_KEY } from './world/world.js';
import { newSeed } from './world/generate.js';
import { KINGDOMS, loadMeta, kingAvatar } from './data/kingdoms.js';
import { chooseKingdom } from './ui/kingdomSelect.js';
import { Battle, ARENA_W, ARENA_H } from './battle/battle.js';
import { REGIONS } from './data/units.js';
import { BattleHud } from './ui/battleHud.js';
import { MapScreen } from './ui/mapScreen.js';
import { Hud } from './ui/hud.js';
import { pawnArt, TERRAIN, NATURE, FX, BUILDINGS, buildingArt, ICONS, TILE } from './data/art.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const game = {
  world: null, hud: null, camera: null, dpr: 1,
  view() { const c = this.camera; return { x: c.x, y: c.y, w: c.w / c.zoom, h: c.h / c.zoom }; },
  save() { this.world?.save(); },
};
window.game = game; // handy for debugging

// iPhone home-screen apps report a viewport that is short by the status bar height when the
// status bar is translucent, leaving an empty strip at the bottom. Use the full screen height there.
function fitHeight() {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const portrait = innerHeight >= innerWidth;
  let h = innerHeight;
  if (standalone && portrait && screen.height > h) h = screen.height;
  document.documentElement.style.setProperty('--app-h', h + 'px');
}

function measureSafeTop() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top, 0px);visibility:hidden';
  document.body.appendChild(probe);
  game.safeTop = probe.offsetHeight;
  probe.remove();
}

function resize() {
  fitHeight();
  measureSafeTop();
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
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));

  // shared art (terrain, nature, effects, UI); per-kingdom art loads when a color is picked
  const common = collectSrcs({ t: [1, 2, 3, 4].map((n) => TERRAIN.tilemap(n)), s: TERRAIN.shadow, f: TERRAIN.foam, n: NATURE, fx: FX });
  Object.values(ICONS).forEach((s) => common.add(s));
  const fill = document.getElementById('loadfill');
  await Promise.all([
    loadAll(common, (p) => { fill.style.width = Math.round(p * 90) + '%'; }),
    document.fonts?.load('16px BoldPixels').catch(() => {}),
  ]);

  if (location.hash.startsWith('#reset')) { localStorage.removeItem(SAVE_KEY); }
  const save = World.loadSave();
  const hud = new Hud(game);
  game.hud = hud;
  const bhud = new BattleHud(game);
  game.bhud = bhud;
  game.mapScreen = new MapScreen(game);
  game.openMap = () => game.mapScreen.open();
  game.startBattle = async (stageArg) => {
    if (game.battle || game.starting) return;
    game.starting = true;
    document.body.classList.add('battling');
    const w = game.world, c = w.campaign;
    const stage = typeof stageArg === 'number' ? Math.min(stageArg, c.stage) : c.stage;
    const b = new Battle({
      world: w, regionIdx: c.region, stage,
      onEnd: (win, battle) => {
        if (battle !== game.battle) return;
        const reward = win ? w.winStage(stage, battle.team) : null;
        battle.injuries = w.applyCasualties(battle.heroes, win);
        const leave = () => { game.battle = null; bhud.hide(); hud.refresh(); w.save(); };
        const R = REGIONS[c.region];
        bhud.result(win, reward, battle, {
          island: leave,
          map: () => { leave(); game.openMap(); },
          next: win && stage < R.stages ? () => { leave(); game.startBattle(stage + 1); } : null,
          retry: !win ? () => { leave(); game.startBattle(stage); } : null,
        });
      },
    });
    hud.toast('Preparing for battle…', 1200);
    let ok = false;
    try { ok = await b.prepare(); } finally { game.starting = false; }
    if (!ok) { document.body.classList.remove('battling'); hud.toast(w.team.length ? 'Your team is too hurt to fight — heal them or swap heroes in' : 'Add heroes to your team first', 3000); return; }
    game.battle = b;
    bhud.show(b);
  };
  const cam = new Camera(canvas);
  game.camera = cam;

  let building = 0;
  const seedHash = location.hash.match(/seed=(\d+)/);
  const previewSeed = seedHash ? Number(seedHash[1]) : newSeed();
  async function makeWorld(kingdom, saveData) {
    const ticket = ++building;
    await loadAll(colorSrcs(KINGDOMS[kingdom].color, KINGDOMS[kingdom].buildings));
    await loadAll([kingAvatar(kingdom)]);
    if (ticket !== building) return; // a newer pick replaced this one
    const world = new World({
      toast: (m) => hud.toast(m),
      changed: () => hud.refresh(),
      gained: (k) => hud.bump(k),
      building: (b) => hud.showBuilding(b),
      raid: (r) => { hud.toast('Raiders have landed! Pawns are running to the castle.', 3000); if (r.landing) cam.centerOn((r.landing.x + 0.5) * TILE, (r.landing.y + 0.5) * TILE); },
    }, kingdom);
    world.init(saveData, previewSeed);
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

  cam.onHold = (x, y) => game.started && !game.battle && !game.map && game.world.pickUp(x, y);
  cam.onHoldMove = (x, y) => game.world.dragTo(x, y);
  cam.onHoldEnd = () => game.world.drop();
  cam.onTap = (x, y, sx, sy) => {
    if (!game.started || game.battle) return;
    if (game.map) { game.map.tap(sx, sy); return; }
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
  setInterval(() => game.started && hud.raidTick(), 500);
}

function colorSrcs(color, set) {
  const srcs = collectSrcs({ a: pawnArt(color) });
  for (const [type, d] of Object.entries(BUILDINGS)) {
    for (let v = 0; v < (d.variants?.length || 1); v++) srcs.add(buildingArt(type, { color, set, variant: v }).src);
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
      if (game.battle) { game.battle.update(dt); game.bhud.update(game.battle); renderBattle(); }
      else if (game.map) { game.map.update(dt); game.map.draw(ctx, canvas.clientWidth, canvas.clientHeight, game.dpr, game.safeTop); }
      else render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { reset() { last = performance.now(); } };
}

function renderBattle() {
  const { battle, dpr } = game;
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const safeTop = game.safeTop;
  const zoom = Math.min(cw / (ARENA_W * TILE), (ch - safeTop - 190) / (ARENA_H * TILE));
  const s = zoom * dpr;
  const ox = (cw - ARENA_W * TILE * zoom) / 2, oy = safeTop + 40 + Math.max(0, (ch - safeTop - 190 - ARENA_H * TILE * zoom) / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#47ABA9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, Math.round(ox * dpr), Math.round(oy * dpr));
  ctx.imageSmoothingEnabled = false;
  battle.draw(ctx);
  if (battle.flashScreen > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,236,170,${Math.max(0, battle.flashScreen) * 0.5})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
