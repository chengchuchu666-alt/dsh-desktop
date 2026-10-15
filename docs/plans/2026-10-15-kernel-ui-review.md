# Harness 内核升级与自定义桌面 UI 审查

## 范围与交付边界

用户授权升级内核、审查全部壳自定义扩展 UI，并补齐设置主列表及桌面工具浮窗中的飞书入口。
采用实现 → 验证 → 修正 → 再验证；不发布新 tag/Release，不改已发布 shell.4，不覆盖已安装应用。
维护当前集成分支；保留上游网站机器人提交，不重写既有任务 SHA。
测试仅用临时 profile、假 Secret/Sidecar、模拟 ACP；不读取真实凭据、不发真实消息，
不启动用户正式 profile 的 LAN。既有 LAN E2E 只临时共享隔离测试页面，结束关闭并清理。

## 有序原子任务

| ID | 目标 / 允许修改 | 门禁 | 状态 |
|---|---|---|---|
| KUI-01 | Harness 升至官方已发布 alpha.3；package.json、manifest/harness 的清单/锁/工作区/兼容补丁、scripts/patch-session-trash.mjs 等内核闭包适配、对应单测与版本说明 | 官方 registry 检查；冻结安装；bootstrap/peer 审计；verify；ACP 凭据策略核验 | 完成：8e89ab302e096e1cdc243ff4b87dbfda98f6931f，两远端已推送 |
| KUI-02 | 盘点、补齐并修正自定义入口/排版；plugins/dsh-desktop-controls、src/main 的自定义页面与其原生窗口、相应单测/E2E、用户文档 | 真实新内核界面；设置主列表、浮窗、原生菜单进入同一飞书管理器；状态/安全边界；中英文、亮暗、窄宽窗口与键盘/溢出检查 | 完成：5ba5a8f298b35b6e275b29e9baa66a12de7da74f，两远端已推送 |
| KUI-02A | 打包门禁暴露的官方桌面桥命名碰撞：仅调整alpha.3 account补丁、manifest锁与对应测试/任务记录；若CI还暴露闭包检查问题，同样限于内核适配检查 | 保留登录E2E原断言；能力识别单测；冻结安装/bootstrap/verify；新包登录检查 | 完成，本次提交；KUI-03恢复 |
| KUI-03 | 新版打包与完整回归、记录视觉证据；E2E/文档/本文件与 HANDOFF/架构版本头，构建产生的 sidecar manifest | verify/audit；顺序完成 dist 后两项 smoke、packaged 全集及关键飞书五轮、市场 offline/real、LAN 临时模拟；干净工作区及分支推送 | 新dist已生成，门禁执行中 |

每项完成后单独提交，精确暂存，回填 SHA、命令/退出码、未覆盖项与下一任务。
只推送集成分支，不将未发布候选写成官网已发布版本。

## 自定义界面检查清单

- 主界面扩展：可拖动桌面工具、首次成功引导、安全模式提示。
- 设置扩展：桌面设置（运行体检、桌面偏好、连接服务、恢复与高级工具）、垃圾桶、飞书独立入口。
- 独立窗口：飞书应用管理（空态/创建/二维码/应用列表/显示偏好/旧凭据提示/错误态）、手机平板 LAN 配对。
- 壳页面：启动/恢复/更新提示/关于；预设导入导出、插件手动安装与垃圾桶确认交互。
- 不改官方聊天产品布局；复用 Harness 的字体、语义颜色与已有蓝色强调，信息分组只表达真实任务。
- 确认窗口关闭与连接关闭的区别；入口只导航，不隐式启动连接；窄窗口不裁掉主要按钮和错误说明。

## 进度与证据

- 起点：父仓库 `1162e55`，合并网站机器人 `4e60738`；cc-connect pin `a9a936c` 保持不变。
- 官方 registry 的版本检测 exit3（发现 alpha.3，不是测试失败）；同时核对官方 GitHub 已发布预览版。
- KUI-01：候选版本 `0.2.1-alpha.3.shell.0`，最终锁定/冻结安装、bootstrap 与 peer 审计均exit0。
  `pnpm verify` exit0（428单测 + ACP1）；`pnpm security:audit` exit0（保留已有单一例外，不新增忽略）；
  `node --test test/kernel-account-patch.test.ts test/session-trash-patch.test.ts` exit0（12项）；
  发布说明check/diff check均exit0。新内核尚未执行真实界面、打包/安装、真人飞书往返；这些不冒充已覆盖。
  垃圾桶红色反馈为0.13秒稳定锚点不匹配，适配claim/claims后所有原断言保留并增加pending claim/resume保护。
- KUI-02：`pnpm verify` exit0（428单测 + ACP1），`pnpm test:e2e` exit0（35通过/9既有条件未启用，未新增跳过）；
  六组真实内核 UI `pnpm exec playwright test e2e/desktop-ui-review.spec.ts --output=/tmp/dsh-kui02-visual-evidence` exit0；
  三项真实会话生命周期聚焦回归 exit0；`git diff --check`、client.js 语法检查、release-notes check均exit0。
  审查发现与视觉边界见 `2026-10-15-custom-ui-audit.md`。中间真实红色反馈：边缘菜单裁切、长名称溢出；
  截图另发现新分区缺主题域。全部修正，未删除/放宽原断言。
  完整 E2E 另暴露alpha.3持久化构造器转为私有；三个辅助脚本改挂载公开插件服务并有序dispose，
  保留数据读回、活动turn拒删及外部写锁断言。初次清理误用ctx.dispose，改用公开fork.dispose后三项及完整回归通过。
  未覆盖：Windows/Linux原生控件视觉、真实飞书往返；打包门禁留给KUI-03。
- KUI-02A：冻结安装/bootstrap exit0；真实resources闭包的4项account测试exit0；verify429 + ACP1 exit0；
  audit exit0；新dist exit0；打包登录原断言连续三轮exit0（14.9s）。首次CI38687284942和首轮打包失败如实保留，
  修正精确补丁锚点与官方桥能力识别后才恢复门禁。中间直接读取isolated manifest路径的ENOENT检查不算通过，
  测试现统一核验bootstrap产出的真实resources，不依赖残留hoisted目录。未覆盖：完整重跑及三平台新CI，归KUI-03。
- 下一任务：KUI-03，新包完整回归，回填KUI-02A SHA并推送。
- 最新已发布仍是 `0.2.1-alpha.2.shell.4`；GitCode 镜像登录阻塞属于既有发布交付，不在此处冒称解决。
