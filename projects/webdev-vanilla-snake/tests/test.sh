#!/bin/bash
set -u
# 1. Render the agent's deliverable in headless Chromium once, cache the probe.
python3 /tests/probe.py /app/index.html /tmp/probe.json
# 2. Score every dimension against that cached probe.
rewardkit /tests
