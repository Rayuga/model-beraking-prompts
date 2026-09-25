from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT/'projects/common-ground-ballot'
with zipfile.ZipFile(HERE/'before-r22.zip','w',zipfile.ZIP_DEFLATED) as out:
    for path in sorted(TASK.rglob('*')):
        if path.is_file(): out.write(path,path.relative_to(TASK).as_posix())

path = TASK/'tests/render/judge.toml'
text = path.read_text(encoding='utf-8')
text = text.replace('no ballot mutation is needed.', 'navigation alone does not require a mutation. The separate working_ballot_journey prerequisite owns the fresh write workflow.')
text += '''
[[criterion]]
id = "working_ballot_journey"
name = "working_ballot_journey"
type = "binary"
weight = 1.0
description = """
Complete one genuine new ballot journey through visible controls, using a dedicated uniquely named single-choice ballot with two distinct choices. As Ruth create its Draft and Open it; as an eligible Member in a separate authenticated browser context submit one choice; as Ruth Close and Publish that same ballot. Observe the actual business mutations and subsequent protected reads. After ordinary reload in both contexts, the new ballot must still be Published and its participation/result must reflect that Member's accepted vote. Match the fresh record by its observed identity or unique content, not a seeded ballot or success message. Missing controls, refused or ineffective transitions, a cosmetic success with unchanged server records, or an unrecorded vote fail this criterion. Use one fixture and five normal business writes; no edit, negative-probe matrix, receipt replay or extra process restart is needed. Do not judge exact revision increments, tie/percentage math, role/privacy boundaries, input validation, audit fidelity, recovery or appearance here; existing criteria own those details. This is a minimum working-product prerequisite in Render's all_pass gate, with no independent final reward contribution. A read-only product fails even if it has real sign-in, SQLite-backed seeded reads and excellent presentation.
"""
'''
path.write_text(text,encoding='utf-8',newline='\n')

path = TASK/'tests/render/prompt.md'
text = path.read_text(encoding='utf-8')
text = text.replace('Prompt version: common-ground-ballot-render-v1.0.0-r20','Prompt version: common-ground-ballot-render-v1.0.0-r22')
text = text.replace('Evaluate the requested workspace navigation at `http://localhost:3000` with Playwright MCP after the global gate. Use the appropriate staff and Member roles; do not mutate ballots.',
'''Evaluate workspace navigation and the minimum working ballot journey at `http://localhost:3000` with Playwright MCP. First complete the shared authentication gate without changing business records. Then the separate Render workflow below authorizes one new ballot and its normal mutations; use no existing ballot for that journey.''')
section = '''## One working-product prerequisite

Render is a mandatory all_pass gate. Both workspace_navigation and
working_ballot_journey need their own observed evidence. If the new workflow
cannot complete, report working_ballot_journey as failed even when all seeded
screens look complete. The final scorer then returns zero regardless of the
other dimensions' scores; keep their independent verdicts unchanged. This gate
does not add a weighted business score.

Reuse the ordinary Ruth and eligible Member contexts needed for navigation
(normally Leila Ward, leila.ward@commonground.example, CommonGround!2026). Use the
current roster and current persisted app, without modifying membership or earlier
Functional/Polish fixtures. All setup and writes below must use the real UI.

1. As Ruth, visibly create a new single-choice Draft with a unique title and two
   distinct custom labels of your choosing. Capture its genuine write response
   and subsequent protected collection/detail read. Identify that new record;
   a seeded record or merely displayed form values cannot substitute.
2. Open that same ballot through Ruth's visible control. Confirm its current
   Open state from a subsequent protected read. In the Member's separate context,
   refresh to find that new eligible ballot and submit one of its choices once.
   Capture the actual accepted vote and the subsequent participation read.
3. As Ruth, refresh current data as needed, Close the ballot and then Publish it
   with the visible controls. Handle any native confirmation using the browser's
   dialog tool. Observe each mutation and the following protected state; do not
   assume a success toast or 2xx response means a transition actually happened.
4. Reload both ordinary contexts. Require the same new ballot to remain Published
   with the Member's recorded participation and a published result reflecting
   that accepted choice. Inspect both the visible result and the real protected
   responses supplying it. This is proof of an actual saved vote/outcome, not a
   second exact-tally, percentage or privacy test.

This is one fixture and five normal writes, performed once. Navigation may share
its already visited surfaces and contexts. Do not repeat Functional's validation,
receipt, concurrency, result-math or recovery matrices, change an older ballot,
inspect app source/storage, issue guessed API requests, manufacture state or
restart the process. Save each request/outcome before continuing; do not put the
whole journey in a throwing script that loses earlier evidence. If a step fails,
record the concrete failure and continue independently reachable navigation.
Never infer a pass from seeded data or another dimension's presumed success.

'''
assert text.count('{criteria}') == 1
text = text.replace('{criteria}',section+'{criteria}')
path.write_text(text,encoding='utf-8',newline='\n')

path = TASK/'README.md'
text = path.read_text(encoding='utf-8')
text += '''
## Minimum working product

Render's all_pass gate includes one new-ballot journey: Coordinator creates and
opens, an eligible Member votes, then the Coordinator closes and publishes.
Refreshed protected records must retain that new voted/published outcome. This
prerequisite runs once on a separate fixture, in addition to workspace navigation;
it does not award extra final reward. Read-only seeded displays therefore get
Render zero and final reward zero, regardless of Polish/Visual scores. The shared
authentication gate, detailed Functional criteria, score formula and all timeouts
are unchanged. The pinned runner discovers dimensions in alphabetical order and
runs one at a time, so Render's new fixture follows Functional's seed inspection.
'''
path.write_text(text,encoding='utf-8',newline='\n')
print('Added one Render working-product prerequisite; 70 total criteria. Brief, golden, scoring and other verifiers unchanged.')
