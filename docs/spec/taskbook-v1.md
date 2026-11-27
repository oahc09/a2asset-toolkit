# A2Asset Toolkit v1.0 — 架构规格与开发任务书

> 日期：2026-11-01  
> 状态：**设计基线 / 待 M0 工程核查后冻结实施接口**；不是已开发完成的产品。  
> 目标：将玩法 JSON 对外部美术资源的需求，转化为有授权、可查询、可构建、可验证、可复现的游戏资源包。  
> 适用：A2Game / Game Design Skill 现有可玩原型、CocosAirJS Web 运行时，以及未来其他引擎。  
> **红线：不使用 AI 生成、编辑、补帧、转换或自动美学评价任何素材。** 可以使用人工提供且权利清晰的素材、确定性程序化图形和传统离线编辑/构建工具；不联网自动抓图。AI 生成玩法 JSON 属于上游 A2Game 的独立问题，不属于本工具的素材生产能力。

## 0. 交付结论、开发顺序与依据

**产品形态**：离线优先的 **Core TypeScript SDK + CLI + Registry + Asset Packs + CocosAirJS Runtime Adapter**。Web Studio 是 v1.1 候选，不是 v1.0 阻塞项。v1.0 首先作为可以在本地或 CI 中运行的开发工具交付，**不是** SaaS、素材商城、游戏编辑器、AI 生成器或联网抓取器。

**不可跳过的实施顺序**：M0 协议与现有工程映射 → M1 导入/审核/注册 → M2 匹配/构建/CLI → M3 引擎真机（浏览器）闭环 → M4 主题与质量 → M5 安全、回归、发布。任一 Gate 未通过，不得宣称 v1.0 完成。

**现有工程核查输入**（2026-11-01 查阅仓库 README；仅核查公开描述，没有执行仓库测试）：

- `https://github.com/oahc09/game-design`：README 描述已有六类可玩原型、`GameSpec`、`materializeSpec`、R05 可玩交付、CocosAirJS Web 适配和浏览器验证；其 M7 研究仍有独立阻塞。A2Asset 只接入资产请求边界，**不修改既有游戏规则语义，也不将 M7 资格视为已完成**。
- `https://github.com/oahc09/cocosairjs`：README 描述 Code First TypeScript Web Runtime，默认 WebGL2，不依赖 Cocos Creator/Editor 的资产管线。需要真实核对其纹理、Sprite、动画、声音与释放 API，不能据 README 假定所有所需接口存在。
- 标准参考：JSON Schema Draft 2020-12（`https://json-schema.org/specification`）、SPDX 许可证表达式（`https://spdx.dev/learn/handling-license-info/`）。3D glTF 和 KTX2 本期**不实现**，仅记录可扩展边界。

## 1. 版本范围与非目标（P0，须签入规格冻结文件）

### 1.1 v1.0 Included

- 本地 Sprite2D、Background2D、Atlas2D、Tilemap2D、UI Nine-slice、Frame Animation2D、有限 VFX2D（序列帧或可复现参数效果）、Audio、Font 的导入、元数据、校验、查询、打包。**VFX 的具体子集由 M0 能力审计锁定；不默许任意 Shader 脚本**。
- PNG/WebP、JSON、WAV/OGG/MP3、WOFF2 的受控输入/输出；源格式扩展必须通过 Processor 插件并增补测试。SVG 仅可作为经审查的源文件，v1.0 不能将未净化 SVG 直接交给浏览器执行或渲染。
- 一个面向 WebGL2 的 `BuildProfile`，可配置不同目标设备预算。初始预算是试运行默认值，不是假定所有手机均满足。
- 可追溯的导入、许可证/来源审核、版本、稳定 ID、内容哈希、精确匹配、冲突报告、增量构建、原子输出、报告。
- `Preview` 与 `Production` 两种模式；仅 Preview 允许**显式许可**的确定性几何占位；Production 不能包含占位内容。
- CLI + SDK + CocosAirJS Adapter；四个真实基准游戏验收；离线执行、不依赖模型账号或外部 API。

### 1.2 v1.0 Excluded

- 所有 AI 生图、AI 音频、AI 插帧、AI 图像编辑、AI 风格判定及其插件接口；自动爬取素材网站和不受控下载。
- 云素材市场、用户账号、收费、在线编辑器、多人协同、Web Studio 正式实现。
- 3D/GLB/KTX2、复杂骨骼与粒子编辑器、多引擎正式支持（需有跨引擎契约测试框架，但第二引擎通过不作为 v1.0 发版硬门禁）。
- 通用游戏项目构建、游戏逻辑生成或玩法难度评测；这些属于 A2Game/Game Design Skill。

### 1.3 目标用户与主要工作流

1. Game Agent/CI：调用 `a2asset inspect|resolve|build|validate`，获得机器可读结果和确切退出码。
2. 素材管理员：将有授权的原始文件导入隔离区，补充元数据，人工确认权利，审批发布。
3. 游戏开发者：选择 `ThemePack`/`GenreKit`，审查自动匹配，显式锁定关键角色资源，构建并在实际游戏中验收。

**成功定义**：在已审核素材足够的前提下，一份游戏资源请求可以确定性地解析到实物文件，由真实引擎加载并正确释放；当素材不足、版权不明、风格冲突或加载失败时能明确报错，而不是“看起来跑起来了”。

## 2. 模块分层与单向依赖

```text
[A2Game / game-design GameSpec] ----(提取适配，不改玩法规则)----> GameAssetRequest
[人工视觉设计 / ThemePack] -------------------------------> VisualSpec
                               |                              |
                               v                              v
  CLI/API -> Contract Validator -> Resolver <-> Registry & Provenance
                                   |                     ^
                                   v                     |
                              AssetBinding       Import/Inspect/Review
                                   |                     |
                                   +----> Build Planner -> Processors -> Validator
                                                       |             |
                                                       +----> Atomic Publisher
                                                                  |
                                                 BundleManifest + AssetLock + Files
                                                                  |
                                               CocosAirJS Runtime Adapter
```

代码建议模块（**不是**规定必须拆为多个 npm 发布包）：

- `contracts`：九个独立 Schema + 语义校验（跨文件关系、版权状态、能力集）。不得依赖 CocosAirJS。
- `registry`：素材元数据、原始文件、变体索引与受审状态；文件系统为可信源，初期无需数据库。
- `importer`：安全导入、识别与哈希、隔离区、审批/状态流转。不得直接修改原件。
- `resolver`：稳定确定的匹配结果、详细拒绝原因、绑定锁。
- `processors`：格式转换、Trim/Pivot、序列帧、Atlas、音频复制/转码等纯受控操作。
- `builder`：DAG、增量缓存、原子发布、manifest/lock、NOTICES、报告。
- `cli`：命令、参数解析、JSON stdout、日志/诊断、退出码；调用 Core 而不复制业务逻辑。
- `runtime-adapter-cocosair`：仅依赖已构建 BundleManifest 与引擎 SDK，不应依赖 Registry、Importer、Builder。
- `fixtures/tests/evidence`：真实游戏、正负例、视觉验收、性能测试。

**依赖约束**：`runtime-adapter -> contracts(runtime subset)`；`builder -> resolver/processors/contracts`；`resolver -> registry/contracts`；不允许反向依赖或循环依赖。`game-design` 不需导入 `a2asset` 内部实现，使用桥接器交换 JSON。

## 3. 协议冻结：数据模型与文件责任

**权威规范**：随本文档附带 `schemas/*.schema.json`（Draft 2020-12）及 `examples/*.json`。Schema 的结构约束之外，以下跨文件语义规则必须由独立 Validator 实现，不能以“通过 JSON Schema”代替业务校验。示例 `asset-definition-UNPUBLISHABLE.json` 是**结构合法但不可发布**的负面安全样本。

| 文件/对象 | 必填语义 | 跨文件不变量与生产作用 |
|---|---|---|
| `GameAssetRequest` | gameId、genre、slots(kind/role/required/fallbackPolicy) | 来源于已有 GameSpec 的**映射结果**，不得改变玩法规则；slot 名在游戏范围唯一 |
| `VisualSpec` | themeId、palette、renderStyle、layout | 色板/形态/视角/设计单位为约束；与 ThemePack 的 themeId 一致 |
| `AssetDefinition` | assetId、version、kind、roles、sources、provenance、approvalStatus | 每个源路径存在、SHA256 匹配；`published` 需权利复核与具体证据 |
| `AssetBinding` | gameId、slot→assetId+version | 每个 required slot 恰有一个合法匹配；缺失/重复不通过生产检查 |
| `ThemePack` | themeId、version、visualSpecPath、assetIds、roleBindings | 引用存在；继承 DAG 无环；相同 role 多候选需 resolver 明确决策 |
| `GenreKit` | kitId、genre、requirements | 引用的 role/kind 与 GameAssetRequest 兼容；不擅自新增游戏实体 |
| `BuildProfile` | target、mode、limits、allowFormats | 实际浏览器/设备能力测量后固定目标 Profile；不得用 Profile 规避许可 |
| `BundleManifest` | gameId、profileId、buildFingerprint、bindings、files | 每个文件存在且哈希正确；运行时只消费它，不去访问 Registry |
| `AssetLock` | inputDigest、toolchain、entries/sourceHashes | 锁定所有源、处理器版本、参数及输出变体，以支持重建审计 |

### 3.1 命名、版本与向后兼容

- 所有协议声明 `schemaVersion: "1.0.0"`。工具包自身版本与协议版本分别管理，禁止混写。模式为严格闭合对象：未知字段拒绝；预留扩展必须使用版本升级与显式的命名空间。
- `assetId` 为稳定逻辑身份（如 `ships.blue-falcon`）；`version` 使用语义化主次补丁三段；`sha256` 锁定实际内容；禁止用文件名或修改时间代表资产身份。
- 同一 `assetId@version` 必须不可变；变更任何源文件字节、元数据或能力声明，应产生新版本与新的索引指纹。原文件不可就地覆盖。
- 升级规则：同一主版本只允许**显式定义**的兼容变更；有 breaking change 时升级主版本。旧 Schema 使用纯函数迁移器，保留原输入和迁移报告，迁移失败不能静默降级。
- 路径为以包根目录为基准的 POSIX 相对路径；禁止 `..`、绝对路径、反斜杠、符号链接逃逸、非法字符与大小写冲突。实际路径校验必须基于规范化/realpath，Schema 正则只做第一层。
- `AssetDefinition.kind` 是具体资源能力类别，`role` 是游戏语义（例如 `actor.player`）；`ThemePack` 中 role 可候选多个 asset，必须经过 Resolver 才能绑定游戏 slot。

### 3.2 示例（与附件一致，简化）

```json
{
  "schemaVersion": "1.0.0",
  "gameId": "space-shooter-basic",
  "genre": "arcade_shooter",
  "slots": {
    "player.main": {
      "kind": "sprite2d",
      "role": "actor.player",
      "required": true,
      "requiredStates": ["idle", "hit", "destroyed"],
      "direction": "up",
      "fallbackPolicy": "none"
    },
    "bullet.player": {
      "kind": "sprite2d",
      "role": "projectile.player",
      "required": true,
      "requiredStates": ["idle"],
      "fallbackPolicy": "procedural-preview"
    }
  }
}
```

`GameAssetRequest` 是 **A2Asset 独立协议**，不是声称 `game-design` 已经输出以上字段。M0 必须提供从真实 `GameSpec` 到该请求的映射规则，并建立 fixture；无法映射的概念要列为显式 unsupported capability，不得为适配而修改既有游戏规则。

### 3.3 语义校验补充（Schema 无法独立表达）

必须实现：

1. `requiredStates` ⊆ `AssetDefinition.capabilities.states`；方向、视角、像素密度、尺寸和渲染能力可兼容。`sprite2d` 的多状态必须有真实帧/片段映射，不可只填状态名。
2. `ThemePack`、`GenreKit` 所有引用存在且无继承循环；同名 ID/版本/内容不同触发冲突。
3. `AssetDefinition.sources`/`variants` SHA 与实际字节相符；P0 不允许缺失证据文件；`stateFrames` 的 sourceIndex 必须落在 `sources` 数组中，`capabilities.states` 与 `stateFrames` 键集合保持一致，且帧时长严格为正。`ui9slice` 的边距与图片像素尺寸相容；`tilemap2d` 的图块索引不得超出图集；`vfx2d` 仅能引用批准的 Effect ID。
4. `BundleManifest.files` 不允许重复路径不同摘要；bindings 所有 paths、`atlasRegion.file`、`stateClips.frames[].file` 均出现在 files；`stateClips` 的帧时长、矩形范围、偏移与原始尺寸必须可用；Pack 中只包含白名单目录与确实使用的依赖。
5. `Production` 禁止 `placeholder: true`，required slots 全部绑定；可选 slot 未绑定时记录 `optionalMissing` 诊断但禁止生成悬空引用。
6. `published` 的素材必须满足 `approvalStatus=published`、`redistributionApproved=true`、证据存在、审核人和日期合法；`LicenseRef-*` 或 `NOASSERTION` 需额外人工权利结论，不能自动视为可分发。
7. 任何跨文件语义校验失败均应附具体 JSON Pointer 路径、错误码、资产 ID 和修复建议。

## 4. 标准素材分类、ThemePack 与 GenreKit

- **类型维度**：`sprite2d/background2d/animation2d/atlas2d/tilemap2d/ui9slice/vfx2d/audio/font`。
- **语义维度**：建议建立 versioned role taxonomy：`actor.player`、`actor.enemy`、`projectile.player`、`item.collectible`、`obstacle.static`、`tile.floor`、`ui.button`、`effect.explosion`、`audio.hit`、`audio.music` 等，支持显式别名迁移；不允许自由文本在生产中未经审查自动新增 role。
- **视觉维度**：`renderStyle`、颜色、对比度、视角、轮廓、像素密度、光照方向、帧动画风格，必须有 ThemePack 的 review 状态。
- **GenreKit** 是**需求模板**（例如射击需要 player/enemy/projectile/effect/audio），不是可替代玩法逻辑的代码模板。**ThemePack** 是**视觉/素材组织单元**，不是一个保证所有玩法需求都自动满足的万能包。
- `ThemePack + GenreKit` 只形成候选集合，必须通过契约检查才可称该游戏可构建。素材无法覆盖的结果以缺失报告呈现。
- v1.0 最少需要两个**人工批准**的视觉主题（例如几何/像素），所有第三方资源附原始许可和证据。不能仅收录“来源写 CC0”的不明素材。

## 5. Registry 与导入/审批生命周期

### 5.1 数据存储与索引

```text
.a2asset/
  registry/definitions/<assetId>/<version>.json
  registry/themes/<themeId>/<version>.json
  registry/genres/<kitId>/<version>.json
  store/sha256/<first2>/<digest>           # 不可变二进制 Blob
  provenance/<assetId>/<version>/...         # 许可/来源证据，不随包默认发布
  quarantine/<importId>/...                  # 待审/不受信输入
  cache/<cacheKey>/...                       # 可删的中间产物
  builds/<buildId>/...                       # 已完成版本包
```

以 JSON/文件系统为第一版权威源，内存索引可重建；不得让 SQLite/搜索服务成为 v1.0 离线运行的强依赖。索引条目指向 Blob SHA，所有读操作校验实际内容哈希。导入时使用临时目录及原子替换，避免部分写入污染 Registry。

### 5.2 来源和授权要求

允许：拥有使用/再分发权利的自有素材、经过审查的第三方资源、传统程序化资源。第三方资源即使“免费下载”，也不得直接假定支持商用、修改和重新分发。

每个素材必须记录 `origin`、来源链接（如有）、作者、许可证表达式（优先 SPDX，如 `CC0-1.0`）、原始许可证全文/证据文件路径、是否允许本项目打包再分发、审查人、审查时间、修改说明。`NOTICES`/credit 自动从已批准资产的归属要求生成。License Expression 的解析不等于法律确认，应保留人工判断。

状态流转：

```text
imported -> inspected -> approved -> published -> deprecated
     \          \           \
      +----------+-----------+--> quarantined
```

- `imported/inspected/quarantined` 不可供 Production 解析。`approved` 表示已通过内部审核，**只有** `published` 可进入 Production 包。
- 从 `deprecated` 恢复应走新审查记录，不得悄悄覆盖历史批准结果。
- 导入文件为不可信数据：需限制大小、尺寸、帧数、压缩比、处理时长；使用成熟解析器并隔离处理；失败留下报告、原件隔离，不进入公开索引。
- **v1.0 不提供自动联网检索与抓取。** 可以存来源 URL，但下载行为必须由外部授权流程完成。

## 6. Resolver 完整规则与确定性承诺

### 6.1 输入/输出

输入：`GameAssetRequest` + `VisualSpec` + 可选 `AssetBinding` + `ThemePack` + `GenreKit` + `BuildProfile` + Registry 快照。  
输出：`ResolveResult`：`bindings`、`missingRequired`、`missingOptional`、`ambiguous`、`rejectedCandidates`（含 code/reason）、`provenanceRefs`、`registryDigest`、`success`。不返回“看起来合适”的主观分数。

### 6.2 固定选择算法

1. **验证**全部输入 Schema、跨对象关系、Registry 与权利信息。出现非法输入立即失败。
2. **候选过滤**：要求 `published`、权利可分发、`kind/role/requiredStates/direction` 一致、平台格式可加工、尺寸与 Profile 可兼容；不兼容候选不得通过高分排序被选中。
3. **绑定优先级**：固定 `AssetBinding` > slot `preferredAssetId` > ThemePack roleBindings > GenreKit defaults > Registry 合法候选。显式绑定也必须通过所有硬约束。
4. **同级排序**：先以 ThemePack 明确优先级、平台原生变体、兼容性特征进行离散排序；完全同优先级且不同内容时，返回 `E_RESOLVE_AMBIGUOUS`，**不得**仅靠字典序偷偷选一个。候选列表按 `assetId@version` 排序保证稳定诊断。
5. **锁定**：任何选定的 `assetId@version` 及源文件哈希写入 `AssetBinding`/`AssetLock`。生产模式不允许隐式浮动到“最新版本”。
6. **缺失**：required 缺失 → Production 失败；optional 缺失 → 明确的可读警告并不写悬空绑定；Preview 仅当 slot `fallbackPolicy=procedural-preview` 且目标存在已批准占位实现时，才可标记占位继续运行。
7. **输出**：相同锁定输入/快照/处理器版本必须得到相同绑定与有序诊断；资源变更触发新 digest，不允许读到旧的静默缓存。

### 6.3 Resolver 反例验收

- 缺少玩家 `destroyed` 状态：拒绝该候选，而不是用 idle 伪装。
- 两套同级敌机素材同时合格：要求明确选择，返回候选列表。
- 已 pin 素材变更 SHA：失败，报告锁定漂移。
- 预览使用几何占位子弹：构建结果显著标记 `placeholder=true`；同输入切 Production 必须拒绝。
- 许可证缺失/再分发未批准：无论外观多好，Production 必须拒绝。

## 7. Processor 与 Build DAG

### 7.1 Processor 接口（建议 TypeScript 签名）

```ts
export type AssetKind =
  | 'sprite2d' | 'background2d' | 'animation2d' | 'atlas2d'
  | 'tilemap2d' | 'ui9slice' | 'vfx2d' | 'audio' | 'font';

export interface ProcessorContext {
  readonly workspace: string;       // 隔离的构建临时目录
  readonly profile: BuildProfile;
  readonly toolchainVersion: string;
  readonly abortSignal: AbortSignal;
}
export interface ProcessorInput {
  readonly asset: AssetDefinition;
  readonly sourceHashes: readonly string[];
  readonly normalizedOptions: Readonly<Record<string, unknown>>;
}
export interface ProcessorOutput {
  readonly files: readonly { path: string; sha256: string; bytes: number }[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly processorVersion: string;
}
export interface AssetProcessor {
  readonly id: string;
  readonly version: string;
  supports(kind: AssetKind, profile: BuildProfile): boolean;
  process(input: ProcessorInput, context: ProcessorContext): Promise<ProcessorOutput>;
}
```

`supports` 和 `process` 是普通本地工具能力接口，**不得实现 AI 生成类 Provider**。`normalizedOptions` 应有各 Processor 专属闭合 Schema，不能接收任意脚本作为配置。若需要脚本式程序图形，必须来自已批准、受限的本地代码模块，不得直接执行从素材包带来的任意源码。

### 7.2 处理边界

- Image：受控解码，Trim 时保留 `sourceSize/trimOffset/pivot`；缩放必须标明算法，像素风不得误用双线性缩放；色彩空间固定 sRGB，Alpha 语义明确（Straight/Premultiplied）。
- Atlas：确定性排序、Padding/Extrude、最大尺寸、同一像素密度与采样策略分组；每张 sprite 生成裁剪 rect、旋转标记、pivot 和原尺寸；v1.0 可以禁用旋转以降低适配风险。
- Animation：状态→帧序列、单帧时长（毫秒整数）、循环布尔、事件 ID；有可控上限，检查帧完整性和 Pivot 漂移。`destroyed` 等状态不得只有空列表。
- UI：Nine-slice Insets 以像素整数定义，确保缩小后边界不发生负值；字体仅支持有明确授权的 WOFF2，浏览器中做缺字/回退测试。
- Audio：源格式解析、通道数/采样率/时长检查，转换工具版本固定；不要假定所有浏览器对所有编码支持一致，必须实测 `BuildProfile` 所声明目标。
- VFX：仅标准帧动画或受限参数化几何特效，禁止运行时下载、运行任意 Shader 源码、执行素材带来的 JS。

### 7.3 构建步骤

```text
ValidateInputs → SnapshotRegistry → Resolve → Plan
 → LoadTrustedBytes → Normalize/Transform → Atlas/Encode
 → ValidateArtifacts → EmitManifest/Lock/NOTICES
 → VerifyStaging → AtomicPublish → E2EAdapterLoad
```

- 构建步骤必须有 DAG 节点 ID、输入/输出 digest、processorVersion、缓存行为、耗时、状态、诊断和可重试性记录。
- 缓存键 = SHA256(canonical JSON(任务类型、上游 SHA、完整 AssetDefinition/Binding 语义摘要、Registry 审批快照、Profile、选项、Processor 和 Toolchain 版本))；版权状态、元数据和审查变化必须使相关结果失效，不得只以文件名/mtime 作为依据。
- 采用可定义的稳定 JSON 序列化（键排序、UTF-8、无动态时间戳）与固定资源排序。打包 ZIP 时固定文件顺序/时间戳，动态审计时间存放在不参与复现哈希的外部运行报告。
- 输出路径仅允许 staging 下白名单位置；所有候选产物先检查权限/引用/预算/哈希，再原子替换发布目录。失败后保留上一次成功包，不得发布半成品。
- 对非确定性第三方转换器，必须将精确工具版本、环境和产物字节 hash 纳入锁；如果无法保证同环境重建，一律标记 `UNVERIFIED_REPRODUCIBILITY`，不能宣称字节级可复现。
- 增量构建必须验证“只修改一个 Sprite 不触发无关音频转码”；有依赖的 Atlas 应重建。

## 8. BuildProfile 与交付结构

示例 Profile 在 `examples/build-profile.json`；2048×2048 Atlas、16 MiB 包大小、8 图集上限是**初始试验预算**，须 M0 依真实 WebGL2 设备矩阵调整。构建时超预算输出详尽清单并拒绝 Production 发布；Preview 可只给警告但不可突破安全上限。

```text
dist/<gameId>/<profileId>/
  game.json                  # 上游玩法配置原样引用/复制，格式由 M0 确认
  asset-manifest.json        # 运行时唯一权威资产入口
  asset-lock.json            # 构建期/审计使用
  assets/                    # 只包括真正引用到的二进制/数据
  LICENSES/                  # 需要随包分发的文本
  NOTICES.txt                # 归属/许可说明
  reports/                   # validation / build / provenance / screenshots
```

**运行时最小包**可排除 `asset-lock`、源许可证证据、debug reports（但须保留许可证所要求的 NOTICES/Licenses）。完整交付包保留审计信息。禁止无意包含供应链内审资料和原始私人路径。

## 9. SDK、CLI、错误与退出协议

### 9.1 公开 SDK 建议接口

```ts
export interface A2AssetAPI {
  inspect(request: GameAssetRequest): Promise<InspectReport>;
  importAssets(paths: readonly string[], options: ImportOptions): Promise<ImportReport>;
  resolve(input: ResolveInput): Promise<ResolveResult>;
  build(input: BuildInput): Promise<BuildResult>;
  validatePackage(path: string, profile: BuildProfile): Promise<ValidationReport>;
}
```

所有公共 API 的结果结构都必须包含：`schemaVersion`、`status: PASS|FAIL|BLOCKED`、结构化 `diagnostics[]`（`code,severity,path,message,remediation`）、`artifactPaths[]`。`Promise` reject 仅用于无法恢复的系统错误；可预期的输入/缺素材错误须返回明确失败报告。取消信号通过到子任务；构建超时和资源超限与功能失败区分。

### 9.2 CLI 最小合同

```bash
# 以下为待实现命令，不是已存在的工具

a2asset inspect examples/game-asset-request.json --json
a2asset import ./licensed-assets --registry ./.a2asset --report reports/import.json
a2asset registry list --kind sprite2d --role actor.player --json
a2asset registry approve ships.blue-falcon@1.0.0 --review-record ./approval.json
a2asset resolve examples/game-asset-request.json --visual examples/visual-spec.json --theme sci-fi-neon --profile examples/build-profile.json --out out/resolve.json
a2asset build examples/game-asset-request.json --visual examples/visual-spec.json --profile examples/build-profile.json --bindings out/bindings.json --out dist/space-shooter-basic
a2asset validate dist/space-shooter-basic --json
```

行为：所有命令可输出 `--json` 单个结构化 JSON 至 stdout；进度日志/警告输出 stderr；无交互模式 `--non-interactive` 不允许弹窗确认；不得悄悄覆盖既有审核记录。

**退出码**：`0 PASS`；`2 用户输入/Schema/匹配失败`；`3 权利或安全策略拒绝`；`4 构建/处理失败`；`5 运行环境/外部工具故障`；`130 用户取消`。`BLOCKED` 显式包含失败原因，不可把 `infra_failure` 计为业务成功或错误修复。

**错误码最小集**：`E_SCHEMA_INVALID`, `E_REFERENCE_MISSING`, `E_RESOLVE_MISSING`, `E_RESOLVE_AMBIGUOUS`, `E_LOCK_DRIFT`, `E_LICENSE_UNKNOWN`, `E_RIGHTS_DENIED`, `E_SECURITY_PATH_ESCAPE`, `E_SECURITY_UNSAFE_CONTENT`, `E_PROCESSOR_UNSUPPORTED`, `E_BUILD_BUDGET`, `E_BUILD_NONDETERMINISTIC`, `E_RUNTIME_LOAD`, `E_RUNTIME_DISPOSE`。

## 10. CocosAirJS Runtime Adapter 规格

**前提**：M0 对当前 `cocosairjs` 提供的真实纹理、Sprite、Audio、Font、动画、销毁 API 和模块入口做 API Inventory（实际源码路径/导出签名/可运行示例/SDK SHA）。若缺失，列适配限制或提交独立引擎改动计划，不得编造接口；本任务默认不修改引擎主仓。

接口建议（通用抽象，不等于 CocosAirJS 现有 API）：

```ts
export interface GameAssetRuntime {
  loadBundle(manifestUrl: string, options?: { signal?: AbortSignal }): Promise<BundleHandle>;
  acquireSprite(handle: BundleHandle, slot: string): Promise<SpriteHandle>;
  createAnimation(handle: BundleHandle, slot: string, state: string): Promise<AnimationHandle>;
  acquireAudio(handle: BundleHandle, slot: string): Promise<AudioHandle>;
  releaseAsset(asset: SpriteHandle | AnimationHandle | AudioHandle): void;
  disposeBundle(handle: BundleHandle): Promise<void>;
}
```

约束：

1. 运行时只按 `BundleManifest` 加载，无访问开发态 Registry、文件绝对路径或联网检索。
2. `slot` 是唯一可用逻辑引用，`AssetId` 不应在玩法代码中硬编码；Manifest 负责映射到图集 rect/纹理、`stateClips`（逐帧时间、Pivot、Trim）、Nine-slice、Tilemap 和音效文件。
3. 统一逻辑坐标、UI 设计尺寸、pivot 以 0..1 归一化表示；引擎坐标轴差异由 Adapter 转换，禁止绕过 Adapter 直接重写玩法速度或位置。
4. 共享纹理/图集引用计数与资源生命周期明确；并行加载和取消、失败回滚、场景销毁后清理、重复进入退出均需测试。
5. 音频播放必须遵守浏览器用户手势限制；不将“文件可解码”冒充“可自动播放”。
6. 同一个 Binding 在同一个 Profile 下不同浏览器应有相同语义与布局，像素差异按容差管理；错误路径必须有可见的降级/报错，不可静默不显示。

## 11. 视觉质量契约与人工审查

**质量保证边界**：不用 AI 时，自动化只保证客观属性与已冻结的视觉设计规则；画面好看与否仍需人工确认。`VisualSpec` 是可检查的设计约束，不是生成高品质美术的保证。

- **G0 结构**：100% Schema、引用、版本兼容检查；不得有未解决 `required` slot。
- **G1 素材**：100% 文件哈希/路径/尺寸/Alpha/编码/版权检查；动画所有必需状态可预览、无空帧/越界。
- **G2 风格**：基于人工批准 ThemePack，检查色板、视角、轮廓、像素密度、UI 安全区；真实场景的截图由人工签署视觉验收，评审记录绑定游戏/主题/构建 SHA。
- **G3 运行**：实际浏览器中跑通四款游戏，检查画面、动画、碰撞反馈、音效触发、释放；采集加载时间、纹理预算、帧率及错误日志（目标阈值在 M0 设备矩阵冻结）。

**视觉审查流程**：`reference/approved.png` + `current/*.png` + `visual-review.json`（判定、差异解释、评审人、时间、构建 SHA）。自动截图差异只用于发现回归，不得把绝对像素比较当成唯一质量指标；浏览器/显卡差异须声明容差。

**禁止伪造证据**：只允许实际运行产出的截图；概念图不得标为游戏运行结果。无法执行的浏览器测试标记 `INFRA_FAILURE`/`BLOCKED`，不能计入 PASS。

## 12. 安全、许可与供应链门禁

- 离线优先：默认禁止网络访问、远程执行、外部脚本。下载/同步仓库资源需单独审批，超出 v1.0 默认范围。
- 解压安全：路径穿越、绝对路径、符号链接、大小写冲突、压缩炸弹、过多文件、不可信文件名和 ZIP 目录重复项必须拒绝。
- 内容安全：文件 magic 与声明扩展/类型匹配；对 SVG、字体、音频和图像使用维护中的解析器，并实施沙箱/资源上限；拒绝 Active Content 与随素材携带的 JS。
- 资源上限：对单文件大小、像素总数、帧数、解码时间、解压比例设 Profile 上限（默认值经 M0 压测）。取消或超时必须回收子进程。
- 权利门禁：`sourceUrl`、`licenseExpression`、证据、审核人、`redistributionApproved` 缺一不可发布；license 标记不自动等价于商用或再分发许可。
- 审计：保存可重复构建所需的源哈希/版本/审查记录，且可从分发包剔除敏感审计数据。
- 依赖安全：锁定依赖版本并检查许可证/漏洞；不允许通过“修复”自动升级依赖并打破构建复现。

## 13. 基准游戏、负例和测试矩阵

### 13.1 四个真实主样本（必须有实际画面，而非接口假实现）

| ID | 类别 | 验证重点 | 最少输出 |
|---|---|---|---|
| `BG-01` | 下落方块 / 俄罗斯方块 | 程序几何、统一 UI、主题配色、缩放 | 运行视频/截图、manifest、hash |
| `BG-02` | 三消 | Sprite/Atlas、交换/消除反馈、九宫格 UI | 两套主题真实截图、动画录制 |
| `BG-03` | 打飞机 | 玩家/敌人/子弹/爆炸/背景/音频/生命周期 | 敌我动效、场景切换、释放报告 |
| `BG-04` | 横版平台 | Tilemap、角色状态/Pivot、镜头和场景拼接 | 镜头跟随截图、越界/动画检查 |

其中 `BG-04` 可能不在 `game-design` 当前六类原型中，**由 M0 建立一个独立最小验收用例，不得声称现有仓库已经实现**。`BG-01/02/03` 优先复用其已有下落方块、三消、射击参考运行时，避免重做规则。使用合法、经过审批的资源和固定游戏种子。

### 13.2 分层测试

- Unit：Schema 正反例、类型/尺寸/状态/许可、不可变版本、Resolver 决策表、缓存键、Atlas 裁剪位置。
- Integration：真实文件导入→审批→注册→解析→构建→Manifest/Lock/NOTICES→验证；断网场景通过。
- Negative/Security：损坏图片、超限图、恶意压缩、绝对路径、symlink、不同文件同 ID、缺许可、两候选平分、缺状态、错误 SHA、缓存污染。
- E2E：CocosAirJS 真正加载四个基准样本，执行固定输入与可重复脚本；取截图、日志、资源释放计数，浏览器至少 Chromium + Firefox + WebKit（如环境具备）；不可用时标为 BLOCKED 并不能签发全量通过。
- Regression：改 1 个素材触发对应 Atlas 而不触发无关音频；重复同环境两次构建产物文件哈希相同；生产环境零 placeholder。
- Scale：先执行 4 样本，再 6 类现有原型，后续对 50/100 个素材需求目录做覆盖率分析。若素材不足，给出可复核缺失统计，不虚称“全部可构建”。

### 13.3 建议量化指标（待 M0 冻结基线）

- P0：必需引用缺失数 0；未经批准素材流入 Production 数 0；真实文件/Manifest 哈希差异数 0；静默错误数 0。
- P0：同环境重复构建在固定资源、处理器和锁时，相同产物字节哈希；否则明确 fail 或标记未认证，不能悄然发版。
- P0：四个端到端游戏的必需场景/状态均实际执行并保存证据；所有 G0/G1/G3 强制门禁通过；G2 人工审核有签字记录。
- P1 参考：95% 的合法正例导入可在可预期预算内完成；增量重构时间、包体大小、纹理峰值和实际 FPS 的目标值须 M0 通过真实机器测试确定，不写不可靠的“凭空保证”。

## 14. M0—M5 开发任务分解、依赖和验收

**任务 ID 固定，按 Gate 顺序推进。每个任务完成必须有：设计/代码 diff、测试、运行证据、错误样本、剩余风险与依赖更新。不得把 Mock PASS 代替真实引擎 PASS。**

### M0 — 规格冻结、源仓勘查与最小垂直切片

- `M0-01` 阅读 `game-design` 实际 GameSpec/adapter/fixture 与 `cocosairjs` SDK/API，输出 `docs/compat-inventory.md`：具体 SHA、路径、API 导出、现存能力、差距与潜在补丁；不要未经批准改其他仓库。
- `M0-02` 从 6 类原型提取 `GameAssetRequest` 样本；冻结自动映射表和非法项规则；不改现有玩法逻辑。
- `M0-03` 冻结九份 Schema 和语义 Validator 规则，给每个对象不少于 1 正例/2 反例，并形成校验脚本。
- `M0-04` 冻结角色 taxonomy、资源类型、平台预算和 4 个基准样本的输入契约。
- `M0-05` 实现**最小纵向原型**：将手工提供的几何 Sprite 绑定到一个已存在游戏槽位，生成 Manifest，用真实 CocosAirJS 加载并截图；此切片用于验证接口可行性，不以此跳过后续模块。
- **Gate M0**：完整映射与 API Inventory 已验证；协议正/反例可执行；一条真实引擎资源加载链路通过；硬阻塞有清晰的限制/改造建议。没有上述证据则停止进入 M1。

### M1 — Registry、导入、审批与安全边界

- `M1-01` Blob 哈希仓与 JSON 索引、不可变版本、冲突检测、原子写入；证明同字节不重复存储。
- `M1-02` Importer、安全解压、解码限额、原始文件和临时缓存隔离。
- `M1-03` 授权证据、人工审批、状态机、NOTICES 规则及拒绝发布测试。
- `M1-04` Registry SDK/CLI 查询、批量导入、检索、出错可解释。
- **Gate M1**：合法样本完整导入/审批/查找；路径穿越、版权未知、恶意资源被拒绝，原文件未被覆盖。

### M2 — Resolver、Processor、Builder 与 CLI

- `M2-01` Resolver 硬约束/优先级/冲突/可选缺失/Preview 占位，最少覆盖 §6 所有反例。
- `M2-02` PNG/WebP 基础 Processor、Sprite 状态/帧、Trim/Pivot、确定性 Atlas，配负例。
- `M2-03` UI Nine-slice、字体和音频基础处理以及媒体 Profile 能力校验。
- `M2-04` DAG、缓存键、取消、原子发布、资源预算、Manifest/Lock/NOTICES。
- `M2-05` CLI/SDK 一套实现；结构化诊断、退出码、`--json` 机器读取测试。
- `M2-06` 基础正交 Tilemap2D（图块集/层、索引检查、纹理依赖）与受限 VFX2D（序列帧/白名单效果 ID）处理，并使用 BG-04/射击特效的真实输入校验，禁止将任意脚本作为特效输入。
- **Gate M2**：三消与射击样本使用真实已批准素材自动构建，错误/冲突时拒绝、重复构建摘要一致，增量缓存有测量证据。

### M3 — CocosAirJS 真实运行时适配

- `M3-01` 依据 M0 审计结果实现真实纹理、图集、帧动画、UI 和音频加载/释放。
- `M3-02` 固化坐标、Pivot、缩放、色彩空间与 Alpha 契约，录制回归截图。
- `M3-03` 真实运行四个基准游戏，模拟加载失败、取消、切场景、反复启动退出。
- **Gate M3**：每款至少 1 条真实浏览器交互与截图证据，资源引用/生命周期审计无已知 P0；不允许通过纯 mock 适配器交付。

### M4 — 主题包、品质与样本扩展

- `M4-01` ThemePack 与 GenreKit 的格式、继承 DAG、冲突解决和资产引用语义检查。
- `M4-02` 至少两个审过权利和视觉规范的 ThemePack；基准游戏至少一个可实际切换主题。
- `M4-03` G2 可视审核单、视觉参考图、对比截图与审批记录；没有人工签署不能视为视觉 PASS。
- `M4-04` 使用现有六类游戏做素材需求覆盖率盘点，并形成可复用率/缺失率统计。
- **Gate M4**：玩法逻辑不修改即可更换风格包；不满足能力约束的主题组合明确失败；人工视觉验收可追溯。

### M5 — CI、规模、发布与交付验收

- `M5-01` 单元/集成/负例/安全与 E2E 进入 CI，声明所用 OS/浏览器/引擎 SDK SHA。
- `M5-02` 可复现构建、断网验证、缓存污染、异常终止、权限回退与升级迁移。
- `M5-03` 50 样本需求分析（未覆盖的明确列缺口）；可选扩展到 100 样本，不允许虚报完成。
- `M5-04` README、API、CLI、Schema、迁移、用户工作流、发布条款与许可证清单。
- `M5-05` 全部 Gate 汇总、已知问题、未验证项、版本号与发布候选报告。
- **Gate M5**：DoD 所有阻塞条目 PASS、实际证据可复核、可在干净环境安装和构建；未通过不得宣称 v1.0 正式完成。

**多 Agent 协作**：M0 的协议信息由单一 Owner 冻结；M1 的 Registry/Importer 和 M3 的技术 PoC 可以并行调研，但不能绕过 M0。M2 各 Processor 可并行，必须共享固定接口和 Contract Tests；负责 Builder 的 Agent 统一集成。一个合并窗口只能有一个集成 Owner。每次 PR 必须附源码改动范围、基线/测试证据/风险/待验证项；提交、推送、部署和权限修改依实际授权执行，禁止未经授权改变现有仓库或用户数据。

## 15. 全局 Definition of Done（完成的唯一判据）

1. **接口**：九种 Schema 有校验器、正/负 fixtures、版本/迁移规则和跨文件语义检查，文档和实现一致。
2. **权限**：100% Production 资产有授权证据、再分发结论和正确 NOTICES；未知来源默认拒绝。
3. **流程**：合法资源从 Import/Review/Registry/Resolve/Build/Publish/Runtime 真正打通；无外部网络/AI 依赖。
4. **可复现**：锁定输入下相同环境的产物内容哈希可复现；缓存/中断/原子发布测试通过。
5. **真实运行**：四款基准游戏可通过 CocosAirJS 实际加载；G2 人工视觉审核通过，G3 有真实截图/日志/性能报告。
6. **异常**：所有 §6/§12 关键安全与负例不得静默通过；失败后无损坏的正式资源包。
7. **工程质量**：代码检查/单测/集成/E2E 全部实测；输出工具版本和引擎 SHA；失败、环境故障、未执行分别统计。
8. **交付**：源码、CLI/SDK、示例、测试、权限与许可证清单、Schema、API 文档、兼容性报告、发布说明齐全。
9. **边界**：没有 AI 素材生成或隐式联网入口；不把未来 Web Studio/3D/第二引擎称作 v1.0 已实现。

## 16. Agent 执行协议（可直接复制到实施工单）

> 任务：在**用户明确授权的本地工作区**实施《A2Asset Toolkit v1.0 — 架构规格与开发任务书》。执行前读取实际 Git 状态、用户修改与依赖版本，严禁覆写未提交更改；仅做增量修改。先完成 `M0-01` 到 `M0-05` 并提交核查证据，未通过 Gate M0 不得开始主系统开发。之后按 M1→M5 Gate 推进；不同 Agent 可并行实现无冲突模块，但统一使用 `schemas/*.schema.json` 与 Contract Tests，不允许自行创造不兼容字段。所有资源来源必须有可审查的授权，禁止 AI 生成素材和自动联网抓取。每阶段报告 **完成 / 未验证 / 失败**，给出运行命令、实际结果、Git diff、SHA、截图和阻塞原因；不得用假样本、构造 PASS、模拟截图或未运行测试代替证据。提交、推送、PR、部署和权限变更遵守当前授权边界；需要修改 `game-design` 或 `cocosairjs` 主仓时，先形成独立兼容性提案，不直接跨仓修改。最终只有通过 §15 全部 DoD 才标记 v1.0 正式完成。

## 17. 工程验收命令（实施后的目标合同，不代表目前存在）

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:contracts
npm run test:integration
npm run test:security
npm run test:e2e
npm run verify:reproducible
npm run verify:offline

# 构建实际游戏
npx a2asset inspect examples/game-asset-request.json --json
npx a2asset resolve examples/game-asset-request.json --visual examples/visual-spec.json --profile examples/build-profile.json --out artifacts/resolve.json
npx a2asset build examples/game-asset-request.json --visual examples/visual-spec.json --profile examples/build-profile.json --bindings artifacts/bindings.json --out dist/space-shooter-basic
npx a2asset validate dist/space-shooter-basic --json
```

**当前附件可先独立验证 Schema 结构/示例；上述 npm/a2asset 命令需开发完成才可运行。** `examples/asset-definition-UNPUBLISHABLE.json` 的哈希和来源是故意虚构的结构样本，不对应真实二进制、不可用于构建/发布。若 M0 实际仓库审计发现接口能力不符，应更新兼容性报告和任务差异，不得声称用户已确认这些接口。

## 18. 开发前仅剩的外部硬前置条件

这些不是要求用户现在回答的问题，而是 M0 任务必须通过工程证据解决的条件：

- `GameSpec` 实际素材映射字段是否可通过稳定桥接器提供；如没有，先在 A2Asset 侧增加转换层，不入侵既有规则。
- CocosAirJS SDK 的纹理、动画、字体、音频、销毁接口哪些是已经实现/已验收；不支持时按影响调整 v1.0 子集并保留差距清单。
- 获得至少两套**许可确定且人工批准**的基准素材源，建立真实 G2 视觉参考；没有授权资源时不能完成 Production 演示。
- 浏览器测试及设备预算的真实基线，包括 WebGL2 支持、纹理上限、音频编码及正常资源释放。

**规格定稿判据**：M0 报告给出上述四项的证据和决议，并更新本文件为 `Implementation Baseline`；此前它是**足够详细的开发输入**，不是声称工程已完全验证的事实。
