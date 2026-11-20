# Orvane visual direction — 1.1 prototype

Approved direction: minimalist low-poly. Matte colors, simple geometry, readable number tokens, clear player colors, no gold medieval ornamentation or photographic textures.

## First implementation
- Original procedural vector terrain art for all six terrain types, with lightweight flat facets.
- Softer board palette, sparse water strokes and shaded classic building pieces.
- Subtle water opacity animation disabled when paused, hidden, in Turbo or reduced motion.
- Construction landing and production pulse use existing event duration and presentation pipeline.
- Existing SVG camera, touch hit targets, topology, game rules, cosmetics and save compatibility are retained.
- This is 2.5D vector artwork, not a WebGL renderer. A real orthographic 3D renderer is a separate decision based on physical-device performance.

## Acceptance
- Typecheck, unit tests, production build, Chromium and WebKit smoke pass.
- Confirm six terrains are distinguishable at fit and zoom; tokens, pips and legal build sites remain readable.
- Test pan/pinch, road and vertex selection and all player colors on physical iPhone.
- Check all existing cosmetic styles, paused/hidden/Turbo and reduced-motion behavior.
- Compare frame timing on desktop and physical mobile before further graphics work; do not claim 60 FPS without measurement.

Next: dedicated resource icons, ports and robber art; then HUD and card art. Keep the stable 1.0 release independent and do not merge visual changes until the 1.0 acceptance gate is resolved.
