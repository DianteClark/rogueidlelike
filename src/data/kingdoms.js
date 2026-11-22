import { WAR, ENEMY } from './art.js';

// The five kingdoms. Each run you rule one; the other four become rivals.
// mods are multipliers/bonuses the simulation reads. Ones marked (later) apply once that system exists.
export const KINGDOMS = {
  blue: {
    color: 'Blue', name: 'Order of the Shield', hex: '#3f7fb5', avatar: 1, unlock: 0,
    combat: 'Heroes start every fight with a shield',
    island: 'Towers and walls cost 25% less and are sturdier',
    drawback: 'Heroes deal 10% less damage',
    mods: { defenseCost: 0.75, heroDamage: 0.9 },
  },
  red: {
    color: 'Red', name: 'Ember Empire', hex: '#c0483c', avatar: 2, unlock: 150,
    combat: 'Heroes attack faster when below half HP',
    island: '+50% loot from beaten raids and campaign stages',
    drawback: 'Buildings cost 25% more wood',
    mods: { lootMul: 1.5, woodCost: 1.25 },
  },
  yellow: {
    color: 'Yellow', name: 'Sun Republic', hex: '#d2a63a', avatar: 3, unlock: 300,
    combat: 'Heroes have +15% critical hit chance',
    island: 'Miners bring +1 gold per trip and idle earnings last 16h',
    drawback: 'Pawns eat 30% more food',
    mods: { goldBonus: 1, idleCapH: 16, eat: 1.3 },
  },
  purple: {
    color: 'Purple', name: 'Veil Temple', hex: '#8a5aa8', avatar: 4, unlock: 500,
    combat: 'Heroes slowly heal during fights',
    island: 'Critical heroes recover twice as fast; Monastery holds 2 more',
    drawback: 'Pawns work 15% slower',
    mods: { recovery: 2, monasterySlots: 2, workSpeed: 0.85 },
  },
  black: {
    color: 'Black', name: 'Fallen Crown', hex: '#3d3d4a', avatar: 5, unlock: 800,
    combat: 'Heroes heal for part of the damage they deal',
    island: 'Fallen heroes leave relics twice as strong',
    drawback: 'Raids come 30% more often',
    mods: { relicMul: 2, raidRate: 1.3 },
  },

  beast: {
    color: 'Black', name: 'Beast Horde', hex: '#5e8a3a', unlock: 1000, buildings: 'beast',
    king: 'troll', kingName: 'the Troll King',
    combat: 'Heroes move and attack 12% faster',
    island: 'Starts with monster heroes; beaten raiders may join you',
    drawback: 'Human heroes only join after you clear stage 5',
    monsterPool: ['spearGoblin', 'torchGoblin', 'gnoll', 'thief'], humansAfter: 5,
    mods: { raidRecruit: 0.3 },
  },
};

export const KINGDOM_ORDER = ['blue', 'red', 'yellow', 'purple', 'black', 'beast'];

// Hall of Heroes: each fallen hero leaves a relic that eases that kingdom's own drawback.
// per = effect per relic, cap = most it can reach. Black's relics count double (its island passive).
export const RELICS = {
  blue:   { key: 'attack',   per: 0.01, cap: 0.15, text: (v) => `+${pct(v)} hero attack` },
  red:    { key: 'woodCost', per: 0.02, cap: 0.20, text: (v) => `-${pct(v)} wood costs` },
  yellow: { key: 'eat',      per: 0.03, cap: 0.25, text: (v) => `-${pct(v)} food eaten` },
  purple: { key: 'workSpeed', per: 0.02, cap: 0.15, text: (v) => `+${pct(v)} pawn work speed` },
  black:  { key: 'raidRate', per: 0.03, cap: 0.25, text: (v) => `raids ${pct(v)} less often` },
  beast:  { key: 'humansAfter', per: 1, cap: 4, text: (v) => `humans join ${v} stage${v === 1 ? '' : 's'} earlier` },
};
const pct = (v) => Math.round(v * 100) + '%';

// Add #unlockall to the URL once to open every kingdom for testing.
export const UNLOCK_ALL_FOR_TESTING = typeof location !== 'undefined' && location.hash.includes('unlockall');

// Permanent starting boosts bought with Legacy between runs. cost(level) = Legacy for the next level.
export const BOOSTS = {
  pawns:    { name: 'Settlers', text: (n) => `Start with +${n} pawn${n === 1 ? '' : 's'}`, max: 3, cost: (l) => 80 + l * 80 },
  supplies: { name: 'Supply cache', text: (n) => `Start with +${n * 40} wood, gold and meat`, max: 3, cost: (l) => 60 + l * 60 },
  recruits: { name: 'Banner call', text: (n) => `+${n} free recruit${n === 1 ? '' : 's'} at the start`, max: 3, cost: (l) => 100 + l * 100 },
  idle:     { name: 'Stewards', text: (n) => `Idle earnings last +${n * 2}h`, max: 3, cost: (l) => 90 + l * 90 },
  walls:    { name: 'Masonry', text: (n) => `Castle health +${n * 15}%`, max: 3, cost: (l) => 120 + l * 120 },
};

export function kingAvatar(k) {
  const K = KINGDOMS[k] || KINGDOMS.blue;
  if (K.king === 'troll') return `${ENEMY}Troll/Troll_Avatar.png`;
  return `${WAR}King/King Avatar/King_Avatar_0${K.avatar}.png`;
}

export const mod = (k, key, fallback = 1) => KINGDOMS[k]?.mods?.[key] ?? fallback;

// --- meta progress (kept across runs) -------------------------------------------------
const META_KEY = 'tinycrowns.meta.v1';
export function loadMeta() {
  let m;
  try { m = { legacy: 0, unlocked: ['blue'], ...JSON.parse(localStorage.getItem(META_KEY)) }; }
  catch { m = { legacy: 0, unlocked: ['blue'] }; }
  m.boosts = { ...(m.boosts || {}) };
  if (UNLOCK_ALL_FOR_TESTING) { m.unlocked = [...KINGDOM_ORDER]; saveMeta(m); }
  return m;
}
export function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ }
}
