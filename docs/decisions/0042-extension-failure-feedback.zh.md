# 0042: 每个扩展动作都在触发处暴露失败

- 日期：2026-10-21
- 状态：已接受
- English: [0042](0042-extension-failure-feedback.md)

对桌面壳扩展入口的审计（#124-#127）发现同一个缺陷的四种表现：失败没有用户可感知的出口。飞书管理
窗口把校验错误写进唯一的页面底部 `#message`，离被点击的按钮很远；桌面工具面板的 `invoke()` 只认
`=== true`，`false` 与 rejected promise 都被静默忽略；原生工作区选择器把「取消」和「目录不可用」
压成同一个 `null`；托盘/菜单回调签名是 `void`，`shell.openExternal` 拒绝、局域网/重启失败都只留在
控制台。

现在每个扩展界面各自持有一个可见的失败通道，且渲染在动作附近：

- 桌面工具面板保留一条 `role="alert"` 状态行（`data-dsh-controls-error`），由归一化后的
  `invoke()`/`openConnectManager()` 驱动：非 `true` 结果与异常都会显示。
- 飞书管理窗口在字段旁提示空工作区（`#workspace-error`、`aria-invalid`、焦点移入输入框），并在
  调用 IPC 之前就拒绝；设置页在工作区行下方镜像同一条错误。
- 原生工作区选择器返回可判别结果 `WorkspacePickResult`
  （`{canceled:true}` / `{canceled:false, workspace}` / `{canceled:false, reason:'invalid-workspace'}`）：
  取消保持静默，目录不可用可以被解释。
- 菜单与托盘动作统一经过 `guardShellAction`：抛出与显式 `false` 都会转成系统通知（不可用时退回错误
  对话框）并写一条结构化 `console.warn`。

被否决的方案：一次性把 `desktopAction` 改成全局 `{ok, reason}` 对象（preload、IPC、打包 E2E 波及面
大，且没有额外用户可见收益；改为在面板调用处归一化）；保留 `boolean` 却不处理 `false`（那正是缺陷）；
引入完整 toast 框架（每个界面一条状态行已足够且更易测试）。

影响：点击扩展动作不再可能「什么都没发生」。代价是菜单/托盘失败依赖系统通知，属于尽力而为——通知
中心被禁用时，日志仍是持久记录。测试覆盖面板状态节点与异常分支、管理窗口字段错误与 IPC 前拦截、
preload 与主进程两侧的选择器契约，以及 `guardShellAction` 的接线。系统通知的视觉效果与真实飞书渲染
仍属人工验收项。
