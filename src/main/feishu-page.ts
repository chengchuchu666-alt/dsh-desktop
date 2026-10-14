import { shellText, type ShellLocale } from './locale.ts'
import { escapeHtml } from './shell-html.ts'
import { createHash } from 'node:crypto'

export type FeishuSetupPageStage = 'starting' | 'waiting-for-scan' | 'completed' | 'error'

export interface FeishuSetupPageState {
  stage: FeishuSetupPageStage
  qrDataUrl?: string
}

export function feishuSetupPageMarkup(locale: ShellLocale, state: FeishuSetupPageState): string {
  const language = locale === 'zh' ? 'zh-CN' : 'en'
  const title = shellText(locale, 'feishu.setupTitle')
  const instructions = shellText(locale, 'feishu.setupInstructions')
  const status = shellText(locale, state.stage === 'starting'
    ? 'feishu.starting'
    : state.stage === 'waiting-for-scan'
      ? 'feishu.waiting'
      : state.stage === 'completed'
        ? 'feishu.completed'
        : 'feishu.failed')
  const qr = state.qrDataUrl === undefined
    ? `<div class="placeholder" aria-label="${escapeHtml(status)}"></div>`
    : `<img class="qr" alt="${escapeHtml(title)}" src="${escapeHtml(state.qrDataUrl)}">`
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escapeHtml(title)}</title><style>
    :root { color-scheme: light dark; --bg: #f6f7fb; --panel: #fff; --text: #1e2230; --muted: #606878; --line: #e3e6ef; --accent: #4d6bfe; }
    @media (prefers-color-scheme: dark) { :root { --bg: #0f1117; --panel: #191c24; --text: #f5f6fa; --muted: #adb3c2; --line: #303542; --accent: #8195ff; } }
    * { box-sizing: border-box; } body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text); font: 14px/1.6 -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif; }
    main { width: min(440px, 100%); min-height: 100vh; padding: 30px 28px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; background: var(--panel); } h1 { margin: 4px 0 8px; font-size: 22px; } p { margin: 8px 0; color: var(--muted); } .qr-shell { width: 300px; height: 300px; max-width: 100%; margin: 22px 0 18px; display: grid; place-items: center; padding: 14px; background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 12px 30px rgb(0 0 0 / 8%); } .qr { display: block; width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; } .placeholder { width: 32px; height: 32px; border: 3px solid #d8dded; border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; } .status { min-height: 28px; color: var(--text); font-weight: 600; } button { width: 100%; margin-top: auto; padding: 10px 14px; border: 0; border-radius: 9px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; } @keyframes spin { to { transform: rotate(360deg); } }
  </style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(instructions)}</p><div class="qr-shell">${qr}</div><p class="status">${escapeHtml(status)}</p><button type="button" onclick="window.close()">${escapeHtml(shellText(locale, 'feishu.close'))}</button></main></body></html>`
}

const managerEnglish = {
  title: 'Feishu connections', intro: 'Save several applications. Connect one at a time.', applications: 'Saved applications', empty: 'No application saved yet. Create one with a QR code below.',
  new: 'Add application', name: 'Local name', workspace: 'Workspace', choose: 'Choose folder', qr: 'Create with QR', manual: 'Existing application (advanced)', generate: 'Generate QR code', cancel: 'Cancel setup', retry: 'Generate a new QR code',
  instructions: 'Scan with Feishu on your phone and confirm app creation. Desktop must receive and save the credentials before setup is complete.', deadline: 'Authorization waiting time remaining',
  'qr.idle': 'Choose a workspace, then generate the QR code.', 'qr.starting': 'Starting secure setup…', 'qr.waiting-for-scan': 'Waiting for phone confirmation…', 'qr.saving': 'Saving protected credentials…',
  'qr.saved': 'Application saved. Select it below to open the connection.', 'qr.expired': 'Authorization timed out. Generate a new QR code.', 'qr.cancelled': 'Setup cancelled; temporary credentials removed.', 'qr.error': 'Setup failed. Check network and platform approval, then retry.',
  save: 'Save application', saveOpen: 'Save and open connection', start: 'Open connection', close: 'Close connection', restart: 'Reconnect', edit: 'Edit', remove: 'Remove locally',
  removeConfirm: 'Remove this local application and its credential? The active connection will close. Feishu apps, workspaces and DSH sessions are not deleted.', auto: 'Connect automatically when Desktop starts',
  platform: 'Open Feishu application console', boundary: 'Closing this window does not close a saved connection. Safe Mode pauses it without changing your choice.', platformHelp: 'Feishu app publication, bot permissions, long-connection event subscription and user availability must be enabled. Desktop cannot bypass organization approval.',
  process: 'Desktop service', channel: 'Feishu channel', dsh: 'DSH tasks', selected: 'Selected application', none: 'None', configured: 'Secret saved', missing: 'Secret not saved', secretHint: 'Leave blank to keep a saved Secret', file: 'Restricted local file (unencrypted)', protected: 'System secure storage',
  reentry: 'Re-enter App Secret once. The old macOS keychain credential will not be accessed.',
  'process.disabled': 'Closed', 'process.stopped': 'Stopped / paused', 'process.starting': 'Starting / retrying', 'process.ready': 'Service started', 'process.degraded': 'Service unstable', 'process.crashed': 'Service failed',
  'channel.unknown': 'Not confirmed', 'channel.connecting': 'Connecting', 'channel.online': 'Online', 'channel.offline': 'Offline',
  'dsh.unknown': 'Not verified by a task', 'dsh.available': 'Task completed successfully', 'dsh.unavailable': 'Task failed', paused: 'Paused in Safe Mode.', notReady: 'Wait for the main workspace to finish starting.',
  'error.credentials': 'Check the robot App ID and Secret.', 'error.permissions': 'Check app publication, permissions and user availability in Feishu.', 'error.network': 'Check your network/proxy, then reconnect.',
  'error.workspace': 'The workspace is unavailable. Choose an existing folder.', 'error.model-key-missing': 'Configure the model API key on the main window Models page. Do not enter it in the robot Secret field.',
  'error.acp': 'DSH could not complete a task. Check the active kernel and Models settings.', 'error.storage': 'Local settings or credential storage failed. Retry; existing records have not been replaced by defaults.',
  'error.sidecar': 'The connection service failed. Reconnect or inspect Desktop logs.', 'error.stop-failed': 'The previous process did not exit. No second connection will start; retry closing it.',
  'error.invalid-input': 'Check name, App ID and settings. Changing App ID requires a replacement Secret.', 'error.invalid-workspace': 'Choose an existing absolute workspace directory.',
  'error.not-found': 'This application no longer exists. Refresh the list.', 'error.duplicate-app-id': 'This App ID is already saved in another record.', 'error.active-application': 'Close the selected application before removing it.',
  'error.not-started': 'Connection was not started. Check the status and guidance above.', 'error.setup': 'Setup failed. Generate a new QR code.', saved: 'Application saved.', removed: 'Local application removed.', closed: 'Connection closed; it will stay closed after restart.',
  detail: 'Message detail', full: 'Full', compact: 'Compact', quiet: 'Quiet', preview: 'Streaming preview', interval: 'Refresh interval', card: 'Card style', legacy: 'Classic', rich: 'Rich card (Card 2.0)', progress: 'Progress display', progressLegacy: 'Separate updates', progressCompact: 'Update one message', progressCard: 'Structured card', quietHelp: 'Compact/quiet omit separate thinking and tool messages. Quiet still sends the final answer.',
}
const managerChinese: Record<keyof typeof managerEnglish, string> = {
  title: '飞书连接管理', intro: '保存多份应用，一次只连接一份。', applications: '已保存应用', empty: '还没有应用。在下方扫码创建，无需手抄 Secret。',
  new: '添加应用', name: '本地名称', workspace: '工作区', choose: '选择目录', qr: '扫码创建', manual: '已有应用（高级）', generate: '生成二维码', cancel: '取消创建', retry: '重新生成二维码',
  instructions: '用手机飞书扫描并确认创建应用。Desktop 收到并保存凭据后才算创建完成。', deadline: '等待授权剩余时间',
  'qr.idle': '选择工作区后生成二维码。', 'qr.starting': '正在启动安全配置…', 'qr.waiting-for-scan': '等待手机确认授权…', 'qr.saving': '正在保存受保护凭据…',
  'qr.saved': '应用已保存，可在下方选择并开启连接。', 'qr.expired': '等待授权已超时，请重新生成二维码。', 'qr.cancelled': '创建已取消，临时凭据已清理。', 'qr.error': '创建未完成，请检查网络与平台审批后重试。',
  save: '保存应用', saveOpen: '保存并开启连接', start: '开启连接', close: '关闭连接', restart: '重新连接', edit: '编辑', remove: '移除本地配置',
  removeConfirm: '移除本地应用和凭据？对应连接会关闭，但不会删除飞书应用、工作区或 DSH 会话。', auto: '启动 Desktop 时自动连接',
  platform: '打开飞书应用管理', boundary: '关闭窗口不等于关闭连接。Safe Mode 只暂停，不改变连接意图。', platformHelp: '请在飞书确认应用发布、机器人权限、长连接事件订阅与可用范围。Desktop 无法绕过组织审批。',
  process: '桌面服务', channel: '飞书通道', dsh: 'DSH 任务', selected: '选中应用', none: '无', configured: 'Secret 已保存', missing: '尚未保存 Secret', secretHint: '留空保留已保存的 Secret', file: '本机受限文件（未加密）', protected: '系统安全存储',
  reentry: '请重新录入一次 App Secret；不会读取旧 macOS 钥匙串凭据。',
  'process.disabled': '已关闭', 'process.stopped': '已停止／暂停', 'process.starting': '启动／重试中', 'process.ready': '服务已启动', 'process.degraded': '服务不稳定', 'process.crashed': '服务失败',
  'channel.unknown': '尚未确认', 'channel.connecting': '连接中', 'channel.online': '在线', 'channel.offline': '离线',
  'dsh.unknown': '尚未通过任务验证', 'dsh.available': '已成功完成任务', 'dsh.unavailable': '任务失败', paused: 'Safe Mode 中已暂停。', notReady: '请等待主工作区启动完成。',
  'error.credentials': '请核对机器人 App ID 与 Secret。', 'error.permissions': '请检查飞书应用发布、权限和用户可用范围。', 'error.network': '请检查网络／代理，然后重连。',
  'error.workspace': '工作区不可用，请选择存在的目录。', 'error.model-key-missing': '请在主窗口 Models 页面配置模型 API key，不要填入机器人 Secret。',
  'error.acp': 'DSH 未能完成任务，请检查当前内核和 Models 设置。', 'error.storage': '本地设置或凭据存储失败，请重试；没有用默认值覆盖旧记录。',
  'error.sidecar': '连接服务失败，请重连或查看 Desktop 日志。', 'error.stop-failed': '旧进程未退出，不会开启第二份连接；请重试关闭。',
  'error.invalid-input': '请检查名称、App ID 和选项；修改 App ID 必须替换 Secret。', 'error.invalid-workspace': '请选择存在的绝对工作区目录。',
  'error.not-found': '应用已不存在，请刷新列表。', 'error.duplicate-app-id': '该 App ID 已保存在另一份记录中。', 'error.active-application': '请先关闭选中应用再移除。',
  'error.not-started': '连接尚未启动，请按上方状态提示处理。', 'error.setup': '创建未完成，请重新生成二维码。', saved: '应用已保存。', removed: '本地应用已移除。', closed: '连接已关闭，重启后仍保持关闭。',
  detail: '消息详细度', full: '完整', compact: '精简', quiet: '静默', preview: '流式预览', interval: '刷新间隔', card: '卡片样式', legacy: '经典', rich: '富卡片（Card 2.0）', progress: '进度展示', progressLegacy: '逐条', progressCompact: '单消息更新', progressCard: '结构化卡片', quietHelp: '精简／静默不逐条发送思考和工具消息；静默仍发送最终答复。',
}

// All dynamic record names/status are assigned through textContent/value. The
// script is hash-authorized; no eval, remote assets or inline event handlers.
const managerScript = String.raw`
const api = window.dshFeishu, copy = JSON.parse(document.getElementById('copy').textContent);
const byId = id => document.getElementById(id), fields = ['name','appId','appSecret','workspace','detail','showStreamPreview','streamPreviewIntervalMs','cardMode','progressStyle'];
let state, edited, dirty = false, busy = false, reading = false, revision = 0, listKey = '', lastSavedQr;
const text = (id, value) => { byId(id).textContent = value || '' };
const defaults = { name: 'Feishu', appId: '', appSecret: '', workspace: '', detail: 'compact', showStreamPreview: true, streamPreviewIntervalMs: 3000, cardMode: 'legacy', progressStyle: 'legacy' };
function fill(application) {
  edited = application?.id; dirty = false;
  const value = { ...defaults, workspace: state?.connection.workspace || '', ...application, appSecret: '' };
  if (![1500,3000,5000].includes(value.streamPreviewIntervalMs)) {
    const option = new Option(value.streamPreviewIntervalMs / 1000 + 's', String(value.streamPreviewIntervalMs));
    byId('streamPreviewIntervalMs').replaceChildren(...[1500,3000,5000].map(n => new Option(n/1000+'s', String(n))), option);
  } else byId('streamPreviewIntervalMs').replaceChildren(...[1500,3000,5000].map(n => new Option(n/1000+'s', String(n))));
  for (const key of fields) key === 'showStreamPreview' ? byId(key).checked = value[key] : byId(key).value = value[key];
  byId('streamPreviewIntervalMs').disabled = !value.showStreamPreview;
  byId('manual').open = !!application;
  byId('appSecret').placeholder = application?.needsSecretReentry ? copy.reentry : copy.secretHint;
}
function values() {
  const input = Object.fromEntries(fields.map(key => [key, key === 'showStreamPreview' ? byId(key).checked : key === 'streamPreviewIntervalMs' ? Number(byId(key).value) : byId(key).value]));
  if (edited) input.id = edited;
  return input;
}
function button(label, action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = action; b.disabled = busy; return b }
function render(next) {
  state = next;
  byId('form').disabled = busy; byId('auto').disabled = busy; byId('new').disabled = busy;
  const selected = state.applications.find(a => a.id === state.activeApplicationId);
  byId('appSecret').placeholder = state.applications.find(a => a.id === edited)?.needsSecretReentry ? copy.reentry : copy.secretHint;
  text('selected', (selected?.name || copy.none));
  text('process', copy['process.' + state.connection.phase]); text('channel', copy['channel.' + state.health.channel]); text('dsh', copy['dsh.' + state.health.dsh]);
  text('guidance', [state.safeMode ? copy.paused : !state.harnessReady ? copy.notReady : '', selected?.needsSecretReentry ? copy.reentry : copy['error.' + state.health.errorCode]].filter(Boolean).join(' '));
  if (!busy) byId('auto').checked = state.autoConnect;
  byId('close').disabled = busy || (!state.enabled && ['disabled','stopped'].includes(state.connection.phase));
  byId('restart').disabled = busy || !state.enabled || !selected?.secretConfigured || state.safeMode || !state.harnessReady;
  const qr = state.qr; text('qr-status', copy['qr.' + qr.stage]);
  byId('qr-image').hidden = !qr.qrDataUrl; if (qr.qrDataUrl) byId('qr-image').src = qr.qrDataUrl; else byId('qr-image').removeAttribute('src');
  text('deadline', qr.expiresAt && ['starting','waiting-for-scan'].includes(qr.stage) ? copy.deadline + ': ' + Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000)) + 's' : '');
  const pending = ['starting','waiting-for-scan','saving'].includes(qr.stage);
  byId('generate').disabled = busy || pending; byId('cancel').disabled = busy || !pending || qr.stage === 'saving';
  byId('generate').textContent = ['expired','cancelled','error'].includes(qr.stage) ? copy.retry : copy.generate;
  if (qr.stage === 'saved' && qr.applicationId !== lastSavedQr) { lastSavedQr = qr.applicationId; if (!dirty) fill(state.applications.find(a => a.id === qr.applicationId)) }
  if (!dirty && edited && !state.applications.some(a => a.id === edited)) fill();
  const key = JSON.stringify([state.applications, state.activeApplicationId, state.connection.phase, state.enabled, state.safeMode, state.harnessReady, busy]);
  if (key === listKey) return; listKey = key;
  byId('applications').replaceChildren();
  if (!state.applications.length) { const p = document.createElement('p'); p.textContent = copy.empty; byId('applications').append(p) }
  for (const app of state.applications) {
    const row = document.createElement('article'); row.dataset.application = app.id;
    const title = document.createElement('strong'); title.textContent = app.name + (app.id === state.activeApplicationId ? ' · ' + copy.selected : '');
    const detail = document.createElement('small'); detail.textContent = app.appId + ' · ' + app.workspace;
    const credential = document.createElement('small'); credential.textContent = app.needsSecretReentry ? copy.reentry : !app.secretConfigured ? copy.missing : copy.configured + ' · ' + (app.credentialProtection === 'safeStorage' ? copy.protected : copy.file);
    const actions = document.createElement('div'); actions.className = 'actions';
    const open = button(copy.start, () => command('start', app.id)); open.disabled = busy || !app.secretConfigured || state.safeMode || !state.harnessReady;
    actions.append(open, button(copy.edit, () => { fill(app); byId('name').focus() }), button(copy.remove, async () => { if (window.confirm(app.name + '\n' + copy.removeConfirm)) { const result = await command('remove', app.id); if (result?.ok) text('message', copy.removed) } }));
    row.append(title, detail, credential, actions); byId('applications').append(row);
  }
}
async function refresh() {
  if (busy || reading) return; reading = true;
  const token = ++revision;
  try { const result = await api.execute('state'); if (token !== revision || busy) return; if (result?.state) render(result.state); else text('guidance', copy['error.storage']) }
  catch { text('guidance', copy['error.storage']) }
  finally { reading = false }
}
async function command(action, input) {
  if (busy) return; busy = true; ++revision; text('message', ''); byId('form').disabled = true; byId('auto').disabled = true;
  if (state) render(state);
  try {
    const result = await api.execute(action, input);
    if (result?.state) render(result.state);
    if (!result?.ok) text('message', copy['error.' + result?.reason] || copy['error.storage']);
    return result;
  } catch { text('message', copy['error.storage']) }
  finally { busy = false; byId('form').disabled = !state; byId('auto').disabled = !state; if (state) render(state) }
}
for (const key of fields) byId(key).addEventListener('input', () => { dirty = true; byId('streamPreviewIntervalMs').disabled = !byId('showStreamPreview').checked });
byId('new').onclick = () => { fill(); byId('name').focus() };
byId('choose').onclick = async () => { if (busy) return; try { const path = await api.pickWorkspace(); if (path) { byId('workspace').value = path; dirty = true } } catch { text('message', copy['error.storage']) } };
byId('generate').onclick = async () => { const { id, appId, appSecret, ...input } = values(); if ((await command('qr-start', input))?.ok) dirty = false };
byId('cancel').onclick = () => command('qr-cancel'); byId('close').onclick = async () => { if ((await command('close'))?.ok) text('message', copy.closed) };
byId('restart').onclick = () => command('restart'); byId('auto').onchange = () => command('auto-connect', byId('auto').checked);
async function save(open) {
  const input = values(), result = await command('save', input);
  if (!result?.ok) return;
  const app = result.state.applications.find(a => a.id === input.id || (!input.id && a.appId === input.appId.trim()));
  fill(app); text('message', copy.saved);
  if (open && app) await command('start', app.id);
}
byId('save').onclick = () => save(false); byId('save-open').onclick = () => save(true);
byId('platform').onclick = () => api.openPlatform().catch(() => text('message', copy['error.setup']));
fill(); refresh(); const poll = setInterval(refresh, 1000); window.addEventListener('pagehide', () => clearInterval(poll));
`

export function feishuManagerPageMarkup(locale: ShellLocale): string {
  const copy = locale === 'zh' ? managerChinese : managerEnglish
  const label = (key: keyof typeof managerEnglish) => escapeHtml(copy[key])
  const select = (id: string, key: keyof typeof managerEnglish, values: [string, keyof typeof managerEnglish][]) =>
    `<label>${label(key)}<select id="${id}">${values.map(([value, title]) => `<option value="${value}">${label(title)}</option>`).join('')}</select></label>`
  const hash = createHash('sha256').update(managerScript).digest('base64')
  return `<!doctype html><html lang="${locale === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'sha256-${hash}'; base-uri 'none'; form-action 'none'; frame-src 'none'"><title>${label('title')}</title><style>
    :root{color-scheme:light dark;--bg:#f6f7fb;--panel:#fff;--text:#1e2230;--muted:#606878;--line:#e3e6ef;--accent:#4d6bfe}
    @media(prefers-color-scheme:dark){:root{--bg:#0f1117;--panel:#191c24;--text:#f5f6fa;--muted:#adb3c2;--line:#303542;--accent:#8195ff}}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif}main{max-width:900px;margin:auto;padding:24px}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 12px}p,small{color:var(--muted)}small{display:block;overflow-wrap:anywhere}section{margin-top:20px;padding:18px;background:var(--panel);border:1px solid var(--line);border-radius:12px}.health{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.health strong{display:block}button,input,select{font:inherit}button{padding:7px 12px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--text);cursor:pointer}button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}button:disabled{opacity:.45;cursor:default}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.heading{display:flex;justify-content:space-between;align-items:center;gap:12px}article{padding:14px 0;border-top:1px solid var(--line)}article small:first-of-type{font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px}fieldset{padding:0;margin:0;border:0;min-width:0}label{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:10px 0}input:not([type=checkbox]),select{width:60%;min-width:0;padding:7px;border:1px solid var(--line);border-radius:6px;color:var(--text);background:var(--bg)}.workspace{display:flex;width:60%;gap:8px}.workspace input{flex:1}input[type=checkbox]{accent-color:var(--accent)}summary{cursor:pointer;font-weight:600;margin:12px 0}img.qr{display:block;background:white;width:220px;height:220px;object-fit:contain;border:12px solid white;margin:16px auto}.qr[hidden]{display:none}#guidance,#message{overflow-wrap:anywhere}#message{min-height:24px}@media(max-width:620px){main{padding:16px}.health{gap:8px;font-size:12px}}
    </style></head><body><main><h1>${label('title')}</h1><p>${label('intro')}</p>
    <section aria-label="${label('process')}"><small>${label('selected')}</small><strong id="selected"></strong><div class="health"><div>${label('process')}<strong id="process"></strong></div><div>${label('channel')}<strong id="channel"></strong></div><div>${label('dsh')}<strong id="dsh"></strong></div></div><p id="guidance" role="status"></p><label>${label('auto')}<input id="auto" type="checkbox" disabled></label><div class="actions"><button id="close">${label('close')}</button><button id="restart">${label('restart')}</button></div><small>${label('boundary')}</small></section>
    <section><div class="heading"><h2>${label('applications')}</h2><button id="new">${label('new')}</button></div><div id="applications"></div></section>
    <section><h2>${label('qr')}</h2><fieldset id="form" disabled><label>${label('name')}<input id="name" maxlength="120" autocomplete="off"></label><label>${label('workspace')}<span class="workspace"><input id="workspace" readonly aria-label="${label('workspace')}"><button id="choose" type="button">${label('choose')}</button></span></label><p>${label('instructions')}</p><img id="qr-image" class="qr" alt="${label('qr')}" hidden><p id="qr-status" role="status"></p><small id="deadline"></small><div class="actions"><button id="generate" class="primary" type="button">${label('generate')}</button><button id="cancel" type="button">${label('cancel')}</button></div>
    <details id="manual"><summary>${label('manual')}</summary><label>App ID<input id="appId" maxlength="200" autocomplete="off"></label><label>App Secret<input id="appSecret" type="password" autocomplete="new-password" placeholder="${label('secretHint')}"></label>
    ${select('detail','detail',[['full','full'],['compact','compact'],['quiet','quiet']])}<label>${label('preview')}<input id="showStreamPreview" type="checkbox"></label><label>${label('interval')}<select id="streamPreviewIntervalMs"><option value="1500">1.5s</option><option value="3000">3s</option><option value="5000">5s</option></select></label>
    ${select('cardMode','card',[['legacy','legacy'],['rich','rich']])}${select('progressStyle','progress',[['legacy','progressLegacy'],['compact','progressCompact'],['card','progressCard']])}<small>${label('quietHelp')}</small><div class="actions"><button id="save" type="button">${label('save')}</button><button id="save-open" class="primary" type="button">${label('saveOpen')}</button></div></details></fieldset><p id="message" role="status"></p><small>${label('platformHelp')}</small><button id="platform" type="button">${label('platform')}</button></section>
    </main><script id="copy" type="application/json">${JSON.stringify(copy).replaceAll('<', '\u003c')}</script><script>${managerScript}</script></body></html>`
}
