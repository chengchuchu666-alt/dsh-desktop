/** Verify that the packaged run rendered every desktop extension surface.
 *
 * The release ships an Electron shell whose value is its extension surfaces:
 * the desktop-tools panel with the floating Feishu quick control, the Feishu
 * connection manager (empty / error / saved / credential states), settings
 * panes, message preferences, LAN pairing, trash and recovery. The packaged
 * `@smoke` suite drives each of them and writes a screenshot; this gate turns
 * "we ran the tests" into "this platform really rendered them", and names the
 * missing surfaces when it did not.
 *
 * Usage: node scripts/verify-visual-evidence.mjs <visual-evidence-dir> [--label <name>]
 */
import { readdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Surfaces every platform must render (observed on macOS and Linux; the
 *  Windows runner is checked against the same list). */
export const REQUIRED_SURFACES = [
  'first-run-safe-mode.png',            // 首启向导 + 安全模式横幅
  'floating-feishu-closed.png',         // 浮动飞书快捷控制（未连接态）
  'floating-menu-bottom.png',           // 浮动菜单（底部布局）
  'settings-desktop-wide.png',          // 桌面设置（宽布局）
  'settings-desktop-minimum.png',       // 桌面设置（最小宽度）
  'settings-feishu.png',                // 设置 · 飞书连接面板
  'settings-advanced-runtime.png',      // 设置 · 高级/运行时
  'settings-recovery.png',              // 设置 · 恢复
  'settings-trash.png',                 // 设置 · 回收站
  'feishu-empty-narrow.png',            // 飞书管理 · 空态
  'feishu-error-narrow.png',            // 飞书管理 · 错误态
  'feishu-saved-narrow.png',            // 飞书管理 · 已保存
  'feishu-file-credential.png',         // 飞书管理 · 受限文件凭据
  'feishu-manager-zh.png',              // 飞书管理 · 中文
  'feishu-manager-en.png',              // 飞书管理 · 英文
  'message-preferences-en.png',         // 消息偏好（卡片样式/进度展示）
  'lan-pairing.png',                    // LAN 配对
  'recovery.png',                       // 恢复视图
  'loading.png',                        // 首屏加载
  'trash-sessions-populated.png',       // 回收站 · 会话
  'trash-resources-populated.png',      // 回收站 · 资源
  'desktop-tools-info.png',             // 桌面工具面板 · 信息组（关于 + Star 入口）
]
// Market-suite screenshots (popover-attempt-*.png, market-*.png) are not part
// of this contract: they come from the market suites that run after the
// packaged gate and ride along in test-results/ instead.

async function pngNames(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => [])
  return entries.filter(entry => entry.isFile() && entry.name.endsWith('.png')).map(entry => entry.name)
}

/** @returns which required surfaces are present under `root`. */
export async function inspectVisualEvidence(root) {
  const present = new Set(await pngNames(root))
  return { present, missing: REQUIRED_SURFACES.filter(name => !present.has(name)) }
}

async function main() {
  const target = resolve(process.argv[2] ?? 'visual-evidence')
  const labelFlag = process.argv.indexOf('--label')
  const label = labelFlag === -1 ? basename(target) : (process.argv[labelFlag + 1] ?? basename(target))

  const { present, missing } = await inspectVisualEvidence(target)
  console.log(`visual-evidence[${label}]: ${present.size} screenshot(s) under ${target}`)
  console.log(`visual-evidence[${label}]: required surfaces ${REQUIRED_SURFACES.length - missing.length}/${REQUIRED_SURFACES.length}`)
  for (const name of REQUIRED_SURFACES) console.log(`  ${present.has(name) ? 'ok     ' : 'MISSING'} ${name}`)

  if (present.size === 0) {
    console.error(`visual-evidence[${label}]: no screenshots at all — the packaged run did not render the app`)
    process.exitCode = 1
    return
  }
  if (missing.length > 0) {
    console.error(`visual-evidence[${label}]: missing ${missing.length} extension surface(s): ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }
  console.log(`visual-evidence[${label}]: all ${REQUIRED_SURFACES.length} extension surfaces rendered`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
