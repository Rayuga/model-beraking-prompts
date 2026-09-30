"""Finish the review ledger after all original reports and adjudications exist."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import sys

base = Path(__file__).resolve().parent
root = base.parents[2]
out = base / 'per-row-review'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
summary = read(out / 'reconciled-summary.json')
manifest = read(base / 'manifest.json')
sys.path.insert(0, str(root / 'scripts'))
from qc_pipeline import verify_frozen
assert not verify_frozen(base, manifest), 'Review inputs changed'
assert summary['dedicated_reviewers'] == 53
counts = ', '.join(f'{n} {v}' for v, n in summary['reconciled_verdicts'].items())

content = f'''# Colderwater: fresh 53-point reconciliation

**BLOCKED — {counts}.** These are QC-row verdicts, not counts of distinct bugs. All 53 original reviews are complete, each from a separate agent context, with up to three workers concurrently. Each assignment required its actual frozen workbook row, Internal annotation, Harbor QC skill and applicable references. The union of credible findings is retained.

This is a review-only audit of input `{manifest['input_sha256']}`. Task source, shared harness, budgets and scoring policy were not edited. The user's latest per-row instruction superseded the usual three complete-review grouping for this audit; unused complete-review skeletons are not evidence of additional reviews.

- [Complete 53-row table](QC_53_RECONCILED.md)
- [Workbook report](QC_53_REVIEW.xlsx), generated with the frozen skill's report builder
- [Original reports](rows), [machine-readable reconciliation](reconciled-summary.json)
- [48 deterministic dispositions](deterministic.json)

## Findings and ownership

| Root cause | QC rows | Evidence and impact | Appropriate next step |
|---|---|---|---|
| Run duration versus later interaction duration | 4, 27 | Functional S16 reuses S02's four-second timer, but that timer begins only after a click on an already completed HTML Run. A conforming app can preserve the completed Run duration and fail this probe. Two independent reviewers confirmed the source mismatch; the exact scripted predicate was reproduced on synthetic traces. | Use a successful Run that schedules its timer at top level. Keep the feature and weight; update the focused driver. |
| Title-validation setup coupling | 28 | S24 requires successful padded-title creation/update before separately credited collision and empty-title protection. An app with only a trimming defect can lose unrelated credit because there is no ordinary-title setup fallback. | Add a bounded unpadded create/update fallback, preserving the original trimming failure and valid-write controls. |
| Stop setup coupling | 28 | S03 observes working handlers only after six-second waits. An app with broken long-idle interaction but correctly working prompt Stop cannot earn the independent Stop credit. | If the delayed controls fail, rerun the same fixture, observe an immediate working handler, then Stop. Preserve the delayed-interaction failure. |
| Inherited restart helper false success | 21, 23, 35, 49 | A hash-matched reproduction shows helper exit 0 while the old PID remains alive and the replacement gets EADDRINUSE; readiness accepts the old listener. This invalidates proof of a process restart for that conforming runtime alternative. The golden itself did restart successfully. An unbounded cleanup wait is an additional source-derived risk, not a measured hang. | Escalate a concrete shared-template defect for an approved fix. Do not fork the canonical harness to silence QC. |
| Runtime-policy and artifact coverage boundary | 26 | Browser behavior cannot establish mandated Express/SQLite or the exact source/build artifact arrangement. A durable Node HTTP/JSON backend is a plausible indistinguishable alternative. Core playground behaviors are mapped; this is a bounded policy/delivery gap. | Reconcile inherited mandates with the shared-profile owner or approved deterministic checks; remove only unnecessary task-added artifact demands where authorized. Do not add private-source inspection to browser grading. |
| Reference source-control baseline | 20 | Repaired runtime source, current bundle and HTML differ from Git HEAD. The upload contents are frozen and match scripted golden evidence; the workbook separately asks for a committed baseline. See the original report and independent scope confirmation. | Preserve the exact reviewed source/bundle together in version control when a commit is authorized. No nondeterministic product outcome was found. |

The first three task-owned fairness repairs preserve the requested complexity, all features and existing weights. Their affected weights total 1.15 of 32.70 Functional: above the strict functional floor, their maximum combined reward contribution is `0.6 × 1.15 / 32.7 = 0.0211009`. This is an arithmetic bound, not a model-score prediction; crossing the floor is discontinuous. The coverage-policy and shared-harness issues are separate.

## What was measured

Fresh local source work passed 50 structural assertions, 53 source-regression assertions and three shell/JavaScript parser checks. The 53 source assertions are not the 53 semantic QC rows. All 48 documented deterministic workbook rows were applied locally: 34 Pass, 10 profile Notes, 4 N-A. The private portal checker executables were not available or run.

Existing raw golden results were reused only after matching all 22 application file hashes, both Functional files and the exact extracted restart helper. They record 64 Functional facts, two gates, seven Polish facts and 11 additional runtime regressions passing, with an actual PID change. This demonstrates product behavior under those scripts; it does not establish that every rubric is fair or that an LLM judge awards Oracle 1. Visual criteria received source/surface review, not a measured configured visual grade.

The frozen environment and verifier Dockerfiles built successfully with normal setup networking. Offline disposable-container probes verified image inputs, absence of grading material in the agent image, sanitized UID/GID 65534 execution, denied criteria/reward/root-environment reads and reward writes, and successful ordinary app writes. No provider credentials were used; dummy values tested environment stripping. See [raw isolation measurement](../isolation-measurement.json), [probe](../measure_isolation.py) and build logs. The first offline build attempt missed the package cache; the first inventory comparison incorrectly included Docker-ignored build files. Both preliminary outputs are retained, with their bounded tooling explanations; neither is presented as a task failure.

Direct scorer checks establish the implemented gate/floor arithmetic and monotonic formula. They do not establish that real app scores have useful discrimination or ranking under the configured judge.

## Evidence still required

Four runtime rows remain unmeasured: workload adequacy (11), full configured verifier launch/grading (22), empirical reward discrimination (40), and real-app reward ordering (42). Full configured judge logs, Oracle/model scores and a cold-builder timing measurement were not produced. A cached image build and a roughly 119-second scripted browser flow cannot stand in for the configured judge's duration. Canonical budgets remain unchanged: 1200 seconds of gate limits inside 1500, 10800 of scored limits inside 11100, and both suites inside 13200.

No new ZIP, upload, provider charge or Git write was made. This audit does not clear the candidate for upload or promise a portal pass.

## Reconciliation and history

Original row reports are immutable evidence; adjudications are separate files. Row 4's original Pass was corrected after independent confirmation of row 27's duration witness. Row 46's missing runtime evidence was investigated with actual image probes and independently reviewed before any revised verdict. Row 20's Git-baseline interpretation received a separate independent review. No credible failure was cancelled by a majority vote.

This candidate differs from the older hardening candidate. Changed verdicts across those candidates are not proof of portal nondeterminism. This audit did find a missed source detail on identical bytes (row 4 versus row 27), which shows ordinary review fallibility and why specific counterexamples must be reconciled. It does not establish an unmeasured claim about the portal's reviewers.

Fix confirmed task defects in a new candidate, exercise the conforming/partial alternatives as well as the golden, and repeat hash-bound review. Keep these reports as history; do not relabel this unchanged candidate as cleared.
'''
(out / 'RECONCILIATION.md').write_text(content, encoding='utf-8')

current = root / 'qc/CURRENT.md'
text = current.read_text(encoding='utf-8-sig')
start = text.index('- Active Colderwater audit:')
end = text.index('\n\n', start)
entry = f'- Latest Colderwater audit: [reconciliation](runs/{base.name}/per-row-review/RECONCILIATION.md), [53-point table](runs/{base.name}/per-row-review/QC_53_RECONCILED.md), [workbook](runs/{base.name}/per-row-review/QC_53_REVIEW.xlsx). **BLOCKED — {counts}.** All 53 distinct row agents finished; task source unchanged. Fresh exact-image isolation passes. Full judge/workload/reward evidence and confirmed findings remain unresolved. Older targeted repair confirmations do not clear this candidate.'
current.write_text(text[:start] + entry + text[end:], encoding='utf-8')

handoff = root / 'COLDERWATER_HANDOFF_2026-09-27.md'
text = handoff.read_text(encoding='utf-8-sig')
header = f'''# Latest: postrepair 53-point audit complete, BLOCKED

Use [the fresh reconciliation](qc/runs/{base.name}/per-row-review/RECONCILIATION.md): **{counts}** after independent review and documented follow-ups. Task input remains `{manifest['input_sha256']}`; no task files changed during this audit. There are three bounded task-owned probe-fairness issues, an inherited restart defect, policy/artifact coverage and source-control baseline issues, plus four missing configured-runtime measurements. The exact images built and offline isolation probes passed. Existing scripted golden evidence matches these bytes; Oracle 1 and model scores remain unmeasured. No ZIP or upload clearance was produced. Earlier entries below are history.

---

'''
handoff.write_text(header + text, encoding='utf-8')

progress = read(out / 'PROGRESS.json')
progress.update(status='COMPLETE', started=list(range(1,54)), completed=list(range(1,54)), next_assignment=None,
                root_work='All 53 original reviews and reconciliation complete; task source unchanged; release BLOCKED.',
                final_verdicts=summary['reconciled_verdicts'])
(out / 'PROGRESS.json').write_text(json.dumps(progress, indent=2)+'\n', encoding='utf-8')

artifacts = [p for p in base.rglob('*') if p.is_file() and p.name != 'final-evidence-binding.json']
artifacts += [root/'qc/prepare_per_row_review.py',root/'qc/collect_per_row_review.py',root/'qc/per_row_deterministic_review.py',root/'qc/finalize_per_row_review.py',root/'qc/export_per_row_review.py']
binding = {'input_sha256':manifest['input_sha256'], 'verified_utc':datetime.now(timezone.utc).isoformat(),
           'input_mismatches':verify_frozen(base,manifest), 'task_source_edited':False,
           'artifacts':{p.relative_to(root).as_posix():digest(p) for p in artifacts}}
(base/'final-evidence-binding.json').write_text(json.dumps(binding,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':summary['status'],'verdicts':summary['reconciled_verdicts'],'binding_artifacts':len(artifacts),'input_mismatches':binding['input_mismatches']}))
