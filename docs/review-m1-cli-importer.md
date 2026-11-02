# Independent M1 CLI / Importer review

2026-11-01; reviewer implemented Registry but did not implement CLI or Importer.
Scope: actual PNG import, declaration/decoder consistency, repeated calls,
rights refusal, structured output/exit status, importer failure and cancellation
paths. Not human artwork approval or general production certification.

## Reproduced defects closed

`tests/review/m1-cli.test.ts` initially failed 4/4:

1. Actual PNG with declared `mediaType: application/javascript` became inspected.
2. Actual 32×32 PNG with declared width 999 became inspected.
3. Repeating identical import re-ran inspected→inspected and failed.
4. Actual I/O/timeout diagnostic families incorrectly mapped to exit 2, not 5.

CLI owner fixed declaration-vs-decoded media/dimension comparisons, idempotent
already-inspected import, and exit taxonomy. The independent fixtures declare
true geometry `[32,32]` so tests isolate the intended mismatches, not an unrelated
size failure. All four reviewer regressions now PASS.

## Actual runs

- `node --import tsx --test tests/importer/*.test.ts tests/review/*.test.ts`:
  importer cases passed; this combined run also surfaced independent Registry
  reviewer failures, separately fixed by Registry owner.
- `node --import tsx --test tests/registry/*.test.ts tests/review/*.test.ts` after
  fixes: **34 PASS / 0 FAIL / 0 SKIP** (23 Registry + 4 CLI review + 7 independent
  Registry review cases).
- `npm run test:cli` on compiled executable: **9 PASS / 0 FAIL / 0 SKIP**;
  real PNG import/list, no-record approval/publication refusal, synthetic explicit
  review flow, single JSON stdout and structured exit behavior.
- `npm run typecheck`: **PASS**.

Inspected importer tests exercise 13 cases: actual PNG decode, unchanged source,
PNG CRC/signature corruption, pixel/byte/file budgets, active content and wrong
UTF-8, filesystem links and case collisions, ZIP duplicates/traversal/symlinks,
CRC/expansion ratio, implicit directory collision, cancellation and timeout.
Decoder child is awaited through shutdown before temporary PNG is removed.

## Scope and residual limitations

- PNG/JSON/TXT are the deliberately limited M1 profile; unsupported WebP/audio/
  fonts explicitly fail rather than pretend to decode. Later milestone scope
  must add maintained decoders and capability tests before enabling them.
- Registry validation does not authenticate reviewer identity. Test review
  records are labeled synthetic and cannot authorize real artwork.
- CLI now propagates AbortSignal and installs SIGINT/SIGTERM cancellation in
  its launcher. SDK precancel and importer during-decode/ZIP cancel cases ran;
  **live OS signal delivery to compiled CLI was not separately exercised by this
  reviewer**, so it is not claimed as independently verified here.
- JSON control files are locally supplied input, not executable scripts. This
  review is not an exhaustive fuzzer or hostile concurrent filesystem proof.
- Limits and private filesystem assumptions are documented; no external network
  downloads, AI generation or actual human rights decisions were performed.

Reviewed source SHA256 at this checkpoint:

- CLI main: `ff319a6c4db738b227f1261dff244f3bc34685b431e56fa967d666a0b60580bf`
- Importer: `999bc6851846340508715f49fb0e419d84011a737b51d8a8a714303bc6944e91`
- Registry after independent fixes: `c511d5c477dd2b23ad725de4bb7e55c4f3acd347113932829e0ec29352c276cd`
