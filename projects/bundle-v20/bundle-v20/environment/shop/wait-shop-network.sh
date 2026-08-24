#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=network.sh
source "$SCRIPT_DIR/network.sh"
ensure_shop_network
echo "[wait-shop-network] Postgres and vendor desks are ready"
