// Battle overlay: stage banner, King's Rally button with cut-in, speed toggle, retreat, results.
import { KING_AVATAR, REGIONS } from '../data/units.js';
import { KINGDOMS, kingAvatar } from '../data/kingdoms.js';
import { avatarOf, className } from '../game/heroes.js';
import { ICONS } from '../data/art.js';

const $ = (s) => document.getElementById(s);
const enc = (s) => encodeURI(s);

export class BattleHud {
  constructor(game) {
    this.game = game;
    $('bh-rally').onclick = () => {
      const b = this.game.battle;
      if (b && b.useRally()) this.cutin();
    };
    $('bh-speed').onclick = () => {
      const b = this.game.battle; if (!b) return;
      b.speed = b.speed === 1 ? 2 : 1;
      $('bh-speed').textContent = 'x' + b.speed;
      this.game.battleSpeed = b.speed;
    };
    $('bh-retreat').onclick = () => {
      const b = this.game.battle; if (!b || b.over) return;
      b.retreated = true; b.finish(false);
    };
  }

  show(b) {
    const color = KINGDOMS[this.game.world.kingdom].color;
    const R = REGIONS[b.regionIdx];
    $('bh-title').textContent = `${R.name} · ${b.stage === R.stages ? 'Boss' : 'Stage ' + b.stage}`;
    $('bh-king').src = enc(kingAvatar(this.game.world.kingdom));
    $('cutin-img').src = enc(kingAvatar(this.game.world.kingdom));
    b.speed = this.game.battleSpeed || 1;
    $('bh-speed').textContent = 'x' + b.speed;
    $('bh-result').classList.add('hidden');
    $('battlehud').classList.remove('hidden');
    document.body.classList.add('battling');
  }

  hide() {
    $('battlehud').classList.add('hidden');
    document.body.classList.remove('battling');
  }

  update(b) {
    $('bh-meter').style.width = Math.round(b.rally * 100) + '%';
    $('bh-rally').classList.toggle('ready', b.rally >= 1 && !b.over);
  }

  cutin() {
    const el = $('cutin');
    el.classList.remove('hidden', 'go'); void el.offsetWidth; el.classList.add('go');
    clearTimeout(this.cutT);
    this.cutT = setTimeout(() => el.classList.add('hidden'), 1150);
  }

  result(win, reward, b, go) {
    const body = $('bh-result-body');
    const hurt = (b.injuries || []).map(({ hero, state }) => `<div><img src="${enc(avatarOf(hero))}" alt=""><b style="color:${state === 'critical' ? '#a33a2c' : '#a0662f'}">${state === 'critical' ? 'Critical' : 'Wounded'}</b></div>`).join('');
    const hurtHtml = hurt ? `<p style="margin-bottom:0">Injured</p><div class="lvups">${hurt}</div>${(b.injuries || []).some((i) => i.state === 'critical') ? '<p class="muted" style="font-size:13px">Critical heroes can\'t fight until they heal (a Monastery heals them 5× faster).</p>' : ''}` : '';
    if (win) {
      const ups = reward.heroes.map(({ hero, levels }) => `<div><img src="${enc(avatarOf(hero))}" alt="">
        ${levels ? `<b style="color:#3d8a2a">Lv ${hero.level}!</b>` : `Lv ${hero.level}`}<br>+${reward.xp} XP</div>`).join('');
      body.innerHTML = `<h2 style="color:#3d7a2a">Victory!</h2>
        <p><span class="cost"><img src="${enc(ICONS.gold)}" alt="">+${reward.gold}</span>
        ${reward.recruits ? ` &nbsp;<b>+${reward.recruits} free recruit${reward.recruits > 1 ? 's' : ''}</b>` : ''}</p>
        <div class="lvups">${ups}</div>
        ${reward.unlocked ? `<p><b>${reward.unlocked}</b></p>` : ''}${hurtHtml}
        <div class="btnrow">${go.next ? '<button class="sbtn wbtn" data-go="next">Next stage</button>' : ''}
          <button class="sbtn wbtn" data-go="map">Map</button><button class="sbtn red wbtn" data-go="island">Island</button></div>`;
    } else {
      body.innerHTML = `<h2 style="color:#a33a2c">${b.retreated ? 'Retreat' : 'Defeat'}</h2>
        ${hurtHtml}<p>${b.retreated ? 'Your heroes fall back to the island.' : b.timedOut ? 'The fight dragged on too long and your heroes withdrew.' : 'Your heroes were overwhelmed. Level them up or recruit more, then try again.'}</p>
        <div class="btnrow"><button class="sbtn wbtn" data-go="retry">Retry</button>
          <button class="sbtn wbtn" data-go="map">Map</button><button class="sbtn red wbtn" data-go="island">Island</button></div>`;
    }
    $('bh-result').classList.remove('hidden');
    body.querySelectorAll('[data-go]').forEach((btn) => { btn.onclick = () => go[btn.dataset.go]?.(); });
  }
}

export { className };
