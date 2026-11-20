# Founders of Orvane — 1.0 Release Audit

## Scope freeze
- **In 1.0:** complete 3–6-player local base game, human pass-and-play, AI difficulties, rules, tutorial, save/resume, offline PWA, local cosmetics/progression and backup.
- **After 1.0:** major graphical overhaul, online accounts/multiplayer and Navigators expansion.
- A passing synthetic benchmark is **not** a substitute for actual human playtests.

## Automated gates

| Gate | How to verify | Required |
| --- | --- | --- |
| Engine / rules | `pnpm check` | All passing |
| Production build | `pnpm build` | All passing |
| Desktop and mobile browser emulation | `pnpm test:browser` | Both passing |
| Complete-match audit | `releaseAudit.test.ts` | 27 seeded match configurations; baseline vs serialization/reload identical; no illegal actions |
| Save integrity | `persistence.test.ts`, `backup.test.ts` | No duplicate results; malformed backups rejected |
| Local progression | `progression.test.ts`, `challenges.test.ts` | Rewards counted once |
| AI determinism / privacy | `bot.test.ts`, `botBalance.test.ts` | Only public rival information; seeded reproducibility |

## Human QA still required before 1.0.0

These are **manual** acceptance checks and have not been verified solely by the automated suite:

1. **Real iPhone Safari / Add to Home Screen:** install, relaunch offline, pan/pinch, tap small vertices/edges, portrait and landscape; no clipped tutorial, controls or dialogs.
2. **Real Android Chrome:** repeat the touch, PWA, offline and background/resume tests.
3. **Desktop keyboard/mouse:** fit/zoom/pan, move between HUD and contextual panels, hotkeys, pause, tab focus and visible focus rings.
4. **Local multiplayer privacy:** alternate two human seats, ensure only current local hand is shown; test pending offers and pass-the-device prompts.
5. **Human end-to-end match against five bots:** finish at least one full six-player match; confirm progression and victory rewards.
6. **Phase recovery:** save and relaunch during setup, discard on seven, robber movement, unresolved trade, free-road card, paired special action and the victory screen.
7. **Storage recovery:** import/export between two actual devices and confirm profile ID, cosmetic loadout, completed results and exact saved match.
8. **Accessibility:** small screens, contrast, reduced-motion, focus control, screen-reader labels and meaningful status text.

## Release criteria

Do not tag `1.0.0` or claim physical-device compatibility until all automated gates are green **and** the human QA matrix is checked. Record defects with reproduction, seed, platform, and expected/observed behavior. Keep 1.0 focused on stability, clarity and rule correctness.

## 0.9.7 privacy fix
Local pass-and-play now gates every human actor change with a confirm-to-reveal screen. The prior player's hand and hidden victory points are removed from rendered private controls while awaiting confirmation. Verify manually in multiplayer after setup, trade offers and returning to an earlier human seat. Local JSON backups and browser storage remain readable to device owners; do not treat screen privacy as encryption.
