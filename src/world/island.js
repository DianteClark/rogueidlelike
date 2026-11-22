// The starting home island. Edit the map text to reshape it (legend in terrain.js).
// Taller than wide so it fits a portrait phone.
export const HOME_MAP = [
  '........................',
  '........................',
  '......gggggg............',
  '.....gggggggggg...ggg...',
  '....ggghhhhhhggggggggg..',
  '...gggghhhhhhhgggggggg..',
  '...gggghhhhhhhggggggg...',
  '...ggghhhhhhhhgggggggg..',
  '...ggghhhhhhhhsggggggg..',
  '...ggggggggggggggggggg..',
  '..ggggggggggggggggggggg.',
  '..ggggggggggggggggggggg.',
  '...gggggggggggggggggggg.',
  '...ggggggggggggggggggg..',
  '...gggggggggggggggggggg.',
  '..gggggggggggggggggggg..',
  '..ggggggggggggggggggg...',
  '..gggggggggggggggggggg..',
  '...ggggggggggggggggggg..',
  '...gggggggggggggggggg...',
  '....ggggggggggg.ggggg...',
  '.....gggggggg....gggg...',
  '......gggggg............',
  '................gg......',
  '........................',
  '........................',
];

// Starting layout. Buildings use their bottom-left footprint tile.
export const HOME_LAYOUT = {
  castle: { x: 9, y: 14 },
  buildings: [{ type: 'house', x: 5, y: 15, variant: 0 }],
  trees: [
    [16, 4], [18, 4], [20, 5], [17, 6], [19, 7], [21, 7], [16, 8], [18, 9], [20, 9],
    [17, 11], [19, 11], [21, 12], [5, 3], [7, 2], [4, 6], [3, 10], [19, 3], [20, 17], [18, 20],
  ],
  stones: [[8, 5, 5], [11, 6, 3], [9, 8, 2], [12, 8, 1]],
  sheep: [[4, 17], [6, 18], [8, 17], [5, 19]],
  bushes: [[3, 12], [15, 16], [9, 20], [20, 14], [6, 2], [14, 10], [16, 18]],
  rocks: [[2, 15], [19, 19], [11, 3], [21, 10]],
  waterRocks: [[1, 6], [23, 13], [12, 24], [22, 2], [1, 20]],
  duck: [13, 23],
};

export const PEN = { x0: 3, y0: 16, x1: 10, y1: 21 }; // where sheep wander and respawn
