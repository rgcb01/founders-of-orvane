# Local progression and optional online boundary

## Approved direction
Local-first, no login or backend required. Email/password, account recovery, cloud saves and cross-device progression are deferred, separately optional. No Supabase project or credentials in the build. Online multiplayer is also independently optional.

## Local profile (0.8.1)
One stable UUID per browser installation, editable name and equipable earned avatar. Versioned profile record separate from the versioned match library. Existing saves stay readable. Match results carry stable match ID, optional profile ID and recorded difficulty. Legacy solo results count toward completion and achievement XP, but no unknown difficulty bonus. Pass-and-play is excluded from XP until seat-to-profile identity is specified.

XP is derived from deduplicated completed solo result IDs, not incremented on screen entry. 100 completion XP; win bonus easy 50, normal 100, hard 200, expert 350. One-time achievement XP. 1,000 XP per level, rank thresholds 1/10/20/30/40/50. Avatar unlocks at 1/2/10/20/30/40/50; only unlocked cosmetics can equip. No gameplay advantages. Further collections, dice, card backs, board themes, music and challenge design remain future work.

## Future account adapter
Treat local profile UUID and authentication subject as separate identities. Bind a local profile to an authenticated account only with explicit consent. Keep serialized schema versions, stable event/result IDs and timestamps; server-side idempotency and conflict reconciliation are needed. Never send password data through local profile storage. Local history is unverified client data: imports may be accepted for personal cosmetics, but competitive rankings or verified XP require authoritative match evidence. Use a separate storage/sync adapter (candidate Supabase Auth + PostgreSQL with row-level security), not a dependency of engine or local UI. Offline remains fully playable. Account recovery and verified email require provider setup. No cloud or password functionality is implemented now.
