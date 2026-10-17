# 开放 Issue 分析与解决方案（2026-10-17）

范围：`citrusli2026/dsh-desktop` 当前 4 个开放 issue（#115、#114、#113、#100）。
方法：逐条读原始正文/评论/附件，用当前主干代码与已发布内核（npm `@deepseek-ai/dsh`）交叉验证；
无法证实的部分明确标为"待证据"，不当作根因。

> **执行状态（2026-10-17 晚）**：本文的 issue 动作已全部执行（#113、#114 已关闭，#115/#100 已回复并打标签，
> 新开 #116），P0 代码修复与 #100 的预检/错误捕获已在工作区实现并通过门禁，详见 §6。

## 结论速览

| Issue | 类型 | 结论 | 建议动作 |
| --- | --- | --- | --- |
| #115 | 启动失败（有诊断附件） | **根因已确认**：内置内核 0.1.2-rc.1 不携带 `@deepseek-ai/dsh-agent-preset`（该包自内核 0.1.7 起才进入安装闭包），而用户 profile 的 include 行引用了它 → 每次启动硬失败；安全模式与自动隔离都覆盖不到该行 | 回复+用户侧升级指引；代码侧补 4 个缺口（见 §1.3） |
| #114 | 同上，无附件 | 与 #115 同一故障类（同版本/同平台/同一分钟提交，标题一致） | 作为 #115 重复项处理，回复后关闭 |
| #113 | 自动化告警 | **已修复且被取代**：`ERR_PNPM_UNUSED_PATCH` 由 `b835483` 修复并已被 alpha.5/rc.1 升级验证；alpha.4 早于当前 pin | 回复证据后关闭 |
| #100 | 白屏 + 启动失败（Windows） | 后半段（EPERM 启动环）**根因已确认**：内核每次启动都重写 `profiles/web/cordis.yml`，文件只读/ACL/受控文件夹访问会直接让 `dsh` 退出；前半段（grill-me 白屏）**仍缺证据**，且当前诊断能力拿不到渲染进程首条异常 | 回复+关闭前半段所需证据缺口（渲染进程错误捕获）；代码侧补写权限预检/修复（见 §3.3） |

---

## 1. #115 / #114：旧内核 + 引用新内核包的 include 行 → 启动死循环

### 1.1 证据链（#115 附件 `dsh-desktop-diagnostics-2026-10-17.txt`）

```
app_version=0.1.2-rc.1.shell.9        # 2026-09-07 发布的版本
harness_version=0.1.2-rc.1
platform=win32 10.0.26200
safe_mode=true / safe_mode_reason=plugin-quarantine
failure_cause=unknown
preset-pentest (@deepseek-ai/dsh-agent-preset)
composed_rows=dsh-market,dream-skin,dsh-whale-musume,soul-md,permission,pentest-mode,pentest-graph
```

```
Error: dsh: plugin tree failed to load: failed to apply loader entry include (cordis:include):
  failed to import loader entry preset-pentest (@deepseek-ai/dsh-agent-preset):
  Cannot find package '@deepseek-ai/dsh-agent-preset' imported from ~\.dsh-desktop\profiles\web\
  code: 'ERR_MODULE_NOT_FOUND'
supervisor: harness exited code=1 signal=null
```

关键事实（均已用 npm registry 元数据核对）：

- `@deepseek-ai/dsh-agent-preset` 首次发布是 `0.1.7-alpha.1`（2026-09-22）；
  `@deepseek-ai/dsh@0.1.2-rc.1` 的依赖里**没有**它，`0.1.7-alpha.1` / `0.1.7-rc.2` / `0.2.1-rc.1` 里都有。
- 内核的运行时解析（`dsh-app-boot` 的 `createRuntimeResolution` → `collectInstallationScopePackages`）会把
  **安装闭包内**的包供给 ESM/CJS 解析器；0.1.2-rc.1 闭包里没有这个包，所以引用它的 loader 行必然 `ERR_MODULE_NOT_FOUND`。
- 失败行 `preset-pentest` **不在** `composed_rows` 里。可以确定的是：安全模式的禁用集正是由
  `composed_rows` 生成的，所以它**一定没有被禁用**——这正是开了安全模式仍然失败的直接原因。
  它到底来自哪一层，有两种可能，现有报告都看不出来：
  1. 用户补丁层（`profiles/web/cordis.patch.yml` 或 `$DSH_HOME/cordis.patch.yml`，或这两层 include 的文件）——
     最可能，因为 6 个用户 bundle 各自都已在 `composed_rows` 里贡献了行，说明它们的 patch 都被成功读取；
  2. bundle patch 里**没有 id 的 include 行**（`buildSafeModeOverlay` 只统计 `unkeyedRows` 数量，
     既不能按 id 禁用，诊断报告里也没有这个字段，`inspectPluginInventory` 同样不输出）。

### 1.2 为什么三条恢复路径全部失效（代码级）

1. **安全模式覆盖不到用户补丁层**：`src/main/safe-mode.ts:200` 的 `buildSafeModeOverlay()` 只遍历
   `package.json` 的 `dsh.profile.bundles`，从每个 bundle 的 patch 里收集 `insert` 行 id。
   而内核的补丁栈是 *bundle 层 → profile 层 `cordis.patch.yml` → home 层 `cordis.patch.yml` → `--patch` 覆盖*。
   用户补丁层插入的行永远拿不到 `disabled: true`，于是"安全模式"里同一行照样崩。
   同一函数对**无 id 的行**只能计数（`unkeyedRows`），既禁不掉，也不会出现在诊断报告的 `composed_rows` 里——
   排障时看不到这一类"隐形行"。
2. **自动隔离匹配不到非 bundle 行**：`src/main/index.ts:1377` 的 `autoQuarantineSuspects()` 用失败行的
   **包名**（`@deepseek-ai/dsh-agent-preset`）去 `dsh.profile.bundles` 里找（`src/main/plugin-recovery.ts:93`
   `pickQuarantinable`），找不到就什么都不做 → 每次启动重复崩溃，重启预算耗尽后停在错误页。
3. **失败分类给不出方向**：`src/main/safe-mode.ts:87` 的 `classifyPluginFailureCause()` 只认
   "does not provide an export named" / `SyntaxError: The requested module '@deepseek-ai/dsh-*'` / 运行时 TypeError。
   `ERR_MODULE_NOT_FOUND` 落到 `unknown`，错误页因此不给"插件需要更新内核"的提示，诊断报告里也只有 `failure_cause=unknown`。

补充（非本 issue 根因，但影响可达性）：`src/main/update-prompt.ts:104` 的自动更新走 electron-updater 默认源，
`electron-builder.yml:62` 的 publish 只有 GitHub；国内网络下更新下载经常失败且只写 console。
用户停在 9 月 7 日的构建上，正是"更新通道不可达 → 旧内核 + 新插件"这个组合的来源。

### 1.3 解决方案

**用户侧（现在就能恢复）**

1. 升级到最新发布版（GitCode 镜像，避免 GitHub 下载失败）；内置内核 ≥0.1.7 即携带该包，include 行可以正常解析。
2. 若升级后仍失败：先不要重装、不要清用户数据；把 `dsh-pentest-mode` / `dsh-pentest-graph` 从
   `%USERPROFILE%\.dsh-desktop\profiles\web\package.json` 的 `dsh.profile.bundles` 中移除（保留文件），
   或从 `profiles/web/cordis.patch.yml` 里删掉引用 `@deepseek-ai/dsh-agent-preset` 的那一行（先备份）。
3. 需要保留现场时，把"复现当次"的诊断报告贴回 issue；重启后的报告不能证明原故障。

**代码侧（按优先级，全部可单测）**

| 优先级 | 改动 | 位置 | 验收 |
| --- | --- | --- | --- |
| P0 | 把 `ERR_MODULE_NOT_FOUND` + `@deepseek-ai/dsh-*`（以及 loader 行的任何"找不到包"）归为 `kernel-api`/新增 `missing-package`，错误页给"升级内核或禁用该插件"提示 | `src/main/safe-mode.ts:87`；`src/main/pages.ts:105` | 单测：喂 #115 的日志尾部 → 分类为内核不兼容，报告含 hint |
| P0 | 安全模式覆盖用户补丁层：`buildSafeModeOverlay()` 追加读取 profile/home 的 `cordis.patch.yml`，收集其顶层行 id；对 include 行递归收集被包含文件的顶层行 id，并把**父 include 行**也加入禁用集 | `src/main/safe-mode.ts:200`（复用 `collectInsertIds`/`parsePatch`） | 单测：补丁层插入的行出现在 overlay；include 子行失败时父行被禁用；fixture 用 #115 形状的 `cordis.patch.yml` |
| P0 | 自动隔离扩展到非 bundle 行：崩溃时把失败行 id 写入 shell 自有的持久禁用 overlay（`userData/plugin-quarantine.patch.yml`），之后每次启动都作为 `--patch` 传入；"已在禁用集"即循环护栏，且可逆（错误页/设置里恢复） | `src/main/index.ts:1377`；`src/main/supervisor.ts:188`（overlay 组合） | 单测：非 bundle 行崩溃一次后第二次启动带上禁用 overlay，且不会无限追加 |
| P1 | 兜底恢复 profile：连续 N 次（正常+安全模式）未就绪时，用 shell 自建的 `--profile web-recovery`（仅官方 bundle）启动，让界面可达、可卸载插件，并显著提示当前是恢复模式 | `src/main/supervisor.ts`（args 组合）、`src/main/shell-app.ts` | E2E/冒烟：注入永久失败的补丁层，验证最终仍能进 UI |
| P1 | 诊断补全：记录内核 overlay 版本、profile/home 补丁层是否存在及其顶层行 id、`unkeyed_rows` 数量、失败行所在层 | `src/main/diagnostics.ts:152`、`src/main/safe-mode.ts:276` | 报告字段断言测试 |
| P2 | 更新可达性：electron-updater 连续失败后，菜单"检查更新"回退到镜像发布页（复用 health-check 已有的 `repairUrlAlt` 口径） | `src/main/update-prompt.ts:104` | 手动检查在断网/GitHub 不可达时给出镜像入口 |

---

## 2. #113：dsh-watch 升级到 0.2.1-alpha.4 验证失败（已修复）

### 2.1 证据

失败步骤 `Regenerate the closure lockfile`（run 38860789986）：

```
ERR_PNPM_UNUSED_PATCH  The following patches were not used:
  @deepseek-ai/dsh-client-ui-settings-account@0.2.1-alpha.3
Either remove them from "patchedDependencies" or update them to match packages in your dependencies.
```

原因：内核 pin 升到 alpha.4 后，`manifest/harness/pnpm-workspace.yaml` 的 `patchedDependencies`
仍绑定 `...settings-account@0.2.1-alpha.3`，pnpm 判定补丁未命中而失败（历史同类失败见已关闭的 #108）。

### 2.2 已修复

- `b835483`（2026-10-17 10:23 +0800）"fix: carry reviewed account patches through kernel version bumps"：
  新增 `scripts/kernel-patches.mjs`，并在 `scripts/version.mjs:135` 的 `bump dsh` 里调用，
  升级时把受审查的补丁键与文件名一起迁移到新版本（`COPYFILE_EXCL`，绝不覆盖已有候选补丁），带单测 `test/kernel-patches.test.ts`。
- alpha.5、rc.1 两次升级都走了这条路径；当前 pin 为 `@deepseek-ai/dsh-client-ui-settings-account@0.2.1-rc.1`，
  主分支 CI 绿。alpha.4 早于当前内核，告警已被取代。

### 2.3 遗留（另开小任务，不阻塞关闭）

- 2026-10-17 06:11Z 的 dsh-watch 失败**不是**版本不一致：该时刻 HEAD 为 `7bd642d`
  （`0.2.1-rc.1.shell.0` / pin `0.2.1-rc.1`，一致），失败原因是 `version.mjs check` 两个 registry
  都不可达（exit 1）。建议：`check` 增加一次退避重试，并把"registry 不可达"与"版本状态不一致"用不同退出码/标题区分，
  避免日报噪声被误读为升级回归。

---

## 3. #100：grill-me 白屏 + `cordis.yml` EPERM 启动环

必须拆成两个缺陷，只有第二个已确认。

### 3.1 已确认：Windows EPERM 让应用再也起不来

- 用户附件显示：`prepareProfile` 写 `profiles/web/cordis.yml` 时 EPERM，重试全部 `code=1`，闭包完整性 ok。
- 内核侧行为（内置 `@deepseek-ai/dsh` 的 `prepareProfile`）：**每次启动都** `writeFileSync(profiles/web/cordis.yml)`
  （把组合结果重新展开成空根，避免 Loader 回写把行烘进文件）。该文件只读、ACL 拒绝写入、
  或 Windows 安全中心"受控文件夹访问"拦截时，`dsh` 直接退出，应用进入"重启→失败"循环。
- 为什么现有恢复路径无效：
  - 安全模式只改 `--patch` 覆盖，不改变这次写文件；
  - `src/main/health-check.ts:305` 的存储检查只探测 `DSH_HOME` **目录**可写（`isWritableDirectory`），
    单文件只读会显示"数据目录可写"，给出错误的安全感；
  - 错误页没有"profile 不可写"这一类提示，也没有修复动作。

### 3.2 仍未确认：grill-me 返回提问后白屏

- 现象是渲染进程**没崩**（右键菜单可用）→ 不是 `render-process-gone`（`src/main/window.ts:216`）路径，
  更像客户端插件/页面级 JS 异常。
- 现有诊断拿不到渲染进程首条异常：`webContents` 没有 `console-message` 采集，
  报告里没有 renderer 错误段；因此维护者两次索要"首条异常"都只能靠用户手工开 DevTools。

### 3.3 解决方案

| 优先级 | 改动 | 位置 | 验收 |
| --- | --- | --- | --- |
| P0 | 启动前对 profile 关键文件做**文件级**写权限预检（`profiles/web/cordis.yml`、`package.json`、`cordis.patch.yml`）：创建探针文件或 `open(path,'r+')`；失败即分类为 `profile-not-writable` | `src/main/health-check.ts:305` 抽出可复用的 `probeProfileWritable()`；`src/main/index.ts:601` 启动路径调用 | 单测：只读文件 → 分类命中，错误页/报告带路径 |
| P0 | 一键修复：对该文件 `chmod 0o644`（Windows 上即清除只读属性）后重探，成功则自动重启 Harness；仍失败则给出精确指引（只读属性 / 该文件与 `web` 目录 ACL / 安全中心"保护历史记录"），不引导关闭杀软 | `src/main/index.ts`（IPC + 错误页按钮）、`src/main/pages.ts:105` | 单测：chmod 后探针通过；页面文案含三步指引 |
| P1 | 渲染进程错误捕获：`webContents.on('console-message')` 采集 error/warning 环形缓冲 + `unresponsive` 事件，写入诊断报告新增段（脱敏、限长） | `src/main/window.ts`、`src/main/diagnostics.ts:152` | 单测：注入 console 错误 → 报告含首条异常与时间 |
| P1 | 兜底恢复 profile（同 §1.3 P1）：profile 目录整体不可写时，用 `--profile web-recovery` 启动，至少让用户能进 UI 导出报告 | 同上 | 冒烟测试：把 `profiles/web/cordis.yml` 设为只读，应用仍能进入恢复模式 |
| P2 | 文档/FAQ 补"启动失败：profile 文件不可写"的恢复路径（与官网 FAQ 现有条目对齐） | `site/`、`docs/` | 站点构建通过 |

**对用户回复的要点**：先按 §3.1 恢复启动（只读属性/ACL/受控文件夹访问三选一），
保留 `cordis.yml` 原件与备份、不要清用户数据；白屏部分需要"复现当次"的诊断（新版本会自带渲染进程首条异常）。

---

## 4. 建议的 issue 处理动作

1. **#115**：保留开放。贴根因结论 + 升级指引（GitCode 镜像）+ 代码修复清单；打 `bug`、`needs-info`（等升级结果确认）；
   代码修复落地后转为 `ready-for-agent`。
2. **#114**：以"与 #115 同一故障类"回复并关闭（重复），把附件与复现信息合并到 #115。
3. **#113**：贴 run 日志行 + `b835483` + alpha.5/rc.1 已发布的证据后关闭；registry 重试作为独立小 issue（或并入 CI 维护任务）。
4. **#100**：保留开放。拆成两条跟踪：#100 继续跟 grill-me 白屏（等渲染进程错误捕获上线后再要一次报告）；
   另开"profile 文件不可写 → 启动失败"的独立 issue（含 P0 预检+一键修复），因为它是可独立验收的壳缺陷。

## 5. 落地顺序建议

1. P0-1 `ERR_MODULE_NOT_FOUND` 分类 + P0-2 安全模式覆盖用户补丁层（解决 #115 类"安全模式也救不回来"）
2. P0-3 非 bundle 行持久禁用 overlay（让崩溃能自愈，而不是停错误页）
3. P0-4 profile 写权限预检 + 一键修复（#100 后半段）
4. P1-5 渲染进程错误捕获（解锁 #100 前半段与后续白屏类问题）
5. P1-6 恢复 profile 兜底 + 诊断补全 + 更新通道镜像回退

---

## 6. 执行记录（2026-10-17）

### 6.1 Issue 动作（已完成）

| Issue | 动作 |
| --- | --- |
| #115 | 回复根因（旧内核缺 `@deepseek-ai/dsh-agent-preset`）+ 升级/移除指引 + 壳侧修复清单；打 `bug`、`needs-info`；保持开放等用户升级结果 |
| #114 | 以"与 #115 同一故障类"回复并作为重复项关闭 |
| #113 | 贴出 `ERR_PNPM_UNUSED_PATCH` 日志、`b835483` 修复与 alpha.5/rc.1 验证证据后关闭；另记 2026-10-17 06:11Z 的 registry 不可达噪声 |
| #100 | 拆成两件事回复：`cordis.yml` EPERM 已确认（指向 #116），grill-me 白屏保留 `needs-info` 等渲染进程错误捕获上线后再取一次报告 |
| #116（新建） | "profile 根配置不可写导致 Harness 每次启动 EPERM 退出"，`bug` + `ready-for-agent`，已指派 |

### 6.2 代码（已实现，工作区待提交/发布）

| 修复 | 主要改动 | 测试 |
| --- | --- | --- |
| 缺包分类 | `src/main/safe-mode.ts` 新增 `missing-package`（loader 行 + `ERR_MODULE_NOT_FOUND`/`Cannot find package`），错误页/诊断/支持模板各给对应提示 | `test/safe-mode.test.ts`、`test/pages.test.ts`、`test/diagnostics.test.ts` |
| 安全模式覆盖用户补丁层 | `buildSafeModeOverlay()` 追加读取 profile/home 的 `cordis.patch.yml` 及其 `cordis:include` 文件；官方行覆盖（override）保持启用；`inspectPluginInventory` 输出 `patch_layers`/`unkeyed_rows` | `test/safe-mode.test.ts`（含 include 与 override 用例） |
| 非 bundle 行持久隔离 | 新模块 `src/main/plugin-quarantine.ts`（记录 + 派生的禁用 overlay，去重即循环护栏，可解除）；supervisor 每次启动追加 `--patch`；`autoQuarantineSuspects()` 对非 bundle 行落盘；错误页与「桌面工具」菜单可解除；更新/禁用插件时自动释放对应行 | `test/plugin-quarantine.test.ts`、`test/menu-template.test.ts`、`test/supervisor.test.ts` |
| profile 写权限预检 + 一键修复 | 新模块 `src/main/profile-writable.ts`（文件级 `open('r+')` 探测、只读判定、`chmod 0o644` 修复、失败行分类）；supervisor 预检失败不 spawn；体检 `storage` 用同一探测；诊断新增 `profile_write=`；错误页新增提示与修复按钮 | `test/profile-writable.test.ts`、`test/health-check.test.ts`、`test/supervisor.test.ts`、`test/pages.test.ts` |
| 渲染进程错误捕获 | `window.ts` 采集 `console-message`（error/warning）与 `unresponsive`，环形缓冲进诊断报告 `renderer_errors`；渲染恢复失败时把首条异常并入错误页日志尾部 | `test/renderer-recovery.test.ts`、`test/diagnostics.test.ts` |

门禁（本机，2026-10-17）：`tsc` 通过、`runtime:check` 通过、单测 464 项 463 通过（唯一失败为
`cc-connect-config` 需要本机 Go 工具链，改动前即失败）、`site:check` 通过、`pnpm run build` 通过、
覆盖率 89.94% 行 / 82.71% 分支 / 86.86% 函数（阈值 80/75/70）。

Playwright e2e 在本机不能作为门禁：`environment edge paths › a read-only DSH_HOME still boots with defaults`
与 `a plugin crash auto-quarantines the suspect and boots again` 在本机失败，且已用 `git stash -u` + 重新构建
在**改动前的干净树**上复现同样失败（前者 page closed、后者 Target crashed），属本机 Electron/GUI 环境问题，
与本次改动无关；发布前仍需在 CI 或可用桌面环境跑一遍 e2e。

### 6.3 仍未完成

1. ~~提交并发布~~ **已完成**：`v0.2.1-rc.1.shell.1` 已发布（tag `d087ebd`，release run `39038167498`
   全绿，八资产）；#115/#116 已回帖告知修复版本并请用户验证。首个候选（`2b570b8`）在 S2.5 Safe Mode
   冒烟失败，根因是补丁层扫描把壳自身的官方 locale 覆盖当成用户行禁用，修复见 `e66ce72`；
2. GitCode 国内镜像**未交付**：webbridge 报 `no extension connected`，恢复扩展连接后执行
   `node scripts/mirror-gitcode-v2.mjs v0.2.1-rc.1.shell.1` 并刷新官网 `gitcode_ok`；
2. 兜底恢复 profile（§1.3/§3.3 的 P1：连续失败后用 `--profile web-recovery` 启动）未实现——预检+一键修复已覆盖
   最常见的只读属性场景，ACL/安全软件拦截仍会停在错误页（但已有明确指引，不再是无提示的 EPERM 循环）；
4. 诊断里的内核 overlay 版本（§1.3 P1 的一部分）未加，当前只补了补丁层、`unkeyed_rows`、`profile_write` 与渲染进程错误；
5. `dsh-watch` 的 registry 退避重试与退出码区分（§2.3）尚未实现，作为独立 CI 维护项；
6. 更新通道镜像回退（§1.3 P2）未实现——它是"用户停在旧内核"这一根因的最后一块；
7. 官网 FAQ 的"profile 文件不可写"条目（§3.3 P2）未补。
