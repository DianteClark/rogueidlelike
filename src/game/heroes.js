// Hero model: creation (summoning), stats, levels, power.
import { HERO_CLASSES, MONSTER_HEROES, RARITIES, rarity, rarityRank } from '../data/units.js';
import { COLORS } from '../data/art.js';
import { KINGDOMS } from '../data/kingdoms.js';

export const SUMMON_COST = 60;          // gold
export const FREE_SUMMONS = 3;          // a new kingdom starts with three free recruits
export const TEAM_SIZE = 5;
export const BASE_ROSTER = 8;
export const MAX_LEVEL = 30;

const FIRST = ['Al', 'Bran', 'Cor', 'Da', 'El', 'Fen', 'Gar', 'Hal', 'Ive', 'Jor', 'Kae', 'Lio', 'Mar', 'Nor', 'Os', 'Pip',
  'Quin', 'Ro', 'Syl', 'Tam', 'Ul', 'Vey', 'Wil', 'Yor', 'Zan', 'Bea', 'Cal', 'Ed', 'Fin', 'Gwen', 'Ma', 'Ren', 'Tess'];
const LAST = ['ric', 'den', 'win', 'a', 'mund', 'wyn', 'o', 'ard', 'ley', 'ra', 'gar', 'is', 'eth', 'ian', 'ette', 'ok', 'el', 'by'];

function weighted(items, w = (x) => x.weight) {
  const total = items.reduce((s, x) => s + w(x), 0);
  let r = Math.random() * total;
  for (const x of items) { r -= w(x); if (r <= 0) return x; }
  return items[items.length - 1];
}

const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID().slice(0, 13) : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));

export const heroDef = (cls) => HERO_CLASSES[cls] || MONSTER_HEROES[cls];

// pool: list of class ids that can be summoned right now
export function makeHero({ cls, color, rarityId, level = 1, pool } = {}, kingdom = 'blue') {
  const ids = pool && pool.length ? pool : Object.keys(HERO_CLASSES);
  const clsId = cls || weighted(ids.map((id) => [id, heroDef(id)]), ([, d]) => d.weight)[0];
  const def = heroDef(clsId);
  const home = KINGDOMS[kingdom]?.color || 'Blue';
  const col = def.monster ? null : color || (Math.random() < 0.5 ? home : COLORS[Math.floor(Math.random() * COLORS.length)]);
  let rar = rarityId || weighted(RARITIES.filter((r) => r.weight > 0)).id;
  if (def.minRarity && rarityRank(rar) < rarityRank(def.minRarity)) rar = def.minRarity;
  if (def.boss && !rarityId && Math.random() < 0.2) rar = 'mythic';
  const name = FIRST[Math.floor(Math.random() * FIRST.length)] + LAST[Math.floor(Math.random() * LAST.length)];
  return { id: 'h-' + uid(), cls: clsId, color: col, rarity: rar, level, xp: 0, stars: 1, name, state: 'healthy' };
}

export function heroStats(h) {
  const c = heroDef(h.cls), r = rarity(h.rarity);
  const growth = r.mul * (1 + 0.1 * (h.level - 1)) * (1 + 0.2 * (h.stars - 1));
  const s = c.stats;
  const hurt = h.state === 'wounded' ? 0.8 : 1;
  return {
    hp: Math.round(s.hp * growth * hurt), atk: Math.round(s.atk * growth * hurt), heal: Math.round((s.heal || 0) * growth * hurt),
    def: Math.round(s.def * (1 + 0.05 * (h.level - 1)) * r.mul), rate: s.rate, range: s.range, speed: s.speed,
  };
}

export function power(h) {
  const s = heroStats(h);
  return Math.round(s.hp * 0.25 + ((s.atk || s.heal) / s.rate) * 6 + s.def * 3);
}

export const levelCost = (h) => ({ gold: 10 + h.level * 12 });
export const xpToLevel = (h) => 40 + h.level * 25;

export function addXp(h, amount) {
  if (h.level >= MAX_LEVEL) { h.xp = 0; return 0; }
  h.xp += amount;
  let ups = 0;
  while (h.level < MAX_LEVEL && h.xp >= xpToLevel(h)) { h.xp -= xpToLevel(h); h.level++; ups++; }
  return ups;
}

// Injury: falling in a fight wounds a hero (weaker, heals on its own). Falling again while wounded
// makes them Critical: they can't fight and only recover in a Monastery bed.
export const WOUND_TIME = 180, LIGHT_WOUND = 90, CRITICAL_TIME = 480;
export function injure(h, light = false) {
  if (h.state === 'wounded' || h.state === 'critical') { h.state = 'critical'; h.recover = CRITICAL_TIME; h.inMonastery = false; return 'critical'; }
  h.state = 'wounded'; h.recover = light ? LIGHT_WOUND : WOUND_TIME; return 'wounded';
}
export const canFight = (h) => h.state !== 'critical' && h.state !== 'fallen';
export function stateLabel(h) {
  if (h.state === 'wounded') return `Wounded ${fmtTime(h.recover)}`;
  if (h.state === 'critical') return h.inMonastery ? `Recovering ${fmtTime(h.recover)}` : `Critical ${fmtTime(h.recover * 5)}`;
  return '';
}
const fmtTime = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export const className = (h) => heroDef(h.cls).name;
export const avatarOf = (h) => heroDef(h.cls).avatar(h.color);
export const groupName = (h) => (heroDef(h.cls).monster ? heroDef(h.cls).tribe : h.color);
