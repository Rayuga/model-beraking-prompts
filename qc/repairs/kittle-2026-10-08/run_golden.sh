#!/bin/bash
# Install the Kittle golden into a clean agent-image container with the task's own
# solve.sh, launch it the way tests/test.sh does, run the scripted criterion checks,
# restart the process for real (same database), then run the after-restart checks.
#   usage: run_golden.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1

here="$(cd -- "$(dirname -- "$0")" && pwd -W 2>/dev/null || pwd -P)"
root="$(cd -- "$here/../../.." && pwd -W 2>/dev/null || pwd -P)"
app_image="${KT_AGENT_IMAGE:-cw-editor-agent-r3}"
browser_image="${KT_VERIFIER_IMAGE:-cw-editor-verifier:current}"
name=kt-golden-harness
out="$here/results"; mkdir -p "$out"; rm -f "$out"/*.json

docker rm -f "$name" > /dev/null 2>&1
docker run -d --name "$name" --entrypoint sleep -v "$root/projects/kittle-matter-chat/solution:/solution:ro" -v "$root/projects/kittle-matter-chat/environment/assets:/assets:ro" "$app_image" infinity > /dev/null
docker exec "$name" bash /solution/solve.sh || exit 1
docker exec "$name" chown -R 65534:65534 /app
start_app() { docker exec -d "$name" bash -c 'cd /tmp && exec setsid env -i PATH=/usr/local/bin:/usr/bin:/bin NODE_PATH=/usr/local/lib/node_modules HOME=/app PORT=3000 DB_PATH=/app/app.db setpriv --reuid=65534 --regid=65534 --clear-groups node /app/server.js >> /tmp/app.log 2>&1'; sleep 2; }
browser() { docker run --rm --network "container:$name" --entrypoint node -v "$here/tests:/t:ro" -v "$out:/state" "$browser_image" "$@"; }
start_app

status=0
browser /t/functional.cjs before || status=1
old_pid=$(docker exec "$name" pgrep -n -x node)
docker exec "$name" kill "$old_pid"; sleep 1
start_app
new_pid=$(docker exec "$name" pgrep -n -x node)
echo "{\"old_pid\": \"$old_pid\", \"new_pid\": \"$new_pid\"}" > "$out/restart-pids.json"
browser /t/functional.cjs after || status=1
docker exec "$name" tail -5 /tmp/app.log
docker rm -f "$name" > /dev/null 2>&1
exit $status
