# Authentication Gate Fix Handoff

Active source: projects/common-ground-ballot/
Release: deliverables/common-ground-ballot/2026-09-14-auth-gate-r10/
Evidence: reports/common-ground-ballot/2026-09-14-auth-gate-r10/

The previous r9 ZIP had a genuine missing authentication prerequisite in every
dimension's shared gate. Do not revert to its successful-sign-in-only wording.
Read README.md, auth-gate-audit.json and the updated task standard.

Five prompts changed. All36 criteria and their weights, task1.0.0, public network,
central judge settings, golden source and instructions remain unchanged.
32 golden browser groups,15 harness cases,5 runtime groups,9 broken variants,
115 standard checks and55 focused gate-wording checks pass locally.

Local reproduction from repository root:
```powershell
docker build -t ballot-verifier:20260914-r10 -f projects/common-ground-ballot/tests/Dockerfile projects/common-ground-ballot/tests
python reports/common-ground-ballot/2026-09-14-auth-gate-r10/validate-local.py browser runtime harness mutants gate-mutants
python reports/common-ground-ballot/2026-09-14-auth-gate-r10/check-auth-gate.py
python references/task-templates/check-standard.py projects/common-ground-ballot
```

The inherited agent image is ballot-agent:20260913-r9; its files are unchanged
and rechecked against hashes. Build it from the current environment/Dockerfile
on another device if absent.

package.py creates the release once and refuses to overwrite a frozen ZIP.
For later source changes use a new release directory and matching test evidence.

No new provider-backed Oracle or platform QC was executed. Upload the exact
archive and check new results before claiming acceptance or a score.
Other tasks and historical run exports were untouched; no commit/push was asked.

