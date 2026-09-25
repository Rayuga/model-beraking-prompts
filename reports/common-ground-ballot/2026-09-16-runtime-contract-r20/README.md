# Common Ground Ballot r20: runtime contract static-check repair

The latest screenshot shows **44/45 static checks passed**, with
`check-runtime-contract-strings.py` identifying `app-lifecycle.py`,
`prompt-provenance.py`, and `score.py` as verifier-launched application files
missing from the Oracle solution. Later rubric/model/Oracle stages were skipped.
The real app entry is `/app/server.js`, installed by `solution/solve.sh`.
The three reported files are generated private evaluator utilities.

The runner now materializes those utilities as executable commands named
`app-lifecycle`, `prompt-provenance`, and `score`, with explicit
`#!/usr/local/bin/python3` shebangs and mode `700`, and calls their absolute
`/opt/common-ground-verifier/` paths directly. The Functional restart command and
provenance resource hashes use the new paths. Two stale relative `tests/score.py`
references in Polish/Visual prompts were also corrected. Prompt provenance is r20.
No evaluator helper is copied into `/app` or into the golden solution.

The complete golden app, starter/environment, public brief, task.toml, both
Dockerfiles, reward configuration and every judge.toml are byte-identical to r19.
There are still five verifier dimensions and 69 criteria; weights, timeouts,
task version 1.0.0, model and reasoning configuration are unchanged.

| Validation | Result |
| --- | --- |
| Focused entrypoint/delivery regression | 31 passed; reproduces all three old filename matches, none in r20 |
| Exact final runner over cached dependencies | 30 passed, two complete runner invocations |
| Source structure/contracts | 259 passed |
| Actual uploaded ZIP bytes/layout | 294 passed |

The runner test installs the real golden solution using its solve.sh. In each run
it authenticates against the protected seeded collection, confirms Node runs as
uid65534 from `/app/server.js`, executes the new lifecycle restart command, and
checks unchanged data and the same session afterward. It also checks private
helper executable modes, actual RewardKit discovery of all five dimensions/69
criteria, unchanged genuine Codex version/login delegation, provenance, score
composition and gate-zero behavior. The image is verified byte-for-byte against
the final verifier source before these tests.

The platform static-check script is not available locally; the focused regression
reproduces the reported interpreter/filename classification, not the entire
platform script. A fresh platform QC/Oracle run is required to confirm acceptance.
Runtime checks use the dependency cache already validated in r19; the unchanged
shipped Dockerfile's clean network build previously hit the local corporate proxy.
Synthetic RewardKit scores test plumbing and do not constitute a scored Oracle run.

ZIP: `deliverables/common-ground-ballot/2026-09-16-runtime-contract-r20/common-ground-ballot.zip`.
Files: 29. SHA-256: `04d5cbc8cab8c7e71494cdf4b4f4c1acc68a928428d8b65556a759101b028b45`.
Historical ZIPs, including r19, are unchanged.
