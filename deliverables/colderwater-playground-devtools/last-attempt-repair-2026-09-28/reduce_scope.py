"""Second, explicit product-scope reduction; the fixed harness is untouched."""
import json,re,tomllib
from decimal import Decimal
from pathlib import Path
root=Path(__file__).resolve().parents[3]
task=root/'projects/colderwater-playground-devtools'
out=Path(__file__).resolve().parent
def read(p): return (task/p).read_text(encoding='utf-8')
def write(p,s): (task/p).write_text(s,encoding='utf-8',newline='\n')
removed_protocols={'S25','S26','S27','S28','S29','S30','S32','S33','S37'}
p='tests/scored/functional/judge.toml'
parts=read(p).split('[[criterion]]')
removed=[];keep=[]
for part in parts[1:]:
 c=tomllib.loads('[[criterion]]'+part)['criterion'][0]
 if c['description'].strip()[:3] in removed_protocols or c['id']=='cw_rename_title_only': removed.append({'id':c['id'],'weight':c['weight']})
 else: keep.append(part)
assert len(removed)==24, len(removed)
s=parts[0]+''.join('[[criterion]]'+part for part in keep)
s=s.replace('after both creation and rename.','after creation and an ordinary Save update.')
write(p,s)
p='tests/scored/functional/prompt.md';s=read(p)
for scenario in removed_protocols:
 s,n=re.subn(r'^### '+scenario+r' .*?(?=^### S|^## Binary|\Z)','',s,flags=re.M|re.S);assert n==1,(scenario,n)
s=s.replace('The 32 named protocols','The 23 named protocols')
s=s.replace('S23, S25 and S28 require two live editors and the real dirty conflict/prevention flow: attempt B\'s relevant Save, Rename or Delete when enabled, or observe proactive prevention with useful feedback and exact dirty-field retention. Deliberately preventing Rename/Delete on unsaved work is also valid if the reason is clear and a usable latest/reapply route preserves that draft; an unexplained missing feature is not prevention.',"S23 requires two live editors and the real dirty Save conflict/prevention flow: attempt B's Save when enabled, or observe proactive prevention with useful feedback and exact dirty-field retention. An unexplained missing feature is not prevention.")
s=s.replace('Observe duplicate/create separately if it uses another path. ','')
s=s.replace('Collision/filename probes','Title collision probes')
s=s.replace('Use the actual import input; in-memory named bytes are valid. Verify actual downloaded filename/source through browser tools, not a toast. \n\n','')
s=s.replace(' S27 confirmation, S28 stale delete and S29 removed-identity update use separate records; confirmation offered during server-only setup may be completed without scoring it there.','')
s=s.replace("S22 owns its independent New/Save fixtures and has no Duplicate/Delete/execution prerequisite.","S22 owns its independent New/Save fixtures; executing their source is not a prerequisite.")
s=s.replace('Duplicate, Delete and execution of either snippet are not prerequisites or graded actions here.','Execution of either snippet is not a prerequisite or graded action here.')
s=s.replace('A later user interaction starts its own budget; input during pending work may be accepted, ignored or blocked but cannot reset the clock. Do not force hidden/disabled controls. Pending DOM display is optional. Rollback retains/restores the most recent successful render, including a successful interaction, and may be static.','Later click/key/input handlers must work after an idle interval. Do not force hidden/disabled controls. Pending DOM display is optional. Failed Runs restore their preceding successful render; it may be static.')
s=s.replace('In phase 6, choose that recorded original example again','In phase 5, choose that recorded original example again')
s=s.replace('S13, S36 and S37.','S13 and S36.')
s=s.replace("4. Auto-run/files: S17, S33, S32. Reuse S17's actually successful final manual Run as S33's initial preview control.","4. Auto-run: S17.")
s=s.replace('then S24, S25, S26, S27, S28 and S29.','then S24.')
s=s.replace('6. Dirty-work protection and boundaries: S30, S05 and S07.','6. Boundaries: S05 and S07.')
start=s.index('### S24 ');end=s.index('### S34 ',start)
s=s[:start]+'''### S24 — saved_title_rules

About 28 UI actions; execute once. Use ordinary New and Save throughout; no separate Rename feature is required.

1. Save two independent snippets: title "  QC Title Source  " with two edge spaces, filename title-a.js and source console.log('title-a');, then QC Title Sibling with title-b.js and console.log('title-b');. Record their identities, fields and revisions from the successful UI writes and fresh reads. Source's stored title is QC Title Source. With Source loaded, change its title to "  QC Title Updated  " and Save. It becomes QC Title Updated on the same identity. Record the actual current Save format.
2. Using Source's CURRENT revision and otherwise valid fields, attempt to Save its title as QC Title Sibling through the UI. Observe useful refusal. If the UI prevents the request, replay that observed Save format in-page with the colliding title. Independently try "  QC Title Sibling  ". Both complete records/revisions remain unchanged. Refresh actual state before the next probe if a defective write mutated it.
3. With otherwise-valid current fields, separately try empty and whitespace-only titles using the observed Save format. Each is refused without changing saved fields or revision. An unrelated error, stale revision or broken endpoint is not title validation.
4. Save a separate new record titled qc title sibling with its own filename/source. It coexists with QC Title Sibling under a different identity; load each to verify its own fields. Finally Save Source under unused title QC Title Recovered and verify it succeeds without changing either sibling. This successful recovery is the positive control for title refusals. Do not require a particular title-editing layout or title length limit.

'''+s[end:]
write(p,s)
p='instruction.md';s=read(p).replace('I also need to start a fresh draft, bring in a source file or download what I\'m working on.','I also need to start a fresh draft and return to something I saved earlier.');write(p,s)
p='environment/instructions/overview.md';s=read(p).replace('I can save and load snippets, rename them, make independent copies and delete ones I no longer need. Import and export each deal with a single source file.','I can save a new snippet, update the one I have open and load something I saved earlier.').replace('The library and file-handling details','The library details');write(p,s)
p='environment/instructions/behaviour.md';s=read(p)
s=s.replace('That deliberate click, keyboard action or input starts a new interaction with its own five-second budget, including any timers or Promise callbacks it schedules. More clicks or typing while that work is still pending mustn\'t extend its deadline. ','')
s=s.replace('The same goes for an interaction with a completed preview: keep its changes only when it succeeds, and otherwise restore how the preview looked before that interaction. ','')
s=s.replace('A new draft or duplicate makes a separate record.','A new draft makes a separate record.')
s=s.replace('Source filenames are single filenames with .js, .html or .css extensions, case-insensitively. Explain a rejected title collision or unsupported filename without changing either saved record.','Use .js, .html or .css source filenames, case-insensitively. Explain a rejected title without changing any saved record.')
s=re.sub(r'\nRename changes only.*?\n\n','\n',s,flags=re.S)
s=s.replace('saving, renaming or deleting refers to the revision that editor loaded.','Save refers to the revision that editor loaded.')
s=s.replace(" An old editor mustn't delete newer work or recreate something that's already been deleted.",'')
s=s[:s.index('## Unsaved work and files')].rstrip()+'\n'
write(p,s)
p='environment/instructions/security.md';s=read(p).replace('A run, or a new interaction with the completed current preview, has five seconds','A run has five seconds');write(p,s)
p='tests/app_context.md';s=read(p)
start=s.index('The editor, preview');end=s.index('## Runtime expectations')
s=s[:start]+'''The editor, preview and console workspace; title and filename fields; Run, Stop, Auto-run and Clear console; examples, a saved-snippet library, New and Save; and a theme toggle. Controls may use any usable layout. Stale Save has independent server-refusal and dirty-editor recovery outcomes. Use two actual editors with recorded dirty title, filename and source. An enabled UI attempt or clear proactive conflict prevention with exact draft retention is valid. Do not force disabled controls. A request replay alone cannot prove dirty-editor behavior; replay the observed old-revision request separately when prevention suppresses it. No specific recovery control is required.

'''+s[end:]
s=s.replace('a later deliberate interaction starts its own five-second budget, while further input during pending work does not extend the existing deadline.','ordinary click, key and input handlers remain usable after an idle interval.')
s=s.replace('A successful interaction becomes the state to preserve if the next interaction fails. ','')
s=s.replace('Rejected stale saves, stale renames, stale deletes, title collisions and invalid filenames','Rejected stale saves and invalid titles')
write(p,s)
p='tests/scored/polish/prompt.md';s=read(p).replace('New, Save, Rename, Duplicate, Delete, Import and Export','New and Save').replace('A hidden file input may use a labelled keyboard-reachable trigger. ','').replace('do not delete, rename, duplicate, import or export work merely to inspect focus, or open a native file dialog.','do not mutate saved work merely to inspect focus.');write(p,s)
p='tests/scored/polish/judge.toml';s=read(p).replace('including native/composite menus and labelled import triggers','including native/composite menus');write(p,s)
changes=json.loads((out/'changes.json').read_text());changes['removed_criteria']+=removed
rows=tomllib.loads(read('tests/scored/functional/judge.toml'))['criterion']
changes.update(functional_count=len(rows),functional_weight=str(sum(Decimal(str(c['weight'])) for c in rows)),shared_protocols=23)
(out/'changes.json').write_text(json.dumps(changes,indent=2)+'\n')
print(json.dumps(changes,indent=2))
