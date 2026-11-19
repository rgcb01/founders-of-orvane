# Founders of Orvane

Build. Trade. Explore. Prosper.

A fast-paced, cross-platform strategy board game inspired by classic hex-based trading games. The initial goal is a complete base game for 3–6 players, followed by modular expansions.

## v0.2.0 — Local initial placement

Interactive seeded board preview, standard and extended island layouts, shared vertex/edge topology, resource/number placement, and mobile-friendly controls. Includes local pass-and-play initial placement for 3–6 players, snake order, legal road and settlement placement, and starting resources. Dice, ongoing turns, paid construction, bots and networking are not yet implemented.

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
- Future: AI workers, authoritative multiplayer server, expansion modules.

See [roadmap](docs/roadmap.md). Original visual assets and branding only. Not affiliated with CATAN.
