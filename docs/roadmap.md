# Roadmap

| Version | Scope |
|---|---|
| 0.1 | Seeded board, topology, responsive explorer, CI/Pages |
| 0.2 | Player state, snake-order initial placement, settlement distance rule, roads, cities |
| 0.3 | Dice, resource bank, turn phases, production |
| 0.4 | Trade offers, bank and ports |
| 0.5 | Robber, discards, development cards |
| 0.6 | Longest route, largest army, victory and 5–6 player rules |
| 0.7 | Fair local bots, simulation harness, difficulty |
| 0.7.1 | Mobile-first match UI, action prompts, AI balance and usability |
| 0.8 | Local save/resume, versioned saves, PWA/offline support |
| 0.9 | Turbo and performance, stronger AI, end-to-end testing, base-game polish |
| 1.0 | Complete local base game (human + bots and pass-and-play) |
| 2.0 | Sailing expansion |
| 3.0 | Cities and knights expansion |
| 4.0 | Trade and barbarians expansion |
| 5.0 | Exploration and pirates expansion |
| 6.0 | Combined expansion campaign |

## Decisions

The engine is pure TypeScript and cannot depend on DOM or UI. A single seeded generator owns map inventory and topology; actions in future versions must validate against the engine, never the view. The initial renderer is SVG for low setup cost, accessibility and touch interaction; evaluate PixiJS when profiling shows a need. No server is required for the local game, base-game release, or any expansion. The extended island is a 30-hex base-game layout, not an archipelago expansion. Ports and initial placement are implemented; paid construction and trade follow the base rules. Turbo must preserve game probabilities. Original assets and branding; verify rights before publishing derivative material.

## Economy preview limitations
Seven now triggers discards and robber movement; a blocked hex does not produce. Paired 5–6-player turns and 10-point victory are implemented in v0.6. Trading is available from v0.4. The local interface hides inactive players' exact hands, but is not a security boundary.

## Art direction
Emoji terrain and resource symbols are the lightweight visual language for the web client. Rendering varies by platform; engine state never depends on emoji. Ports are seeded coastal placements (not a fixed physical board layout).

Development cards: 25/34 cards, separate randomized deck, no same-turn non-VP use, one non-VP card per turn. Local hands are not a security boundary; public state projections will be needed for online play. Victory awards and paired turns are implemented in v0.6.

## Victory and action windows
The longest trail does not reuse edges and stops at opposing buildings. Awards preserve incumbent ties; otherwise a unique qualifying leader earns the bonus. Victory is evaluated for the active player when mandatory effects resolve. Paired play follows the 2025 5–6 player rules: third seat acts after primary, without dice or domestic trade. Each action window has its own card-use limit; the production round increments after both windows. Random roll-off determines first placement. Variable maps remain custom seeded layouts rather than physical fixed setup.

## Local bots
Heuristic policy with own hand/public board, aggregate holdings and public scores only. The local projection masks opponents and deck order; this is not a security boundary. Difficulty affects setup noise and negotiation; hard/expert are currently similar heuristic policies, not Monte Carlo search. Browser schedules one action at a time with a short turbo delay; Web Workers and richer personalities are future optimizations. Automated matches report winner, rounds and trade/build counts.

## Optional online module (not on the critical path)

Online play is deferred and may be developed independently if desired. It is not a release gate for 1.0 or expansions. Keep GitHub Pages as the primary frontend, with local play, AI and saves usable without a backend. A future opt-in authoritative service (candidate: Cloudflare Workers + Durable Objects) may provide private rooms, invite links, mixed human/bot seats, per-seat private state, server-generated randomness, idempotent actions, reconnection, persistent games and bot substitution. Public matchmaking, accounts, rankings and chat are later optional features. Do not introduce a required service URL, credentials, account, or paid dependency into the local build. Preserve shared engine and serialization boundaries for eventual online support.
