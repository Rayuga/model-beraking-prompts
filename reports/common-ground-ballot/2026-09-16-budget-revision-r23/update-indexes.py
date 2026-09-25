from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
path=ROOT/'deliverables/common-ground-ballot/README.md'
text=path.read_text(encoding='utf-8')
start=text.index('Latest candidate:');end=text.index("r17's platform Oracle failed")
head='''Latest candidate: [common-ground-ballot.zip](2026-09-16-budget-revision-r23/common-ground-ballot.zip).
**r23 addresses both new QC findings: mandatory-gate time allocation and vote-revision coverage.**
Read [the changes and validation](2026-09-16-budget-revision-r23/README.md).
Render/Constraints now allow 30/20 minutes, with Functional retaining two hours;
the combined and standard outer budgets are unchanged. A dedicated Functional
check compares revisions around existing accepted single-choice and approval votes.
The unchanged golden passed; all three targeted revision mutants were detected.

The latest user screenshot reports static 45/45 and rubric 51/53, failing
`timeouts_fit_the_work` and `dimensions_cover_every_graded_requirement`.
Fresh platform QC and full Oracle/model runs remain pending for r23.
r22's working-product gate and r21's natural brief remain intact.
Historical ZIP bytes remain unchanged.

'''
text=text[:start]+head+text[end:]
old='| [2026-09-16-product-gate-r22](2026-09-16-product-gate-r22/) | Current: mandatory saved ballot workflow; real golden and incomplete-product controls checked; fresh platform run pending |'
new='''| [2026-09-16-budget-revision-r23](2026-09-16-budget-revision-r23/) | Current: larger gate budgets within the standard cap, accepted-vote revision coverage, golden and three mutants checked |
| [2026-09-16-product-gate-r22](2026-09-16-product-gate-r22/) | Previous workflow-gate repair; latest screenshot exposes gate-budget and vote-revision coverage findings fixed in r23 |'''
assert old in text
path.write_text(text.replace(old,new),encoding='utf-8',newline='\n')

path=ROOT/'TASK_AUTHORING_CONTEXT.md';text=path.read_text(encoding='utf-8')
title='# Current WebDev Task Authoring Context\n\n';assert text.startswith(title)
section='''## September 16: Common Ground timeout and vote-revision repair r23 (current candidate)

ZIP: `deliverables/common-ground-ballot/2026-09-16-budget-revision-r23/common-ground-ballot.zip`.
SHA-256 `e0a9d37a0ec9188749abdc46808c19c97a4124e1939b2c96e2c5d8de29145798`.
Report: `reports/common-ground-ballot/2026-09-16-budget-revision-r23/README.md`.
Latest screenshot: static45/45, rubric51/53. New findings are mandatory-gate
timeouts and lack of accepted-vote revision stability coverage. Render now1800,
Constraints1200, Functional7200, Polish900, Visual900 seconds; total12000 still
fits runner12600 and standard verifier13200. Task.toml/env/agent limit unchanged.
New0.75 Functional criterion accepted_votes_preserve_ballot_revision reuses
Phase B's existing two single-choice votes and approval vote with fresh before/
after reads. Existing50Functional criteria unchanged. Five dimensions,71criteria
(2/2/51/10/6). Functional prompt r23; Render r22; others r20. No golden or brief edit.

Real pinned-MCP golden test: single4->4 twice, approval2->2. Three disposable
mutants (all votes, single only, approval only increment revision) were caught.
Every mutant still passed relative Close+1, reproducing the screenshot loophole.
30runner checks,4offline budget/scoring groups and294ZIP checks pass. Only five
task files changed fromr22;24unchanged. The r22 working-product floor gate remains.
Initial report-driver syntax/reload errors were fixed and excluded from passes.
Cached dependency image; no fresh download build. Full autonomous timing,
platformQC and scoredOracle/model remain unverified. Do not promise53/53,Oracle1
or a new model range. Earlier current-candidate entries below are historical.

'''
text=text.replace('## September 16: Common Ground working-product gate r22 (current candidate)','## September 16: Common Ground working-product gate r22 (historical candidate)',1)
path.write_text(title+section+text[len(title):],encoding='utf-8',newline='\n')

# Retain failed harness diagnostics separately from the final successful cases.
archive=HERE/'initial-harness-failures';archive.mkdir(exist_ok=True)
for source in HERE.glob('revision-*/revision-failure.json'):
    destination=archive/(source.parent.name+'-failure.json')
    assert source.resolve().is_relative_to(HERE.resolve()) and destination.resolve().is_relative_to(HERE.resolve())
    assert not destination.exists()
    source.rename(destination)
