# Orvane 1.2 — 3D renderer
Experimental branch; keep main SVG renderer playable. No game rule, save format or RNG changes.
## Milestones
1. Establish bundled Three.js dependency with reproducible pnpm lockfile; verify offline caching and WebGL2 availability.
2. Read-only scene using actual Board data, tilePosition and vertexPosition. Hexagonal prisms, matte terrain, orthographic camera, ocean plane and lightweight lighting.
3. Add original procedural terrain meshes, instanced trees and rocks, buildings, roads, ports and number tokens. Preserve cosmetic identities.
4. Map raycast hits to existing legal tile/edge/vertex identifiers, reuse existing confirmation and action handlers. Touch pan and pinch; no accidental actions during gestures.
5. Connect visual event queue, animation and camera follow without changing engine timing or hiding private information.
6. Integrate responsive HUD and retain SVG fallback for low-end devices and context loss.
7. Verify deterministic rules, saves, offline cold launch, accessibility, desktop and physical iPhone/Android. Target 60fps, measure rather than assume. Cap pixel ratio, avoid continuous rendering when idle, release GPU resources on unmount.
## Design
Matte low-poly miniature board, warm resource colors, restrained lighting, readable number tokens. No photorealism or heavy postprocessing.
## Release
Opt-in experimental renderer first. Do not replace default until validation passes. The existing 1.1 mobile changes still require regression and physical checks.
