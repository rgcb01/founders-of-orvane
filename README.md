# Founders of Orvane

Build. Trade. Explore. Prosper.

A fast-paced, cross-platform strategy board game inspired by classic hex-based trading games. The initial goal is a complete base game for 3–6 players, followed by modular expansions.

## v0.7.0 — Local bots

Interactive seeded board preview, standard and extended island layouts, shared vertex/edge topology, resource/number placement, and mobile-friendly controls. Includes local pass-and-play initial placement for 3–6 players, snake order, legal road and settlement placement, and starting resources. Includes two-dice turns, finite resource bank, simultaneous production, paid roads/settlements/cities, and piece limits. Includes seeded coastal harbors, 4:1/3:1/2:1 bank exchanges, bilateral multi-resource offers and counteroffers, and emoji resource art. Seven triggers discards, robber movement and random theft. Development cards use 25/34-card decks, with knights, free roads, abundance, monopoly and hidden victory points. Includes longest road, largest army, 10-point victory with hidden cards, randomized first player and paired 5–6-player action windows. Supports 1–6 local humans and up to 5 bots, heuristic setup, expansion, trading, discard, robber and card policies, plus fast bot pacing. Local play (including pass-and-play) is the primary product. Internet multiplayer is an optional future module and is not required for the base game or expansions.

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
