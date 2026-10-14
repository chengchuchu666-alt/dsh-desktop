# 0039: macOS Feishu credentials use restricted files without keychain access

- Date: 2026-10-14
- Status: Accepted; supersedes ADR 0033's protected-storage preference on macOS only.
- 中文：[0039](0039-macos-file-credentials.zh.md)

The current macOS distribution is ad-hoc signed: its designated requirement
contains the build cdhash, so updates can invalidate previous keychain approval.
The user explicitly prefers no keychain prompts over OS encryption for Feishu
App Secrets. macOS therefore writes plaintext credential files with mode 0600,
without calling even safeStorage availability checks. Windows keeps DPAPI;
Linux keeps its existing policy. File permissions are not encryption and do
not protect from other programs running as the same user or from administrators.
On Windows, POSIX mode 0600 alone does not establish an owner-only ACL.

Old macOS encrypted documents are retained and classified as requiring Secret
re-entry. No implicit decryption/migration occurs at boot, reconnect or resume;
no process starts or retries with an unusable credential. A successful explicit
save replaces the old revision through the existing atomic transaction. The
UI distinguishes missing, legacy-needs-reentry, plaintext-file and protected
credentials, and never receives Secret values.

This does not alter signing or use a mock-keychain/test password. Read-only
inspection of the installed Electron binary confirmed cookie encryption is
disabled; a Cookies file alone is not evidence of a second keychain caller.
Acceptance still requires isolated cold starts and cross-build checks, not
source-only assertions or interaction with the user's real keychain.
