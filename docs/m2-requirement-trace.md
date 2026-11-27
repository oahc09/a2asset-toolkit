# M2 requirement trace — implementation vs verification vs external input

Checkpoint: 2026-11-01 13:45 UTC. Taskbook §6/§14, latest supplied v1 baseline.
This file is a scope audit, not a release certificate. Parallel integration may
close gaps after this timestamp; update evidence rather than reclassify silently.

| Task | Implemented evidence | Remaining classification |
|---|---|---|
| M2-01 Resolver | src/resolver; request/schema/crossrefs, published exact review, states/role/direction/size/density, priorities, no-latest/no-pin-fallback, optional warnings, explicit Preview intents | 31 actual unit + independent review PASS. Theme visual artistry still needs human approval; identity/authorship not model-certified. |
| M2-02 PNG/WebP + Sprite/Atlas | synchronous PNG, async WebP full decode + deterministic PNG; state/clip, trim/pivot, padding/extrusion, decoded bounds | Actual processor tests PASS. One-page/no rotation is explicit bounded support, not an unimplemented promise of unlimited atlas packing. |
| M2-03 UI/font/audio | nine-slice; WOFF2 actual cmap + all glyph outlines; WAV/OGG/MP3 full bounded PCM decode; actual tool versions | Actual codec tests PASS. Cross-browser decoding/playback/font layout/autoplay not certified by offline tools: M3/device-matrix verification gap, not claimed PASS. |
| M2-04 Builder/DAG/cache/atomic | source and approval snapshots in cache/fingerprint; trusted cache receipts, real DAG timings, cancellation, budgets, Manifest/Lock/NOTICES, prior-output preservation | Reviewed failure paths PASS. Actual incremental one-Sprite-change/unrelated-WAV-non-reprocess integration test now PASS in tests/builder; Builder suite 8 PASS. |
| M2-05 CLI/SDK | inspect/import/registry plus resolve/build/validate using same implementation; JSON stdout and structured exit codes | CLI --themes inheritance closure and --preview-config explicit module inputs implemented; independent CLI options suite 4 PASS (positive inheritance, cycles/missing parent, Preview/Production isolation, policy and invalid config). |
| M2-06 Tilemap/VFX | bounded orthogonal JSON + PNG tileset, index/size/layer/ref safety; real frame VFX, arbitrary script parameters refused | Processor positives/negatives PASS. BG-04 playable platform sample and shooter VFX input through real game chain still require integration/runtime verification; no existing game-design platformer is invented. |
| Gate M2 | automated pipeline mechanisms exist and synthetic fixtures exercise positive builds | Real approved Match-3 and Shooter sample asset builds are not established. Gate remains NOT_PASSED until actual authorized input and required verification exist. |

## Actual checkpoint runs

- `node --import tsx --test tests/resolver/*.test.ts tests/review/m2-resolver.test.ts`:
  **31 PASS / 0 FAIL / 0 SKIP**.
- `node --import tsx --test tests/processors/*.test.ts`:
  **30 PASS / 0 FAIL / 0 SKIP**. Includes 10 actual WebP/audio/font tests and 20
  PNG/atlas/nine-slice/tilemap/frame tests; no media decoder result inferred from
  file magic alone.
- Prior Builder checkpoint: 15 PASS, typecheck PASS, documented independently in
  `review-m2-builder.md`. Re-run integration after media changes before adopting
  that count as the latest complete build evidence.

## Do not collapse different blockers

### Software work still independently actionable

Theme-closure/explicit-preview CLI inputs and targeted incremental Sprite/WAV
measurement are now closed with actual tests, not deferred to human approval.
SDK extraction review found and implementer repaired the variant codec allowlist.
Direct SDK suite now 6 PASS including WebP variants both with explicit MIME and
without MIME (controlled extension selection followed by actual decoding).
No remaining software defect from this narrow follow-up; this does not eliminate
the integration/runtime verification and genuine human approval requirements below.
These do not require a human artist or remote environment and should not be
reported as blocked solely by missing artwork approvals.

### Verification still required

Run actual BG-02/BG-03 build inputs, BG-04/shot-effect pipeline inputs, actual
runtime load/animation/audio/font/lifecycle and browser/device codecs. Some are
later M3 gates, but M2 must not use standalone codec fixtures as evidence of
those complete gameplay paths. Inspect actual baseline/profile/hardware evidence
before promising FPS, memory or mobile compatibility.

### External approvals / input (cannot fabricate)

Two genuinely approved asset/theme sources, complete rights evidence and an
actual human reviewer decision bound to source hashes are not supplied by
synthetic test approvals. Required game scene mappings, visual references and
G2 human review cannot be invented. Existing DejaVu license/cmap tests establish
that test font's provenance, not that two complete production game themes have
been human-approved. No AI generation or commercial screenshot copying is used.

### Explicit restricted scope, not silent gaps

No arbitrary asset scripts, no procedural VFX provider beyond finite reviewed
modules, no non-sRGB/premultiplied conversion, no implicit geometric scaling,
no generalized Tiled input, no unbounded atlas page count. Every such unsupported
input must fail visibly. Pixel density is now implemented as declared two-axis
pixels-per-logical-unit equality, not permanently marked unsupported.

## 13:44 independent follow-up

`node --import tsx --test tests/review/m2-cli-options.test.ts tests/review/m2-sdk-import.test.ts tests/builder/*.test.ts` initially 17 PASS before addition of the sixth SDK codec-variant regression. `npm run typecheck` PASS. SDK first five checks verify decoded MIME/dimensions, idempotency, cancellation, hash integrity and no automatic approval. The new sixth case exposes a legitimate supported-format variant rejection, not an approval bypass; parent notified for correction.

### 13:45 repair verification

CLI options + direct SDK import: **10 PASS / 0 FAIL / 0 SKIP**, including both explicit-MIME and optional-MIME WebP variant imports. `npm run typecheck` PASS. Earlier 5/1 failure above is historical pre-fix evidence and no longer an open defect. Scope frozen for parent full-suite checkpoint.
