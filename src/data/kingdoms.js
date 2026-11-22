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
};

export const KINGDOM_ORDER = ['blue', 'red', 'yellow', 'purple', 'black'];

export const mod = (k, key, fallback = 1) => KINGDOMS[k]?.mods?.[key] ?? fallback;

// --- meta progress (kept across runs) -------------------------------------------------
const META_KEY = 'tinycrowns.meta.v1';
export function loadMeta() {
  try { return { legacy: 0, unlocked: ['blue'], ...JSON.parse(localStorage.getItem(META_KEY)) }; }
  catch { return { legacy: 0, unlocked: ['blue'] }; }
}
export function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ }
}
