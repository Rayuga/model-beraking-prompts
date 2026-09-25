from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
m = json.loads((HERE / 'package-manifest.json').read_text(encoding='utf-8'))
slug = '2026-09-17-review-safety-r27'
report = f'''# Common Ground Ballot r27 recheck

[Download the replacement ZIP](../../../deliverables/common-ground-ballot/{slug}/common-ground-ballot.zip).

The recheck found a real golden-client race and two gaps in round evidence.
They are fixed. **101 golden browser checks, eight deliberate round defects,
30 runner checks and {m['zip_checks_passed']} ZIP checks pass.** This is local validation;
no fresh autonomous Oracle, target-model or platform rubric score is available.

## Findings and repairs

The exact previously delivered r26 ZIP was extracted and its SHA-256 and every
file checked against its manifest. All 96 existing browser checks passed again,
including the core workflow followed by rounds on the same mutated database.
An additional held-response test then found three failures: changing a conflict
choice could re-enable Save during a reviewed save, Discard remained available
after that action had been sent, and a late accepted reply closed a newer form.

The golden now guards the whole in-flight review and disables its choice, Save
and Discard controls. A response only resets or closes the review that sent it;
it leaves newer work intact. The four-check race regression now passes, together
with the existing seven draft-review checks. The frozen failing r26 evidence is
preserved in [the independent recheck](../2026-09-17-r26-independent-recheck/review-race/review-race-results.json).

The public brief already requires checking every reviewed Member revision,
including paused Members. The old rubric checked an active-set change and an
active Member's change-and-return, leaving a loophole for validating only active
Members. It now also exercises paused -> active -> paused before confirming the
old review. The second gap was receipt identity: changed target and ballot
revision were tested, but a changed roster revision was not. It is now probed
separately under the original operation ID. Deliberately skipping inactive
revisions or excluding the roster from the receipt fingerprint fails the new
checks. The existing golden server passes both without changes.

Round persistence now replays four original refusals: one draft conflict and
three roster conflicts, before and after restart. These remain distinct from
the three ordinary domain refusals in the existing execution plan.

## Validation evidence

| Local check | Result |
| --- | --- |
| Core browser workflows, then rounds on the same database | 45 + 19 pass |
| Draft review | 7 pass |
| Held reviewed-save response and newer form | 4 pass |
| Vote revision evidence, expired session, late account replies, closed Retry owner | 7 pass |
| Actual pinned MCP helper and six action-family recovery | 19 pass |
| Deliberately broken round implementations | 8 of 8 detected |
| Runner, discovery, helper/provenance and score composition | 30 pass |
| Final ZIP paths, contracts, encodings, permissions and byte equality | {m['zip_checks_passed']} pass |

The integrated workflow took 144 seconds, helper suite 117 seconds and identity
suite 42 seconds. These are scripted regression durations, not predictions of
autonomous LLM judging time. A browser check can contain multiple assertions;
101 checks does not mean 101 scoring criteria.

All eight round mutations fail on a concrete outcome: partial commit, ignored
change-and-return, order-sensitive receipts, recomputed refusals, role bypass,
Retry using newer revisions, active-only Member revisions, and omitted roster
receipt identity. The reference completes the same sequences. Mutations run in
disposable copies; the source and final archive contain none of them.

The [53-point local rubric review](rubric-review.md) and
[66-row public requirement map](coverage-matrix.md) reconcile the current
criteria with the brief. They are author reviews, not a platform 53/53 result.
[Mutation observations](round-mutation-results.json),
[golden round checks](integrated/rounds-results.json),
[review race checks](review-race/review-race-results.json), and
[ZIP validation](zip-validation.json) retain the concrete evidence.

## Scope and limits

Only four of 29 task files differ from r26: the golden browser client,
Functional judge/prompt, and human README. No new public requirement, criterion
or weight was added. The instruction, server, starter, seed, installer, both
Dockerfiles, runner/private helpers, standard task settings, version, timeouts
and all four other verifiers are byte-identical. There remain **five verifier
dimensions, 86 criteria and 66 Functional criteria**, total Functional weight
103.5. The mandated gated 0.6/0.2/0.2 formula is unchanged.

No provider credential was available locally. Runner score tests use explicit
offline verdict doubles; browser tests use real Node, SQLite and the pinned
Playwright MCP. The final verifier source was built over cached dependency
layers, not downloaded in a fresh clean build. Oracle 1, platform rubric
acceptance and GPT <=0.6 still need measurements from this exact uploaded ZIP.

The latest supplied measured scores remain r24: Oracle 0.9521 and GPT-5.4-mini
0.7885. The unchanged previous GPT app's conditional projection remains 0.5849,
assuming all old verdicts repeat and it fails the added review/round work. It is
not a fresh model score. This recheck does not lower scores by changing weights.

The main remaining execution risk is evidence collection by the autonomous
Functional judge across 66 criteria. Its 7200-second budget and the 20-minute
persistence reserve are unchanged; the latest older Functional run took 1929
seconds. Local passing tests cannot guarantee that the autonomous judge gathers
every required observation or assigns full subjective visual marks.

ZIP SHA-256: `{m['sha256']}`.
29 files; {m['bytes']} bytes; one common-ground-ballot wrapper; UTF-8/LF;
executable shell modes. The r26 archive is unchanged.
'''
(HERE / 'README.md').write_text(report, encoding='utf-8', newline='\n')

p = ROOT / 'deliverables/common-ground-ballot/README.md'
old = p.read_text(encoding='utf-8')
table = old[old.index('| Folder |'):]
table = table.replace('Current: atomic reviewed rounds; 96 browser checks, six new mutation controls; fresh platform scores pending',
                      'Previous atomic-round candidate; r27 fixes review race and closes two rubric gaps')
table = table.replace('| --- | --- |', f'| --- | --- |\n| [{slug}]({slug}/) | Current: golden review-race fix, two coverage fixes; 101 browser checks and eight round mutation controls |', 1)
p.write_text(f'''# Common Ground Releases

Latest candidate: [common-ground-ballot.zip]({slug}/common-ground-ballot.zip).
**r27 fixes a golden draft-review race and two existing round-criterion gaps.**
[Changes, evidence and limitations](../../reports/common-ground-ballot/{slug}/README.md).

101 golden browser checks, eight round mutation controls, 30 runner checks and
{m['zip_checks_passed']} ZIP checks pass. Five verifiers, 86 criteria, 66 Functional criteria.
No public requirements, weights, standard runtime settings or timeouts changed.

Fresh platform QC, Oracle 1 and GPT <=0.6 remain unverified. The old GPT's
conditional projection is 0.5849, not a new scored run. Latest actual platform
scores remain r24: Oracle 0.9521 and GPT-5.4-mini 0.7885.

'''+table, encoding='utf-8', newline='\n')

p = ROOT / 'TASK_AUTHORING_CONTEXT.md'
old = p.read_text(encoding='utf-8').replace('## September 17: Common Ground atomic rounds r26 (current candidate)',
                                          '## September 17: Common Ground atomic rounds r26 (superseded by r27)', 1)
header = '# Current WebDev Task Authoring Context\n\n'
assert old.startswith(header)
note = f'''## September 17: Common Ground recheck r27 (current candidate)

ZIP: `deliverables/common-ground-ballot/{slug}/common-ground-ballot.zip`.
SHA256 `{m['sha256']}`.
Report: `reports/common-ground-ballot/{slug}/README.md`.
Latest user asked to test golden and rubric one more time. The frozen exact r26
ZIP passed its 96 existing checks, but a new held reviewed-save test reproduced
three client failures: choices could re-enable Save, Discard stayed enabled, and
a late reply closed a newer form. r27 fixes the in-flight review guard/controls
and response ownership. Existing golden server is unchanged.

Two existing round rubric gaps closed: paused -> active -> paused revision race,
and membership-revision-only collision under an original round receipt ID.
Round replay now retains four original refusals (draft plus three roster races).
No instruction, weights, criterion IDs, runtime or four nonfunctional verifiers
changed. Only client app.js, Functional judge/prompt and README differ from r26.

101 browser checks pass: 45 core + 19 round sequentially on one database,
7 review + 4 review race + 7 identity + 19 helper. All eight round mutants are
detected; 30 runner and {m['zip_checks_passed']} ZIP checks pass. Five verifiers,
86 criteria, 66 Functional criteria, total weight 103.5. Local 53-point rubric
review and 66-row coverage map retained. All scripts/evidence are outside ZIP.

No fresh autonomous Oracle/model/platform QC run: provider credential absent.
The runner uses explicit offline verdict doubles; actual browser, SQLite and
MCP behaviors are real. Cached dependency images reused. Latest supplied actual
scores remain r24 Oracle 0.9521/GPT 0.7885. Old GPT conditional projection 0.5849
is not a fresh result. Full autonomous duration and subjective scores remain
unmeasured. Do not promise Oracle 1 or platform rubric acceptance.

'''
p.write_text(header+note+old[len(header):], encoding='utf-8', newline='\n')
print('Wrote r27 evidence report and current-candidate indexes.')
