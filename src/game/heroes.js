// Hero model: creation (summoning), stats, levels, power.
import { HERO_CLASSES, RARITIES, rarity } from '../data/units.js';
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

let nextId = Date.now() % 100000;

export function makeHero({ cls, color, rarityId, level = 1 } = {}, kingdom = 'blue') {
  const clsId = cls || weighted(Object.entries(HERO_CLASSES), ([, d]) => d.weight)[0];
  const home = KINGDOMS[kingdom]?.color || 'Blue';
  const col = color || (Math.random() < 0.5 ? home : COLORS[Math.floor(Math.random() * COLORS.length)]);
  const rar = rarityId || weighted(RARITIES).id;
  const name = FIRST[Math.floor(Math.random() * FIRST.length)] + LAST[Math.floor(Math.random() * LAST.length)];
  return { id: 'h' + (nextId++) + Math.floor(Math.random() * 1000), cls: clsId, color: col, rarity: rar, level, xp: 0, stars: 1, name, state: 'healthy' };
}

export function heroStats(h) {
  const c = HERO_CLASSES[h.cls], r = rarity(h.rarity);
  const growth = r.mul * (1 + 0.1 * (h.level - 1)) * (1 + 0.2 * (h.stars - 1));
  const s = c.stats;
  return {
    hp: Math.round(s.hp * growth), atk: Math.round(s.atk * growth), heal: Math.round((s.heal || 0) * growth),
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
  h.xp += amount;
  let ups = 0;
  while (h.level < MAX_LEVEL && h.xp >= xpToLevel(h)) { h.xp -= xpToLevel(h); h.level++; ups++; }
  return ups;
}

export const className = (h) => HERO_CLASSES[h.cls].name;
export const avatarOf = (h) => HERO_CLASSES[h.cls].avatar(h.color);
