from pathlib import Path
import hashlib
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
data=json.loads((HERE/'analysis.json').read_text(encoding='utf-8'))
rows=data['runs']
by_agent={r['model'] or r['agent']:r for r in rows}
oracle=by_agent['oracle']
gpt=by_agent['gpt-5.4-mini']
haiku=by_agent['claude-haiku-4-5']
assert all(r['all_r27_verifier_hashes_match'] for r in rows)
assert all(oracle['oracle_files_match_r27'].values())
assert len({r['task_checksum'] for r in rows})==1
assert all(a['returncode']==0 for r in rows for v in r['dimensions'].values() for a in v)
assert sum(a['verdict_count'] for v in oracle['dimensions'].values() for a in v)==86
for r in rows:
    for dim,attempts in r['dimensions'].items():
        if dim in ('render','constraints'): continue
        assert attempts[-1]['normalized_mean']==r['rewards'][dim],(r['trial'],dim)
package=ROOT/'deliverables/common-ground-ballot/2026-09-17-review-safety-r27/common-ground-ballot.zip'
assert hashlib.sha256(package.read_bytes()).hexdigest()==data['package_sha256']
for name in ('gpt','haiku'):
    diagnosis=json.loads((HERE/f'diagnostic-{name}/diagnostics.json').read_text(encoding='utf-8'))
    assert not diagnosis.get('error')

def local(run,filename):
    return f'../../../run-outputs/common-ground-ballot/{run["run"]}/{run["trial"]}/{filename}'

text=f'''# Fresh r27 run analysis

**Oracle passed at 1.0000 in all five dimensions. GPT-5.4-mini scored 0.0000,
below the requested 0.6 ceiling. Keep the tested r27 package unchanged.**

These are actual supplied platform scores, replacing the previous conditional
projection. All five trials share task checksum
`{oracle['task_checksum']}`. Every judge/prompt, runner and reward-config hash
matches r27; all five delivered Oracle application files match its reference
exactly. The upload ZIP is still SHA-256 `{data['package_sha256']}`.

## Scores

| Run | Final | Functional | Polish | Visual | Render | Constraints | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Oracle | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1 | 1 | All 86 criterion verdicts full credit |
| GPT-5.4-mini | 0.0000 | 0.1824 | 0.6429 | 0.8333 | 0 | 1 | Genuine voting/navigation failures trigger mandatory gate |
| Claude Haiku 4.5 | 0.0000 | 0.2077 | 0.8571 | 0.9167 | 0 | 1 | Valid vote returns 500; mandatory journey cannot finish |
| NOP | 0.0000 | 0 | 0 | 0 | 0 | 0 | Expected empty-submission floor; graded=0, no_op=1 |
| Gemini 3.7 Flash | 0.0000 recorded | — | — | — | — | — | Invalid model measurement: provider billing cap / 429 |

[Oracle reward]({local(oracle,'verifier/reward.json')}),
[GPT reward]({local(gpt,'verifier/reward.json')}),
[Haiku reward]({local(haiku,'verifier/reward.json')}).

The official final scores follow the required gate: Render=0 makes final reward
zero. As diagnostics only, the ungated 0.6F+0.2P+0.2V sums are approximately
0.4047 for GPT and 0.4794 for Haiku; those are not their awarded rewards.
GPT earned 18.875/103.5 weighted Functional points and Haiku 21.5/103.5. Both
received 28 yes and 38 no Functional verdicts, but the weights differ.

## Why GPT failed

I reproduced the two Render failures on an unmodified disposable copy of the
submitted app, with fresh seeded SQLite and a real Chromium browser:

1. The server's workspace summary drops `choices`. The Vote renderer uses that
   summary and never loads the complete ballot. Courtyard has two choices in
   its protected detail response, but the visible vote form contains zero
   choice controls. A Member cannot complete the vote journey.
2. The staff turnout summary omits `eligibleMembers` and `participants`. The
   renderer calls `.map()` on those missing arrays, raising `Cannot read
   properties of undefined (reading 'map')`. The previous Results content
   stays rendered after clicking Turnout.

This is a client/server integration failure in the model submission. It also
blocks downstream vote receipts, participation checks and result-math evidence.
The new GPT did implement some rounds, draft-review and pending-action code;
its low score cannot be described simply as those features all being absent.
The round preview also builds on incomplete summaries and displays zero-choice
definitions, while several review/recovery cases fail or lack complete evidence.

[Reproduced GPT observations](diagnostic-gpt/diagnostics.json),
[platform Render verdicts]({local(gpt,'verifier/judges/render/attempt-0001/final.json')}).

## Haiku and Gemini

Haiku's valid Leila Courtyard vote independently reproduces HTTP 500. Its vote
transaction executes `SELECT id FROM operation_receipts`, but that table has a
compound user/operation primary key and no `id` column. SQLite reports `no such
column: id` at submitted server.js:1242 and the transaction rolls back. The
platform also observed valid draft edits failing and no usable pending/review/
round UI. [Reproduction](diagnostic-haiku/diagnostics.json) and
[actual server error](diagnostic-haiku/server.log).

Gemini stopped during the build with ApiRateLimitError. The provider explicitly
reported that the billing account had exceeded its monthly spending cap,
HTTP 429 / RESOURCE_EXHAUSTED. Its exported zero has graded=0 and no_op=1, with
no dimension judge runs. Exclude it from model difficulty statistics; another
run needs the provider spending-cap issue resolved first.

## One judge error to track

GPT's `round_success_receipt` explanation says exact replay reopened a Closed
ballot. The submitted receipt handler returns the stored body before mutation.
My targeted fresh replay confirmed: original receipt state Open, current record
Closed/revision 3 before replay, current record still Closed/revision 3 afterward,
and exact original response preserved. The explanation is therefore contradicted
by the submitted code and this replay. It may confuse the historical receipt
body with a new protected read; that causal explanation is an inference.

The local probe checks this particular claimed reopening, not every subcondition
of that criterion, so it is not a replacement full-credit verdict. Several other
Functional failures explicitly cite missing or incomplete evidence. Do not treat
all 38 no verdicts as 38 independently proven backend defects. The two mandatory
Render failures were independently reproduced, so this finding does not change
the final GPT zero or the target conclusion. The existing rubric already requires
separate current-state reads; weakening it or the golden is unwarranted.

## Runtime

There are five verifier dimensions, 86 criteria, and 66 Functional criteria.
Oracle grading completed in **65 minutes 44 seconds**, without exceptions,
timeouts or retries. Its five successful judge sessions took:

| Dimension | Time | Configured ceiling |
| --- | ---: | ---: |
| Constraints | 1m 40s | 20m |
| Functional | 39m 30s | 120m |
| Polish | 5m 13s | 15m |
| Render | 9m 34s | 30m |
| Visual | 8m 29s | 15m |

The remaining approximately 77 seconds are runner/startup overhead. Thus the
hour-long Oracle run was completing real serial work. GPT built for 14m 02s
and graded for 44m 02s; Haiku built for 8m 08s and graded for 29m 42s. Neither
hit the two-hour agent limit, and all executed dimension judges returned zero.

## Recommendation and QC status

Freeze r27 for now. The actual Oracle target and GPT ceiling are met on this
batch. Further tightening adds risk without a demonstrated need. This is one
fresh GPT sample and one Oracle sample, not a guarantee for future runs. Another
GPT sample is useful only if a repeatability estimate is required; Gemini needs
a valid run after its provider billing issue is resolved.

The supplied folders contain evaluation runs, not the separate platform
Rubric/Source or Static Checks report. **Platform 53/53 rubric acceptance cannot
be confirmed from these files.** The earlier local review is still local; a
successful Oracle execution does not substitute for the platform QC verdict.

No task, golden, rubric, weight, timeout, run artifact or ZIP was edited during
this analysis. Diagnostic copies were discarded after use. Structured evidence
and exact per-criterion reasons are in [analysis.json](analysis.json).
'''
(HERE/'README.md').write_text(text,encoding='utf-8',newline='\n')

p=ROOT/'deliverables/common-ground-ballot/README.md'
old=p.read_text(encoding='utf-8')
table=old[old.index('| Folder |'):]
table=table.replace('Current: golden review-race fix, two coverage fixes; 101 browser checks and eight round mutation controls',
                    'Current: fresh measured Oracle 1.0000, GPT 0.0000, Haiku 0.0000; separate platform rubric report not supplied')
p.write_text('''# Common Ground Releases

Latest tested ZIP: [common-ground-ballot.zip](2026-09-17-review-safety-r27/common-ground-ballot.zip).
**Fresh r27 results: Oracle 1.0000; GPT-5.4-mini 0.0000; Haiku 0.0000; NOP 0.0000.**
[Fresh run analysis and evidence](../../reports/common-ground-ballot/2026-09-17-r27-fresh-runs/README.md).

All verifier hashes and the Oracle app match r27. GPT and Haiku have reproduced
core voting failures; their Render gate zeros the final reward. Gemini's zero is
invalid as a difficulty measurement because its provider billing cap stopped the
build. Oracle grading took 65m44s, with all 86 criteria receiving full credit.
Separate platform Rubric/Source and Static Checks results were not supplied.
Keep this ZIP unchanged; no further hardening is currently recommended.

The release also has 101 local golden browser checks, eight round mutation
controls, 30 runner checks and 294 ZIP checks. Five verifiers, 66 Functional
criteria. [Original release report](../../reports/common-ground-ballot/2026-09-17-review-safety-r27/README.md).

'''+table,encoding='utf-8',newline='\n')

p=ROOT/'TASK_AUTHORING_CONTEXT.md'
old=p.read_text(encoding='utf-8')
header='# Current WebDev Task Authoring Context\n\n'
assert old.startswith(header)
note=f'''## September 17: Fresh r27 platform runs analyzed (latest measured status)

Report: `reports/common-ground-ballot/2026-09-17-r27-fresh-runs/README.md`.
All five trial provenance hashes match r27; Oracle app files match its golden.
Common task checksum `{oracle['task_checksum']}`.
Oracle iBeMVH2: 1.0000 all five dimensions, all 86 verdicts full credit, no
exception. Grading 3944s (65m44s), Functional 2370s (39m30s), within budgets.
GPT dD7G3yM / gpt-5.4-mini: final0, F0.1824, P0.6429, V0.8333, Render0, C1.
Haiku XM5sBfb: final0, F0.2077, P0.8571, V0.9167, Render0, C1. NOP cQy8rSn0.
Gemini JSzQGy9 / gemini-3.7-flash: ApiRateLimitError, provider monthly spending
cap HTTP429, graded0/no_op1; invalid difficulty sample. Rerun only after cap
is resolved. No platform rubric/static QC report is in the new folders.

Independent disposable replays prove GPT workspace drops vote choices and
turnout arrays, so voting has no choice controls and Turnout throws TypeError.
Haiku vote SQL selects nonexistent operation_receipts.id and returns500.
The GPT round_success_receipt claim that replay reopens Closed is contradicted
by an independent replay: original receiptOpen, current recordClosed rev3 before
and after. This checks only that claimed defect, not every criterion condition.
Many other Functional nos cite missing evidence; do not describe all as proven
independent backend bugs. The reproduced Render failures still make final0 valid.

Recommendation: keep r27 unchanged; measured Oracle1/GPT<=0.6 achieved this batch.
Do not promise repeated-run guarantees or platform53/53 without its report.
Analysis only: task/golden/rubrics/weights/timeouts/ZIP and run outputs unchanged.
Earlier r27 local report accurately records what was known at packaging; this
fresh measured status supersedes its pending-score statements.

'''
p.write_text(header+note+old[len(header):],encoding='utf-8',newline='\n')
print('Wrote fresh-run report and updated latest measured status. r27 ZIP unchanged.')
