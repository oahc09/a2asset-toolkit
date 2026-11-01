# M1 engineering gate — 2026-11-01

**Software gate PASS for the authorized PNG/JSON/TXT development baseline.**
This verifies implementation behavior with labelled test inputs, not a human
approval of any real production theme. Production theme/G2 external acceptance
remains BLOCKED; no full v1.0 certification is issued.

| Task | Evidence | Result |
|---|---|---|
| M1-01 CAS/immutable definitions/hash reads/atomic commit | registry tests: same bytes dedup, metadata conflict, damaged blobs/records, busy lock, no partial index | PASS |
| M1-02 isolated import/ZIP/decode limits | 13 importer tests including real PNG decode/CRC, ZIP slip/symlink/duplicates/bombs, timeout/cancel | PASS |
| M1-03 explicit review/state/NOTICES | labelled synthetic approval/revocation flow, absent evidence/refused publication, old-review replay and reader consistency | PASS (software behavior only) |
| M1-04 SDK/compiled CLI queries/import/explainable failure | actual PNG import→inspected→list, explicit synthetic review→published→deprecated; one JSON/exit codes/SIGINT130 | PASS |

Final aggregate: **107 TS tests + 5 runtime guards = 112 PASS, 0 FAIL, 0 SKIP**
with the pinned upstream source validator, plus build/typecheck/diff-check PASS.
Full dependency audit: 0 vulnerabilities. Yauzl was explicitly updated from 3.2.0
(known off-by-one advisory) to pinned 3.4.0; no blanket auto-upgrade was performed.
Logs and audit: `evidence/m1/`.

Independent reviewers reproduced and closed incorrect declared MIME/dimensions,
repeat-import failure, incorrect I/O exit codes, missing source/state inspection,
illegal stored initial state, differing publish approval, revoked-review replay,
and FIFO blocking. Tests exercise actual filesystem failures; no mock security
PASS. State readers reapply the writer policy, not merely hash checks.

## Boundaries carried to subsequent milestones

- Trusted private local root; hashing is integrity, not digital signatures or
  authentication. Human approval identity/legal truth cannot be invented by code.
- Process-isolated maintained PNG decoder with limits, not an OS security sandbox.
- Only PNG/JSON/TXT is enabled for this baseline. Other media explicitly refused;
  media processor support must be implemented and tested before extending profile.
- Source files remain unchanged. Failed inputs return no asset set; importer
  temporary files are removed after child exit. No network ingestion/AI/assets
  scripts are accepted.
- Full M2 production builds still need real reviewed content. Synthetic review
  records are test inputs only, not transferable production approvals.

M2 development may now consume the verified M1 interfaces. M2's real production
sample gate must not be passed solely by synthetic approvals or Preview placeholders.
