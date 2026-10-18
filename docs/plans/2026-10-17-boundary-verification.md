# 未覆盖边界验证计划：真实飞书往返 / Windows·Linux 原生视觉 / 第三方 AV

> 2026-10-17 起执行。此前的三轮回执（HANDOFF §83–§85）都把这三项列为「未覆盖」，本计划用可核验的真实环境把它们逐个补齐或明确写出无法补齐的具体原因。
> 铁律不变：不模拟代替真实、不夸大、不把 CI runner 或容器当成真机、任何 Secret/token 不进入命令记录、仓库文件与日志。

## 0. 三项边界与判定标准

| 边界 | 之前的状态 | 补齐的判定标准（本计划的验收口径） |
|---|---|---|
| A 真实飞书往返 | 只有临时 profile + 假 Secret 的模拟；真实手机/桌面端往返未做 | 用**已发布的打包产物**（不是源码 Electron）连上真实飞书，从**电脑版飞书**发出带标记消息，收到机器人真实回包；三段状态（服务已启动 / 通道在线 / 任务完成）分别取证；关闭后不再回包；配置与凭据 SHA 前后可比 |
| B Windows/Linux 人工原生视觉 | 只有 CI 上的程序化断言与 Xvfb 截图 | 在真实 Linux（GNOME/Xorg）与 Windows 桌面上安装**已发布安装包**，逐项核对窗口装饰、菜单、原生对话框、输入法、DPI、托盘等原生表现，并留下可复核截图 |
| C 第三方 AV 真机 | CI runner 上 Defender 实时防护为关闭状态；无第三方杀软 | 在装有杀软的 Windows 上安装已发布 EXE，记录杀软版本、拦截/隔离/误报与安装耗时；若目标平台无法安装第三方杀软，写明具体原因并用多引擎扫描补足覆盖面 |

## 1. 隔离原则（A 项）

- 使用**独立 userData + 独立 DSH_HOME** 运行 rc.1 打包产物，不触碰用户的真实 `~/.dsh-desktop`、真实会话与正在运行的实例（`/Applications/dsh-desktop.app`）。
- 模型凭据采用权限保持的原样副本（0600）放进隔离 home，用完随隔离目录一起清理。
- 机器人凭据只允许用户本人在应用的高级表单里录入一次；不接受、不读取、不转写 App Secret。仓库与本文件不记录任何 Secret。

## 2. 环境与产物

| 项 | 值 |
|---|---|
| 被测产物 | GitHub Release `v0.2.1-rc.1.shell.0` 的 DMG / EXE / DEB（SHA-256 见 HANDOFF §85） |
| 隔离实例 | `~/dsh-review/rc1/dsh-desktop.app`（从 DMG 复制），`--user-data-dir=~/dsh-review/rc1/userData`，`DSH_HOME=~/dsh-review/rc1/home` |
| Linux 虚拟机 | QEMU 11.1.2 + HVF，Ubuntu 24.04.5 LTS arm64，6 vCPU / 10 GB / 48 GB 磁盘，VNC `127.0.0.1:5901`，SSH `127.0.0.1:2222` |
| Linux 桌面 | `ubuntu-desktop-minimal`（GNOME），Xorg 会话，GDM 自动登录 |
| Windows 虚拟机 | 与 Linux 同一台 QEMU 宿主的第二个实例（arm64 Windows 11），安装方式见 §5 |
| 证据目录 | 截图与日志放 `~/dsh-review/evidence/`（含隔离实例与两个 guest 的采集结果），仓库内只写脱敏结论 |

## 3. A 项执行步骤与回执

| 步骤 | 内容 | 结果 |
|---|---|---|
| A-1 | 隔离实例启动，独立 home/profile 生效 | 待记录 |
| A-2 | 用户在高级表单录入机器人凭据一次 | 待用户操作 |
| A-3 | 开启连接：记录「服务已启动」 | 待记录 |
| A-4 | 频道上报「在线」 | 待记录 |
| A-5 | 电脑版飞书发送带标记消息（full/compact/quiet/rich） | 待记录 |
| A-6 | 机器人真实回包 + 记录「任务已完成」 | 待记录 |
| A-7 | 关闭连接 → 30 秒无新回包 → 侧车退出 | 待记录 |
| A-8 | 配置/凭据 SHA 前后对比、隔离目录清理 | 待记录 |

## 4. B 项（Linux）检查清单

安装与集成：

- [ ] `dpkg -i` 安装成功，依赖满足（`apt-get -f install` 无缺失）
- [ ] `/usr/share/applications/*.desktop` 存在且 `Name`/`Icon`/`Exec` 正确，应用出现在 GNOME 应用网格
- [ ] 从应用网格启动（不是从终端跑二进制）
- [ ] 卸载后残留（`dpkg -r` 后 `/opt`、desktop 文件、用户数据）

原生视觉（GNOME/Xorg，软件渲染）：

- [ ] 主窗口装饰、最小化/最大化/关闭按钮位置与行为
- [ ] 应用内菜单栏/快捷键（Ctrl 而非 Cmd 的映射）
- [ ] 原生文件对话框（选择工作区/导出诊断）标题、按钮、侧栏
- [ ] 托盘/状态区图标（GNOME 需 AppIndicator 扩展；缺失时记录为平台差异而非缺陷）
- [ ] 系统通知（任务完成通知）在 GNOME 通知中心出现
- [ ] 输入法：fcitx5/ibus 下中文输入可用（候选窗跟随光标）
- [ ] DPI：100% 与 200% 缩放下布局不溢出、字体不截断
- [ ] 深/浅色主题切换后的对比度
- [ ] 终端面板（PTY）字体渲染与中文
- [ ] 截图/权限对话框（屏幕录制权限在 Linux 上的表现）

## 5. B/C 项（Windows）执行步骤

1. 取得 Windows 11 arm64 ISO：优先微软官方下载页（浏览器流程），浏览器通道不可用时用 UUP dump 在 Linux guest 内合成官方 ISO。
2. QEMU 新建 Windows guest（virtio-blk + virtio-net + virtio-gpu，VNC 供观察），安装过程按需手动应答。
3. 安装已发布 EXE，逐项核对 Windows 原生视觉（标题栏、系统菜单、通知、DPI、输入法、文件对话框、托盘）。
4. AV 验证：
   - Defender 实时防护开启状态下的安装/首启/卸载拦截记录（含 `Get-MpThreatDetection`、事件日志）。
   - 第三方杀软：arm64 Windows 上逐一确认可否安装（360/火绒/腾讯电脑管家 与 ESET/Kaspersky/Bitdefender），能装则重复上面的记录；不能装则记录具体报错并说明平台限制。
   - 多引擎扫描：对已发布的 EXE/DMG/DEB 做哈希查询或（经用户同意后）上传扫描，记录引擎数与命中情况。
5. 安装耗时与覆盖升级：沿用 `scripts/benchmark-nsis.mjs`、`scripts/smoke-nsis-residue.mjs` 的判定口径，在 VM 内重复一次。

## 6. 明确的不可替代边界

- 电脑版飞书往返可以证明真实通道与真实回包，但不等于「手机端通知/多端同步」的验证；手机端仍属未覆盖，需真机。
- QEMU 的 Windows/Linux guest 是真实操作系统与真实渲染，但不是物理机；GPU 加速、外接显示器、真实 OEM 驱动相关的表现不在证明范围内。
- 第三方杀软的云查杀结果会随时间变化，回执记录的是查询时点的结果与引擎清单。

## 7. 回执（滚动更新）

见本文件末尾每次执行后追加的日期、命令、退出码与证据路径。

## 8. 执行回执（2026-10-18）

### 8.1 A 项：真实飞书往返

| 观察 | 证据 |
|---|---|
| 用户真实实例（`/Applications/dsh-desktop.app`，alpha.3）已在做真实往返 | `~/Library/Application Support/dsh-desktop/logs/cc-connect.log`：`00:00:43 message received platform=feishu` → ACP 工具调用/权限请求 → `00:02:28 turn complete … tools=52`；今日 `09:41:12 turn complete` 仍在产出 |
| 已保存应用 | `applications.json`：app `cli_aa59dd…`，workspace `/Users/citrus/dsh-desktop`，`needsSecretReentry=false`，凭据为本机受限明文文件（0600），连接在线 |
| 隔离 rc.1 实例 | `~/dsh-review/rc1/dsh-desktop.app`（0.2.1-rc.1.shell.0，DMG 复制），`--user-data-dir=~/dsh-review/rc1/userData` + `DSH_HOME=~/dsh-review/rc1/home`，管理器窗口可开、表单为空 |
| 凭据复制试验 | 按技能允许的“权限保持的授权凭据副本”把 `applications.json` + `credentials/*.json` 复制进隔离 userData（0600，未读取内容）；为避免与原实例抢事件，试验后已删除，改为等待用户选择 |
| 阻塞点 | 用户实例的机器人在**被其自身会话持续使用**（09:41 仍在完成任务）；同一应用两个长连接会抢事件，因此接管需要用户确认的空闲窗口，或改用扫码新建专用应用 |

### 8.2 B 项（Linux）：已发布 DEB 只支持 x86_64（发现 F-1）

在 arm64 Ubuntu 24.04.5 上安装发布产物：

```
dpkg: error processing archive /home/dsh/dsh-desktop-0.2.1-rc.1.shell.0-amd64.deb (--install):
 package architecture (amd64) does not match system (arm64)
```

`electron-builder.yml` 的 Linux 段只声明 `target: deb`，CI 在 `ubuntu-24.04`（x64）runner 上打包，所以**没有任何 arm64 Linux 产物**：ARM Linux 用户（Raspberry Pi、ARM 服务器、Asahi Linux、Snapdragon 笔记本）无法安装。处置建议（本轮未改产品）：用 `ubuntu-24.04-arm` runner 增加 `--arm64` deb，或在 README/下载页明确“Linux 仅 x86_64”。

因此 Linux 原生视觉的**发布产物**证据由 CI 的 x86_64 Linux runner 提供（见 8.4），本机 arm64 虚拟机用于验证应用本身（同源码本地构建）而非发布包。

### 8.3 B 项（Windows）：Setup 可启动，卡在显示驱动

已完成：

1. 用 UUP dump 官方文件在 Linux guest 内合成 **Windows 11 24H2 arm64 (26100.9711) ISO**：8.2 GB 文件 → `uup-converter-wimlib` → `26100.1_PROFESSIONAL_ARM64_EN-US.ISO`（3.4 GB），`sources/boot.wim` 两个镜像经 `wimlib-imagex info` 校验。
2. QEMU 11.1.2 + HVF、6 vCPU / 8 GB、NVMe 系统盘、USB 光驱、ramfb + virtio-gpu、VNC `127.0.0.1:5902`；Windows Setup 可引导到 “Install driver to display hardware”。
3. 驱动介质：把 UTM guest tools 的 ARM64 驱动树做成 220 MB 带 MBR 分区的 FAT 镜像挂到第二块 NVMe，WinPE 可见 `Local Disk (C:)`（无分区表的 FAT 镜像不会被分配盘符，这是排查出的一个具体坑）。

阻塞点（工具链，不是产品问题）：Setup 要求的显示驱动（`viogpudo`, ARM64）必须绑定到 **virtio-gpu** 设备；但 Homebrew 版 QEMU **没有 `virtio-ramfb`**（UTM 自带 QEMU 才有），只能用 ramfb + virtio-gpu 两个设备拼：`ramfb` 在前时 VNC 可见但驱动加载后渲染切到 virtio-gpu（黑屏），`virtio-gpu` 在前时 Setup 渲染在 ramfb（VNC 黑屏）。UTM.app 自带正确的 QEMU，但其二进制是 framework、需 GUI 驱动，而操作 GUI 需要主机屏幕解锁（本轮多次被锁屏打断）。

### 8.4 补充：让 CI 保留三平台原生视觉证据（已实施）

`release.yml` 此前只上传安装包与 NSIS 计时，packaged `@smoke`（`e2e/desktop-ui-review.spec.ts` 等）在真实 Windows/Linux runner 上写出的截图被丢弃。已新增 `packaged-visuals-<runner>` 工件（`test-results/**/*.png|json|txt`，30 天，失败也上传），提交 `c455d8b`；由于 main 处于用户会话的迭代中（其 rich-card 改动使 verify 红），验证分支 `ci-visual-evidence`（基于绿色 tag `v0.2.1-rc.1.shell.1` + 该提交）触发 run `39092684234` 产出证据。

### 8.5 C 项：第三方 AV

Windows guest 未能进入可安装状态（8.3），因此“真机杀软”暂不可达。可选路径与代价：

- **多引擎扫描（无需真机）**：对已发布 EXE/DMG/DEB 做 VirusTotal 查询/上传。上传会使样本公开可下载，需用户明确同意；也可提供 VT API key 或仅做哈希查询（限已被他人上传过的样本）。
- **Defender 实机（VM 内）**：Windows guest 可用后，`Get-MpThreatDetection`、`Get-MpComputerStatus` 记录实时防护下的安装/首启/卸载拦截。
- **第三方 OEM 杀软**：arm64 Windows 上 360/火绒/腾讯电脑管家 无 ARM64 版本；ESET/Kaspersky 有 ARM64 支持但需授权。因此若要覆盖国内主流杀软，仍需一台 x86_64 Windows 真机或云主机。

### 8.6 A 项回执：隔离 rc.1 实例的真实往返（成功）

2026-10-18 11:24–11:31，按用户授权临时接管其机器人连接（其机器人自 09:41 起空闲），完成后已恢复。

| 步骤 | 证据 |
|---|---|
| 凭据 | 用户真实 profile 的 `applications.json` + `credentials/<uuid>.json` 以 0600 权限原样复制进隔离 userData（未读取 Secret 内容） |
| 关闭用户连接 | 其管理器显示 `桌面服务 已关闭 / 飞书通道 离线`；其 sidecar 进程退出（日志 `supervisor: cc-connect exited`） |
| 隔离实例上线 | rc.1 隔离实例 sidecar pid 77008（`--config /Users/citrus/dsh-review/rc1/.../config.toml`），日志 `11:24:12 connected to wss://msg-frontier.feishu.cn` + `channel state=online` |
| 发送 | 在**电脑版飞书**（Lark.app）的 `dsh` 机器人会话中发送带标记消息 `[E2E-T1] dsh-desktop rc.1 real round-trip test - reply with marker E2E-T1` |
| 回包 | 同一会话收到**富卡片**回复：标题 `回复 citrusli: [E2E-T1]…`、正文 `Done` + `E2E-T1`、页脚 `用时 3.9 秒` / 工作区 `~/dsh-desktop` |
| 落到隔离内核 | 隔离 DSH_HOME 新建会话 `48149902-9007-44ea-8c52-f59e85ead587`（`11:29`，workspace 映射目录 `--Users-citrus-dsh-desktop--`），其 `session_projcache` 中可检索到标记 `E2E-T1`，会话标题即该消息 |
| 恢复 | 重新点击用户管理器的「开启连接」，日志 `11:36:58 connected to wss://…`，管理器回到 `服务已启动 / 在线` |

结论：真实通道（WebSocket 长连接）、真实机器人凭据、真实富卡片回复与真实内核任务全部成立，且落在 **rc.1 打包产物 + 隔离 profile** 上。

### 8.7 发现 F-2（产品缺陷，macOS）：非 legacy 应用的 sidecar 控制套接字路径超长

隔离实例的管理器在整个成功往返期间一直显示 `桌面服务 已关闭 / 飞书通道 离线 / DSH 任务 尚未通过任务验证`，而 sidecar 日志明确是 `channel state=online` 且真实完成了任务。根因在 sidecar 日志里：

```
level=WARN msg="api server unavailable" error="listen unix socket: listen unix
/Users/citrus/dsh-review/rc1/userData/cc-connect/applications/47113a22-…/data/run/api.sock: bind: invalid argument"
```

- macOS 的 `sun_path` 上限是 104 字节（可用 103），而该路径长 **116** 字符；真实 profile 走同一分支时更长：`/Users/citrus/Library/Application Support/dsh-desktop/cc-connect/applications/<uuid>/data/run/api.sock` = **132** 字符。
- 分支来自 `src/main/cc-connect-applications.ts:213`：`legacyDataApplicationId === id ? …/cc-connect/data : …/cc-connect/applications/<id>/data`。用户真实 profile 与隔离副本的 `legacyDataApplicationId` 都是空字符串，所以**默认就落到长路径分支**（旧 alpha.3 的扁平路径 `…/cc-connect/data/run/api.sock` 只有 82 字符，正常）。
- 影响：sidecar 的 Feishu 通道照常工作，但 App 无法通过 API socket 获取健康/任务验证状态，管理器显示为「已关闭/离线/尚未通过任务验证」，用户会误判连接失败；App 对 sidecar 的控制面（重启/停止/健康）同样不可用。
- 建议修复（未在本轮改代码）：把控制套接字放到短路径（如沿用 `…/cc-connect/data/run/api.sock`、或 `$TMPDIR/dsh-<hash>.sock`），或对 `<id>` 取短哈希；并加一条“socket 路径长度 ≤ 100”的断言与真实 macOS 回归。
