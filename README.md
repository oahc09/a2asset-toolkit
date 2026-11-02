# A2Asset Toolkit

Offline-first TypeScript asset contracts and engineering audit for game JSON →
licensed resource bundles → CocosAirJS. **Current stage: M2 implementation, not a v1.0 product.**
No AI artwork generation/editing, web scraping, SaaS or engine repository changes.

## Run the current checks

```sh
npm ci
npm run typecheck
npm test
node --test tests/runtime/*.test.mjs
# Include the actual pinned game-design validator, rather than skip that integration:
GAME_DESIGN_ROOT=/path/to/game-design npm run test:bridge
```

Read [compatibility inventory](docs/compat-inventory.md),
[taskbook](docs/spec/taskbook-v1.md), [semantic scope](docs/semantic-rule-matrix.md)
and [source baseline](docs/source-baseline.md). The schemas/examples were supplied
with the taskbook. `SCHEMA_ONLY`/`UNPUBLISHABLE` fixtures are not approved assets.

The real browser slice uses an externally supplied pinned SDK and local Playwright;
see [engine audit](docs/cocosair-inventory.md). Its one-sprite success is neither a
complete game nor human visual approval. It does not silently download an SDK.

## Current interfaces

- `validateContract(name, input)`: structural JSON Schema Draft 2020-12 validation.
- `validateSemantics(name, input, {root, mode})`: bounded **M0 local audit only**;
  unsupported cross-document and all Production certification returns BLOCKED.
- `mapGameSpec(spec, sourceValidator)`: pure six-archetype presentation bridge;
  source validator must be the pinned upstream implementation, not a test stub.

All return structured status/diagnostics. Offline import/registry/explicit review,
constraint resolution, deterministic media processing and atomic bundle builds
share the same SDK/CLI; see [CLI](docs/cli.md), [processors](docs/m2-processors.md)
and [requirement trace](docs/m2-requirement-trace.md). No production Runtime Adapter,
automatic licensing or v1.0 release is certified. Actual approved BG-02/BG-03
asset builds and human theme/G2 decisions remain unverified; synthetic test
approvals are not production evidence.

## Licenses and provenance

Repository: MIT. Imported game-design fixtures preserve their upstream MIT notice
and exact revision in `fixtures/game-specs/SOURCE.json`. The tiny geometry PNG is
reproducibly drawn by `scripts/m0-runtime-fixture.mjs`, Preview feasibility only;
no human production rights/visual approval is inferred. Dependency versions are
locked in `package-lock.json`; no npm publication or deployment is performed.

M1 baseline authorization and retained scope: [decision](docs/implementation-baseline.md).
