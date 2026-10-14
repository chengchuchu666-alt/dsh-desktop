#!/bin/sh
# Use only under a private xvfb-run display, never replace a user's WM.
set -eu
case "$(xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null || true)" in
  *'window id #'*) echo 'Expected a fresh Xvfb display without an existing window manager' >&2; exit 1 ;;
esac
openbox >/dev/null 2>&1 &
dsh_e2e_wm_pid=$!
trap 'kill "$dsh_e2e_wm_pid" 2>/dev/null || true; wait "$dsh_e2e_wm_pid" 2>/dev/null || true' EXIT
dsh_e2e_wm_ready=false
dsh_e2e_wm_attempt=0
while [ "$dsh_e2e_wm_attempt" -lt 100 ]; do
  kill -0 "$dsh_e2e_wm_pid" 2>/dev/null || { echo 'Test window manager exited before readiness' >&2; exit 1; }
  case "$(xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null || true)" in
    *'window id #'*) dsh_e2e_wm_ready=true; break ;;
  esac
  dsh_e2e_wm_attempt=$((dsh_e2e_wm_attempt + 1))
  sleep 0.1
done
[ "$dsh_e2e_wm_ready" = true ] || { echo 'Test window manager readiness timed out' >&2; exit 1; }
node scripts/run-e2e-guarded.mjs "$@"
