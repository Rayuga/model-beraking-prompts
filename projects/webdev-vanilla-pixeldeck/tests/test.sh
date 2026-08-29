#!/bin/bash
set -u
python3 /tests/probe.py /app/index.html /tmp/probe.json || printf '{}\n' > /tmp/probe.json
rewardkit /tests
