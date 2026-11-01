# M1-02 Importer: restricted development profile

`src/importer/index.ts` exports asynchronous `inspectFile(path, options)`,
`inspectDirectory(path, options)` and `inspectArchive(path, options)`.
`options = { limits?: Partial<ImportLimits>, signal?: AbortSignal }`.
All return `InspectionReport extends Report` with `files: Map<string,Uint8Array>`
and `metadata: {path,sha256,bytes,mediaType,width?,height?}[]`.
A successful inspection is **not** license approval or Production publication.
Registry owns durable quarantine/state/approval; it may consume the returned map.
No files are uploaded, downloaded, executed, or written to the source directory.
Failures return empty maps and metadata, never a partially accepted batch.

Selected inputs: PNG, JSON data and UTF-8 TXT license evidence. WebP, audio,
WOFF2, animated PNG and other extensions return E_PROCESSOR_UNSUPPORTED, not an
invented decoder PASS. SVG/JS/HTML are explicitly forbidden, including markup
masquerading as TXT. JSON is parsed as inert data, never evaluated.

PNG signature/header/chunk bounds and pixel budget are checked before a complete
pngjs decode with CRC validation. Each decode uses a separate Node process,
96 MiB JS heap limit, a mode-0700 mkdtemp and mode-0600 private file; no input is
executed as code. Timeout/cancel kills the decoder, waits for child close, and
removes scratch in finally. This is process/limit isolation, **not an OS security
sandbox**; Node external/native allocation is not claimed bounded by V8 heap.
PNG dimensions and bounded source bytes constrain expected decoded size.

ZIP uses yauzl's lazy entries and bounded streams, never extracts archive names
onto the filesystem. Rejections cover path traversal/absolute/backslash/dot
components, duplicate and case-conflicting entries/ancestors, file-directory
collisions, symlinks/nonregular modes, encryption, unsupported compression,
counts, total expanded size, ratio, file size and CRC. Whole-archive deadlines
and cancellation close ZIP streams and wait for active PNG child cleanup.

Filesystem reads reject symlinks/hardlinks/nonregular files, use O_NOFOLLOW,
check inode/size/times, and on Linux verify the actual open FD resolves under the
trusted root. Inputs are copied to memory only within byte limits; original bytes
are not modified. Directory traversal counts directory entries as well as files.

Defaults: 16 MiB/file, 32 MiB total, 256 entries, 2048² pixels/image, expansion
ratio 100, decoder/archive deadline 5 seconds. These are defensive development
limits, not validated phone performance or multi-texture budget guarantees.
A caller may tighten them via options. Registry must independently validate all
logical paths and hashes; importer success must not bypass rights policy.

Run `node --import tsx --test tests/importer/*.test.ts`. Tests include full PNG
success, changed CRC, malformed type, oversized dimensions, original unchanged,
text/JSON checks, symlinks, path escapes, case collisions, ZIP CRC/duplicates/
ratio/count/size and cancellation/deadline scratch cleanup. Safety fixtures are
synthetic test inputs, never represented as human-approved artwork.
