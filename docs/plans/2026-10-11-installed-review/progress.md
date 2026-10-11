# 正式安装验收进度

日期：2026-10-11。当前状态：INS-01 安装/完整性已通过，REAL-01 因 Mac 锁屏暂停；
尚未取得本轮真实界面、视觉或录屏证据，不能声称所有功能已通过。

## INS-01 — 正式 DMG 覆盖安装

允许范围：已授权的正式应用 bundle、可恢复旧 bundle、这两份验收文档；没有产品改动。
文档提交 SHA 待提交后补记。

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

## REAL-01 — 当前真实外部阻塞

CUA 用 bundle ID 选应用时发现多个既存安装副本，改用明确路径
`/Applications/dsh-desktop.app`，没有误测旧 dist。当前系统返回：
“The Mac is locked and automatic unlock could not unlock it.”

需要用户手动解锁 Mac；已异步提出解锁请求。在锁屏解除之前不换工具读取同一受保护
界面、不绕过认证、不声称截图/录屏完成。继续仅执行公共代码/安装产物安全检查。
真实飞书发送已单独请求本轮确认，只限此前本人机器人，不发送其他联系人/群聊。

尚无本轮已证实产品缺陷，不虚构修复项或提前创建新 Release/tag。下一任务：
解锁后执行 REAL-01，保存并复核截图/录屏、逐项记录矩阵；发现问题后进入 BUG-nn。

## 安装后安全基线门禁

- `pnpm run verify`：397 单测 + 1 ACP，0 failed/skipped，覆盖率
  89.99/82.93/86.41%，类型/运行边界/站点/构建通过，退出 0；日志
  `/tmp/dsh-installed-shell1-baseline-verify.log`。这是源码/隔离 ACP 基线，不是正式应用真实 UI 验收。
- 计划文档的 3 个本地链接目标与结尾换行检查：退出 0。
- `git diff --check`：退出 0。没有产品、依赖、真实凭据或子模块变更。
