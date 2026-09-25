from pathlib import Path
import re
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/common-ground-ballot'
with zipfile.ZipFile(HERE / 'before-r23.zip', 'x', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in TASK.rglob('*'):
        if path.is_file(): archive.writestr(path.relative_to(TASK).as_posix(), path.read_bytes())

def change(path, old, new):
    file = TASK / path
    text = file.read_text(encoding='utf-8')
    assert text.count(old) == 1, (path, old)
    file.write_text(text.replace(old, new), encoding='utf-8', newline='\n')

for dimension, before, after in [('render', 600, 1800), ('constraints', 600, 1200), ('functional', 9000, 7200)]:
    change(f'tests/{dimension}/judge.toml', f'timeout = {before}\n', f'timeout = {after}\n')

criterion = '''[[criterion]]
id = "accepted_votes_preserve_ballot_revision"
name = "accepted_votes_preserve_ballot_revision"
type = "binary"
weight = 0.75
description = """
Use Phase B's existing successful Owen and Leila Courtyard single-choice submissions and Leila's Verifier approval submission. For each accepted vote, retain that same ballot's current revision from a genuine protected read immediately before submission, then refresh and read it again immediately afterward, before any staff edit, Close or Publish. Confirm that the vote was actually accepted and participation was recorded; require the before/after ballot revision to be identical. Both voting methods must have an observed accepted positive control. A vote that increments, decrements or resets the revision fails even if the later lifecycle actions correctly add one to that altered value. Compare the actual current revision, not merely the seed revision, a cached display or an echoed request field. This criterion owns revision stability of newly accepted votes only; vote privacy, validation, receipt replay and staff revision advances retain their separate owners. Reuse the existing workflow and role/stage snapshots. If an unrelated earlier invalid probe consumed participation, retain that failure and use an equivalent eligible UI-created control for this observation. Missing evidence of a successful vote cannot pass.
"""

'''
change('tests/functional/judge.toml', '[[criterion]]\nid = "exact_vote_success_receipt"', criterion + '[[criterion]]\nid = "exact_vote_success_receipt"')
change('tests/functional/prompt.md', 'common-ground-ballot-functional-v1.0.0-r20', 'common-ground-ballot-functional-v1.0.0-r23')
change('tests/functional/prompt.md', "4. Capture Owen's visible Keep 8 pm Courtyard vote/private confirmation.", "4. For accepted_votes_preserve_ballot_revision, save the ballot revision from a current protected read immediately before and immediately after each of these three existing successful votes: Owen's Courtyard single choice, Leila's Courtyard single choice and Leila's Verifier approval. Confirm accepted participation, reload/re-read the same ballot and compare revisions before any intervening staff edit, Close or Publish. All three comparisons must be unchanged; do not infer this from the seed or from later lifecycle increments. Reuse the stage snapshots below and record this criterion separately without cascading its failure into vote confirmation or result math. Capture Owen's visible Keep 8 pm Courtyard vote/private confirmation.")
change('README.md', 'authentication gate, detailed Functional criteria, score formula and all timeouts\nare unchanged.', 'authentication gate and score formula are unchanged. Functional separately checks\nthat accepted single-choice and approval votes leave the ballot revision unchanged.')
with (TASK / 'README.md').open('a', encoding='utf-8', newline='\n') as file:
    file.write('''
## Verifier time budgets

The judge.toml files allocate 1,800 seconds to Render's authenticated navigation
and new-ballot journey, 1,200 to Constraints' authenticated SQLite inspection,
7,200 to Functional's four phases, and 900 each to Polish and Visual. These are
maximum durations, not fixed waits. The five serial ceilings total 12,000 seconds,
leaving 600 seconds inside the runner's 12,600-second limit; the standard outer
verifier limit remains 13,200 seconds. Functional reuses its accepted votes for
the new before/after revision comparison, without a new workflow or restart.
''')
print('r23: five source files changed; total judge budget remains 12000 seconds.')

# Copy the established local validation tools without changing earlier evidence.
previous = ROOT / 'reports/common-ground-ballot/2026-09-16-product-gate-r22'
for name in ('validate-package.py', 'runtime-smoke.py', 'run-runtime-checks.py', 'build-runtime.py', 'Dockerfile.runtime-validation'):
    text = (previous / name).read_text(encoding='utf-8')
    text = text.replace('actual r22 upload', 'actual r23 upload')
    text = text.replace('20260916-r22-runtime-validation', '20260916-r23-runtime-validation')
    text = text.replace('exact r22 runner', 'exact r23 runner')
    text = text.replace('all 70 criteria', 'all 71 criteria').replace("discovery['criteria_count'] == 70", "discovery['criteria_count'] == 71")
    text = text.replace('22 if dimension == "render" else 20', '23 if dimension == "functional" else (22 if dimension == "render" else 20)')
    (HERE / name).write_text(text, encoding='utf-8', newline='\n')
