// DOM overlay: resource bar, bottom nav, bottom-sheet panels, toasts.
import { BUILDINGS, ICONS, buildingSrc, WAR, FREE } from '../data/art.js';
import { JOBS } from '../world/pawn.js';

const $ = (s) => document.querySelector(s);
const enc = (s) => encodeURI(s);

export class Hud {
  constructor(game) {
    this.game = game;
    this.panel = $('#panel'); this.body = $('#panel-body');
    this.current = null;
    this.toastT = null;
    $('#panel-close').addEventListener('click', () => this.close());
    document.querySelectorAll('.navbtn').forEach((b) => b.addEventListener('click', () => {
      const name = b.dataset.panel;
      if (this.current === name) this.close(); else this.open(name);
    }));
    this.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (btn && !btn.disabled) this.act(btn.dataset.act, btn.dataset.arg);
    });
  }

  get world() { return this.game.world; }

  // ---------------------------------------------------------------- top bar
  refresh() {
    const w = this.world; if (!w) return;
    const r = w.res;
    const fmt = (n) => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.floor(n));
    $('#res-wood span').textContent = fmt(r.wood);
    $('#res-gold span').textContent = fmt(r.gold);
    $('#res-meat span').textContent = fmt(r.meat);
    $('#res-pawns span').textContent = `${w.pawns.length}/${w.pawnCap}`;
    $('#res-meat').style.color = w.hungry ? '#b13a2c' : '';
    if (this.current && this.current !== 'placing') this.render();
  }

  bump(kind) {
    const el = $('#res-' + kind); if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  toast(msg, ms = 2400) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.add('hidden'), ms);
  }

  // ---------------------------------------------------------------- panels
  open(name) {
    if (this.world.placing && name !== 'placing') this.world.cancelPlacing();
    this.current = name;
    document.querySelectorAll('.navbtn').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
    this.render();
    this.panel.classList.remove('hidden');
  }

  close() {
    if (this.current === 'placing') this.world.cancelPlacing();
    this.current = null;
    this.panel.classList.add('hidden');
    document.querySelectorAll('.navbtn').forEach((b) => b.classList.remove('active'));
  }

  render() {
    const fn = this['panel_' + this.current];
    if (!fn) return;
    const html = fn.call(this);
    if (html !== this.lastHtml) { this.body.innerHTML = html; this.lastHtml = html; }
  }

  costHtml(cost) {
    if (!cost) return '';
    return Object.entries(cost).map(([k, v]) =>
      `<span class="cost ${this.world.res[k] < v ? 'short' : ''}"><img src="${enc(ICONS[k])}" alt="">${v}</span>`).join('');
  }

  panel_jobs() {
    const w = this.world;
    const rows = [
      ['wood', ICONS.wood, 'Chop trees for wood'],
      ['gold', ICONS.gold, 'Mine gold stones on the hill'],
      ['meat', ICONS.meat, 'Tend sheep for meat (food)'],
      ['build', ICONS.hammer, 'Construct new buildings'],
    ].map(([k, icon, desc]) => `
      <div class="row">
        <img class="ic" src="${enc(icon)}" alt="">
        <div class="name">${JOBS[k].name}s<small>${desc}</small></div>
        <button class="sbtn red" data-act="job" data-arg="${k}:-1" ${w.jobs[k] <= 0 ? 'disabled' : ''}>−</button>
        <div class="count">${w.jobs[k]}</div>
        <button class="sbtn" data-act="job" data-arg="${k}:1" ${w.idleCount <= 0 ? 'disabled' : ''}>+</button>
      </div>`).join('');
    const food = w.hungry ? '<b style="color:#b13a2c">Out of food — pawns work slower.</b>' :
      `Each pawn eats meat. New pawns arrive when there is room and food.`;
    return `<h2>Pawns ${w.pawns.length}/${w.pawnCap}</h2>
      <p>${w.idleCount} unassigned. ${food}</p>${rows}`;
  }

  panel_build() {
    const w = this.world;
    const rows = Object.entries(BUILDINGS).filter(([k]) => k !== 'castle').map(([k, d]) => `
      <div class="row">
        <img class="ic" src="${enc(buildingSrc(d.file, w.color))}" alt="">
        <div class="name">${d.name}<small>${d.locked ? 'Coming soon' : d.pawns ? `+${d.pawns} pawn room` : ''}</small></div>
        ${d.locked ? '' : this.costHtml(w.costOf(k))}
        <button class="sbtn wbtn" data-act="place" data-arg="${k}" ${d.locked || !w.canAfford(w.costOf(k)) ? 'disabled' : ''}>Build</button>
      </div>`).join('');
    return `<h2>Build</h2><p>Pick a building, then tap the island to place it. Builders will construct it.</p>${rows}`;
  }

  panel_placing() {
    const p = this.world.placing; if (!p) return '';
    const d = BUILDINGS[p.type];
    return `<h2>Place ${d.name}</h2>
      <p>${p.ok ? 'Tap the island to move it.' : '<b style="color:#b13a2c">Can\'t build there.</b> Tap open flat ground.'}</p>
      <div class="row" style="justify-content:flex-end;gap:10px">
        ${this.costHtml(this.world.costOf(p.type))}
        <button class="sbtn red wbtn" data-act="cancel">Cancel</button>
        <button class="sbtn wbtn" data-act="confirm" ${p.ok ? '' : 'disabled'}>Place</button>
      </div>`;
  }

  panel_heroes() {
    const faces = ['King/King Avatar/King_Avatar_01.png', 'Swordsman/Swordsman Avatar/Swordsman_Avatar_1.png',
      'Berserker/Berserker Avatar/Berserker_Avatar_01.png', 'Horseman/Horseman Avatar/Horseman_Avatar_01.png']
      .map((f) => `<img class="ic" style="width:64px;height:64px" src="${enc(WAR + f)}" alt="">`).join('');
    return `<h2>Heroes</h2><div class="row" style="justify-content:space-around">${faces}</div>
      <p>Summoning, teams and hero levels arrive in an upcoming build. Your heroes will fight the campaign, guard the island and escort pawns.</p>`;
  }

  panel_campaign() {
    return `<h2>Campaign</h2>
      <p>Auto-battles across the sea, region by region: Goblins, the Forest, the Shark Pirates, the Undead and the Brutes.</p>
      <p class="muted">Coming in an upcoming build.</p>`;
  }

  panel_building() {
    const b = this.inspect; if (!b) return '';
    const status = b.done ? (b.def.pawns ? `Houses ${b.def.pawns} pawns.` : '') :
      `Under construction: ${Math.floor(b.progress * 100)}%. ${this.world.jobs.build ? '' : 'Assign a Builder!'}`;
    const extra = b.type === 'castle'
      ? `<p>The heart of your kingdom. Pawns bring resources here. If it falls in a siege, the run is over.</p>
         <button class="sbtn wbtn" data-act="open" data-arg="jobs">Manage pawns</button>` : '';
    return `<h2>${b.def.name}</h2><p>${status}</p>${extra}`;
  }

  showBuilding(b) { this.inspect = b; this.open('building'); }

  showAway(sum) {
    const h = Math.floor(sum.seconds / 3600), m = Math.floor(sum.seconds % 3600 / 60);
    const items = ['wood', 'gold', 'meat'].map((k) =>
      `<span class="cost"><img src="${enc(ICONS[k])}" alt="">${sum.gain[k] >= 0 ? '+' : ''}${sum.gain[k]}</span>`).join(' ');
    this.awayHtml = `<h2>While you were away</h2>
      <p>${h ? h + 'h ' : ''}${m}m passed${sum.capped ? ` (max ${sum.capH}h counted)` : ''}. Your pawns kept working:</p>
      <div class="row" style="justify-content:center;font-size:20px">${items}</div>
      <div style="text-align:center;margin-top:8px"><button class="sbtn wbtn" data-act="closepanel">Collect</button></div>`;
    this.open('away');
  }
  panel_away() { return this.awayHtml || ''; }

  // ---------------------------------------------------------------- actions
  act(a, arg) {
    const w = this.world;
    if (a === 'job') { const [k, d] = arg.split(':'); w.setJob(k, Number(d)); this.render(); }
    if (a === 'place') { w.startPlacing(arg, this.game.view()); this.open('placing'); }
    if (a === 'confirm') { if (w.confirmPlacing()) { this.close(); this.toast('Construction started'); } }
    if (a === 'cancel') { this.close(); }
    if (a === 'open') this.open(arg);
    if (a === 'closepanel') this.close();
    this.game.save();
  }
}

export { FREE };
