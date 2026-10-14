# 0040: Host quit preempts pending connection startup

- Date: 2026-10-14
- Status: Accepted; supplements ADR 0038 and the lifecycle authority in 0037.
- 中文：[0040](0040-terminal-shutdown-preempts-start.zh.md)

A real Electron regression reproduced an orphan sidecar: normal pause queued
behind a connection's readiness wait, while the host's 8-second quit guard
exited first. Host quit now uses a terminal shutdown that immediately stops an
owned process, refuses later starts and stops late factories before startup.
Stop calls are deduplicated; the serialized tail is drained. Saved connection
intent is retained. Safe Mode and ordinary restart keep their existing policy.

Independent host services stop concurrently with allSettled: one failure must
not skip Web Harness or secondary runtimes, and sequential five-second grace
periods must not exceed the existing absolute quit budget. Repeated Quit is
held until cleanup completes or the guard expires. Tests assert real PID
disappearance, pending-start cancellation, late-factory disposal and attempts
to stop every service even when one rejects, rather than only window visibility.
