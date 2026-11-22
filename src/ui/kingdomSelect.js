// Start-of-run screen: pick a kingdom. Locked ones can be inspected; they unlock with Legacy.
import { KINGDOMS, KINGDOM_ORDER, kingAvatar } from '../data/kingdoms.js';
import { WAR, FREE } from '../data/art.js';

const enc = (s) => encodeURI(s);
const ICON = (n) => enc(`${FREE}UI Elements/UI Elements/Icons/Icon_${n}.png`);

export function chooseKingdom(meta, onPreview) {
  const root = document.getElementById('kingdom');
  const picks = document.getElementById('kpicks');
  const detail = document.getElementById('kdetail');
  const start = document.getElementById('kstart');
  let sel = 'blue';

  picks.innerHTML = KINGDOM_ORDER.map((id) => {
    const k = KINGDOMS[id], locked = !meta.unlocked.includes(id);
    return `<button class="kpick ${locked ? 'locked' : ''}" data-id="${id}" aria-label="${k.name}">
      <img src="${enc(kingAvatar(id))}" alt="">
      ${locked ? `<img class="lock" src="${ICON('06')}" alt="">` : ''}</button>`;
  }).join('');

  const show = (id) => {
    sel = id;
    const k = KINGDOMS[id], locked = !meta.unlocked.includes(id);
    picks.querySelectorAll('.kpick').forEach((b) => b.classList.toggle('sel', b.dataset.id === id));
    detail.innerHTML = `
      <h2 style="color:${k.hex}">${k.name}</h2>
      <div class="tag">${id === 'beast' ? 'Monster' : k.color} kingdom${locked ? ` · Locked — unlock with ${k.unlock} Legacy` : ''}</div>
      <div class="perk"><img src="${ICON('05')}" alt="">${k.combat}</div>
      <div class="perk"><img src="${ICON('01')}" alt="">${k.island}</div>
      <div class="perk bad"><img src="${ICON('09')}" alt="">${k.drawback}</div>`;
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
