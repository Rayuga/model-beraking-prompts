#!/bin/bash
# Start Postgres + vendor desks in the background. Never fail sandbox boot —
# Daytona/Harbor treat a crashing CMD/entrypoint as BUILD_FAILED.
set -uo pipefail

BOOT_LOG="/var/log/gearvault-shop-boot.log"
mkdir -p "$(dirname "$BOOT_LOG")"

if [[ -r /opt/gearvault-shop/network.sh ]]; then
  (
    # shellcheck source=/dev/null
    source /opt/gearvault-shop/network.sh
    ensure_shop_network
  ) >>"$BOOT_LOG" 2>&1 &
fi

exec "$@"
