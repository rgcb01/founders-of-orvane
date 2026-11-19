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
| 0.8 | Online rooms, authoritative server and reconnect |
| 0.9 | Turbo, persistence, mobile polish |
| 1.0 | Complete base game |
| 2.0+ | Sailing, cities/knights, trade variants, exploration, then combined mode |

## Decisions

The engine is pure TypeScript and cannot depend on DOM or UI. A single seeded generator owns map inventory and topology; actions in future versions must validate against the engine, never the view. The initial renderer is SVG for low setup cost, accessibility and touch interaction; evaluate PixiJS when profiling shows a need. No server is needed for the first playable solo build. The extended island is a 30-hex base-game layout, not an archipelago expansion. Ports and full setup rules are future milestones. Turbo must preserve game probabilities. Original assets and branding; verify rights before publishing derivative material.

## Economy preview limitations
Seven yields no production until the robber milestone. Turns currently cycle one player at a time; official paired 5–6-player turns and victory are planned for v0.6. No trading until v0.4. The local interface hides inactive players' exact hands, but is not a security boundary.
