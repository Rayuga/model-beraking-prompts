#!/bin/bash
# Called only by the judge for the persisted-document restart criterion.
set -euo pipefail
exec bash /tests/app-control.sh restart
