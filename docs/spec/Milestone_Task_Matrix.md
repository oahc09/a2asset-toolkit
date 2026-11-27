# M0–M5 执行任务矩阵（v1.0）

> 前提：目标工作区与 Git 基线由执行时发现；任务 owner 是角色，不绑定实际人员。可并行调研，但 Gate 不可跳过。任务完成必须同时交付代码/文档、实际测试与可复现证据。

| ID | 依赖 | 主要交付 | 验收证据 | 建议角色 |
|---|---|---|---|---|
| M0-01 | 无 | compat-inventory、SDK API 对照表 | 源码路径+SHA、真实调用 | Compatibility |
| M0-02 | M0-01 | 6 原型 GameAssetRequest 映射器 | 原 GameSpec fixture 对照 | Contract |
| M0-03 | M0-02 | 9 Schema/Validator 和迁移规则 | 正/负例自动测试 | Contract |
| M0-04 | M0-02 | Taxonomy、Profile 与 4 benchmark 输入 | 冻结配置+人工审查记录 | Architecture |
| M0-05 | M0-01/03 | 1 条真实 CocosAirJS 资源加载切片 | 浏览器运行截图+错误日志 | Runtime |
| M1-01 | M0 Gate | Blob Store、Registry 索引、不可变版本 | 去重/冲突/原子事务测试 | Registry |
| M1-02 | M0 Gate | Importer、安全输入隔离 | 恶意压缩/路径/大图负例 | Importer |
| M1-03 | M1-01/02 | 许可审核和审批状态机 | 未授权资源拒绝发布 | Governance |
| M1-04 | M1-01/03 | registry CLI/SDK | 导入→审批→查找实例 | CLI |
| M2-01 | M1 Gate | Resolver + 绑定锁 | 6 组确定性决策反例 | Resolver |
| M2-02 | M1 Gate | Sprite/帧/Atlas Pipeline | atlasRect、Pivot、源图样本测试 | Processor-Image |
| M2-03 | M1 Gate | UI/Font/Audio 处理 | Nine-slice、解码/许可测试 | Processor-Media |
| M2-04 | M2-01/02/03/06 | Builder DAG、cache、lock、publish | 重复构建一致、断点恢复、失败回滚 | Builder |
| M2-05 | M2-01/04 | 公共 CLI/SDK 与诊断 | stdout/stderr、退出码测试 | CLI |
| M2-06 | M1 Gate | Tilemap/VFX 白名单 | BG-04 tilemap、射击特效验证 | Processor-Scene |
| M3-01 | M0-05/M2 Gate | Runtime Adapter | 实际引擎加载/释放 | Runtime |
| M3-02 | M3-01 | 坐标、Pivot、Alpha 合同 | 标准截图/动画无偏移 | Runtime |
| M3-03 | M3-02 | 四个实际可玩基准样本 | 浏览器截图/日志/资源释放报告 | E2E |
| M4-01 | M2 Gate | ThemePack/GenreKit 引用规则 | 组合/循环/缺失反例 | Theme |
| M4-02 | M4-01/M3 Gate | 两套合法、批准 ThemePack | 可切换主题且玩法规则不变 | Theme+Design |
| M4-03 | M4-02 | G2 人工视觉验收体系 | 参考图/实机截图/审核签字 | QA+Design |
| M4-04 | M4-02 | 6 类游戏覆盖盘点 | 复用率/缺失率报告 | QA |
| M5-01 | M4 Gate | CI、系统测试、浏览器矩阵 | 实际 CI 日志/环境清单 | CI |
| M5-02 | M5-01 | 离线、复现与安全压力测试 | 构建重现/回滚/断网报告 | Security+CI |
| M5-03 | M5-02 | 50 样本规模测试 | 实际覆盖与缺口报告，不得虚报 | Benchmark |
| M5-04 | M5-01 | 用户文档与发布包 | 干净环境安装核验 | Docs+Release |
| M5-05 | 全部 | 最终 DoD 审查与发布候选 | 完成/失败/未验证逐项证明 | Integration Owner |

## 任务分派与 PR 约束

- 同一里程碑可并行完成相互独立的 `M1-01/M1-02`、`M2-02/M2-03/M2-06` 等，但不能多 Agent 同时编辑同一个公开 Schema 或 Builder API。
- 任务实行 **Contract-first**：输入数据与测试先冻结，再实现代码；与冻结接口冲突必须提出变更说明与影响范围。
- 每项产出附 `STATUS=PASS|FAIL|BLOCKED`；测试未运行不能写 PASS，且 `INFRA_FAILURE` 与功能失败单独列。
- 不得为让 CI 变绿而删除现有测试、放宽许可证门禁、忽略浏览器失败或自动修正用户素材。
- 所有跨仓代码改动、PR、推送和部署遵守执行时授权；本文仅设计任务，不构成直接修改远端仓库的授权。
