// In-run menu: resume, Legacy shop, retire and start a new Era, wipe all progress.
import { KINGDOMS, BOOSTS, loadMeta, saveMeta, kingAvatar } from '../data/kingdoms.js';
import { SAVE_KEY } from '../world/world.js';

const $ = (s) => document.getElementById(s);
const enc = (s) => encodeURI(s);
const META_KEY = 'tinycrowns.meta.v1';

export class Menu {
  constructor(game) {
    this.game = game;
    $('menubtn').onclick = () => this.open();
    $('menu').onclick = (e) => {
      if (e.target.id === 'menu') { this.close(); return; }
      const b = e.target.closest('[data-m]'); if (!b || b.disabled) return;
      this.act(b.dataset.m, b.dataset.arg);
    };
  }

  open(page = 'main') { this.page = page; this.confirm = null; this.render(); $('menu').classList.remove('hidden'); }
  close() { $('menu').classList.add('hidden'); }

  render() {
    const w = this.game.world, K = KINGDOMS[w.kingdom], meta = loadMeta();
    if (this.page === 'shop') {
      $('menu-body').innerHTML = `<h2>Legacy shop</h2><p>Legacy: <b>${meta.legacy || 0}</b>. Boosts apply from your next Era.</p>` +
        Object.entries(BOOSTS).map(([k, b]) => {
          const lvl = meta.boosts[k] || 0, maxed = lvl >= b.max, cost = b.cost(lvl);
          return `<div class="perk"><span><b>${b.name}</b> ${'●'.repeat(lvl)}${'○'.repeat(b.max - lvl)}<br><small>${b.text(maxed ? lvl : lvl + 1)}</small></span>
            <button class="sbtn wbtn" data-m="buy" data-arg="${k}" ${maxed || (meta.legacy || 0) < cost ? 'disabled' : ''}>${maxed ? 'Max' : cost}</button></div>`;
        }).join('') + `<button class="bigbtn" data-m="back">Back</button>`;
      return;
    }
    const legacyNow = w.runSummary('retired').legacy;
    $('menu-body').innerHTML = `
      <div style="display:flex;gap:10px;align-items:center">
        <img src="${enc(kingAvatar(w.kingdom))}" alt="" style="width:72px;height:72px;object-fit:contain">
        <div><h2 style="margin:0;color:${K.hex}">${K.name}</h2>
        <div>Stage ${w.campaign.best} cleared · ${w.heroes.length} heroes · Legacy ${meta.legacy || 0}</div></div>
      </div>
      <button class="bigbtn" data-m="resume">Resume</button>
      <button class="bigbtn" data-m="shop">Legacy shop</button>
      <button class="bigbtn" data-m="newera">${this.confirm === 'newera' ? 'Tap again: retire & start over' : `Retire & new Era (+${legacyNow} Legacy)`}</button>
      <button class="bigbtn red" data-m="wipe">${this.confirm === 'wipe' ? 'Tap again: erase EVERYTHING' : 'Wipe all progress'}</button>
      <p class="muted" style="font-size:13px;text-align:center;margin-top:8px">Wipe deletes this run, your Legacy, unlocked kingdoms and boosts.</p>`;
  }

  act(a, arg) {
    const w = this.game.world;
    if (a === 'resume') return this.close();
    if (a === 'back') { this.page = 'main'; return this.render(); }
    if (a === 'shop') { this.page = 'shop'; return this.render(); }
    if (a === 'buy') {
      const meta = loadMeta(), lvl = meta.boosts[arg] || 0, cost = BOOSTS[arg].cost(lvl);
      if ((meta.legacy || 0) >= cost) { meta.legacy -= cost; meta.boosts[arg] = lvl + 1; saveMeta(meta); }
      return this.render();
    }
    if (a === 'newera' || a === 'wipe') {
      if (this.confirm !== a) { this.confirm = a; return this.render(); }
      if (a === 'newera') { this.close(); w.endRun('retired'); return; }
      w.discarded = true; this.game.started = false;
      localStorage.removeItem(SAVE_KEY); localStorage.removeItem(META_KEY);
      location.hash = ''; location.reload();
    }
  }
}
