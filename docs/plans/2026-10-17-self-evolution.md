# 2026-10-17 自主版本进化

目标：交付一个完成代码、回归、三平台发布、国内镜像和官网同步的新版本，
至少包含一个实际可操作的桌面扩展功能，不以版本号或文档更新代替功能进化。
起点 `aae9c6d503f4a6929f703e0d95ff352cf4dab769`，先快进合并统计 bot `a3e09bc`。
当前已发布 `0.2.1-alpha.3.shell.0` 的 tag 保持不可变。

## 选择依据与边界

- 官方 npm 与 [Harness Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.5)
  已确认 alpha.5。上游包含技能列表同步、终端重复查询和 Windows/Linux 输入框 Page Up 布局修复。
- #113 的 run `38860789986` 首次失败为 `ERR_PNPM_UNUSED_PATCH`：账户补丁仍绑定 alpha.3，
  不能将其误判为依赖年龄限制或通过禁用补丁门禁处理。
- 验收期间上游于 2026-10-17T03:02Z 发布 `0.2.1-rc.1`；本迭代仍固定已审查的 alpha.5，
  不临时切换内核，并把闭包部署改为锁文件冻结，避免新预发布造成自动漂移。
- 用户补充要求至少一个扩展功能：新增桌面工具浮窗的飞书状态与快捷开关。
  复用已有主进程权限和连接生命周期；打开菜单不启动连接，实际操作才发送命令。
- 采用实现 → 验证 → 修正；每项单独提交，精确暂存、推双远端并回填证据。
  不升级无关依赖，不覆盖 Applications 或真实 profile，不读取/记录真实 Secret，不请求钥匙串。
  所有本地 UI/E2E 使用临时 profile、假 Secret/Sidecar、模拟 ACP。

## 有序原子任务

| ID | 目标与允许修改 | 门禁 | 状态 |
|---|---|---|---|
| EV-01 | 自动升级补丁版本迁移：scripts/version.mjs、专用 kernel-patches helper、相应单测、发布技能、本文 | 临时目录中的迁移/幂等/冲突/无关补丁保护；补丁内容不变，应用失败仍阻断；verify | 完成：b8354839b95142c8ff726b692f46759b85f1a4d6，双远端集成分支已推送 |
| EV-02 | Harness alpha.5：package.json、manifest/harness 清单/锁/工作区/账户补丁、必要的内核兼容脚本/测试、版本说明 | 官方发布核对、冻结安装、bootstrap/peer 审计、原登录/垃圾桶/ACP 断言及 verify/audit | 完成：48d07bb3a42460066306842d0e2b1155eef21428，双远端集成分支已推送 |
| EV-02A | 新上游预发布暴露的部署漂移：scripts/deploy-harness.mjs、CI bootstrap 顺序回归、本文 | 非 legacy deploy 使用共享锁文件；冻结安装后闭包仍为 alpha.5 且无 rc.1；peer 审计与构建通过 | 完成：9e057c748438175a8fedadfb0d7d9f82633fe2f1 |
| EV-03 | 飞书快捷控制：plugins/dsh-desktop-controls/lib/client.js、cc-connect-types/controller 的只读当前应用名及测试、必要的纯 UI helper/测试、e2e 桌面控件用例（含 trash-harness 假 Sidecar 支持）、cc-connect 指南与中英 README | 当前应用/进程与通道状态分开显示；显式启停/失败恢复；无配置/旧凭据/Safe Mode；中英亮暗、边缘窄窗口与键盘；零隐式启连/零模型调用 | 完成：b442d88227761f454183cbfcfd15790ab18f6c07 |
| EV-04 | 完整回归与发布：构建生成 manifest、release notes、官网介绍/日志、HANDOFF、本文及文档索引 | 新 dist 后双 smoke、packaged 全集、飞书五轮、市场 offline/real、LAN；三平台 CI、严格八文件与来源证明、六镜像内容及一包全量回读、官网八组和双远端干净 | 完成：4e580551aa9c2589199901857c0ea4424afc8670 |

## 验收与回执

EV-01：`node --test test/kernel-patches.test.ts` 四项通过 exit0，包含真实 version CLI 的临时目录迁移；
`pnpm verify` exit0（433单测 + ACP1，零跳过），日志为临时目录中的 dsh-evolve-ev01-verify.log。
保留补丁 bytes、无关 YAML 注释与策略，已有候选文件/自定义或重复映射均拒绝且保持原文件；幂等用例通过。
本项不改运行时或当前版本，不以四项单测代替后续真实 pnpm 补丁应用与新包门禁。
EV-02：官方 npm registry 与 GitHub Release `dsh-v0.2.1-alpha.5`（2026-10-16T12:23:28Z，prerelease）
核对一致；32 个内核同族直接依赖同步，锁文件无 alpha.3 残留。
`pnpm -C manifest/harness install --frozen-lockfile` 首次被 `MINIMUM_RELEASE_AGE_VIOLATION` 拒绝 75 项；
未放宽策略或跳过门禁，核对官方发布后按真实闭包补齐豁免，并修复 `resolvedVersionsFromLockfile`
把 peer 后缀当成包名的问题；新增纯函数回归（`/tmp` 外不保存），修正后冻结安装 exit0，
豁免脚本二次运行 0 新增且文件哈希不变。
`pnpm run bootstrap` exit0：闭包 peer 审计 `closure satisfied`、Node 24.21.0 重新落位、
native 无需重建（`/tmp/dsh-ev02-bootstrap.log`）。账户补丁按精确版本迁移到 alpha.5
（`git apply --check` exit0，真实冻结闭包中已生效）；alpha.3→alpha.5 的
`dsh-api-session-controller`、`dsh-client-ui-workspace` 两 bundle 逐字节一致，垃圾桶补丁版本保护更新为 alpha.5。
登录、垃圾桶、ACP 与补丁迁移共 17 项单测 exit0（`/tmp/dsh-ev02-kernel-tests.log`）。
`pnpm verify` 首次因当前 PATH 缺 Go 在 cc-connect 配置用例退出 1，补 Go 路径后原测试/断言不变，
最终 exit0（435 单测 + ACP1，零跳过，覆盖率 89.81/82.75/86.83，`/tmp/dsh-ev02-verify2.log`）；
`pnpm security:audit` exit0（保留既有单一 CVE 例外，未新增忽略，`/tmp/dsh-ev02-audit.log`）。
候选发布说明 `docs/release-notes/v0.2.1-alpha.5.shell.0.md` 通过 `write-release-notes check`。
本项未运行真实飞书、打包安装或发布，留给 EV-03/EV-04。
EV-02A：alpha.5 验收后上游于 2026-10-17T03:02Z 发布 0.2.1-rc.1；11:14 的常规重部署暴露出
`pnpm deploy --legacy` 会忽略锁文件重解析范围，请求 rc.1 并在缺失 companion
`dsh-session-format-v0-to-v1@0.2.1-rc.1` 时失败。未回退内核或放宽锁定，改为共享锁文件 deploy
（`inject-workspace-packages=true`、不覆盖 auto-install-peers）；重建 exit0，299 个 dsh 包均为
alpha.5、无 rc.1 漂移，peer 审计通过（`/tmp/dsh-ev03-deploy2.log`）。静态回归禁止 `--legacy`
与 auto-install-peers 覆盖。
EV-03：浮窗「连接」分组新增只读四行（当前应用/桌面进程/飞书通道/DSH 任务）与显式开启、关闭、
重连；控制器快照新增只读 `applicationName`。`connectFeishuQuickView` 纯函数覆盖空配置、
已保存未启动、就绪、崩溃/重试、旧凭据、显式关闭与 Safe Mode；`enabled` 仅表示持久意图，
不阻止手动开始。`node --test test/desktop-controls.test.ts test/cc-connect-controller.test.ts`
exit0；`e2e/feishu-quick-controls.spec.ts` 两项 exit0（键盘 Enter 启动、进程 ready/通道 online/
DSH unavailable 分开、崩溃恢复、Safe Mode 只读、0 次隐式 sidecar 启动、0 次模型请求，
`/tmp/dsh-ev03-e2e-quick4.log`）；`desktop-ui-review` zh/en × light/dark 四组 exit0（空配置与
保存未启动两态、窄窗/边缘拖拽/Escape 焦点，`/tmp/dsh-ev03-e2e-ui-review2.log`）；完整 verify
438 单测 + ACP1 零跳过 exit0（`/tmp/dsh-ev03-verify2.log`），audit exit0（`/tmp/dsh-ev03-audit.log`）。
首轮完整 verify 另暴露 process-lifecycle 150ms 启动竞态 1 次，edd962cb91e4e831fc73c5e134770a978f8a0730
改为子进程 ready 信号，原断言语义不变，随后 5 次单测与完整 verify 均通过。
EV-04（本地）：新 dist `dist/mac-arm64/dsh-desktop.app` 版本 `0.2.1-alpha.5.shell.0`，sidecar commit `a9a936c`、
manifest SHA-256 `6773f639058af4f077b0b0ffc441b2af5f259ae600022f6709af2eda7caf0428` 与包内一致。
两项 smoke、packaged 24/24（3.1m）、飞书 5×5=25（4.2m，retries=0）、市场 offline1/real2、
打包 LAN 1、`codesign --verify --deep --strict` 均 exit0（`/tmp/dsh-ev04-*.log`）。
EV-04（发布）：tag `v0.2.1-alpha.5.shell.0` → `4e580551aa9c2589199901857c0ea4424afc8670`，
GitHub/GitCode 两远端 peeled commit 一致；Release `38999365802` success（verify + 三平台 build + publish），
main CI `38999352115` success。GitHub 预览版 2026-10-17T04:14:34Z 公开、8 资产、draft=false/prerelease=true；
严格八文件校验 exit0，三安装包 `gh attestation verify` 均绑定本 tag。
GitCode release `58738` tag 对齐、六资产匿名内容 6/6、mirror-v2 --check-only 6/6，
DEB 完整回读 228656552 字节且 SHA `5022949e107cc1dc4c1c5db7a6eacb370216db115e1b9010b8b7f0e95f5b04fe` 一致。
Site Data Refresh `39001837976` success，bot `cb8acb1` 合并；线上 JSON 同 tag、6/6 `gitcode_ok=true`，
`/api/downloads` 实时可用（7133，含既有引导计数）；首页 alpha.5 文案后本地八组 exit0，推送后 Vercel 上线且线上八组 exit0。
真实手机飞书往返、Windows/Linux 人工原生视觉、第三方 AV 真机与签名边界保留，不以模拟环境代替。
后续同样回填提交 SHA、命令和退出码。
`0.2.1-alpha.5.shell.0` 已发布，官网与镜像已切换到该 tag；已发布 tag 保持不可变。
未覆盖的真实飞书、物理异机网络、Windows/Linux 人工原生控件及第三方防病毒测试须明确列出，
不能以模拟环境或 runner 推断这些场景已完成。既有签名/审计例外不暗中改变。
