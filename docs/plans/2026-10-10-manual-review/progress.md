# 后续迭代执行记录

执行约定（2026-10-11）：用户要求跳过 TDD，采用 **实现 → 验证 → 修复 → 再验证**。
每项确认允许范围，单独提交；不得跳过、删除或降低断言。自动测试隔离真实数据与凭证。
全部本地门禁通过后发布新的 shell 版本；不顺带升级无关依赖或内核。

## 当前进度

| 任务 | 状态 | 交付 |
|---|---|---|
| TR-01 | 完成 | 真实会话复现、公开能力缺口及回归范围已确认 |
| TR-02 | 完成 | Host 权威生命周期、归档修改、目录广播和双客户端真实回归 |
| TR-03 | 完成 | 会话身份冲突拒绝、事务回滚、跨进程锁、子会话保护与重启持久化 |
| MSG-01 | 完成 | 规范化默认、显示 TOML、真实 Go loader 19 组配置 |
| MSG-02 | 完成 | 实际保存/读取 IPC、偏好合并、非法输入无写入、Sidecar/Safe Mode 回归 |
| MSG-03 | 完成 | 设置页四组选项、中英文、编辑保护、保存/重开与非预设回显 |
| MSG-04 | 完成 | 使用指南、双语 ADR 0036、文档契约与完整 verify |
| FS-01 | 完成 | 单活动应用、分层健康、持久关闭/启动偏好及受限窗口契约 |
| FS-02 | 完成 | 无损旧配置迁移、隔离凭证修订、应用 CRUD/去重与失败恢复 |
| FS-03 | 完成 | 串行单进程、持久关闭、启动偏好与真实分层健康 |
| FS-04 | 完成 | 统一受限管理窗口、扫码/应用操作、中英文真实界面与权限回归 |
| QA-01 | 本地完成 | 当前源码 macOS 安装包、受控真实收发/降噪/关闭、指南与 setup skill；三平台门禁随发布 CI 再核对 |
| shell 发布 | 未完成 | 新版本打包、三平台 CI、GitHub/GitCode 资产与官网 |

下一任务：**shell-only 发布**（`0.2.1-alpha.2.shell.1`）。

## TR-01 — 真实垃圾桶复现与契约核对

允许范围：本计划文档、隔离诊断脚本、文档索引；没有产品代码改动。
任务提交 SHA：`8161ef4cfc10888591b8314e12f861c447606c58`。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `pnpm run build` | 编译通过 | 0 |
| `node docs/plans/2026-10-10-manual-review/reproduce-trash-sidebar.mjs`（两次） | 真实会话已删除，磁盘 0、侧栏 1；5 秒后仍在。修复前预期失败，不计作功能验收通过 | 1 / 1 |
| `node --check docs/plans/2026-10-10-manual-review/reproduce-trash-sidebar.mjs` | 语法通过 | 0 |
| `git diff --check` | 通过 | 0 |
| `pnpm run site:check` | 站点与下载 API 全部通过；既存 MODULE_TYPELESS 警告未改动 | 0 |

夹具：临时 `DSH_HOME` / Electron userData / 工作区，本地 SSE 模拟模型、假 key；模拟答复与标题生成
共两次请求，真实模型/飞书请求为 0。实际点击设置中的删除按钮，以真实会话标题定位侧栏。
退出时关闭测试 Electron/模拟服务并清理本次临时目录。

契约结论：客户端刷新和工作区取消归档可复用公开服务；驻留 Session 的释放需要创建方持有的
`AgentHandle.dispose()`，现有公开 `sessionController` 未提供协调入口。TR-02 需交付可重复构建的
窄范围能力补丁/入口，不能修改私有缓存或仅过滤 UI 来掩盖问题。

未覆盖项（交由后续任务）：恢复/取消归档真实侧栏、其他客户端、选中回退、归档/置顶/子任务、
活动任务权威拒绝、路径冲突与失败回滚、重启持久化，以及新飞书管理和发布门禁。

## TR-02 — Host 权威生命周期与真实客户端同步

允许范围：Host/client 插件、垃圾桶 IPC/preload、Supervisor 私有端点、可重复构建的版本绑定
生命周期/选中回退补丁、对应测试及 ADR 0035。没有升级依赖、修改用户 overlay 或子模块。
任务提交 SHA：`f20861b74cc7c2deed54392852ff8946495333db`。

内核创建方保存自己的 AgentHandle，空闲维护区内 flush/移动，再释放；运行、排队、其他所有者
以及驻留子任务拒绝删除。冷会话持有持久化 writer lease。归档修改走 workspaceRegistry，恢复
广播目录新增；客户端同步失败显示可重试提示，旧异步刷新不覆盖新结果。移除当前项由选择
拥有者清除详情引用。随机鉴权令牌只留在 main/Host，不进入 renderer/日志。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `pnpm run verify` | 全绿；覆盖率行 89.01%、分支 80.45%、函数 84.74%；ACP/站点/构建通过 | 0 |
| `node --test test/desktop-controls.test.ts test/trash.test.ts test/trash-sessions.test.ts test/trash-host.test.ts test/session-trash-patch.test.ts test/supervisor.test.ts` | 39 passed，0 failed，0 skipped | 0 |
| `pnpm exec playwright test e2e/trash-ui.spec.ts -g 'real idle\|Host refuses' --repeat-each=2` | 4 passed；双客户端删除/还原/取消归档与活动任务拒绝，连续两轮 | 0 |
| `node docs/plans/2026-10-10-manual-review/reproduce-trash-sidebar.mjs` | 磁盘 0、侧栏 0、无幽灵详情 | 0 |
| `node docs/plans/2026-10-10-manual-review/reproduce-trash-refresh.mjs` | 删除/恢复分别公开刷新，共 2 次 | 0 |
| `pnpm run typecheck`、`git diff --check` | 通过 | 0 |

迭代中定位并修复：全 ID 与目录扫描去前缀 ID 不一致、主视图遗留引用、测试夹具缺少真实
持久化事件、默认窗口窄屏折叠侧栏、已失效 Supervisor 端点。没有降低产品断言。
测试全部使用临时目录、本地模拟模型和假 key，无真实模型/飞书调用；临时实例已清理。

未覆盖项：同名会话恢复拒绝、索引失败回滚、跨进程垃圾桶竞争、重启、置顶/子任务与永久清理
的完整回归由 TR-03 补齐；安装包/平台/真实飞书由 QA-01 验收。当前补丁仅支持绑定内核版本，
未知版本失败关闭；用户 overlay 不提供安全入口时拒绝操作，不回退强杀/直接删除。

## TR-03 — 身份安全恢复与事务回归

允许范围：垃圾桶共享工具、Host/IPC/client 的会话恢复路径、生命周期子会话保护、真实回归
夹具与相应测试、ADR/本记录。任务提交 SHA：`151e2337927a77fd8dd38ab9117d47493ce9be8e`。

会话恢复拒绝已占用路径/已存在身份，保留桶内原件；恢复后核对公开持久化 header、工作区与
全 ID。普通文件仍编号另存。main/Host 通过同一跨进程锁读写索引，删除先记录恢复位置，
失败不覆盖新建原路径；恢复时 registry/索引失败回滚到桶内。驻留或持久子会话保护父会话，
先处理子会话，不强停/批量暗删。刷新失败可重试，成功后明确显示已完成且不重复磁盘操作。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/trash.test.ts test/trash-host.test.ts test/trash-sessions.test.ts test/session-trash-patch.test.ts` | 30 passed，0 failed，0 skipped；含跨进程 12 条写入、重复恢复、故障回滚、子会话保护 | 0 |
| `node --test test/trash-client-ui.test.ts` | 2 passed；同步重试不重复删除，旧读取不覆盖新状态 | 0 |
| `pnpm exec playwright test e2e/trash-ui.spec.ts -g 'real idle\|Host refuses\|external kernel' --repeat-each=2` | 6 passed；置顶/归档恢复、双入口冲突、双客户端、活动/外部 writer、永久清除与重启 | 0 |
| `pnpm run verify` | 361 单测 + 1 ACP 契约通过，站点/构建/类型全绿；覆盖率 89.05/80.60/85.06% | 0 |
| `git diff --check` | 通过 | 0 |

实现后失败已定位并重验：冷会话依赖未声明（补显式 sessionPersistence 注入）；重启新客户端
正常创建空白草稿，完整目录基线仍保留且清除目标不复活，额外草稿严格验证仅有三条权限初始化
事件、无父会话/模型任务；刷新成功缺少完成反馈（已补齐）。未删除或跳过产品断言。
所有自动测试为临时 home/userData、假 key/本地模拟模型；仅永久清除了测试自建桶内数据。

未覆盖项：本轮 Windows/Linux 实机与安装包重跑交 QA-01；飞书新管理/显示设置尚未实施。
故障退出留下的共享 lock 文件沿用已有 withFileLock 的超时拒绝行为，不自动抢锁或覆盖数据。

## MSG-01 — 显示设置规范化与真实配置解析

允许范围：cc-connect-config.ts、配置测试；为实际 Go loader 门禁补 CI 递归子模块检出和
Go 1.25（与现有 go.mod 相同）环境，未升级依赖或修改子模块。任务提交 SHA：`beb28dc99cc792de77cc50dd42ad308558206c15`。

规范化结果完整包含 compact/开启预览/3000ms/legacy/legacy；兼容输入可缺新字段。
非法类型/枚举回落，整数越界钳制 500–30000，非有限/非整数不接受为设置值。
预览全局表位于项目之前，显示表紧接项目；平台追加受控进度和启用飞书卡片。Secret 保持占位符。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/cc-connect-config.test.ts` | 6 passed；19 组实际 config.Load 校验全部详细度/卡片/进度组合及默认、表归属、假 Secret | 0 |
| `go test ./config`（子模块） | 通过（cached） | 0 |
| `pnpm run verify` | 364 单测 + 1 ACP 契约全绿；覆盖率 89.08/80.86/85.06% | 0 |
| `pnpm run typecheck`、`git diff --check` | 通过 | 0 |

旧 settings.json 不重写即读取为完整新默认值；原子写入与 0600 权限继续通过。
未覆盖项：IPC 省略字段合并/拒绝非法输入、保存后 Sidecar 生效和 Safe Mode、UI 回显/轮询、
实际飞书消息数量/卡片视觉效果由 MSG-02/03 和 QA-01 完成。没有真实飞书或模型调用。

## MSG-02 — 主进程白名单与 IPC 回显

允许范围：连接 types/main、实际 IPC 测试、Electron shell 端到端。无新通道、不改 preload
授权或 Supervisor 分支。任务提交 SHA：`a5d2f58964c2fadf85d75b6016e34cad99d276e2`。

保存新字段先白名单验证，再合并已保存设置；省略表示保留。有限整数越界由规范化钳制。
状态完整回传合法生效设置，不回读 Secret；启用的已运行连接重新生成 TOML/重启，
未运行、禁用和 Safe Mode 保留原有启停边界。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/cc-connect-ipc.test.ts test/cc-connect-lifecycle.test.ts test/cc-connect-credentials.test.ts` | 11 passed；执行真实注册 handler/临时存储，非法值不改配置和凭证、旧调用保留偏好、sender guard | 0 |
| `pnpm exec playwright test e2e/electron-shell.spec.ts -g 'display settings IPC\|renderer bridge drives'` | 2 passed；真实 Electron IPC + 假 Sidecar，TOML 更新、Safe Mode 无隐式启动、原生命周期全程 | 0 |
| `pnpm run verify` | 367 单测 + 1 ACP 全绿；覆盖率 89.10/80.86/85.06% | 0 |
| `pnpm run typecheck`、`git diff --check` | 通过 | 0 |

未覆盖项：设置页四组选项、双语/禁用/轮询编辑/非预设值回显交 MSG-03；实际飞书展示交 QA-01。

## MSG-03 — 设置页降噪控件

允许范围：手维护 client.js、桌面控件测试、真实 Electron/Harness UI 回归。沿用现有 CSS
变量/字号/布局，用 frontend-design 校核可读文案、焦点、禁用及截图；没有新增依赖或通道。
任务提交 SHA：`198d5f613d5ed84f5531f89ab2a18f6f127da6d4`。

工作区后追加详细度、预览/间隔、卡片样式、进度展示，静默说明保留最终答复。加载前禁用
字段防止默认值误写；轮询只更新运行状态、不覆盖编辑，成功保存回填规范化值并清空一次性
Secret。提交期间的新编辑也保留。非预设合法间隔增加当前值选项，不提供自由文本输入。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --check plugins/dsh-desktop-controls/lib/client.js` | 通过 | 0 |
| `node --test test/desktop-controls.test.ts` | 5 passed；双语键、焦点/禁用、受控预设及原插件边界 | 0 |
| `pnpm exec playwright test e2e/electron-shell.spec.ts -g 'real Desktop display controls\|display settings IPC' --repeat-each=2` | 4 passed；真实设置 UI/IPC、中英文、预览禁用/保留、保存重开、轮询编辑保护、8 秒回显 | 0 |
| `pnpm run verify` | 367 单测 + 1 ACP 全绿；覆盖率 89.10/80.86/85.06% | 0 |
| `pnpm run typecheck`、`git diff --check` | 通过 | 0 |

已检查英文真实设置截图；没有真实 Secret，UI/状态只呈现已配置标记。测试无模型/飞书请求。
未覆盖项：实际飞书卡片、消息数量及安装包验收交 QA-01；飞书管理闭环尚未实施。

## MSG-04 — 指南、默认行为决策与完整门禁

允许范围：cc-connect 指南、文档断言、双语 ADR/索引、任务卡及进度。
任务提交 SHA：`472b760d6d75130b8645fb97df5380d22ed7bf07`。

指南说明四组选项、非预设回显、旧配置默认迁移、Safe Mode/启停及 Secret 边界；明确源码
实现不等于新安装包已发布。ADR 0036 记录默认变更的取舍与多应用迁移保留偏好要求，
保留单项目/单平台限制、不开放自由文本 TOML 或管理接口。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/cc-connect-docs.test.ts` | 1 passed；新增选项/默认/边界及 ADR 关键词校验 | 0 |
| `pnpm run verify` | 367 单测 + 1 ACP 全绿，类型/运行边界/站点/构建通过；覆盖率 89.10/80.91/85.06% | 0 |
| `git diff --check` | 通过 | 0 |

MSG-01～MSG-04 源码/配置/IPC/UI/文档门禁完成。未覆盖：真实飞书消息数量/富卡片组合和
三平台安装包交 QA-01，飞书应用管理和持久关闭仍待 FS-01～FS-04；尚未创建新版本或 tag。

## FS-01 — 统一应用管理与状态契约

允许范围：连接类型、窄范围纯策略/管理窗口授权函数及测试、CONTEXT、双语 ADR 0037/索引。
任务提交 SHA：`588fae29e1c2fb7635cc6cbbfab680c2b4b64b66`。

区分连接意图与启动自动连接；显式关闭改变启用，窗口关闭、Safe Mode 和退出不改变意图。
新增单活动应用与无 Secret 公共状态、分层通道/DSH 健康及错误分类契约。管理窗口权限要求
准确 owner、页面与顶层 frame；没有放宽现有 IPC 或将未来窗口声明为已完成。
按 domain-modeling 记录对 ADR 0033 入口限制的局部演进，不改写历史决策。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/cc-connect-policy.test.ts test/cc-connect-ipc.test.ts` | 9 passed；含 64 组启动矩阵、关闭/暂停语义、伪造 sender/页面/子 frame 拒绝 | 0 |
| `pnpm run typecheck`、`git diff --check` | 通过 | 0 |
| `pnpm run verify` | 371 单测 + 1 ACP 全绿；覆盖率 89.13/80.92/85.11%；站点/构建通过 | 0 |

未覆盖项：持久记录/实际保存与迁移由 FS-02；运行中的串行启停/真实结构化事件由 FS-03；
窗口实际 IPC、扫码/UI 由 FS-04；安装包/真实飞书由 QA-01。无真实模型或飞书调用。

## FS-02 — 本地应用记录与隔离凭证

允许范围：配置/凭证工具、独立 main-only 应用存储及对应测试；未改主进程生命周期或 UI。
任务提交 SHA：`309efc77a286547153ca8f56a7bb26f22136fa23`。

应用记录用本地 UUID、App ID 去重；多份配置不隐式切换，省略显示偏好/空 Secret 保留旧值。
旧启用意图/全部显示偏好迁移，受保护凭证直接复制且不降级，原件只在 manifest 原子提交后
删除。新 Secret 写独立不可变修订，提交失败保留旧引用；旧修订/移除清理有持久重试队列，
启动在同一锁内清理未被引用的 UUID 凭证修订，不触碰非托管名称。启用中的选中记录拒绝移除。
未知/损坏 manifest 失败关闭，不用默认值覆盖；错误不引用输入/凭证。新存储尚待 FS-03 接入。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/cc-connect-applications.test.ts test/cc-connect-credentials.test.ts test/cc-connect-config.test.ts` | 18 passed；两种保护级别、无 Secret、去重/隔离、迁移/替换失败、清理中断重开、12 并发记录、损坏文件拒绝 | 0 |
| `pnpm run verify` | 380 单测 + 1 ACP 全绿；覆盖率 89.45/82.06/85.85%，类型/站点/构建通过 | 0 |
| `git diff --check` | 通过 | 0 |

实现后迭代修复测试夹具数组存在性与 readdir 重载类型检查，补损坏 JSON/解密错误脱敏、无凭证
应用不读取旧全局凭证的回归；没有跳过/弱化断言。所有数据是临时目录及假 Secret。
未覆盖项：实际单进程切换、停止失败、重启/自动连接、健康状态交 FS-03；用户界面/扫码交
FS-04；安装包/真实飞书交 QA-01。未修改子模块或真实用户数据。

## FS-03 — 生命周期权威与可靠健康

允许范围：main-only 控制器、连接存储/健康/Supervisor、主进程及内核重启协调、IPC/preload
生命周期说明、扫码保存成功文案和相应回归。父任务提交：`fdaaa9ac29f3008aa464bb4d66290e6fb4e621c8`。
子模块先提交并推送：`3febee7fcc3217da581e1e796ef4d28d014889b3`。

所有入口使用同一串行控制器；切换先等旧进程退出，停止失败保留所有权且拒绝第二个进程。
显式关闭先落盘禁用，Safe Mode/内核重启/退出仅暂停；启动自动连接独立且仅影响启动。
旧设置页限定选中应用，不再覆盖另一 App ID；QR 保存独立记录。公共状态用一次锁内快照，
新机器人独立会话数据目录，迁移机器人保留旧目录；移除不删除工作区或 DSH/聊天数据。

Sidecar opt-in 输出有版本、无内容的结构化事件。飞书健康来自官方 SDK 生命周期回调，
DSH 只在真实 ACP turn 结果后报告模型可用/缺 key；进程 ready、通道在线、任务可用和收发
验证时间互不冒充。普通日志不能改变健康。ready 后反复崩溃仍耗尽预算；停止取消自动重试
计时器；旧进程回调不能覆盖当前应用。没有新增 management API 或放宽 IPC guard。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/cc-connect-{applications,controller,health,supervisor,ipc,lifecycle}.test.ts test/shell-app.test.ts` | 46 passed，0 failed，0 skipped | 0 |
| `pnpm run verify` | 392 单测 + 1 ACP 全绿；覆盖率 89.76/82.93/86.45%，类型/运行边界/站点/构建通过 | 0 |
| `pnpm exec playwright test e2e/electron-shell.spec.ts -g 'close persists\|display settings IPC\|renderer bridge drives\|Extensions menu completes QR' --repeat-each=2` | 8 passed；多次重启/关闭/自动连接、Safe Mode、崩溃/重连、分层健康/缺 key、QR 保存 | 0 |
| 子模块 `go test ./...`、`go test -race ./...`、`go build ./...`、`go vet ./...` | 全部通过；真实本地 SDK WebSocket / 模拟 ACP，无真实凭证或飞书调用 | 0 |
| 子模块 `go test ./core -run TestCUJ -count=1` | 通过 | 0 |
| `git diff --check` | 通过 | 0 |

Go 门禁使用 canonical 临时 `TMPDIR=/private/tmp/dsh-connect-go-QCLP8U`，避免 macOS `/var` 与
`/private/var` 的既有夹具路径别名差异；未改动断言。首次全包 build 的 embed 缺 Web 产物，
按已有流程在子模块 web 执行冻结锁安装/构建，生成物未提交。默认 Go proxy 超时后仅本轮
使用 `GOPROXY=https://goproxy.cn,direct`，没有更改用户全局设置。

相关依赖例外：原飞书 SDK 3.5.3 缺可靠生命周期回调，真实断线 race 测试还发现其 connID
并发读写；只将直接相关 SDK 升至官方 3.12.0（含回调/可取消生命周期及该竞态修复）。适配
生成代码改名的枚举，值/原测试断言不变，不升级其他依赖。见
[官方生命周期实现](https://github.com/larksuite/oapi-sdk-go/blob/v3.12.0/ws/client_lifecycle.go)。
初版 session 包装会丢可选权限模式能力，改为窄 ACP turn observer 保留原 Session 类型。

迭代修复：自动重试停止后遗留计时器、纯 Node 夹具遗漏 command、Playwright 多次 relaunch
错误关闭初始实例。修复后重跑，未跳过/删除/降低断言；自动测试全部隔离真实 home/Secret。
未覆盖项：可操作应用列表、扫码过期/取消/重试、编辑/移除 UI 和新窗口授权交 FS-04；
安装包/三平台实机/真实飞书卡片与收发交 QA-01；本项尚未发布新版本。

## FS-04 — 统一飞书应用管理窗口

允许范围：管理窗口/页面、QR runner 与 main-only 管理器、受限 preload/IPC、设置入口、
原生菜单文案、构建 preload 与对应单测/Electron 回归。任务提交：
`462102f9fb33bea56be98423dab3f931c86e5aa5`；子模块未改动，保持 `3febee7`。

设置和菜单复用同一窗口及 FS-03 控制器。默认扫码，显示授权等待倒计时、取消/超时/重试；
手机成功后须等主进程保存，只显示“应用已保存”，不会自动切换或开启。支持多份本地应用
命名、工作区、降噪偏好、替换 Secret、显式保存并开启、切换、持久关闭、启动偏好与确认移除。
窗口关闭不停止已保存连接；创建中关闭会取消、等待子进程退出并清理整份临时目录。
提交保存已进入原子存储阶段时，关闭仍允许该次保存完成，但绝不会因此开启连接。

专用 preload 只含受控管理动作、选目录和固定平台外链；没有通用 Desktop/files/shell 或
Secret 回读。主进程精确检查 owner/完整页面 URL/顶层 frame；相同 URL 的伪造窗口也拒绝。
页面 hash-only script CSP、无远程资源，动态名称/路径仅 textContent/value；Secret 保存后清空。
健康分为服务/通道/任务，缺模型 key 指向 Models，不把进程 ready 或用户 OAuth 当连通。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `node --test test/feishu-manager.test.ts test/feishu-page.test.ts test/feishu-setup.test.ts test/menu-template.test.ts test/desktop-controls.test.ts` | 23 passed，0 failed，0 skipped | 0 |
| `pnpm run verify` | 396 单测 + 1 ACP 全绿；覆盖率 90.00/82.91/86.46%；类型/运行边界/站点/构建通过 | 0 |
| `pnpm exec playwright test e2e/electron-shell.spec.ts -g 'real Desktop display\|Feishu extension setup' --repeat-each=5` | 20 passed；真实设置/菜单、双语回显、多应用 CRUD/切换、持久关闭、QR 取消/超时/关闭清理、同页面伪造窗口拒绝 | 0 |
| `pnpm run typecheck`、`node --check plugins/dsh-desktop-controls/lib/client.js`、`git diff --check` | 通过 | 0 |

实现后发现并修复自动连接 checkbox 被保存前的旧状态同步改回；断言保留。中文入口回归首次
定位了简写而非完整按钮名，修正定位后重跑五次；第一次重复运行因此中断（130），不计成功。
取消夹具忽略 SIGTERM，检查已知 PID 消失与临时目录 ENOENT，不只检查从未生成的文件。
已核对中英文截图，未打印凭据；使用假 QR/Secret/Sidecar、隔离 userData/DSH_HOME。

未覆盖项：packaged 注入必须保持生产环境不接受 test-bin 覆盖，三平台安装包与受控真实飞书
留给 QA-01。已只读确认本机旧 settings/credentials 存在且为 0600；未将存在性当真实收发通过，
未写入真实用户目录、发送真实消息或发布新版本。下一任务 QA-01。

## QA-01 — 当前安装包与受控真实飞书验收

允许范围：packaged 夹具/定位器及回归、用户指南/setup skill、构建 manifest、记录。真实降噪
发现 ACP 双映射阻断验收，窄范围修复子模块 `agent/acp/{mapping.go,session.go,session_thought_test.go}`。
子模块先提交并推送 `dc8132ef5f6a30056b2b69036458156edbbfb25d`；父仓库随后提交 gitlink 与验收
改动：`b5c73420f66eae4f0c202a6a81363f0e4506e4e0`。不升级内核或无关依赖。

| 命令 | 结果 | 退出码 |
|---|---|---:|
| `go test ./agent/acp -run TestNotificationThoughtChunkEmitsOnlyThinking -count=1`（修复前） | 一条 thought + answer 实际发出 3 个事件，精简过滤失效；诊断失败不计通过 | 1 |
| `go test ./agent/acp ./agent/dsh -count=1` | 通知边界只输出 1 thought + 1 answer，旧映射/健康均通过 | 0 |
| `TMPDIR=/private/tmp/dsh-connect-go-QCLP8U GOPROXY=https://goproxy.cn,direct go test ./...`、`go test -race ./...` | 完整 Go / race 均通过（同一隔离 TMPDIR/proxy）；没有跳过或降低断言 | 0 / 0 |
| `go build ./...`、`go vet ./...` | 通过 | 0 / 0 |
| `pnpm run verify` | 397 单测 + 1 ACP；覆盖率 89.99/82.92/86.41%；类型/运行边界/站点/构建均通过 | 0 |
| `pnpm run test:e2e` | 26 passed；9 项按原有 packaged/Android/market 专项条件不在开发轮运行 | 0 |
| `DSH_E2E_PACKAGED=1 pnpm exec playwright test e2e/electron-shell.spec.ts -g 'real Desktop display\|Feishu extension setup' --repeat-each=5` | 20 passed；新管理与降噪真实 Harness 五轮 | 0 |
| `pnpm run test:e2e:packaged`（最终重跑） | 全部 15 passed，0 skipped；含登录、四项飞书、垃圾桶四项及活动/外部 lease 拒绝 | 0 |
| `pnpm test:e2e:market:offline`、`pnpm test:e2e:market:real` | 1 / 2 passed | 0 / 0 |
| `GOPROXY=https://goproxy.cn,direct pnpm run dist:dir`、`pnpm run smoke:packaged`、`pnpm run smoke:packaged-ui` | 修复后当前源码 mac-arm64 解包产物与两个 smoke 通过（当时版本 shell.0）；新 shell 版本仍需重建 | 0 / 0 / 0 |
| `pnpm run security:audit` | 双树审计通过；未新增 ignore 或升级无关依赖 | 0 |
| `node --test test/cc-connect-docs.test.ts test/feishu-cli.test.ts test/packaged-locator.test.ts` | 最终 2 TAP 测试及 CLI 顶层检查通过 | 0 |
| `python3 .../skill-creator/scripts/quick_validate.py .agents/skills/feishu-dsh-setup`、`git diff --check` | 通过 | 0 / 0 |

打包 Sidecar commit `dc8132ef...`，SHA-256 `2c279d633f011822582037ff8fc8ba3130f821444a51231253ca86041e4d2966`，
已独立校验 manifest 与二进制一致；构建时含时间戳，后续新打包摘要会变化。

真实验收使用用户此前明确授权的机器人会话；既存凭据只读，授权副本位于独立临时
DSH_HOME/userData/工作区，0600。经 tenant-token/bot-info 确认凭据有效且目标匹配，没有打印
Secret、token、OAuth 内容。旧配置迁移、通道 online、ACP 成功任务 available 均已实际观察。
修复前 compact 出现思考正文与最终重复内容；修复后 compact、quiet 各 1 条最终答复，rich
1 条 Done 卡片与用时；full 正常回包。只读目录工具确实产生 tool/call 与 tool/result，compact
仍仅 1 条最终答复。显式关闭后 disabled/offline、Sidecar 退出；探针超过 30 秒无回复，2 份
持久会话摘要均未变化。最终原 3 份配置/凭据 SHA 与权限一致，整份临时目录/凭据已清理。

迭代问题：通用 ACP fallback 将 thought 当 EventText，又走专用 EventThinking，改为统一一次
映射；相对安装包路径在隔离 cwd 下 ENOENT，定位器保证 absolute；boot overlay 不存在并不
代表页面就绪，改为必须 desktop-controls mounted，同时正确处理导航中 body=null/context 销毁。
初轮 packaged suite 2 failed/13 passed（启动 body=null；并发重打包让运行中的垃圾桶 Harness
断连）；保留断言、修正夹具并停止重打包后全轮 15 passed。禁止在 smoke/E2E/真实验收中重写 dist。

未覆盖项：本轮真实手机扫码新增应用需人工扫码，二维码取消/超时/保存/隔离改由假服务与
真实管理窗口回归；不把前次扫码或手机提示当新流程通过。Windows/Linux 本轮安装包与
安装/升级/相关 packaged 回归交发布 CI；macOS 尚未签名公证。下一任务：shell-only 发布。

### QA-01 发布前补充 — 假凭据不访问真实钥匙串

新 shell.1 ad-hoc 签名触发本机 macOS 钥匙串提示，假 Secret 测试阻塞。只修改两个隔离
E2E main 进程夹具的 safeStorage 可用性依赖，明确验证现有 0600 文件回退；产品逻辑与
safeStorage adapter 单测未改，真实受保护存储已由上述授权副本验收。没有批准系统提示或
修改钥匙串授权。修复提交 `539bc04`（完整 SHA 见 Git）；初轮 manager 失败/中断退出 130，
packaged 中断退出 1，不计通过；清理已知测试进程后保留所有断言重跑：

- shell.1 五轮 display/manager：20 passed，退出 0；增加 `credentialProtection=file` 断言。
- shell.1 完整 packaged：15 passed、0 skipped；开发态：26 passed，原有 9 专项条件未运行，均退出 0。
- `pnpm run verify`：397 + 1 ACP，退出 0；凭据/Sidecar 构建/资产专项 6 passed，退出 0。
- shell.1 两种 packaged smoke、LAN QR 2/2、market offline 1/1 与 real 2/2、双树审计均退出 0。
- shell.1 mac-arm64 产物 Sidecar `dc8132ef...`，manifest/二进制独立校验一致，SHA-256
  `baa0d24b46aa72c697e000e01afd032dde16ae0db15aebef1e0c47bc6bf6a56d`。源码 hash-only 构建变化已还原，
  保留真正的子模块 commit 更新；新产物的实际 manifest 不变。

未覆盖项与下一任务不变：三平台发布 CI、GitCode 六资产与官网/HANDOFF。GitCode 浏览器
扩展连接曾缺失，启动后已响应且发行版管理可见，前置条件已恢复，不将它保留为凭据缺失阻塞。
