# 0041：默认卡片升级为 Card 2.0 富卡片与结构化进度卡片

- 日期：2026-10-18
- 状态：已接受
- English: [0041](0041-rich-card-defaults.md)

ADR 0036 把「缺字段时」的卡片与进度默认值定为经典卡片（`legacy`）与逐条进度（`legacy`），
当时的理由是不要在偏好面板刚落地时同时引入渲染兼容性变更。此后 Sidecar 已实现两种更丰富的模式，
且 2026-10-17 在维护者本机做了一次受控的用户层验证：手改 `applications.json` / `config.toml` 后，
磁盘上的 `config.toml` 与 `renderConnectToml({ cardMode: 'rich', progressStyle: 'card' })` 逐字节一致，
cc-connect 自身的 loader 也接受 `card_mode: legacy|rich` 与 `progress_style: legacy|compact|card`。

因此新连接、以及缺少这些字段的旧 `settings.json`，现在解析为 `cardMode: 'rich'`（飞书 Card 2.0
流式富卡片）与 `progressStyle: 'card'`（结构化进度卡片），与 zcode 飞书机器人的
`replyMode="streaming_card"` 对齐。改动集中在唯一的 `CONNECT_DISPLAY_DEFAULTS` 常量与两处界面回落值，
`normalizeConnectSettings`、`renderConnectToml`、飞书管理窗口与插件设置表单都自动跟随，不新增分支。

**用户显式保存过的 `legacy` 偏好原样保留**：`normalizeConnectSettings` 的枚举校验仍然先于回落值执行，
选了经典卡片的用户不会被改写，读取也不会重写设置文件。Secret 存储、Safe Mode、启停与重启预算、
渲染 TOML 的字段顺序、唯一的全局 `[stream_preview]`、`[projects.display]` 归属以及
`${DSH_CC_CONNECT_FEISHU_SECRET}` 占位符写法均不变。

后果：使用默认值的用户会得到 Card 2.0 富卡片与结构化进度卡片——更少的独立消息、更丰富的渲染，
这对新连接是可见的行为变更。0036 的「精简详细度 + 3000ms 预览」仍然生效，因此本决策是收窄而非推翻 0036。
回滚只需改回一个常量，或由用户显式选择 `legacy`。备选方案：等到大版本再改默认（否决：Sidecar 早已支持
两种枚举，维护者本机连接与 zcode 机器人已在用富卡片，0036 当初推迟的兼容风险已经消除）；
只对新应用用新默认、旧文件保持经典（否决：同一个「缺字段」出现两种含义，正是 0036 消除的歧义）；
对所有用户强制 `rich`（否决：会覆盖用户已保存的选择）。

验证：单测断言回落值、显式选择的保留与渲染出的枚举值；真实 cc-connect loader 测试用 Go loader
重新解析全部 18 种 detail/card/progress 组合加默认 TOML；打包 E2E 断言默认状态与磁盘上的 TOML。
这些门禁不发送任何真实飞书消息；视觉与消息条数结论仍需受控飞书验证。
