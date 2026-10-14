# 0038: Closing the main window quits the application

- Date: 2026-10-14
- Status: Accepted; supersedes the close-to-tray clause in ADR 0006.
- 中文：[0038](0038-close-main-window-quits.zh.md)

The user expects closing the main window to stop the application, not silently
leave its agent and messaging services running. Main-window close therefore
calls the existing application quit path, including when auxiliary windows are
open. Minimize, explicit startup-hidden preferences and second-instance focus
remain unchanged; closing a Feishu manager or pairing window is not app quit.

Quit stops the messaging sidecar, Harness, LAN service and managed runtimes,
preserves their saved configuration and allows bounded process shutdown. A
running task may be interrupted; the window must not imply that it closed while
work secretly continues. No optional close-to-tray switch is added. Legacy
`closeToTrayExplained` preferences are tolerated but have no effect on closing.
