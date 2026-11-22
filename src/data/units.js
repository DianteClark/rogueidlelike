// Hero classes and enemy types: sprites, stats and roles. Battle and roster code read only from here,
// so a new Pixel Frog unit = one new entry.
import { FREE, ENEMY, WAR, COLORS } from './art.js';

// Square sprite strip: frame size n×n, anchored at the feet.
const sq = (src, n, ay, ax = n / 2) => ({ src, fw: n, fh: n, ax, ay });
const colorIndex = (c) => Math.max(0, COLORS.indexOf(c));

// ---------------------------------------------------------------- heroes
// stats at level 1, Common rarity. rate = seconds between attacks. range in tiles (1 = melee).
export const HERO_CLASSES = {
  warrior: {
    name: 'Warrior', role: 'Tank', weight: 22,
    stats: { hp: 130, atk: 11, def: 5, rate: 1.0, range: 1, speed: 70 },
    art: (c) => {
      const p = `${FREE}Units/${c} Units/Warrior/Warrior_`;
      return { idle: sq(p + 'Idle.png', 192, 136), run: sq(p + 'Run.png', 192, 136),
        attack: [sq(p + 'Attack1.png', 192, 136), sq(p + 'Attack2.png', 192, 136)], hitFrame: 2 };
    },
    avatar: (c) => `${FREE}UI Elements/UI Elements/Human Avatars/Avatars_${String(colorIndex(c) * 5 + 1).padStart(2, '0')}.png`,
  },
  lancer: {
    name: 'Lancer', role: 'Tank', weight: 16,
    stats: { hp: 150, atk: 10, def: 7, rate: 1.2, range: 1.5, speed: 65 },
    art: (c) => {
      const p = `${FREE}Units/${c} Units/Lancer/Lancer_`;
      return { idle: sq(p + 'Idle.png', 320, 200), run: sq(p + 'Run.png', 320, 200),
        attack: [sq(p + 'Right_Attack.png', 320, 200)], hitFrame: 1 };
    },
    avatar: (c) => `${FREE}UI Elements/UI Elements/Human Avatars/Avatars_${String(colorIndex(c) * 5 + 2).padStart(2, '0')}.png`,
  },
  archer: {
    name: 'Archer', role: 'Ranged', weight: 22,
    stats: { hp: 75, atk: 12, def: 1, rate: 1.1, range: 5, speed: 70 },
    projectile: { src: `${FREE}Units/Blue Units/Archer/Arrow.png`, speed: 520, rotate: true },
    art: (c) => {
      const p = `${FREE}Units/${c} Units/Archer/Archer_`;
      return { idle: sq(p + 'Idle.png', 192, 136), run: sq(p + 'Run.png', 192, 136),
        attack: [sq(p + 'Shoot.png', 192, 136)], hitFrame: 5 };
    },
    avatar: (c) => `${FREE}UI Elements/UI Elements/Human Avatars/Avatars_${String(colorIndex(c) * 5 + 3).padStart(2, '0')}.png`,
  },
  monk: {
    name: 'Monk', role: 'Support', weight: 14,
    stats: { hp: 85, atk: 0, heal: 16, def: 2, rate: 1.6, range: 4, speed: 65 },
    art: (c) => {
      const p = `${FREE}Units/${c} Units/Monk/`;
      return { idle: sq(p + 'Idle.png', 192, 134), run: sq(p + 'Run.png', 192, 134),
        attack: [sq(p + 'Heal.png', 192, 134)], hitFrame: 6, healFx: sq(p + 'Heal_Effect.png', 192, 134) };
    },
    avatar: (c) => `${FREE}UI Elements/UI Elements/Human Avatars/Avatars_${String(colorIndex(c) * 5 + 4).padStart(2, '0')}.png`,
  },
  swordsman: {
    name: 'Swordsman', role: 'Tank', weight: 10,
    stats: { hp: 140, atk: 14, def: 5, rate: 1.1, range: 1.2, speed: 70 },
    art: (c) => {
      const p = `${WAR}Swordsman/Swordsman Animations/Swordsman_${c}/Swordsman_`;
      return { idle: sq(`${p}Idle_${c}.png`, 320, 205), run: sq(`${p}Run_${c}.png`, 320, 205),
        attack: [sq(`${p}Attack_${c}.png`, 320, 205)], hitFrame: 5 };
    },
    avatar: (c) => `${WAR}Swordsman/Swordsman Avatar/Swordsman_Avatar_${colorIndex(c) + 1}.png`,
  },
  berserker: {
    name: 'Berserker', role: 'Melee', weight: 9,
    stats: { hp: 115, atk: 19, def: 2, rate: 0.8, range: 1, speed: 80 },
    art: (c) => {
      const p = `${WAR}Berserker/Berserker Animations/Berserker_${c}/Berserker_`;
      return { idle: sq(`${p}Idle_${c}.png`, 192, 140), run: sq(`${p}Run_${c}.png`, 192, 140),
        attack: [sq(`${p}${c === 'Red' ? 'Attac' : 'Attack'}_${c}.png`, 192, 140)], hitFrame: 3 };
    },
    avatar: (c) => `${WAR}Berserker/Berserker Avatar/Berserker_Avatar_0${colorIndex(c) + 1}.png`,
  },
  horseman: {
    name: 'Horseman', role: 'Melee', weight: 7,
    stats: { hp: 125, atk: 16, def: 3, rate: 1.0, range: 1.3, speed: 120 },
    art: (c) => {
      const p = `${WAR}Horseman/Horseman Animations/Horseman_${c}/Horseman_`;
      return { idle: sq(`${p}Idle_${c}.png`, 320, 220), run: sq(`${p}Run_${c}.png`, 320, 220),
        attack: [sq(`${p}Attack_${c}.png`, 320, 220)], hitFrame: 4 };
    },
    avatar: (c) => `${WAR}Horseman/Horseman Avatar/Horseman_Avatar_0${colorIndex(c) + 1}.png`,
  },
};

export const KING_AVATAR = (c) => `${WAR}King/King Avatar/King_Avatar_0${colorIndex(c) + 1}.png`;

export const RARITIES = [
  { id: 'common', name: 'Common', weight: 62, mul: 1, color: '#c9c2b0' },
  { id: 'rare', name: 'Rare', weight: 28, mul: 1.3, color: '#5aa6e0' },
  { id: 'epic', name: 'Epic', weight: 8.5, mul: 1.7, color: '#b46be0' },
  { id: 'legendary', name: 'Legendary', weight: 1.5, mul: 2.2, color: '#f2c14e' },
];
export const rarity = (id) => RARITIES.find((r) => r.id === id) || RARITIES[0];

// ---------------------------------------------------------------- enemies
const E = (folder, file) => `${ENEMY}${folder}/${file}`;
export const ENEMIES = {
  spearGoblin: {
    name: 'Spear Goblin', tribe: 'Goblins', stats: { hp: 70, atk: 9, def: 2, rate: 1.1, range: 1.4, speed: 75 },
    art: { idle: sq(E('Spear Goblin', 'Spear Goblin_Idle.png'), 256, 174), run: sq(E('Spear Goblin', 'Spear Goblin_Run.png'), 256, 171),
      attack: [sq(E('Spear Goblin', 'Spear Goblin_Attack Fast.png'), 256, 174)], hitFrame: 3 },
    avatar: E('Spear Goblin', 'Spear Goblin_Avatar.png'),
  },
  torchGoblin: {
    name: 'Torch Goblin', tribe: 'Goblins', stats: { hp: 60, atk: 11, def: 1, rate: 1.0, range: 1, speed: 85 },
    art: { idle: sq(E('Torch Goblin', 'Torch Goblin_Idle.png'), 192, 133), run: sq(E('Torch Goblin', 'Torch Goblin_Run.png'), 192, 133),
      attack: [sq(E('Torch Goblin', 'Torch Goblin_Attack.png'), 192, 133)], hitFrame: 4 },
    avatar: E('Torch Goblin', 'Torch Goblin_Avatar.png'),
  },
  pigRider: {
    name: 'Pig Rider', tribe: 'Goblins', stats: { hp: 110, atk: 13, def: 3, rate: 1.2, range: 1.4, speed: 110 },
    art: { idle: sq(E('Extra/Pig Rider Spear Goblin', 'Pig Rider_Idle.png'), 256, 166), run: sq(E('Extra/Pig Rider Spear Goblin', 'Pig Rider_Run.png'), 256, 166),
      attack: [sq(E('Extra/Pig Rider Spear Goblin', 'Pig Rider_Attack.png'), 256, 166)], hitFrame: 3 },
    avatar: E('Spear Goblin', 'Spear Goblin_Avatar.png'),
  },
  thief: {
    name: 'Thief', tribe: 'Goblins', stats: { hp: 55, atk: 14, def: 1, rate: 0.8, range: 1, speed: 95 },
    art: { idle: sq(E('Thief', 'Thief_Idle.png'), 192, 133), run: sq(E('Thief', 'Thief_Run.png'), 192, 133),
      attack: [sq(E('Thief', 'Thief_Attack.png'), 192, 133)], hitFrame: 3 },
    avatar: E('Thief', 'Thief_Avatar.png'),
  },
  gnoll: {
    name: 'Gnoll', tribe: 'Goblins', stats: { hp: 60, atk: 10, def: 1, rate: 1.4, range: 4.5, speed: 65 },
    projectile: { src: E('Gnoll', 'Gnoll_Bone.png'), fw: 64, fh: 64, speed: 380, spin: true },
    art: { idle: sq(E('Gnoll', 'Gnoll_Idle.png'), 192, 135), run: sq(E('Gnoll', 'Gnoll_Walk.png'), 192, 135),
      attack: [sq(E('Gnoll', 'Gnoll_Throw.png'), 192, 135)], hitFrame: 5 },
    avatar: E('Gnoll', 'Gnoll_Avatar.png'),
  },
  troll: {
    name: 'Troll', tribe: 'Brutes', boss: true, stats: { hp: 1000, atk: 26, def: 4, rate: 2.6, range: 1.8, speed: 45 },
    art: { idle: sq(E('Troll', 'Troll_Idle.png'), 384, 296), run: sq(E('Troll', 'Troll_Walk.png'), 384, 296),
      attack: [sq(E('Troll', 'Troll_Attack.png'), 384, 296)], hitFrame: 3, splash: 1.2,
      dead: sq(E('Extra/Troll Dead', 'Troll_Dead.png'), 384, 296) },
    avatar: E('Troll', 'Troll_Avatar.png'),
  },
};

// Campaign regions. Each stage lists enemy types; the generator scales stats by stage number.
export const REGIONS = [
  {
    id: 'goblins', name: 'Goblin Coast', tribe: 'Goblins', stages: 10, terrain: 2,
    pool: ['spearGoblin', 'torchGoblin', 'gnoll', 'thief', 'pigRider'],
    boss: 'troll',
  },
];

export function stageEnemies(regionIdx, stage) {
  const R = REGIONS[regionIdx];
  if (stage === R.stages) return [R.boss, 'torchGoblin', 'spearGoblin'];
  const count = Math.min(6, 2 + Math.floor(stage * 0.45));
  const unlocked = R.pool.slice(0, Math.min(R.pool.length, 2 + Math.floor(stage / 2)));
  const list = [];
  let s = stage * 9301 + 49297;
  for (let i = 0; i < count; i++) { s = (s * 9301 + 49297) % 233280; list.push(unlocked[s % unlocked.length]); }
  return list;
}

export const stageScale = (stage) => 1 + (stage - 1) * 0.1;
