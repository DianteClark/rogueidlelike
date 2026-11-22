// Team bonuses. Every hero gets your kingdom's passive. On top of that:
//  - colour bonus: 2/3/4/5 heroes of the same colour power up that colour's effect (for those heroes)
//  - tribe bonus: monster heroes of the same tribe do the same
//  - home colour: heroes matching your kingdom's colour get +10% health and attack
import { KINGDOMS } from '../data/kingdoms.js';
import { heroDef } from './heroes.js';

const TIERS = [2, 3, 4, 5];

const COLOR_BONUS = {
  Blue:   { name: 'Shieldwall', key: 'shield',    values: [0.10, 0.18, 0.26, 0.35], text: (v) => `start with a ${pct(v)} shield` },
  Red:    { name: 'Bloodrage',  key: 'frenzy',    values: [0.20, 0.35, 0.50, 0.70], text: (v) => `+${pct(v)} attack speed below half health` },
  Yellow: { name: 'Sunstrike',  key: 'crit',      values: [0.08, 0.14, 0.20, 0.28], text: (v) => `+${pct(v)} critical chance` },
  Purple: { name: 'Veilmend',   key: 'regen',     values: [0.006, 0.010, 0.014, 0.020], text: (v) => `heal ${pct(v, 1)} health per second` },
  Black:  { name: 'Grave Hunger', key: 'lifesteal', values: [0.08, 0.14, 0.20, 0.28], text: (v) => `heal for ${pct(v)} of damage dealt` },
};

const TRIBE_BONUS = {
  Goblins: { name: 'Swarm',     key: 'haste',  values: [0.10, 0.18, 0.26, 0.35], text: (v) => `+${pct(v)} move and attack speed` },
  Brutes:  { name: 'Thick Hide', key: 'hpMul', values: [0.12, 0.22, 0.32, 0.45], text: (v) => `+${pct(v)} health` },
  Forest:  { name: 'Wild Growth', key: 'regen', values: [0.006, 0.010, 0.014, 0.020], text: (v) => `heal ${pct(v, 1)} health per second` },
  Sea:     { name: 'Tidecaller', key: 'crit',  values: [0.08, 0.14, 0.20, 0.28], text: (v) => `+${pct(v)} critical chance` },
  Undead:  { name: 'Unending',  key: 'lifesteal', values: [0.08, 0.14, 0.20, 0.28], text: (v) => `heal for ${pct(v)} of damage dealt` },
};

// The kingdom's own passive, applied to every hero.
const KINGDOM_BASE = { blue: ['shield', 0.15], red: ['frenzy', 0.45], yellow: ['crit', 0.2], purple: ['regen', 0.012], black: ['lifesteal', 0.15], beast: ['haste', 0.12] };

function pct(v, d = 0) { return (v * 100).toFixed(d) + '%'; }

function groupOf(h) {
  const d = heroDef(h.cls);
  return d.monster ? { kind: 'tribe', id: d.tribe } : { kind: 'color', id: h.color };
}

// Which bonuses a team has active.
export function teamSynergies(heroes, kingdom) {
  const counts = new Map();
  for (const h of heroes) {
    const g = groupOf(h), k = g.kind + ':' + g.id;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const active = [];
  for (const [k, n] of counts) {
    const [kind, id] = k.split(':');
    const table = kind === 'color' ? COLOR_BONUS[id] : TRIBE_BONUS[id];
    if (!table) continue;
    const tier = TIERS.filter((t) => n >= t).length; // 0..4
    active.push({ kind, id, count: n, tier, name: table.name, key: table.key,
      value: tier ? table.values[tier - 1] : 0, text: tier ? table.text(table.values[tier - 1]) : `${TIERS[0] - n} more for a bonus` });
  }
  const home = KINGDOMS[kingdom]?.color;
  const homeCount = heroes.filter((h) => !heroDef(h.cls).monster && h.color === home).length;
  return { active: active.sort((a, b) => b.count - a.count), home, homeCount };
}

// Apply every bonus to one battle unit for hero h.
export function applyBonuses(unit, h, syn, kingdom) {
  const add = (key, v) => {
    if (key === 'shield') unit.shield = (unit.shield || 0) + unit.max * v;
    else if (key === 'hpMul') { unit.max = Math.round(unit.max * (1 + v)); unit.hp = unit.max; }
    else unit[key] = (unit[key] || 0) + v;
  };
  const base = KINGDOM_BASE[kingdom];
  // hp first so shields scale from the final health
  const g = groupOf(h);
  const mine = syn.active.find((s) => s.kind === g.kind && s.id === g.id && s.tier > 0);
  if (mine && mine.key === 'hpMul') add('hpMul', mine.value);
  if (!heroDef(h.cls).monster && h.color === syn.home) {
    unit.max = Math.round(unit.max * 1.1); unit.hp = unit.max; unit.s.atk = Math.round(unit.s.atk * 1.1);
  }
  if (base) add(base[0], base[1]);
  if (mine && mine.key !== 'hpMul') add(mine.key, mine.value);
  if (unit.haste) unit.s.speed = Math.round(unit.s.speed * (1 + unit.haste));
}
