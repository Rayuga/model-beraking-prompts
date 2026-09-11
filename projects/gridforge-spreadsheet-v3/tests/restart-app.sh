#!/bin/bash
# Called only by the judge for the persisted-workbook restart criterion.
set -euo pipefail
exec bash /tests/app-control.sh restart
