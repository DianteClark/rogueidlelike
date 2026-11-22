# Tiny Crowns

An idle hero collector, kingdom builder and roguelite for iPhone, played as a home-screen web app.
Art by [Pixel Frog — Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords) (Free Pack, Enemy Pack, Warfare).
Font: **BoldPixels by YukiPixels**, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (unchanged).

See **[DESIGN.md](DESIGN.md)** for the full game design and build order.

## Play on iPhone
**Live link: https://dianteclark.github.io/rogueidlelike/**

1. Open the link in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the home screen: fullscreen, works offline, saves on the device.

Add `#reset` to the end of the URL once to wipe your save (`#reset&seed=123` to try a specific island).

## What's in this build
- Kingdom select: pick one of five colors, each with a combat passive, an island passive and a drawback (four unlock with Legacy)
- A new random island every run (seeded generator: plateau with stairs and gold, forest, sheep meadow, castle and house), built from the Tiny Swords tilemap rules (flat ground, plateau, cliffs, stairs, animated foam, shadows)
- Pawns with jobs: Woodcutter, Miner, Shepherd, Builder. They walk, work, climb stairs and carry resources to the castle
- Food: pawns eat meat; new pawns arrive when there's house room and food
- Build houses (place, then builders construct them)
- Clouds drift above the island and cast shadows on it
- Pan / pinch-zoom camera, tap buildings and pawns
- Autosave and "While you were away" offline earnings (up to 12h)

## Project layout
```
index.html, styles.css, manifest.webmanifest, sw.js   app shell + offline support
src/main.js            boot, game loop, save/lifecycle
src/engine/            image loading + animation, camera/touch input
src/world/terrain.js   map parsing, autotiling, walkability, pathfinding
src/world/world.js     the island simulation (resources, jobs, buildings, offline progress)
src/world/pawn.js      pawn AI
src/world/entities.js  trees, gold, sheep, buildings, effects
src/world/generate.js  seeded random island generator (map + starting layout)
src/ui/hud.js          resource bar, panels, toasts
src/data/art.js        every sprite path/frame size in one place
assets/packs/          the Tiny Swords packs (cleaned copies)
tools/                 import_packs.py (re-import new pack versions), make_icon.py (app icon)
```

## Adding new Pixel Frog content
1. Download the new pack zip and unzip it.
2. `python3 tools/import_packs.py . free="/path/Tiny Swords (Free Pack)" enemy="/path/Enemy Pack" warfare="/path/Warfare"`
3. Add the new sprites to `src/data/art.js`.

## Running locally
Any static server works, e.g. `python3 -m http.server` and open http://localhost:8000.
