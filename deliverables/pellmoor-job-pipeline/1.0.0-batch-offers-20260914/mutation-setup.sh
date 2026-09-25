#!/bin/bash
set -euo pipefail
mkdir -p /recruitment/records
cp /source/tests/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json
chmod -R a+rX /recruitment
bash /source/solution/solve.sh
chmod -R a+rX /app
node /evidence/mutation-controls.cjs
