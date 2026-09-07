#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")" || true

_LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
mkdir -p "${_LOG_DIR}"
printf '0.0\n' > "${_LOG_DIR}/reward.txt"
printf '{"reward":0.0,"error":"verifier did not complete"}\n' \
    > "${_LOG_DIR}/reward.json"

python3 test.py
_EXIT=$?
if [[ ! -f "${_LOG_DIR}/reward.txt" ]]; then
    mkdir -p "${_LOG_DIR}"
    printf '0.0\n' > "${_LOG_DIR}/reward.txt"
    printf '{"reward":0.0,"error":"verifier crashed before writing reward"}\n' \
        > "${_LOG_DIR}/reward.json"
fi
exit "${_EXIT}"
