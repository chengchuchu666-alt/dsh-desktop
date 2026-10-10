# cc-connect × DSH Desktop 使用指南

本页说明如何在 dsh-desktop 中启用内置的 cc-connect 飞书连接。cc-connect
作为由 Electron 主进程监管的 Sidecar 运行，通过 DSH 官方 ACP stdio 协议
启动 `dsh --profile acp`；它不复制 Harness 的会话模型，也不读取 Web 页面内部
接口。飞书使用 WebSocket 长连接，因此本机不需要公网 IP、域名或反向代理。

## 开始前

- 使用包含 cc-connect 的 dsh-desktop 安装包，并准备一个已经存在的绝对路径工作区。
- 准备一个有权限发布应用版本的飞书或 Lark 开放平台账号。
- App Secret 只在设置页输入；不要把它写入仓库、截图、Issue 或日志。

## 飞书开放平台配置

1. 打开[飞书开放平台](https://open.feishu.cn/)，创建企业自建应用。
2. 在「应用能力」中启用「机器人」能力。
3. 在「凭据与基础信息」中记下 App ID 和 App Secret。
4. 在「权限管理」中按组织审批要求申请消息读取和发送权限。通常至少需要：
   `im:message:send_as_bot`、单聊消息读取权限，以及群聊中接收机器人消息的权限
   （控制台名称可能随飞书/Lark 版本变化）。需要读取未 @ 机器人的群消息时，另外申请
   `im:message.group_msg`；Desktop 的固定配置默认不会启用这项历史共享功能。
5. 在「事件与回调」中选择「使用长连接接收事件」，添加事件
   `im.message.receive_v1`。
6. 如果要使用交互卡片上的权限确认等按钮，再添加回调
   `card.action.trigger`。没有该回调时，普通文本消息仍可连接，但卡片按钮不能完成回调。
7. 创建并发布应用版本，确认应用的可用范围包含要使用机器人聊天的账号或群组。
   然后把机器人加入目标单聊或群聊。

飞书控制台的权限名称和菜单可能会调整；以当前控制台显示的应用权限、事件和发布状态
为准。cc-connect 的更详细平台说明见子模块的 `docs/feishu.md`。

## 在 Desktop 中启动和停止

### 一键配置：扩展菜单二维码

如果还没有 cc-connect 机器人，打开原生菜单「扩展 / Desktop tools → 配置飞书机器人…」：

1. 选择一个已经存在的绝对路径工作区。
2. Desktop 会在独立的临时目录启动捆绑的 cc-connect，并显示一次性飞书二维码。
3. 用飞书 App 扫码，按手机上的提示完成应用授权；回到 Desktop 后等待“配置完成”。
4. Desktop 会把 App ID、工作区和受保护的 App Secret 保存到本机，并自动尝试启动连接。

二维码配置流程不会把 App Secret 显示在窗口、状态、错误或日志中；临时配置在流程结束、取消或超时后会被清理。
如果手机提示应用成功但 Desktop 没有完成，请重新从菜单生成一个新的二维码，不要重复使用旧码。

### 设置页配置和生命周期

打开「设置 → 桌面设置 → 飞书消息连接」：

1. 打开「启用连接」。
2. 填写 App ID。
3. 填写 App Secret。
4. 点击「选择」，选一个存在的绝对路径工作区。
5. 点击「保存连接」，再点击「启动」。状态变为「已连接」后即可从飞书发起 DSH 任务。

Secret 输入框是一次性写入框：保存成功后会自动清空；之后保存时留空表示保留已经保存的
Secret，不会把它清掉。界面只显示“Secret 已保存”及存储保护类型，不会读回 Secret。

#### 消息降噪 / 卡片样式

以下选项已在本轮源码实现，随下一 shell 版本交付；旧安装包尚无这些控件。
工作区之后可以选择：

| 选项 | 可选值 | 默认 |
|---|---|---|
| 消息详细度 | 完整（full）/ 精简（compact）/ 静默（quiet） | 精简 |
| 流式预览 | 开启或关闭 | 开启 |
| 刷新间隔 | 1.5s / 3s / 5s；已有合法非预设值会原样回显 | 3s（3000ms） |
| 卡片样式 | 经典（legacy）/ 富卡片（rich，Card 2.0） | 经典 |
| 进度展示 | 逐条（legacy）/ 单消息更新（compact）/ 结构化卡片（card） | 逐条 |

精简和静默不逐条发送思考/工具消息；静默将文本追加到同一卡片，仍保留最终答复、必要错误
与权限交互。进度展示和卡片样式是独立偏好，不承诺所有状态行或卡片按钮都会消失。
关闭流式预览不会关闭最终答复；间隔控件此时禁用，但保留已选值。

没有新字段的旧 `settings.json` 无需手改：读取时自动采用 compact、开启预览、3000ms、
legacy 卡片与 legacy 进度。合法整数间隔钳制到 500–30000ms；不接受自由文本 TOML。
配置生成一次全局 `[stream_preview]`、项目的 `[projects.display]`，固定预览增量为 80 字符。
显式保存过的偏好在旧调用/二维码参数省略这些字段时仍保留。

点击「保存连接」后，已运行的启用连接会重新生成 TOML 并重启；未运行、已禁用或 Safe Mode
下保存不会隐式启动。轮询只更新状态，不覆盖未保存编辑；重开设置页会回显已保存值。
行为取舍见 [ADR 0036](decisions/0036-bounded-message-preferences.zh.md)。

通过二维码或设置页保存连接后，「停止」只停止当前 Sidecar，不会关闭“启用连接”开关；应用下次启动且配置仍启用时，
Harness 就绪后会再次启动它。「重连」会重新生成当前配置并重启 Sidecar。未配置完整、
Harness 尚未就绪或应用处于 Safe Mode 时，Sidecar 不会启动。

## Safe Mode 行为

进入 Safe Mode 前，Desktop 会先停止 cc-connect，避免恢复期间仍有飞书消息进入任务。
退出 Safe Mode 并且 Harness 恢复就绪后，若连接配置仍启用，Desktop 会自动重启 cc-connect。
Safe Mode 不会删除 Secret、工作区或会话数据。

## 数据、凭证和日志位置

`<userData>` 是 Electron 的应用数据目录，常见位置如下；实际路径以系统和安装方式为准：

- macOS：`~/Library/Application Support/dsh-desktop`
- Linux：`~/.config/dsh-desktop`
- Windows：`%APPDATA%\\dsh-desktop`

连接相关文件位于 `<userData>/cc-connect/`：

- `settings.json`：启用开关、App ID、工作区与受控消息显示偏好，不含 Secret。
- `config.toml`：Sidecar 使用的固定配置，不含 Secret，只包含
  `${DSH_CC_CONNECT_FEISHU_SECRET}` 占位符。
- `credentials.json`：Secret 的应用私有存储。优先使用 Electron `safeStorage`；不可用
  时使用权限为 `0600` 的本机文件回退。两种情况下应用都不会把 Secret 写入 TOML。
- `data/`：cc-connect 的本地运行数据。

`<userData>/logs/cc-connect.log` 是 Sidecar 的滚动日志，文件权限为 `0600`。Desktop
默认还会把 DSH_HOME 放在 `~/.dsh-desktop`；只有显式设置 `DSH_HOME` 时才会改用指定目录，
例如设置为 `~/.dsh` 就会与命令行共用 Harness 数据。cc-connect 和 Web Harness 是独立进程，
但默认使用同一个 Desktop DSH_HOME。

查看日志时可在「桌面工具 → 打开日志」打开日志目录，或直接查看上述 `cc-connect.log`。
状态卡片中的「最近错误」和日志中的凭证、Token 会做脱敏；分享诊断时仍应先检查工作区路径、
App ID 和会话标识，不要粘贴任何 Secret。

## 彻底禁用和删除凭证

1. 在「飞书消息连接」关闭「启用连接」，点击「保存连接」。如状态仍在运行，再点击「停止」。
2. 完全退出 dsh-desktop，包括系统托盘中的进程。
3. 只删除 `<userData>/cc-connect/credentials.json`。这会删除应用保存的 Secret；无论文件
   使用 `safeStorage` 还是受限文件回退，删除后应用都无法再读取它。操作系统维护的
   `safeStorage` 服务密钥不需要、也不应手工删除。
4. 如果还要清除连接配置和 Sidecar 运行数据，可在退出应用后删除同目录下的
   `settings.json`、`config.toml` 和 `data/`。不要为了删除飞书凭证而删除整个
   `<userData>` 或 `~/.dsh-desktop`，否则会同时移除 Desktop 的其他设置、会话和插件数据。

当前设置页提供启用、停止和重连，但没有“删除凭证”按钮；因此删除
`credentials.json` 是本版本的明确人工清理步骤。

## 已知限制

- 首版只生成一个固定的 `dsh-desktop` 项目和一个 Feishu/Lark 平台，使用一个默认工作区；
  支持受控的消息降噪 / 卡片样式选项，不提供多项目/多平台、按聊天切换工作区或交互式模型选择。
- 首版只使用飞书长连接，不启用 cc-connect 的 bridge、management API 或 webhook 监听。
- 卡片按钮依赖飞书回调订阅和已发布权限；权限审批、可用范围和版本发布由飞书后台控制。
- 自动化测试使用假 Sidecar、临时目录和本地 ACP/HTTP mock，不代表真实飞书账号验收。首次
  实际连接仍需要用户自己的 App ID、App Secret 和组织审批。
- Sidecar 在 Harness 就绪后才启动，并有有限的崩溃重启预算；持续失败时请查看状态卡片和
  脱敏日志，修复配置后再点击「重连」。
