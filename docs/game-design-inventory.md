# M0-01 / M0-02: game-design source inventory and asset bridge

Audited 2026-11-01 from `https://github.com/oahc09/game-design`, main revision
`637e383783123d97bc05b235f1a5be125a9faba1`. This is a pinned compatibility claim,
not a promise about future main. No upstream source was modified. No AGENTS.md
was present in this checkout. Upstream license is MIT, copyright 2026 oahc09.

## Verified paths / exports

| Path | Actual API / data | A2Asset use |
|---|---|---|
| `schemas/gameplay.schema.json`, `src/core/gameplay-schema.mjs` | `schema_version: "0.1"`, `metadata.id`, `game.archetype`, `content.extensions` | Not A2Asset's schema; keep original bytes |
| `src/core/validate.mjs` | `validateSpec(spec, registry)` returns status/issues/gates | Mandatory source-validation callback before mapping; runs extension/content/action-domain checks |
| `src/archetypes/index.mjs` | `registry`, `getArchetype(id)` | Six source archetypes and reference runtime registry |
| `src/framework/generation.mjs` | `materializeSpec(spec, content, seed=1)` | Rebinds action domains after content changes; bridge **does not call** it or generate new rules |
| `src/adapters/web.mjs` | `WebAdapter`, `manifest`, `differential` | Shared gameplay logic; constructor validates, `reset`, `applyAction`, `captureAuthoritativeState` available |
| `web/player/player.mjs` | `draw`, GraphicsComponent, Label, `createAirApp`, `createUICanvas` | Existing renderer draws geometric cells/circles, not a native asset manifest consumer |
| `examples/<archetype>/spec.json` | Six reference GameSpecs | Copied byte-for-byte to `fixtures/game-specs`; per-file SHA in `SOURCE.json` |

`WebAdapter.manifest` calls itself web-cocosair, but its headless differential test
is explicitly not browser texture/visual evidence. No M7 research qualification
is inferred. No existing `GameAssetRequest`/slot field was found in these six
GameSpecs: the mapping below is an A2Asset-owned presentation convention.

## Frozen display mapping v1

All slots are `sprite2d`, required, states exactly `["idle"]`, fallback `none`.
No idle frame is mislabeled as a hit/death animation. No texture size, asset ID,
font, sound, theme, or direction is inferred from game rules. Geometry scale,
number text, current positions, scoring, collisions and input remain upstream
runtime/presentation responsibilities; a slot identifies a reusable resource,
not one runtime entity or one distinct animation state.

| Archetype | Slot → role | Real source selector |
|---|---|---|
| sokoban | board.floor → tile.floor; board.wall → tile.wall; board.goal → tile.goal; box.main → item.box; player.main → actor.player | map characters under `content.extensions.sokoban.map` |
| match3 | board.floor → tile.floor; gem.color-N → item.gem for 0 ≤ N < colors; board.blocker → obstacle.static only when nonzero blockers exist | `colors` covers refill domain, not only initial board; `blockers` matrix |
| merge2048 | board.floor → tile.floor; tile.number → tile.number | size/board/spawnDistribution; numbers remain text overlays rather than fabricated numbered sprite inventory |
| block_puzzle | board.floor → tile.floor; block.cell → tile.block | shape cell arrays and board; shape rotations/layout remain source-owned |
| falling_blocks | board.floor → tile.floor; block.cell → tile.block | initialBoard/activePiece derived by source runtime; no gameplay duplication |
| arcade_shooter | player.main → actor.player; enemy.main → actor.enemy; bullet.player → projectile.player; bullet.enemy → projectile.enemy if enemyFireIntervalTicks > 0 | player/enemy/projectile fields under `content.extensions.arcade_shooter` |

`metadata.id` maps unchanged to `gameId`; `game.archetype` maps unchanged to
`genre`. The six checked-in requests are generated from the six original inputs
using the actual pinned upstream validator, not manually asserted JSON examples.

## Executable entry and rejection rules

`src/bridge/game-spec.ts`: `mapGameSpec(spec, validateSource)` is a synchronous
pure bridge. Caller supplies `s => validateSpec(s, registry)` from the pinned
upstream; source-validator imports are not bundled into A2Asset Core. Validation
is mandatory, and a clone is passed to prevent validator mutation of original
rules. Result uses schemaVersion/status/diagnostics/artifactPaths and only a
successful result contains a request. This boundary API is **not** a replacement
for the upstream game validator: a trusted integration must not pass a fake
always-PASS callback.

Reject unsupported schema version/archetype, custom top-level or content
extensions, inconsistent design/game/content archetypes, missing source
validation, failed source validation and IDs that would require rewriting.
Mapping currently caps match3 color slots at 64 to bound output; larger domains
are explicitly unsupported even if a future upstream allows them. Diagnostics
have JSON Pointer paths and remediation. No implicit asset download, arbitrary
script, AI generation, or source modification is available.

## Actual verification

From this repo (Node v24.22.1):

```sh
GAME_DESIGN_ROOT=../a2asset-upstream/game-design npm run test:bridge
```

Observed: **11 tests PASS, 0 failed, 0 skipped**. Six original inputs passed actual
upstream `validateSpec`; six deliberately broken action-space variants failed.
Requests pass supplied Draft 2020-12 schema, deterministic snapshots, source
immutability, capability failures and conditional slot coverage are tested.
The integration test asserts exact upstream Git SHA before execution. Without
`GAME_DESIGN_ROOT`, that integration case is explicitly SKIP; unit seam stubs
are labeled as such and never presented as gameplay conformance evidence.

## Gaps / boundaries

- BG-04 platformer is not one of these six reference archetypes; it remains an
  independent minimal acceptance case, not falsely mapped to another genre.
- Sprite/pivot/state lifecycle and graphical scene replacement are runtime
  adapter responsibilities. These mapping tests alone do not pass M0-05/G3.
- Source defaults and gameplay evolution stay in game-design. A new upstream
  revision requires renewed compatibility validation rather than silently
  broadening this mapping.
- M0 source/reference evidence does not prove approved production artwork or
  human visual sign-off; no assets are authorized by copying these MIT specs.
