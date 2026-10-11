---
name: feishu-dsh-setup
description: Configure DSH Desktop Feishu bot connections through its QR application manager, or install official Lark CLI skills and user OAuth when user-identity operations are requested. Keep the two authentication paths separate.
---

# Feishu/Lark setup for dsh-desktop

## Desktop message connections

Use Settings → Desktop settings → Feishu message connection → Manage applications /
create with QR, or Desktop tools → Manage Feishu connections. Both open the same
restricted application manager; no global CLI installation is required.

Choose an existing workspace, name the application and generate a QR. Wait for
Desktop to report **Application saved**, not just the phone's success message.
Then explicitly open the saved connection. Saving another app does not switch
the current app. Existing bot credentials can be entered once in the advanced
form; never read a Secret back into the page.

Report service started, channel online and task completion separately. Missing
model credentials belong in the main window Models/credentials service, not the
robot Secret. Approval, bot permissions, event subscriptions and app publication
remain Feishu platform requirements. See `docs/cc-connect.md` for troubleshooting.

Compact + 3s preview is the quiet default; edit detail, preview, card and progress
preferences per application. Closing the manager is not closing the connection;
explicit Close persists across relaunch. Safe Mode only pauses the connection.
Remove locally requires confirmation and clears only local settings/credentials,
not remote apps, workspaces, DSH sessions or chat data.

For a real end-to-end check, use an authorized test application and conversation.
Obtain explicit authorization to send messages; opening/saving never sends a test.
Use isolated userData/DSH_HOME with permission-preserving copies of authorized
credentials, clean temporary copies/processes afterward, and report actual
observations. Do not declare credentials missing merely because env vars are empty.

## Official CLI skills and user OAuth

When the user requests user-identity operations/skills, use the repository
one-click entry from an interactive terminal:

```bash
pnpm run feishu:setup
```

It delegates to the official `@larksuite/cli` installer. The installer creates
the official Feishu skills and interactively configures the CLI app and user
OAuth. A browser or phone confirmation may be required.

Verify the user-facing CLI setup without printing credentials:

```bash
lark-cli whoami
lark-cli doctor
```

Keep the two authentication paths separate:

- `lark-cli` is user identity plus Feishu skills for AI-agent operations.
- `cc-connect feishu setup` is the Feishu bot identity used by DSH Desktop
  message routing; prefer the Desktop application manager described above.

Never put an App Secret, token, or OAuth credential in a command transcript,
repository file, test fixture, or log. Do not edit real `~/.dsh`,
`~/.dsh-desktop`, or `~/.cc-connect` while validating this workflow.
