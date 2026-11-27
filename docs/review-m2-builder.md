# Independent M2 Builder review

Date: 2026-11-01. Reviewer owns Resolver but not Builder/IO implementation.
Fixture is actual decoded PNG with **synthetic test-only rights records**;
no real artwork/human approval or full Production gate is asserted.

## Reproduced findings

`tests/review/m2-builder.test.ts` contains independent real-filesystem tests.
Initial run reproduced five false PASS results:

1. Cache product.binding.assetId changed to another identity and payload digest
   recomputed: build accepted and replaced the last good package.
2. Cache stateClips removed with recomputed digest: required idle frame vanished
   but build passed.
3. Package manifest frame rectangle x set to 999999: out-of-atlas region passed.
4. asset-lock.gameId altered and its manifest file digest/size updated: validator
   accepted cross-document identity drift.
5. maxSingleFileBytes set to 1 in the explicit profile: validator ignored limit.

A sixth test exposed **failure corrupting old output**: set cacheDir to
`output/cache` after a successful build. The next build failed, but had injected
cache files into the previously valid output, making that old package invalid.
All output/cache/receipt path overlap must be rejected before directory writes.

The seventh test passes: revoke rights with a real Registry transition during
build (at a blob read). The final snapshot recheck refuses publication and leaves
the previous output byte-identical and structurally valid. That old artifact's
structural validity is not a renewed rights authorization.

## Required corrections / threat boundaries

- Bind cached product identity/kind/state contract to resolved request/definition,
  not merely a self-stored hash. A separate trusted output receipt can detect
  modifications in a cache treated as untrusted; it is not a signature against
  attackers who control both receipt and cache directories.
- Validate real decoded texture bounds and cumulative/single-file budgets.
- Validate AssetLock schema, game/profile/fingerprint and per-slot identities
  against Manifest. Internal hashes do not prove cross-document consistency.
- Protect previous output and unrelated user files on every failure path.
- Keep private Registry/Builder roots separate from untrusted upload locations;
  no arbitrary hostile directory-swap guarantees are inferred from local tests.

## Checkpoint

Initial independent result: **6 reproduced failures, 1 passing mid-build
revocation test**. Fix verification will be appended after the Builder owner
changes implementation; do not read this initial checkpoint as final gate status.

## First correction verification and additional boundary cases

The first six defects were corrected by Builder owner. Independent rerun:
`tests/builder/*.test.ts + tests/review/m2-builder.test.ts` = **13 PASS**, plus
`npm run typecheck` PASS. Trusted separate receipts now bind cache bytes;
output/cache/receipt/registry roots are disjoint before writes; actual PNG bounds,
request states and lock identity/limits are checked.

Two additional independent negatives then exposed remaining boundary gaps:

8. maxBundleBytes counted `manifest.files` but omitted `asset-manifest.json`
   itself, permitting a larger actual delivered package.
9. A `ghost` binding plus matching lock entry was accepted even though absent
   from asset-request. Reverse request/manifest membership must be checked.

Both tests reproduced FAIL (implementation returned PASS), and are pending
owner correction at this checkpoint. All test assets/reviews remain synthetic.

## Final independent verification (13:31 UTC)

Both remaining boundaries were fixed. Final command:

```sh
node --import tsx --test tests/builder/*.test.ts tests/review/m2-builder.test.ts
npm run typecheck
```

**15 PASS / 0 FAIL / 0 SKIP**, typecheck PASS. This comprises 6 Builder-owner
cases and 9 independently authored cases (8 reproduced defects plus a passing
mid-build rights revocation control).

Reviewed source SHA256:

- `src/builder/index.ts`: `374baba0518abbb3387673f120f0edca7129de56ffe47722ca7195ad13ae1b38`
- `src/builder/io.ts`: `7ce76b92acabc34c9634babcc5df3b1a51ae104d73ac6c41f911c712d46b40e0`

Disposition: identified Builder regressions closed with executable evidence.
This is not full M2 Production acceptance: real approved benchmark assets,
complete supported media capabilities and later runtime/visual gates remain
separate. Hash/receipt threat boundary stated above still applies.
