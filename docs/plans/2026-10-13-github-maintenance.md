# GitHub 待办与官网维护（2026-10-13）

## 范围与流程

盘点时开放 issue：#100、#101、#104、#105、#106；PR：#55、#91、#99、#102、#103。
按用户要求先实现、验证、修正、再验证；不用强制 TDD 顺序，但不跳过门禁或降低断言。
每个原子任务独立提交，精确暂存；不改真实用户数据和凭据。已有发布 tag 不变。

## 任务与门禁

1. 官网同步 #106：修复并发生成文件提交冲突和仅更新 changelog 时未提交的问题；
   用临时 bare remote、竞争提交和真实 Git push 验证，再观察线上 refresh。
2. 依赖 PR：分别进行 Standards / Spec 审查，核对实际 diff、运行时与安全公告；
   可接受项更新到当前主干并通过 CI 后处理，违反版本边界的项说明后关闭。
3. 历史告警 #101/#104/#105：核对失败日志、对应修复提交和后续成功运行，再关闭。
4. 白屏 #100：附件明确证实 Windows profile 根文件 EPERM；与最初白屏分开诊断。
   不能凭 macOS 未复现认定修复；缺少 Windows 原始复现场景时保留 issue 并说明证据缺口。
5. 官网：补充飞书/cc-connect 独立介绍、操作路径、降噪、安全和连接边界；中英一致，
   changelog 从 release notes 生成，检查桌面/手机、明暗主题、链接和发布口径。
6. 收尾：完整 verify、相关 E2E/打包/审计、远端 CI；根据实际运行时改动决定是否发版。
   如发版，按 release skill 完成三平台门禁、镜像与官网；不把待发布变化写进旧版本。

## 进度

- 起点：父仓库 `9de49c46844a88dff22ecf0f14128cc0fbb866e0`；已快进接纳官网数据 bot 更新。
- 子模块：`5cf99a2700ee5401af1b8c4fa15b6e63fd840bcb`；本轮暂不修改。
- #106 根因：run 38115781815 在生成 JSON 后遇到并发 main 数据提交，rebase 冲突；
  后续 refresh 38253677766 成功，但原来的并发写法仍需修复。
- #104 根因：run 38035445807 `ERR_PNPM_UNUSED_PATCH`，旧 account patch 未随内核改 pin。
  当前 account patch 已 pin 0.2.1-alpha.2，shell.2 Release 38249871041 成功。
- 两路初次审查因额度限制中断；没有借此执行合并或关闭，已重新审查。
- 官网同步实现：`push-site-refresh.mjs` 用一次性 worktree 从最新 main 重新生成，
  push 拒绝最多重试三次，不 rebase 生成文件；三份生成文件都进入变更判断。
- 原子任务门禁：`node --test test/site-refresh-push.test.ts`（3 通过、exit 0）、
  `pnpm run typecheck`（exit 0）、`git diff --check`（exit 0）。首轮类型声明缺失已补齐，
  未跳过测试；临时 bare remote 验证竞争提交被保留、日志单独更新、重试耗尽失败及清理。
- 未覆盖：线上 Actions worktree 继承认证仍需运行验证。实现提交 SHA 由下一条进度回填。
- 下一任务：依赖 PR 处理与全量门禁。

### 2026-10-13 官网与告警

- 同步修复提交 `c7a16e3641f6c5cdee742da99afb8eb1ae9e254d`；全量 `pnpm run verify`
  exit 0（405 单测 + 1 ACP），双树 `pnpm security:audit` exit 0，未增忽略项。
- 新同步流程线上 run `38327109918` success，证实 Actions worktree 继承认证可用；#106 已关闭。
- #101/#105 用失败日志对应修复及成功 Release `38114383738` / `38249871041` 关闭；
  #104 用 account patch pin 修复 `8c84333`、后续成功 dsh-watch 与三平台 Release 关闭。
- Standards 审查：1 项（#103 Node 26 类型超前于 Node 24 运行时）；Spec 审查：
  额外 transitive churn 与 #91 plist 降级需处理；#103 已按文档版本边界关闭，非合并。
- #100 保留 needs-info：附件确认 profile 写 EPERM，不足以确认最初白屏根因。
  已向 issue 回填具体证据、最小补充材料及安全排查路径，未自动更改 ACL 或删除数据。
- 官网增加中英独立飞书介绍及 FAQ：机器人 Secret / 模型 Key / CLI OAuth 分开说明，
  连接意图、降噪、组织权限、Keychain 和 Windows EPERM 边界均明确；当前重点对应已发布 shell.2。
- `node scripts/gen-site-changelog.mjs` exit 0（8 个版本，中英）；`pnpm site:check` exit 0；
  `node scripts/check-site-ui.mjs` exit 0（8 场景：中英 × 390/1280 × 明暗），锚点标题不被固定顶栏覆盖，
  FAQ 可展开、无横向溢出或 pageerror。截图复核用 viewport，不把长元素截图里的固定栏重复当成产品缺陷。
- 未覆盖：官网部署后复验及依赖更新后的发布门禁；下一任务为 #91 lock 修正与运行时安全维护。

### 更新日志发布边界

- 官网介绍提交 `1db39e6`，已合并接纳 #55/#99/#102 主干提交；新运行时依赖需要新壳修订，
  不因官网文案单独发版，不升级 Harness 内核。
- 更新日志生成器以 `site/data/release.json` 的已发布 tag 为上界，排除仓库中的未来版本草稿；
  临时目录回归验证中英已发布/历史条目存在、草稿排除及手工 scaffold 保留。
- #91 修正提交 `04f3717` 保留两处 plist 3.1.1 / xmldom 0.9.12，精确 frozen install 和
  full verify exit 0（406 单测 + 1 ACP），PR head 重跑 CI 后再合并。
- 整合后发现旧官网文档断言失败（英文必须说明 `explicitly open cc-connect`），补回说明，
  不删除或放宽断言。#91 与其它依赖 PR 并发合并还产生重复 YAML 条目；`0aa9c7c` 去重后
  frozen install / lock regression / full verify 再次 exit 0，失败合并头未合入 main。

### 安全闭包与上线

- #55 merge `cfc8b4c`、#99 merge `61e8739`、#102 merge `7211acd`，各自更新头 CI 全绿后合并。
  critical proxy-addr 告警已自动关闭。#91 等待修正头 CI，不因旧头绿灯提前合并。
- 官网与发布日志边界已上线；`SITE_CHECK_URL=https://dsh-desktop.com node scripts/check-site-ui.mjs`
  exit 0（8 场景），与本地同样检查真实页面、FAQ、锚点和已发布 changelog。
- 另两项可修复 high 告警核对官方 GHSA 后精确更新：MCP SDK 1.31.0、compression 1.8.2；
  proxy-addr 2.0.8 固定为 floor。SDK 原为可选 peer，单加 override 会裁掉 SDK，回归测试阻止；
  现显式保留 SDK，保持已审查的 express/Hono server/jose 版本，不借机刷新 Web 栈或内核。
- 门禁：锁解析/版本回归、frozen install、bootstrap、双树 audit、full verify 均 exit 0；
  未增加安全忽略项。sdk 包更新不等于清理历史 OAuth 凭据，旧凭据 issuer/撤销要求按公告单列风险，
  不触碰真实账号凭据。sprintf-js 尚无官方修复版本，原有单一例外保留。
- 安全修复提交 `728e112`；main 合入后 GitHub 3 项可修复告警都自动关闭，仅 sprintf-js medium 剩余。
- #91 修正头 CI `38328176497` success 后 merge `18f92b6`；开放 PR 为零，开放 issue 仅 #100。
- 本地 LAN `pnpm exec playwright test -g 'LAN pairing'` exit 0（2 通过）。
- 下一任务：shell.3 最终候选打包门禁、不可变 tag 发布、GitCode 六资产与官网新日志交付。

### 候选门禁发现的子模块收尾回归

- 新增原子任务允许修改：子模块 `core/cuj_test.go` 中的 `TestCUJ_A5_FileReachesAgent`；
  仅修正测试完成边界，不修改生产逻辑或其它 CUJ。父仓库后续只更新 gitlink、sidecar manifest 和记录。
- 全量 race 首次 exit 1：TempDir cleanup 仍遇到后台写文件；
  `TMPDIR=/private/tmp go test -race ./core -run '^TestCUJ_A5_FileReachesAgent$' -count=100`
  exit 1、反复复现。当前用例仅发现 Agent session 创建就返回，并未等消息处理完成。
- 修正后须单用例重复 race、全量 test/race/build/vet/CUJ 全绿；先提交推送子模块，
  再更新父 gitlink，最终版本重新打包及 smoke/E2E，不能复用旧 pin 的候选通过记录。
- 子模块最终修复 `a9a936c5102ffa24f8165d74d5199206ba6d724a` 已先推 origin 分支。
  单用例修前 100 轮 race 失败 8 次；修后 200 轮 exit 0；全量 test/race/build/vet 和 CUJ 均 exit 0。
  首轮编译时 helper API 名称/返回类型使用不符，已按真实定义修正后重跑全部门禁。
- `pnpm cc-connect:build` exit 0：版本 shell.3、目标 darwin/arm64、最终 pin a9a936c5。
  Sidecar manifest SHA-256 `47c092e40d73edd59758413d69560c64719563ccbdc136a52864120af1a2ddc6`。
- 父 gitlink 提交 `a594e04`；最终 pin 第一次完整候选 packaged 15 / smoke 两项均 exit 0。
  sidecar buildTime 导致再次打包的哈希变化正常，最终候选 manifest 使用 `35fba99b…`；不是再次改 pin。
- 将镜像内容校验从私人硬编码 helper 变成 `scripts/check-gitcode-assets.mjs`：匿名验证六文件
  Content-Range/首字节/完整 200 哈希并拒绝 HTML；两项 mock 回归和 typecheck exit 0，先完成全部检查
  再报告失败，避免关闭中的文件句柄与测试临时目录清理竞争。不读取任何浏览器凭据。
- 最终候选门禁 exit 0：`pnpm verify` 410 + 1 ACP、`pnpm security:audit`、`pnpm dist:dir`、
  两项 packaged smoke、packaged E2E 15、飞书五轮 35、市场 offline 1 / real 2、LAN 2。
  dev E2E 26 / 9 个既有环境用例未启用；没有新增跳过或降低断言。
- 同步中英 README 飞书能力与 Node 24 事实、文档入口；下一任务是从干净提交切不可变 shell.3 tag。
- shell.3 tag `93d0f2fa8556aaa0828d8c1e3f95df321313ea78` 已正常推两远端；Release run `38330491175`
  正在验证。后续仅网站/记录提交不移动 tag。
- 官网日志另外发现旧解析器会丢掉 Markdown bullet 的缩进续行；补齐连续段落，增加中英完整内容
  断言，保留发布上界/旧版本/手工 scaffold 原断言。此为网站生成改进，不另发 shell.4。
