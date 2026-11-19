# Founders of Orvane

Build. Trade. Explore. Prosper.

A fast-paced, cross-platform strategy board game inspired by classic hex-based trading games. The initial goal is a complete base game for 3–6 players, followed by modular expansions.

## v0.9.1 — Readable match UX

Interactive seeded board preview, standard and extended island layouts, shared vertex/edge topology, resource/number placement, and mobile-friendly controls. Includes local pass-and-play initial placement for 3–6 players, snake order, legal road and settlement placement, and starting resources. Includes two-dice turns, finite resource bank, simultaneous production, paid roads/settlements/cities, and piece limits. Includes seeded coastal harbors, 4:1/3:1/2:1 bank exchanges, bilateral multi-resource offers and counteroffers, and emoji resource art. Seven triggers discards, robber movement and random theft. Development cards use 25/34-card decks, with knights, free roads, abundance, monopoly and hidden victory points. Includes longest road, largest army, 10-point victory with hidden cards, randomized first player and paired 5–6-player action windows. Supports 1–6 local humans and up to 5 bots, heuristic setup, expansion, trading, discard, robber and card policies, plus adjustable bot pacing with relaxed default, pause and single-action stepping. Adds a visible match feed and clearer construction targets. Adds a mobile action dock, resource hand, dice display, and original synthesized sound effects with mute, volume and optional bot audio. Local play (including pass-and-play) is the primary product. Internet multiplayer is an optional future module and is not required for the base game or expansions.

## Development

Requirements: Node.js 22 and pnpm 10.

```sh
corepack enable
pnpm install
pnpm dev
pnpm check
pnpm build
```

The static build is in `apps/web/dist`. Configure repository Settings → Pages → Build and deployment → Source: GitHub Actions. The workflow checks pull requests and deploys main.

## Architecture

- `packages/engine`: deterministic, framework-independent game domain.
- `apps/web`: React/Vite client, SVG board view; no backend required.
- Future: AI workers, local persistence, PWA support, expansion modules.
- Optional: a separate authoritative multiplayer service; the local game must remain fully functional without it.

See [roadmap](docs/roadmap.md). Original visual assets and branding only. Not affiliated with CATAN.

Visual event queue: dice, producing hexes, resource icons, new pieces, robber motion, trade and awards. The bot scheduler waits for presentation; reduced-motion and turbo options remain available.

Optional camera follow, solo resource flights to hand, distinct city silhouettes, illustrated development cards and event-synchronized sound.

Game feel: animated dice faces, public trade lanes, construction costs, anonymous stolen card, victory confetti, optional original ambient loop and supported haptics.

Game-first interface: main menu, local setup, compact player avatars, resource cards, graphical construction costs, trade preview, contextual guide and action panel navigation.

Local persistence and installable PWA: independent match saves, automatic checkpoints, resume paused, history and preferences, generated icons and versioned offline shell. Saves are browser-local, not synced; clearing site data removes them.

Local profile progression: XP, ranks, achievements and unlockable/equippable avatars. Account authentication and cloud sync are optional future work; see [progression design](docs/progression.md).

Seven cosmetic collections, 32 catalog items, local wardrobe and equipped styles. No paid rewards or game-rule changes.

Ten cosmetic slots per collection (74 items total); themed solo pieces, robber marker, original ambient motifs and effect accents. Legacy loadouts remain readable.

Local recurring challenges, detailed career metrics, 15 achievements and end-of-match reward breakdown; no account required.

Four differentiated heuristic bot policies, reproducible rotating-seat mixed difficulty and frozen-policy comparison. No hidden hand access.

Advanced AI: deterministic personalities, public threat-aware bargaining, combined build goals and two-step bank-trade lookahead; 200 seeded benchmark games.
