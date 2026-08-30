#!/usr/bin/env bash
# Harbor verifier entrypoint. exec so signals reach python directly; no trap
# before exec (a trap there would never fire).
set -uo pipefail
mkdir -p /logs/verifier
exec python3 "$(dirname "$0")/test.py"
