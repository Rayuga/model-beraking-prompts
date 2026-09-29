"""Independent exact-candidate archive, evidence and 53/48 QC report binding.

Run with the root agent's final archive SHA256. Does not invoke paid judging.
"""
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import stat
import sys
import zipfile

sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/colderwater-playground-devtools'
OLD = OUT.parent / 'instruction-hygiene-fix-2026-09-26'
sys.path.insert(0, str(ROOT / 'harbor-webdev-rubric-qc/scripts'))
from list_checks import DEFAULT_WORKBOOK, load_checks


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def dump(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


assert len(sys.argv) == 2 and len(sys.argv[1]) == 64, 'Supply expected final ZIP SHA256'
manifest = read(OUT / 'candidate_manifest.json')
assert manifest['sha256'] == sys.argv[1]
archive = OUT / manifest['archive']
assert sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
assert archive.stat().st_size == manifest['bytes']
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    members = [i for i in bundle.infolist() if not i.is_dir()]
    assert len(members) == manifest['files'] == 50
    assert len({i.filename for i in members}) == 50
    files = {}
    for item in members:
        parts = Path(item.filename).parts
        assert parts[0] == 'colderwater-playground-devtools' and '..' not in parts
        rel = Path(*parts[1:]).as_posix()
        blob = bundle.read(item)
        assert sha256(blob).hexdigest() == manifest['source_sha256'][rel]
        assert blob == (TASK / rel).read_bytes()
        if rel.endswith('.sh'):
            assert stat.S_IMODE(item.external_attr >> 16) & 0o111
        files[rel] = blob
    assert set(files) == set(manifest['source_sha256'])

old_manifest = read(OLD / 'candidate_manifest.json')
old_archive = OLD / old_manifest['archive']
assert sha256(old_archive.read_bytes()).hexdigest() == old_manifest['sha256']
with zipfile.ZipFile(old_archive) as bundle:
    old_files = {Path(*Path(name).parts[1:]).as_posix(): bundle.read(name) for name in bundle.namelist() if not name.endswith('/')}
assert set(files) == set(old_files)
changed = sorted(k for k in files if files[k] != old_files[k])
unchanged = sorted(set(files) - set(changed))
assert 'solution/solve.sh' in changed
assert all(k in unchanged for k in files if k.startswith('solution/app/'))
for name in ['tests/scoring.toml','tests/tools/score.py','tests/tools/restart_mcp.py','tests/test.sh','tests/scored/polish/judge.toml','tests/scored/visual/judge.toml','environment/Dockerfile','tests/Dockerfile','environment/assets/seed_data.json']:
    assert name in unchanged

for name in ['qc_source_evidence.json','qc_extracted_source_evidence.json']:
    evidence = read(OUT / name)
    assert evidence['passed'] == 81 and evidence['failed'] == 0
    assert evidence['source_hashes'] == manifest['source_sha256']
for name in ['revision_preflight.json','extracted_revision_preflight.json']:
    evidence = read(OUT / name)
    assert evidence['passed'] == 37 and evidence['failed'] == 0
    assert evidence['source_hashes'] == manifest['source_sha256']
preflight = read(OUT / 'revision_preflight.json')
images = read(OUT / 'final_image_evidence.json')
assert images['agent']['passed'] and not images['agent']['privateSolutionOrVerifierPresent']
assert images['verifier_source_hashes_match'] and images['verifier_source_files'] == 15

browser_counts = {}
for name, expected in [('golden-browser-results.json',17),('independent-runtime-results.json',5),('validation-boundaries-results.json',6),('title-and-shared-budget-results.json',2),('network-boundary-results.json',4)]:
    evidence = read(OUT / name)
    assert evidence['passed'] and len(evidence['checks']) == expected
    assert all(c['passed'] for c in evidence['checks'])
    assert evidence['chromium_version'] == '152.0.7977.8'
    browser_counts[name] = expected
for name, expected in [('runtime-regression/runtime-results.json',13),('library-regression/library-results.json',12)]:
    evidence = read(OUT / name)
    assert len(evidence['results']) == expected and all(c['result'] == 'pass' for c in evidence['results'])
    assert not evidence['errors']
    browser_counts[name] = expected
assert sum(browser_counts.values()) == 59
installer = read(OUT / 'oracle-reinstall-results.json')
assert installer['passed'] and len(installer['checks']) == 6 and all(c['passed'] for c in installer['checks'])
for name, count in [('inert-negative-evidence.json',3),('client-library-negative-evidence.json',8)]:
    evidence = read(OUT / name)
    assert evidence['negative_witness_passed'] and len(evidence['checks']) == count
    assert all(c['passed'] for c in evidence['checks'])
assert not read(OUT / 'inert-negative-evidence.json')['new_render_prerequisite_satisfied']
assert not read(OUT / 'client-library-negative-evidence.json')['new_server_storage_prerequisite_satisfied']
assert read(OUT / 'network_probe_mcp_runtime.json')['passed']
synthetic = read(OUT / 'mock_score_policy_results.json')
assert synthetic['passed'] == 4 and synthetic['failed'] == 0
assert [c['result']['reward'] for c in synthetic['results']] == [.3364, 0, 0, 0]
contract = read(OUT / 'contract-checks.json')
assert contract['passed'] and all(c['passed'] for c in contract['checks'])
contract_count = len(contract['checks'])
coverage = (OUT / 'REQUIREMENT_COVERAGE.md').read_text(encoding='utf-8')
assert 'network' in coverage.lower() and '4000' in coverage

quality, deterministic = load_checks(DEFAULT_WORKBOOK)
assert len(quality) == 53 and len(deterministic) == 48
dump('qc_inventory.json', {'quality':quality, 'deterministic':deterministic})
previous = read(OLD / 'qc_final_findings.json')
data = {
    'scope':'Independent final review of the Colderwater rubric repair, 26 September 2026. All53 judgment checks and48 deterministic inventory entries are answered. Official/private checker executables and paid provider judging were not run. Executed local checks, actual-browser/MCP evidence, manual interpretation and reused unchanged-source evidence are distinguished. Prior confident acceptance of the ten reported semantic problems is superseded; original reports remain preserved.',
    'tasks':[{'name':'colderwater-playground-devtools','layout':'staged','checks':[],'findings':[]}],
    'deterministic':previous['deterministic'],
    'candidate':manifest,
    'repair_scope':{'old_candidate_sha256':old_manifest['sha256'],'changed_files':changed,'unchanged_file_count':len(unchanged),'golden_application_unchanged':True,'installer_changed':True,'shared_harness_scoring_presentation_criteria_unchanged':True,'paid_oracle_measured':False,'target_model_measured':False},
}
E = {
1:"instruction.md now opens with a person's browser-experiment use case, preserving working previews and newer saved work, then points to the six notes. It no longer opens as a stack/build recipe.",
2:"Read final brief and all six notes. Ordinary first-person language, contractions and reasons replace uniform rulebook prose; precise runtime/security notes remain where required. Naturalness is a manual judgment, not an official platform result.",
3:"Public prose has no copied task residue or draft/host-path markers. The literal 'verifier files' leak was removed. Final source81 assertions and extracted81 pass, including new grading-term and criterion-ID scans.",
4:"Brief plus integration/behaviour/ui/security/overview/policy notes state the actual deliverables, source/build assets, launch/DB_PATH, execution boundary and durable library rules. Requirement-first coverage includes all named refusal families, read/write isolation, external snippet resources, stale rename, dirty transitions and case-sensitive titles.",
5:"Old security.md 'verifier files' was a genuine machinery leak missed in prior review. New shared public-grading-term scan reproduces old failure, passes final source/extracted prose, and packaging refuses the old archive. Whole-token criterion-ID scan also passes44 IDs across7 public Markdown files.",
6:"Final32 functional criteria use stated source/record behavior and independent controls. Current golden passes59 actual-browser groups plus6 installer checks; exact MCP routing control succeeds. Network probes use locally fulfilled reserved.invalid URLs and no real internet; timing checks use observed setup and normal overhead.",
7:"Task requires a real runnable JS/HTML/CSS editor with saved shared records, revisions, import/export, cancellation, isolation and restart durability, not an image or canned demonstration.",
8:"Final task identity and metadata match folder/public Colderwater concept. Counts match32 binary Functional/weight49.5, four Polish, six Visual and two gates. No measured model reward is claimed in metadata.",
9:"Parsed public network in both phases, agent2CPU/4096MB and no allow_internet/docker_image. Task-specific local delivery and snippet external-resource restrictions are explicit product scope, not a blanket same-origin requirement; loopback runner aliases remain allowed.",
10:"Frozen verifier.env matches current staged template, including claude-code/z-ai/glm-5.3-flashx. Actual final images confirm dependency versions and copied source. RewardKit, CLI and MCP versions are pinned; no live provider token is shipped.",
11:"Nested budgets remain600+600=1200<1500 gates and9000+900+900=10800<11100 scored; total12600<13200 verifier. Agent7200/build600 unchanged. New gate probes and routed network controls execute in seconds locally. Paid judge latency and total duration remain unmeasured.",
12:"environment.docker_image absent; active Dockerfile builds the declared public inputs and empty app instead of being shadowed by an old image.",
13:"Canonical seed describes an empty user library with no starter implementation; all six referenced notes exist. Agent COPYs notes/assets. App ships its own examples and built local editor assets; final image input hashes match source.",
14:"Empty seed library and app-owned examples agree with the brief. Gate-created records are runtime mutations, not contradictory seed entries. Unique probe titles/source markers are absent from the seed. Synthetic data carries no real personal information.",
15:"Both final images built. final_image_evidence.json verifies empty agent/app with only.git/.gitkeep, exact public inputs, correct Node/Express/better-sqlite3 versions, no solution/tests leakage and15 copied verifier files matching final task bytes.",
16:"Actual agent image contains only public notes/assets and an empty app repository. Golden code, rubric, logs and private verifier tools are not copied into the agent environment.",
17:"Golden application bytes are unchanged from the earlier validated candidate and include editable TypeScript/React/Vite source, lockfile and compiled local assets. This repair executes59 browser groups and6 installer groups, including newly graded behavior; prior127 backend assertions and actual restart proof apply to unchanged code.",
18:"Local source/build/backend/browser evidence supports the golden across requested surfaces and all changed behavior. A complete paid Oracle evaluation against the final32-criterion rubric is not measured; grouped browser tests are not provider judgments.",
19:"Golden starts via /app/server.js with supplied runtime dependencies and local built assets. Revised installer has6 actual isolated lifecycle checks: active-use refusal, exact database/sidecar reset only on stopped reinstall, normal restart preservation and post-reinstall durability. It installs no packages at runtime.",
20:"Final archive SHA and all50 entry hashes independently match source/manifest. Authored seed/examples and probe inputs are fixed where required; generated identities, revisions after writes and timestamps are observed rather than guessed. One continuing shared database is intentional.",
21:"tests/test.sh, score.py and restart_mcp.py are byte-identical to the previously exercised harness. Four earlier synthetic harness cases cover launch/CWD, actual restart, failed-gate skip and missing-app zero. New archive/source verification proves the same wiring is shipped; synthetic scores are not Oracle results.",
22:"Final pinned verifier image builds and contains current prompts/judges. Actual installed MCP browser_run_code_unsafe supports context routing, an unprotected control page, iframe interaction and cleanup; earlier restart-MCP/tool inventory evidence still applies. No paid provider call was exercised.",
23:"integration.md declares /app/server.js from /app, 0.0.0.0:3000, /app/public/index.html, health and DB_PATH; unchanged launcher uses the stated app CWD for initial/restart execution. Health checks only success, with no invented body schema. User snippet source is product data, not forbidden implementation inspection.",
24:"Final source/extracted audits parse44 criteria in1/1/32/4/6 dimensions with unique IDs, positive weights and correct aggregations. Functional49.5 and60/20/20 policy agree; every judge has browser MCP and only Functional has restart. Shared tools/env remain canonical.",
25:"All five prompts require live Playwright/browser observations and explicitly prohibit submitted implementation/source/comment/bundle inspection. They distinguish user-authored snippet text, saved records and downloaded files as legitimate product data, while source text alone never proves execution.",
26:"REQUIREMENT_COVERAGE.md starts with public positive/negative promises. Missing named refusal families, stale rename, four dirty transitions, import non-execution, case-sensitive titles, blank-title/path-name validation, snippet networking and shared callback budget now map to actual checks. Exact internal React/Vite/Express/SQLite implementation and all possible hidden outbound/server-file behavior are not provable from browser evidence; scope remains explicit.",
27:"Reviewed final44 criteria against public notes. New network check follows stated snippet-resource ban with a successful routed control, not an origin equality check or live third-party dependency. No added postcode-like formatting, API routes, title lengths, fixed theme, indentation width, DOM layout or unknown authentication contract.",
28:"Separate outcomes now cover origin isolation, bounded network refusal, unsupported execution, each of four error paths, current-title validation vs stale rename, in-app vs native dirty warnings, and export vs imported durable work. Linked control/rejection/recovery legs remain coherent flows. Each split owns setup; prior verdicts are not inherited.",
29:"Render proves one newly authored JS marker appears in preview and console. Constraints proves a newly UI-saved snippet is retrieved with identical fields in a clean context and after reload. Every scored prompt inherits both gates and locally reloads live library data or a server-rendered document, without repeating saves or requiring generated IDs. Inert-run and localStorage-library negatives fail their respective prerequisites; golden passes both.",
30:"All rejection checks establish working controls, current revisions where appropriate and fresh unchanged reads. Network positive control proves both locally fulfilled resources and CORS before denial tests. Fetch/image are separate runs. Unsupported-family text has a legitimate string/comment/HTML control; each error criterion owns a good preview and recovery.",
31:"Five unsupported families are attempted individually; isolation covers parent document/storage read and write; all four dirty replacement actions include cancel/accept; title/filename/source preservation is exact. Network checks representative fetch and image without claiming exhaustive protocol security. Record/list comparisons preserve unrelated gate/criterion records.",
32:"Criteria use observed editor/output, console values/line numbers, real save operations, revisions, fresh reads and routed request delivery. A response code, source label or two same-context tabs cannot prove server persistence. Network denial is not inferred merely from CORS/DNS failure. No source-level architecture assertion.",
33:"All32 Functional descriptions and prompt were read together. Complete conjunctive bars, explicit alternatives and independent recovery avoid waived legs. Callback budget now starts from original Run and uses a4000ms delayed runaway, distinguishing roughly5s total from a fresh5s callback budget. Caught blocked network calls may complete normally instead of being forced to roll back.",
34:"Live probes require real authored Run, page reload, independent contexts, keyboard interaction/native beforeunload, theme changes, pane resizing, short delays, supersession/Stop and process restart. New actual browser59-group evidence includes the4s timer, separate network attempts and all four error paths.",
35:"Both product-defining prerequisites are actual working operations: execute authored code and independently retrieve saved server data. Functional grades supported runtime lifecycle and real process-restart preservation. Existing actual restart-MCP/127 backend evidence remains applicable to unchanged app/harness, with new65 local groups supporting changed rubric demands.",
36:"Gate marker/title chosen during execution cannot be satisfied by a canned example or empty seed. Functional criteria use their own distinct records/markers; existing output is not mistaken for new execution. Network control uses fresh nonce resources. No prepared success records or grader sentinels are in public assets.",
37:"App context and functional prompt explicitly preserve the CW gate record, tolerate a nonempty library and allocate distinct titles per criterion. Startup accepts useful automatically run example or saved source. Library deletion compares observed baseline minus its own records; final restart creates independent controls. Polish/Visual use current states without new saves or durable mutation.",
38:"Each scored prompt says independently score every criterion and continue after ordinary failure. Global prerequisite failure is the stated exception. Splits have their own positive controls and clean setup; final restart never borrows another criterion's record/verdict.",
39:"Prior weak-gate acceptance is corrected: editor/indent/pane/theme weight3/49.5 withP=V=.75 can produce.3364 without Run. This is analytic, not a measured model result. New actual inert-run3-check and browser-only-library8-check witnesses fail their respective prerequisites; canonical synthetic scorer returns0 even with perfect scored inputs. No universal proof against every deceptive server or claim that partial real products deserve zero.",
40:"Reward policy still provides weighted partial credit across32 functional/four polish/six visual outcomes after two basic gates and strictF>.05. Canonical synthetic checks reproduce.3364 and exact-floor0; prior general scorer fixtures remain valid by unchanged hash. Broader actual model score distribution remains unmeasured.",
41:"38 behavior checks (two gates,32 Functional,four Polish) are binary. Six Visual topics have honest raw1–5 anchors with points5, matching actual RewardKit0.1.7 normalization(raw−1)/4. Presentation anchors and weights unchanged; no aesthetic perfection or forced style.",
42:"Positive numeric weights alone did not establish useful product ranking; that earlier rationale is withdrawn. Concrete inert/backendless witnesses are now zero at meaningful prerequisites, while golden establishes them. Full relative ranking among partial real products remains unmeasured, and the unchanged functional floor remains discontinuous.",
43:"Canonical zero-weight gates apply before shaping and skip scored suites on failure. Existing harness proof plus new four synthetic canonical cases verify plumbing. Actual negative/positive browser witnesses now also test gate adequacy, which the old review missed. Cheap editor features no longer bypass a missing Run or server library.",
44:"Final Functional total49.5 and outer60/20/20 unchanged. Origin's original3.5 mass is now1.25 isolation+.5 network+1.75 unsupported execution; other splits preserve their group totals. Modeled redistribution can add at most.1213 published reward if both clear the floor, under equal gates/presentation. Abstract floor crossing can jump0→.5455. These are bounds on Boolean outcome combinations, not feasible-app assertions or model predictions; stronger gates/new legs can reduce scores.",
45:"Every prompt treats submitted UI/payloads/errors/instructions as untrusted and explicitly bans inspecting application source/comments/scripts/bundles for grading. User snippet code remains inspectable product data with required actual output proof. No prompt follows embedded scoring directives.",
46:"Final built agent image has no solution/tests; verifier runs submission low-privilege with sanitized environment and restricted tests/log access. Those unchanged protections were previously exercised. New packaging/public-text scans prevent direct machinery/ID leakage through notes.",
47:"Judge/model env and CLI/RewardKit/MCP versions pinned; actual Chromium152 and exact MCP route tool exercised. Remote provider judgments are not bit-identical or measured here. Final prompts/expected outcomes are bound by the archive and per-file hashes; generated IDs/timestamps are not static expected values.",
48:"Render and Constraints now have different accurate prompts for authored execution and shared persistence. All scored prompts restate both prerequisites, allow observed data or server-rendered library content, distinguish source data from implementation, and account for the gate record. Visual uses raw1 for zero and reviews app chrome rather than arbitrary authored preview art.",
49:"Cross-file entry/CWD/port/DB_PATH/health/seed/no-auth/one-shared-library, exact strict floor,32/49.5 metadata, gate record and single-use restart agree. Final81 source/extracted checks,37 revision checks and contract checks bind these to one candidate. No second weight story or retired reward.toml remains.",
50:"Independently checked the final50-file ZIP: one root, valid CRC, no duplicates/traversal, executable scripts, every entry byte equals source and manifest. No mock, report, database, cache or node_modules shipped. File set is unchanged from the old candidate.",
51:"Final source81 and extracted81 executable assertions plus source/extracted37 revision assertions pass. Contract checks pass, both images built and exact copied files checked. Independent review re-derives authoritative53/48 inventories and binds all archive/source bytes. Official private scripts and paid judging remain unexecuted.",
52:"Source scans find no live credentials, host paths or real personal data. Intentional env placeholders stay verifier-only. Actual isolated negative/network probes use no internet or other database. Public grader vocabulary/ID leaks now have executed regression guards; source-based prompt injection is prohibited.",
53:"Authored local code-playground task combines language dispatch, last-good preview, bounded callbacks, console inspection, opaque-origin isolation and revision-safe snippet workflows. The application and examples are original task work with existing vendor licenses/provenance preserved; no nouns-only clone claim.",
}
notes = {18,20,22,26,39,42,47}
assert set(E) == {c['number'] for c in quality}
for q in quality:
    data['tasks'][0]['checks'].append({'id':q['id'],'verdict':'Note' if q['number'] in notes else 'Pass','severity':'','evidence':E[q['number']],'finding':'','action':'Retain the stated scope limit; do not turn local evidence into an official or paid measured result.' if q['number'] in notes else ''})

updates = {
 'check-canonical-shared-files.py':'Canonical scoring and shared tools are byte-identical to the prior verified candidate and current template. task.toml metadata changed to describe the revised rubric; its structural keys, runtime budgets and verifier environment remain canonical.',
 'check-assets-referenced.py':'Executed JSON parsing and explicit path resolution: /assets/seed_data.json and all six notes exist; the agent Dockerfile copies assets and instructions.',
 'check-instruction-states-offline-constraint.py':'Public network is permitted during setup. Final brief and notes consistently require delivered runtime assets to be local.',
 'check-probe-not-in-seed.py':'The seed contains no user records. The judge authors probe values during execution; no successful probe is preloaded.',
 'check-required-files.py':'Required staged layout is present, with editable TypeScript source, build metadata and compiled public assets. No retired reward.toml is shipped.',
 'check-task-absolute-path.sh':'Brief and notes use absolute /app, /assets and /instructions paths. User-entered source filenames do not impose a hidden filesystem launch path.',
 'check-no-trialforge-judge-keys.py':'All five judges parse; no foreign files, target_claims, check.py or expected directories are present.',
 'check-verifier-contract.py':'Valid LF Bash and four earlier verifier-container harness cases apply to the unchanged entrypoint. Earlier browser-generated records survive the single-use restart MCP and allow a revision-aware save. Those are preserved runtime observations; scorer fixtures remain synthetic.',
 'check-instruction-hygiene.py':'Executed whole-token scanner covers44 IDs across7 public Markdown files on source/extracted archive; zero matches. New grading-term scanner reproduces old verifier-files leak, passes final prose, and packaging rejects old contaminated candidate.',
 'check-rubric-schema.py':'Parsed five judges/44 criteria:1/1/32/4/6, positive weights, uniqueIDs, correct aggregation and MCP scopes. Six Visual raw1–5 scales match actual RewardKit normalization.',
 'check-rubric-prompt.py':'Five explicit live-browser/source-ban prompts; user-authored source is product data. Both real prerequisites propagated to scored prompts without repeated probes; SSR/data response alternatives supported; independent continuation preserved.',
 'check-solve-contract.py':'Installer syntax/LF pass; six actual fresh/active/dirty-reinstall/restart cases pass. Exact DB/WAL/SHM removal only after open-handle guard; unrelatedfiles preserved; no package install or process kill.',
 'check-dockerfiles.py':'Both exact final images built. Actual empty agent app, input hashes/dependencyversions, no private leakage and all15 copied verifierfiles match source. Runtime pins unchanged.',
 'check-no-stray-files.py':'Independent ZIP/file inspection:50 task files with no scratch/mock/report/cache/DB/node_modules, one root, validCRC and executable shellmodes.',
 'check-scoring-policy.py':'Canonical60/20/20 and strict Functional>.05 unchanged. Gates basic Run/server save-read now demonstrated. Four synthetic canonical scorer cases yield.3364,0,0,0; bounded split/floor effects disclosed separately.',
 'check-instruction-content.py':'Rewritten human request exceeds40words, describes personal use case and preservation of working work, and delegates technical integration to notes. No draft markers found.',
 'check-fixtures.py':'Seed correctly contains no user records/starter implementation; golden supplies examples locally. Gatecreates one dedicated runtime record, clearly preserved throughout later tests. Public paths/imageschecked in final agent image.',
 'check-runtime-contract-strings.py':'Entry/CWD/port/DB_PATH/health/public shared library and seed agree. Golden runtime unchanged; installer reset only at setup, not normal startup or restart. No fixed unbriefed API schema.',
 'check-no-cdn-or-remote-assets.py':'Public network remains enabled. This product explicitly ships local app assets and blocks snippet external resources; routed.invalid-host control tests representative fetch/image without actual internet. Loopback aliases/data/blob resources are not rejected as origin mismatches.',
 'check-test-file-references.sh':'Entry,package,lockfile,editable source,builtindex,DB path and inputs are stated. Prompt implementation-source ban allows authored snippets/downloads as productdata. No hidden path or new response schema.',
 'check-batched-independence-wording.py':'All three scored prompts explicitly continue and return independent verdicts; split criteria own their setup/controls and never inherit another result.',
}
for row in data['deterministic']:
    if row['name'] in updates: row['output'] = updates[row['name']]
    row['note'] = 'Local/manual equivalent of unavailable official checker. Executed local assertions and actual/reused unchanged-source evidence are cited separately; not a platform verdict.'

# Keep generated prose readable without changing identifiers, paths or evidence values.
prose_replacements = {
    'All53':'All 53', 'and48':'and 48', 'source81':'source 81', 'extracted81':'extracted 81',
    'passes44':'passes 44', 'across7':'across 7', 'Final32':'Final 32', 'passes59':'passes 59',
    'plus6':'plus 6', 'match32':'match 32', 'weight49.5':'weight 49.5', 'agent2CPU/4096MB':'agent 2 CPUs/4096 MB',
    'remain600':'remain 600', 'and9000':'and 9000', 'total12600':'total 12600',
    'Agent7200/build600':'Agent 7200/build 600', 'only.git/.gitkeep':'only .git/.gitkeep',
    'and15':'and 15', 'executes59':'executes 59', 'and6':'and 6', 'prior127':'prior 127',
    'final32-criterion':'final 32-criterion', 'has6':'has 6', 'all50':'all 50', 'parse44':'parse 44',
    'in1/1/32/4/6':'in 1/1/32/4/6', 'Functional49.5':'Functional 49.5', 'and60/20/20':'and 60/20/20',
    'final44':'final 44', 'All32':'All 32', 'a4000ms':'a 4000 ms', 'roughly5s':'roughly 5 s',
    'fresh5s':'fresh 5 s', 'browser59-group':'browser 59-group', 'the4s':'the 4 s', 'new65':'new 65',
    'weight3/49.5':'weight 3/49.5', 'withP=V=.75':'with P=V=.75', 'produce.3364':'produce .3364',
    'inert-run3-check':'inert-run 3-check', 'browser-only-library8-check':'browser-only-library 8-check',
    'returns0':'returns 0', 'across32':'across 32', 'strictF>.05':'strict F > .05',
    'reproduce.3364':'reproduce .3364', 'exact-floor0':'exact-floor 0',
    'gates,32 Functional,four':'gates, 32 Functional, four', 'raw1':'raw 1', 'points5':'points 5',
    'RewardKit0.1.7':'RewardKit 0.1.7', 'total49.5':'total 49.5', 'outer60/20/20':'outer 60/20/20',
    'original3.5':'original 3.5', 'now1.25':'now 1.25', 'most.1213':'most .1213', 'jump0':'jump 0',
    'Chromium152':'Chromium 152', 'floor,32/49.5':'floor, 32/49.5', 'Final81':'Final 81',
    'checks,37':'checks, 37', 'final50-file':'final 50-file', 'source/extracted37':'source/extracted 37',
    'authoritative53/48':'authoritative 53/48', 'covers44':'covers 44', 'uniqueIDs':'unique IDs',
    'unrelatedfiles':'unrelated files', 'dependencyversions':'dependency versions', 'all15':'all 15',
    'verifierfiles':'verifier files', 'inspection:50':'inspection: 50', 'validCRC':'valid CRC',
    'shellmodes':'shell modes', 'Canonical60/20/20':'Canonical 60/20/20', 'yield.3364':'yield .3364',
    'exceeds40words':'exceeds 40 words', 'Gatecreates':'Gate creates', 'imageschecked':'images checked',
    'Entry,package,lockfile,editable source,builtindex':'Entry, package, lockfile, editable source, built index',
    'productdata':'product data', 'hostpath':'host-path', 'Express5.1.0':'Express 5.1.0',
    '3hyphen-separated':'3 hyphen-separated',
}
for row in data['tasks'][0]['checks']:
    for old, new in prose_replacements.items(): row['evidence'] = row['evidence'].replace(old, new)
for row in data['deterministic']:
    for old, new in prose_replacements.items(): row['output'] = row['output'].replace(old, new)
for old, new in prose_replacements.items(): data['scope'] = data['scope'].replace(old, new)

note_actions = {
    18:'Run the paid Oracle against this exact candidate before reporting a measured golden score.',
    20:'Preserve this archive and evidence hash; do not rely on generated record identities or timestamps being identical between runs.',
    22:'Verify the remote judge/provider invocation during the first actual evaluation; local browser and image checks do not exercise it.',
    26:'Retain the explicit browser-observability limits. Do not infer an exact framework/database engine or exhaustive security proof from these probes.',
    39:'Use the demonstrated negative fixtures as bounded witnesses, and measure actual model outcomes; no universal mock rejection claim is justified.',
    42:'Measure ranking with actual partial submissions; preserve the disclosed floor discontinuity and score-redistribution bounds.',
    47:'Record final candidate and prompt hashes with provider run logs; repeatability does not imply bit-identical remote judgments.',
}
for number, action in note_actions.items(): data['tasks'][0]['checks'][number-1]['action'] = action
assert len(data['deterministic']) == 48 and len({r['name'] for r in data['deterministic']}) == 48
assert {r['name'] for r in data['deterministic']} == {r['name'] for r in deterministic}
counts = dict(Counter(r['verdict'] for r in data['tasks'][0]['checks']))
det_counts = dict(Counter(r['status'] for r in data['deterministic']))
dump('qc_final_findings.json', data)
dump('independent_review_evidence.json', {'scope':'Independent archive/source/evidence binding and exact workbook completeness; not official checker execution or paid judging','passed':True,'candidate_sha256':manifest['sha256'],'candidate_files':50,'candidate_bytes':manifest['bytes'],'crc_source_manifest_modes_match':True,'changed_files':changed,'unchanged_files':unchanged,'quality_inventory':53,'deterministic_inventory':48,'quality_counts':counts,'deterministic_counts':det_counts,'source_assertions':81,'extracted_source_assertions':81,'revision_assertions':37,'extracted_revision_assertions':37,'contract_assertions':contract_count,'golden_browser_groups':browser_counts,'golden_browser_total':59,'golden_installer_groups':6,'negative_gate_assertions':11,'actual_mcp_network_negative_passed':True,'synthetic_scorer_cases':4,'score_analysis':preflight['score_analysis'],'paid_oracle_measured':False,'target_model_measured':False})
print(json.dumps({'quality':counts,'deterministic':det_counts,'archive_sha256':manifest['sha256'],'changed_files':changed,'contract_checks':contract_count}, indent=2))
