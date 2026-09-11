#!/usr/bin/env bash
# Container entrypoint.
#
# The plant-network vendor desks are part of the environment, not part of
# scoring. They come up with the container so they are reachable during the
# build phase as well as while the product is being demonstrated — the brief
# tells the till to ask the desks what they accept rather than guessing, and
# that is only true if the desks are actually answering while the till is
# being built.
#
# They are supervised rather than started once. A desk that exits — killed by
# the agent's own port sweep, or by anything else in a long build — is brought
# straight back, because a till built against a dead desk looks to its author
# like a product bug.
set -uo pipefail

VENDOR_PORT="${VENDOR_PORT:-3101}"
VENDOR_SCRIPT="${VENDOR_SCRIPT:-/opt/drawbill-vendors/desks.js}"
LOG_DIR="/var/log/drawbill"
mkdir -p "$LOG_DIR"

supervise_vendors() {
    while true; do
        VENDOR_PORT="$VENDOR_PORT" node "$VENDOR_SCRIPT" \
            >>"$LOG_DIR/vendors.stdout.log" 2>>"$LOG_DIR/vendors.stderr.log"
        echo "[entrypoint] plant vendor desks exited; restarting" \
            >>"$LOG_DIR/vendors.stderr.log"
        sleep 1
    done
}

if [[ -f "$VENDOR_SCRIPT" ]]; then
    echo "[entrypoint] starting plant vendor desks on ${VENDOR_PORT}"
    supervise_vendors &
    echo $! > "$LOG_DIR/vendors.pid"

    for _ in $(seq 1 40); do
        if curl -fsS "http://127.0.0.1:${VENDOR_PORT}/health" >/dev/null 2>&1; then
            echo "[entrypoint] plant vendor desks healthy on ${VENDOR_PORT}"
            break
        fi
        sleep 0.25
    done
else
    echo "[entrypoint] WARNING: no vendor script at ${VENDOR_SCRIPT}" >&2
fi

exec sleep infinity
