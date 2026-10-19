# 原子任务卡

先读[总计划](README.md)与[进度](progress.md)。每次只执行一个 ID。
产品文件路径均相对仓库根。证据根固定为 `docs/plans/2026-10-19-agent-iteration/evidence/`；
后文 `evidence/IT-xx.md` 是该计划目录下的缩写，在执行时按需创建，不能写到仓库根。
所有任务都要更新本计划 progress，但不因此获得修改别的产品文件的权限。

## 公共执行契约

- **A 类**：低性能 agent 可按卡独立执行。**B 类**：可调查/复现，结论或实现需复核。
  **C 类**：先由资深 agent 定契约并再拆卡，当前不能直接实现产品行为。
- 每卡交付证据须含：开始/结束 SHA、原有改动、实际改动文件、命令与退出码、行为前后对照、
  未验证项、下一步。无改动也可以完成调查，但必须有充分的“不需要改”证据。
- 当前代码由 Node 24、pnpm 10.33.2 驱动；随包 Node pin、主机 Node、Harness 闭包版本分别核对。
  安装与构建按现有脚本；不以升级依赖解决任务环境问题。
- 不访问真实会话/凭据，不占用用户飞书连接，不发送消息；测试使用临时 home/userData/workspace、
  假 key、本地模拟服务。只清理本次拥有的 PID 与目录。
- 小任务先跑关联测试；涉及产品代码的一轮收口再跑 `pnpm run verify`。需要的 Electron/打包验证
  不能用静态字符串断言代替。IT-17/18 未完成前，不在共享开发机直接运行现有 guarded wrapper。
- 本轮 verify 失败的原始事实不得被单测单跑通过覆盖。验证缺资源就记录，不能删除测试或降门槛。

## IT-00 — 锁定执行时基线（A / 小）

**依赖**：无。**允许写**：`evidence/IT-00.md`、progress。

**步骤**：
1. 记录 `git status --short`、`git branch --show-current`、`git rev-parse HEAD`、`git worktree list --porcelain`。
   保留他人的改动和 Worktree；先识别合适的已有执行分支，确需新分支时用 `codex/` 前缀。
2. 记录 `node --version`、`pnpm --version`、`go version`、`node scripts/version.mjs show`；
   从 `manifest/node-runtime.json`、`resources/harness` 和 `site/data/release.json` 分别读取实际版本。
3. 只读查 `gh release list --limit 5`、open issue/PR 和最近 CI；明确 stable、prerelease、draft 的区别。
4. 已有依赖可用时跑 `pnpm run verify`，保存完整输出；已有同 SHA、同环境的完整结果可引用并说明。
   本轮的 locale 失败由 IT-01 处理，文档/调查任务不因此全部停工。

**验收**：代码、已发布、站点、资源四个状态有独立证据；已知失败与新增回归可区分。
**停止**：当前目录属于他人进行中的任务、运行验证会触碰真实数据，或需要覆盖他人改动。

## IT-01 — 解释并修复 locale watcher 不稳定（B / 中）

**依赖**：IT-00。**依据**：本轮 verify 1 项失败，单跑 7/7 通过，根因未确认。
**必读**：`src/main/locale.ts`、`test/locale.test.ts`、`scripts/run-test-coverage.mjs`。
**允许改**：前两文件；必要时新增一个专用测试 fixture。

**步骤**：
1. 对照 `profile locale and theme survive legacy settings archival and follow profile edits` 的 2s 超时、
   150ms debounce 与 2s polling，分别记录事件监听和轮询路径。它们只是调查线索。
2. 用临时文件复现“原地写入”和“原子替换”，定位订阅、重复刷新和 dispose 的先后；保留真实文件集成用例。
3. 只对已定位的竞态修复。若产品正常而测试等待方式错误，修正等待契约并保留同等断言。
4. 跑 `node --test test/locale.test.ts` 和完整 `pnpm run verify`；间歇问题最多用 5 次有记录的定向重复验证，
   不把无限重试后的成功当稳定证明。

**验收**：用户修改语言/主题仍同步；归档不重建旧 settings；dispose 后无回调；原失败有解释和回归。
**停止**：只能通过增加 timeout、跳过用例或降低覆盖率使其通过；根因仍未知则交调查证据。

## IT-02 — 同步当前发布事实（A / 小）

**依赖**：IT-00。**必读**：`scripts/release-shape.mjs`、release.yml、HANDOFF 最后两节、站点 JSON。
**允许改**：`HANDOFF.md` 当前状态/日期、`docs/ARCHITECTURE.md` 当前版本与验证契约、
`docs/README.md`、`CONTEXT.md`、`site/README.md` 当前资产口径。本卡是纯文档任务，可分两次交付。

**步骤**：只修面向“当前”的口径：调查日为 rc.2.shell.1、4 安装包、GitHub 10 文件、GitCode 8 文件、
四个 runner；执行时按真实新状态更新。保留旧发布记录中的 8/6，区分平台数与架构 runner 数。
核实打包 E2E/视觉说明与 YAML，不能照旧段落数字写成新事实。

**验收命令**：`node --test test/release-assets.test.ts test/release-shape-parity.test.ts`、`pnpm run site:check`、`git diff --check`。
**停止**：远端与站点尚未对齐。可写明差异，不通过修改站点 JSON 伪造同步；不批量替换历史版本。

## IT-03 — 给旧计划建立状态对照（A / 小）

**依赖**：IT-02、IT-16。**允许改**：`docs/plans/reliable-shell/progress.md`、
`docs/plans/reliable-shell/README.md` 的当前入口与 A05 冲突说明、`docs/plans/cc-connect-dsh-integration/README.md` 状态摘要。

**步骤**：逐项对照代码/测试和新交付记录；表中记录“已覆盖 / 部分覆盖 / 待设计 / 待证据”，链接证据。
旧 A05 的 close-to-tray 按 ADR 0038 标明已取代；保留已接受的关闭退出行为。
cc-connect 的旧“待实现”入口按完成记录修正。官方实验状态来自 IT-16 的实际 Worktree，
只链接证据，不在当前分支把未合入代码标为已交付。

**验收**：新 agent 能只看入口找到下一项；每个完成标记有提交/测试依据，未知保持未知；本地链接有效。
**停止**：只有历史记录、当前代码不匹配时不代为裁定完成；不重写历史 ADR。

## IT-04 — 补 Runtime 数据保留与异常回归（A / 小）

**依赖**：IT-00。**必读**：ADR 0034、`src/main/runtime-manager.ts`、`test/runtime-manager.test.ts`。
**允许改**：`test/runtime-manager.test.ts`，必要时一个本地 stub fixture；本卡不改产品代码。

**固定场景**：同一 Runtime 的两个环境；workspace 与 DSH_HOME 各有 marker；重建 manager 后环境记录仍在；
卸载后重装同版本可重新启动；active overlay 拒绝卸载；子进程未 ready 就退出。
每个场景验证状态、配置和 marker 内容，不只看退出码。stub 不调用 registry 或模型。

**验收命令**：`node --test test/runtime-manager.test.ts`，测试结束无本次子进程残留。
**停止**：新测试失败时保留最小复现并回报具体边界，不能顺手重构 manager；失败项转独立修复卡。

## IT-05 — 复现同环境生命周期竞争并定界（B / 小）

**依赖**：IT-04。**允许写**：`evidence/IT-05.md`、一个隔离复现 fixture；不改产品代码。

**场景**：同 ID 并发两次 start、starting 时 stop、超时后立即重试、旧 child 迟到 exit。
stub 的 ready/exit 使用显式信号控制，不靠盲睡。记录调用结果、spawn 次数、状态序列和存活 PID。

**规范草案**：同 ID start 共用一次启动结果；取消后不再被迟到 ready 写成 running；旧进程事件不删除新 child；
一个环境的异常不改变另一个环境/全局 active 指针。不同环境仍允许并行。

**验收**：每个不满足项有受控最小复现，满足项也留证据；审查者批准后才能解锁 IT-06。
**停止**：需要改进程监督公共协议、跨进程全局锁或安装事务时，拆新专项。

## IT-06 — 实施已批准的 Runtime 竞争修复（B / 中）

**依赖**：IT-05 规范获审查；无缺陷时可记录“不需要修复”，不能制造变更。
**允许改**：`src/main/runtime-manager.ts`、`test/runtime-manager.test.ts`、IT-05 fixture。

只处理 IT-05 已证实的一个竞态；多个独立竞态分多个回执。复用 ManagedChild，
不增加全局 scheduler、不改目录格式/数据迁移。保持 start/stop/uninstall 的调用约定。

**验收**：IT-05 失败场景变绿，spawn/PID/状态序列符合规范，IT-04 数据断言不变；
`node --test test/runtime-manager.test.ts test/process-lifecycle.test.ts`、`pnpm run verify`。
**停止**：需要改 `index.ts` / preload / IPC 协议时，先说明原因重新定界。

## IT-07 — Runtime 状态反馈与确定性 UI 验收（B / 中，分两次交付）

**依赖**：IT-04、IT-06；使用 guarded wrapper 验收前完成 IT-17/18。
**允许改**：`plugins/dsh-desktop-controls/lib/client.js`、`e2e/runtime-manager.spec.ts`（新）、
`e2e/fixtures/runtime-harness.mjs`（新，若可复用现有 fixture 则复用）。

**固定行为**：面板打开时最多每 2s 查询一次；卸载/关闭后停止；旧请求结果不能覆盖新动作结果。
刷新不清空未提交的版本号/环境名；操作被拒或抛错时恢复按钮并给可重试提示。
外部子进程退出在下一次刷新后显示停止/失败，不能长期残留 running。

第一份回执交状态同步；第二份交创建→启动→停止→卸载→missing-runtime 的 UI 路径。
测试使用 fake Runtime 桥或本地 stub，挂载实际产品插件，不能复制一份 UI 作为被测对象；
验证中英、关闭面板清理与表单保留，不下载真实 npm 包。

**验收命令**：`node --test test/desktop-controls.test.ts`、
`pnpm run build` → `pnpm exec playwright test e2e/runtime-manager.spec.ts`、`pnpm run verify`。
构建必须在 E2E 前同步最新 controls 到 staged closure。直接 Playwright 的隔离验证不调用旧 wrapper。
**停止**：需要修改 IPC/manager 协议或拆整个 controls 文件时转新卡；不只补截图来代替行为断言。

## IT-08 — 查清 Windows VC++ 提示对应架构（B / 小，证据任务）

**依赖**：IT-00。**必读**：`src/main/win-runtime.ts`、`scripts/verify-windows-installer.mjs`、
`scripts/fetch-node.mjs`、`scripts/install-electron.mjs`、HANDOFF F-3 与后续记录。
**允许写**：`evidence/IT-08.md`；不改下载链接、不内置 redist。

核对当前公开 EXE 的 PE Machine、Electron/随包 Node `process.arch`、sharp 包/二进制架构，
再核对 ARM guest 的仿真与 DLL 视图。Microsoft 兼容规则使用执行时官方文档并记录 URL/日期。
区分“System32 缺文件”“原生模块真实加载失败”“提示错误”；没有 Windows 环境就标明未验证。

**验收**：产出“目标应用架构→检测路径→官方 redist→实测结果”矩阵；确定后另拆链接/文案/探测小卡。
**停止**：不凭 ARM 操作系统就把 x64 应用的下载切成 arm64；不向 AV 网站上传安装包。

## IT-09 — 精确版本的数据兼容证据（B / 中）

**依赖**：IT-03。**必读**：旧可靠性计划 A02、ADR 0026、当前内核真实 persistence 代码。
**允许写**：`evidence/IT-09.md`、一个合成数据 fixture、一个专用验证脚本；不改用户运行路径。

固定两套精确内核，记录启动前、启动未 ready、ready 后、一次本地写入的文件/schema/hash 差异。
副本上验证旧→新→旧的非空会话、设置、插件 manifest、预设和实际数据库可读性。
输出 `verified-compatible / incompatible / unknown`，记录插件状态不能随核心一起被证明。

**验收**：受控可重跑、内容可读性有断言、原始 fixture hash 不变；无合适版本/无稳定格式接口可交 unknown。
**停止**：需要真实凭据、逆向数据迁移或恢复覆盖用户数据；不能以两个进程都 ready 代替兼容证明。

## IT-10 — 内核回退保护规范与后续分解（C / 设计关口）

**依赖**：IT-09、审查者接管。**交付范围**：新 ADR、纯 transition 真值表、后续小任务卡；本卡不实现回退链。

盘点 `activeKernelBin`、launch guard、显式切换/restore、failed marker/目录缺失等所有路径。
分别定义同版本重启、新版本未执行、目标已执行但未 ready、未知/不兼容、历史记录缺失的行为。
安全默认是兼容未知时不自动降级；必须同时设计可用的恢复页和既有安装过渡，不能把旧用户全部锁住。
还要考虑主壳 overlay 与 RuntimeManager 共用安装根的使用/删除关系。

**验收**：每条分支有输入/输出/副作用/恢复路径；审查新 ADR 后拆成纯函数、持久化、入口接线、UI/回归四类小卡。
**停止**：把执行版本退回写成数据恢复，或准备实现任意版本逆迁移。

## IT-11 — 可信任务状态规范（C / 设计关口）

**依赖**：IT-03。**必读**：旧 A04、`desktop-notifications.ts`、`desktop:session-status`、当前公开 Host 状态 API。
**交付范围**：`evidence/IT-11.md`、schema/字段真值表、后续小卡；不以通知快照直接实现退出判断。

定义 `idle / active / unknown`、来源、完整性、接收时间和失效条件。
验证运行/待交互/队列/job/子任务是否都可见；缺字段、断连、reload、过期为 unknown。
单独说明多 Environment 与飞书 ACP 的活动是否在检查范围；不能只查主窗口就声称全局 idle。

**验收**：真实公开字段→状态的对照可核查；只有新鲜且完整的证据可判 idle；设计通过后拆纯函数/桥接/UI卡。
**停止**：找不到公开能力时交 unknown 和限制；不写未认证服务或调用私有缓存猜测任务。

## IT-12 — 关闭/退出/重启保护规范（C / 设计关口）

**依赖**：IT-11；内核切换分支另依赖 IT-10。**必读**：ADR 0038、ADR 0040。
**交付范围**：新 ADR 或有依据的“不改现状”结论、状态转移表及后续小卡；不直接改 before-quit。

先明确是否接受新增中断确认：这是 ADR 0038 之后的新交互选择，不能由弱模型静默决定。
保留主窗口关闭走退出，不恢复托盘驻留。规范需覆盖 active/unknown、取消、重复请求、OS session-end、
启动失败、辅助窗口、多个 Runtime、Sidecar、LAN 与已获授权的更新退出。
确认前不能关窗口/停服务/永久设置 quitInProgress；取消后可继续使用。

**验收**：所有入口的相同语义、确认预算、重入和清理责任明确；资深审查后逐入口拆卡。
保留 ADR 0040 的终结式停止、退出抢占待启动服务、allSettled 并行清理与 8 秒绝对预算；
后续实现必须核对真实 fixture PID 消失，不能只断言调用了 stop。
**停止**：需要第二套 supervisor、无法保证取消后的恢复，或与用户关闭即退出的现行要求冲突未决。

## IT-13 — Windows 更新授权规范（C / 设计关口）

**依赖**：IT-12。**依据**：当前 `autoDownload=true`、`autoInstallOnAppQuit=true` 是源码事实。
**交付范围**：新 ADR、偏好迁移表、fake updater 场景表、后续小卡。

评估显式下载/安装授权：区分新用户和旧配置迁移；普通 Quit 与“安装并重启”的授权分开；
取消保留已下载状态；重复事件只处理一次；安装器失败可重试。macOS/Linux 保持已支持的检查/下载路径。
先安排真正 Windows 安装交接验证，再决定交付；测试替身不是实机结果。

**验收**：不弱化更新来源、SHA 与已有门禁；新文案不提前宣称未实现行为；审查后拆偏好、updater、UI、Windows验收卡。
**停止**：涉及商业签名、更新镜像 fallback、降级安装或自动覆盖用户数据，另开专项。

## IT-14 — 维护反馈入口与 Issue 事实核对（A / 每轮小任务）

**依赖**：IT-00；可独立于功能主题。**允许写**：本轮 `evidence/IT-14.md`、待发布回复草稿；远端只读。

执行时读 open issue 的正文、评论、附件和首个失败步骤；对照已发布修复与用户版本。
本轮快照：#116/#118 已有对应修复/后续绿色发布证据，先核实状态；#100 的白屏部分和 #115 的升级反馈
需要补充现场证据。不得根据旧标题再次开发已修复缺陷。
PR 历史 CI 绿不等于可在今天主干合并；Node 26 类型问题不通过放宽断言或升级主轨道绕过。

**验收**：每项有 URL、采样时间、已知/未知、下一动作与最小复现卡；标签建议按五种标准角色给出。
**停止**：需要联系用户或发 GitHub 评论时先保留草稿，交给有该动作授权的会话；附件中秘密不进入证据。

## IT-15 — 本轮验证与候选交付（B / 中）

**依赖**：本轮选定卡完成；涉及 E2E 时 IT-17/18 完成；原有失败已解释且必要修复通过。
**允许改**：本轮证据、必要用户文档、候选变更说明；不在此卡 bump/tag/发布。

按改动选择：关联 node:test → `pnpm run verify` → 聚焦 Electron E2E；涉及随包资源/进程/更新时
再做新 `dist:dir`、packaged smoke/UI、必要故障注入和安装/升级验证。沿用 release skill 的当前门禁，
本卡不是简化发布门禁的替代。文档-only 不要求重跑完整安装器矩阵。

**验收**：证据绑定候选 SHA/包 hash；每项通过/失败/跳过/未覆盖有说明；无真实数据副作用；
审查者可以直接判断能否进入正式发布。需要 Windows/Linux 验证而无环境时保持待验证。
**停止**：全量门禁仍红、产物非本轮 SHA、只有 runner 截图却写成物理真机；发布转独立授权会话。

## IT-16 — 盘点现存 Worktree 成果（A / 小）

**依赖**：IT-00。**允许写**：`evidence/IT-16.md`；不修改其他 Worktree。

从 `git worktree list --porcelain` 取实际路径，用 `git -C <path> status --short`、log 与只读文件检查盘点。
调查时官方实验 HEAD `3f67cca`，B00–B06/B08/B12 有完成记录、B07/B10/B11 blocked、B09 deferred；
还含未提交 companion 插件与 evidence。Edition Worktree HEAD `70df42c` 有未跟踪的代码/测试文件。
这些均不能按当前主分支中的旧全 todo 表重做。

**验收**：记录每树分支/SHA/脏文件/已完成/阻塞/与主干差异，以及继续、提取审查或保留的建议。
路径只存本地临时日志；提交文档用分支和工作树名称，不写本机绝对路径。
**停止**：需要 stash/reset/clean/切他人分支/自动 merge；未跟踪文件属于既有成果，不能清掉。

## IT-17 — E2E 结果判定契约（B / 审查后实施）

**依赖**：IT-00。**依据**：`scripts/run-e2e-guarded.mjs` 按 `N passed` 摘要判成功，
可能覆盖非零退出；这是静态风险，尚未受控动态复现。
**允许改**：该脚本、一个纯判定 helper（确需时）、`test/e2e-guarded.test.ts`（新）。

先用字符串和受控假进程复核“passed 后 teardown 报错/非零退出/信号/无完整摘要/总超时”等情况。
审查者确认退出策略：成功至少需要完整无失败结果及正常收尾；任何非零/信号/超时默认失败。
旧 teardown hang 的兼容需求必须给具体受控证据和独立状态，不能泛化成“出现 passed 就绿”。
完成纯逻辑测试后再接 runner；保留输出与诊断，不运行现有全局 pkill 分支。

**验收**：表驱动验证优先级、混合摘要、截断输出和退出竞态；任何失败不能被成功摘要覆盖；
`node --test test/e2e-guarded.test.ts`，再由隔离 Linux CI 验收实际套件及 teardown。
**停止**：为维持绿灯吞异常、删现有断言，或需改整个 Playwright/CI 体系。

## IT-18 — 仅清理本次 E2E 拥有的进程（B / 审查后实施）

**依赖**：IT-17 完成且契约获审查；同文件串行修改。**依据**：当前 wrapper 使用全局 `pkill -f playwright/dsh-electron-e2e`。
**允许改**：`scripts/run-e2e-guarded.mjs`、IT-17 测试、一个受控进程 fixture。

先审查各平台归属策略：macOS/Linux 可用本次创建的私有进程组；Windows 用本次根 PID 的
受管子树清理，不能直接套负 PID 或进程名匹配。wrapper 还被 `scripts/e2e-market.mjs` 在三平台调用。
为本次运行建立可证明归属的进程组/树，仅终止该实例；不能用名称匹配替代归属。
自然退出、spawn 失败、超时、取消和重复清理均须结束日志与计时器。
每次运行创建唯一日志，避免并发写入同一个 `dsh-e2e-guarded.log`。
先启动一个名字含 playwright 的无关哨兵以及本次测试子树，执行清理后断言哨兵仍存活、子树已退出。
测试失败也只能清理自己创建的 PID；不在共享机器运行旧脚本复现 pkill。

**验收**：macOS/Linux/Windows 受控 fixture 与对应 CI 验证通过；并行两次 wrapper 互不终止、日志互不覆盖；
没有残留子进程。无某平台环境就保留未验证状态，不声称跨平台完成。
**停止**：无法证明 PID/进程组归属、需要全局 kill，或需要新增通用进程管理框架。

## IT-19 — 澄清 Edition 来源与隔离语义（A / 小）

**依赖**：IT-00；使用 guarded wrapper 前完成 IT-17/18。**必读**：ADR 0034、`src/main/edition-catalog.ts`、
controls 的 `runtimeEditionTrust` 与目录渲染。**允许改**：`plugins/dsh-desktop-controls/lib/client.js` 的目录说明。

在现有目录区域用中英文说明：条目用于查看来源；官方/社区表示发布身份，静态 `verified` 字段
不等于已安全审计或兼容性实测；L1–L3 是数据/进程/安装等级，不是 OS sandbox，未接入 Adapter 的
社区 Edition 不能宣称已获得这些实际隔离保障。保持现有枚举、来源链接和手动安装流程。

**验收**：`node --test test/edition-catalog.test.ts test/desktop-controls.test.ts`；先 `pnpm run build` 再复用
`e2e/desktop-ui-review.spec.ts` 既有中英亮暗走查。截图之外，用受控人工操作记录查看来源动作仅打开来源页、
没有安装/启动软件；不是声称现有截图用例已经覆盖点击。自动化此动作需另开测试卡。
本卡不增加仅匹配文案的测试、不创建认证平台。
**停止**：需要重命名 trust schema、远程签名目录或自动下载社区二进制，先拆设计卡。

## IT-20 — 诊断中区分内置和实际选中内核（B / 小）

**依赖**：IT-00。**依据**：`DiagnosticFacts.harnessVersion` 目前采随包版本，不能单独解释 overlay 运行现场。
**必读**：`src/main/diagnostics.ts`、`src/main/kernel-manager.ts`、`test/diagnostics.test.ts`。
**允许改**：上述 diagnostics 源码与测试；必要时 `src/main/index.ts` 的只读 facts 接线。

保留旧 `harness_version` 字段兼容性，追加明确命名的 bundled、selected、selection source、failed marker 事实；
配置选中版本从 `readActiveOverlay` 读取；可执行/eligible 版本按现有选择规则读取，
不能把会过滤缺失/failed 的 `kernelState().overlayVersion` 当原始 selected。
不推断未观测到的“实际正在运行版本”；未记录启动版本时 observed 写 unknown。
覆盖无 overlay、健康 overlay、缺失/failed overlay 四种；后两种同时保留原指针和 fallback 事实，
状态未知写 unknown，不采集会话或密钥。

**验收**：`node --test test/diagnostics.test.ts test/kernel-manager.test.ts`、`pnpm run verify`；
已有报告字段与脱敏断言不变，selected 与 observed 的语义不能混淆。
**停止**：需要给运行时版本写持久化协议、改选择策略或读取全部用户数据。

## IT-21 — 上游版本查询有界失败（B / 小）

**依赖**：IT-00。**依据**：`scripts/version.mjs` 的两 registry 顺序 fetch 尚无自身超时。
**允许改**：该脚本、一个查询 helper（确需时）、`test/version-check.test.ts`（新）。不改 workflow 或版本清单。

给每源请求设 15s 上限，覆盖响应头、body 和 JSON 读取的整个单源操作；首源失败继续次源，
本卡不新增重试机制。
保留当前候选选择算法与退出码协议：0 无更新、3 有更新、4 本地不一致、1 远端查询失败。
失败提示区别本地不一致与源不可达；错误 URL 脱敏，不能回显含认证的 registry 环境值。
测试在临时仓库/stub fetch 或本地 HTTP 服务中完成，不依赖真实 npm，不执行 bump。

**验收**：首源超时次源成功、双源失败、HTTP 非成功、畸形 JSON、更新/无更新、本地不一致均有断言；
使用可注入的短测试期限验证超时而非每次真等 15s；`node --test test/version-check.test.ts`、`pnpm run verify`。
**停止**：需修改最高版本/dist-tag 策略、补丁迁移、发布触发或自动合并；这些另拆卡。
