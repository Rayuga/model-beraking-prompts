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
# Key on BOTH files, and never overwrite a reward.json that already parses to a
# real score. Harbor reads reward.json first, so clobbering a good one with a 0.0
# placeholder would turn a graded run into a silent zero. Writing only the file
# that is actually missing keeps this a floor rather than a ceiling.
_LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
mkdir -p "${_LOG_DIR}"
_have_json=0
if [[ -s "${_LOG_DIR}/reward.json" ]] \
   && python3 -c "import json,sys; json.load(open(sys.argv[1]))['reward']" \
        "${_LOG_DIR}/reward.json" 2>/dev/null; then
    _have_json=1
fi
if [[ "${_have_json}" -eq 0 ]]; then
    printf '{"reward":0.0,"error":"verifier crashed before writing reward"}\n' \
        > "${_LOG_DIR}/reward.json"
fi
if [[ ! -s "${_LOG_DIR}/reward.txt" ]]; then
    if [[ "${_have_json}" -eq 1 ]]; then
        python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['reward'])" \
            "${_LOG_DIR}/reward.json" > "${_LOG_DIR}/reward.txt" 2>/dev/null \
            || printf '0.0\n' > "${_LOG_DIR}/reward.txt"
    else
        printf '0.0\n' > "${_LOG_DIR}/reward.txt"
    fi
fi
exit "${_EXIT}"
