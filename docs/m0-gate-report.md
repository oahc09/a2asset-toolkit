# M0 engineering gate report — 2026-11-01

## Completed with actual evidence

| Task | Result | Evidence |
|---|---|---|
| M0-01 actual upstream API/GameSpec inventory | PASS (documented limitations) | compat-inventory.md, two detailed inventories, pinned source SHAs |
| M0-02 six real prototype requests | PASS | 6 exact upstream fixtures, pure bridge, 11 tests including real upstream validator |
| M0-03 nine schemas, ≥1 positive +2 negative, semantic rules | PASS for M0 contract audit scope | 27 structural cases + semantic regressions; full rule matrix explicitly records later implementation |
| M0-04 taxonomy, benchmark inputs, platform budget | PARTIAL / scope decision pending | m0-input-contracts.md; 4 inputs; current-machine texture/PNG probe |
| M0-05 real engine resource-loading slice | PASS | WPE WebGL2 PNG pixels `[40,220,180,255]`, zero GL/page errors, resources disposed |

Latest aggregate: **50 TypeScript tests + 5 runtime guard tests PASS; 0 fail / 0 skip**
when run with the pinned game-design checkout. Typecheck and whitespace check PASS.
Independent review identified four false PASS cases; all have regressions and were
fixed as FAIL or accurately BLOCKED. The local semantic checker cannot certify
Production or missing cross-document context.

## Gate decision: BLOCKED pending baseline decisions, not engine feasibility

M0-04's device profile is proposed as **current cloud WPE WebGL2 development-only**:
1 × 2048² RGBA8 texture, one mip, estimated decoded total 16 MiB, PNG/JSON only.
Actual allocation/readback/release passed. This is not the original unmeasured
8-atlas profile and not a promise for phones. Physical phones/other browsers are
later runtime verification items, not independently mandatory M0 conditions.

Taskbook §18 asks for a decision on source mapping, real SDK capabilities, two
human-approved rights-clear themes/G2 references, and device budgets before the
whole specification becomes Implementation Baseline. §14's engineering M0 gate
permits explicit hard-blocker limitations, while actual Production and G2 tests
belong to M2/M4. We do not silently resolve that scope distinction in our favor.
Pending decision: accept this limited development profile and defer missing
production themes to their dependent gates, or supply broader target requirements.
Until resolved, no M1 implementation has begun; no v1.0 completion is claimed.

## Required production inputs (not replaced by the Preview triangle)

For each of two visual themes: original source files; author/source URL; full
license or ownership evidence; explicit redistribution/modification conclusion;
reviewer and dated approval; eventually G2 reference image and actual scene
review tied to build SHA. Do not send credentials or commercially restricted art
for public redistribution. A designated human signs rights and visual decisions.
The code-drawn fixture is not AI artwork but is still not a human approval record.

## Remaining / NOT_RUN

- BG-04 currently independent acceptance input, not a playable platformer.
- Full production resolver/build/registry/CLI/adapter are NOT_IMPLEMENTED (M1–M5).
- Media playback, WOFF2 glyph fidelity, multi-state animation, full atlas trim,
  four playable game scenes, phone/cross-browser memory/FPS: NOT_RUN.
- G2 human review and production theme approval: BLOCKED on inputs/reviewer.
- No Actions, release, npm publish, deployment, upstream modifications or merge.

## Dependency check

Initial AJV 8.17.1 audit reported GHSA-2g4f-4pwh-qvx6 (`$data` ReDoS). Although
`$data` is not enabled here, the direct dependency was explicitly pinned to
8.18.0 and the lock updated, then checks rerun. See dependency-audit.json; no
blanket `npm audit fix` or unrelated dependency upgrade was used.
