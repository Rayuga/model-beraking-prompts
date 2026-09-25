from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
index = ROOT / 'deliverables/common-ground-ballot/README.md'
text = index.read_text(encoding='utf-8')
start = text.index('Latest candidate:')
end = text.index("r17's platform Oracle failed")
head = '''Latest candidate: [common-ground-ballot.zip](2026-09-16-product-gate-r22/common-ground-ballot.zip).
**r22 addresses the remaining read-only scoring loophole; fresh platform QC is pending.**
Read [the changes and validation](2026-09-16-product-gate-r22/README.md).
Only the Render verifier and package README changed from r21. The golden app
passed the new workflow twice; read-only, creation-only and fake-Publish controls
failed. Their maximum final reward is zero under the actual unchanged scorer.

The latest user screenshot reports static 45/45 and rubric 52/53, with only
`floor_is_low_for_shells_mocks_and_stuffing` failing. Oracle/model runs were skipped.
r21 repaired the earlier brief-voice findings. r19/r18 are historical repairs.
Historical ZIP bytes remain unchanged.

'''
text = text[:start] + head + text[end:]
old = '| [2026-09-16-natural-brief-r21](2026-09-16-natural-brief-r21/) | Current: natural product request; only instruction.md changed, all requirements retained |'
new = '''| [2026-09-16-product-gate-r22](2026-09-16-product-gate-r22/) | Current: mandatory saved ballot workflow; real golden and incomplete-product controls checked; fresh platform run pending |
| [2026-09-16-natural-brief-r21](2026-09-16-natural-brief-r21/) | Previous natural-brief repair; latest screenshot 52/53 rubric, remaining read-only floor issue addressed in r22 |'''
assert old in text
index.write_text(text.replace(old, new), encoding='utf-8', newline='\n')

context = ROOT / 'TASK_AUTHORING_CONTEXT.md'
text = context.read_text(encoding='utf-8')
title = '# Current WebDev Task Authoring Context\n\n'
assert text.startswith(title)
section = '''## September 16: Common Ground working-product gate r22 (current candidate)

Current ZIP: `deliverables/common-ground-ballot/2026-09-16-product-gate-r22/common-ground-ballot.zip`.
SHA-256 `68786691e1f87a0a747fe6e40b52d48b420da73394267ec652cf8afcc983aeb2`.
Report: `reports/common-ground-ballot/2026-09-16-product-gate-r22/README.md`.
Latest screenshot: static 45/45, rubric 52/53; only read-only product reward floor
failed. r22 adds one Render all_pass prerequisite: create/Open/member vote/Close/
Publish one fresh ballot, then confirm saved outcome in both reloaded contexts.
Only Render judge, Render prompt and task README changed; 26 other files match
r21 exactly, including natural brief, golden, helpers, weights and timeouts.
Five dimensions, 70 criteria (2/2/50/10/6), task version1.0.0; only Render prompt r22.

Pinned real MCP golden journey passed twice on the same DB. Read-only and
create-only controls captured405; publish-no-op returned200 but fresh read stayed
Closed. Actual RewardKit/scorer with those observed gate results and every other
criterion assumed1 gives all three controls final0. This is an upper-bound check,
not a scored Oracle/model run. Initial403 control diagnostics timed out and are
preserved as failed harness attempts, not successful mutant detections.
Installed scheduler with only agent responses mocked proves serial alphabetical
order and peak concurrency1; Functional seed checks precede Render's new fixture.
30 runner checks and294 ZIP checks passed; cached dependencies, not a fresh clean
download build. Fresh platformQC/fullOracle/model scores remain unverified.
Do not claim Oracle1,53/53QC or a new model range. Earlier current-candidate notes
below are historical; use this entry and its report.

'''
text = text.replace('## September 16: Common Ground natural brief r21 (current candidate)', '## September 16: Common Ground natural brief r21 (historical candidate)', 1)
text = text.replace('## September 16: Common Ground runtime-contract repair r20 (current candidate)', '## September 16: Common Ground runtime-contract repair r20 (historical candidate)', 1)
context.write_text(title + section + text[len(title):], encoding='utf-8', newline='\n')
