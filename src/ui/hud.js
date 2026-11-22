// DOM overlay: resource bar, bottom nav, bottom-sheet panels, toasts.
import { BUILDINGS, ICONS, buildingSrc, WAR, FREE } from '../data/art.js';
import { JOBS } from '../world/pawn.js';
import { heroStats, power, levelCost, className, avatarOf, TEAM_SIZE, MAX_LEVEL, xpToLevel } from '../game/heroes.js';
import { rarity } from '../data/units.js';

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
    const nav = name === 'hero' ? 'heroes' : name;
    document.querySelectorAll('.navbtn').forEach((b) => b.classList.toggle('active', b.dataset.panel === nav));
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
    const w = this.world;
    const slots = Array.from({ length: TEAM_SIZE }, (_, i) => {
      const h = w.hero(w.team[i]);
      return `<div class="slot" ${h ? `data-act="hero" data-arg="${h.id}" style="border:3px solid ${rarity(h.rarity).color}"` : ''}>
        ${h ? `<img src="${enc(avatarOf(h))}" alt="">` : ''}</div>`;
    }).join('');
    const teamPower = w.team.map((id) => w.hero(id)).filter(Boolean).reduce((s, h) => s + power(h), 0);
    const cards = [...w.heroes].sort((a, b) => power(b) - power(a)).map((h) => `
      <button class="hcard" style="--rc:${rarity(h.rarity).color}" data-act="hero" data-arg="${h.id}">
        ${w.team.includes(h.id) ? '<span class="intm">Team</span>' : ''}
        <img src="${enc(avatarOf(h))}" alt="">
        <div class="lv">Lv ${h.level}</div><div class="cls">${className(h)}</div>
      </button>`).join('');
    const cost = w.summonCost;
    return `<h2>Heroes ${w.heroes.length}/${w.rosterCap}</h2>
      <p>Campaign team · power ${teamPower}</p>
      <div class="teamrow">${slots}</div>
      <div class="summonbar">
        <span>${w.freeSummons > 0 ? `<b>${w.freeSummons} free</b> recruit${w.freeSummons > 1 ? 's' : ''}!` : this.costHtml(cost)}</span>
        <button class="sbtn wbtn" style="height:54px;padding:0 14px" data-act="summon" ${w.heroes.length >= w.rosterCap || (cost && !w.canAfford(cost)) ? 'disabled' : ''}>Summon</button>
      </div>
      <div class="herogrid">${cards || '<p class="muted">No heroes yet. Summon your first!</p>'}</div>`;
  }

  panel_hero() {
    const w = this.world, h = w.hero(this.heroId);
    if (!h) return this.panel_heroes();
    const s = heroStats(h), r = rarity(h.rarity), inTeam = w.team.includes(h.id);
    const cost = levelCost(h);
    return `<div class="herohead"><img src="${enc(avatarOf(h))}" alt="">
        <div><h2>${h.name}</h2><div class="rar" style="color:${r.color};text-shadow:0 1px 0 #3b2f2a">${r.name} ${h.color} ${className(h)}</div>
        <div>Level ${h.level} · Power ${power(h)}</div><div class="muted" style="font-size:13px">XP ${h.xp}/${xpToLevel(h)}</div></div></div>
      <div class="stats">
        <div>Health <b>${s.hp}</b></div><div>${s.heal ? 'Heal' : 'Attack'} <b>${s.heal || s.atk}</b></div>
        <div>Defense <b>${s.def}</b></div><div>Range <b>${s.range > 1.6 ? s.range : 'Melee'}</b></div>
      </div>
      <div class="btnrow">
        <button class="sbtn wbtn" data-act="team" data-arg="${h.id}">${inTeam ? 'Remove from team' : 'Add to team'}</button>
        <button class="sbtn wbtn" data-act="level" data-arg="${h.id}" ${h.level >= MAX_LEVEL || !w.canAfford(cost) ? 'disabled' : ''}>Level up ${this.costHtml(cost).replace(/class="cost/g, 'style="color:#fff" class="cost')}</button>
      </div>
      <div class="btnrow">
        <button class="sbtn red wbtn" data-act="back">Back</button>
        <button class="sbtn red wbtn" data-act="dismiss" data-arg="${h.id}">Dismiss (+15 gold)</button>
      </div>`;
  }

  revealHero(h) {
    const el = document.getElementById('reveal'), r = rarity(h.rarity);
    el.style.setProperty('--rc', r.color);
    document.getElementById('reveal-img').src = enc(avatarOf(h));
    document.getElementById('reveal-text').innerHTML = `${h.name}<small style="color:${r.color}">${r.name} ${h.color} ${className(h)}</small>`;
    el.classList.remove('hidden');
    el.onclick = () => el.classList.add('hidden');
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
    if (a === 'summon') { const h = w.summon(); if (h) this.revealHero(h); this.render(); }
    if (a === 'hero') { this.heroId = arg; this.open('hero'); }
    if (a === 'team') { w.toggleTeam(arg); this.render(); }
    if (a === 'level') { w.levelUp(arg); this.render(); }
    if (a === 'back') this.open('heroes');
    if (a === 'dismiss') { if (this.confirmDismiss === arg) { w.dismiss(arg); this.confirmDismiss = null; this.open('heroes'); } else { this.confirmDismiss = arg; this.toast('Tap Dismiss again to confirm'); } }
    if (a === 'closepanel') this.close();
    this.game.save();
  }
}

export { FREE };
