// End-of-run screens (castle fallen / retired / era cashed in), the Era victory choice, and the share card.
import { KINGDOMS, kingAvatar, loadMeta, saveMeta } from '../data/kingdoms.js';
import { avatarOf, className } from '../game/heroes.js';
import { img, load } from '../engine/assets.js';
import { SAVE_KEY } from '../world/world.js';
import { REGIONS, TOTAL_STAGES } from '../data/units.js';

const $ = (s) => document.getElementById(s);
const enc = (s) => encodeURI(s);

export class RunScreens {
  constructor(game) { this.game = game; }

  overlay(html) {
    const el = $('runover');
    el.querySelector('.paper > div').innerHTML = html;
    el.classList.remove('hidden');
    return el;
  }

  eraWon() {
    const w = this.game.world, s = w.runSummary('won');
    const el = this.overlay(`
      <h2 style="color:#3d7a2a;text-align:center;font-size:30px">Era won!</h2>
      <p style="text-align:center">The Blood Moon has set and your kingdom stands. The ${KINGDOMS[w.kingdom].name} will be remembered.</p>
      <p style="text-align:center">Legacy if you end now: <b>${s.legacy}</b></p>
      <p class="muted" style="text-align:center;font-size:13px">Or push on into Endless: sieges keep coming, each one stronger. See how long you last. You can stop any time.</p>
      <div class="btnrow"><button class="sbtn wbtn" data-run="end">End run & collect</button><button class="sbtn wbtn" data-run="endless">Continue into Endless</button></div>`);
    el.onclick = (e) => {
      const b = e.target.closest('[data-run]'); if (!b) return;
      w.era.choicePending = false;
      if (b.dataset.run === 'endless') { w.era.endless = true; w.save(); el.classList.add('hidden'); this.game.hud.toast('Endless mode! Survive as many sieges as you can.', 3500); }
      else { el.classList.add('hidden'); w.endRun('ended'); }
    };
  }

  runOver(s) {
    const w = this.game.world;
    const title = { fallen: 'Your castle has fallen', retired: 'You retired', ended: 'Era complete' }[s.reason] || 'Run over';
    const tops = s.top.map((h) => `<div><img src="${enc(avatarOf(h))}" alt="">Lv ${h.level}<br>${className(h)}</div>`).join('');
    const el = this.overlay(`
      <h2 style="text-align:center;font-size:28px;color:${s.reason === 'fallen' ? '#a33a2c' : '#3d7a2a'}">${title}</h2>
      <div class="stats">
        <div style="grid-column:1/-1">Kingdom <b>${KINGDOMS[s.kingdom].name}</b></div><div>Days <b>${s.days}</b></div>
        <div>Best stage <b>${s.best}/${TOTAL_STAGES}</b></div><div>Sieges survived <b>${s.sieges}</b></div>
        <div>Raids beaten <b>${s.raidsWon}</b></div><div>Heroes <b>${s.heroes}</b></div>
      </div>
      ${tops ? `<div class="lvups">${tops}</div>` : ''}
      <p style="text-align:center;font-size:20px">Legacy earned: <b style="color:#a0662f">+${s.legacy}</b></p>
      <div class="btnrow"><button class="sbtn wbtn" data-run="share">Share</button><button class="sbtn wbtn" data-run="new">Begin a new Era</button></div>`);
    // bank the Legacy right away so closing the app can't lose it
    const meta = loadMeta();
    if (!w.legacyBanked) {
      meta.legacy = (meta.legacy || 0) + s.legacy;
      meta.runs = [...(meta.runs || []), { ...s, top: s.top.map((h) => ({ cls: h.cls, level: h.level })), at: Date.now() }].slice(-30);
      meta.bestSieges = Math.max(meta.bestSieges || 0, s.sieges);
      saveMeta(meta);
      w.legacyBanked = true;
      w.save();
    }
    el.onclick = (e) => {
      const b = e.target.closest('[data-run]'); if (!b) return;
      if (b.dataset.run === 'share') shareCard(w, s);
      if (b.dataset.run === 'new') { w.discarded = true; this.game.started = false; localStorage.removeItem(SAVE_KEY); location.hash = ''; location.reload(); }
    };
  }
}

// Draws a share image of the run and opens the iPhone share sheet (or downloads it elsewhere).
export async function shareCard(world, s) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const K = KINGDOMS[s.kingdom];
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1b3a4a'); grad.addColorStop(1, '#2f6e6c');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  // island snapshot
  const st = world.terrain.staticCanvas;
  if (st) {
    const scale = Math.min(820 / st.width, 520 / st.height);
    const iw = st.width * scale, ih = st.height * scale;
    g.fillStyle = '#47ABA9'; roundRect(g, (W - 860) / 2, 330, 860, 560, 36); g.fill();
    g.save(); roundRect(g, (W - 860) / 2, 330, 860, 560, 36); g.clip();
    g.drawImage(st, (W - iw) / 2, 330 + (560 - ih) / 2, iw, ih);
    g.restore();
  }
  const king = await load(kingAvatar(s.kingdom)).catch(() => null);
  if (king) g.drawImage(king, 70, 60, 220, 220);
  g.fillStyle = '#fff'; g.font = '64px BoldPixels, sans-serif';
  g.fillText('Tiny Crowns', 320, 130);
  g.fillStyle = K.hex; g.font = '48px BoldPixels, sans-serif';
  g.fillText(K.name, 320, 200);
  g.fillStyle = '#f5d76e'; g.font = '40px BoldPixels, sans-serif';
  g.fillText(s.endless ? `Endless · ${s.sieges} sieges survived` : `${s.sieges ? s.sieges + ' sieges · ' : ''}stage ${s.best}`, 320, 262);

  g.fillStyle = '#fff'; g.font = '40px BoldPixels, sans-serif';
  const lines = [`${s.days} days ruled`, `${s.raidsWon} raids beaten`, `${s.heroes} heroes · ${s.fallen} fallen`, `+${s.legacy} Legacy`];
  lines.forEach((t, i) => g.fillText(t, 90 + (i % 2) * 480, 970 + Math.floor(i / 2) * 64));
  for (let i = 0; i < s.top.length; i++) {
    const a = await load(avatarOf(s.top[i])).catch(() => null);
    if (a) g.drawImage(a, 170 + i * 260, 1100, 190, 190);
  }
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'tiny-crowns.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Tiny Crowns' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tiny-crowns.png'; a.click();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export { img };
