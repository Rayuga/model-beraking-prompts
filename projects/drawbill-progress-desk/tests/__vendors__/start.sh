#!/usr/bin/env bash
# Plant-network desks for grading. Not the DrawBill app (that is npm start /
# src/index.js).
#
# Supervised rather than exec'd: grading restarts the submission between judge
# groups and sweeps stray processes, and a judge session that finds the desks
# gone would score desk questions the submission did in fact ask. If the desk
# process ever exits, it comes straight back on the same port.
set -uo pipefail

VENDOR_PORT="${VENDOR_PORT:-3101}"
VENDOR_SCRIPT="${VENDOR_SCRIPT:-/opt/drawbill-plant}"

while true; do
    VENDOR_PORT="$VENDOR_PORT" node "$VENDOR_SCRIPT"
    echo "plant vendor desks exited; restarting on ${VENDOR_PORT}" >&2
    sleep 1
done
