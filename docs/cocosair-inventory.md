# M0 CocosAirJS compatibility inventory

Audited 2026-11-01 against `oahc09/cocosairjs` main commit
`2886aa3a3d740fd53248f2ed517d090faa5f5d08` (read-only checkout, no patches).
SDK used: committed `build/cocosair.module.js`, SHA-256
`dec7d3c73ff0eb57e4462f1941168261fda9cc713f46401dc9a02753a833fba3`.
Engine MIT license remains upstream; this repo does not redistribute its SDK bytes.

## Actual API inventory

| Need | Actual source / export / signature | Verification and boundary |
|---|---|---|
| App / UI | `src/air/bootstrap.ts:createAirApp(options):Promise<AirApp>`; `src/air/ui-kit.ts:createUICanvas(scene,name,options):Node` | Executed in WPE/WebGL2; default startup requires WebGL2 |
| PNG texture | `src/cocos/asset/assets/image-asset.ts:ImageAsset`; `texture-2d.ts:Texture2D.image`, `reset(info)`, `setFilters`, inherited `uploadData` | Actual decoded PNG → ImageAsset → Texture2D → framebuffer tested |
| Sprite | `src/air/texture-sprite.ts:createAirTextureSprite(parent,texture,options)` → `{node,sprite,frame,refresh,dispose}` | Executed; borrows texture, owns frame and node; adapter must destroy separately owned texture |
| Atlas / Trim | `src/air/assets/atlas/atlas-factory.ts:createAtlasSpriteFrame`, `createAtlasHandle`; native `SpriteFrame.reset({texture,rect,originalSize,offset})` | Source inspected. Atlas loader `loadAtlas(url,{bank,signal,...})` handles libGDX text + PNG only. A2Asset JSON needs translation; WebP via explicit texture factory, not this loader |
| Pivot / UI | `UITransform.setAnchorPoint(x,y)`; `SpriteFrame.insetLeft/insetRight/insetTop/insetBottom`; `Sprite.Type.SLICED` | Pivot executed. Nine-slice source API exists, full rendering not yet tested |
| Animation | `src/cocos/animation/animation-clip.ts:AnimationClip.createWithSpriteFrames(frames,sample)`; native `Animation` | Export exists; fixed sample rate does not directly express per-frame duration. Adapter must implement deterministic variable-duration stateClips or construct tracks. No claimed M3 animation PASS |
| Audio | `src/air/audio-service.ts:AudioService.load(id,url)`, `playBgm`, `playSfx`, `dispose`; `AudioSource` | Source inspected and exports observed; codec decode/user-gesture/currentTime tests NOT_RUN. Autoplay success cannot be inferred |
| Font | Native `Font` export; `src/air/assets/bmfont.ts:parseFnt`, `createBitmapFont(data,page)` | Export observed. BMFont is not WOFF2. WOFF2 load/registration/glyph coverage/lifecycle require separate adapter experiment; NOT_VERIFIED |
| Tilemap | `examples/tiledmap-basic`, native TiledMap APIs | Existing example is not proof of A2Asset orthogonal JSON mapping; M2-06/M3 translation and index checks needed |
| Async bank | `src/air/assets/asset-bank.ts:AssetBank.load(url,{ext,signal})`, `release`, `releaseAll`, `refCount` | Source explicitly declares `underlyingCancelSupported=false`: subscriber cancellation only, not network cancellation. Adapter can use own AbortSignal-aware fetch before engine object creation |
| Lifetime | Sprite handle `dispose`, native frame/texture/image `.destroy`; `src/air/app.ts:AirApp.releaseScene?`, `close?` | Owned sprite/frame/texture destruction executed. Whole-app repeated reconstruction is not claimed; source says reconstruction requires reload |
| Restricted VFX | Frames via native Sprite; geometry via trusted local code only | M0 freeze recommendation: frame-animation VFX only initially, no arbitrary shader/JS input. Full processor NOT_IMPLEMENTED |

The AIR conveniences are re-exported by `src/air/index.ts`; engine APIs by
`src/exports/air.ts` and the main compiled bundle. Do not create a second startup
entry or assume creator/editor asset importing.

## M0-05 actual minimal slice

`examples/m0-runtime` is a **Preview-only interface experiment**, not a game and not
an approved Production asset pack. `scripts/m0-runtime-fixture.mjs` encodes a
hand-specified triangle in a 32×32 RGBA PNG using Node zlib; no AI generation,
editing, interpolation, external artwork or automated aesthetic judgment.
Its `placeholder:true` is deliberate and cannot satisfy Production acceptance.

The existing upstream arcade-shooter `player.main` logical slot is bound through
`asset-manifest.json`, with 4×4 logical dimensions (the source player radius is 2).
The page reads the copied real GameSpec initial `playerX=50,playerY=80` in a 100×100
world, maps x-right/y-down to Cocos UI x-right/y-up, without modifying game rules.
The runtime loads only declared manifest file bytes, verifies SHA/length before
image decode, and renders through **real CocosAirJS**, not a Canvas2D substitute.

Reproduce with a separately supplied pinned SDK and Playwright installation:

```sh
node scripts/m0-runtime-fixture.mjs
node --test tests/runtime/manifest.test.mjs
COCOSAIR_SDK=/path/to/cocosairjs/build/cocosair.module.js \
PLAYWRIGHT_PACKAGE=/path/to/playwright-project/package.json \
WEBKIT_EXECUTABLE=/path/to/normal-webkit-wrapper \
node scripts/m0-runtime-browser.mjs
```

`WEBKIT_EXECUTABLE` is optional when Playwright's browser is installed normally.
No sandbox disabling flags are used. The localhost server allowlists exact files;
it does not expose the repository or host filesystem. Runtime assets stay local.

Observed WPE WebKit 26.5, 400×400 buffer, WebGL2, MAX_TEXTURE_SIZE=16384;
PNG-contributed framebuffer pixel `[40,220,180,255]`, no page errors or GL errors,
owned sprite/frame/texture released, browser close resolved.
Retained evidence: `evidence/m0-runtime/report.json`, `loaded.png`.
Five CPU checks cover real bytes, missing slot, path escape, undeclared/duplicate
file and altered bytes. This small guard is explicitly **not** the complete
production manifest validator.

## Budget / acceptance limits

Only this cloud WPE machine was measured. An additional bounded allocation probe
(`scripts/m0-runtime-budget.mjs`, `evidence/m0-runtime-budget/report.json`) allocated
one 2048×2048 RGBA8 level (estimated 16,777,216 decoded bytes), attached it to a
complete framebuffer, cleared it, read the far-corner pixel `[64,128,191,255]`,
and deleted both texture and framebuffer with GL error 0. The observed operation
took 22 ms; this is one allocation/readback measurement, not an FPS or latency SLA.
This supports freezing a **development-only** cap of one 2048 atlas / total decoded
texture bytes 16 MiB / PNG-only M0 input. It does not validate eight simultaneous
atlases, phone memory, or driver-internal overhead. MAX_TEXTURE_SIZE=16384 is only
a capability limit, not a safe memory budget. PNG actual decode passed; WAV/OGG
`canPlayType` returned probably and MP3 maybe, but real audio decoding/playback
remains NOT_RUN. WebP and WOFF2 remain NOT_RUN and excluded from the M0 profile. Chromium, Firefox, physical phones,
audio formats, WOFF2, atlas trim and animation fidelity remain NOT_RUN here.
One sprite is sufficient for M0 interface feasibility, not the four-game M3 gate,
production approval, G2 human visual sign-off, or v1.0 completion. No upstream
engine changes are currently necessary for this PNG slice; remaining APIs need
adapter-specific experiments before claiming full support.
