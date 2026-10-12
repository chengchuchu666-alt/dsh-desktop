# 正式安装验收进度

更新：2026-10-12。INS-01、REAL-01 本机安全验收、BUG-01/02、QA-02/03 本地门禁完成；
最终 pin 的 shell.2 已安装并真实复验。手机部分按用户最新指示由真实二维码 + 无头移动浏览器
完成自动验收，不声称物理相机/异机 Wi-Fi 或 Windows/Linux 本机实测。下一任务 REL-02 发布。

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
`/Applications/dsh-desktop.app`，没有误测旧 dist。初次验收时系统返回：
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
| 09-real-trash-delete-restore.mp4 | 关键帧复核只覆盖删除→列表清空→桶内出现；还原发生在录像结束后，不能据此称还原已录到 |
| screenshots/06–10 | 主任务工具、完整模式、关闭探针、删除/还原即时侧栏证据 |

- 正式 Safe Mode 进入/退出通过：插件隔离、飞书暂停/离线，原意图保留；退出后插件及
  飞书在线恢复。正常 GUI 切换英文/深色并审查设置，再恢复中文/浅色，未改变权限偏好。
  更新检查真实返回“已是最新版本 shell.1”。相关截图 11–13；录像 10 只覆盖前半段主题
  切换，不把未录到的英文操作纳入该录像证明。

尚待：正式最小窗口、LAN、诊断、其余矩阵及修复新包。
手机扫码和跨系统本机硬件无法自动替代；竞争/危险故障仅在隔离 profile 中验证。

- 正式诊断导出经隐私提示确认后保存到本地私有证据目录，262,577 字节、0600；
  shell.1 版本信息存在，home 路径及常见长 key/Bearer/tenant-token 模式未出现（检查退出 0）。
  模式检查不等于对所有可能凭据的绝对证明，没有上传日志或读回原 Secret。
- 用户明确授权临时开启 LAN，并愿意手机扫码。已生成正式窗口二维码，等待实际手机结果；
  不把授权或二维码显示算作手机配对成功。验收后通过“停止共享”恢复关闭。

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
- `pnpm run verify`：398 单测 + 1 ACP，0 failed/skipped，完整门禁退出 0，日志
  `/tmp/dsh-installed-review-layout-verify.log`。
- 原子提交 `5cc8d267c8bf9428b99cedc08eccddc2e1737441`，origin 集成分支已推送（退出 0）。
  精确暂存遇到既有 lib ignore 提示（退出 1），核对索引仅为允许的五文件后提交成功；
  不能由暂存命令退出码推断没有入索引。已在既有 release skill 中记录同类坑，不改 ignore。
- GitCode 集成分支也已推送（退出 0）。跨平台补充用 `setContentSize` 代替外框 `setSize`，
  保持 800px 内容断言以避免 Windows 窗框误差；同一 Harness 用例重跑 1/1（退出 0）。
- 全开发 E2E：26 passed / 9 独立套件未在此命令启用 / 0 failed（退出 0），未改跳过条件；
  打包/市场/设备覆盖分别记账。双树 `pnpm run security:audit` 退出 0，没有新增忽略项。
- 新包视觉验证仍待 QA-02，不把隔离测试等同实机完成。下一任务：完成剩余安全实机检查，
  shell-only 新版本构建后执行全部 packaged gates，再按原场景复验。

## BUG-02 — 配对倒计时

- 正式 shell.1 窗口数分钟后仍为 600 秒，关闭按钮正常；页面模板已提前插值，脚本无法替换秒数。
  修改范围见 README，仅修复显示，不改变真实到期、一次性令牌、Secret 或监听权限。
- 最小实现后 `node --test test/lan.test.ts`：14/14，退出 0；新增中英脚本执行测试验证
  600→599→1→到期，使用自建数据及确定时钟。LAN 窗口 E2E 追加实际秒数下降断言。
- shell.2 修复前包：verify 398 + 1 ACP、两种 packaged smoke、packaged E2E 15、
  飞书显示/管理五轮 20、LAN 2、市场 offline 1 + real 2 均退出 0；日志前缀 `/tmp/dsh-shell2-`。
  这些产物不含倒计时修复，不作为最终新包准入。下一步：BUG-02 完整验证/独立提交，
  串行重建 shell.2 后重新执行最终包门禁与正式视觉复验。
- 修复后的 `pnpm run verify`：400 单测 + 1 ACP、0 failed/skipped，退出 0；
  `pnpm exec playwright test -g 'LAN pairing'`：2/2，实际窗口秒数下降及移动浏览器配对均通过，
  退出 0。日志 `/tmp/dsh-shell2-countdown-{verify,lan}.log`。旧包临时共享已经正常 GUI 关闭。
- 原子提交 `863960fe7148fff539a31274b12ff680e3510498` 已推 origin/GitCode 集成分支，退出 0。

## QA-03 — 子模块测试收尾

- 首次默认临时目录的全量 Go test 退出 1：Codex/workspace-skills 夹具混用 `/var` 和
  `/private/var`；改用 canonical `TMPDIR=/private/tmp` 后对应四类用例定向通过，完整 test 通过。
  没有改路径断言或用户全局环境，既有原因见上一轮执行记录。
- 全量 race 首轮退出 1：未知斜杠请求/多会话附件用例在最终保存前结束，TempDir 清理竞态。
  仅等待两条回复的首次修复在 100 轮中仍失败，揭示模拟 Agent 两个会话共用一个事件通道，
  让另一会话误当 unsolicited reply 再次保存；没有把这一失败算通过。
- 最小修正两个测试：未知请求等待最终回复；多会话独立事件通道、等待两条最终回复并确认
  两个独立会话各收到请求。保留歧义发送拒绝与不泄露附件断言，不改产品或依赖。
- targeted race 两项各 100 轮通过（退出 0）；canonical 全量 `go test ./...`、
  `go test -race ./...`、`go build ./...`、`go vet ./...` 全部退出 0。日志
  `/tmp/dsh-shell2-go-cleanup-final-repeat.log` 与 `/tmp/dsh-shell2-go-final-*.log`。
- 子提交 `5cf99a2700ee5401af1b8c4fa15b6e63fd840bcb` 已先推子模块 origin 分支，退出 0。
  下一步：父 gitlink/manifest 精确提交后串行重建；修复前 pin 的产物不能作为最终发布包。

## QA-02 / REL-02 — shell.2 候选与外部人工步骤

- `node scripts/version.mjs bump shell` 仅将壳升至 shell.2；kernel/pins/锁文件均不变。
- 倒计时修复包（仍为旧子 pin）完成开发 E2E 26、packaged 15、飞书五轮 20、市场 offline 1
  与 real 2、两项 smoke（均退出 0）；本地包为 ad-hoc，codesign 深度完整性与版本校验通过。
- 正常退出旧正式进程（确认 0 个），ditto 暂存并验签后覆盖 Applications，旧 shell.1 保留在
  `/private/tmp/dsh-installed-shell2.0ME74t/previous-shell.1.app`。未删除旧 bundle 或手工改真实配置。
  当时 Sidecar SHA `936cd7b44196adce5eadf9e22ba39346452526f3089d5b19069be114506ad226`，旧 pin
  `dc8132ef5f6a30056b2b69036458156edbbfb25d`；与实际包 manifest 一致，不冒充最终新 pin。
- Applications 候选启动显示等待 Harness 后，DSH 界面读取连续超时，其他飞书界面可读取。
  主线程 sample 证明停在 `SecItemCopyMatching`/钥匙串，系统 SecurityAgent 运行；
  已请求用户手动处理系统认证，工具不允许访问该认证应用，未尝试绕过或改用明文 Secret。
- 当前 LAN 已通过正常“停止共享”关闭，3081 无监听；手机没有回报实际配对结果。
  新二维码需待系统授权后重新生成。真实新包视觉/录屏与手机部分尚未完成，REL-02 不创建 tag。
  下一任务：完成新 pin 的本地门禁，等待用户处理钥匙串，然后正式复验并发布；不声称目标已完成。

### 2026-10-12 继续：最终 pin 本地包与系统授权

- 父 pin 原子提交 `c3a984a0fd94dd8c73693c5aa6fb74a257456afb` 已推两集成远端，退出 0。
- 最终子 pin `5cf99a2700ee5401af1b8c4fa15b6e63fd840bcb` 的串行门禁全部退出 0：
  verify 400 + 1 ACP、双树安全审计、dist:dir、两项 packaged smoke、packaged E2E 15、
  飞书五轮 20、市场 offline 1 + real 2；Go CUJ 独立重跑退出 0。日志 `/tmp/dsh-shell2-pinned-*.log`。
- 最终本地包 Sidecar SHA `2e306e602e3ba9610bbfa1837c4c419474b1c022f7387cd8696ca231c8851344`，
  与实际二进制/manifest/子 HEAD 等值断言一致，版本 shell.2 和 codesign 深度校验均退出 0。
  源码 manifest 的同 pin 构建时间 hash-only 变化按发布约定恢复，不混入源码提交；包内摘要不变。
- 继续时旧候选的系统等待已解除，CUA 真实主界面恢复。正常退出（确认主进程 0 个），
  暂存/验签后换装最终 pin；原未固定 pin 的 shell.2 保留在
  `/private/tmp/dsh-installed-shell2-final.bLdqDp/previous-unpinned-shell.2.app`，旧正式 shell.1 备份仍保留。
- 新签名再次触发系统钥匙串等待，已请用户处理当前提示；没有代输入或访问认证应用。
  安装顺序的坑：版本/子 pin/全部打包门禁固定后再覆盖正式 bundle，减少候选 hash 变化导致的
  重复系统授权。仍需用户系统授权后完成实机视觉/录屏与手机结果，不提前创建发布 tag。
- 当前最终安装主进程 sample 再次确认 `SecItemCopyMatching` 等待，私有证据 0600；
  `pnpm exec playwright test -g 'LAN pairing'` 在最终 pin 下重跑 2/2（退出 0），
  3081 TCP 连接返回 ECONNREFUSED（关闭状态断言退出 0）。手机仍未实测，不混同浏览器模拟。
- shell.2 双语候选说明 `write-release-notes check` 退出 0；源 manifest 同 pin hash 已恢复，
  无产品额外改动、真实凭据/录像入仓库或运行中的 dist 重写。候选版本与文档精确提交到
  集成分支，正式发布仍为 shell.1；下一步只待当前系统认证与正式界面/手机复验。

## 安装后安全基线门禁

- `pnpm run verify`：397 单测 + 1 ACP，0 failed/skipped，覆盖率
  89.99/82.93/86.41%，类型/运行边界/站点/构建通过，退出 0；日志
  `/tmp/dsh-installed-shell1-baseline-verify.log`。这是源码/隔离 ACP 基线，不是正式应用真实 UI 验收。
- 计划文档的 3 个本地链接目标与结尾换行检查：退出 0。
- `git diff --check`：退出 0。没有产品、依赖、真实凭据或子模块变更。

## QA-02 — 最终安装版真实复验与自动扫码闭环（2026-10-12）

- 用户已处理系统授权；当前 Applications 最终 shell.2/pin `5cf99a27` 正常运行。
  本轮不再覆盖/重签已授权的 bundle，也不重写测试中的 dist；新版本/子 pin 保持固定。
- 正式中/浅、英/深及 960×640 最小窗口已复核，管理按钮圆角主色、健康文本独立块和换行正常；
  原中文/浅色、权限及飞书 compact/3s/经典/legacy 偏好恢复，原窗口 1461×949。
  截图 14–16、24/26；录像 11/12 仅覆盖部分主题切换，英文操作晚于录制，不据此夸大覆盖。
  录像 13（20.217s / 1920×1280）实际为英/深布局静态证明。
- 本人授权机器人实际收到单条 `AGENTS.md package.json DSH-SHELL2-FINAL-OK-20261012`；
  无独立思考/工具刷屏。桌面 GUI 为服务已启动、飞书在线、任务已完成、系统安全存储。
  不能由该请求的答复单独断言这次确实调用了工具；shell.1 工具时序证据与未变产品代码另列。
  截图 18/24。录像 14 停流失败（退出 133），排除；串行重录 16 成功（退出 0，20.178s /
  2926×1898），关键帧确认为最终真实回包静态证明，不冒称发送时序。
- 配对倒计时实机下降并到期自动关闭窗口；录像 15（退出 0）复核约 307→302→297，
  不把到期关闭误判为关闭按钮失效。到期不等于停止 LAN 监听，验收后仍需正常停止共享。
- 用户要求自行模拟扫码，已取消人工扫码等待：正式窗口截图 Vision QR 解码成功（退出 0），
  新隔离 Pixel 7 移动上下文访问实际私网地址，浏览器不借用用户既存登录态。
  `node release-check/installed-shell1-review-20261011/check-installed-mobile.mjs <private-QR-file>`
  最终退出 0：未认证 401、二维码预填且 fragment 移除、兑换 200、一次性重用 403、HttpOnly
  Cookie、master 管理 401、真实 Harness、指定只读验收会话/最终标记、横竖屏无横向溢出、
  收起侧栏后输入区至少 60% 视口、刷新认证 200、正常退出后 401。没有发新任务或改会话。
- 过程中脚本四次失败：缺省 headless-shell 未安装；两次首次说明遮罩晚于瞬时可见性检查；
  一次定位名写为“发送消息”而实际为“发消息”。使用已安装 Chrome、等待实际说明并点继续、
  按真实控件名定位后复跑；保留全部行为/宽度断言，没有 force 穿透遮罩或改产品。
  早期两轮功能通过不替代最终加强版通过；全部已兑换测试设备经官方退出端点自行撤销。
- 最终私有证据 `mobile-run-CmhHhJ/`：竖屏、只读会话、横屏、退出页及 WebM，已逐图及关键帧
  复核。测试代码/记录均为忽略的本机诊断资产，不上传配对码、Cookie、真实 Secret 或私人视频。
  本机浏览器模拟覆盖扫码后的流程；物理相机/独立手机网络及原生 Android WebView不在本轮证明内。
- GUI 停止共享后按钮恢复“开始配对”，TCP 3081 `ECONNREFUSED` 断言退出 0。
  原设备、历史会话、真实设置文件均未手工编辑；临时 QR URL 文件清理，测试上下文关闭。
- 钥匙串根因：Secret 已加密持久保存，凭据单测 4/4（退出 0），并非 Secret 丢失。
  ad-hoc 指定要求在 shell.1 与当前包为不同 cdhash；Electron 官方 safeStorage 文档指出
  不一致签名会导致升级重复授权。当前只有 Apple Development 签名身份，没有发行 Developer ID
  配置；不重签测试这个身份，以免再次授权。长期稳定签名/CI 管理作为 README 的 P1 后续迭代，
  不宣称“记住明文”能解决，不绕过系统安全。来源：
  https://www.electronjs.org/docs/latest/api/safe-storage 及 Apple TN2206。
- 本原子文档门禁：差异/本地链接检查；提交 SHA 与推送结果由 REL-02 后续记录补齐。
  下一任务：合并远端 main，保持历史提交 SHA，正式 shell.2 tag、三平台 CI、六资产镜像与官网。
