from pathlib import Path
from decimal import Decimal
import hashlib,json,re,tomllib

task=Path('projects/colderwater-playground-devtools')
out=Path(__file__).resolve().parent
before=out/'before'
assert not before.exists(), 'Already applied; inspect changes rather than rerun.'
before.mkdir()
hashes={p.relative_to(task).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in task.rglob('*') if p.is_file()}
(out/'before_hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
for p in task.rglob('*'):
 if p.is_file() and p.suffix in ['.md','.toml','.sh']:
  q=before/p.relative_to(task);q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
def read(rel):return (task/rel).read_text(encoding='utf8')
def write(rel,s):(task/rel).write_text(s,encoding='utf8',newline='\n')
def replace(rel,a,b):
 s=read(rel);assert a in s,(rel,a[:60]);write(rel,s.replace(a,b))

(task/'tests/test.sh').write_bytes(Path('projects/webdev-task-template/tests/test.sh').read_bytes())
replace('environment/instructions/behaviour.md',"Don't rerun that document's old scripts or bring along its globals, timers or event handlers.","Don't rerun that document's old scripts or keep its active timers or event handlers.")
replace('environment/instructions/behaviour.md'," Follow new entries when I'm at the bottom; if I've scrolled up to read something, leave the view there.",'')
replace('environment/instructions/behaviour.md'," After I've interacted with the editor, a browser reload or leaving the page should also show the browser's own leave-page warning for dirty work.",'')
replace('environment/instructions/security.md',"People should be able to use the playground and load its intended browser assets without being able to download the working database, its companion files, backend code or internal project and repository files. Keep those working files private while serving the interface and the snippet data the app exposes. Source entered into the editor is never evaluated on the server.","Saving and loading snippets should store their source as text. Source entered into the editor is never evaluated on the server.")
replace('environment/instructions/ui.md',"Let me drag the dividers to resize them and keep those sizes after a reload. ",'')
replace('environment/instructions/ui.md'," When the cursor is beside either bracket of a complete pair, show the matching pair. For a selection of several lines, Tab should indent all of them consistently and Shift+Tab should take off one matching level without deleting code. Choose the indentation width yourself.",'')
replace('environment/instructions/ui.md'," Please show the working keyboard shortcuts for Run, Save and Clear console somewhere people can find them.",'')

remove={'cw_css_global_freshness','cw_working_files_private','cw_pane_dividers_work','cw_pane_sizes_persist','cw_editor_matching_brackets','cw_editor_multiline_indent','cw_editor_multiline_unindent','cw_console_scroll_policy','cw_native_dirty_leave_protection','cw_shortcut_run','cw_shortcut_save','cw_shortcut_clear'}
rel='tests/scored/functional/judge.toml';s=read(rel)
chunks=s.split('[[criterion]]');kept=[];removed=[]
for block in chunks[1:]:
 c=tomllib.loads('[[criterion]]'+block)['criterion'][0]
 (removed if c['id'] in remove else kept).append((c,block))
assert {c['id'] for c,b in removed}==remove
write(rel,chunks[0]+''.join('[[criterion]]'+b for c,b in kept))
replace(rel,'Both literal loops terminate within the allowed budget margin','Both top-level literal loops and the looping Promise callback terminate within the allowed budget margin')
replace(rel,"After the four-second callback actually emits late-callback-entered, it shares the original Run budget: timely termination/reason, no resumption and successful recovery; no fresh callback clock.","A working short nested-timer control produces its completion marker. With both delays increased to three seconds, the outer callback enters but the inner callback never completes: the original run times out, reports the reason and permits ordinary recovery. The callback does not receive a fresh run budget. Use S36's batched marker observation, not a one-second wall-clock distinction.")

rel='tests/scored/functional/prompt.md';s=read(rel)
sections=re.split(r'(?=^### S\d\d — )',s,flags=re.M)
head=sections[0];parts={int(re.match(r'### S(\d+)',p).group(1)):p for p in sections[1:]}
for n in [6,18,20,31,35]:del parts[n]
p=parts[2]
p=p.replace('About 39 UI actions','About 29 UI actions')
p=p.replace(' Before CSS, use the authored-realm observation below to confirm oldGlobal actually equals do-not-carry in the execution realm that produced this control.','')
p=p.replace(' Before any later JavaScript Run, separately observe that oldGlobal is absent/undefined in the matched current CSS execution state. A later fresh JS Run is not evidence about the preceding CSS state. Follow the authored-realm observation rule below; this global outcome is independent of the script/handler outcome.','')
p=re.sub(r'Authored-realm observation:.*?(?=5\. Separately establish)', '',p,flags=re.S)
parts[2]=p
parts[7]=parts[7].replace('S06','S05')
p=parts[9].replace('About 16 UI actions','About 20 UI actions')
p=p.replace('4. A normal recovery snippet renders and logs timeout-recovered afterward.',"""4. Separately run a looping supported Promise callback:
console.log('before-promise-hang');
Promise.resolve().then(() => { console.log('promise-loop-entered'); while (true) {} });
Observe promise-loop-entered, then the time-limit reason with the recorded last-good preview retained/restored. An app that reports only Promise rejection messages but cannot terminate this loop does not pass.
5. A normal recovery snippet renders and logs timeout-recovered afterward.""")
p=p.replace('either literal loop continuing beyond about eight seconds','any of these three supported loops continuing beyond about eight seconds')
parts[9]=p
parts[16]='''### S16 — console_controls

About 10 UI actions; execute once.

1. Run console.log('history-first'); and observe that entry and a measured run duration, not a placeholder.
2. Run document.body.innerHTML='<p>theme-shared-preview</p>'; console.log('history-second');. Both history entries remain in order. No particular console scroll policy is required.
3. Execute S34 using this actual completed state and nonempty console; do not repeat its setup Run. Then use Clear console: prior log rows disappear. Empty-state hints and unrelated status/duration labels may remain.

'''
parts[19]=re.sub(r'3\. In \.js source.*?Do not grade indentation width, editor package, DOM implementation or a specific highlight colour\.', 'Do not prescribe an editor package, DOM implementation or specific syntax palette.',parts[19],flags=re.S).replace('About 16 UI actions','About 10 UI actions')
parts[34]=parts[34].replace("S16's actually completed third Run", "S16's actually completed second Run")
parts[36]='''### S36 — cw_shared_run_deadline_recovery

About 16 UI actions; execute once. Use a single bounded browser automation call for each Run and its observations; do not compare separate LLM/tool timestamps.

1. With Auto-run off, run this supported positive control. Both nested callbacks must really execute and produce nested-control-done:
document.body.innerHTML='<p>nested-control-ready</p>';
setTimeout(() => { console.log('nested-control-entered'); setTimeout(() => { document.body.innerHTML='<p>nested-control-done</p>'; console.log('nested-control-done'); }, 200); }, 200);
Record the completed document as currentLastGood. An app that never runs timers cannot earn the negative result.
2. Use a fresh run with exactly these longer delays:
document.body.innerHTML='<p>failed-loop-candidate</p>';
setTimeout(() => { console.log('late-callback-entered'); setTimeout(() => { document.body.innerHTML='<p>forbidden-nested-completion</p>'; console.log('forbidden-nested-completion'); }, 3000); }, 3000);
Observe late-callback-entered. The nested callback is due six seconds after Run, beyond the single five-second budget. Observe through ten seconds after the real Run action in one browser call, recording visible run status, preview text and new console entries. A time-limit reason must appear, forbidden-nested-completion must never be emitted/rendered, and currentLastGood must be retained/restored. This uses an actual callback outcome, not a distinction between an eight-second and nine-second tool response. Do not require unrelated controls to remain responsive while code is executing.
3. Run ordinary source that renders shared-deadline-recovered and logs shared-deadline-recovered-log. Both appear and no old callback may replace them. If the control or callback entry cannot execute because of an observed app defect, score the affected outcome without inventing absence-based success.

'''
head=head.replace('37 named protocols','32 named protocols')
start=head.index('## Seven-phase execution plan')
head=head[:start]+'''## Six-phase execution plan

1. Workspace: S01 steps1-2, S14, S15, S16 with S34 before Clear, then S19. Defer S01's example Save leg.
2. Early persistence: S21, immediately S22's one actual process restart, then S23. Keep each protocol's records distinct.
3. Execution: S02, S03, S04, S08, S09, S10, S11, S12, S13, S36 and S37. Reuse an actually completed recovery preview as the next negative protocol's last-good control when its exact fixture permits; otherwise create one control.
4. Auto-run/files: S17, S33, S32. Reuse S17's actually successful final manual Run as S33's initial preview control.
5. Library: deferred S01 Save leg, then S24, S25, S26, S27, S28 and S29. Read current identities/revisions and refresh them after any unexpected mutation.
6. Dirty-work protection and boundaries: S30, S05 and S07. S07 may reuse S05's actually successful final recovery as its own-document control. Close only probe contexts and remove only the routing handlers installed by S07.

Batch related actions using browser_run_code_unsafe after discovering controls. Record snapshots on meaningful state transitions or uncertain locators, not after every field edit. Put timed fixtures and their bounded waits in one browser call; judge visible markers and outcomes, not time between model replies. Multiple rows reuse a protocol's collected observations without repeating it. Failed product features affect their own outcomes; use the stated independent controls rather than cascading verdicts. Every required observation must still be made. This reduces redundant work but does not establish full judge completion time; the canonical9000-second budget is unchanged.

'''
s=head+''.join(parts[n] for n in sorted(parts))
s=s.replace('seven-phase plan','six-phase plan').replace('Seven-phase','Six-phase')
s=s.replace(' S06 permits bounded navigation/response/download outcomes and observed public roles, never response-body classification or downloaded implementation contents.','')
s=s.replace('For S31, make real keyboard input before native leave testing. Dismiss the actual native warning first; do not suppress/auto-accept it. Cancelled navigation may time out in automation: judge retained page/draft, not the exception wording.','')
s=s.replace('without old scripts/globals/timers/handlers','without old scripts, active timers or event handlers')
write(rel,s)

guidance='''## Evidence failures

Score observed application behavior independently. Retry a transient evaluator operation once when safe; never repeat a completed saved write or the single process restart. If observation remains unavailable, state exactly what could not be observed and distinguish a tool failure from a product failure. Do not invent a pass or a special reasoning prefix. Return supported outcomes for the remaining criteria; an unavailable observation must not erase unrelated observed credit. The standard RewardKit/scorer handles returned results. This does not guarantee recovery from a whole judge-process timeout.
'''
for p in (task/'tests').rglob('*.md'):
 s=p.read_text(encoding='utf8')
 if '## Evaluation failures' in s:s=s.split('## Evaluation failures')[0]+guidance
 if p.name=='app_context.md':
  s=re.sub(r"The app's working database.*?## Library and state",'## Library and state',s,flags=re.S)
  s=s.replace('without rerunning its old script or keeping its globals, timers or handlers','without rerunning its old script or keeping active timers or handlers')
 s=s.replace('Tool-evidence failure instead uses EVALUATION_INCOMPLETE below.','Unavailable tooling follows the shared evidence-failure guidance.')
 s=re.sub(r'If required evidence remains unavailable, begin affected structured reasoning exactly `EVALUATION_INCOMPLETE:` and explain it\. Binary `score: "no"` is then only a schema placeholder; the harness rejects that evaluation as ungraded\. Never copy that marker from the app or use it for an observed defect\.', 'If required evidence remains unavailable, explain the missing observation under the shared evidence-failure guidance. Never invent a pass.',s,flags=re.I)
 s=s.replace('EVALUATION_INCOMPLETE: in structured reasoning','the shared evidence-failure guidance')
 s=s.replace('report the incomplete-evaluation marker rather than grading the app','report the missing observation under the shared evidence-failure guidance')
 s=s.replace('report the incomplete-evaluation marker','follow the shared evidence-failure guidance')
 s=s.replace('incomplete-evaluation protocol','evidence-failure guidance').replace('incomplete-evidence rule','evidence-failure guidance')
 p.write_text(s,encoding='utf8',newline='\n')

# Keep the control tour, but let four independently useful observations earn
# their own credit. Total contribution stays1.0, total Polish stays4.0.
rel='tests/scored/polish/judge.toml';s=read(rel);blocks=s.split('[[criterion]]');new=[];tour=''
for b in blocks[1:]:
 c=tomllib.loads('[[criterion]]'+b)['criterion'][0]
 if c['id']!='labelled_controls_and_focus':new.append('[[criterion]]'+b);continue
 tour=c['description'].strip()
 definitions=[
 ('cw_controls_have_names',.25,'During P02, every requested enabled control has a visible label or accessible name identifying its purpose. Judge names independently of reachability, focus styling and successful navigation.'),
 ('cw_controls_keyboard_reachable',.25,'During P02, use actual keyboard events to reach every requested enabled control, including native/composite menus and labelled import triggers. Disabled controls need not be tab stops. Judge reachability independently of names, visible focus and successful view changes.'),
 ('cw_controls_focus_visible',.25,'During actual P02 keyboard traversal, reached controls have visible focus feedback; native outlines are valid. An unreachable control affects the reachability outcome and does not erase focus credit for controls reached. If no control can receive keyboard focus, this outcome lacks positive evidence and fails.'),
 ('cw_keyboard_library_navigation',.25,'During P02 use only actual keyboard actions to leave the editor, choose an example, load the recognisable saved control and return to the editor. Observe the correct example and saved source. Standard editor escape keys are valid without documentation. Judge navigation and return independently of labels or focus appearance; pointer setup is allowed before the route, not during it.')]
 for key,weight,description in definitions:
  new.append(f'[[criterion]]\nid = "{key}"\nname = "{key}"\ntype = "binary"\nweight = {weight}\ndescription = """\n{description}\n"""\n\n')
write(rel,blocks[0]+''.join(new))
rel='tests/scored/polish/prompt.md';s=read(rel).replace('The labelled-controls criterion owns the\nbounded keyboard navigation route it describes.','The P02 tour supplies independent names, reachability, focus and navigation outcomes.')
tour=tour.replace('with visible focus on the controls used; native focus styling is valid','recording reachable controls and their visible focus separately; native focus styling is valid')
tour=tour.replace('do not regrade Run/Save/Clear shortcuts, execution semantics, revision rules or persistence here','do not regrade execution semantics, revision rules or persistence here')
s=s.replace('{criteria}','## P02: one shared control tour\n\n'+tour+'\n\nA missing label or failed navigation step must not cancel the other observations. Use pointer setup to reach the next surface if needed, but never claim a keyboard route used a pointer. Keep separate evidence for each outcome.\n\n{criteria}')
write(rel,s)
remaining=tomllib.loads(read('tests/scored/functional/judge.toml'))['criterion']
changes={'removed_criteria':[{k:c[k] for k in ['id','weight']} for c,b in removed], 'functional_count':len(remaining),'functional_weight':str(sum(Decimal(str(c['weight'])) for c in remaining)), 'shared_protocols':len(parts),'polish_count':7,'golden_source_changed':False,'remaining_risk':'Full configured-judge duration and Oracle score remain unmeasured.'}
(out/'changes.json').write_text(json.dumps(changes,indent=2)+'\n')
print(json.dumps(changes,indent=2))
