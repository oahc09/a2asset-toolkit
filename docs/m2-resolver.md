# M2-01 deterministic Resolver

Implementation: `src/resolver/index.ts`; dependency-free beyond shared contracts
and Registry types/canonical serialization. Pure function, no network/file reads,
no generation or direct rendering, no approval mutation.

## Input/output freeze

`resolveAssets(input: ResolveInput): ResolveResult` consumes:

- Required `request`, `visual`, `profile` (supplied schemas).
- Optional `theme`, `themes` (inheritance closure), `genre`, `bindings`.
- `registry: RegistryEntry[]` from successful `AssetRegistry.get/list`; original
  bytes MUST have been checked by Registry, never substitute arbitrary JSON as
  authenticated rights evidence. Resolver rechecks metadata/state/digest fields,
  effective-definition derivation and review binding, not human identity.
- `processorCapabilities: {kind, formats[]}[]`, explicitly registered processors.
  No implicit claim of decoder/converter support from file suffix alone.
- Optional `previewFallbacks: {slot: moduleId}` plus `approvedPreviewModules`:
  caller-authorized finite local implementations, not a general script loader.

Result extends Report and adds `success`, `bindings`, `assetBinding`,
`missingRequired`, `missingOptional`, `ambiguous`, `rejectedCandidates` and
`registryDigest`. Actual asset bindings contain assetId, exact version,
`assetSha256` (= immutable **definitionDigest**), `sourceHashes`, `files`, kind,
bindingSource, optional pinned variantId and `placeholder:false`. No definition
hash is mislabeled a source-file hash: the latter are separately returned.

`files` is Registry's immutable source/evidence mapping for trusted Builder use;
it is NOT a public manifest or a whitelist to ship every entry. Builder must
select only used resources, preserve required license texts and exclude private
approval evidence from runtime output.

Preview missing assets can produce `{placeholder:true,moduleId,kind,
bindingSource:'preview-placeholder'}` intent. No synthetic assetId/version is
invented, and these intents are excluded from standard `assetBinding.bindings`.
Builder must reject them in Production and can only invoke the finite approved
module implementation. Resolver itself creates no placeholder bytes.

## Hard checks before priorities

All supplied protocol documents validate their own schemas. Game IDs, visual
and theme IDs, genre IDs and bound slot references must agree. Theme DAG cycles,
missing parent/asset references and conflicting unlocked theme versions fail.
All supplied themes, including unused graph nodes, are checked. Required
GenreKit roles must already exist in request; no gameplay entity is invented.

Candidate eligibility requires published state, exact-bound nonempty explicit
review/evidence hash, redistribution approval and supported license/conclusion.
Preview does not silently use unapproved artwork. Kind/role, real required state
frames, direction, explicit logical size, profile texture ceiling, frozen style/
view/tags, source digests, allowed formats and processor capabilities are checked.
Genre required states augment candidate constraints without modifying gameplay.
Pinned variant must exist, retain exact digest, target profile ID or platform,
and have supported format. Pins never bypass hard checks.

Source metadata must come from actual decoded import. Resolver does not decode
again or certify true pixel dimensions based only on declared numbers. VisualSpec `rules.pixelDensity` is frozen as **source pixels per logical unit**:
geometry.pixelSize[x/y] must equal geometry.logicalSize[x/y] × pixelDensity on
both axes. Missing geometry or unequal axes refuses the candidate; no inference
or implicit resampling. Declared pixelSize must originate from verified decode. Visual palette aesthetics remain human ThemePack review scope.

## Priority and conflict semantics

1. Explicit AssetBinding exact assetId/version/hash (if given).
2. Slot preferredAssetId (never implicitly chooses its latest version).
3. Root ThemePack role candidates, then inherited role candidates (all inherited
   candidates at equal priority, avoiding arbitrary DFS winner).
4. GenreKit defaults.
5. Remaining Registry candidates, restricted by nonempty theme assetIds union.

Hard constraints filter candidates **before** nonexplicit tier selection.
Invalid explicit/preferred choices immediately fail with no fallback. A missing
or incompatible nonexplicit theme candidate may allow a compatible genre/default
candidate with its rejection reason retained.

The supplied schema has no numeric theme-priority attribute. Candidate array
order is not secretly interpreted as one. Multiple surviving same-tier identities
produce E_RESOLVE_AMBIGUOUS and sorted candidates; even byte-identical aliases
require explicit choice (conservative identity lock). No newest-version sort or
lexicographic hidden winner is used. All currently registered formats are native
processor paths; unsupported conversions are rejected, not ranked as fake support.

Required missing slots fail; optional missing emits warning and no dangling
binding. Preview requires both fallbackPolicy and a specific approved module.
All outputs/diagnostics are stable for the same verified snapshot/inputs.
Registry digest includes immutable metadata, source/evidence hashes and approval
snapshot/history; approval changes invalidate it, not just filename or mtime.

## Evidence and limitations

`node --import tsx --test tests/resolver/*.test.ts`: 21 PASS, covering hard
constraints, ambiguity, exact pin/hash drift, missing states, multiple versions,
optional missing, preview/production separation, Theme DAG/missing refs,
priority with incompatible theme candidates, required GenreKit entities,
malformed snapshots, metadata drift and approval-sensitive digest.
`npm run typecheck`: PASS.

Positive test approvals are synthetic test records around synthetic bytes, not
human-approved production artwork or actual processor demonstrations. Full M2
requires real approved Match-3/Shooter assets, processor outputs, build/caching
and runtime evidence; this function test does not pass that gate. Actual artwork
rights/visual review remain external blockers until supplied explicitly.


## Independent review corrections

Independent agent added eight regression/control tests. Seven defects were
fixed: missing/empty evidence digests now require actual own-property 64-hex
values; own slot `constructor` cannot inherit a fake pin; every ThemePack role
reference must match asset role even when unused; GenreKit defaults must name a
requirement and compatible role/kind; premultiplied alpha is explicitly rejected
by current straight-only processor capabilities; explicit pixelDensity is
unsupported rather than silently ignored. All dynamic map lookups now use own
properties. Missing pinned variants already failed and remain a passing control.

Final `tests/resolver/*.test.ts + tests/review/m2-resolver.test.ts`: **29 PASS /
0 FAIL / 0 SKIP**. `npm run typecheck`: PASS. These are synthetic software tests,
not a new human rights approval or full M2 acceptance.


Pixel-density follow-up: explicit ratio validation now supports equal two-axis
pixels/logical units (positive integer schema value). Two new tests use the real
32×32 deterministic M0 PNG: 32px/32 logical units accepts density 1; differing
axes or missing logical/pixel metadata fail. The independent density-999 negative
continues to fail. Resolver unit + independent review: **31 PASS**, typecheck PASS.
