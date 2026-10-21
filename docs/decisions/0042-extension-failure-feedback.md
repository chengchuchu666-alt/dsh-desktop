# 0042: Every extension action surfaces its failure where it was triggered

- Date: 2026-10-21
- Status: Accepted
- 中文：[0042](0042-extension-failure-feedback.zh.md)

An audit of the shell's extension entry points (#124-#127) found four instances of the same defect: a
failure had no user-perceivable path. The Feishu manager wrote validation errors into a single
page-bottom `#message` node, far from the button that was clicked; the desktop-tools panel's `invoke()`
only acted on `=== true` and silently ignored `false` and rejected promises; the native workspace picker
collapsed "cancelled" and "unusable directory" into one `null`; and menu/tray callbacks were typed
`void`, so rejected `shell.openExternal` calls and failed LAN/restart actions died in the console.

Every extension surface now owns exactly one visible failure channel, rendered next to the action:

- The desktop-tools panel keeps one `role="alert"` status line (`data-dsh-controls-error`) fed by a
  normalized `invoke()`/`openConnectManager()` that reports both non-`true` results and rejections.
- The Feishu manager shows an empty workspace at the field (`#workspace-error`, `aria-invalid`, focus
  moved to the input) and refuses to call IPC at all; the settings form mirrors the same error next to
  the workspace row.
- The native workspace picker returns a discriminated `WorkspacePickResult`
  (`{canceled:true}` / `{canceled:false, workspace}` / `{canceled:false, reason:'invalid-workspace'}`),
  so cancel stays silent while an unusable directory is explainable.
- Menu and tray actions run through `guardShellAction`, which reports throws and explicit `false`
  results as a native notification (falling back to an error dialog) plus a structured `console.warn`.

Rejected alternatives: converting `desktopAction` to a global `{ok, reason}` object in one step (large
blast radius across preload, IPC and packaged E2E for no additional user-visible benefit; the panel
normalizes at the call site instead); keeping `boolean` results without handling `false` (that is the
defect); adding a full toast framework (a single status line per surface is enough and stays testable).

Consequences: clicking an extension action can no longer "do nothing". The trade-off is that menu/tray
failures raise OS notifications, which are best-effort — a disabled notification centre still has the
log line as the durable record. Tests assert the panel status node and rejection branch, the manager
field error and its pre-IPC guard, the picker contract in both the preload and main handler, and the
`guardShellAction` wiring. Visual quality of the native notification and real Feishu rendering remain
manual acceptance items.
