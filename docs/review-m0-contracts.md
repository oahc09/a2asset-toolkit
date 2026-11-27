# Independent M0 contracts review

Date: 2026-11-01. Reviewer: separate mapping/review agent, not contracts implementer.
Scope: `src/contracts/{validate,semantics}.ts`, `tests/contracts`, nine supplied
schemas and taskbook M0-03/M0-04. This is an engineering review, **not** a human
artwork/rights approval, legal conclusion, full pipeline certification or M0 gate
sign-off.

## Findings and verified corrections

Four executable regressions initially failed because the API returned PASS.
The implementer fixed the code; reviewer did not edit implementation.

| Finding | Initial behavior | Verified correction |
|---|---|---|
| Empty/omitted capabilities.states with nonempty stateFrames | State-set equality skipped under `if(states.length)` | Mismatched sets now FAIL, including empty declaration |
| Theme self-inheritance without graph context | Schema-only semantic PASS | Unsupported full theme semantics now BLOCKED, not certified |
| Production manifest with empty bindings/files and no request/rights context | PASS | Production checks without full-chain context now BLOCKED (or FAIL for local errors) |
| AssetBinding with no request/registry snapshot | Schema-only semantic PASS | Explicit BLOCKED for unimplemented cross-document semantics |

Regression file: `tests/contracts/review-regressions.test.ts`.
The latter three corrections are **honest scope restrictions**, not implementations
of the missing registry/resolver/graph validation.

## Actual runs

- Before correction, `node --import tsx --test tests/contracts/review-regressions.test.ts`:
  **0 PASS / 4 FAIL**; every failure was an observed false PASS.
- Existing schema/local tests before correction: **34 PASS / 0 FAIL**. This
  demonstrates why broad green test counts alone did not establish correctness.
- After correction, `node --import tsx --test tests/contracts/*.test.ts`:
  **38 PASS / 0 FAIL / 0 SKIP**.
- `npm run typecheck`: **PASS**.
- Node v24.22.1. Reviewed post-fix `semantics.ts` SHA256:
  `a898a6e752b6207a52adbe220c135ef969cd572ded108f95afedad9e488b7abf`.

## M0-03 assessment

Nine Draft 2020-12 contracts each have executable supplied structural positive,
missing-schemaVersion negative and unknown-property negative: minimum 1+2 met.
`asset-definition-UNPUBLISHABLE` deliberately remains a **structural** positive,
not a distributable resource. Local audit checks exercise actual bytes/hash,
source index, state equality, missing rights, symlink and case-collision failures.
Schema-only and limited local-audit results must remain distinct.

`docs/semantic-rule-matrix.md` now explicitly freezes cross-file rules with their
implementation owner and NOT_IMPLEMENTED status. Production is deliberately
uncertified. These boundaries are acceptable for a gated M0 audit; they are not
permission to claim M1–M5 completed.

## Remaining noncertified rules / risks

1. Required-slot coverage, kind/state/direction/size compatibility, Theme/Genre
   graph references/cycles, immutable ID/version conflicts and profile/lock
   consistency need a multi-document context. Current BLOCKED is correct; tests
   must become actual positive/negative graph/resolver tests in later gates.
2. Byte SHA verification is not decoding. Existing tests intentionally put text
   under `.png` to exercise hash/path logic. Image magic/dimensions, alpha,
   decompression limits, malicious content and trustworthy parsed sizes are
   **not** proven by those tests. M1 isolated import and M2 processors own this.
3. Nine-slice checks currently use declared dimensions; atlas/state frame
   rectangles are not compared against decoded texture size. Tile index bounds,
   font glyph coverage and audio browser decode remain unimplemented.
4. A nonempty SPDX-looking string is not parsed as a full SPDX expression and a
   nonempty evidence file is not a rights decision. Current Production BLOCKED
   prevents these partial checks from certifying publication. Future review
   records must bind actual evidence, subject, version and reviewer decision.
5. File checks use pathname operations, so concurrent untrusted mutation can
   race lstat/realpath/read. The documented trusted audit-root restriction is
   necessary; M1 must use isolated inputs/descriptor-based safeguards.
6. Schema-only `theme-pack` lacks a human visual approval record and there is no
   executable device-budget certification. M0-04 must explicitly record actual
   browser matrix/budget measurements or mark remaining targets BLOCKED. No
   arbitrary numerical default is proof of real-device performance.
7. Diagnostics supply pointer/code/remediation, but frame/asset diagnostics could
   be more specific (state/frame index and asset ID) when implementing production
   validators. This is an actionable later contract-quality requirement.

## Review disposition

**Fixed regressions verified. Limited M0 contract audit passes its stated tests.**
No full Production semantics or overall M0 gate approval is issued by this review.
Real browser vertical slice, budget/input-contract freeze and remaining mandatory
M0 evidence must be assessed by the integration owner.
