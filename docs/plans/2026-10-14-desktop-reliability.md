# 2026-10-14：关闭退出、无 macOS 钥匙串飞书凭据与 Windows 安装性能

基线：父仓库 `88280ea361137dcbd198af5c7ae6f0632ab94139`，子模块
`a9a936c5102ffa24f8165d74d5199206ba6d724a`；已发布 shell.3 不移动。
用户认可先前建议；继续采用实现 → 验证 → 修正 → 再验证，不采用 TDD。
一次只做一个原子任务，精确暂存；不改真实数据/凭据、不关闭防护，不升级内核或依赖。

## 有序任务与修改范围

1. **REL-01 关闭即退出**：`src/main/window.ts`、`src/main/index.ts`、
   `src/main/locale.ts`、`e2e/electron-shell.spec.ts`、`test/window-close.test.ts`、
   `.github/workflows/ci.yml`、中英 README、`docs/ARCHITECTURE.md`、
   `docs/decisions/0038-close-main-window-quits{,.zh}.md`、ADR 索引与本记录。
   门禁：typecheck、相关单测、真实 Electron 主窗口关闭（含辅助窗口）、单实例激活回归。
2. **REL-02 macOS 飞书凭据不访问钥匙串**：`src/main/cc-connect-{credentials,applications,controller,types}.ts`、
   `src/main/feishu-page.ts`、`plugins/dsh-desktop-controls/lib/client.js`、
   相关 `test/cc-connect-*.test.ts`、同一 E2E、`docs/cc-connect.md`、
   `docs/decisions/0039-macos-file-credentials{,.zh}.md`、ADR 索引与本记录。
   macOS 新凭据为 0600 明文文件；旧加密凭据仅识别、保留并要求重录；
   Windows 保留 DPAPI，不加入 mock keychain 开关、不改签名。
   门禁：平台策略/零加密调用/旧凭据状态/错误脱敏/QR 与 UI/五轮关键回归。
3. **REL-03 Windows 安装性能**：`build/installer.nsh`、
   `scripts/{deploy-harness,smoke-installed,smoke-upgrade,smoke-nsis-residue}.mjs`、
   所需纯函数 `.mjs` / `.d.mts` 与对应单测、`.github/workflows/release.yml`、
   专用 Windows 验证 workflow、`docs/nsis-upgrade-residue-analysis.md`、本记录。
   先量化分阶段耗时，再仅精简明确不参与运行的资源；保留功能/许可证/残留保护。
   门禁：临时夹具、真实 runtime/bootstrap、Windows 安装与升级 CI；不能把文件数减少冒称已提速。
4. **REL-04 完整候选与交付**：本记录、`HANDOFF.md`、文档索引、必要版本字段与候选说明；
   构建生成物按既有脚本更新。full verify/audit、隔离打包与 smoke/E2E、远端验证。
   本机已授权安装包不覆盖，避免重装触发旧钥匙串；不读取真实 Secret。

## 验证基线

- shell.3 Windows Release `38330491175`：安装步骤约 105 秒，资源清单 17,674 文件。
  各阶段/用户电脑安全扫描占比未确定；无 Windows 本机，交由真实 Windows runner 测量。
- 已安装 macOS 包只读签名检查为 ad-hoc / DR=cdhash；Cookie Encryption fuse=disabled。
  不因存在 Cookies 文件而打开 `use-mock-keychain`；不用真实 profile 试探系统认证。
- 先前凭据与进程单测 14/14 exit 0，只证明旧实现，不作为新行为验收。

## 进度

- REL-01 完成：主窗口关闭统一退出，不因辅助窗口存活而留后台；最小化与第二实例聚焦保留。
  同步在 close 事件中 quit 会产生嵌套关闭挂起，改为事件结束后 setImmediate quit。
  初次测试错误使用窗口列表顺序，固定主窗口 ID 后真正检测到这一退出边界；未降低断言。
  `pnpm run typecheck` / `pnpm run build` exit 0；相关单测 14/14 exit 0；
  `pnpm exec playwright test e2e/electron-shell.spec.ts -g 'closing the main window|second-instance activation restores' --repeat-each=5 --reporter=line`
  exit 0，10/10。打包态全门禁与真实服务进程/端口关闭验证留 REL-04。
- 下一任务：REL-02。子模块不需要生产或测试修改；本任务提交 SHA 在后续进度回填。
