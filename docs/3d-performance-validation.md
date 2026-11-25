# 3D performance validation — 1.2 beta

## Reproducible synthetic benchmark

From a clean checkout with Node 22 and pnpm 10:

```sh
pnpm install --no-frozen-lockfile
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm benchmark:3d --quick
pnpm benchmark:3d
pnpm benchmark:3d --baseline=path/to/previous-results.json
```

Use Ubuntu 24.04 for the pinned Playwright version. The quick suite covers
3/6-player desktop low/high quality. The full suite covers 3–6 players,
desktop and phone portrait/landscape, low/medium/high/auto (48 cases).
Results are written to `artifacts/benchmark3d/results.json` and uploaded
by the 3D benchmark workflow. Record the tested commit and retain the raw JSON.

Compare only equivalent environments, seed, profile and quality. Software
WebGL measurements characterize CPU submission, cadence and scene complexity;
they are not native GPU timings, actual VRAM bytes, or phone battery tests.
Do not claim a speedup until matching baseline and candidate data exist.

## Long-session release gate (manual)

Run a six-player standard-rules extended-board match, one human and five
expert bots, on desktop and physical iPhone. Repeat with normal and turbo
pace; use auto quality. Continue for at least 30 minutes or a completed
match, whichever takes longer. Record OS/browser, build SHA, temperature
conditions, display orientation, starting/ending battery percentage and
any observed browser reload or thermal warning.

- Verify placement, city upgrades, road construction, robber selection,
  trades and production animations; compare game state before/after save.
- Zoom, pan and rotate repeatedly; change orientation and graphics quality.
- Pause/resume, background/foreground the app, and recover a saved game
  after a full application close. Verify no unexpected SVG fallback.
- Record frame/ambient/shadow counters, texture and geometry counts,
  and draw calls after setup and at regular intervals. Use
  `?benchmark3d=1` only for diagnostic runs; it adds sampling overhead.
- Distinguish expected object growth as pieces are placed from unbounded
  resource growth on unchanged boards. Record reproducible steps for
  any failures.

Release acceptance: automated checks and benchmark pass; no data loss,
unhandled exceptions, unexpected context loss, or blocked legal actions;
physical-device responsiveness accepted by tester. This protocol is
not evidence that the tests have already passed.
