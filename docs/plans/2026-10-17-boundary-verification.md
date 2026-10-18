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

`release.yml` 此前只上传安装包与 NSIS 计时，packaged 测试在真实 Windows/Linux runner 上写出的截图被丢弃。已新增
`packaged-visuals-<runner>` 工件（`test-results/**/*.png|json|txt`，30 天，失败也上传），提交 `c455d8b`；
由于 main 处于用户会话的迭代中（其 rich-card 改动使 verify 红），验证分支 `ci-visual-evidence`（基于绿色
tag `v0.2.1-rc.1.shell.1` + 该提交）触发 run `39092684234` 产出证据。

实测工件内容（`39092684234`）：三平台各得 `popover-attempt-0.png`（packaged 应用真实渲染：Windows 1024×728
显示 `Ctrl + Alt + ,` 快捷键、macOS 1280×860 显示 `⌘,`、Linux 1280×833）+ `nsis-benchmark.json`（Windows）。
`e2e/desktop-ui-review.spec.ts` 的 `first-run-safe-mode.png`/`feishu-*-narrow.png`/`settings-feishu.png`
未出现在该工件的 packaged 任务里（这些用例未在该矩阵任务中产出截图），因此该工件目前证明的是
「应用在真实三平台桌面上可启动并渲染」，**不覆盖**安装器向导、托盘菜单、原生文件对话框与输入法。
这两部分仍需物理机/可用 VM（见 8.3）。

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

## 9. B/C 收尾：UTM 上的 Windows 11 ARM64 原生视觉与 Defender（2026-10-18）

### 9.1 虚拟化路径（手工构造 UTM 虚拟机）

UTM 5.0.8 的 `utmctl` 无 `create`，且 UTM 的「打开现有虚拟机」「选择文件」都是 `com.apple.appkit.xpc.openAndSavePanelService` 面板（不暴露 AX、忽略合成点击），因此按 UTM 的 `config.plist` schema 手工构造 bundle 后 `open -a UTM` 导入：

- `DshWindows.utm/config.plist`（ConfigurationVersion 4，Backend QEMU）关键点：`System {Architecture aarch64, Target virt, MemorySize 8192, CPUCount 6, CPUFlagsAdd/Remove []}`、`QEMU {UEFIBoot, Hypervisor, RTCLocalTime, RNGDevice, **PS2Controller false**, AdditionalArguments []}`、`Display [Hardware **virtio-ramfb**]`、`Drive`（NVMe 系统盘 + USB 驱动盘 + USB OEM CD + USB Windows ISO CD）、`Input {UsbBusSupport 3.0, MaximumUsbShare 0}`、`Network`（后移除以保证首启）、`Sharing/Serial/Sound` 全部齐备。
- 两个必须踩到的坑：① **必填键缺失会被 UTM 判为「配置无效」**（`CPUFlagsAdd/CPUFlagsRemove/PS2Controller/MaximumUsbShare/PortForward` 都是 `decode` 而非 `decodeIfPresent`）；② `virtio-ramfb` 不接受 `vgamem_mb`（`VgaRamMib` 必须省略），另外 **`PS2Controller=true` 会让 UTM 不生成 `usb-kbd`**（`virt` 机型没有 PS/2），导致键盘完全无输入。
- 媒体：UUP dump 官方文件合成的 `win11-arm64.iso`（26100.1，3.4 GB）、自建 `autounattend.iso`（LabConfig TPM/SecureBoot/CPU/RAM/Storage 绕过 + 分区 + 本地账号 `dsh`）、UTM guest tools 的 ARM64 驱动盘、以及仅含发布产物的 `installer.iso`（248 MB）。

### 9.2 安装与首启（关键发现：驱动缺失的 virtio 设备会拖死首启）

| 步骤 | 结果 |
|---|---|
| 固件引导 | EDK2 未自动选 CD（bootindex 把不可引导的 USB 盘排在前面），用 Boot Manager 选 `UEFI QEMU QEMU USB HARDDRIVE 1-0000:00:03.0-4.3` 启动 Setup |
| Setup | 自动应答生效：跳过版本/许可/分区，直接 `Installing Windows 11` → `54%` → 重启进 `bootmgfw.efi` |
| 首次失败 | 带 virtio-net 时首启卡在 Windows logo，QEMU 持续 **512–666% CPU** 十多分钟无画面 |
| 定位 | 移除 virtio-net（无 ARM64 收件箱驱动）后 **CPU 降到 1% 并直接进 OOBE** → 卡死由驱动缺失的 virtio 网卡引起，与显示无关 |
| 完成 OOBE | 区域/键盘/第二键盘 → `Getting things ready for you` → 桌面（账号 `dsh`），随后 `virtio-ramfb` 全程正常渲染 |

### 9.3 原生视觉证据（真实 Windows 11 ARM64 + 已发布 NSIS 安装包）

截图保存在 `~/dsh-review/evidence/windows/`：

1. `01-installer-wizard-install-options.png` — dsh-desktop Setup：「Anyone who uses this computer / Only for me (dsh)」，页脚显示 `dsh-desktop 0.2.1-rc.1.shell.0`
2. `02-installer-wizard-location.png` — 安装目录 `C:\Users\dsh\AppData\Local\Programs\dsh-desktop`，占用 894.9 MB
3. `03-installer-wizard-installing.png` / `04-installer-wizard-complete.png` — 安装进度与完成页（「Run dsh-desktop」勾选）
4. `05-app-first-run-msvc-runtime-warning.png` — **发现 F-3**
5. `06-app-main-ui.png` — 应用主界面（Into the Unknown / FIRST RUN 四步 / 工作区选择）
6. `09-windows-desktop.png`、`10-oobe-getting-ready.png` — 桌面与 OOBE 现场

### 9.4 发现 F-3（Windows 首次运行缺 MSVC 运行时，且提示文案按 x64 写）

干净 Windows 11 ARM64 上首次启动应用时弹出「Windows runtime library missing」：缺 `msvcp140.dll`、`vcruntime140.dll`、`vcruntime140_1.dll`，提示「install the official VC++ redistributable **(x64)**」。两点问题：① NSIS 安装包未随包分发/引导安装 VC++ 运行时，干净机器首启即降级（应用自身的 health check 能报出来，这点是好的）；② 在 ARM64 机器上文案仍写 x64，正确目标是 `vc_redist.arm64.exe`。建议：安装包内置并按架构选择 redist，或至少在文案里区分架构。

### 9.5 C 项（第三方 AV）：本轮按用户选择跳过

用户明确选择「本轮跳过 AV 扫描」，故**第三方杀软未覆盖**。已在同一台真实 Windows 11 ARM64 上取到内置 Defender 的证据（同为真实机器上的实时防护场景）：

```
AMServiceEnabled : True          RealTimeProtectionEnabled : True
AntivirusEnabled : True          AntispywareEnabled        : True
BehaviorMonitorEnabled : True    AMEngineVersion           : 1.1.23110.2
AntivirusSignatureVersion : 1.403.7.0   AntivirusSignatureLastUpdated : 12/6/2023
Get-MpThreatDetection / Get-MpThreat → 无输出（零检出）
DisableRealtimeMonitoring : False        ExclusionPath/Extension : 需管理员查看
```

说明：`已发布 EXE` 在实时防护开启的 Windows 11 ARM64（离线、签名为 2023-12 基线）上完成挂载→安装→首启，Defender **零检出、零拦截**；由于无网络，签名未更新，且第三方 OEM 杀软（360/火绒/腾讯电脑管家无 ARM64 版本）仍需 x86_64 真机或用户提供 VirusTotal API key。

### 9.6 Linux 侧结论（不变）

发布产物曾只有 amd64（F-1）；该缺口已在 §10 关闭：新增 arm64 打包 job，产物在 arm64 Ubuntu 24.04.5 上安装并运行，附原生桌面截图。

## 10. F-1 收口：Linux arm64 产物与原生视觉（2026-10-18）

### 10.1 打包 job

`release.yml` 增加 `ubuntu-24.04-arm`（GitHub 官方 ARM64 runner）matrix 项：`--linux deb --arm64`，上传
`dist/*.deb` + `.sha256`；所有 Linux 步骤的判定从 `matrix.os == 'ubuntu-24.04'` 改为
`startsWith(matrix.os, 'ubuntu-24.04')`（13 处）与 `${{ !startsWith(...) }}`（8 处，避免 arm runner 同时跑需要真实显示器的 GUI smoke）。
产物契约（`scripts/release-shape.mjs`）改为按架构命名：`installerNames(version, 'linux', arch)`，
`expectedAssetNames` 从 8 个资产变为 10 个（两个 deb 各带 `.sha256`）；App 侧的修复链接
（`src/main/closure-manifest.ts`）也跟随运行架构，arm64 用户不会被指向 amd64 包。站点资产数守卫放宽到 2/4/6/8，
中英文下载页/安装页/FAQ 改为「Linux x64 / arm64」，ADR 0017 增加 Amendment。

### 10.2 CI 在 arm64 上暴露并修掉的四处 x64 假设（5 次 dispatch）

| # | 失败步骤 | 根因 | 修复 |
|---|---|---|---|
| 1 | Cross-version upgrade (Linux) | 上一个 release 只有 amd64 deb，arm runner 装不上 | `installerRunsHere()` 按架构选包；该架构无上一版时打印跳过并成功退出 |
| 2 | 同上 | 跳过分支用了模块顶层 `return`（ESM 语法错误） | 抽出 `runDpkgUpgrade()` 函数 |
| 3 | Smoke packaged app | electron-builder 在 arm 上产出 `linux-arm64-unpacked/`，定位器只认 `linux-unpacked/` | 定位器接受可选架构段；补 arm64 目录布局用例 |
| 4 | Smoke packaged app（GUI 变体） | 反向守卫 `matrix.os != 'ubuntu-24.04'` 对 arm runner 为真，导致无显示器的 GUI smoke 也执行（`The platform failed to initialize`） | 8 处反向守卫改为 `!startsWith(...)` |

### 10.3 产物与在机验证（arm64 Ubuntu 24.04.5）

- 构建：run `39121607083`，job `build (ubuntu-24.04-arm, --linux deb --arm64)` **success**，工件
  `dsh-desktop-ubuntu-24.04-arm`（212.6 MB）。
- 产物：`dsh-desktop-0.2.1-rc.1.shell.1-arm64.deb`，本机 SHA-256
  `61b8feffa6a6ca6b33fddbb24ef03e192a5dd3689a0e8220875e42aaa5d1d769`，在 guest 内 `sha256sum -c` → **OK**；
  `dpkg-deb -I` → `Architecture: arm64`、`Installed-Size: 900619`。
- 安装：`sudo apt-get install -y ./dsh-desktop-…-arm64.deb` 成功（此前 amd64 包在同一 guest 上被
  `package architecture (amd64) does not match system (arm64)` 拒绝）。`dpkg -l` → `ii dsh-desktop
  0.2.1~rc.1.shell.1 arm64 DeepSeek Harness desktop shell`。
- 原生视觉：`/usr/bin/dsh-desktop` 在 GNOME 会话内启动，窗口标题 `dsh-desktop — DeepSeek Harness (Community)`；
  截图 `~/dsh-review/evidence/linux/desktop-with-app.png` 显示完整首启界面（New Session / Plugins / Automation
  tasks / Default workspace，Into the Unknown，FIRST RUN 四步中 1 Runtime ready ✅、2 Choose a workspace ✅）。
- 观察（非阻塞）：`app.log` 内有若干 `gtk_widget_add_accelerator: assertion 'GTK_IS_ACCEL_GROUP'` 警告，来自
  Electron/Gtk 在 Ubuntu 24.04 上的常见告警，应用照常可用。

F-1（发布产物只有 amd64）到此关闭：arm64 Linux 现在有可安装、可运行的发布产物，并有真实桌面的原生视觉证据。
