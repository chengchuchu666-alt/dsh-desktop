# 项目现状与目标审查（2026-10-19）

审查基线：`26776d58df14a7bc2777a6aa593994ebc9ffac00`。代码版本为
`0.2.1-rc.2.shell.1`；内置 Harness 为 `0.2.1-rc.2`，随包 Node 固定为
`v24.21.0`。本文件只做研究与交接，不授权发布、真实用户数据迁移或远端状态修改。
后续执行时先重新核对 HEAD、工作区和相关源码；这里的历史快照不能代替现场检查。

本文将**事实**（文档、源码或本轮命令直接支持）、**推断**（从事实得出的判断）和
**建议**（尚未执行的方向）分开。已发布状态引用仓库发布记录与站点数据，未在本轮重新
下载全部线上安装包。正式任务顺序以[本轮主计划](2026-10-19-agent-iteration/README.md)为准，
不按本文自行扩大实现范围；远端 Issue/PR 和 Release 快照见[进度记录](2026-10-19-agent-iteration/progress.md)。

本轮 `git worktree list --porcelain` 另发现两份独立 checkout：
`codex/official-desktop-patches` 的 HEAD 为 `3f67cca0ceb693d5b994561115a1373205e7dc91`，
`codex/edition-artifacts` 为 `70df42c286a5604ee5d568b4da462b8fbf46b2b6`。
专项盘点显示前者 B00–B06/B08/B12 已完成、B07/B10/B11 阻塞、B09 延后，并有未提交
companion/evidence；后者有三份未跟踪的实现/测试文件。它们**没有整合进本审查 HEAD**，
不属于可以清理的残留，不能因主 checkout 缺文件就从零重做。后续先按 worktree 的实际
progress、diff 和证据盘点，再另行决定继续、整合或保留；不改动其未提交内容。

## 1. 产品目标与边界

### 事实

项目是 DeepSeek Harness 的非官方 Electron 桌面壳，解决下载后的运行时准备、启动、
窗口与托盘、监督与退出、更新、故障恢复和桌面连接问题。用户仍使用官方 Harness 的
Agent、模型、工具和会话能力，社区插件由用户手动安装，不随安装包预装或静默播种。
依据：[领域入口](../../CONTEXT.md)、[ADR 0030](../decisions/0030-reliable-electron-shell-scope.md)、
[随包部署](../../scripts/deploy-harness.mjs)、[运行时边界守卫](../../scripts/check-runtime-boundary.mjs)。

ADR 0034 已接受在可靠壳之上增加本地 Dashboard：Edition 表示来源，Runtime 表示具体
可执行版本，Environment 表示绑定版本的独立数据与进程实例。它是现行的正式扩展，不能
被 ADR 0030 较早的泛化范围描述直接否决。官方 npm runtime 是首个实现，社区桌面发行版
必须另有明确 Adapter，不能当 npm 包静默执行。目录和进程隔离只承诺 L1–L3，不能称为
OS 安全沙箱。依据：[ADR 0034](../decisions/0034-multi-runtime-dashboard.md)、
[Dashboard 原计划](2026-10-08-multi-runtime-dashboard.md)。

当前非目标仍包括：第二套聊天/Agent 工作台、多 Agent 编排、复杂项目/worktree 管理、
Agent Browser/Vision、默认远程隧道、跨模型供应商聚合、本地模型生命周期和互联网远控
平台。签名、公证不是当前发布门禁；改动范围需要新决策时不能靠某个实现任务暗中扩大。

### 推断

产品的主要竞争力是“官方 Harness 能力可稳定抵达桌面用户”，不是功能数量。后续迭代
应优先减少数据与生命周期风险、维护事实漂移、验证成本和高频使用障碍。Dashboard 是
已批准的另一条有界路线，但尚不能据此推出社区 Edition 已可安装或有安全隔离保证。

## 2. 架构、数据所有权与关键路径

### 事实：模块地图

| 层/职责 | 一手入口 | 当前责任与不可越界点 |
|---|---|---|
| Electron 装配 | [index.ts](../../src/main/index.ts)、[ShellApp](../../src/main/shell-app.ts) | 单实例、IPC、窗口/菜单/托盘、服务装配；ShellApp 管 Harness 启停和重启单飞 |
| 官方运行时 | [supervisor.ts](../../src/main/supervisor.ts)、[process-lifecycle.ts](../../src/main/process-lifecycle.ts)、[paths.ts](../../src/main/paths.ts) | 独立随包 Node 运行 `dsh web`；ready 协议、退避、进程树清理；不依赖用户安装 Node |
| 壳 UI 与权限 | [主窗口](../../src/main/window.ts)、[preload](../../src/preload/index.ts)、[桌面插件](../../plugins/dsh-desktop-controls/lib/client.js)、[权限策略](../../src/main/permissions.ts) | 主窗口沙箱/上下文隔离/禁 Node；经已核验主窗口与 Harness origin 的窄 IPC；设置插件承载桌面动作 |
| 更新与内核 | [update-prompt.ts](../../src/main/update-prompt.ts)、[kernel-manager.ts](../../src/main/kernel-manager.ts) | 壳更新与 Harness overlay 是两条链；overlay 安装/全局 active 指针/健康启动失败回退；bundled 是恢复底座 |
| Dashboard | [runtime-manager.ts](../../src/main/runtime-manager.ts)、[edition-catalog.ts](../../src/main/edition-catalog.ts) | 显式版本环境、独立 DSH_HOME/workspace/端口和子进程；不修改主壳 active 指针；社区目录为只读元数据 |
| 飞书连接 | [controller](../../src/main/cc-connect-controller.ts)、[supervisor](../../src/main/cc-connect-supervisor.ts)、[应用存储](../../src/main/cc-connect-applications.ts)、[管理器](../../src/main/feishu-manager.ts) | 多份具名本地应用、一次一份活动 sidecar；DSH 是 Agent/会话权威；意图、进程与健康证据分层 |
| 凭据 | [cc-connect-credentials.ts](../../src/main/cc-connect-credentials.ts)、[cc-connect 指南](../cc-connect.md) | 主进程持有 Secret；TOML 使用环境变量占位，renderer 不读回；macOS 新凭据为 0600 文件，不能称加密 |
| 回收站 | [trash.ts](../../src/main/trash.ts)、[trash-client.ts](../../src/main/trash-client.ts)、[版本绑定补丁](../../scripts/patch-session-trash.mjs) | 普通文件与会话分别处理；会话由 Host 所有者完成事务，不能只移目录/改侧栏/写私有 registry |
| 恢复与诊断 | [safe-mode.ts](../../src/main/safe-mode.ts)、[plugin-quarantine.ts](../../src/main/plugin-quarantine.ts)、[health-check.ts](../../src/main/health-check.ts)、[diagnostics.ts](../../src/main/diagnostics.ts) | Safe Mode、失败插件隔离、本地只读体检、日志脱敏和诊断导出；恢复动作不能静默删除用户数据 |
| LAN 与手机 | [lan.ts](../../src/main/lan.ts)、[mobile-shell.ts](../../src/main/mobile-shell.ts) | 用户主动开启 LAN 配对代理；设备登记/密钥在 userData；代理不是默认互联网远控 |
| 构建与交付 | [package.json](../../package.json)、[release.yml](../../.github/workflows/release.yml)、[release-shape.mjs](../../scripts/release-shape.mjs)、[站点生成器](../../scripts/gen-site-data.mjs) | 锁定闭包、跨平台构建与门禁、安装包和元数据契约、GitCode 镜像、官网版本数据 |

### 事实：数据位置与权威

- 默认 `DSH_HOME=~/.dsh-desktop`，保存 Harness profile、会话、预设和回收站；显式指定
  `DSH_HOME` 可以改变该边界，因此不能假定主壳永远与 CLI 隔离。
- Electron userData 保存 shell preferences、窗口状态、`kernels/active.json`、独立
  `runtime-environments/`、飞书记录/凭据/sidecar 数据、LAN 设备登记和日志。
- 随包 `resources/harness` 是构建产物闭包，含 Node 与官方 npm 依赖。当前有两类窄补丁：
  账户授权/onboarding 兼容补丁，以及会话回收站/已移除会话选择的版本绑定扩展；“逐字节
  原样封装上游”或“完全不改 Harness 行为”已经不是准确描述。依据：[manifest/harness](../../manifest/harness/package.json)、
  [ADR 0035](../decisions/0035-host-owned-session-trash.md)、[部署脚本](../../scripts/deploy-harness.mjs)。

### 事实：关键路径

1. **首启**：资源路径/闭包准备 → 主窗口加载页 → HarnessSupervisor 使用随包 Node 启动
   Web profile → 接受 ready loopback → 加载官方 WebUI → 桌面插件通过受限 bridge 使用壳能力。
2. **主壳内核切换**：安装精确 npm 版本 → 写 global active pointer → 重启 Harness → 健康
   守卫；失败时标记版本并回退 bundled。当前启动健康证明不等于数据格式向后兼容证明。
3. **Dashboard 环境**：安装 runtime → 建立环境记录和私有目录 → 独立进程/随机端口 → 独立
   窗口；关环境窗口停止对应环境。卸载拒绝正在运行或被主壳 active 使用的版本，并保留
   环境记录与数据，状态变为 `missing-runtime`。
4. **飞书**：显式配置/扫码保存 → 连接策略检查 Harness、workspace、Safe Mode 和连接意图 →
   创建固定 TOML/环境凭据 → sidecar → ACP 调用 DSH。`ready`、飞书通道在线、实际完成 DSH
   任务是不同事实；保存配置、打开窗口和体检不应触发连接或真实测试消息。
5. **会话删除/还原**：主窗口 IPC guard → 私有 loopback Host transport → 原会话所有者
   预留维护、flush 和精确 dispose → 文件/索引事务 → 权威资源刷新和选择释放。运行中/
   排队/有子会话/有其他写入者时拒绝；未知 overlay 能力拒绝删除，不能伪装成功。
6. **应用退出**：关闭主窗口调用 app quit；取消二维码，终止 sidecar 的待启动/已启动流程，
   并行停止 Harness/LAN/独立 runtimes；8 秒绝对退出预算。保存的连接意图不改写。
   关闭飞书/配对辅助窗口不退出应用。依据：[ADR 0037](../decisions/0037-feishu-application-manager.zh.md)、
   [ADR 0038](../decisions/0038-close-main-window-quits.md)、[ADR 0040](../decisions/0040-terminal-shutdown-preempts-start.md)。

## 3. 已实现、真实缺口与未知项

### 事实：已有能力，不应重新立项

| 能力 | 当前证据 | 规划处理 |
|---|---|---|
| 开箱运行、托盘/菜单、偏好/通知、首次成功引导、体检、安全模式、插件市场与恢复、预设、LAN | 对应 src/main 模块、[既有可靠壳计划](../reliable-shell-iteration-plan.md)、[E2E](../../e2e/electron-shell.spec.ts) | 维护回归与真实缺陷；不把功能存在当作所有场景已验收 |
| 飞书二维码管理、多应用/单活动连接、独立消息偏好、分层健康、浮窗快捷启停 | [管理器](../../src/main/feishu-manager.ts)、[策略](../../src/main/cc-connect-policy.ts)、[快捷控制 E2E](../../e2e/feishu-quick-controls.spec.ts)、[10-17 执行记录](2026-10-17-self-evolution.md) | 不是“待开发飞书管理”；真实账号往返与模拟证据分开 |
| Host 所有的会话回收站、恢复、侧栏/选择同步、索引并发保护 | [ADR 0035](../decisions/0035-host-owned-session-trash.md)、[trash UI E2E](../../e2e/trash-ui.spec.ts)、[补丁测试](../../test/session-trash-patch.test.ts) | 上游升级时逐版本复核；不能退回只移动目录方案 |
| 主窗口关闭即退出、macOS 飞书无钥匙串访问、退出抢占待启动 sidecar | ADR 0038–0040 及对应源码 | 维护现行语义；禁止恢复 close-to-tray |
| 多官方 runtime 并存与隔离环境 MVP、Edition 目录 | [runtime-manager](../../src/main/runtime-manager.ts)、[并存/卸载测试](../../test/runtime-manager.test.ts)、[目录测试](../../test/edition-catalog.test.ts) | 后续只补具体缺口，不能当成尚无实现 |
| Linux arm64 deb、四 runner/21 扩展面视觉门禁 | [release workflow](../../.github/workflows/release.yml)、[视觉验证器](../../scripts/verify-visual-evidence.mjs)、[HANDOFF §88–91](../../HANDOFF.md) | 已交付；不能重开“新增 arm64/新增视觉门禁”任务 |

### 事实：Dashboard 后续范围尚未完成

[10-08 原计划](2026-10-08-multi-runtime-dashboard.md)的 P1–P3 是路线，不能当实现清单：
当前 `RuntimeManager` 只列已安装官方版本，建立/启动/停止环境和卸载 runtime；
`EditionManifest` 与内置 catalog 提供来源/信任/隔离字段，没有 Edition install/launch/
stop/uninstall/update Adapter 实现。没有据此证明已经完成社区发行版下载校验、事务安装、
生命周期管理、数据路径兼容或 OS sandbox。bundled runtime 统一卡片、环境复制/导出等
规划项目也应逐项先查证，不能从“计划里有”推断“已经交付”。

### 事实与未知：质量现状

- 本轮主审查进程在该 HEAD 执行 `pnpm verify`，退出码 **1**。typecheck、runtime:check
  已通过；coverage 单测 **494 项，493 通过、1 失败、0 跳过**，失败为
  `test/locale.test.ts:86` 的 profile locale watcher 在 2000ms 内未满足断言；覆盖率
  行/分支/函数为 **89.62% / 82.45% / 86.94%**。后面的 site/build 没有由这次链式命令证明。
- 单独执行 `node --test test/locale.test.ts`，退出码 **0**，**7/7** 通过（约 0.5 秒）。这
  是复现条件差异，尚不足以判定根因、仅时间阈值问题或缺陷已经修好。
- 单独 `pnpm site:check` 退出码 **0**：4 个安装包、173 个翻译键和下载 API 契约通过。
  本轮主机 Node 是 `24.15.0`，不能把它写成随包版本；随包版本以
  [node-runtime.json](../../manifest/node-runtime.json) 为准。
- 历史发布日志记录 rc.2.shell.1 的 4×build/publish 与 21/21 视觉门禁成功、10 个 GitHub
  文件、8 个镜像文件和官网同步。历史成功不覆盖本轮本地门禁失败；四端 runner 也不等于
  四种用户真机、真实账号和物理网络均验证。
- 当前 [guarded E2E runner](../../scripts/run-e2e-guarded.mjs) 静态代码以控制台 `N passed`
  摘要优先于退出码判绿，并在结束时执行全局名称匹配的 `pkill -9 -f playwright` 和
  `pkill -9 -f dsh-electron-e2e`。这是可核对的实现事实；本轮没有动态复现误判绿或误杀
  其他任务，不能把风险观察写成已经发生的故障。

以下情况尚不能从本次源码/文档盘点得出全绿结论：当前最新版真实飞书账号的完整往返、
任意新旧 Harness 数据格式之间安全降级、物理异机/Wi-Fi/蜂窝切换、国内第三方防病毒
产品、所有平台用户态安装异常。历史模拟器/VM/Defender/自动化截图只按原覆盖口径使用，
不据此自动新增用户已明确延后的签名或第三方 AV 项目。

### 推断

1. **眼前门禁可信度有实测缺口**：完整 verify 失败而聚焦 locale 通过，应该先研究事件
   观察、测试并发和资源清理，不能直接扩超时、重跑取绿或忽略整项用例。
2. **内核数据兼容是结构性风险**：代码提供启动健康回退，却没有在上述关键路径看到完整
   的跨版本数据格式资格证明。旧 A02/A03 对此提出的研究方向仍有价值，但属于需强审查的
   高风险设计，不能自动给弱 agent 实现“通用安全回滚”。
3. **Dashboard 的实施保障弱于主壳**：现有单测证明用合成可执行文件多进程并存，尚不能
   等同两个真实官方 npm 版本在打包应用中的完整隔离、退出竞态和数据保真证明。
4. **维护事实漂移会误导任务选择**：主要入口文档落后于最近发布和 ADR，当前最容易产生
   的浪费是复刻已完成功能、恢复旧退出语义或按旧资产数误改已工作流程。
5. **runner 需要重新定义验收与清理合同**：摘要可能早于 teardown 失败/进程退出，全局
   模糊名称匹配也无法证明仅清理本次子进程。应先设计结果判定、退出与所属进程清理的
   明确契约，再交小任务实施；不能简单移除历史挂起保护或放宽超时取绿。

## 4. 旧计划的有效性与失效项

### 事实：必须先消除的冲突

| 文档/历史口径 | 当前事实 | 后续处理建议 |
|---|---|---|
| [docs/README](../README.md)、[CONTEXT](../../CONTEXT.md)、[ARCHITECTURE](../ARCHITECTURE.md) 仍有 8 文件/6 镜像或三平台发布合同 | `release-shape.mjs`、workflow、HANDOFF §90/91 为 **4 安装包 + 4 hash + latest.yml + blockmap = 10；镜像 8** | 修当前说明与速查，历史 ADR/发布记录保留其时间语义；由源码契约产生验收值 |
| HANDOFF 首部还停 rc.1.shell.1；ARCHITECTURE 首部仍写 rc.2.shell.0 未发布 | package 为 rc.2.shell.1；HANDOFF §91 和站点数据记录 rc.2.shell.1 已发布 | 核对当前源与线上证据后修当前摘要，不能重写历史段落 |
| [reliable-shell A05](reliable-shell/README.md) 要求保留 close-to-tray | ADR 0038 明确主窗口关闭退出；ADR 0040 定义退出抢占启动 | A05 必须重新设计验收；不能按旧任务改回后台驻留 |
| [reliable-shell progress](reliable-shell/progress.md) 停 09-29、A00–A10 全 todo | 此后已有多轮不同计划交付；旧进度并不证明所有旧目标都没做，也不证明 A02–A06 已做 | 按“已覆盖/部分覆盖/待设计/取消”重新映射，不直接顺序执行旧 progress |
| [safe-mode 旧计划](../safe-mode-and-presets-iteration-plan.md) 将内核管理、余额列为当时不做 | 后续 ADR 和源码已接受并交付 | 只作历史背景，不当现行产品禁令 |
| 早期社区调研说暂无官方桌面产品 | 10-08 计划已明确纠正该历史采样结论，catalog 有官方 Desktop 条目 | 不传播旧比较；外部项目当前状态需重新查一手来源 |
| 旧测试/发布计划写“下一步补打包/安装/arm64/视觉” | workflow 和近两次 release 已有对应门禁 | 研究真实缺失场景，不能另加重复脚本或重立已经完成的能力 |

### 建议：采用事实优先级

行为先查当前源码与通过/失败证据，再查最新已接受 ADR 和后续补充；当前发布先查实际
Release/站点数据与对应 tag；历史计划只用于恢复动机和识别尚未验证目标。发现冲突要
记下明确的替代关系，不按“某份计划日期更早但看起来更详细”执行。不能修改 ADR 历史
正文掩盖决策变更，必须保留 superseded/amendment 或新决策关系。

## 5. 交给低性能 agent 的边界

### 建议：可下放的任务类型

- 确定的文档事实同步：给出基准 HEAD、权威路径、需更新的字段、保持的历史段落和验收
  命令；限定当前摘要和索引，避免把通篇 HANDOFF 重排或改写成单一版本。
- 基于既有 API/状态的窄 UI 文案、可访问性、布局修正：明确涉及入口/状态/语言/尺寸，
  给定截图或行为验收；复用现有 controller 和 bridge，不新增连接副作用。
- 追加具体 fixture 与回归：已有行为契约、能确定失败输入与真实输出时，先改一项；
  断言副作用、数据不变和进程退出，不能只匹配函数名/源码字符串。
- 单个已定位缺陷的最小修复：给出复现命令、允许编辑文件、禁止事项和成功证据；
  无法复现则交回调查记录，不能自由探索后顺手改多个模块。

### 建议：需强 agent/维护者先完成设计或审查

- 跨版本数据格式资格、自动回退/降级、迁移、备份与恢复事务。
- 会话 Host 生命周期补丁、索引/写锁、跨进程删除/还原和所有权边界。
- Electron origin/frame/IPC/导航授权、凭据策略、LAN 信任与认证。
- quit/restart/Safe Mode/sidecar/runtime 的并发状态机和真实进程树清理。
- 社区 Edition Adapter 的安装执行、来源验证、卸载数据归属及平台权限。
- 正式升级内核/Electron/Node、放宽版本补丁锚点、覆盖率或发布门禁、发布/镜像/线上更新源。

### 建议：每张执行任务卡的最低合同

任务必须写清：**基准 HEAD；用户可见问题；前置任务；限定读写文件；已存在的 API；
禁止行为；最小复现；精确验收命令和断言；失败/停止条件；交付回执；下一任务**。
一次只交一项有界任务。记录“通过/失败/未运行/不适用”四种状态，不能把计划、脚本存在、
测试跳过或历史成功写成当前通过。执行 agent 不自行推送、发布、迁移真实用户数据，除非
收到相应任务的明确授权；也不清理他人的工作区改动。

完成回执至少包括：基准与最终 HEAD（未提交则注明）、行为变化、修改文件、验证命令/
退出码/关键断言、未覆盖项、是否改变配置/数据契约、后续依赖。这样下一位 agent 无需
重新通读整段历史，也能判断是否继续。
