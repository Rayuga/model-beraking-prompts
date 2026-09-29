import json
from pathlib import Path

out = Path(__file__).resolve().parent
root = out.parents[2]
candidate = json.loads((out / 'candidate_manifest.json').read_text(encoding='utf-8'))
digest = candidate['sha256']
rel = out.relative_to(root).as_posix()
handoff = f'''# Ridgeline handoff - second full cross-check, 27 September 2026

This is the current Ridgeline candidate after the user's request for another complete cross-check. Read later user instructions before acting. Colderwater retains its separate [handoff](COLDERWATER_HANDOFF_2026-09-27.md) and archive; this review does not establish its results.

## Current candidate

- Source: `projects/ridgeline-print-storefront/`.
- [Replacement ZIP]({rel}/ridgeline-print-storefront.zip).
- SHA-256: `{digest}`.
- 51 files, {candidate['bytes']} bytes; verified CRC, safe single root, executable LF shell files and all source/extracted hashes.
- 25 Functional binary criteria / total weight 35; two gate, four Polish and six Visual criteria give 37 overall.
- Supersedes immutable `9944734b...` in `cross-check-2026-09-27/`. Earlier artifacts remain historical.

## Corrections

The fresh requirements-first review found five rubric gaps. The existing Polish label/focus criterion now reaches every named enabled control, and navigation follows an actual keyboard-only detail → catalogue → basket → catalogue route. Pointer setup/cleanup of an unplaced basket is allowed; no purchase or repeated Functional grading is added. The existing paper-filter criterion now includes completely sold-out Allotment in Colorplan Pristine White membership. Unsupported equal-price tie stability and forced same-origin API targets are removed. Replay uses the actual observed local server URL/credential policy, without inventing routes or allowing external backends. Restart setup explicitly records all 13 current variant stocks before the existing full comparison.

The harness reviewer reproduced an unbounded final EXIT wait on a SIGTERM-resistant app. Bounded TERM/KILL cleanup now preserves valid reward and original exit status and handles resistant children/already-exited apps. Final `tests/test.sh` SHA is `7644e994deefad7ce60ca93d20e4c7c5313df31ef70238689a044ef893c4ebbb`. The generated restart helper remains byte-identical to the prior actual-restart repair; canonical Python tools/scoring are untouched.

Only five task files changed: Functional judge/prompt, Polish judge/prompt and tests/test.sh. All 19 golden/installer files, public requirements/assets, config, Dockerfiles, gates and Visual rubric are unchanged. All criterion IDs, types, order and weights are preserved. Final Functional judge SHA is `35f8c85ee48078d35ed3b0769eb6a56954457232709a017dee5fe0abc215421f`.

## Evidence

Read [QC_FINAL.md]({rel}/QC_FINAL.md), [client-safe workbook]({rel}/QC_FINAL.xlsx), [full findings]({rel}/qc_final_findings.json), and [final binding]({rel}/final_candidate_binding.json).

- Fresh full quality review: 45 Pass, 8 Note, 0 Fail across 53 checks.
- All 48 documented mechanical procedures: 34 PASS, 10 NOTE, 4 N-A as local/manual equivalents; private platform implementations were unavailable.
- Final source and extracted source: 89/89 assertions each.
- Golden: eight fresh installed-MCP browser groups, 76 real keys, 21 screenshots and no page errors. Exact strengthened paper and keyboard flows pass.
- Harness: seven cleanup/exit cases and four fresh orchestration cases pass, including real restart. Independent review has 39 binding assertions.
- Semantic review: 45 requirement groups map bidirectionally to all 37 criteria; 20 monetary cases and 16 stock transitions pass.
- Final `20260927-second-crosscheck` images contain exact 12 public inputs and 15 verifier files; Chromium 152.0.7977.8. Independent release validation reopened the archive and actual images.

The golden map distinguishes fresh supplements from hash-reused unchanged observations. Existing actual restart proof includes all 13 stock quantities, exact placed/cancelled receipts and observed PID replacement. Prior five restart lifecycle controls and twenty synthetic scorer cases remain valid only for their unchanged helper/scorer scope. Current orchestration verifies their interaction with the repaired outer cleanup. Synthetic scores are never Oracle/model measurements.

## Remaining limits and next work

No concrete unresolved Ridgeline defect was found in this local review. Hosted rubric acceptance, full paid judge timing, aesthetic assignment, Oracle 1.0 and target model 0.1–0.7 remain unmeasured. Do not guarantee them. The scorer is still 60/20/20 with strict Functional > 0.05, and all semantic fixes retain weights. A conditional example where the nine high-weight transactional/adversarial checks fail but everything else passes yields about 0.606; this is arithmetic, not a forecast.

Judge route remains `claude-code` / `z-ai/glm-5.3-flashx`; supplied target builder is `gpt-5.6-luna`. No paid call, upload, commit or push occurred. A prior paid-run permission question remains unanswered; use any later explicit authorization without asking again, otherwise do not spend.

**Cross-task follow-up:** Colderwater's current `dc2ed5ac...` artifact contains the same original unbounded outer-cleanup pattern. It was not changed during this Ridgeline review. Its existing semantic/browser fixes remain separately documented, but do not claim its cleanup was repaired. Any follow-up must get its own affected harness tests, package/hash and handoff binding rather than silently swapping the ZIP.

Preserve unrelated work, previous artifacts and containers. Any later source edit requires affected tests, a replacement archive and updated evidence. The generic old helper's demand for database deletion conflicts with required durable restart; preserve its prior adjudication rather than adding a deletion.
'''
(root / 'RIDGELINE_HANDOFF_2026-09-27.md').write_text(handoff, encoding='utf-8')

for name in ['TWO_TASK_HANDOFF_2026-09-26.md', 'PARALLEL_AGENT_HANDOVER.md', 'handoffs/RIDGELINE_AGENT_PROMPT.md', 'handoffs/QC_AGENT_PROMPT.md']:
    path = root / name
    body = path.read_text(encoding='utf-8')
    link = '../RIDGELINE_HANDOFF_2026-09-27.md' if name.startswith('handoffs/') else 'RIDGELINE_HANDOFF_2026-09-27.md'
    update = f'**27 September Ridgeline second cross-check:** Current ZIP SHA `{digest}` (25 Functional criteria / weight 35). Read [the current Ridgeline handoff]({link}) before the historical snapshots below. Five rubric gaps and bounded final cleanup are corrected; the full 53/48 review and final archive/image binding are recorded there. Oracle/model outcomes remain unmeasured. The similar Coldwater cleanup pattern is a recorded separate follow-up, not silently repaired by this review.'
    lines = body.splitlines()
    matches = [i for i,line in enumerate(lines) if line.startswith('**27 September Ridgeline cross-check update:**') or line.startswith('**27 September Ridgeline second cross-check:**')]
    if matches:
        assert len(matches) == 1
        lines[matches[0]] = update
        body = '\n'.join(lines) + '\n'
    else:
        first, tail = body.split('\n',1)
        body = first + '\n\n' + update + '\n' + tail
    path.write_text(body, encoding='utf-8')

context = root / 'NEW_TASK_AUTHORING_CONTEXT.md'
title = '## 19. Ridgeline second review: concrete witnesses and bounded final cleanup'
lesson = f'''

{title}

The [second Ridgeline review]({rel}/QC_FINAL.md) exposed gaps even after a previous complete review. Treat the old PASS as scoped evidence, not proof that a new counterexample cannot exist.

Keyboard promises need actual product navigation, not only a few Tab stops. Assign labels/reachability/focus and real view transitions to distinct outcomes; allow normal/documented keys and harmless setup, without adding a purchase to a basic Polish check. Use real key events, never programmatic focus/click as a substitute.

Filter coverage must include the public boundary it claims to test. A paper filter tested only on prints with available stock cannot expose omission of wholly sold-out prints. Likewise, a restart comparison of “every recorded variant” is incomplete when setup explicitly records only one. State the entire required collection before the transition, include zero values and compare actual observations after it. Keep earlier failed verdicts separate from setup state.

Do not prescribe tie stability, endpoint/schema or target origin unless the public request does. Follow the app's observed local URL and credential policy; localhost and another permitted loopback origin can reach the same required server. Remove hidden restrictions while keeping the requested outcome strict.

Test final EXIT cleanup independently of the restart helper. A bounded restart does not prevent an unbounded final wait. Reproduce a resistant parent, surviving child, already-exited process, missing app, failed gate and original nonzero status; verify valid reward survives cleanup. Bound TERM/KILL waits and ignore zombies. Record any task-only deviation from an inherited template and bind affected fixtures to final hashes.

Cross-task defects need explicit scope. Finding an identical old helper in a sibling task is a follow-up, not evidence that the sibling was fixed. Preserve its current artifact and state the limitation until its own tests/package/handoff are updated.
'''
text = context.read_text(encoding='utf-8')
if title not in text:
    context.write_text(text.rstrip() + lesson, encoding='utf-8')

workflow = root / 'TASK_AUTHORING_WORKFLOW.md'
marker = 'For the final harness exit, run a separate resistant-process check'
extra = '''

For the final harness exit, run a separate resistant-process check even when restart tests pass. Assert bounded termination of parent/child process groups, preservation of valid or zero rewards and the original nonzero exit status. Re-run affected orchestration after repairing cleanup, while retaining unchanged helper/scorer evidence only by exact hash.

Before freezing a catalogue or durable-state rubric, write a concrete wrong implementation for each plural/boundary promise. Test a wholly sold-out item in the relevant filter, and record every required variant before restart rather than trusting a vague “all recorded” comparison. Verify observed local URL/credential handling and remove unrequested tie-order rules. For keyboard promises, prove real view changes separately from labels/focus, using ordinary or documented keys and harmless independent setup.

Reconcile all final workbook rows, including deterministic output text, with current counts and evidence. A newer summary can still contain old “24 criteria” or “unchanged test.sh” claims copied into individual rows. Reopen the client-safe workbook, compare every 53/48 entry to the final findings, bind the exact archive hash, and mark fresh versus reused observations explicitly.
'''
text = workflow.read_text(encoding='utf-8')
if marker not in text:
    workflow.write_text(text.rstrip() + extra, encoding='utf-8')
print(json.dumps({'updated_handoff': True, 'shared_notices': 4, 'lessons_updated': True, 'candidate_sha256': digest}))
