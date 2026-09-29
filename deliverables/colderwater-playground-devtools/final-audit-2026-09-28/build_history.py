from pathlib import Path
from collections import Counter
import hashlib
import json
import re
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
REL = Path('deliverables/colderwater-playground-devtools/coverage-fix-2026-09-27/review-candidate')
ARCHIVE = ROOT / REL / 'colderwater-playground-devtools.zip'
BASE = ROOT / REL / 'archive-check-f86708344b08/colderwater-playground-devtools'
EXPECTED = 'f86708344b0861aad8a48049996c7b72266c29d6d68bf377358a0c5810aad6ae'
F = 'tests/scored/functional/prompt.md'
J = 'tests/scored/functional/judge.toml'
B = 'environment/instructions/behaviour.md'
S = 'environment/instructions/security.md'
P = 'tests/scored/polish/judge.toml'
C = 'tests/app_context.md'
ROWS = []

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def ref(file, needle):
    lines = (BASE / file).read_text(encoding='utf-8').splitlines()
    matches = [(n, s) for n, s in enumerate(lines, 1) if needle in s]
    if len(matches) != 1:
        raise ValueError((file, needle, len(matches)))
    n, s = matches[0]
    return {'file': file, 'line': n, 'quote': s}

def criterion(identifier):
    return ref(J, 'id = "' + identifier + '"')

def add(key, episode, checks, witness, resolution, refs, status='fixed', limitation=None):
    ROWS.append(dict(id=key, origin=episode, quality_checks=checks, old_witness=witness,
                     status=status, current_resolution=resolution, evidence=refs,
                     proof_scope='Fresh read of exact archived source, not a new platform or Oracle result.',
                     limitation=limitation))

add('E1.1', 'E1', ['check-instruction-hygiene.py'],
    'Ordinary brief words keyboard/persistence/timeout/duplicate/rename/themes were also private criterion IDs, producing nine literal collisions.',
    'The current distinctive IDs are absent as whole tokens from instruction.md and all six public notes; the fresh scan is empty.',
    [criterion('cw_shortcut_run'), criterion('cw_process_restart_durability'), criterion('cw_literal_loop_deadline'), criterion('cw_duplicate_initial_fidelity')])

add('E2.1', 'E2', [1], 'The brief and behaviour/security notes read as a test rulebook without a credible owner/use case.',
    'The owner asks for a playground, identifies lost work and concurrent editing as problems, and keeps operating notes separate. Technical rules remain where necessary, without a verifier checklist.',
    [ref('instruction.md', "I'd like a small"), ref('instruction.md', 'The annoying part'), ref(B, "I might leave it there"), ref(S, 'Please support ordinary')],
    limitation='Naturalness is a human judgement; this fixes the concrete old wording but cannot guarantee reviewer agreement.')
add('E2.2', 'E2', [2], 'Uniform formal prose without contractions or casual voice looked machine-written.',
    'Public text now contains contractions, variable sentence length and first-person motivation (I would like, annoying part, losing work).',
    [ref('instruction.md', "No accounts or sign-in; it's a local tool."), ref(B, "I don't want half"), ref('environment/instructions/policy.md', "There's no account data")],
    limitation='Subjective voice cannot be certified by a lexical test.')
add('E2.3', 'E2', [5], 'security.md explicitly said verifier files, revealing grader machinery.',
    'Public security language now refers only to working databases, backend code, internal project/repository files and intended browser assets.',
    [ref(S, 'People should be able')])
add('E2.4', 'E2', [26], 'Only eval was probed although Function, WebAssembly, Worker and dynamic import were separately named unsupported families.',
    'S08 makes five separate runs, requires each refusal and rollback, and gives harmless strings/comments/HTML text independent positive credit.',
    [ref(F, '2. As separate .js runs'), ref(F, 'new Function('), ref(F, 'new WebAssembly.Module'), ref(F, "new Worker('data:"), ref(F, "import('data:"), criterion('cw_unsupported_execution_refused')])
add('E2.5', 'E2', [26], 'Stale Rename was asked for but never tested.',
    'S25 tests the observed stale operation and unchanged newer record, plus a separately scored real dirty-editor conflict and recovery.',
    [ref(F, '4. Independently establish the server result'), criterion('cw_stale_rename_refusal'), criterion('cw_stale_rename_draft_recovery')])
add('E2.6', 'E2', [26], 'Dirty New and dirty import could discard work because only load/example transitions were tested.',
    'S30 separately re-establishes the dirty fixture for all four destinations and observes cancellation and acceptance.',
    [ref(F, '2. Test each of four replacement actions'), ref(F, '3. Each action warns before replacing'), criterion('cw_dirty_transition_protection')])
add('E2.7', 'E2', [26], 'Import could execute with Auto-run off without failing any row.',
    'S33 observes a supported import remaining unexecuted with a working prior preview, then deliberately runs that exact imported source.',
    [ref(F, 'Verify the exact filename/source in an editable draft.'), criterion('cw_import_off_no_execution')])
add('E2.8', 'E2', [26], 'Titles differing only by case were never tested despite case-sensitive uniqueness.',
    'S24 saves qc rename sibling beside QC Rename Sibling under a separate identity and reloads both.',
    [ref(F, '6. Start a separate new draft'), criterion('cw_title_case_sensitive')])
add('E2.9', 'E2', [28], 'Export and import/validation outcomes shared one binary score.',
    'S32 export is independent of S33 imports and server filename refusals; import failure does not erase export credit.',
    [criterion('cw_export_exact_source_file'), criterion('cw_supported_file_import'), criterion('cw_saved_filename_extension_rejection'), ref(F, 'Do not require saving to the library or performing an import')])
add('E2.10', 'E2', [28], 'Origin isolation and unsupported execution shared one all-or-nothing score.',
    'S05 owns the four parent boundary operations; S08 independently owns named unsupported execution families and harmless words.',
    [criterion('cw_preview_origin_boundary'), criterion('cw_unsupported_execution_refused'), criterion('cw_harmless_scope_words')])
add('E2.11', 'E2', [28], 'In-app dirty replacement and native browser leave protection shared one score.',
    'S30 app transition observations and S31 native leave protection have distinct rows and S31 has an independent saved-record fallback.',
    [criterion('cw_dirty_transition_protection'), criterion('cw_native_dirty_leave_protection'), ref(F, 'If unavailable, create QC Native Leave')])
add('E2.12', 'E2', [28], 'JS, HTML, timer and Promise error reporting were four independently useful paths in one binary check.',
    'Each error family has its own protocol and separate message, source-line and rollback outcome rows.',
    [criterion('cw_js_error_message'), criterion('cw_html_error_message'), criterion('cw_timer_error_message'), criterion('cw_promise_error_message')])
add('E2.13', 'E2', [29], 'A visible editor with a dead Run control and /api/health endpoint passed both gates.',
    'Render requires a newly authored marker actually executed in preview and console. Constraints requires a UI write, clean-context server read and repeat retrieval after reload.',
    [ref('tests/gates/render/judge.toml', 'Turn Auto-run off'), ref('tests/gates/constraints/judge.toml', 'Save through the normal UI'), ref('tests/gates/constraints/judge.toml', 'Open an independent clean browser context')])
add('E2.14', 'E2', [39,43,44], 'Editor/indent/panes/theme could earn 3/49.5 and clear the floor, yielding about 0.34 for an app with neither execution nor saving.',
    'The same old shell fails authored Run and durable server retrieval prerequisites before any cheap scored credit. Gates have zero reward mass; .6/.2/.2 and functional floor remain centralized.',
    [ref('tests/gates/render/judge.toml', 'A Run control that does nothing fails'), ref('tests/gates/constraints/judge.toml', 'A success toast, health response'), ref('tests/scoring.toml', 'functional = 0.6'), ref('tests/scoring.toml', 'functional = 0.05')],
    limitation='This closes the exact dead-run/no-save shell witness. A product implementing actual Run and server save is a stronger partial product and may earn partial scores.')
add('E2.15', 'E2', [48], 'Constraints prompt copied Render and tested only reachability.',
    'Constraints explicitly states independent-context storage retrieval and supplies the isolated-context lifecycle. Render owns authored execution.',
    [ref('tests/gates/constraints/prompt.md', 'prerequisite: a new UI save'), ref('tests/gates/constraints/prompt.md', 'Health reachability or a same-context reload is insufficient.')])

add('E3.1', 'E3', [6,27], 'A correct replacement Run cancelled old work but gave no supersession notice, losing a criterion because Stop-only wording was read more broadly.',
    'Public Stop requests a reason only on Stop. S04 explicitly makes a separate supersession notification optional and grades old output suppression.',
    [ref(B, 'Starting another run cancels'), ref(F, 'A separate notification that A was superseded is optional'), criterion('cw_supersede_pending')])
add('E3.2', 'E3', [26], 'A server exposing the entire working /app directory passed because privacy was asked but ungraded.',
    'S06 now samples main/companion database, backend, project and repository paths and requires accepted privacy outcomes, with a healthy workspace control.',
    [ref(S, 'People should be able'), ref(F, '2. Use ordinary browser navigation'), criterion('cw_working_files_private')],
    limitation='Representative finite probes do not prove absence of every possible disclosure; exact implementation classification is forbidden.')

add('E4.1', 'E4', [6], 'The five-second run deadline was ambiguous for a click/key/input arriving after a completed preview had sat idle.',
    'Public notes now explicitly give each later deliberate completed-preview interaction its own five-second budget and prevent extension while pending; S03 waits beyond the first budget.',
    [ref(B, 'Keep the current successfully completed preview interactive'), ref(S, 'A run, or a new interaction'), ref(F, 'Leave the completed preview untouched for at least six seconds')])
add('E4.2', 'E4', [26], 'Three Tab stops plus action shortcuts did not prove keyboard access to the example picker and saved-snippet list.',
    'Polish performs an actual keyboard-only route from editor to example choice, saved snippet retrieval and back to editor, allowing native escape behavior.',
    [ref(P, 'Now use only the keyboard'), ref(P, 'Confirm the main Run')])

add('E5.1', 'E5', [4,27], 'The timeout criterion demanded host/theme responsiveness during an infinite loop though only post-termination usability was asked.',
    'The protocol expressly permits a temporary pause during the loop and tests ordinary recovery after termination.',
    [ref(F, 'Do not require unrelated controls to respond during a loop'), ref(F, 'A temporary pause during the loop is not itself a failure')])
add('E5.2', 'E5', [4,6,27], 'A valid standard Escape-then-Tab editor was failed unless the app documented that escape sequence.',
    'Polish permits standard/native editor escape keys without app help text; only Run/Save/Clear shortcuts require public documentation as asked.',
    [ref(P, 'Standard or native editor behavior does not need application help text'), ref('environment/instructions/ui.md', 'Please show the working keyboard shortcuts')])
add('E5.3', 'E5', [11], 'Long timed multi-leg Functional work plus evaluator setup could hit the 9000-second judge cap and discard all score; no complete judge timing was measured.',
    'Shared evidence, one early restart, bounded recipes and fewer repeated runs reduce workload, but the exact current 93-row full judge has still not completed under measurement.',
    [ref(J, 'timeout = 9000'), ref(F, 'The 37 named protocols collect evidence'), ref(F, 'Only S22 invokes restart_app'), ref(F, 'Per-protocol action figures are planning estimates')],
    status='not-exercised', limitation='P1 timing concern remains open. Nested arithmetic or scripted browser wall time cannot prove LLM timing/Oracle completion.')
add('E5.4', 'E5', [28], 'Language dispatch shared credit with a separate delayed completed-preview click/key/input requirement.',
    'S02 owns language/CSS outcomes; S03 separately owns completed interaction. Its own fixture and idle timings are separate.',
    [criterion('cw_js_html_filename_dispatch'), criterion('cw_later_interactions'), ref(F, 'Its fixture and observations are independent of language_dispatch')])
add('E5.5', 'E5', [28], 'Run shared deadline, pending-interaction nonextension and unrelated save/reload were bundled into one recovery criterion.',
    'S36 owns original Run deadline, S37 owns pending interaction, and neither requires library saving. Restart/save durability has its own earlier protocol.',
    [criterion('cw_callback_shared_run_deadline'), criterion('cw_interaction_budget_no_extension'), ref(F, 'No library save/reload is required.'), ref(F, 'pending interaction deadlines and durable saving are graded independently.')])
add('E5.6', 'E5', [32], 'Privacy required streamed body classification (SQLite headers, server imports/initialization) even though implementation inspection was forbidden.',
    'S06 uses response/navigation/download outcomes and observed intended public roles, and expressly forbids body/source/database-content classification.',
    [ref(F, 'Do not read or classify implementation source, package fields, database bytes'), ref(C, 'Do not inspect implementation text, database bytes')],
    limitation='The narrow unresolved public-role exception remains explicitly ungraded; this is an observation limit, not source-classification permission.')
add('E5.7', 'E5', [32], 'Ad-hoc Playwright network setup/DNS/CORS failure could be mistaken for snippet blocking or make a correct app fail.',
    'S07 supplies complete local route setup/count/cleanup and requires successful clean-page fetch/image controls. Failed evaluator setup cannot become a product no.',
    [ref(F, 'All responses are fulfilled locally'), ref(F, 'Both must succeed with the expected text/dimensions'), ref(F, 'CORS or DNS error after the route handler delivered a resource')])
add('E5.8', 'E5', [33], 'Auto-run measured an app delay but then used fixed two-second OFF/queue windows, missing late incorrect execution.',
    'S17 uses the greater of three seconds or longest observed automatic delay plus one second for both OFF windows.',
    [ref(F, 'Set the observation window to the greater of three seconds'), ref(F, 'Observe for the same measured-delay-plus-margin window')])
add('E5.9', 'E5', [33], 'Stale Save request replay was treated as proof that a real dirty editor retained unsaved work.',
    'S23 needs live editors A/B and a real dirty B action/prevention; request replay is limited to server refusal, then latest load/reapply is observed.',
    [ref(F, 'A captured old API request alone is not an editor'), ref(F, 'Attempt Save from B\'s actual dirty UI'), criterion('cw_stale_save_draft_recovery')])
add('E5.10', 'E5', [53], 'Metadata labelled complex task medium, and the golden badge still said Local & offline despite public network policy.',
    'Metadata now says hard with product-specific difficulty, and current app source uses Local library.',
    [ref('task.toml', 'difficulty = "hard"'), ref('task.toml', 'description = '), ref('solution/app/src/app.tsx', 'Local library')])

add('E6.1', 'E6', [5], 'Public security instructions listed exactly /app.db,/server.js,/package.json while the private check excluded all others, leaking the probe boundary.',
    'Public prose uses categories. Private S06 adds nine representative paths including database companions, package lock and repository metadata, without calling them an exhaustive allowlist.',
    [ref(S, 'People should be able'), ref(F, 'They sample working databases and their companion files')])
add('E6.2', 'E6', [28], 'Restart setup required Duplicate and confirmed Delete, so broken duplication/deletion also erased working restart durability.',
    'S22 creates independent New/Save controls and expressly has no Duplicate/Delete/execution prerequisite.',
    [ref(F, 'Duplicate, Delete and execution of either snippet are not prerequisites'), criterion('cw_process_restart_durability')])
add('E6.3', 'E6', [28], 'Normal confirmation/deletion, stale-delete protection and deleted-identity upsert refusal shared one binary score.',
    'S27 normal confirmation/cancel and selected deletion, S28 stale protection/draft, and S29 deleted identity have separate rows and records.',
    [criterion('cw_delete_confirmation_cancel'), criterion('cw_delete_confirmed_selected_only'), criterion('cw_stale_delete_refusal'), criterion('cw_deleted_identity_update_refusal')])

add('E7.1', 'E7', [11], 'Timeout concern recurred with 37 long bundled checks and whole-run zero on evaluator timeout.',
    'The latest uses 37 shared protocols and 93 independent outcomes, but the 9000-second cap remains and completion remains unmeasured.',
    [ref(J, 'timeout = 9000'), ref(F, 'The 37 named protocols collect evidence')],
    status='not-exercised', limitation='Same unresolved workload concern as E5.3, not a second measured timeout; do not count it as fixed.')
add('E7.2', 'E7', [28], 'Exact supported import, import no-execution, invalid import, invalid server extensions, paths and case handling shared binary credit.',
    'These now have distinct owner rows, current-revision controls, and independent save fallback after import failure; uppercase import and save are also split in latest repair.',
    [criterion('cw_supported_file_import'), criterion('cw_import_off_no_execution'), criterion('cw_import_unsupported_extension'), criterion('cw_saved_filename_extension_rejection'), criterion('cw_saved_filename_path_rejection'), criterion('cw_import_extension_case'), criterion('cw_saved_filename_extension_case')])
add('E7.3', 'E7', [28], 'Title trimming, UI/server collision refusal, empty refusal and case-sensitive coexistence shared one yes/no result.',
    'The current five title outcomes retain separate credit; unsupported stale setup is excluded from collision/validation evidence.',
    [criterion('cw_title_trimming'), criterion('cw_rename_title_only'), criterion('cw_title_collision_refusal'), criterion('cw_title_empty_rejected'), criterion('cw_title_case_sensitive')])
add('E7.4', 'E7', [28], 'Automatic initial output and built-in example separation shared credit, so edited-example corruption erased valid startup.',
    'S01 records startup, usable examples and preserved built-in/separate saved copy independently.',
    [criterion('cw_startup_ready'), criterion('cw_usable_examples'), criterion('cw_example_separate')])
add('E7.5', 'E7', [28], 'Correct filename dispatch lost all credit if CSS copied old handlers.',
    'S02 has separate dispatch, style, uppercase, JS freshness, CSS script/handler suppression, CSS global freshness and CSS timer outcomes.',
    [criterion('cw_js_html_filename_dispatch'), criterion('cw_css_inert_copy'), criterion('cw_css_global_freshness'), criterion('cw_css_pending_timer_cancelled')])

add('E8.1', 'E8', [30], 'Dead Auto-run earned OFF-idle negative credit without ever automatically executing.',
    'Both OFF outcomes explicitly require a real enabled automatic execution and later deliberate execution of the same pending source; debounce-reset verdict is not inherited.',
    [ref(F, 'A product that still never executes automatically fails both off-state outcomes'), criterion('cw_autorun_off_stays_idle'), criterion('cw_autorun_off_cancels_queue')])
add('E8.2', 'E8', [30], 'CSS could erase the old document/button and earn no-marker credit from having no handler to click.',
    'Actual old script/handler markers, retained document, visible enabled button and completed click are mandatory positive control facts.',
    [ref(F, 'For css_inert_copy, the earlier actual script/handler markers'), criterion('cw_css_inert_copy')])
add('E8.3', 'E8', [33], 'One successful standalone private-looking response fit both local exposure/no and global incomplete/ungraded branches.',
    'S06 uses ordered terminal decisions: denial/fallback/public role first; unresolved role only with concrete affirmative ordinary-use evidence; otherwise exposure/no. Shared context repeats that exclusivity.',
    [ref(F, 'It is a terminal classification: do not also label that response an exposure.'), ref(C, 'Follow S06\'s ordered terminal decisions'), criterion('cw_working_files_private')],
    limitation='The narrow ambiguous public-role branch is still explicitly ungraded. That limitation has not been converted into universal browser decidability.')

add('L1', 'Local prior-candidate review, not a platform episode', [26], 'Later JS fresh-undefined could not prove globals were absent during the preceding CSS execution state.',
    'S02 observes the authored property in the matched current CSS realm before any later JS Run, with positive assigned-property control and explicit missing-evidence handling.',
    [ref(F, 'Before any later JavaScript Run, separately observe that oldGlobal'), ref(F, 'Positively match the realm before CSS'), criterion('cw_css_global_freshness')],
    limitation='Current golden native-frame and leaking mutant evidence exists; a virtual realm inaccessible to allowed browser observations remains a named incomplete-evaluation branch, not tested runtime proof.')
add('L2', 'Local prior-candidate review, not a platform episode', [26], 'CSS timer retention was not directly distinguished by the existing CSS probes.',
    'S02 establishes a successful button timer, then supersedes a second genuinely pending callback with CSS and observes no late effects before ordinary recovery.',
    [ref(F, 'This is the successful matching timer control'), criterion('cw_css_pending_timer_cancelled')])
add('L3', 'Local prior-candidate review, not a platform episode', [26], 'Stale Rename/Delete server request replay did not prove preservation of their real dirty editor fields.',
    'S25/S28 now each keep actual dirty editor B open, observe feedback/retained title, filename and source, then load latest/reapply/save/readback independently of server refusal.',
    [ref(F, 'From B\'s real UI attempt Rename'), ref(F, 'Attempt Delete from B\'s actual UI'), criterion('cw_stale_rename_draft_recovery'), criterion('cw_stale_delete_draft_recovery')])
add('L4', 'Local prior-candidate review, not a platform episode', [26], 'JS-only importer could pass despite named HTML/CSS support.',
    'S33 now compares import, edit, save and reload for all three lowercase formats, then independently checks all three uppercase import/save cases.',
    [ref(F, 'Do not substitute a JS-only test for these formats'), ref(F, 'Independently check extension case at each layer for .JS, .HTML and .CSS'), criterion('cw_supported_file_import')])
add('L5', 'Local prior-candidate review, not a platform episode', [28], 'Uppercase importer acceptance and uppercase saved-filename acceptance still shared one outcome.',
    'Independent .10 rows now own import versus save acceptance, with fallback ordinary draft when import fails.',
    [criterion('cw_import_extension_case'), criterion('cw_saved_filename_extension_case'), ref(F, 'Do not infer one layer from the other')])

add('X1', 'Cross-task lesson: PatchPad/Gridforge', [49,44], 'Dimension shares in judge headers differed from reward formula; retirement-era fields/version rules were mixed into new tasks.',
    'Current staged scoring owns .6/.2/.2 and zero gates; dimension headers contain no weight/model/temperature/reasoning fields. The valid claude-code fallback remains. Current workbook makes task version and prompt-version markers optional.',
    [ref('tests/scoring.toml', 'functional = 0.6'), ref(J, 'judge = "claude-code"'), ref('task.toml', 'REWARDKIT_MODEL = ')])
add('X2', 'Cross-task lesson: PatchPad/Gambit/Ridgeline', [27,23], 'Tests invented indent widths, exact coordinates/colours, URL shapes, hidden deck data, postage display or a different launch working directory.',
    'Current task leaves indentation, labels, API routes and fields free, discovers actual requests, and publishes absolute server startup and DB contract. Keyboard escape does not require a golden-specific hint.',
    [ref('environment/instructions/policy.md', 'You can choose the layout'), ref(F, 'Any consistent indentation width or tab representation is valid.'), ref(F, 'Never guess revision fields or IDs.'), ref('environment/instructions/integration.md', 'We start it with node /app/server.js.')])
add('X3', 'Cross-task lesson: Gambit', [13,15], 'Asset references existed in the prompt but not inside the uploaded environment/image.',
    'Current public files refer to the shipped seed and six shipped notes; Docker COPY lines stage both directories. Exact ZIP member validation is recorded below.',
    [ref('instruction.md', '/assets/seed_data.json'), ref('environment/Dockerfile', 'COPY instructions/ /instructions/'), ref('environment/Dockerfile', 'COPY assets/ /assets/')])
add('X4', 'Cross-task lesson: PatchPad/Ridgeline', [26,25], 'Asked-for features were absent from any rubric; prompts allowed implementation/source claims to substitute for live proof.',
    'Current line-number outcome is explicit, and all five prompts prohibit implementation inspection. New finite CSS/conflict/import gaps have direct protocols. Root separate fresh coverage review owns completeness beyond these old witnesses.',
    [criterion('cw_editor_line_numbers'), ref(F, 'Never inspect submitted implementation files'), ref('tests/gates/constraints/prompt.md', 'Do not inspect submitted application implementation files')])
add('X5', 'Cross-task lesson: Ridgeline', [29,35], 'A static catalogue or localStorage-backed mock passed server backing checks.',
    'Constraints observes a real UI write and retrieval of the same newly created record from a separate clean context without copying storage.',
    [ref('tests/gates/constraints/judge.toml', 'Open an independent clean browser context'), ref('tests/gates/constraints/judge.toml', 'A new tab in the original context is not independent.')])
add('X6', 'Cross-task lesson: Ridgeline', [29,9], 'A correct app using public CDN assets was zeroed by an invented offline gate.',
    'Public notes, shared context and S01/S02 explicitly allow app/CDN assets while keeping the authored-snippet network rule separate.',
    [ref('instruction.md', 'External fonts, scripts and CDN assets are fine'), ref(C, 'it is not an app-wide network restriction.'), ref(F, 'External fonts, scripts, editor components and CDN assets are allowed')])
add('X7', 'Cross-task lesson: Ridgeline', [32], 'A protocol required two clean browsers but the configured isolated browser lifecycle could not preserve both states.',
    'Constraints supplies newContext plus a fresh page without storageState, and S23/25/28 preserve an actual second context until the dirty conflict is complete.',
    [ref('tests/gates/constraints/prompt.md', 'const clean = await page.context().browser().newContext()'), ref(F, 'const editorB = await other.newPage()')])
add('X8', 'Cross-task lesson: Ridgeline', [19,20], 'Oracle reinstall retained prior database state, poisoning fixed expected seed quantities.',
    'Current installer removes the app database and companion files in its own /app installation; normal verifier restart deliberately preserves the current database and relative records.',
    [ref('solution/solve.sh', 'rm -f /app/app.db'), ref(F, 'One database/restart'), ref(F, 'Record the current complete library identities/titles')])
add('X9', 'Cross-task lesson: PatchPad and repeated Colderwater', [28,30,38], 'Fixing one bundle or removing all-legs grading accidentally disconnected positive controls and made negative-only checks vacuous.',
    'The shared contract now binds named outcomes to actual matching controls without inheriting sibling verdicts; all older explicit dead-run/empty-target witnesses are handled.',
    [ref(F, 'Absence of unwanted activity is insufficient when the feature never worked'), ref(F, 'Each evidence key has one scored owner')])

assert sha(ARCHIVE) == EXPECTED
with zipfile.ZipFile(ARCHIVE) as z:
    members = [i for i in z.infolist() if not i.is_dir()]
    for member in members:
        rel = Path(member.filename).relative_to('colderwater-playground-devtools')
        assert z.read(member.filename) == (BASE / rel).read_bytes(), member.filename
    assert len(members) == 50
judges = list((BASE / 'tests').glob('*/*/judge.toml'))
criteria = {p.relative_to(BASE).as_posix(): tomllib.loads(p.read_text(encoding='utf-8'))['criterion'] for p in judges}
all_ids = [c['id'] for cs in criteria.values() for c in cs]
public = [BASE / 'instruction.md', *sorted((BASE / 'environment/instructions').glob('*.md'))]
collisions = []
for f in public:
    for line, text in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        for identifier in all_ids:
            if re.search(r'(?<![A-Za-z0-9_])' + re.escape(identifier) + r'(?![A-Za-z0-9_])', text):
                collisions.append(dict(file=f.relative_to(BASE).as_posix(), line=line, identifier=identifier))
assert not collisions
for j in judges:
    header = tomllib.loads(j.read_text(encoding='utf-8'))['judge']
    assert not set(header).intersection({'model', 'weight', 'temperature', 'reasoning_effort'})
functional = criteria[J]
assert len(functional) == 93
assert round(sum(c['weight'] for c in functional), 8) == 49.5
old = ROOT / 'deliverables/colderwater-playground-devtools/positive-controls-fix-2026-09-27/review-candidate/colderwater-playground-devtools.zip'
with zipfile.ZipFile(old) as z, zipfile.ZipFile(ARCHIVE) as current:
    changed = [name for name in current.namelist() if not name.endswith('/') and z.read(name) != current.read(name)]
assert changed == [
    'colderwater-playground-devtools/tests/app_context.md',
    'colderwater-playground-devtools/tests/scored/functional/judge.toml',
    'colderwater-playground-devtools/tests/scored/functional/prompt.md',
]
bindings = []
focused = ROOT / 'deliverables/colderwater-playground-devtools/coverage-fix-2026-09-27/golden/FOCUSED_PROOF_SUMMARY.json'
proof = json.loads(focused.read_text(encoding='utf-8'))
for case, data in proof['runtime_cases'].items():
    for kind in ['results', 'browser_results']:
        b = data[kind]
        assert sha(ROOT / b['path']) == b['sha256']
        bindings.append({'case': case, 'kind': kind, **b})
history = json.loads((ROOT / 'deliverables/colderwater-playground-devtools/last-attempt-review-2026-09-27/history_evidence.json').read_text(encoding='utf-8'))
result = {
    'date': '2026-09-28', 'archive': {'path': ARCHIVE.relative_to(ROOT).as_posix(), 'sha256': EXPECTED},
    'reviewed_tree': BASE.relative_to(ROOT).as_posix(),
    'scope': 'Fresh archived-source verification of every precise old Colderwater witness in eight user-supplied screenshot episodes plus prior local coverage findings and applicable cross-task lessons. No task changes or provider/platform/runtime calls.',
    'status_meaning': {'fixed': 'The precise old witness is explicitly addressed in the current archive; not a guarantee of platform acceptance or exhaustive correctness.', 'not-exercised': 'Concern remains open because the required full judge measurement is absent.'},
    'history_counts': history['flag_count'],
    'matrix_counts': dict(Counter(r['status'] for r in ROWS)),
    'inventory': {'files': len(members), 'functional_rows': len(functional), 'functional_weight': round(sum(c['weight'] for c in functional), 8), 'all_extracted_members_match_zip': True, 'whole_token_id_collisions': collisions, 'changed_files_from_663e': changed},
    'witnesses': ROWS,
    'focused_evidence_reverified': bindings,
    'new_runtime_run': False, 'paid_calls': 0, 'platform_attempts': 0,
    'limits': [
        'Two historical timeout flags describe one still-unmeasured full Functional judge workload. Current outcome count is 93, not the older 88.',
        'No current full Oracle reward or target-model score was measured by this review.',
        'The 9 focused current outcomes have retained golden/mutant evidence with verified artifact hashes; they are not a complete 93-row LLM run.',
        'Privacy and virtual execution-realm observation limits remain explicit. Disclosing them avoids a false product verdict but may cause ungraded evaluation.',
        'Voice and criterion granularity remain judgement-sensitive; fixed old wording is not an assurance that source QC cannot find another witness.',
        'No identical archive + QC version + reviewer settings + differing result pair exists in retained evidence, so nondeterminism is not demonstrated.',
        'Cross-task rows transfer a lesson into Colderwater only; they do not re-audit or certify Ridgeline, PatchPad, Gridforge or Gambit archives.',
    ],
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'history.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
md = [
    '# Colderwater historical-finding cross-check — 2026-09-28', '',
    'Archive SHA-256: `' + EXPECTED + '`.', '',
    'All 50 extracted files were compared byte-for-byte with the ZIP. This is a fresh source review, not an inherited Pass from the older reports. No task files were edited, no provider was called and no platform attempt was spent.', '',
    '**The precise historical source defects below are addressed. The repeated full-judge timeout concern remains not exercised. This is not a claim that no possible new issue exists or that Oracle has scored 1.**', '',
    'Eight supplied Colderwater feedback episodes contained 30 flagged check occurrences under 19 distinct IDs. One flag can contain multiple witnesses, and one witness can appear under multiple checks. The matrix therefore lists concrete witnesses rather than pretending its row count equals platform failures.', '',
    '“Fixed” means the exact old false-pass/false-fail witness is now explicitly handled in the archived task. It does not assert a new platform result. References below are relative to the immutable extracted tree in `coverage-fix-2026-09-27/review-candidate/archive-check-f86708344b08/colderwater-playground-devtools`.', '',
]
for section in ['E1','E2','E3','E4','E5','E6','E7','E8','Local prior-candidate review, not a platform episode']:
    md += ['## ' + section, '', '| Witness | Status | Current evidence and resolution |', '| --- | --- | --- |']
    for r in ROWS:
        if r['origin'] != section:
            continue
        cites = '; '.join('`' + e['file'] + ':' + str(e['line']) + '`' for e in r['evidence'])
        text = r['current_resolution'] + (' Limitation: ' + r['limitation'] if r['limitation'] else '')
        md.append('| ' + r['id'] + ': ' + r['old_witness'].replace('|', '\\|') + ' | ' + r['status'] + ' | ' + text.replace('|', '\\|') + ' ' + cites + ' |')
    md += ['']
md += ['## Applicable lessons from other tasks', '', 'These are not additional Colderwater platform episodes, and they do not certify those other projects.', '', '| Source / witness | Current Colderwater check |', '| --- | --- |']
for r in ROWS:
    if not r['id'].startswith('X'):
        continue
    cites = '; '.join('`' + e['file'] + ':' + str(e['line']) + '`' for e in r['evidence'])
    md.append('| ' + r['origin'] + ': ' + r['old_witness'] + ' | ' + r['current_resolution'] + ' ' + cites + ' |')
md += ['', '## Evidence boundary and recurrence', '',
    'The latest focused proof binds to f867 and its eight raw result/browser-result artifact hashes were rechecked. It supports CSS globals/timers, actual stale Rename/Delete draft flows and all six extension variants on the golden, plus three deliberately broken implementations. It is a focused direct-Playwright proof, not a full Oracle. The latest source still has 93 Functional outcomes totaling 49.50 over 37 shared protocols; only three private rubric/protocol/context files changed from the earlier 663e candidate, with golden files unchanged.', '',
    'Independence, coverage and ambiguity recurred because later feedback found different concrete cases under the same broad check. Timeout fit is the genuinely still-open repeated concern. The retained records do not show two different verdicts for identical ZIP bytes and identical source-QC reviewer settings, so they do not prove nondeterminism.', '',
    'Outstanding limits:', '',
]
md += ['- ' + s for s in result['limits']]
md += ['', 'The JSON companion contains every exact current source quotation, the fresh archive inventory, status counts and verified evidence bindings.', '']
(OUT / 'history.md').write_text('\n'.join(md), encoding='utf-8')
print(json.dumps({'matrix_counts': result['matrix_counts'], 'rows': len(ROWS), 'files': len(members), 'functional_rows': len(functional), 'id_collisions': len(collisions), 'raw_focused_bindings': len(bindings)}, indent=2))
