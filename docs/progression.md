# Local progression and optional online boundary

## Approved direction
Local-first, no login or backend required. Email/password, account recovery, cloud saves and cross-device progression are deferred, separately optional. No Supabase project or credentials in the build. Online multiplayer is also independently optional.

## Local profile (0.8.1)
One stable UUID per browser installation, editable name and equipable earned avatar. Versioned profile record separate from the versioned match library. Existing saves stay readable. Match results carry stable match ID, optional profile ID and recorded difficulty. Legacy solo results count toward completion and achievement XP, but no unknown difficulty bonus. Pass-and-play is excluded from XP until seat-to-profile identity is specified.

XP is derived from deduplicated completed solo result IDs, not incremented on screen entry. 100 completion XP; win bonus easy 50, normal 100, hard 200, expert 350. One-time achievement XP. 1,000 XP per level, rank thresholds 1/10/20/30/40/50. Avatar unlocks at 1/2/10/20/30/40/50; only unlocked cosmetics can equip. No gameplay advantages. Further collections, dice, card backs, board themes, music and challenge design remain future work.

## Future account adapter
Treat local profile UUID and authentication subject as separate identities. Bind a local profile to an authenticated account only with explicit consent. Keep serialized schema versions, stable event/result IDs and timestamps; server-side idempotency and conflict reconciliation are needed. Never send password data through local profile storage. Local history is unverified client data: imports may be accepted for personal cosmetics, but competitive rankings or verified XP require authoritative match evidence. Use a separate storage/sync adapter (candidate Supabase Auth + PostgreSQL with row-level security), not a dependency of engine or local UI. Offline remains fully playable. Account recovery and verified email require provider setup. No cloud or password functionality is implemented now.

## Collections (0.8.2)
Seven themed collections (Classic, Viking, Imperial, Pirate, Winter, Dragon, Celestial), four slots each: dice, card backs, board sea palette, title. Four achievement rewards. Stable IDs and optional loadout preserve legacy profiles and future sync. Unlocks derive from existing XP/achievements, not purchases; equipped IDs are revalidated on render. Global presentation themes affect dice and the public board, not seat color or terrain readability. Pieces and music customization remain future work. No network dependency.

## Cosmetic expansion (0.8.3)
Six additional slots per collection: settlement, city, road, robber, ambient music and effects. 74 catalog items total. Existing four-slot loadouts migrate through default fallback. Player-owned pieces are customized for solo seat 0; other seats keep standard silhouettes and all pieces retain ownership colors. The robber has a blocked-production marker in all themes. Ambient motifs are original synthesized loops, off unless music is enabled. Effects alter accent colors only; no rule changes.
