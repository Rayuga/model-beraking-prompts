#!/usr/bin/env bash
# Thin Harbor verifier entrypoint — all logic lives in test.py.
# Writes /logs/verifier/reward.json + /logs/verifier/report.json.
#
# Do NOT use `set -e` here: we need the fallback block below to run even when
# python3 exits non-zero.  Do NOT use `exec`: we need code after python3.
set -uo pipefail
cd "$(dirname "$0")" || true
python3 test.py
_EXIT=$?
# Belt-and-suspenders: if test.py crashed before writing a reward file
# (OOM, SIGKILL, Python import error, missing interpreter) write a 0.0
# placeholder so Harbor always receives a reward file.
_LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
if [[ ! -f "${_LOG_DIR}/reward.txt" ]]; then
    mkdir -p "${_LOG_DIR}"
    printf '0.0\n' > "${_LOG_DIR}/reward.txt"
    printf '{"reward":0.0,"error":"verifier crashed before writing reward"}\n' \
        > "${_LOG_DIR}/reward.json"
fi
exit "${_EXIT}"
