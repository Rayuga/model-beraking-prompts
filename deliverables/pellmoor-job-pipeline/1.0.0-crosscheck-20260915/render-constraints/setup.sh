#!/bin/bash
set -euo pipefail
mkdir -p /app /recruitment/records
cp /source/tests/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json
bash /source/solution/solve.sh
node /evidence/mcp-gate-check.cjs
