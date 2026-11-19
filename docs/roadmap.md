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
| 0.8.1 | Local profile, XP, ranks, achievements and avatar rewards |
| 0.8.2 | Themed collections, equipable dice, card backs, sea palettes and titles |
| 0.8.3 | Piece customization, robber, ambient themes and effects |
| 0.8.4 | Challenges, tracked career metrics, advanced achievements and match rewards |
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

Online play is deferred and may be developed independently if desired. It is not a release gate for 1.0 or expansions. Keep GitHub Pages as the primary frontend, with local play, AI and saves usable without a backend. A future opt-in authoritative service (candidate: Cloudflare Workers + Durable Objects) may provide private rooms, invite links, mixed human/bot seats, per-seat private state, server-generated randomness, idempotent actions, reconnection, persistent games and bot substitution. Public matchmaking, rankings and chat are later optional features. Email/password accounts, recovery and cloud progression/save sync are deferred as a separate optional module; see [local progression](progression.md). Do not introduce a required service URL, credentials, account, or paid dependency into the local build. Preserve shared engine and serialization boundaries for eventual online support.

## Mobile and audio (v0.7.1)
Mobile match controls remain accessible in a fixed safe-area-aware dock. Lobby settings collapse during play. Original synthesized Web Audio effects use a single master gain, gesture activation and persistent audio preferences; bot effects are optional and muted by default in turbo. No downloads or audio assets required. Expert has slightly more deterministic placement and negotiation and prioritizes a city when it can close out the game; deeper AI calibration remains for v0.9.

## UX review — v0.7.2
Keep the local game milestone at 0.7.x for iterative playtesting. Default relaxed bot pacing (1.4s between actions, 2.2s in action phase), normal and optional turbo. Pause/step affects bot scheduling only, never engine rules. A visible recent-event feed reports public actions and solo-player production without showing opponent hands. Larger contextual map targets, legal-site rings and clear confirmation text. Next UX passes should focus on onboarding, trade/cards and full mobile browser testing before 0.8.

## Animated UX (v0.7.3)
State transitions derive a serial presentation queue; bot actions wait for the queue, and human action controls unlock after it. SVG overlays mark production, construction and robber motion. Public trades have a visual exchange stage; hidden cards and theft details remain private. Reduced-motion preference disables moving map overlays, turbo skips presentation, and hidden tabs suspend progression. Future: actual DOM-to-board resource flight paths, camera focus and richer card/award effects. Engine rules are unchanged.

## Cinematic UX (v0.7.4)
Camera follows offscreen public actions without forcing zoom-in; manual pan cancels motion and follow can be disabled. Solo income animates from the receiving building into visible hand slots, with delayed dock count. Card purchases stay face down; played action cards reveal their public type. Separate city silhouette and synchronized queued audio. Reduced motion skips moving effects. Real iPhone and browser end-to-end validation remains pending.

## Game feel (v0.7.5)
Presentation adds paid construction costs before placement, directional public trade transfers in the board event stage, hidden-card theft, CSS dice tumble, human victory confetti, independent optional music volume and haptics on compatible browsers. Original synthesized ambient loop is off by default; background tabs stop scheduled music. Dice animation is cosmetic, not a physical dice simulation. Trade proposals remain static until accepted. Local engine unchanged.

## Interface redesign (v0.7.6)
Home screen separates setup from play; planned expansion roadmap is non-playable. Compact player HUD, resource card hand, board-adjacent build choices, trade preview and sidebar tabs prioritize the map. Mandatory discard/robber/free-road and trade prompts override panel navigation. Contextual rules guide is available without leaving the match. Manual browser/iPhone validation remains pending.

## Persistence and offline (v0.8.0)
Versioned local-storage library stores setup/game state, board seed, preferences and history. Autosave after committed transitions; resume restores without replay and pauses bots. Invalid/incompatible libraries are preserved rather than overwritten. Completed solo outcomes are recorded once and persist after deleting a save. Build-generated scoped service worker precaches the shell and hashed assets; browser controls PWA installation. No account/server. Cross-device sync, export/import and real-device offline testing remain pending.

## Local progression (v0.8.1)
Local profile UUID, derived XP ledger, rank thresholds, one-time achievements, equipable avatar cosmetics. No password/authentication, cloud sync or online service required. Further cosmetic categories are pending. See [design and online boundary](progression.md).

## AI balance (v0.9.0)
Four explicit policies, weighted settlement/resource planning, expert opening lookahead, resource reservation for near-affordable buildings, adaptive trade thresholds and road-award evaluation using the actual incumbent tie rule. Cached board production geometry and lazy hand evaluation reduce redundant work. Frozen 0.8.4 policy under benchmarks enables reproducible comparison with rotating seats and independent dice/deck RNG. This remains heuristic AI, not Monte Carlo tree search; balance and browser/device performance need further calibration. Local progression and rules unchanged.

## Advanced AI (v0.9.1)
Deterministic per-board/seat personalities (Builder, Merchant, Expansionist, Warlord) alter advanced resource goals and trade tendencies; the same seat retains its style after resume. Expert adds a combined road/settlement resource goal, public threat/production-weighted trade partner choice, two-card offers and two-bank-exchange lookahead. The policy still uses masked opponent hands and never reads hidden deck order. Corrected offer limits for Normal/Expert. Benchmark: 200 seeded matches with seat rotation and independent dice/deck RNG, comparing v0.9.0 frozen expert to current expert on 4/6-player maps plus mixed tiers. Heuristic, not full future-turn search; performance on phones and statistical confidence need further validation.
