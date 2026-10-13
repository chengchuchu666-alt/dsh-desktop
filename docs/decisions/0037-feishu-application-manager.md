# 0037: One Feishu application manager with persistent intent and layered health

- Date: 2026-10-11
- Status: Accepted
- 中文：[0037](0037-feishu-application-manager.zh.md)

## Context and decision

ADR 0033 limited integration to settings. The shipped native QR menu and the requested
application lifecycle now need a single, revisitable manager, opened from settings and
the native menu. This decision supersedes only that entry restriction, not the ownership,
credential or one-platform boundaries. DSH remains the Agent/session authority; Desktop
owns local application records and supervises exactly one selected cc-connect Sidecar.

Save several named local applications, each with its workspace and ADR 0036 display
preferences. Credentials use per-record protected storage, never the application list,
TOML, renderer state or diagnostic output. Duplicate App IDs update one record. Saving
another record does not replace the live application. Switching is serialized: stop the
old process successfully before selecting/starting another. Removal requires confirmation
and stops the selected process first; it removes only the exact local record/credential,
never a remote Feishu application, workspace or DSH session.

`enabled` is persistent connection intent; `autoConnect` controls Desktop startup only.
Explicit close saves `enabled=false` before stopping. A failed stop reports the still-live
process/error honestly; it must not allow a second process. Window closure leaves intent
unchanged (but cancels an unfinished QR run). Safe Mode pauses without rewriting intent;
exit resumes if still enabled, regardless of startup-only `autoConnect`. Quit also preserves
intent. Legacy enabled settings migrate with autoConnect enabled, retaining credentials
and all display preferences. Saving, opening the manager and read-only health checks do
not send test messages or silently connect a different application.

QR creation is the default path with expiry, cancel and retry; manual credentials are an
advanced fallback. Phone approval, receipt of credentials, protected local save, process
initialization, Feishu channel connectivity and DSH task availability are separate facts.
`cc-connect ready` proves only process initialization. Channel health needs a defined
structured event; absent evidence stays unknown. DSH errors (including missing model keys)
are distinct from robot credentials, with guidance to the existing Models/credentials
service. Only a successful user-initiated round trip earns a verification timestamp, not
a permanent availability promise. Lark CLI user OAuth/skills are a separate chain and are
not prerequisites for Desktop QR setup.

The manager has a separate restricted preload: connection operations only, exact owned
webContents, exact loaded page and top frame. Main Harness IPC guards/CSP are not widened.
The settings card and native menu share the same main-process controller/state.

## Consequences and alternatives

- A schema migration and serialized lifecycle cost more than extending the single form,
  but avoid accidental application replacement and reconnection after explicit close.
- Reject treating process readiness or arbitrary log text as “connected”; unknown health
  is less convenient but does not claim unverified messaging/model readiness.
- Reject concurrent bots, multi-platform/project routing, a generic cc-connect management
  API and free-form TOML. The saved list is local configuration, not another Agent UI.
- FS-01 records the contract; storage, lifecycle and UI must pass FS-02–FS-04 and QA-01
  before this ADR's target is considered shipped.
