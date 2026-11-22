// Start-of-run screen: pick a kingdom. Locked ones can be inspected; they unlock with Legacy.
import { KINGDOMS, KINGDOM_ORDER, kingAvatar, BOOSTS, saveMeta } from '../data/kingdoms.js';
import { WAR, FREE } from '../data/art.js';

const enc = (s) => encodeURI(s);
const ICON = (n) => enc(`${FREE}UI Elements/UI Elements/Icons/Icon_${n}.png`);

export function chooseKingdom(meta, onPreview) {
  const root = document.getElementById('kingdom');
  const picks = document.getElementById('kpicks');
  const detail = document.getElementById('kdetail');
  const start = document.getElementById('kstart');
  let sel = 'blue', shop = false;
  const legacyEl = document.getElementById('klegacy');
  const shopBtn = document.getElementById('kshop');
  const refreshLegacy = () => { legacyEl.textContent = `Legacy ${meta.legacy || 0}`; };
  refreshLegacy();

  const drawPicks = () => { picks.innerHTML = KINGDOM_ORDER.map((id) => {
    const k = KINGDOMS[id], locked = !meta.unlocked.includes(id);
    return `<button class="kpick ${locked ? 'locked' : ''}" data-id="${id}" aria-label="${k.name}">
      <img src="${enc(kingAvatar(id))}" alt="">
      ${locked ? `<img class="lock" src="${ICON('06')}" alt="">` : ''}</button>`;
  }).join(''); };
  drawPicks();

  const showShop = () => {
    shop = true;
    picks.querySelectorAll('.kpick').forEach((b) => b.classList.remove('sel'));
    detail.innerHTML = `<h2>Legacy</h2><div class="tag">Permanent boosts for every new Era</div>` + Object.entries(BOOSTS).map(([k, b]) => {
      const lvl = meta.boosts[k] || 0, maxed = lvl >= b.max, cost = b.cost(lvl);
      return `<div class="perk" style="justify-content:space-between"><span><b>${b.name}</b> ${'●'.repeat(lvl)}${'○'.repeat(b.max - lvl)}<br>
        <small>${b.text(maxed ? lvl : lvl + 1)}</small></span>
        <button class="sbtn wbtn" data-buy="${k}" ${maxed || (meta.legacy || 0) < cost ? 'disabled' : ''}>${maxed ? 'Max' : cost}</button></div>`;
    }).join('');
    start.disabled = true; start.textContent = 'Pick a kingdom';
  };
  detail.onclick = (e) => {
    const b = e.target.closest('[data-buy]'); if (b && !b.disabled) {
      const k = b.dataset.buy, lvl = meta.boosts[k] || 0, cost = BOOSTS[k].cost(lvl);
      if ((meta.legacy || 0) >= cost) { meta.legacy -= cost; meta.boosts[k] = lvl + 1; saveMeta(meta); refreshLegacy(); showShop(); }
    }
    const u = e.target.closest('[data-unlock]'); if (u && !u.disabled) {
      const id = u.dataset.unlock, cost = KINGDOMS[id].unlock;
      if ((meta.legacy || 0) >= cost) { meta.legacy -= cost; meta.unlocked.push(id); saveMeta(meta); refreshLegacy(); drawPicks(); show(id); }
    }
  };
  shopBtn.onclick = showShop;

  const show = (id) => {
    sel = id; shop = false;
    const k = KINGDOMS[id], locked = !meta.unlocked.includes(id);
    picks.querySelectorAll('.kpick').forEach((b) => b.classList.toggle('sel', b.dataset.id === id));
    detail.innerHTML = `
      <h2 style="color:${k.hex}">${k.name}</h2>
      <div class="tag">${id === 'beast' ? 'Monster' : k.color} kingdom${locked ? ` · Locked — unlock with ${k.unlock} Legacy` : ''}</div>
      <div class="perk"><img src="${ICON('05')}" alt="">${k.combat}</div>
      <div class="perk"><img src="${ICON('01')}" alt="">${k.island}</div>
      <div class="perk bad"><img src="${ICON('09')}" alt="">${k.drawback}</div>
      ${locked ? `<button class="sbtn wbtn" style="width:100%;height:52px;margin-top:6px" data-unlock="${id}" ${(meta.legacy || 0) < k.unlock ? 'disabled' : ''}>Unlock for ${k.unlock} Legacy</button>` : ''}`;
    start.disabled = locked;
    start.textContent = locked ? `Locked (${k.unlock} Legacy)` : 'Found Kingdom';
    onPreview?.(id);
  };

  picks.onclick = (e) => { const b = e.target.closest('.kpick'); if (b) show(b.dataset.id); };
  show(sel);
  root.classList.remove('hidden');

  return new Promise((resolve) => {
    start.onclick = () => {
      if (!meta.unlocked.includes(sel)) return;
      root.classList.add('hidden');
      resolve(sel);
    };
  });
}
