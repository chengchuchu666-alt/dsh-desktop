# 正式安装验收进度

日期：2026-10-11。当前状态：INS-01 完成，REAL-01 实机验收进行中；
BUG-01 布局已最小修复并通过源码/隔离 Harness 回归，尚待新正式包复验。
已取得本轮真实界面、飞书、视觉及录屏证据，但不能声称整个矩阵全部通过。

## INS-01 — 正式 DMG 覆盖安装

允许范围：已授权的正式应用 bundle、可恢复旧 bundle、这两份验收文档；没有产品改动。
安装记录与验收矩阵提交：`7c13326a3871f89e4b54da68424400e270355061`。

- 原正式应用：`0.2.1-alpha.2.shell.0`，安装前没有该正式可执行文件的运行进程。
- 输入：已下载的 GitHub shell.1 DMG，286,787,348 字节。
- DMG SHA-256：`b98ef241f68a481bfe0b2210a5ba0d78e3618b11668d44c0c74e31c362e3add4`，与发布校验一致。
- 通过只读挂载/ditto 暂存、签名/版本核对后替换 `/Applications/dsh-desktop.app`。
- 旧 bundle 保留在 `/private/tmp/dsh-installed-shell1.mIVHhr/previous-shell.0.app`，可恢复；没有删除旧应用。
- 版本：`0.2.1-alpha.2.shell.1`。只读 DMG `/dev/disk8` 已卸载。
- 正式安装 Sidecar commit：`dc8132ef5f6a30056b2b69036458156edbbfb25d`，darwin/arm64。
- 正式安装 Sidecar SHA：`01caf8b346ef66ff915595e75c38d74a817747e7f72b482e6831690c28bb9f46`，与实际 manifest 一致。
  此值为 CI DMG 构建，不沿用前轮本地 dist 时间戳构建的不同摘要。

| 检查 | 结果/退出码 |
|---|---|
| 安装前 PlistBuddy 版本 | shell.0 / 0 |
| DMG 流式 SHA 等值断言 | 通过 / 0 |
| `hdiutil attach -nobrowse -readonly` | 全部 CRC 校验通过 / 0；工具弃用提示保留 |
| 暂存 bundle `codesign --verify --deep --strict`、版本等值断言 | 通过 / 0 |
| 旧 bundle 移到明确备份、新 bundle 移到 Applications | 完成 / 0 |
| 正式 bundle PlistBuddy / codesign | shell.1 / 0；完整性通过 / 0 |
| 正式 bundle Sidecar manifest/二进制 hash/commit 断言 | 通过 / 0 |
| `open -a /Applications/dsh-desktop.app` | 系统接收启动请求 / 0；不等于 UI 启动验收通过 |
| `hdiutil detach /dev/disk8` | 卸载完成 / 0 |
| 证据目录 git check-ignore | 被忽略 / 0；目录 0700 |

没有直接手工编辑用户 home/凭据；应用启动后的正常迁移和实际业务状态仍待解锁后核对。

## REAL-01 — 真实安装版验收

CUA 用 bundle ID 选应用时发现多个既存安装副本，改用明确路径
`/Applications/dsh-desktop.app`，没有误测旧 dist。当前系统返回：
“The Mac is locked and automatic unlock could not unlock it.”

用户已解锁；本轮中再次锁屏时停止了界面操作，用户再次解锁后才恢复。真实飞书发送
已明确授权，只限本人“用户051658的智能助手”，没有发送其他联系人/群聊。

- 正式应用“关于”确认 shell.1 / 内置 kernel 0.2.1-alpha.2；实际启动、正常退出、重开通过。
- 正式设置健康检查：内置运行时及本地存储正常，Harness 已启动；5 个既存用户插件保留，
  其中社区市场/侧栏的旧兼容范围提示为建议风险，不把用户插件改动混入修复。
- 主界面真实模型完成带标记只读任务，已展开查找文件/搜索工具记录及最终答复。
  模型额外使用了只读搜索，不把“仅用一次列目录”的提示服从性当作产品保证。
- 本轮测试会话置顶/取消置顶、归档/取消归档即时刷新。经该会话导出对话框核对完整
  编号后取消下载，只将此对象软删除再还原；侧栏/详情马上同步，消息与只读权限保留。
  没有永久清除或操作历史对象；删除发生时设置暂时关闭，还原后设置重新呈现。
- 真实飞书：compact/3s/经典得到单条最终答复；静默/无预览/富卡片/结构化进度得到
  单个 Done 卡片；full/5s/经典/单消息进度得到两条回复（合并思考和 `ls` 工具输出、最终
  标记）。compact 工具请求有最终答复，但未独立证明该请求的实际工具调用，不能夸大覆盖。
- 显式关闭后发探针，无新回复；正常退出/重开仍关闭，且正式 Sidecar 未启动。
  随后恢复开启，服务启动、飞书在线；自动连接仍开启。
- 原偏好已用正常 GUI 恢复并保存：精简、预览开启/3s、经典卡片、逐条进度；
  Secret 编辑框为空且仍显示系统安全存储，不直接编辑 home 或读回凭据。

证据位于忽略的本地目录 `release-check/installed-shell1-review-20261011/`，不上传私人录像。

| 录像/截图 | 核验结果 |
|---|---|
| 01-native-settings | 未产生文件；不能记为通过 |
| 02-feishu-manager.mov | 45.008s / 3014×1990；已复核偏好编辑、预览禁用与恢复 |
| 03-real-feishu-compact-tool.mov | 捕获前台 Codex 而非飞书，排除；正确 CUA 截图仅证明最终回复 |
| 04-real-feishu-quiet-rich.mov | 录制因操作辅助故障取消，排除，不算产品故障 |
| 05-bound-feishu-quiet-rich.mp4 | 绑定指定飞书窗口；已复核发送→单个 Done 富卡片 |
| 06-bound-feishu-full-tool.mp4 | 52.168s / 2926×1898；已复核发送→思考/工具消息→最终标记 |
| 07-bound-main-real-task.mp4 | 57.372s / 2922×1898；已复核发送→运行→最终答复；工具展开另有截图 |
| 08-real-trash-delete.mp4 | 首次定位过程，不能单独证明删除/还原 |
| 09-real-trash-delete-restore.mp4 | 已录制真实删除/还原，关键帧复核待完成 |
| screenshots/06–10 | 主任务工具、完整模式、关闭探针、删除/还原即时侧栏证据 |

尚待：正式 Safe Mode/运行恢复、语言主题/最小窗口、LAN、诊断/更新、其余矩阵及修复新包。
手机扫码和跨系统本机硬件无法自动替代；竞争/危险故障仅在隔离 profile 中验证。

## BUG-01 — 布局修复与回归

- 原子范围见 README；没有 IPC、Secret、依赖、kernel 或子模块改动。
- 诊断假设：缺样式最可能；宽度问题与用户主题覆盖次之。实际 CSS 隔离诊断在
  280px/600px 都得到 radius=0、health=inline（退出 1）；无用户插件仍复现，排除后两项。
- 最小修复：管理入口复用已有按钮/主色/禁用样式、限制宽度并允许换行；健康文本复用
  已有块级元信息样式。两个原诊断均变为 radius=999px、health=block 且位于按钮下方（退出 0）。
- `node --test test/desktop-controls.test.ts`：6/6，退出 0。
- 实际 Harness UI 测试追加中文默认宽度/英文 800px 计算样式、健康块位置与按钮边界。
  首次失败因产品最小窗口限制（收到 960，要求 800，退出 1）；只在隔离 fixture 放宽尺寸
  后重跑成功，原边界断言未删除/降低。正式应用按原最小尺寸验收。
- `pnpm exec playwright test e2e/electron-shell.spec.ts -g 'real Desktop display controls'`：1/1，退出 0。
- `pnpm run verify`：完整门禁退出 0，日志 `/tmp/dsh-installed-review-layout-verify.log`。
- 提交 SHA 待完成原子提交后回填；正式新包视觉验证仍待 QA-02，不把隔离测试等同实机完成。

## 安装后安全基线门禁

- `pnpm run verify`：397 单测 + 1 ACP，0 failed/skipped，覆盖率
  89.99/82.93/86.41%，类型/运行边界/站点/构建通过，退出 0；日志
  `/tmp/dsh-installed-shell1-baseline-verify.log`。这是源码/隔离 ACP 基线，不是正式应用真实 UI 验收。
- 计划文档的 3 个本地链接目标与结尾换行检查：退出 0。
- `git diff --check`：退出 0。没有产品、依赖、真实凭据或子模块变更。
