# M0 semantic rule freeze (audit validator, not a production certifier)

Schema validation is deliberately separate from semantic validation. A structural PASS
never implies bytes, rights, references or engine correctness. `validateSemantics`
checks bounded local file evidence for asset-definition and bundle-manifest only.
For other contracts it explicitly returns BLOCKED; Production always returns FAIL or
BLOCKED until complete cross-document context exists. No importer/build system is
implemented before M0 passes.

| Frozen invariant | M0 executable check | Later implementation owner |
|---|---|---|
| Closed objects / correct version / field ranges | nine schemas, ≥1 positive/2 negative each | contracts |
| Source and variant bytes SHA / normalized paths / case collision / no symlink / evidence existence | asset local audit | M1 isolated decoder/importer adds magic/limits/atomicity |
| published rights fields and unknown/custom license refusal | asset local audit; no human approval inferred | M1 review-record state machine |
| State names equal frame mappings / source index | asset local audit | M2 decoded dimensions/frame processing |
| Nine-slice dimension bounds / approved procedural VFX ID | asset local audit | M2 processors |
| Manifest file references, hashes, counts, placeholders, frame rect/trim | bundle local audit | M2 actual decoded rect bounds and budgets |
| required slot exactly once / optionalMissing / capability compatibility | FROZEN, NOT_IMPLEMENTED; no certificate emitted | M2 resolver |
| Theme/Genre references, theme inheritance DAG, same-version conflicts | FROZEN, NOT_IMPLEMENTED; BLOCKED | M1 immutable registry + M4 theme |
| Request theme/visual/profile/lock cross-consistency | FROZEN, NOT_IMPLEMENTED; BLOCKED | M2 resolver/builder |
| Tile index bounds against real tileset, font/audio decode capabilities | FROZEN, NOT_IMPLEMENTED | M2 processors |
| Immutable registry snapshots, full semantic cache keys, approval drift | FROZEN, NOT_IMPLEMENTED | M1 registry/M2 builder |

Limits in the audit reader (64 MiB/file) are defensive local audit limits, not a
validated mobile BuildProfile. It is not a hostile-input decoder or sandbox. Do not
run its filesystem checks concurrently with untrusted filesystem writers; descriptor-
based import isolation and limits belong to M1. Runtime minimal slice checks only
one PNG path; it is not the production Runtime Adapter.
