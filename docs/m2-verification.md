# M2 integration checkpoint — 2026-11-01

Actual current-environment run: `GAME_DESIGN_ROOT=../a2asset-upstream/game-design npm test`:
197 TypeScript + 5 runtime contract checks PASS, zero failures/skips.
`npm run typecheck`, build, `git diff --check`: PASS. `npm audit --json`: zero vulnerabilities.
See committed `evidence/m2/` logs and independent review tests.

Initial parallel run exposed the FIFO regression test's 1500 ms subprocess-start
watchdog timing out under codec load. The real NOFOLLOW/NONBLOCK reader and FIFO
failure expectation remain unchanged; the watchdog is now 10000 ms. Full rerun
passes. CLI cancellation handlers now install before loading the compiled module,
so early startup cancellation is retained instead of receiving default signal exit.

These checks validate bounded offline implementation, not production asset rights,
mobile/browser codec behavior, four playable games, or human visual quality.
M2 production sample gate remains NOT_PASSED without actual approved game assets.
M3 work may proceed only as independent technical PoC, not a gate waiver.

SDK independent review exposed omitted variant codecs in import allowlist; fixed
with explicit MIME or bounded extension selection, always actual decoding.
