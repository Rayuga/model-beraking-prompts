#!/usr/bin/env bash
# Thin Harbor verifier entrypoint. Keep the shell alive so its EXIT trap can
# restore the reward floor if Python or the browser judge crashes.
set -euo pipefail
cd "$(dirname "$0")"

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
mkdir -p "$LOG_DIR"

_ensure_reward() {
  [[ -s "$LOG_DIR/reward.txt" ]] || printf '0.0\n' > "$LOG_DIR/reward.txt"
  [[ -s "$LOG_DIR/reward.json" ]] || \
    printf '{"reward":0.0,"browser_score":0.0,"graded":0,"no_op":1}\n' \
      > "$LOG_DIR/reward.json"
}

_ensure_reward
trap _ensure_reward EXIT
python3 test.py
