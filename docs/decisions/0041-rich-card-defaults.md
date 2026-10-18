# 0041: Rich Card 2.0 cards and structured progress as the display defaults

- Date: 2026-10-18
- Status: Accepted
- 中文：[0041](0041-rich-card-defaults.zh.md)

ADR 0036 chose classic (`legacy`) cards and per-message (`legacy`) progress as the defaults for missing
display fields, explicitly to avoid a concurrent rendering-compatibility change while the preference
surface itself was new. The sidecar has since implemented both richer modes, and a controlled
user-level run (hand-edited `applications.json` / `config.toml` on the maintainer's machine, 2026-10-17)
confirmed that they load and render: the on-disk `config.toml` matched
`renderConnectToml({ cardMode: 'rich', progressStyle: 'card' })` byte for byte, and cc-connect's own
loader accepted `card_mode: legacy|rich` and `progress_style: legacy|compact|card`.

New connections, and legacy `settings.json` files that lack the fields, now resolve to
`cardMode: 'rich'` (Feishu Card 2.0 streaming rich card) and `progressStyle: 'card'` (structured progress
card), aligning the desktop shell with the zcode Feishu bot's `replyMode="streaming_card"`. The change
lives in the single `CONNECT_DISPLAY_DEFAULTS` constant plus the two UI fallbacks, so
`normalizeConnectSettings`, `renderConnectToml`, the Feishu manager window and the plugin settings form
all follow without new branches.

Explicitly saved `legacy` preferences are preserved. The enum checks in `normalizeConnectSettings` still
run before the fallback, so a user who chose classic cards keeps them, and no settings file is rewritten
by reading it. Credential storage, Safe Mode, the start/stop and restart budgets, the rendered TOML's
field order, the single global `[stream_preview]` table, the `[projects.display]` ownership and the
`${DSH_CC_CONNECT_FEISHU_SECRET}` placeholder are all untouched.

Consequences: users on the default get Card 2.0 rich cards with a structured progress card — fewer
separate messages and richer rendering — which is a visible behaviour change for new connections. The
quieter `compact` detail and 3000ms preview from 0036 still apply, so this narrows rather than reverses
0036. Rollback is one constant, or the user's own explicit `legacy` choice. Alternatives considered:
keeping `legacy` until a major release (rejected: the sidecar already supports both enums, the maintainer's
own connection and the zcode bot already run the rich mode, and the compatibility risk 0036 deferred has
since been retired); changing the default only for new applications while legacy files stay classic
(rejected: two divergent meanings for the same missing field is the ambiguity 0036 removed); forcing
`rich` for everyone including explicit `legacy` users (rejected: it would overwrite a user's saved
choice).

Verification: unit tests assert the fallback, the preserved explicit choice and the rendered enum values;
the real cc-connect loader test re-parses all 18 detail/card/progress combinations plus the default TOML
through the Go loader; the packaged E2E asserts the default state and the on-disk TOML. These gates send
no real Feishu message, and visual/message-count claims still require controlled Feishu QA.
