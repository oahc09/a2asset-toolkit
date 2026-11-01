# M2 processors: deterministic PNG and bounded orthogonal data

`processAsset(definition, sourceFiles: Map<string, Uint8Array>, options?)` returns
`ProcessorResult extends Report`: `files` Map, `binding` (BundleManifest binding),
`metadata` (processorVersion, actual source/output digests and decoded budgets).
Options: maxTextureSize ≤ 2048, maxDecodedBytes ≤ 16 MiB, trim (default true).
Failures discard files and binding; unsupported formats do not silently copy.
The builder owns registry rights, safe output paths, cancellation at job boundaries,
cache keys, package hashing, NOTICES and atomic publishing. This function is pure
in-memory transformation of **already inspected** bytes. Every referenced source
SHA is rechecked, but this synchronous decoder is not the untrusted importer.

## PNG / atlas / animation

- PNGJS 7 full decode and CRC. Only sRGB/assumed-sRGB + straight alpha. Non-sRGB
  gamma, embedded ICC and APNG explicitly unsupported; no implicit conversion.
- Asset definition and frame/source references validated. Multi-source images
  without explicit state mapping are refused rather than silently dropping images.
- All-alpha-zero frames are E_EMPTY_FRAME, never passed as destroyed/idle artwork.
- Stable source-path ordering, deterministic shelf packing, one page, no rotation.
  One extruded edge pixel on each side creates two pixels between image rectangles.
  Transparent trim is disabled for backgrounds, whole-image atlases and nine-slice.
- Frame `sourceSize`, top-left `trimOffset`, normalized original-source `pivot`,
  frame duration and loop flag are retained in `stateClips`. Adapter applies trim
  and pivot once. Nonzero pretrimmed-input geometry metadata is unsupported until
  an explicit original-size contract exists.
- Output PNG colorType RGBA8; source RGB values are not premultiplied. PNG encoding
  options fixed. Explicit output hashes and rectangles make byte/pixel tests possible.
- Aggregate source decoded bytes plus output atlas decoded bytes must fit 16 MiB
  (estimate, not a process RSS guarantee). Padding counts toward dimension limits.
- Nine-slice uses raw source dimensions without trimming, validates border sums,
  and emits `nineSlice` alongside atlas rectangle.

Output path: `assets/<assetId>-<version>.png`. Only referenced frames are emitted.
One image can be reused by several state frames without duplicating the atlas region.
`atlas2d` currently supports one whole-image source, not a generic external atlas
format. WebP, audio, font and procedural VFX remain E_PROCESSOR_UNSUPPORTED.

## Restricted tilemap input

Asset kind `tilemap2d`, source[0] application/json, one additional explicitly
indexed PNG tileset. Definition `tilemap.orientation=orthogonal` and tileSize
must match the source. Source JSON has **only** these fields:

```json
{"width":2,"height":2,"tileSize":[16,16],"tilesetSourceIndex":1,
 "layers":[{"name":"ground","data":[0,1,2,-1]}]}
```

Indices are row-major, zero-based; **-1 is empty**. No Tiled flags/flips, arbitrary
properties, script, URL, external download or implicit tileset discovery. The
PNG dimensions must divide evenly by tileSize; all indices must be in bounds.
Layer names must be unique and, if definition lists layers, exactly match.
Maximum 32 layers and 1,048,576 cells/layer. Referenced PNG is decoded and emitted
without atlas rearrangement so indices remain meaningful.
Output JSON replaces tilesetSourceIndex with a declared emitted `tileset` path
and `emptyTile:-1`; the binding lists both JSON and texture dependencies.
This is an A2Asset-local explicit contract, not a claim of arbitrary Tiled support.

## Restricted VFX

Only `effectKind:frames` with real state/frame mappings, no parameters/scripts or
approvedEffectId is implemented. Procedural-approved effects stay unsupported
until a separate trusted whitelist processor exists.

## Verification / remaining gate

Run `node --import tsx --test tests/processors/*.test.ts`: real decode/encode,
exact alpha and extruded pixels, deterministic ordering/rebuild, trim/pivot/duration,
empty/hash/dimension/state/index/budget errors, nine-slice overflow and tilemap
index/dependency/layer/script negatives. These tests do not establish full M2:
WebP/audio/font, actual BG-04 runtime and rights-approved shooting/match-3 inputs
remain separate requirements. No AI asset generation or visual judgments occur.

## M2-03 traditional media extension

`processMediaAsset(definition, files, options)` is the async wrapper; PNG delegates
to processAsset. Shared `src/media/inspect.ts:inspectMediaBytes` performs real
decoding independent of Importer/Builder. `src/media/worker.mjs` must be copied by
build. There is no runtime dependency from the decoder back to processors.

- WebP: sharp 0.35.5/libvips, child process, signature + metadata + actual RGBA raw
  decode, then deterministic PNG encode/atlas. Reject animation/ICC and >2048².
- WAV/OGG/MP3: system ffprobe/ffmpeg **7.1.5 observed**, explicit input demuxer,
  only file/pipe protocols, one audio stream, ≤2 channels, 8–96 kHz, ≤60 seconds.
  Entire stream decoded to bounded PCM; codec metadata alone is insufficient.
  Output retains original validated bytes. Metadata includes exact ffmpeg version,
  decoded PCM SHA/sample count. This does not establish browser autoplay/codec support.
- WOFF2: fontkit 2.0.4 child decodes actual cmap and every glyph outline; bounds
  expanded sfnt header 16 MiB, 8192 glyphs, 16384 codepoints, 1,000,000 commands.
  requiredCharacters checks actual cmap. Browser font layout/rendering remains NOT_RUN.
- Child deadlines 10 seconds default (≤30 seconds), cancellation waits for shutdown,
  isolated mode-0700 scratch always removed. No shell execution or asset scripts.
  Decoder isolation is not an OS sandbox or a guarantee against native allocation bugs.
- Both codecs are pinned npm dependencies; ffmpeg is an external GPL tool, not bundled
  in this repository. Tool version must participate in the builder cache lock.
- Tests synthesize WAV mathematically, traditionally encode OGG/MP3/WebP, and use a
  3132-byte licensed DejaVu subset with complete notice/provenance in test fixtures.
  These are codec tests, not Production approvals or visual art-quality certification.

Earlier unsupported declarations apply to the **synchronous PNG API** only; the
async wrapper now supports these concrete codecs. Full M2 gate still needs real
rights-approved sample games, integration and measured cache evidence.
