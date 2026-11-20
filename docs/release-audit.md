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

## iPhone 15 Pro Max retest (v0.9.8)
Observed issue: match feels like a web page and map gestures unreliable on physical iPhone. Fixed in candidate: single-finger pan, two-finger zoom, larger road/vertex hit targets, compact portrait and landscape layouts and PWA safe areas. **Interaction verification reported passed below; launch-mode and offline verification remain pending** in Safari tab and home-screen standalone mode, including board tap vs drag, pinch focal stability, accidental placement prevention, turnbar/dock obstruction, small text, and bottom safe area. Automated simulated WebKit checks are supporting evidence only.

## Physical iPhone acceptance — 2026-11-20

**Device:** iPhone 15 Pro Max. **Tested version:** published v0.9.8. **Evidence:** direct tester report, not browser emulation.

| Check | Result |
| --- | --- |
| Move the board with one finger | Passed |
| Pinch with two fingers to zoom | Passed |
| Select settlements and roads without difficulty | Passed |
| Play in portrait and landscape | Passed |
| Close and resume a saved match | Passed |
| Improved app-like experience versus the previous web-like presentation | Passed |

The tester reported no outstanding issues from these six checks. The mobile interaction blocker is accepted for this device/version. The report does not establish which launch modes were tested, airplane-mode relaunch, physical Android compatibility, a complete human match, all phase-specific recovery paths, or accessibility. These remain separate acceptance items. Do not extrapolate to other devices.

## Release candidate 1.0.0-rc.1

Candidate scope is unchanged from v0.9.8; version and cache identifiers are updated and the pause menu exposes a build label to identify installed versions. No gameplay, persistence schema, or AI changes.

| Gate | Evidence/status |
| --- | --- |
| Previous v0.9.8 automated gates | Passed: 117/117 tests, 26 files, Chromium and WebKit, 27 seeded configurations replayed with/without checkpoint reload (54 matches), 799 checkpoints; CI 44680142102; main deployment 44681219845 |
| iPhone interaction acceptance | Passed on v0.9.8, six checks above |
| Candidate automated gates | Passed: `pnpm check`, `pnpm build`, Chromium and WebKit browser smoke; [CI 44686110039](https://github.com/rgcb01/founders-of-orvane/actions/runs/44686110039) |
| Home-screen installation and offline play | Passed per tester report; exact device/build label, offline cold relaunch and standalone orientation checks not separately confirmed |
| Physical Android Chrome touch/PWA/offline/background | Pending |
| Desktop physical mouse/keyboard and accessibility | Pending |
| Human pass-and-play with private trade responses | Two-human same-device play passed; private handoff and pending trade privacy detailed checks not confirmed |
| Full human-versus-five-bots match and rewards | Passed per tester report; history and duplicate reward check after reload not separately confirmed |
| Physical special-phase recovery and cross-device backup | Basic match export/import passed; special phases, cross-device transfer and profile/history parity not confirmed |

Final release remains gated by the outstanding manual checks. Retest affected behavior if any functional change is introduced during RC stabilization.

## RC acceptance execution checklist

RC merged in PR #29, commit `712fe28a6ffd04c2874f62d81485595880589f6b`. Main deployment [44689314627](https://github.com/rgcb01/founders-of-orvane/actions/runs/44689314627) was in progress when this evidence was recorded. Verify deployment success and the pause-menu build label before starting physical tests.

Record Pass / Fail / Not tested for each item, with device, build, browser and launch mode. Do not infer acceptance from silence.

- [ ] iPhone Safari: install to home screen, open once online, enable airplane mode, close and relaunch, resume a match; confirm touch and safe areas in both orientations.
- [ ] Android Chrome: repeat install/offline, touch, orientation and background/resume.
- [ ] Desktop: mouse and keyboard navigation, camera, hotkeys, focus visibility and panel operation.
- [ ] Local multiplayer: alternate two humans; inspect hand visibility before and after handoff, including trade offers.
- [ ] Complete one human vs. five bots match; check history, rewards and XP once, including after reload.
- [ ] Save and restore all special phases specified in the human QA matrix, comparing the board, turn and legal actions.
- [ ] Export/import backup on two devices; confirm profile, cosmetics, match and history (back up target data before replacing it).
- [ ] Accessibility: contrast, reduced motion, keyboard focus, screen-reader labels and small-screen layout.

No release gate is waived. Do not promote to stable until these manual checks are recorded and the stable build passes CI.

## Tester report — 2026-11-20

The tester reported testing the Orvane RC with these six successful checks. The report explicitly does not confirm other tests. Exact installed build label, device/browser and launch mode were not included in this report. Earlier iPhone 15 Pro Max results are recorded separately above. At the time of recording, GitHub reported main deployment 44689314627 still in progress, so the installed build must be verified before treating these results as definitive RC-specific acceptance.

| Reported check | Result |
| --- | --- |
| Install game to home screen | Passed |
| Open and play without internet | Passed |
| Complete a game against five bots | Passed |
| Receive XP and rewards correctly | Passed |
| Play with two humans on the same device | Passed |
| Export and import a match | Passed |

All other manual checks remain unconfirmed, including Android, desktop keyboard/mouse and accessibility, private trade/handoff, exact phase recovery, cold offline relaunch, cross-device profile/history parity and reward idempotency after reload. The broader checklist above remains open wherever a compound check has unverified components. No stable release gate is waived.
