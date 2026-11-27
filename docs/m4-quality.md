# M4 objective quality evaluator (not a gate completion certificate)

Source: taskbook §11, §13 and M4-01..04. The supplied nine protocol schemas do
**not** include QualityReport/visual-review JSON Schema. This module provides
local TypeScript interfaces over existing `Report`; it does not alter or invent
an upstream schema. M4-01 theme DAG/reference checks remain in Resolver.

`evaluateQuality(input, trust?)` is pure: no file access, screenshot generation,
network, artwork edits, AI assessment, or approval creation. The caller supplies
actual PNG/log bytes, game/theme/build/gameplay/engine identities, both rights
and visual review references, human decision/reviewer/time/difference/tolerance,
frozen device budgets and measured results. PNG CRC/decode and byte hashes are
checked, bounded to 16 MiB / 2048² pixels. Required visual-rule observations are
palette, view angle, outline, pixel density, safe area. Required runtime scenario
observations cover common display/animation/collision/audio/release plus the
benchmark-specific UI, swaps, explosion, camera, tilemap and pivot checks.

Absent screenshots, actual benchmarks, reviews, measured baselines, scenario
observations or authentication are BLOCKED. Bad bytes/digests/identity, rejected
review, failed objective gate or violated measured threshold is FAIL. All four
BG identities are required; BG-02 must show two different themes on the same game
and unchanged gameplay SHA. A schema-valid example alone is never sufficient.
Thresholds are mandatory caller-supplied frozen measured baselines, not default
FPS promises. The evaluator does not certify mobile performance by itself.

## Trusted host boundary

A pure function cannot distinguish a genuinely signed human review or browser
capture from fabricated metadata. `verifyTheme`, `verifyReview`, `verifyRun`, and
`verifyBaseline` must be provided by an independently trusted host that resolves
real persisted evidence and its authorship. No callback means BLOCKED. Refusal
means FAIL; verifier outage/throw means BLOCKED. Callbacks are **not cryptographic
signatures or an identity service**, and untrusted input must not supply them.
A caller that installs always-true callbacks destroys this trust boundary.
Unit fixtures explicitly do this only under SYNTHETIC TEST labels to exercise
branches; those fixtures do not represent real approval or actual runtime.
Even a PASS return has `productionAuthorized: false`: it cannot replace Registry
rights transitions, build validation, browser execution or a release decision.

## Six-class coverage

`summarizeCoverage` validates the actual request protocol and counts slots,
real bindings (never placeholders), required missing slots, missing rate
`(total-bound)/total`, and reuse rate `(bound-distinct assetId@version)/bound`.
This is a descriptive slot-level reuse metric, not a claim of rendering or
rights approval. Missing one of the six upstream genres or any required slot
is BLOCKED. Duplicate game requests fail rather than inflate statistics.
The six checked-in GameSpec-derived request fixtures are used in real tests;
no fictional platformer was added to upstream game-design.

## Evidence / remaining work

`node --import tsx --test tests/quality/*.test.ts`: 8 PASS, no skips.
`npm run typecheck`: PASS. No genuine visual approval or actual four-browser-
game evidence has been supplied by this implementation. M4 remains BLOCKED;
this software component does not skip M3 or claim M4 completed.

### Independent review closure

Parent review found and tests reproduced three issues before correction:
explicit false scenario/visual observations were treated as unavailable;
empty runtime input left G0/G1 green; malformed raw binding identities could
inflate coverage. All are corrected: observed false/invalid values FAIL while
absent fields BLOCK; no runs makes G0/G1 BLOCKED. Coverage accepts the Resolver
binding map, projects common fields through the existing asset-binding schema,
requires matching resolved kind, rejects unknown slots/fields and floating
versions, and never counts placeholders. A bare schema pin without kind is
insufficient compatibility evidence and remains BLOCKED rather than guessing.

Latest quality suite: **12 PASS / 0 FAIL / 0 SKIP**. Four new regressions include
a positive resolved-map counting control. This still does not authorize any
production resource or constitute an actual signed visual review.

### Final frozen checkpoint — 2026-11-01 13:54 UTC

Parent independent review accepted the three corrections. Re-run: quality
**12 PASS / 0 FAIL / 0 SKIP**. Global `npm run typecheck` is currently **FAIL**
only at `tests/runtime/adapter-guards.test.ts:5` (Uint8Array Response BodyInit),
owned by the parallel runtime work; no quality TypeScript error remains.
Do not substitute the earlier pre-runtime typecheck PASS for this current result.
`src/quality/index.ts` SHA256:
`605e6d844dd8de2fb60935a74365885a3656eb9fe467183aaa4ef19e75c8d8dc`.
Quality scope frozen; real M4 visual/rights/runtime acceptance remains BLOCKED.

## Actual six-game request inventory

`evidence/m4/six-game-coverage.json` records all six pinned real upstream fixture
requests and their hashes: 20 required display slots, 0 currently bound to actual
approved production assets, 20 missing. This is an honest BLOCKED inventory,
not six approved games and not the later 50-sample acceptance. Technical synthetic
fixture registries deliberately do not fill these production counts.
