from pathlib import Path
import json,hashlib,tomllib,datetime
root=Path.cwd();out=root/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27';task=root/'projects/colderwater-playground-devtools'
G='runtime/golden/golden-browser-results.json';S='runtime/supplement/supplement-results.json';R='runtime/runtime/browser-evidence/runtime-results.json';L='runtime/library/browser-evidence/library-results.json';E='runtime/errors/independent-runtime-results.json';N='runtime/network/network-boundary-results.json';B='runtime/budget/title-and-shared-budget-results.json';V='runtime/validation/validation-boundaries-results.json';P='presentation-final/presentation-results.json';D='final-runtime-details.json';M='actual-mcp-results.json'
mapping={
'initial_examples':([G,S],'Automatic example, selected counter example and newly authored DOM/log outputs execute.'),
'language_dispatch':([D,S],'JS/HTML/CSS dispatch; CSS retains heading and styling without old scripts or click handlers; fresh JS drops globals and logs.'),
'fresh_cancel':([S],'A is awaiting its timer when B starts; no late A output after six seconds; real Stop explains cancellation, restores B and prevents delayed output; recovery succeeds.'),
'cw_preview_origin_isolation':([N],'Four parent document/storage reads and writes blocked; host state unchanged; own-document control and recovery work.'),
'cw_preview_network_requests_blocked':([N],'Unprotected routed text/image controls succeed; separate preview fetch/image attempts give refusal with zero handler deliveries; recovery works.'),
'cw_runtime_files_not_publicly_exposed':([M,'large-controls-mcp-results.json'],'Actual MCP inspects all three bounded responses and returns classification only; golden passes, synthetic whole-app static leaks fail. SPA200, wrong MIME, frontend metadata, decoy words and large benign prefixes do not falsely fail.'),
'cw_unsupported_execution_refusal':([G,E],'Valid names in HTML/strings/comments execute; all five unsupported families separately refuse, retain last-good preview and permit recovery.'),
'cw_execution_budget_termination':([D],'Braced and unbraced loops have separately measured deadlines, initial log, visible reason, responsive theme action, rollback and recovery.'),
'cw_js_error_line_and_preview_restore':([E],'Own good/error/recovery sequence: user JS line 4 and forEeach error, failed candidate rolled back.'),
'cw_html_error_document_line_and_preview_restore':([E],'Own good/error/recovery sequence: complete HTML user line 6 and undefinedFunctionCall.'),
'cw_timer_error_line_and_preview_restore':([E],'Own good/error/recovery sequence: delayed exception at source line 2 and rollback.'),
'cw_promise_rejection_line_and_preview_restore':([E],'Own good/error/recovery sequence: rejection at source line 2 and rollback.'),
'console_levels':([S],'Exact ordered values with explicit log/warn/error/info labels; console.error is only a logged value.'),
'console_objects':([S],'Actual expansion reveals tag, nested/deep value and all array values 11/22/33.'),
'console_controls':([S],'Forty ordered rows and measured duration; scrolled-up position stays, bottom follows; Clear removes rows.'),
'auto_run':([R,S],'Auto-on/off, queued cancellation and later manual Run; repeated edits over two measured pauses produce no intermediate run and execute only final edit after idle.'),
'pane_resize':([D],'Actual editor width and preview height change, remain usable and restore after reload.'),
'editor_basics':([S,L],'Computed syntax colors for JS/HTML/CSS, monospaced text, real gutter and highlighted matching braces.'),
'editor_indent':([S],'Equal indentation on every selected line, selection retained, exact Shift+Tab restoration.'),
'save_load':([S],'Two independent records retain exact identity/title/filename/source before and after reload.'),
'persistent_snippets':([S],'Winner changes all three fields; stale save refuses without erasing draft or winner; latest reload/reapply saves and survives reload.'),
'cw_title_change_uniqueness':([S,V,G],'Normal rename; current-revision duplicate/trim/empty/whitespace refusals without mutation; case-only distinct titles; unused-title recovery.'),
'cw_stale_rename_preserves_newer_record':([G],'Real stale UI rename refuses with conflict and retained dirty draft; exact newer record survives; latest rename recovers.'),
'cw_independent_snippet_copy':([S],'Independent identity and exact copy, isolated edit, duplicate-title create refusal and successful extra copy.'),
'delete_confirm':([S],'Cancel, positive control delete, stale-delete refusal, current delete and deleted-ID update refusal without sibling mutation.'),
'cw_dirty_workspace_transition_warnings':([G,B,V],'Independent saved/example/New/import cancel-and-accept checks with all dirty fields, plus title-only and filename-only warnings.'),
'cw_native_dirty_leave_warning':([G],'Clean reload has no warning; real keyboard edit produces native beforeunload; cancellation keeps source and acceptance reloads saved original.'),
'cw_exact_source_file_export':([L],'Actual downloaded export-me.js and exact source bytes checked.'),
'cw_supported_source_file_import':([G],'Actual uppercase-JS import waits while Auto-run off, manual Run works, save/reload works; unsupported UI/server filenames refuse atomically; valid edit recovers.'),
'cw_theme_switch_legibility':([P],'Actual workspace/editor/console changes both directions, preserving exact title/filename/source/preview/logs.'),
'cw_keyboard_shortcut_actions':([S],'Visible documentation recorded; keyboard Run/Save/Clear yields authored output, exact saved source and empty console.'),
'recovery_persistence_chain':([B],'Dedicated saved control, exact 4000 ms callback delay, shared budget stops from original Run, rollback and saved reload/rerun.'),
'cw_process_restart_durability':(['restart-full/restart-witness-results.json','restart-full/execution.log'],'Real browser Primary/copy/edit/deletion setup, one actual restart_app, fresh browser exact load/Run and postrestart save with fresh-read equality; sibling unchanged.'),
'cw_workspace_runs_authored_marker':([G,M],'Actual authored Run marker appears in preview and console, not only in source.'),
'cw_saved_source_shared_across_clean_contexts':([G,M],'Observed new UI write; independent empty browser context retrieves exact server identity/title/filename/source and reloads; record remains saved.'),
'responsive_layout':([P],'All four mobile surfaces reached; actual mobile source editing, Run and Clear work.'),
'labelled_controls_and_focus':([P],'Required controls identified; at least three actual Tab stops visibly focused.'),
'interaction_feedback':([P],'Successful Run output/status and Clear empty-state acknowledgement observed.'),
'workspace_organisation':([P],'Labeled editor, preview, console, filename and saved library visible and distinguishable.')
}
visuals={
'visual_typography':'Desktop labels/source/console/library text readable with consistent hierarchy.',
'visual_color_and_contrast':'Both themes clear; light dirty label and hovered Run fixed; measured hover contrast at least 4.5 in both themes/widths.',
'visual_spacing_and_layout':'Desktop groups and panes separated without colliding app-owned content.',
'visual_hierarchy_and_scanability':'Source/output/console/current file and main controls clearly distinguished.',
'visual_overall_craft':'Coherent controls, alignment and states; final screenshots independently reviewed by QC.',
'visual_responsive_consistency':'Coherent mobile composition and grouping; scrolled screenshot proves live preview contents; composition assessed separately from usability.'
}
for k,v in visuals.items():mapping[k]=([P,'presentation-final/desktop-theme-a.png','presentation-final/desktop-theme-b.png','presentation-final/mobile-theme-0.png','presentation-final/mobile-theme-1.png','presentation-final/mobile-live-preview.png'],v)
criteria=[];hashes={}
for dimension in ['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']:
 p=task/'tests'/dimension/'judge.toml';hashes['tests/'+dimension+'/judge.toml']=hashlib.sha256(p.read_bytes()).hexdigest()
 for c in tomllib.loads(p.read_text(encoding='utf-8'))['criterion']:
  assert c['id']in mapping,c['id'];paths,observation=mapping[c['id']]
  for path in paths:assert(out/path).is_file(),path
  criteria.append({'id':c['id'],'dimension':dimension,'weight':c['weight'],'type':c['type'],'local_result':'observed_pass'if c['type']=='binary'else'manual_rendered_review_consistent_with_5','evidence':paths,'observations':observation})
assert len(criteria)==45,len(criteria)
assert len([c for c in criteria if c['dimension']=='scored/functional'])==33
for path in [G,S,D,E,N,B,V,P,M,'large-controls-mcp-results.json']:
 data=json.loads((out/path).read_text())
 if 'passed'in data:assert data['passed'],path
limits=[
'No paid LLM judge or builder run; official Oracle score and platform acceptance remain unmeasured.',
'Visual ratings remain judgments; the final local screenshot review is not a paid visual verdict.',
'HTTP exposure check covers only the first 64 KiB of three fixed paths. No positive private signature is a bounded pass, not exhaustive secrecy proof.',
'Runtime evidence was freshly rerun before the final CSS-only corrections; executable JavaScript, backend, editor/runtime source, installer and lockfile are byte-identical. Affected presentation/theme/hover checks and final runtime details ran against final assets.',
'Real restart uses a separate fresh database under the shipped low-privilege test.sh. Installer reset is a different lifecycle tested in its own disposable database.'
]
report={'archive_sha256':'b34abc10a29b36cd30a62263f476eaa8e3b5328ca5dd75927b2d155721c988f1','scope':'Fresh local golden validation, not paid Oracle/model evaluation','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rubric_sha256':hashes,'counts':{'functional':33,'gates':2,'polish':4,'visual':6,'total':45},'criteria':criteria,'explicit_gaps':limits,'fresh_vs_historical':'All cited product evidence was executed anew on 2026-09-27. Older scripts were copied/adapted; old result files are not current witnesses.'}
(out/'GOLDEN_CRITERION_EVIDENCE.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
lines=['# Fresh Colderwater golden validation — 27 September 2026','',
'Current archive SHA-256: '+report['archive_sha256']+'.','',
'All 33 Functional and 2 gate criteria have fresh local browser witnesses. Four Polish checks passed direct usability probes; six Visual topics have final rendered evidence compatible with their attainable top anchors. This is local validation, not an Oracle score or platform acceptance.','',
'## Golden changes','',
'Only three served starter descriptions/comments and two narrow CSS contrast defects changed: light-theme dirty labels and hovered Run text. The pinned Vite build emits index-BEJFu1NO.js with unchanged JavaScript SHA 8fcc61a9a431ad6ed70a08be24829bbbf0b3aa4966edc64d31608f56e8e13172. CSS index-C_1hOHr1.css SHA is cbfa10c893727b30ffa575ebe5befb26043074162af99b24384c2864fe58b05d. Exact source/build hashes are in golden-freeze.json, solution-final.json and solution-delta.json. Backend, runtime/editor TypeScript, package/lockfile and installer are unchanged.','',
'## Fresh tools, controls and lifecycle','',
'Seven existing browser programs were copied here and executed anew against one fresh continuous golden database. Supplemental probes filled precise rubric legs rather than inferring coverage from aggregate check counts. Final runtime details measured both literal-loop deadlines and actual pane geometry. All use installed Chromium 152.0.7977.8.','',
'actual-mcp-results.json proves the installed browser_run_code_unsafe tool can create an independent empty context, load the newly UI-saved server record, reload it and return to ordinary MCP on the original page. It also tests private HTTP paths against the golden and synthetic whole-app-static leaks. Only bounded classifications and metadata return, never submitted source bodies. SPA200, denial responses, wrong MIME, comments/string decoys and a frontend manifest cannot decide leakage alone. large-controls-mcp-results.json adds long benign JavaScript and ambiguous prefixes: no false leak/failure, with the bounded limitation recorded.','',
'negative-gates/ contains newly executed inert-Run and client-only-library failures with positive controls. restart-full/ contains actual browser Primary/copy/deletion setup, one shipped restart MCP invocation, fresh-browser exact load/Run, and a later current-revision save whose fresh read matches. Its stub replaces paid scoring orchestration only; synthetic reward 1 is not an Oracle result. installer/ separately proves active-install refusal, ordinary-restart durability, stopped canonical-file reset and durable new writes.','',
'## Criterion witnesses','',
'| Dimension | Criterion | Observed result | Evidence |',
'| --- | --- | --- | --- |']
for c in criteria:
 links=', '.join('['+Path(p).name+']('+p+')'for p in c['evidence'])
 lines.append('| '+c['dimension']+' | '+c['id']+' | '+c['observations']+' | '+links+' |')
lines+=['','## Limits and retained setup failures','']+['- '+x for x in limits]
lines+=['','Probe-only setup failures were retained: a mock concatenated-log selector needed a contains match; an active asynchronous run correctly said “Waiting for asynchronous work” rather than “Running”; and the isolated MCP callback lacked a server-side URL global. Those probe assumptions were corrected without weakening product checks and rerun. The pre-hover-fix presentation set is retained separately.','']
(out/'GOLDEN_BROWSER_VALIDATION.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'mapped':len(criteria),'counts':report['counts'],'functional_weight':sum(c['weight']for c in criteria if c['dimension']=='scored/functional')},indent=2))
