from pathlib import Path
import hashlib
import json
import tomllib

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
DEST=ROOT/'deliverables/common-ground-ballot/2026-09-17-conflict-review-r25'
manifest=json.loads((HERE/'package-manifest.json').read_text())
digest=manifest['sha256']
gpt_trial=ROOT/'run-outputs/common-ground-ballot/run-067f97d6-7a35-4cd1-a9ee-0627707ac8a1/common-ground-ballot__pArUoq4'
details=json.loads((gpt_trial/'verifier/reward-details.json').read_text(encoding='utf-8'))
def score(dimension):
    c=details[dimension]['criteria']
    return sum(row['value']*row['weight'] for row in c)/sum(row['weight'] for row in c)
new=tomllib.loads((ROOT/'projects/common-ground-ballot/tests/functional/judge.toml').read_text(encoding='utf-8'))
total=sum(c['weight'] for c in new['criterion'])
earned=sum(c['value']*c['weight'] for c in details['functional']['criteria'])
estimate=.6*(earned/total)+.2*score('polish')+.2*score('visual')
scenario={'scope':'conditional calculation for unchanged previous GPT app; NOT a new scored model run','assumption':'all other r24 verdicts repeat; all six added outcomes fail, as the replay demonstrates absent review and leaked late feedback','functional_points':earned,'functional_total':total,'functional':earned/total,'polish':score('polish'),'visual':score('visual'),'projected_reward':estimate,'margin_below_0_7':.7-estimate,'fresh_model_or_presentation_variance_can_exceed_target':True}
(HERE/'previous-gpt-projection.json').write_text(json.dumps(scenario,indent=2)+'\n',encoding='utf-8')

report=f'''# Common Ground Ballot r25

[Upload common-ground-ballot.zip](../../../deliverables/common-ground-ballot/2026-09-17-conflict-review-r25/common-ground-ballot.zip).

The package strengthens actual product behavior and repairs the two demonstrated
Oracle evidence gaps. It contains **five verifiers, 77 criteria, including 57
Functional criteria**. It does not add six separate judge processes.

## What the new outputs established

The r24 Oracle eSkNnNN scored 0.9521 overall, Functional 0.9202 and every other
dimension 1. Functional completed in 1929 seconds. Its two missing observations
were Owen's immediate pre-vote revision and the expired-session Retry response.
The trace confirms the latter capture only matched PATCH, while the golden
preflight uses GET /api/me and may return an explicit signed-out body with 200.
The UI correctly hid protected work and restored the reminder on real sign-in;
the judge had not captured the relevant authentication response.

The same version's GPT-5.4-mini pArUoq4 scored 0.7885. Gemini scored 0.7777,
Haiku 0.5542 and NOP 0. These are historical platform results, not r25 scores.
See [the audited results](latest-run-audit.json).

## Changes

- The Functional plan saves before/vote/after packets for each accepted-vote
  revision comparison. An accidentally missed pre-read may be replaced only by
  a fresh equivalent actor/method control, never by rerunning a demonstrated
  failure into a pass.
- Session-expiry recovery observes the whole actual Retry chain. A real identity
  preflight may stop the write. Signed-out identity bodies need an unchanged-
  credential denial of the observed protected read as corroborating evidence;
  no reference-specific endpoint or HTTP status is required of submissions.
- The brief and golden app now provide draft conflict review. The opened copy,
  attempted edit and latest record are compared. Disjoint/matching changes
  combine; conflicting title/context/voting-definition fields require explicit
  choices. Review does not write until confirmed. A concurrent later edit causes
  another refusal and re-review; discarding sends no write, and an opened ballot
  stops editing. Reviewed saves use fresh IDs/current viewed revisions; old
  refusal receipts remain intact after later changes and restart.
- Six added Functional outcomes have weights 3, 3, 3, 1.5, 1.5 and 2. Existing
  weights are unchanged. Functional total is 73.5; new outcomes contribute 14.
- Late successful or signed-out Retry replies must not contaminate another
  account's workspace. A new explicit abandoned-tab case closes the Retry owner
  while its response is held, then requires explicit recovery in the surviving
  tab without an automatic resend or permanent busy flag. This strengthens the
  existing cross-tab criterion without duplicating initial-submit persistence.

Eight task files changed. All other 21 files match r24, including the server,
starter, seed, Dockerfiles, runner and score policy. Render, Constraints, Polish
and Visual judge/prompt files are byte-identical. Standard task version, keys,
verifier.env, timeouts and 0.6 Functional + 0.2 Polish + 0.2 Visual formula remain.
Mandatory Render/Constraints gates still reject empty, read-only or fake apps.

## Validation and iterations

- **78 golden browser checks pass:** 7 review, 7 identity/revision/abandoned-tab,
  19 recovery-helper and 45 broad product regressions. These include real Node/
  SQLite restarts, role/privacy matrices, receipts, result math, mobile layout,
  both themes and shared authentication gates. Review and recovery tests use the
  actual pinned Playwright MCP and private helper.
- **Six deliberate defects detected:** losing the remote field, preselecting
  conflicts, saving against an unseen revision, nonfunctional discard, an enabled
  save after opening, and late old-account feedback. The unseen-revision mutant
  has a concrete erroneous HTTP 200 witness, not just a browser timeout.
- **Six previous-GPT replay checks completed.** The unchanged app loses its
  refused edit and has no review path, leaks a late “Draft created” message into
  Leila's session, loses unreadable/expired-session reminders, and strands a
  reminder as in flight after its Retry tab closes. Initial same-profile sharing
  actually works; the revised test relies on the real abandoned-owner defect.
  Only disposable copies were used; original run artifacts remain untouched.
- **30 final runner checks and 294 ZIP checks pass.** Actual RewardKit discovers
  five dimensions/77 criteria, real golden startup is unprivileged, restart keeps
  session/data, the genuine Codex binary is preserved, and composition works.
  Model verdicts in runner checks are explicitly offline doubles.
- The first new harness run needed its automation reference initialized before
  use. Browser iteration then exposed CSS overriding the locked save button's
  hidden attribute; the golden now uses its existing hidden class too. All later
  review runs pass, including narrow-screen overflow and a real restart. Failed
  diagnostic iterations are not counted as passes.

[53-point local rubric review](rubric-review.md),
[57-row public requirement coverage](coverage-matrix.md),
[mutation evidence](mutation-results.json),
[golden checks](browser-check-summary.json),
[previous GPT replay](gpt-replay/gpt-replay-results.json),
[archive validation](zip-validation.json).

## Score limits

There is **no new autonomous Oracle, platform QC verdict or newly built GPT run**
for r25. No local provider credential was available. The validated image reused
pinned cached dependencies; this was not a clean network dependency-download
build. Local scripted passes cannot guarantee that the autonomous judge will
complete every observation or that a model will fail the new requirements.

For the unchanged previous GPT app, retaining its other old verdicts and applying
the observed missing new outcomes gives approximately **{estimate:.4f}**. This is
a [conditional projection](previous-gpt-projection.json), not a measured r25
score. Its margin below 0.7 is only {(.7-estimate):.4f}; a fresh implementation or
different presentation verdict can exceed 0.7. Do not claim the score target is
verified until the exact final ZIP completes a new platform run.

ZIP SHA-256: `{digest}`.
29 files, one common-ground-ballot wrapper, UTF-8/LF and executable shell modes.
'''
(HERE/'README.md').write_text(report,encoding='utf-8',newline='\n')
(DEST/'README.md').write_text(f'''# Common Ground Ballot r25

[Upload ZIP](common-ground-ballot.zip).

Adds draft conflict review to the brief and golden app, six Functional outcomes,
and explicit abandoned-tab recovery. Repairs vote-revision and session-preflight
evidence collection. Five verifiers / 77 criteria / 57 Functional criteria.

78 golden browser checks, six mutation controls, 30 runner checks and 294 ZIP
checks pass. Nonfunctional verifiers and standard scoring/configuration remain
unchanged. Fresh platform QC, scored Oracle and a new target-model run are still
required; local passes do not guarantee Oracle 1 or GPT below 0.7.

[Full validation report](../../../reports/common-ground-ballot/2026-09-17-conflict-review-r25/README.md).

SHA-256: `{digest}`.
''',encoding='utf-8',newline='\n')

index=ROOT/'deliverables/common-ground-ballot/README.md'
s=index.read_text(encoding='utf-8'); marker='| Folder | Contents |'; position=s.index(marker)
intro=f'''# Common Ground Releases

Latest candidate: [common-ground-ballot.zip](2026-09-17-conflict-review-r25/common-ground-ballot.zip).
**r25 adds draft conflict review, late-response isolation and abandoned-tab recovery,
and repairs both r24 Oracle evidence gaps.**
[Diagnosis, tests and limitations](../../reports/common-ground-ballot/2026-09-17-conflict-review-r25/README.md).

Latest supplied r24 platform scores: Oracle **0.9521**, GPT-5.4-mini **0.7885**,
Gemini **0.7777**, Haiku **0.5542**, NOP **0**. r24 removed the earlier MCP crash;
its remaining Oracle failures were missing before-vote/preflight evidence.

r25 passes 78 golden browser checks, six mutation controls, 30 runner checks and
294 ZIP checks. It has five verifiers, 77 criteria, 57 Functional criteria.
The four nonfunctional verifier definitions, standard environment/timeouts and
score formula are unchanged. Fresh platform QC and scored Oracle/model runs are
pending. The previous-app projection of {estimate:.4f} is conditional, not a new
model score, and has little margin below 0.7. Historical ZIPs remain unchanged.

'''
s=intro+s[position:]
s=s.replace('| --- | --- |\n','| --- | --- |\n| [2026-09-17-conflict-review-r25](2026-09-17-conflict-review-r25/) | Current: draft review golden/brief, six Functional outcomes, evidence repairs and abandoned-tab recovery; full external scores pending |\n',1)
s=s.replace('| Current: private helper file access and contained matcher exceptions; exact Oracle crash reproduced and recovery tested |','| Historical r24 platform Oracle 0.9521 / GPT-5.4-mini 0.7885; two Oracle evidence gaps and additional difficulty addressed in r25 |')
index.write_text(s,encoding='utf-8',newline='\n')
context=ROOT/'TASK_AUTHORING_CONTEXT.md';s=context.read_text(encoding='utf-8')
entry=f'''
## September 17: Common Ground conflict review r25 (current candidate)

ZIP: `deliverables/common-ground-ballot/2026-09-17-conflict-review-r25/common-ground-ballot.zip`.
SHA-256 `{digest}`.
Report: `reports/common-ground-ballot/2026-09-17-conflict-review-r25/README.md`.
Supplied r24 runs replace the previous active output folders: Oracle eSkNnNN
0.9521/F0.9202, all other dimensions1; GPT5.4mini pArUoq4 0.7885;
Gemini0.7777, Haiku0.5542, NOP0. Provenance matched frozen r24 before edits.
Oracle had two missing observations, not a timeout: pre-vote revision and a
PATCH-only Retry matcher missing GET /api/me with a 200 signed-out body.

r25 explicitly captures pre-vote checkpoints and the complete authentication
chain, corroborating signed-out preflight with a denied protected read. Adds
natural brief and golden client for three-way draft review: disjoint/matching
merges, explicit choices on title/context/atomic voting definition, second-edit
conflict with kept working copy, discard and lifecycle stop. Six new criteria
total14weight; previous weights unchanged; Functional total73.5,57criteria;
77overall,5judges. Existing cross-tab criterion now tests closing its in-flight
Retry owner and recovery in the surviving tab. Same-profile tooling is explicit.
Late-reply account isolation is the sixth new criterion. Receipt comparisons
remain owned by refusal_receipt_after_state_change (three saved refusals now).
Eight task files changed;21unchanged, including server/seed/starter/Dockerfiles/
runner and all four nonfunctional judge/prompt pairs. Standard version/config/
timeouts/score formula unchanged. Functional prompt r25; others unchanged.

78golden browser checks (7review,7identity,19recovery,45broad),6mutants,30runner,
294ZIP pass. Golden locked-save CSS issue fixed during iteration. Pinned real
MCP checks use the helper and actual browser; runner verdicts are offline doubles.
Actual previous GPT app replay confirms missing review, late feedback into Leila,
unreadable/expired reminder loss and abandoned-owner permanent busy. Initial
same-profile sharing works; do not repeat the old judge's incorrect witness.
Conditional previous-app projection {estimate:.4f} assumes all other old verdicts
repeat; tiny margin, not a new GPT score. Full platformQC/autonomousOracle/model
still unavailable without provider credentials. Do not claimOracle1/QC53of53/
freshGPTunder0.7. Localimage ballot-verifier:20260917-r25-runtime-validation uses
cached pinned dependencies, not clean downloadbuild. Historical ZIPs immutable.

'''
s=s.replace('# Current WebDev Task Authoring Context\n','# Current WebDev Task Authoring Context\n'+entry,1)
s=s.replace('## September 16: Common Ground Oracle transport repair r24 (current candidate)','## September 16: Common Ground Oracle transport repair r24 (historical candidate)',1)
context.write_text(s,encoding='utf-8',newline='\n')
assert hashlib.sha256((DEST/'common-ground-ballot.zip').read_bytes()).hexdigest()==digest
print(json.dumps({'sha256':digest,'projection':estimate,'report':str(HERE/'README.md')},indent=2))
