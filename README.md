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
- Kingdom select: pick one of six kingdoms (five colours + the Beast Horde, each with a combat passive, an island passive and a drawback (four unlock with Legacy)
- A new random island every run (seeded generator: plateau with stairs and gold, forest, sheep meadow, castle and house), built from the Tiny Swords tilemap rules (flat ground, plateau, cliffs, stairs, animated foam, shadows)
- Pawns with jobs: Woodcutter, Miner, Shepherd, Builder. They walk, work, climb stairs and carry resources to the castle
- Food: pawns eat meat; new pawns arrive when there's house room and food
- Build houses (place, then builders construct them)
- Clouds drift above the island and cast shadows on it
- Heroes: summon (3 free, then gold) with a reveal, 7 classes × 5 colors × 4 rarities, levels, a 5-hero campaign team
- Campaign: Goblin Coast, 10 stages ending in a Troll boss. Auto-battles with hit flashes, damage numbers, projectiles, kingdom combat passives, the King's Royal Rally (with cut-in), x2 speed, retreat, replay for farming
- Rewards: gold, hero XP and level-ups, free recruits every 3 stages; idle gold from your best stage
- Raids (Gentle tier): after your first win, goblins land on a beach every 6–10 min with a 90s warning. Assign up to 3 Guard heroes, build Towers that shoot arrows, pawns shelter in the castle; raiders that reach the castle steal resources. Raids while you're away are resolved by defense vs raid strength
- The rubber duck: tap it when it drifts by for treasure; a rare golden duck gives gold and a free recruit
- Campaign map: a sea chart of stage islands; after each fight choose Next stage, Map or Island (Retry after a loss)
- Team bonuses: 2/3/4/5 heroes of one colour (or one monster tribe) unlock tiered bonuses; heroes matching your kingdom colour get +10% health and attack
- Monster heroes: every monster you beat can join your summons (Rare or better); bosses are Legendary, sometimes Mythic
- Beast Horde: a monster kingdom with a Hollow Tree instead of a castle, Gnome Huts, Mushroom Towers, Goblin Huts, a Lookout and a Shaman Cave; the Troll is its King; starts with goblin heroes, humans join after stage 5, beaten raiders may join
- All kingdoms are unlocked for testing until runs and Legacy exist (`UNLOCK_ALL_FOR_TESTING` in src/data/kingdoms.js)
- Units in battle stand on a coloured ring: yours vs the enemy's
- Tap and hold any building (castle included) to pick it up, drag it (green = fits, red = blocked) and let go
- Injuries: heroes who fall get Wounded (weaker, heal on their own); fall again and they're Critical (can't fight). The Monastery (now buildable) has beds that heal Critical heroes 5× faster
- Big raids (from stage 5): more raiders; the castle only shelters 5 pawns + 2 per house, and raiders can catch up to 3 pawns left outside; they also set buildings near the castle on fire. Wrecked buildings stop working until Builders repair them. If the Monastery burns, heroes resting inside fall for good and join the Hall of Heroes (each relic: +1% attack for all heroes)
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
src/ui/battleHud.js    battle overlay (rally, speed, retreat, results)
src/ui/mapScreen.js    campaign sea chart
src/battle/battle.js   auto-battle engine
src/battle/raid.js     island raids (landing, marching, stealing, guards, towers)
src/game/heroes.js     hero model: summoning, stats, levels
src/data/units.js      hero classes, enemies, campaign regions
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
