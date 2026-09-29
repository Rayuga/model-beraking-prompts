"""Independently bind the complete QC inventory to the network-only revision.

No task files are edited. Older evidence is reused only after byte comparisons;
the public-network acceptance rationale is explicitly replaced.
"""
from collections import Counter
import copy
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import stat
import sys
import tomllib
import zipfile

sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
OLD = OUT.parent / 'rubric-fix-2026-09-26'
TASK = ROOT / 'projects/colderwater-playground-devtools'
EXTRACTED = OUT / 'archive-check-998f0ba6831f/colderwater-playground-devtools'
sys.path.insert(0, str(ROOT / 'harbor-webdev-rubric-qc/scripts'))
from list_checks import DEFAULT_WORKBOOK, load_checks, verify


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def dump(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


manifest = read(OUT / 'candidate_manifest.json')
assert manifest['sha256'] == '998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686'
archive = OUT / manifest['archive']
assert sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
assert archive.stat().st_size == manifest['bytes'] == 839033
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    members = [item for item in z.infolist() if not item.is_dir()]
    assert len(members) == len({item.filename for item in members}) == 50
    current = {}
    for item in members:
        pieces = Path(item.filename).parts
        assert pieces[0] == TASK.name and '..' not in pieces
        relative = Path(*pieces[1:]).as_posix()
        blob = z.read(item)
        assert blob == (TASK / relative).read_bytes() == (EXTRACTED / relative).read_bytes()
        assert sha256(blob).hexdigest() == manifest['source_sha256'][relative]
        if relative.endswith('.sh'):
            assert stat.S_IMODE(item.external_attr >> 16) & 0o111
        current[relative] = blob
assert set(current) == set(manifest['source_sha256'])
assert set(current) == {p.relative_to(TASK).as_posix() for p in TASK.rglob('*') if p.is_file()}

previous_archive = OLD / 'colderwater-playground-devtools.zip'
previous_sha = '76ab7fb11195aa564b1ac5647439cc34be4b8c00fd28918f95b06ed286fd6d4d'
assert sha256(previous_archive.read_bytes()).hexdigest() == previous_sha
with zipfile.ZipFile(previous_archive) as z:
    previous = {Path(*Path(name).parts[1:]).as_posix(): z.read(name) for name in z.namelist() if not name.endswith('/')}
changed = sorted(key for key in current if current[key] != previous.get(key))
expected = {'instruction.md', 'environment/instructions/integration.md', 'environment/instructions/policy.md',
            'environment/instructions/security.md', 'task.toml', 'tests/app_context.md', 'tests/scored/functional/judge.toml'}
assert set(current) == set(previous) and set(changed) == expected
for prefix in ('solution/', 'tests/gates/', 'tests/tools/', 'environment/assets/'):
    assert all(current[key] == previous[key] for key in current if key.startswith(prefix))
assert all(current[key] == previous[key] for key in current if key.endswith('/prompt.md'))
before_f = tomllib.loads(previous['tests/scored/functional/judge.toml'].decode())
after_f = tomllib.loads(current['tests/scored/functional/judge.toml'].decode())
assert len(after_f['criterion']) == 32 and sum(c['weight'] for c in after_f['criterion']) == 49.5
assert before_f['criterion'][1:] == after_f['criterion'][1:]
before_f['criterion'][0]['description'] = after_f['criterion'][0]['description']
assert before_f == after_f
assert 'CDN assets are allowed and must not fail this criterion' in after_f['criterion'][0]['description']
assert "snippets can't fetch external resources or use network services" in current['environment/instructions/security.md'].decode()

for name in ('qc_source_evidence.json', 'qc_extracted_source_evidence.json'):
    report = read(OUT / name)
    assert report['passed'] == 82 and report['failed'] == 0
    assert report['source_hashes'] == manifest['source_sha256']
for name in ('network_policy_preflight.json', 'network_policy_extracted_preflight.json'):
    report = read(OUT / name)
    assert report['passed'] == 22 and report['failed'] == 0
    assert report['source_hashes'] == manifest['source_sha256']
contract = read(OUT / 'contract-checks.json')
assert contract['passed'] and contract['check_count'] == 23
for relative, digest in contract['owned_source_sha256'].items():
    assert sha256((ROOT / relative).read_bytes()).hexdigest() == digest
assert read(OUT / 'template-network-policy.json')['passed']
assert read(OUT / 'network_policy_source.json')['passed']
assert read(OUT / 'network_policy_extracted.json')['passed']
assert not read(OUT / 'old_network_policy_failure.json')['passed']
regression_path = ROOT / 'deliverables/ridgeline-print-storefront/rubric-followup-2026-09-26/network-regression-results.json'
regressions = read(regression_path)
assert regressions['passed']

image = read(OUT / 'final_image_evidence.json')
assert image['passed'] and image['source_unchanged_during_build']
assert image['agent_public_hashes_match'] and image['verifier_source_hashes_match']
assert image['agent_public_file_count'] == 7 and image['verifier_source_files'] == 15
for relative, digest in image['source_before_build'].items():
    assert manifest['source_sha256'][relative] == digest
assert not image['agent']['privateSolutionOrVerifierPresent']
assert not image['verifier_private_solution_present']

quality, deterministic = load_checks(DEFAULT_WORKBOOK)
assert len(quality) == 53 and len(deterministic) == 48
dump('qc_inventory.json', {'quality': quality, 'deterministic': deterministic})
payload = copy.deepcopy(read(OLD / 'qc_final_findings.json'))
assert not verify(payload, quality, deterministic)
payload['scope'] = ('Independent complete-inventory rebind for the seven-file Colderwater public-browser-network correction. '
    'All 53 quality judgments and 48 deterministic entries were reconsidered against the exact old/new archive delta. '
    'Current source/extracted assertions, new image hashes and network guards were checked. Unchanged application/harness '
    'behavior uses explicitly preserved prior evidence, not newly rerun provider judging. Earlier acceptance of a blanket '
    'app offline/CDN restriction is withdrawn. Official private checkers and paid Oracle/model evaluation were not run.')
task = payload['tasks'][0]
entries = {entry['id']: entry for entry in task['checks']}
for entry in task['checks']:
    entry['evidence'] = entry['evidence'].replace('81 assertions', '82 assertions').replace('source 81', 'source 82').replace('extracted 81', 'extracted 82')
    entry['evidence'] = entry['evidence'].replace('Final 81 source/extracted checks, 37 revision checks', 'Final 82 source/extracted checks, 22 network-delta checks')
    entry['evidence'] = entry['evidence'].replace('source/extracted 37 revision assertions', 'source/extracted 22 network-delta assertions')
    entry['evidence'] = entry['evidence'].replace('Current golden passes 59 actual-browser groups plus 6 installer checks', 'Prior byte-identical golden passed 59 actual-browser groups plus 6 installer checks')
    entry['evidence'] = entry['evidence'].replace('New actual browser 59-group evidence', 'Preserved prior actual-browser 59-group evidence')
    entry['evidence'] = entry['evidence'].replace('new 65 local groups supporting changed rubric demands', 'the prior 65 local groups supporting unchanged graded behaviors')
    entry['evidence'] += ' Current 998f0ba6 archive binding: independent_review_evidence.json. Unchanged-behavior executions are preserved evidence from ../rubric-fix-2026-09-26/, not new paid runs.'


def evidence(key, value):
    entries[key]['evidence'] = value


evidence('instruction_is_spelled_right_and_uncontaminated', 'Read all seven changed files and unchanged public-note scope. Brief and notes consistently allow external app assets while retaining the separate snippet restriction. No copied task residue, internal grading vocabulary, public criterion IDs, host paths or draft markers. Current source/extracted82 and hygiene44 IDs/7docs pass.')
evidence('instruction_states_deliverables_and_runtime_contract', 'Current integration retains source/build files, Node start, port, health, DB_PATH, one local backend and no startup package install. External browser fonts/scripts/editor/CDN resources are explicitly allowed. Security separately states authored snippets cannot use network resources. F01 now agrees; other31 descriptions and all prompts are unchanged.')
evidence('agent_environment_and_network_posture_are_correct', 'The staged profile requires public agent/verifier networks and permits browser CDN/off-origin assets. The earlier blanket local-assets acceptance was wrong and is withdrawn. Current brief/integration/policy/security/context/F01 explicitly distinguish allowed app resources from forbidden authored-snippet requests. New network guard rejects prior76ab7fb1, accepts current source/extraction and template; seven regression cases pass.')
evidence('assets_match_the_task', 'Canonical empty-library seed and all six notes remain present. Rebuilt agent image carries exact current seven public input files and an empty app. The reference happens to use compiled local editor assets; this is no longer a requirement that submissions avoid permitted CDN assets.')
evidence('dockerfile_builds_the_declared_world', 'Both current followup images built from unchanged Dockerfiles. final_image_evidence.json confirms empty agent app, seven current public-file hashes, no private solution/verifier leakage, Node/Express/SQLite runtime versions and all15 copied verifier files matching this archive.')
evidence('solution_covers_every_deliverable', 'Entire solution/app and solution/solve.sh bytes equal76ab7fb1. Prior59 Chromium browser groups, six installer lifecycle groups and127 backend assertions remain applicable to unchanged behavior; they were not rerun as part of this network-only correction. Allowing optional browser assets cannot make the self-contained reference fail an unchanged product promise.')
evidence('verifier_and_instruction_agree_on_the_runtime_contract', 'Compared all seven changed files with current launchers and notes: node/app/CWD/3000/health/DB_PATH unchanged; delivered compiled app remains required, external browser dependencies allowed, backend stays local. F01 removes only its previous app-network restriction. Snippet denial, actual same-product data observations and browser implementation-source prohibition remain unchanged.')
evidence('dimensions_cover_every_graded_requirement', 'Current REQUIREMENT_COVERAGE.md updates the prior full requirement-first map only at the allowed-browser-network rows. All31 remaining functional descriptions, gates and presentation criteria are byte-identical. F01 retains useful auto-start, examples and authored output. Framework/database identity and exhaustive hidden host/network behavior remain browser-observability limits, not claimed proof.')
evidence('no_criterion_grades_the_unrequired', 'Current F01 explicitly allows browser fonts/scripts/editor/CDN resources and no longer assigns failure for those requests. This removes the previous unjustified restriction under the staged profile. The independent authored-snippet fetch/image denial remains a stated security behavior with known-good local controls, not an app-wide origin/CDN test. All other31 functional descriptions are unchanged.')
evidence('reward_is_graded_not_binary_and_discriminates', 'Canonical weights60/20/20, Functional49.5 and strict>.05 floor unchanged. Only F01 existing0.5 can regain credit solely from lifting the invalid asset bar. Prior synthetic gate/floor tests remain valid by unchanged scorer hash; current network-delta arithmetic separates small conditional credit change from floor unlocking. Actual candidate score distribution is still unmeasured.')
evidence('dimension_and_criterion_weights_are_honest', 'All44 IDs/types/weights and policy are unchanged:32 Functional total49.5,4 Polish,6 Visual and two zero-mass gates. Only F01 description removes the unsupported app-asset refusal. Conditional maximum published reward increase is0.0061 with both floors passed; abstract raw2.25→2.75 can unlock0.4333 with full presentation. These are mathematical bounds, not model forecasts. Prior split effects belong to the earlier revision.')
evidence('dimension_prompts_are_accurate_and_consistent', 'All five prompts are byte-identical to76ab7fb1 and retain distinct Run/server-library gates plus independent scored setup. Shared app_context now explicitly permits app browser assets while distinguishing authored-snippet network prohibition. F01 and public integration/security/policy agree; no gate adds an app-wide asset-origin condition.')
evidence('cross_file_runtime_contract_is_consistent', 'Current source/extracted82 assertions, source/extracted22 exact-delta assertions and23 contract checks agree with manifest998f0ba6. Runtime/seed/library/restart facts,32/49.5 counts and canonical weights unchanged. All seven network-affected files use the allowed-app/separate-snippet distinction; template and task network guards pass.')
evidence('everything_parses_and_would_run', 'Current source82 and extracted82 assertions, source/extracted22 network-delta assertions and23 contract checks pass. Both images rebuilt with exact current public/verifier files. Independent review verifies all50 archive bytes against source/extraction and complete53/48 inventory. No private checker or paid provider execution is represented as passed.')
evidence('task_folder_holds_only_task_files', 'Independently opened998f0ba6 ZIP:50 files839033bytes, validCRC, single root, no duplicate/traversal entry, executable shell modes. All50 bytes and file inventory equal source, final extraction and manifest. No report, cache, database, scratch or model-run output is shipped.')
task['findings'] = []
by_name = {entry['name']: entry for entry in payload['deterministic']}
updates = {
 'check-instruction-states-offline-constraint.py': 'NOTE-only staged override: agent and verifier networks are public, and current public notes explicitly permit app browser fonts/scripts/CDN assets. No blanket offline condition is required or imposed. Authored-snippet networking is a separate product boundary.',
 'check-no-cdn-or-remote-assets.py': 'NOTE-only under public network. The previous app-wide asset ban is removed from F01 and public notes; permitted external app resources cannot fail. The unchanged sandbox fetch/image criterion follows its separately stated code-execution security requirement.',
 'check-canonical-shared-files.py': 'Shared tools, scoring policy, Dockerfiles, test.sh and all prompts are byte-identical to76ab7fb1; task config changes only description/provenance. Current template env/profile remain exact. Seven-file delta is independently verified.',
 'check-dockerfiles.py': 'Both followup images rebuilt; current seven agent inputs and15 copied verifier files match final manifest. Empty app and no private leaks verified. Dockerfiles/runtime pins unchanged.',
 'check-scoring-policy.py': 'Canonical60/20/20 and strictFunctional>.05 unchanged, all44 weights unchanged. Exact network-delta arithmetic allows only F01 .5 extra raw credit: conditional published gain<=.0061, with separate abstract floor unlock0→.4333. Prior gate/scorer fixtures apply by unchanged bytes.',
 'check-runtime-contract-strings.py': 'Entry/CWD/port/DB_PATH/health/local backend and startup-without-install unchanged. Integration/public notes/context/F01 now consistently permit browser assets, and preserve the separate snippet security boundary.',
 'check-no-stray-files.py': 'Independent final ZIP inspection:50files839033bytes, one root, validCRC and executable scripts; source/extracted/manifest bytes equal; no task cache, scratch, report or database.',
 'check-package-manifest-deps-preinstalled.py': 'NOTE under public network. Express/better-sqlite3 remain preinstalled, frontend build artifacts supplied, app startup installs no packages. Browser CDN dependencies are permitted, regardless of the golden choosing bundled assets.',
}
for name, value in updates.items():
    by_name[name]['output'] = value
for entry in payload['deterministic']:
    entry['note'] = 'Local/manual equivalent; official private checker unavailable. Current82 source/extracted assertions and22 delta assertions are bound to998f0ba6; unchanged runtime evidence is explicitly reused, not newly run.'
payload['candidate'] = manifest
payload['repair_scope'] = {'old_candidate_sha256': previous_sha, 'changed_files': changed, 'unchanged_file_count': 43,
    'golden_application_and_installer_unchanged': True, 'all_prompts_gates_scoring_weights_unchanged': True,
    'functional_change': 'Only initial_examples description permits app external resources; other31 unchanged',
    'prior_network_acceptance_withdrawn': True, 'paid_oracle_measured': False, 'target_model_measured': False}
assert not verify(payload, quality, deterministic)
assert Counter(entry['verdict'] for entry in task['checks']) == {'Pass': 46, 'Note': 7}
assert Counter(entry['status'] for entry in payload['deterministic']) == {'PASS': 33, 'NOTE': 11, 'N-A': 4}
dump('qc_final_findings.json', payload)

# Carry the full requirement map forward while replacing its obsolete app-network
# rows and clearly dating the earlier feature-split discussion.
coverage = (OLD / 'REQUIREMENT_COVERAGE.md').read_text(encoding='utf-8')
coverage = coverage.replace('# Colderwater requirement-first coverage and fairness ledger', '# Colderwater requirement-first coverage after the network-policy correction')
coverage = coverage.replace('## What the platform findings changed', '## Preserved earlier rubric repairs')
coverage = coverage.replace('| Same note and `integration.md`: shipped app/editor/examples use local resources | F01 observes normal load and authored-run network activity. Local loopback runner hostnames are valid. Browser-tool/judge network traffic is excluded and implementation bundles are not inspected. |',
    '| `security.md`, `integration.md`, `policy.md` and brief: external app browser assets are permitted | F01 explicitly accepts app fonts/scripts/editor/CDN resources; no browser-origin or asset-network failure is scored. The separate F05 snippet-resource boundary is unchanged. The public-network guard verifies current prose/configuration agreement. |')
coverage = coverage.replace('and compiled local assets. Launchers', 'and compiled application assets. External browser dependencies are permitted. Launchers')
coverage = coverage.replace('## Fairness, score effect and practical burden', '## Preserved earlier feature-split analysis and practical burden')
coverage = coverage.replace('`GOLDEN_FIX_AND_BROWSER_PROOF.md` reports', '`../rubric-fix-2026-09-26/GOLDEN_FIX_AND_BROWSER_PROOF.md` reports')
coverage += '\n\n## Current seven-file correction\n\nThe prior app-wide offline-assets conclusion is withdrawn. Archive998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686 permits external browser assets and changes only F01 description among criteria. All32 weights/IDs and other31 descriptions are unchanged. The earlier score-split analysis above describes the previous24→32 revision; it is not the score effect of this correction. Current F01-only conditional published gain is at most0.0061, with separate abstract floor unlocking0→0.4333. These are bounds, not measured model outcomes. QC_FINAL.md and independent_review_evidence.json bind this map to the current archive; earlier59 browser/six installer groups are preserved evidence for byte-identical behavior, not newly rerun tests.\n'
(OUT / 'REQUIREMENT_COVERAGE.md').write_text(coverage, encoding='utf-8')
dump('independent_review_evidence.json', {
    'scope': 'Independent full53/48 review rebind and exact archive/source/delta/image assertions; no task mutations or paid calls',
    'passed': True, 'archive_sha256': manifest['sha256'], 'archive_files': 50, 'archive_bytes': archive.stat().st_size,
    'old_archive_sha256': previous_sha, 'changed_files': changed, 'unchanged_file_count': 43,
    'source_extracted_manifest_hashes_equal': True, 'functional_unchanged_descriptions': 31,
    'functional_count': 32, 'functional_weight': 49.5, 'all_criterion_count': 44,
    'source_assertions': 82, 'extracted_assertions': 82, 'delta_assertions_each': 22, 'contract_assertions': 23,
    'quality_counts': dict(Counter(entry['verdict'] for entry in task['checks'])),
    'deterministic_counts': dict(Counter(entry['status'] for entry in payload['deterministic'])),
    'new_image_inputs_and_verifier_files_match': True, 'prior_network_rationale_superseded': True,
    'network_template_guard_passed': True, 'network_regressions_passed': True,
    'review_source_sha256': {str(path.relative_to(ROOT)).replace('\\', '/'): sha256(path.read_bytes()).hexdigest()
                            for path in [DEFAULT_WORKBOOK, ROOT/'harbor-webdev-rubric-qc/SKILL.md', OLD/'qc_final_findings.json',
                                         OLD/'REQUIREMENT_COVERAGE.md', OUT/'qc_final_findings.json', OUT/'REQUIREMENT_COVERAGE.md']}})
print(json.dumps({'passed': True, 'quality': 53, 'deterministic': 48, 'changed_files': len(changed), 'archive': manifest['sha256']}))
