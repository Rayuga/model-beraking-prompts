# GridForge 2.0.4: agent bootstrap network fix

The model run in run-ad33f6bf failed before the agent or verifier started.
OpenHands SDK attempted to install curl and coreutils, but the agent container
used no-network mode, so deb.debian.org could not resolve and apt exited 100.

Version 2.0.4 changes only the agent environment network mode to public, plus
matching release metadata and prompt version markers. The verifier remains in
a separate allowlisted environment. Application requirements still require
runtime resources to be served locally, and browser checks enforce same-origin
requests. No criterion, score, instruction, golden behavior, dependency, or
timeout was changed.

This removes the earlier QC warning that the task was more network-restricted
than its public project required and allows Harbor to bootstrap OpenHands.
The failed run contains no meaningful model score because setup stopped before
the model was launched.
