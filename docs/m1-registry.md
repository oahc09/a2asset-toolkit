# M1-01 / M1-03 local Registry and explicit rights state machine

Implemented in `src/registry/index.ts`; no network, generation, credentials,
external approval service or new dependency. Repository license remains MIT.

## API

```ts
const registry = new AssetRegistry(root);
registry.importDefinition(definition, files: Map<string, Uint8Array>);
registry.get('asset.id@1.0.0');
registry.list({ kind, role, status });
registry.transition(key, 'inspected');
registry.transition(key, 'approved', explicitReviewRecord);
registry.transition(key, 'published', explicitReviewRecord);
registry.renderNotices([key]); // deterministic public credit text; published only
registry.readBlob(sha256); // { report, bytes? }
```

All operations return structured schemaVersion/status/diagnostics/artifactPaths
reports, plus assetKey/record/records where applicable. Constructor only stores
an absolute root path; operations validate/create the private local root.
`record.definition` is immutable source metadata. `record.effectiveDefinition`
is derived from append-only review history for downstream matching; original
metadata is never rewritten. `record.state`, `currentReview`, `definitionDigest`,
`files` and `history` are explicit. Read results are detached JSON snapshots.

Import only accepts `imported` or `quarantined`, never caller-provided approved
or published status. Every source, variant and license evidence file must be
provided by exact normalized path. Missing/empty/oversized files, wrong hashes,
case collisions, traversal and unreferenced extra inputs are rejected.
A schema-valid import is **not decoding or artwork approval**: Importer owns
magic, format, size/decompression and content inspection. Registry stores only
already caller-supplied local bytes and never downloads `sourceUrl`.

## Storage and crash/concurrency boundary

- `store/sha256/<first2>/<sha>`: immutable content-addressed bytes. Same content
  across assets/paths is stored once; reads recompute SHA256.
- `registry/definitions/<assetId>@<version>.json`: immutable metadata and file
  mapping, metadata digest plus whole-record digest. Same key/same record is
  idempotent; changed metadata, evidence map or bytes requires a new version.
- `registry/history/<key>/<sequence>.json`: append-only ordered state transitions,
  chained to definition and previous event digest. Missing/altered sequence,
  illegal transition, unbound approval or damaged hashes fails reads.
- Root `.writer-lock` directory prevents concurrent compliant writers. An
  interrupted stale lock returns `E_REGISTRY_BUSY`; it is never auto-deleted.
- Writes use private same-directory exclusive temp files, fsync and atomic
  rename. Index record becomes visible only after every blob is present. Failed
  input validation creates no visible asset; an interrupted pre-index blob may
  remain harmless/unreferenced. No automatic garbage collection is implemented.
- No symlink directory components or final symlink/hardlinked files accepted;
  reads use O_NOFOLLOW and require regular bounded files (64 MiB audit cap).

Threat boundary: root is a private, trusted local directory. Hashes detect
corruption, not malicious users with unrestricted filesystem write access who
can recompute all hashes. This is not a signed audit service. Atomic process
visibility is covered; power-loss durability of directory metadata and hostile
concurrent directory replacement are not certified. M1 import sandbox must own
input isolation; do not use this directory as an untrusted shared upload folder.

## Rights review, never generated approval

Legal path: imported → inspected → approved → published → deprecated.
Quarantine is permitted from imported/inspected/approved/published. Deprecated
or quarantined may re-enter inspected, but fresh explicit review is required
before approved/publication. Restoration requires a strictly newer approval timestamp;
publishing must reuse the current approved record unchanged. Deprecated/quarantined
and re-inspected states clear currentReview. Illegal jumps fail.

An approval/publication `ReviewRecord` must bind `assetKey`, `definitionDigest`
and actual `evidenceSha256`, supply nonempty reviewer/author/sourceUrl, valid
nonfuture reviewedAt, `decision: approve`, `redistributionApproved: true` and a
supported license. Supported basic identifiers: MIT, Apache-2.0, BSD-2-Clause,
BSD-3-Clause, CC0-1.0, CC-BY-4.0, OFL-1.1. Complex expressions are deliberately
refused until a real SPDX expression parser is integrated. LicenseRef-* or
NOASSERTION require explicit nonempty `rightsConclusion`; the review record
still must affirm redistribution and bind exact evidence. Unknown fields fail.

The tool does **not** authenticate human identity, determine legal ownership,
or fabricate signatures. A supplied operator review is an explicit input, not
proof that the model or a server performed human approval. Review records in
unit tests are conspicuously labeled SYNTHETIC TEST ONLY and do not authorize
any real artwork or release. No real production asset was approved by this work.

The `inspected` transition is the inspection caller's assertion, not a decoder:
CLI/importer must only expose it after actual inspect PASS. Registry PASS is a
storage/state integrity result, not a full Production bundle certificate.

## Verified tests

`node --import tsx --test tests/registry/*.test.ts`: **23 PASS**, including dedup,
query/filter, same-version conflict, immutable original metadata, legal review
workflow, no automatic approval, missing evidence/hash/path/case/extra-file
refusals, future/invalid calendar dates, missing redistribution and reviewer,
custom license conclusions, blob/history tamper, symlink root, lock exclusion,
and failed update preserving last successful version.

Inputs are temp filesystem fixtures; no third-party artwork or approval records
are distributed. Actual media decoding and all-suite browser validation belong
to separate integration gates, not this isolated unit suite.

`renderNotices(keys)` emits deterministic sorted asset/author/source/license credits
only for published records, excluding reviewer, review notes and private paths.
Builder must additionally distribute the original license texts required by each
license; this public credit string is not a replacement for those texts.

Independent review additionally found and closed inspection source-index/state
checks and reader/writer policy divergence. `get()` now revalidates legal genesis,
source/frame semantics on inspected+ events, current approved publication review,
and strictly newer review timestamps after restoration—not just digest validity.
Seven independently authored review regressions pass. Combined Registry + independent
CLI/Registry reviews: 34 PASS at the recorded checkpoint. Final Registry source
SHA256: `c511d5c477dd2b23ad725de4bb7e55c4f3acd347113932829e0ec29352c276cd`.

The independent FIFO regression exposed blocking open-before-type-check. Fixed:
pre-lstat, O_NONBLOCK|O_NOFOLLOW, inode/device/mode/size comparison, bounded
readSync into the observed-size buffer, and post-read size/time/link stability.
FIFO test now returns refusal rather than timing out; 34 combined tests pass.
