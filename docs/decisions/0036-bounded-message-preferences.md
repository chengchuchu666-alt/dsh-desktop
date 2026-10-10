# 0036: Bounded message preferences with quieter legacy defaults

- Date: 2026-10-11
- Status: Accepted
- 中文：[0036](0036-bounded-message-preferences.zh.md)

The shell omitted cc-connect display tables, so legacy files inherited full thinking/tool messages and
1500ms previews. Missing fields now resolve to compact, preview enabled at 3000ms, classic cards and
legacy progress. This deliberately changes legacy defaults without rewriting credentials or requiring
users to edit TOML; explicit saved preferences survive subsequent legacy/QR calls that omit the fields.

Only enumerated detail/card/progress, a boolean preview and a bounded integer interval are exposed.
Quiet suppresses separate thinking/tool messages but preserves final answers, errors and permission
prompts; it is not a capability restriction or a connection switch. A root preview table and per-project
display table remain part of one fixed project/platform, not a free-text configuration surface. Saved
application records must carry these preferences unchanged when application management is added.

We accept a slower preview in exchange for less Feishu message churn; full and faster supported intervals
remain explicit user choices. Classic cards/progress stay the default to avoid a concurrent rendering
compatibility change. Secret storage, sender authorization, Safe Mode and lifecycle rules remain separate.
Real loader/IPC/UI tests verify the contract; visual/message-count claims still require controlled Feishu QA.
