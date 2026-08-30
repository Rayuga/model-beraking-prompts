#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")" || true
python3 test.py
_EXIT=$?
_LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
if [[ ! -f "${_LOG_DIR}/reward.txt" ]]; then
  mkdir -p "${_LOG_DIR}"
  printf '0.0\n' > "${_LOG_DIR}/reward.txt"
  printf '{"reward":0.0,"diagnostic_score":0.0,"preflight_passed":0,"checks_passed":0,"checks_failed":1}\n' > "${_LOG_DIR}/reward.json"
  printf '{"results":{"tool":{"name":"dropline-deterministic-playwright","version":"2.0.0"},"summary":{"tests":1,"passed":0,"failed":1,"pending":0,"skipped":0,"other":0},"tests":[{"name":"verifier_startup","status":"failed","message":"verifier crashed before writing reward"}]}}\n' > "${_LOG_DIR}/ctrf.json"
fi
exit "${_EXIT}"
