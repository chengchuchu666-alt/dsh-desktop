# 迭代进度与交接

更新日期：2026-10-19。**本轮仅完成研究与计划；下列实施卡均未开工。**
下一任务：**IT-00**。低性能 agent 先复制[提示词](agent-prompt.md)，只领取一个任务。

## 状态和选择规则

- `ready`：依赖满足，可以领取；`waiting`：依赖尚未完成。
- `needs-review`：必须先完成规范/方案审查；不得直接进入产品实现。
- `doing`：记录执行者、分支和开始 SHA；`blocked`：记录具体缺口与可解除条件。
- `done`：有验收证据，或有充分证据证明无需修改；“代码已写”不是 done。

每次只把确实满足依赖的卡改成 ready；优先处理当前失败和门禁可信度。
文档与只读调查可并行；同一文件或同一进程生命周期不能由多个 agent 同时改。
表中状态是本计划内部调度，不代表 GitHub 标签已经变更。

## 任务表

| ID | 任务 | 类型 | 依赖 / 准入 | 初始状态 |
|---|---|---|---|---|
| IT-00 | 执行时基线 | A | 无 | ready |
| IT-01 | locale watcher 诊断与修复 | B | 00；先复现 | waiting |
| IT-02 | 当前版本/资产/门禁文档 | A | 00 | waiting |
| IT-03 | 旧计划状态对照 | A | 02、16 | waiting |
| IT-04 | Runtime 数据与异常回归 | A | 00 | waiting |
| IT-05 | 同环境竞争复现与规范 | B | 04 | waiting |
| IT-06 | 单个 Runtime 竞争修复 | B | 05 规范获审查 | needs-review |
| IT-07 | Runtime 状态同步与 UI 路径 | B | 04、06；wrapper 验收前 17/18 | waiting |
| IT-08 | Windows 运行库架构证据 | B | 00；按环境能力标覆盖 | waiting |
| IT-09 | 精确版本数据兼容证据 | B | 03 | waiting |
| IT-10 | 全入口内核回退保护分解 | C | 09；资深审查 | needs-review |
| IT-11 | 可信任务状态规范 | C | 03；资深审查 | needs-review |
| IT-12 | 退出/重启保护分解 | C | 11；内核分支另需 10 | needs-review |
| IT-13 | Windows 更新授权分解 | C | 12；资深审查 | needs-review |
| IT-14 | 反馈与 issue/PR 事实核对 | A | 00；每轮按需 | waiting |
| IT-15 | 验证与候选交付 | B | 本轮选定卡、相关门禁完成 | waiting |
| IT-16 | 现存 Worktree 成果盘点 | A | 00 | waiting |
| IT-17 | E2E 结果判定契约/回归 | B | 00；先受控复核并审查 | needs-review |
| IT-18 | E2E 所属进程清理 | B | 17 完成且契约获审查 | needs-review |
| IT-19 | Edition 来源/隔离语义 | A | 00；wrapper 前 17/18 | waiting |
| IT-20 | bundled/selected 内核诊断 | B | 00 | waiting |
| IT-21 | 版本查询有界失败 | B | 00 | waiting |

建议首轮依次交付：00 → 02/16 → 03；同时由独立执行者做 01、17/18 的调查。
门禁问题处理后，再选择 04～07 作为一个功能主题；19/20/21 按实际反馈选一项，
不要求一轮把所有可执行卡全部做完。C 类不塞给低性能 agent 自行决策。

## 2026-10-19 调查快照（实施前事实）

基线：`26776d58df14a7bc2777a6aa593994ebc9ffac00`，
`codex/cc-connect-dsh-integration`；开始调查时当前树干净。
两个独立工作树有既有成果，其中包含未提交文件；详见[事实盘点](../2026-10-19-project-review.md)。
调查后段另出现并发改动：视觉测试/验证器增加信息区截图及第 22 个扩展面，随后还有对应测试、
架构/边界文档、发布技能与站点字典改动。本轮没有编辑、提交或验收这些实现；本文 21 面与初次验证统计
均绑定起始 HEAD。后续接手必须重新检查 `git status`、当前 diff 和相关测试，不能沿用旧数字宣布当前树全绿。
本计划的实际写入范围仅为五份新 Markdown 与 `docs/README.md` 的一行索引。

### 当前版本与远端

- `package.json`：`0.2.1-rc.2.shell.1`；`resources/harness` 内 `@deepseek-ai/dsh`：`0.2.1-rc.2`。
- 随包 Node pin：`v24.21.0`；本轮主机 Node `v24.15.0`、pnpm `10.33.2`、Go `1.27.1 darwin/arm64`。
- GitHub [rc.2.shell.1 Release](https://github.com/citrusli2026/dsh-desktop/releases/tag/v0.2.1-rc.2.shell.1)
  于 2026-10-19 11:28 上海时间发布，非 draft、prerelease，10 个资产。
- [发布 run 39192109618](https://github.com/citrusli2026/dsh-desktop/actions/runs/39192109618)
  成功；[main CI 39196329231](https://github.com/citrusli2026/dsh-desktop/actions/runs/39196329231)
  成功。它们是远端相应 SHA 的结果，不覆盖当前本地失败。
- 当前 `site/data/release.json`（生成于 `2026-10-19T03:44:16.657Z`）同 tag，
  8 个公开资产均 `gitcode_ok=true`；这是生成数据快照，本轮没有重新下载全部镜像验证。

### 本轮本地验证

| 命令 | 实际结果 | 退出码 / 限制 |
|---|---|---|
| `pnpm run verify` | typecheck、runtime:check 通过；coverage 494 项：493 通过 / 1 失败 / 0 跳过 | **1**；链式命令在 coverage 停止，ACP 独立契约、site/build 后续步骤未由此执行 |
| 失败项 | `test/locale.test.ts:86`；profile locale watcher timed out，约 2000ms | 根因未定位，分配 IT-01 |
| `node --test test/locale.test.ts` | 7/7 通过，约 0.5s | 0；单跑成功不能覆盖全套失败 |
| `pnpm run site:check` | 4 installers、173 translations、下载 API 契约 ALL PASS | 0；只代表本地站点契约 |

覆盖率为 lines 89.62%、branches 82.45%、functions 86.94%；未降低 80/75/70 门槛。
完整原始输出保存在执行机临时日志（`dsh-project-plan-verify-20261019.log`），未提交仓库。
本轮未重新打包、执行真实飞书任务、运行原 guarded E2E 或公开发版。

### 计划文档交付复核

六份文档的本地链接、22 个任务编号/进度行、全新文件的可移植路径与空白格式检查通过；
`git diff --check -- docs/README.md` 通过。文档交叉审查发现的构建顺序、selected/effective 内核语义、
跨平台进程归属和证据目录问题已修正。
最终单独执行 `pnpm run site:check` 退出 0（4 installers、172 translations、API ALL PASS）；
翻译数量与第一次不同，来自同期字典改动，不把两次不同工作树的结果合并成一次全量通过。

### Issue 与 PR（只读核实；执行时刷新）

| 项目 | 采样状态 | 下一动作 |
|---|---|---|
| [#118](https://github.com/citrusli2026/dsh-desktop/issues/118) | open、无标签；旧 run 发布阶段把视觉目录纳入 release 触发资产拒绝，当前已加安装包工件筛选，后续发布成功 | 治理评估，避免重复开发 |
| [#116](https://github.com/citrusli2026/dsh-desktop/issues/116) | open、bug/ready-for-agent、已指派；评论已记录权限预检修复发布 | 先看原机器反馈，不按标签重复实施 |
| [#115](https://github.com/citrusli2026/dsh-desktop/issues/115) | open、bug/needs-info；已有缺包恢复修复 | 等升级后的当次复现与诊断 |
| [#100](https://github.com/citrusli2026/dsh-desktop/issues/100) | open、bug/needs-info；白屏的首条渲染异常仍缺失 | 与权限启动错误分开核实 |
| [PR #112](https://github.com/citrusli2026/dsh-desktop/pull/112) | setup-go 6→7，历史 CI 绿 | 审官方兼容说明，再看当前集成检查 |
| [PR #110](https://github.com/citrusli2026/dsh-desktop/pull/110) | Playwright 1.63→1.64，历史 CI 绿 | 需当前 Electron/packaged/market/视觉验证 |
| [PR #111](https://github.com/citrusli2026/dsh-desktop/pull/111) | @types/node 24→26，类型检查红，TS2769 | 先决定升级必要性，不放宽断言绕过 |

已核查中英 FAQ 含 `#profile-permission` 恢复说明；**不再安排“新增 EPERM FAQ”任务**。
飞书管理、Host 会话回收站、macOS socket 短路径、Linux arm64 与 21 扩展面视觉门禁均已有交付，
不能根据旧计划或旧 issue 标题再从头实现。

## 每项交接回执

```text
任务 ID / 类型 / 状态：
执行者 / 分支 / 开始与结束 SHA：
开始前已有改动与其他 Worktree：
问题触发条件、复现及根因证据：
修改文件与行为变化（无修改则说明）：
命令 / 退出码 / 关键断言 / 日志位置：
未验证 / 不适用 / 外部阻塞：
是否改变配置、数据、IPC、退出或更新规则：
审查意见 / 对应 issue（未发布草稿须注明）：
下一任务与其依赖是否满足：
```

回执放对应 evidence；progress 只保留结论与链接，避免再形成一个难以读取的巨型历史文件。
