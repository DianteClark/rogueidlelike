# Tiny Crowns — Design Document

*Working title. Idle hero collector + kingdom builder + roguelite, for iPhone (home-screen web app).*
*Art: Pixel Frog's Tiny Swords (Free Pack, Enemy Pack, Warfare). Built to grow as new packs release.*

---

## 1. The pitch

You rule a tiny island kingdom. Your **heroes** fight through a campaign automatically and keep earning while
you're away. Back home, your **pawns** gather, build and grow the island — and monster hordes want it gone.

Your best heroes can't be everywhere: on the campaign, guarding the castle, or escorting pawns.
Every run is an **Era**. Win it, lose it, or push into **Endless** for a high score. Whatever happens, you carry
**Legacy** into the next run.

## 2. Platform & feel

- iPhone 16 Plus first (430×932 pt portrait, Dynamic Island, home indicator). Portrait, one hand.
- Home-screen web app (PWA): fullscreen, offline, saves locally. No account needed.
- Steady 60 fps on Canvas 2D, pixel-perfect sprites, 64×64 tile grid.
- Short check-ins (1–5 min) plus longer sessions when a siege hits.
- No real money. Every currency is earned in-game.

## 3. Core loops

| Loop | Time scale | What you do |
|---|---|---|
| Battle | seconds | Watch the auto-battle and tap your King's ability at the right moment |
| Campaign | minutes | Push stages with your team of 5 and collect loot and summon currency |
| Island | hours | Assign pawns, build and upgrade, station defenders, send escorted trips |
| Raids | hours–days | Prepare for warned raids and survive sieges |
| Run (Era) | days–weeks | Grow the kingdom, beat the Era's final threat, or fall |
| Meta | across runs | Spend Legacy on starting boosts, kingdoms, commanders and new heroes |

## 4. Kingdoms & factions

Five human kingdoms (the five color sets) plus monster tribes. At the start of every run you pick a kingdom:
your whole island (castle, buildings, pawns, heroes' home color) takes its color, and the other four become
rival kingdoms. Each kingdom has a **combat passive**, an **island passive** and a **drawback**, so every
pick is a strategy, not just a color.

| Kingdom | Combat | Island | Drawback | Unlock |
|---|---|---|---|---|
| Blue — Order of the Shield | Heroes start fights with a shield | Towers and walls cost 25% less and are sturdier | Heroes deal 10% less damage | Free |
| Red — Ember Empire | Faster attacks below half HP | +50% loot from raids and campaign stages | Buildings cost 25% more wood | 150 Legacy |
| Yellow — Sun Republic | +15% crit chance | +1 gold per mining trip, 16h idle cap | Pawns eat 30% more food | 300 Legacy |
| Purple — Veil Temple | Heal over time in fights | Critical heroes recover 2× faster, Monastery +2 slots | Pawns work 15% slower | 500 Legacy |
| Black — Fallen Crown | Lifesteal | Fallen heroes leave relics 2× as strong | Raids come 30% more often | 800 Legacy |
| Beast Horde (monsters) | Heroes move and attack 12% faster | Starts with monster heroes; beaten raiders may join | Humans only join after stage 5 | 1000 Legacy |

The Beast Horde builds with Enemy Pack structures: Hollow Tree (main hall), Gnome Hut (house), Mushroom Tower, Goblin Hut (barracks), Lookout (archery), Shaman Cave (monastery). Its King is the Troll.

Kingdoms are defined in `src/data/kingdoms.js`. Island passives and drawbacks that touch existing systems
(build costs, gold, food, work speed, idle cap) are live now; combat and raid ones switch on as those systems land.

**Team bonus:** every hero gets the kingdom passive. 2/3/4/5 heroes of the same colour (or monster tribe) unlock tiers I–IV of that colour's effect for those heroes (Blue Shieldwall, Red Bloodrage, Yellow Sunstrike, Purple Veilmend, Black Grave Hunger; tribes: Goblin Swarm, Brute Thick Hide, Forest Wild Growth, Sea Tidecaller, Undead Unending). Heroes matching the kingdom colour get +10% health and attack. Defined in `src/game/synergy.js`.

**Monster heroes:** beating a monster type unlocks it in the summon pool. Monsters are at least Rare; bosses are Legendary with a 20% chance of the new **Mythic** tier.

**Counter loop:** Blue > Red > Yellow > Purple > Black > Blue (+25% damage against the color it beats).

### Monster tribes

| Tribe | Members | Role in the world |
|---|---|---|
| Sea Raiders | Paddle Shark, Harpoon Shark, Bomb Fish, Seahorse Boats, Pirate Tower, Cannon | Coastal raids, sea routes |
| Goblins | Spear Goblin, Torch Goblin, Pig Rider, Goblin Hut | Fire, fast raids |
| Forest | Bear, Bumblebee, Snake, Spider, Gnome, Slingshot Gnome, Gnome Hut/Tower | Resource islands, ambushes |
| Undead | Skull, Skull Guard, Giant Bat, Imp, Hex Shaman | Night raids, curses |
| Brutes | Troll, Minotaur, Panda, Turtle, Lizard, Gnoll (+ Guard variants) | Elites and bosses |

Monster heroes can be recruited as rare summons once their tribe has been beaten in the campaign.

## 5. Heroes

### Roster
- Every human class × color is a named hero with a portrait (Warrior, Archer, Lancer, Monk, Swordsman,
  Berserker, Horseman, Catapult crew). The King is your commander, not a summon.
- Rarity: Common → Rare → Epic → Legendary. Rarity sets stat growth and unlocks passives.
- Roles: Tank (Warrior, Swordsman, Lancer), Melee DPS (Berserker, Horseman), Ranged (Archer, Catapult),
  Support (Monk).

### Progression
- XP levels (capped by the Barracks, Archery and Monastery level).
- Stars: merge duplicates for +1 star (bigger stat boost and a visual glow).
- Gear slots (later): weapon, armor, charm, made from raid materials.

### Hero states
`Healthy → Wounded → Critical → Fallen`

- **Wounded:** reduced stats, recovers over time on its own. Can still fight.
- **Critical:** cannot fight. Must be placed in the Monastery. Monks speed up recovery.
- **Fallen:** permanent death. Happens if the Monastery is destroyed while the hero is inside, or a Critical
  hero takes another lethal hit during a siege.
- **Crypt:** a Monastery upgrade where 1–2 heroes are always safe.
- **Hall of Heroes:** fallen heroes leave a relic with a small permanent run bonus and are remembered
  on the run summary.

### Assignments (the core tension)
Each hero is in exactly one place:
- **Campaign team (5 slots)**
- **Garrison:** tower slots (ranged heroes shoot from the tower), gate and stairs slots (melee), castle guard
- **Escort:** guarding a pawn trip
- **Monastery:** recovering

## 6. Campaign

- A sea map of islands built from the tileset, grouped into regions, one per tribe.
- Stages are auto-battles on small terrain boards (cliffs, stairs, water).
- **Terrain matters:** ranged units on high ground get +range, units on stairs take less damage, melee units
  path around water, catapults fire over cliffs.
- Player input during battle: King's ability (charged meter), speed ×1/×2, retreat.
- Clearing a region **draws that tribe's attention**: it is added to the raid pool for your island.
- **Idle rewards:** gold, XP and summon shards build up from your furthest stage while you're away (12h cap).
  Collected on the "While you were away" screen.

## 7. The island

### Buildings (all from the pack)

| Building | Function |
|---|---|
| Castle | Main building. Level caps all other buildings and shelters pawns during raids. Falls = run over. |
| House (1–3) | Pawn capacity |
| Barracks | Melee hero capacity and level cap; trains Warrior/Lancer/Swordsman/Berserker |
| Archery | Ranged hero capacity and level cap |
| Monastery | Recovery for Critical heroes; Monk capacity; Crypt upgrade |
| Tower | Defense slot, garrisoned ranged hero |
| Wooden Fence | Walls that slow raiders |
| Sheep Pen | Meat production |
| Stable (later) | Horseman capacity |
| Workshop (later) | Catapult |

### Pawns & resources
- Resources: **Wood** (trees), **Gold** (gold stones), **Meat** (sheep).
- Pawns are assigned to jobs: Woodcutter, Miner, Shepherd, Builder. They walk, work, and carry resources
  home using the pack's carry animations.
- Food: each pawn eats meat. A food shortage slows work.
- Pawn count is capped by houses. New pawns arrive over time if there is room and food.

### Resource trips
- Nearby resource islands hold richer nodes.
- Send a group of pawns by boat. Trips take a set time (fits idle play).
- With an escort, the ambush chance drops and losses are smaller. Without one: high risk.

### Expansion
- Buy adjacent land chunks with gold and wood. New chunks bring resources but also more coastline,
  which means more landing points for raiders.
- Elevated plateaus are safer because raiders must reach them through stairs.
- Raid strength scales with **progress and wealth**, so fast expansion means bigger raids.

## 8. Raids

All raids are announced in advance (scout warning with arrival timer and enemy preview).

| Tier | When | Size | Can resolve offline? | Stakes |
|---|---|---|---|---|
| Gentle | From the start | Small | Yes | Steal resources, damage buildings |
| Real Stakes | Mid game | Medium, mixed tribes | Yes | + pawns can die, heroes wounded |
| Brutal (Siege) | Late game, scheduled ("Blood Moon") | Huge horde + elites + boss | **No — waits at shore** | + buildings destroyed, Monastery can fall, Castle can fall |

- Gentle and Real Stakes raids keep happening between sieges at all stages.
- **Sieges wait for the player:** if a siege arrives while you're away, it holds at the shore. When you open
  the app, you get a short prep window, then the siege begins live.
- **Pawn safety:** pawns run to the Castle when a raid starts, up to its shelter capacity. Anyone outside
  is at risk.
- **Buildings get wrecked, not deleted** (except in sieges). Builders repair wrecked buildings with wood.
- **Raid shield:** after a bad loss, no new raid for a few hours.
- **Rewards:** defeated raiders drop materials for hero upgrades and gear.

## 9. Runs, Eras & meta

### Era (standard run)
- Each Era has a final threat (Era 1: the Hex Shaman's army) unlocked after clearing campaign regions.
- **Win:** big Legacy payout, then choose **End run** or **Continue into Endless**.
- **Lose:** the Castle falls in a siege. The kingdom is wiped. Legacy is paid based on progress.
- **Retire:** end the run at any time and collect Legacy.

### Legacy (meta currency)
Spend between runs on:
- Starting boosts: extra pawns, starting resources, a starting hero, pre-built houses
- Unlocking kingdoms (start with Blue) and King commanders with unique abilities
- Permanent small buffs (pawn speed, idle cap, summon luck)
- New hero types and tribes in the summon pool

### Endless mode
- Unlocked by winning an Era. Hordes keep scaling, new raid combos appear, bosses return stronger.
- **Score:** sieges survived. Also shown: days played (the counter pauses while a siege waits),
  biggest horde beaten, peak kingdom size, top hero.
- Legacy is earned on a curve (each siege worth a bit less) so it can't be farmed forever.
- Ending is always the player's choice (or a fallen Castle).
- **Share card:** image with King, color, island snapshot, stats and top 3 heroes → iOS share sheet.
- Personal bests saved locally. Global leaderboard is a later add-on (needs a small server).

## 10. Content pipeline (growing with the packs)

- All units, enemies, buildings and effects are defined in data files (`src/data/*.js`): sprite paths,
  frame counts, frame size, stats, tribe, role.
- Adding a new Pixel Frog unit = drop PNGs in `assets/`, add one data entry.
- New enemies → new raid compositions, campaign stages or bosses. New buildings → new island functions.

### Art notes
- Animations run at 10 fps (100 ms per frame), as in the pack.
- Sprites face right; left is a horizontal flip.
- Most enemies have no hurt or death animation → hit flash, knockback, and a dust/explosion puff on death.
- Terrain follows Pixel Frog's tilemap guide: BG water → animated foam (random start frame) → flat ground →
  (shadow + elevated ground) per level, with stairs.

## 11. Technical plan

- Vanilla JavaScript (ES modules), Canvas 2D, no build step. Deployable as static files.
- `manifest.webmanifest` + service worker for home-screen install and offline play.
- Save: `localStorage` (small) with versioned save format; autosave every few seconds and on app hide.
- Offline progress computed from timestamps on resume.
- Rendering: integer-scaled pixel art, `imageSmoothingEnabled = false`, camera pan and pinch zoom.
- Safe areas via `env(safe-area-inset-*)`.
- Haptics: none (not available to iOS web apps), so feedback is visual and sound.

## 12. Build order

1. ✅ **Home island:** autotiled terrain with elevation, camera, pawns gathering wood/gold/meat, HUD, save.
2. ✅ Building placement (houses); house cap; pawn arrival. Random island per run. Kingdom select. *(upgrades: later)*
3. ✅ Battle engine + first campaign region (Goblin Coast). *(terrain bonuses on the battle board: next)*
4. ✅ Heroes: roster, summoning, levels, team screen.
5. ✅ Raids: Gentle tier, guard slots, towers. *(walls, more tribes: next)*
6. ✅ Idle rewards and "While you were away" screen.
7. ✅ Hero states (Wounded / Critical) + Monastery beds; Real Stakes raids (shelter limit, pawn losses, wrecked buildings, repairs); Fallen heroes + Hall of Heroes relics. *(resource trips with escorts: next)*
8. ✅ Sieges (Blood Moon), castle health, Castle falls → run end, Legacy earned, retire. *(Legacy shop: next)*
9. ✅ Endless mode, share card.
10. Polish: sound, juice, balancing, more regions as packs grow.

## 13. Pixel Frog roadmap → where it plugs in

Upcoming art announced by Pixel Frog, and where each piece fits:

| Coming art | Use in Tiny Crowns |
|---|---|
| Halberdier, Maceman, Warhammer, Javelin man, Crossbowman, Scout, Wizard | New hero classes |
| War Drummer, Banner Bearer | Support heroes (team buffs) |
| Bombardier, Torch Bearer, Battering Ram | Siege heroes; raid attackers that target buildings |
| War Dog | Fast hero / pawn escort |
| Stable, Siege Workshop, War Camp, Mage Tower, War Academy, Armory, Fortress, Citadel | Island buildings (hero capacity, training, gear, Castle upgrades) |
| Wood/Stone Walls (tileable), Wood/Wide/Tall Towers, Ballista/Cannon/Magic attachments, Spikes, Banners, Brazier | Island defenses for raids and sieges |
| Military Dock, Harbor Tower, Rowboat, Troop Transport | Resource trips by boat, sea raids, campaign travel |
| Dragon (Enemy Pack preview) | Era boss / Brutal siege boss |
| More enemies (the "?" slots) | New tribes, raid compositions, campaign regions |
