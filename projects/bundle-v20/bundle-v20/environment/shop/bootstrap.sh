#!/bin/bash
# Foreground bring-up helper (local debugging). Production images use entrypoint.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=network.sh
source "$SCRIPT_DIR/network.sh"
ensure_shop_network
exec sleep infinity
