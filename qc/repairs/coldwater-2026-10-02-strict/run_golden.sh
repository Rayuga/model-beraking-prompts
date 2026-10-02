#!/bin/bash
# Rebuild the golden bundle, install it into a clean agent-image container with
# the task's own solve.sh, and run every scripted criterion check against it.
# The app is restarted for real (process replaced, same database) between the
# two persistence phases.
#   usage: run_golden.sh <scratch-build-dir> [suite ...]
set -uo pipefail
export MSYS_NO_PATHCONV=1

here="$(cd -- "$(dirname -- "$0")" && pwd -W 2>/dev/null || pwd -P)"
root="$(cd -- "$here/../../.." && pwd -W 2>/dev/null || pwd -P)"
work="${1:?scratch build directory required}"; shift
suites=("$@"); [ ${#suites[@]} -eq 0 ] && suites=(editor runtime persist polish)
app_image="${CW_AGENT_IMAGE:-cw-editor-agent-r3}"
browser_image="${CW_VERIFIER_IMAGE:-cw-editor-verifier:current}"
name=cw-strict-app
out="$here/results"; mkdir -p "$out"

bash "$root/scripts/build_colderwater_golden.sh" "$work" > "$out/build.log" 2>&1 || { tail -20 "$out/build.log"; exit 1; }

docker rm -f "$name" > /dev/null 2>&1
docker run -d --name "$name" --entrypoint sleep -v "$root/projects/colderwater-playground-devtools/solution:/solution:ro" "$app_image" infinity > /dev/null
docker exec "$name" bash /solution/solve.sh || exit 1
start_app() { docker exec -d "$name" bash -c 'cd / && exec node /app/server.js >> /tmp/app.log 2>&1'; sleep 2; }
app_pid() { docker exec "$name" pgrep -x node | head -1; }
browser() { docker run --rm --network "container:$name" --entrypoint node -v "$here/tests:/t:ro" -v "$out:/state" "$browser_image" "$@"; }
start_app

status=0
for suite in "${suites[@]}"; do
  if [ "$suite" = persist ]; then
    browser /t/persist.cjs before > "$out/persist-before.json" 2>&1 || status=1
    before="$(app_pid)"; docker exec "$name" pkill -x node; sleep 1; start_app; after="$(app_pid)"
    echo "{\"restart\":{\"pid_before\":\"$before\",\"pid_after\":\"$after\"}}" > "$out/restart.log"
    browser /t/persist.cjs after > "$out/persist-after.json" 2>&1 || status=1
    cat "$out/persist-before.json" "$out/restart.log" "$out/persist-after.json"
  else
    browser "/t/$suite.cjs" > "$out/$suite.json" 2>&1 || status=1
    cat "$out/$suite.json"
  fi
done
exit $status
