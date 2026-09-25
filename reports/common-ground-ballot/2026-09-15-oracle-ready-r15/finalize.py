import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
TASK = OUT / 'frozen/common-ground-ballot'
DELIVERY = ROOT / 'deliverables/common-ground-ballot/2026-09-15-oracle-ready-r15'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, data):
    path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = read(OUT / 'freeze-manifest.json')
archive = DELIVERY / 'common-ground-ballot.zip'
assert digest(archive) == manifest['sha256']
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == 37
    for name in z.namelist():
        assert z.read(name) == (OUT / 'frozen' / name).read_bytes()
        assert z.read(name) == (ROOT / 'projects' / name).read_bytes()

groups = {'browser': 45, 'runtime': 5, 'harness': 19, 'session': 7,
          'mcp': 13, 'qc': 103, 'roles': 40, 'polish': 3, 'lifecycle': 2}
for mode, count in groups.items():
    result = read(OUT / ('validation-' + mode) / (mode + '-results.json'))
    assert len(result['results']) == count, (mode, len(result['results']))
    assert all(r['passed'] for r in result['results']), mode
    if mode == 'browser':
        assert result['errors'] == []
negative = read(OUT / 'polish-negative-results.json')
assert negative['passed'] and negative['failed_criteria'] == ['reduced_motion_preference']
preflight = read(OUT / 'preflight-regressions.json')
assert len(preflight['results']) == 10 and all(r['passed'] for r in preflight['results'])
standard = read(OUT / 'check-standard.json')
upload = read(OUT / 'check-upload.json')
assert len(standard['checks']) == 147
assert upload['passed'] and len(upload['checks']) == 400

provenance = read(OUT / 'validation-harness/prompt-provenance.json')
dimensions = ['render', 'constraints', 'functional', 'polish', 'visual']
for dim in dimensions:
    for key, file in [('prompt_sha256', 'prompt.md'), ('judge_sha256', 'judge.toml')]:
        assert provenance['judges'][dim][key] == digest(TASK / 'tests' / dim / file)
for key, file in [('runner_sha256', 'test.sh'), ('reward_sha256', 'reward.toml'), ('score_sha256', 'score.py')]:
    assert provenance[key] == digest(TASK / 'tests' / file)

agent_hashes = {p.relative_to(TASK / 'environment').as_posix(): digest(p)
                for folder in ['instructions', 'assets']
                for p in (TASK / 'environment' / folder).rglob('*') if p.is_file()}
write(OUT / 'agent-expected-hashes.json', agent_hashes)
agent = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '--mount',
                        f'type=bind,source={OUT},target=/validation,readonly',
                        'ballot-agent:20260915-r15-local', 'node', '/validation/agent-smoke.cjs'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
write(OUT / 'agent-smoke-results.json', json.loads(agent.stdout))
images = {tag: json.loads(subprocess.check_output(['docker', 'image', 'inspect', tag],
          text=True, encoding='utf-8'))[0]['Id'] for tag in
          ['ballot-agent:20260915-r15-local', 'ballot-verifier:20260915-r15-local']}
write(OUT / 'image-hashes.json', images)

# Update the prior requirement map, retaining its brief references and replacing
# every old combined criterion with its independent r15 observation owners.
coverage = read(ROOT / 'reports/common-ground-ballot/2026-09-15-platform-qc-r14/coverage.json')
migration = read(OUT / 'criterion-migration.json')['mapping']
migration['public_control_responds'] = ['workspace_navigation']
migration['same_origin_shell'] = []
migration['accessible_keyboard_forms'] = ['keyboard_control_operation', 'semantic_labels_and_landmarks', 'visible_and_managed_focus']
for req in coverage['requirements']:
    req['criteria'] = [new for old in req['criteria'] for new in migration.get(old, [old])]
    if req['id'] == 'REQ-20':
        req['source'] = 'overview.md: six substantive workspaces with role-appropriate navigation'
    if req['id'] == 'REQ-21':
        req['source'] = 'runtime.md: successful health route and stable application entry point; public networking permitted'
    if req['id'] == 'REQ-06':
        req['source_files'].append('environment/instructions/ballots.md')
        req['source'] += '; ballots.md: valid targets and revisions; privacy.md: membership input validation'
    if req['id'] == 'REQ-AUTH-NEGATIVE':
        req['criteria'] = []
        req['shared_gate'] = 'Every dimension checks anonymous protected reads, wrong-password rejection, successful sign-in, authenticated read and refresh. No duplicate reward criterion.'
for item in coverage.pop('r11_additions'):
    item['criteria'] = migration.get(item.pop('criterion'), [])
    coverage.setdefault('retained_boundary_probes', []).append(item)
coverage.pop('r14_update')
coverage['review_update'] = 'r15: 56 independent criteria; Functional total weight 34 retained; runtime and keyboard bundles split; no external-origin prohibition; named intermediate aggregate plus final mandatory gates.'
coverage['runtime_contract'] = {'startup_cwd': '/app', 'embedded_seed': '/app/common_ground_seed.json',
    'honored_environment': ['DB_PATH', 'SEED_PATH'], 'surviving_artifacts': ['/app'],
    'network': 'public', 'verifier_restores_seed': False}
coverage['scoring_contract'] = {'intermediate': 'tests/reward.toml named weighted_mean',
    'final': 'tests/score.py', 'sole_dimension_weights': 'tests/*/judge.toml [judge].weight',
    'gates': ['render', 'constraints'], 'weighted': {'functional': 0.6, 'polish': 0.2, 'visual': 0.2}}
catalog = []
for dim in dimensions:
    config = tomllib.loads((TASK / 'tests' / dim / 'judge.toml').read_text(encoding='utf-8'))
    for criterion in config['criterion']:
        owners = [r['id'] for r in coverage['requirements'] if criterion['id'] in r['criteria']]
        assert owners, criterion['id']
        catalog.append({'dimension': dim, 'id': criterion['id'], 'weight': criterion['weight'],
                        'type': criterion['type'], 'requirement_refs': owners})
ids = {c['id'] for c in catalog}
assert len(catalog) == len(ids) == 56
assert {cid for r in coverage['requirements'] for cid in r['criteria']} == ids
coverage['criteria'] = catalog
coverage['archive_sha256'] = manifest['sha256']
write(OUT / 'coverage.json', coverage)

# The uploaded TXT is the current authoring rubric. Preserve its exact source
# hash and all 53 review topics without presenting local review as platform QC.
rubric_path = ROOT / 'task-implementation.txt'
rubric_text = rubric_path.read_text(encoding='utf-8')
rubric_items = re.findall(r'\[\[criteria\]\]\s*name\s*=\s*"([^"]+)"\s*description\s*=\s*"([^"]+)"\s*guidance\s*=\s*\x27\x27\x27(.*?)\x27\x27\x27', rubric_text, re.S)
assert len(rubric_items) == 53, len(rubric_items)
notes = [
    'Short product request; operational details are in the five supplied instructions.',
    'Plain membership-group request and concrete workflows; no inserted grader instructions.',
    'Task identity and prose checked; no platform score targets in agent instructions.',
    'Runtime specifies /app/server.js, port, cwd, SQLite, DB_PATH, embedded seed and SEED_PATH.',
    'Agent inputs contain product requirements; judges, weights and scoring remain under tests.',
    'Seed and starter supplied; pinned Express and SQLite available. Clean environment build remains unverified.',
    'Authentication, durable writes, role checks, receipts, voting and results require a working backend.',
    'Single common-ground-ballot slug and version 1.0.0; archive wrapper and labels agree.',
    'Public networking declared for agent and verifier; external resources explicitly permitted.',
    'Separate verifier image, pinned Codex/MCP/RewardKit, credential interpolation and central model env. Live credential access remains unverified.',
    'Functional 9000 seconds; total judge budgets 12000, runner 12600, verifier 13200. Fresh scored execution must confirm adequacy.',
    'Task declares Dockerfiles, not a prebuilt image override. Cached images are local evidence only.',
    'Authoritative four-user/four-ballot seed, runnable starter and product instructions included.',
    'Seed identities, states, methods, revisions and exact tallies pass local browser and SQLite comparisons.',
    'Declared Dockerfiles inspected; exact builds blocked by local proxy DNS. No clean-build success claimed.',
    'Agent smoke confirms current assets/instructions and no solution/tests visible.',
    'Golden build emits self-contained /app and all requested workspaces; full browser journey passes.',
    'Local functional, runtime, browser and visual inspection evidence retained. No LLM-scored all-dimension pass claimed.',
    'Golden carries its seed; runner restores nothing. Relative cwd and relocated launch survive two restarts.',
    'Frozen ZIP, source hashes and unchanged golden verified byte-for-byte; no runtime task modification.',
    '19 runner cases include missing entry/seed, invalid judge output, crash and termination; failures write zero.',
    'Cached dependency assembly launches current verifier; native SQLite, Chromium, actual MCP and RewardKit scoring verified. Clean build/live judging pending.',
    'Runtime instructions and lifecycle helper agree on startup cwd, entry, seed, DB and restart semantics.',
    '56 discovered criteria in five dimensions; named reward aggregate restored; final scorer checked with actual RewardKit.',
    'Five prompts require visible UI, observed request shapes and browser evidence; narrow exceptions documented.',
    'coverage.json maps all 56 IDs to supplied requirements; mandatory runtime requirements carry gates.',
    'Removed no-CDN rule, arbitrary demo-button behavior and unrequested 44px touch minimum.',
    'Separate roles/identity, lifecycle transitions/locks, sessions, privacy boundaries, audit and keyboard checks. Shared sequences retained only for one invariant.',
    'Identical authentication prerequisite in every dimension; all five pass before and after mutations locally.',
    'Valid same-state Ruth controls for every write family; fresh sign-in, current revision and valid vote controls retained.',
    'All four accounts, six workspaces, two Members plus Observer, six staff actions, two methods and both restarts exercised.',
    'UI outcomes and observed responses; only explicit SQLite-format constraint uses trusted read-only DB inspection.',
    'Each criterion owns its stated observation; persistence, tally, audit and receipt ownership clarified.',
    'Two actual restarts, native dialogs, session transitions, mobile viewports, themes and reduced motion exercised.',
    'UI-created writes and accepted-input ledger survive refresh, new sign-in and two process restarts.',
    'Fresh operation IDs/current revisions/valid actor for negative probes; compare before/after and positive controls.',
    'Shared gate tolerates existing data; later dimensions can use sign-in feedback; named Functional records are distinct.',
    'Prompt instructs recording before assertion, continuing after failures and using independent observation verdicts.',
    'Global authentication/backend floor plus mandatory navigation and SQLite gates reject shells; failure harness establishes safe zero output.',
    'Weighted 39 Functional, 8 Polish and 6 Visual observations give partial credit. Fresh model discrimination remains unmeasured.',
    'Binary objective requirements and Likert visual criteria match the requested outcomes.',
    '103 score regressions include every single-criterion loss, malformed values, altered weights and monotonicity.',
    'Render/Constraints all_pass; final scorer gates before weighted composition and excludes gate reward mass.',
    'Sole numeric dimension source is judge.toml; Functional total 34 and Polish total 12 preserved on splits.',
    'All prompts treat app text/network/error/source as untrusted and ignore submitted scoring instructions.',
    'Submission runs unprivileged; runtime probes confirm no access to tests, judge config or verifier logs.',
    'Pinned tools, temperature zero, central max effort; no installs in runner. Live external judge completion not verified.',
    'Current versions and hashes retained; shared gate and dimension-specific permissions reviewed together.',
    'Runtime, reward, prompt and judge references aligned; no duplicate dimension weights or seed restoration.',
    '37 task files only; reports, source snapshots and local drivers remain outside the upload ZIP.',
    'TOML/Python/JavaScript/shell checks pass and current code runs locally. Exact clean build and scored platform run pending.',
    'Credential is environment interpolation; demo passwords intentional. Private capture material excluded from printed evidence.',
    'Distinct membership ballot brief and original task-specific records/workflows; authorship metadata preserved.'
]
assert len(notes) == len(rubric_items)
pending_indices = {6, 10, 11, 15, 18, 22, 40, 47, 51}
review = {'scope': 'Local source review; not platform QC and not 53 platform passes',
    'rubric_source': 'task-implementation.txt', 'rubric_sha256': digest(rubric_path),
    'archive_sha256': manifest['sha256'], 'platform_qc': False,
    'items': [{'name': name, 'description': description,
        'status': 'external_validation_pending' if i in pending_indices else 'locally_reviewed',
        'note': notes[i-1]} for i, (name, description, _) in enumerate(rubric_items, 1)]}
write(OUT / 'local-source-review.json', review)

audit = {**manifest, 'local_groups': groups, 'local_group_total': sum(groups.values()),
    'motion_variant_detected': True, 'preflight_negative_cases': 10,
    'standard_checks': 147, 'archive_checks': 400, 'tested_frozen_archive_bytes': True,
    'cached_dependency_assembly_passed': True, 'agent_smoke_passed': True,
    'clean_build_passed': False, 'fresh_scored_oracle': False, 'fresh_gpt': False,
    'platform_qc': False, 'current_model_score_band_verified': False}
write(OUT / 'package-audit.json', audit)
for name in ['README.md', 'package-audit.json', 'freeze-manifest.json', 'source-hashes.json',
    'changes.diff', 'check-standard.json', 'check-upload.json', 'polish-negative-results.json',
    'preflight-regressions.json', 'image-hashes.json', 'agent-smoke-results.json',
    'coverage.json', 'criterion-migration.json', 'local-source-review.json']:
    shutil.copyfile(OUT / name, DELIVERY / name)
shutil.copyfile(OUT / 'validation-harness/prompt-provenance.json', DELIVERY / 'prompt-provenance.json')
for mode in groups:
    shutil.copyfile(OUT / ('validation-' + mode) / (mode + '-results.json'), DELIVERY / (mode + '-results.json'))
print(json.dumps(audit, indent=2))
