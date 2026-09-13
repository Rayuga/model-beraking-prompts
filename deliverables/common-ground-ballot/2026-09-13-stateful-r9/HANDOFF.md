# Common Ground Ballot r9 Handoff

## Resume Here

Active task: projects/common-ground-ballot/
Evidence: reports/common-ground-ballot/2026-09-13-stateful-r9/
Upload: deliverables/common-ground-ballot/2026-09-13-stateful-r9/common-ground-ballot.zip
Checksum: package-audit.json and SHA256SUMS.txt beside the upload.

Read TASK_TEMPLATE_STANDARD.md, TASK_LEARNINGS_2026-09-13.md and this folder's
README before making further changes. The r8 proposal is now implemented as
three explicit requirements, not hidden tests. See changes.diff and coverage.json.

## What Was Validated

Golden source unchanged from corrective r8; 27 local browser groups pass.
The seven staff success receipts, two domain refusals and two roster snapshots
are checked before and after each of two real server restarts.
Six negative variants fail at expected assertions. Fifteen harness cases and
five runtime groups pass. Both exact Docker images build. The 115 reference
checks and 53-point local source review are recorded, not platform pass claims.

Functional r9 has22 criteria, total36 across all five dimensions.
Polish remainsr4 and Render/Constraints/Visual remainr2.
No provider key, paid generation, full remote Oracle or platform QC was used.

## Reproduce Locally

From repository root, with Docker Desktop running:

```powershell
docker build -t ballot-agent:20260913-r9 -f projects/common-ground-ballot/environment/Dockerfile projects/common-ground-ballot/environment
docker build -t ballot-verifier:20260913-r9 -f projects/common-ground-ballot/tests/Dockerfile projects/common-ground-ballot/tests
python reports/common-ground-ballot/2026-09-13-stateful-r9/validate-local.py browser runtime harness mutants
python reports/common-ground-ballot/2026-09-13-stateful-r9/probe-models.py
python references/task-templates/check-standard.py projects/common-ground-ballot
```

These scripts never call a model provider. The launch harness substitutes a
local RewardKit test double solely for score/runner unit tests. Actual RewardKit
discovery is separately tested, not stubbed.

package.py validates evidence and creates the dated ZIP once. It deliberately
refuses to overwrite an existing release. For another source revision choose
a new dated folder and capture matching final image/provenance evidence.

## Limits And Ownership

No score band or golden1.0 is guaranteed. The old model apps were built for r7;
their new-scope omissions cannot be retroactively graded as old failures.
No old result.json, source export or frozen ZIP was edited.

Coursemark remains paused at its separate conversion handoff. Leave GridForge,
PatchPad, Brickfall, Pellmoor and unrelated dirty-tree files alone. No git
commit or push was requested for this implementation.

Next external step: upload this exact archive, obtain fresh platform static and
rubric checks, then Oracle. Inspect verdict/evidence provenance before deciding
whether another paid model run is justified.

