from pathlib import Path
import difflib, hashlib, json, tomllib

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/pellmoor-job-pipeline'
before=OUT/'source-before-batch'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
baseline=json.loads((OUT/'baseline-hashes.json').read_text())
assert {p.relative_to(before).as_posix():sha(p) for p in before.rglob('*') if p.is_file()}==baseline
configs={dim:tomllib.loads((TASK/f'tests/{dim}/judge.toml').read_text(encoding='utf-8')) for dim in ['render','constraints','functional','polish','visual']}
old_ids={c['id'] for c in tomllib.loads((before/'tests/functional/judge.toml').read_text())['criterion']}
new=[c for c in configs['functional']['criterion'] if c['id'] not in old_ids]
assert len(new)==8 and sum(c['weight'] for c in new)==19.5
lines=['# Pellmoor rubric map','',
'The executable rubric is in `tests/<dimension>/judge.toml`; this map is outside the task ZIP. All five prompt templates include the explicit shared browser/authentication gate, independent criterion scoring and public-asset policy. They retain the common judge configuration and the 60/20/20 final formula.','',
'| Dimension | Criteria | Aggregation / purpose |','|---|---:|---|',
'| Render | 2 | All-pass local sign-in rendering and response smoke checks |',
'| Constraints | 2 | All-pass local entry, same-origin application and reload checks |',
'| Functional | 40 | Weighted mean of behavioral outcomes; total criterion weight 98 |',
'| Polish | 10 | Keyboard, focus, labels, mobile reachability and concrete interaction usability |',
'| Visual | 6 | Existing anchored typography, contrast, spacing, hierarchy, craft and responsive consistency |','',
'## New Functional coverage','',
'| ID | Weight | Independent outcome |','|---|---:|---|']
outcomes=[
'Selection/blocked/ready preview and cancellation are read-only and show exact assessment/capacity data.',
'One whole successful batch, one vacancy revision, exact applicant history and linked ordered audit.',
'One invalid member or aggregate overcapacity cannot leave partial product writes.',
'Actor authorization, identifier shape/uniqueness/scope and server-owned field rejection.',
'Commit uses the reviewed revision; stale refusal requires explicit review and a new confirmation.',
'Batch/individual and overlapping-batch races accept either whole winner, never a partial batch.',
'Pending/lost response retains identity and input; explicit retry recovers the receipt and live view.',
'Business rejection remains historical after capacity release; success replay, array mismatch and actor/session scoping.'
]
for c,meaning in zip(new,outcomes):lines.append(f"| `{c['id']}` | {c['weight']} | {meaning} |")
lines += ['',
'The original 32 Functional criterion IDs and weights are preserved. The existing post-restart receipt criterion now includes saved batch success/rejection receipts; the shared durable audit remains the only judge-authorized restart. Existing Render/Constraints criteria are not expanded into batch-completion gates.','',
'The new weights allocate 3 points to commit integrity, invalid-batch atomicity, race arbitration and historical receipt semantics; 2 to authorization, reviewed confirmation and lost-response recovery; 1.5 to read-only preview fidelity. These represent distinct product outcomes. Existing failures are not duplicated or reweighted to force a target-model result. The 19.5 additional Functional points are not a guarantee of any model score.','',
'## Measurement rules','',
'Use the exact initial seed only before any mutations. Later tests use captured IDs, current revisions and relative snapshots. Create A/B/C/D through the visible UI; never assume generated ID values. Release capacity through legal actions, and obtain fresh scores after reopening interview. A preview does not authorize a stale commit. Take each transient checkpoint before another mutation.','',
'For success, compare applicant-owned fields separately from derived vacancy revision/readiness, which legitimately change when capacity changes. For rejection/replay, require full product-state equality. Exclude the permitted durable rejection receipt and authentication session maintenance from product-state comparisons.','',
'Race checks accept either legal winner and assert the exact consequences of that winner. Object-key order is immaterial; ordered candidate arrays are significant. Use fresh operation identities for new probes and exact saved identities for replay. Observe each applicant event ID; message presence alone cannot establish one-event semantics.','',
'Polish and Visual use existing persisted records. Batch selection, preview and cancellation are allowed read-only preparation; committing offers is not. A blocked review is a valid presentation surface when no current selection can succeed. No dimension demands golden selectors, URLs, exact pixels or a fixed race winner.','',
'## Full criterion inventory','']
for dim,config in configs.items():
 lines += [f'### {dim.title()}','']
 lines += [f"- `{c['id']}` — weight {c['weight']}" for c in config['criterion']]
 lines.append('')
(OUT/'RUBRIC_MAP.md').write_text('\n'.join(lines),encoding='utf-8')

outline='''# Pellmoor task outline

Build a local authenticated hiring workspace with the exact four seeded vacancies,
nine candidates and four accounts. Use the provided hiring, security, reliability
and interface instructions. Hiring rules take precedence. The new task remains
version 1.0.0 and retains the existing stack and operational configuration.

## Core workflow

Cal creates applications and arranges eligible panels. Ruth moves applicants
through applied, screening, interview, offer and hired; one-stage backsteps are
allowed and rejected/withdrawn records remain terminal. Assigned panel members
score their current assessments, and everyone can append attributed notes.
Panel changes and interview reentry invalidate old scores without deleting their
history. Capacity is derived from offered and hired applicants. The d3 funnel
is derived from actual stage-visit history, including backsteps and terminal loss.

## Batch offer workflow

Ruth selects applicants from one vacancy and previews eligibility, current
assessment versions and the whole selection's capacity impact. This is read-only.
Confirmation submits the reviewed revision and ordered selection as one operation.
Every applicant must be eligible and the complete selection must fit. One invalid
member rejects the entire batch. One accepted batch advances the vacancy revision
once, with one linked stage event per applicant and no aggregate extra event.

Batch and individual operations share the revision/capacity boundary. Stale
confirmation is refused, selection retained and explicit review required before
a new attempt. A lost response exposes an explicit retry of the exact original
operation. Durable success and business-rejection receipts remain historical
across capacity release, later actions, sessions and restart. Receipt replay
must not replace the UI's current server state with an old snapshot.

## Interface and delivery

Provide usable selection, review, blocked, pending, uncertain and completion
states; readable current/projected reserved, filled and available counts; named
controls; keyboard focus containment and dismissal; and coherent light/dark,
desktop and mobile layouts. Preserve the original candidate drawer, history,
notes, scores, activity and empty states.

The task ZIP contains only the task sources and five verifiers. Authoring
reports, screenshots, coverage maps and local diagnostic scripts stay outside
the ZIP. `solution/APP_MANIFEST.md` documents the golden runtime and routes;
models may implement different routes that satisfy the same visible contract.
'''
(OUT/'TASK_OUTLINE.md').write_text(outline,encoding='utf-8')

changes=[];diff=[]
for p in sorted(TASK.rglob('*')):
 if not p.is_file():continue
 rel=p.relative_to(TASK);old=before/rel
 if p.read_bytes()!=old.read_bytes():
  changes.append(rel.as_posix());diff.extend(difflib.unified_diff(old.read_text(encoding='utf-8').splitlines(True),p.read_text(encoding='utf-8').splitlines(True),fromfile='before/'+rel.as_posix(),tofile='after/'+rel.as_posix()))
(OUT/'source-changes.diff').write_text(''.join(diff),encoding='utf-8')
(OUT/'revision-manifest.json').write_text(json.dumps(dict(changed_files=changes,source_sha256={p.relative_to(TASK).as_posix():sha(p) for p in TASK.rglob('*') if p.is_file()},new_criteria=[dict(id=c['id'],weight=c['weight']) for c in new],total_criteria=60,full_platform_oracle_run=False,fresh_gpt_run=False),indent=2)+'\n')
print('Wrote outline, rubric map, source diff and revision manifest')
