// Every sprite the game uses, in one place. Adding new Pixel Frog art = add an entry here.
// Sheets are horizontal strips; frame count is worked out from the image width at load time.
// ax/ay = anchor (where the feet / base sit inside one frame).

export const FREE = 'assets/packs/free/';
export const ENEMY = 'assets/packs/enemy/';
export const WAR = 'assets/packs/warfare/';

export const COLORS = ['Blue', 'Red', 'Yellow', 'Purple', 'Black'];
export const TILE = 64;
export const FPS = 10; // pack animation speed

const unit = (src) => ({ src, fw: 192, fh: 192, ax: 96, ay: 136 });

export function pawnArt(color = 'Blue') {
  const p = `${FREE}Units/${color} Units/Pawn/Pawn_`;
  return {
    idle: unit(p + 'Idle.png'),
    run: unit(p + 'Run.png'),
    idleAxe: unit(p + 'Idle Axe.png'),
    runAxe: unit(p + 'Run Axe.png'),
    chop: unit(p + 'Interact Axe.png'),
    idlePick: unit(p + 'Idle Pickaxe.png'),
    runPick: unit(p + 'Run Pickaxe.png'),
    mine: unit(p + 'Interact Pickaxe.png'),
    idleKnife: unit(p + 'Idle Knife.png'),
    runKnife: unit(p + 'Run Knife.png'),
    cut: unit(p + 'Interact Knife.png'),
    idleHammer: unit(p + 'Idle Hammer.png'),
    runHammer: unit(p + 'Run Hammer.png'),
    build: unit(p + 'Interact Hammer.png'),
    runWood: unit(p + 'Run Wood.png'),
    runGold: unit(p + 'Run Gold.png'),
    runMeat: unit(p + 'Run Meat.png'),
  };
}

export const TERRAIN = {
  tilemap: (n = 1) => ({ src: `${FREE}Terrain/Tileset/Tilemap_color${n}.png` }),
  shadow: { src: `${FREE}Terrain/Tileset/Shadow.png` },
  foam: { src: `${FREE}Terrain/Tileset/Water Foam.png`, fw: 192, fh: 192, ax: 96, ay: 96 },
  water: { src: `${FREE}Terrain/Tileset/Water Background color.png` },
};

const T = `${FREE}Terrain/`;
export const NATURE = {
  trees: [1, 2, 3, 4].map((i) => ({
    src: `${T}Resources/Wood/Trees/Tree${i}.png`, fw: 192, fh: i <= 2 ? 256 : 192, ax: 96, ay: i <= 2 ? 234 : 164,
  })),
  stumps: [1, 2, 3, 4].map((i) => ({ src: `${T}Resources/Wood/Trees/Stump ${i}.png`, fw: 192, fh: 256, ax: 96, ay: 234 })),
  goldStones: [1, 2, 3, 4, 5, 6].map((i) => ({ src: `${T}Resources/Gold/Gold Stones/Gold Stone ${i}.png`, fw: 128, fh: 128, ax: 64, ay: 88 })),
  goldShine: [1, 2, 3, 4, 5, 6].map((i) => ({ src: `${T}Resources/Gold/Gold Stones/Gold Stone ${i}_Highlight.png`, fw: 128, fh: 128, ax: 64, ay: 88 })),
  sheepIdle: { src: `${T}Resources/Meat/Sheep/Sheep_Idle.png`, fw: 128, fh: 128, ax: 64, ay: 82 },
  sheepMove: { src: `${T}Resources/Meat/Sheep/Sheep_Move.png`, fw: 128, fh: 128, ax: 64, ay: 82 },
  sheepGrass: { src: `${T}Resources/Meat/Sheep/Sheep_Grass.png`, fw: 128, fh: 128, ax: 64, ay: 82 },
  bushes: [1, 2, 3, 4].map((i) => ({ src: `${T}Decorations/Bushes/Bushe${i}.png`, fw: 128, fh: 128, ax: 64, ay: 78 })),
  rocks: [1, 2, 3, 4].map((i) => ({ src: `${T}Decorations/Rocks/Rock${i}.png`, fw: 64, fh: 64, ax: 32, ay: 50 })),
  waterRocks: [1, 2, 3, 4].map((i) => ({ src: `${T}Decorations/Rocks in the Water/Water Rocks_0${i}.png`, fw: 64, fh: 64, ax: 32, ay: 40 })),
  clouds: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ src: `${T}Decorations/Clouds/Clouds_0${i}.png` })),
  duck: { src: `${T}Decorations/Rubber Duck/Rubber duck.png`, fw: 32, fh: 32, ax: 16, ay: 24 },
  woodItem: { src: `${T}Resources/Wood/Wood Resource/Wood Resource.png` },
  goldItem: { src: `${T}Resources/Gold/Gold Resource/Gold_Resource.png` },
  meatItem: { src: `${T}Resources/Meat/Meat Resource/Meat Resource.png` },
};

export const FX = {
  dust: { src: `${FREE}Particle FX/Dust_01.png`, fw: 64, fh: 64, ax: 32, ay: 48 },
  dustBig: { src: `${FREE}Particle FX/Dust_02.png`, fw: 64, fh: 64, ax: 32, ay: 48 },
  explosion: { src: `${FREE}Particle FX/Explosion_01.png`, fw: 192, fh: 192, ax: 96, ay: 120 },
  splash: { src: `${FREE}Particle FX/Water Splash.png`, fw: 192, fh: 192, ax: 96, ay: 120 },
};

// Buildings: footprint in tiles (w × h, counted up from the bottom row), sprite anchored bottom-center.
export const BUILDINGS = {
  castle:    { name: 'Castle',    file: 'Castle.png',    w: 5, h: 2, cost: null, sink: 7 },
  house:     { name: 'House',     file: 'House1.png',    w: 2, h: 1, cost: { wood: 30 }, sink: 16, pawns: 3, build: 20,
               variants: ['House1.png', 'House2.png', 'House3.png'] },
  tower:     { name: 'Tower',     file: 'Tower.png',     w: 2, h: 1, cost: { wood: 40, gold: 20 }, sink: 24, build: 30, locked: true },
  barracks:  { name: 'Barracks',  file: 'Barracks.png',  w: 3, h: 2, cost: { wood: 60, gold: 30 }, sink: 10, build: 40, locked: true },
  archery:   { name: 'Archery',   file: 'Archery.png',   w: 3, h: 2, cost: { wood: 60, gold: 30 }, sink: 14, build: 40, locked: true },
  monastery: { name: 'Monastery', file: 'Monastery.png', w: 3, h: 2, cost: { wood: 80, gold: 50 }, sink: 8, build: 50, locked: true },
};
export const buildingSrc = (file, color = 'Blue') => `${FREE}Buildings/${color} Buildings/${file}`;

export const ICONS = {
  wood: `${FREE}UI Elements/UI Elements/Icons/Icon_02.png`,
  gold: `${FREE}UI Elements/UI Elements/Icons/Icon_03.png`,
  meat: `${FREE}UI Elements/UI Elements/Icons/Icon_04.png`,
  hammer: `${FREE}UI Elements/UI Elements/Icons/Icon_01.png`,
  pawn: `${FREE}UI Elements/UI Elements/Human Avatars/Avatars_05.png`,
};
