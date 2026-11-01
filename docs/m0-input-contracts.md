# M0-04 resource and benchmark inputs

## Frozen taxonomy v1.0.0

Kinds: sprite2d, background2d, animation2d, atlas2d, tilemap2d, ui9slice,
vfx2d, audio, font. No glTF/KTX2 or arbitrary scripts.

Roles: actor.player, actor.enemy, projectile.player, projectile.enemy, tile.floor,
tile.wall, tile.goal, tile.number, tile.block, item.box, item.gem, item.collectible,
obstacle.static, ui.button, effect.explosion, audio.hit, audio.music, font.ui,
background.scene. New roles require explicit taxonomy review/version change.

VFX first subset: existing frame sequences only. Approved procedural effect ID
allowlist is empty until reviewed modules and their option schemas exist. This
is an explicit limitation, not implicit shader/script support.

## Benchmark contracts

| ID | Real input | Required presentation | Status |
|---|---|---|---|
| BG-01 | fixtures/game-specs/falling_blocks.json | board.floor, block.cell; existing rules untouched | source validated, full scene NOT_RUN |
| BG-02 | fixtures/game-specs/match3.json | board.floor + each actual color-domain gem slot; UI optional only if declared | source validated, two themes BLOCKED |
| BG-03 | fixtures/game-specs/arcade_shooter.json | player/enemy/bullets; future VFX/audio require explicit extra request | player.main real slice PASS; full game NOT_RUN |
| BG-04 | fixtures/benchmarks/platformer-input.json | orthogonal tilemap, idle/run/jump/fall frames, bottom-center pivot, bounded following camera | independent input fixture only; playable case NOT_IMPLEMENTED |

BG-04 is not a supported game-design archetype and is never routed through the
six-archetype bridge. It must become a real isolated test game before M3. This
file does not claim gameplay implementation or visual acceptance.

## Measured vs proposed budgets

Measured platform: cloud WPE WebKit 26.5, WebGL2, 400×400 buffer,
MAX_TEXTURE_SIZE=16384; one 32×32 PNG; actual slice load time in
`evidence/m0-runtime/report.json`. This is one environment observation only.

2048×2048 atlas / 16 MiB output / eight atlas defaults in the example profile
remain PROPOSED. No phone FPS, decode timing, peak texture memory, WOFF2 or
cross-browser audio capability is certified. M0-04 can freeze only this measured development platform, pending scope
confirmation; phone evidence is deferred to the relevant later runtime gate. GPU maximum texture size is not memory budget.

Two production themes and their human rights + visual approval records are
absent. The deterministic geometry PNG is explicitly experimental Preview
content and cannot be relabeled Production to bypass that blocker.

### Measured development profile proposal

`fixtures/benchmarks/development-profile.json`: PNG/JSON, maxTextureSize=2048,
maxAtlasCount=1, pinned engine SHA, Preview. The separate decoded texture budget
is 16 MiB total with one mip per RGBA8 texture. Allocation, FBO completeness,
far-corner readback and release passed in 22 ms on this environment; see
`evidence/m0-runtime-budget/report.json`. Encoded bundle size is not GPU memory.
The supplied BuildProfile schema has no totalDecodedBytes field: this contract
gap is recorded rather than adding an undocumented field; M2 must explicitly
version/freeze a budget extension before claiming automatic decoded-memory enforcement.

This is a scope proposal awaiting confirmation, not mobile certification.
