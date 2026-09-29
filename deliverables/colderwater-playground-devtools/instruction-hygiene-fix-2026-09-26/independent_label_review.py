import copy
import hashlib
import json
import re
import subprocess
import sys
import tomllib
import zipfile
from collections import Counter
from pathlib import Path

root = Path.cwd()
slug = 'colderwater-playground-devtools'
task = root / 'projects' / slug
old_dir = root / 'deliverables' / slug / 'hardening-2026-09-26'
out = root / 'deliverables' / slug / 'instruction-hygiene-fix-2026-09-26'
old_manifest = json.loads((old_dir / 'candidate_manifest.json').read_text(encoding='utf-8'))
new_manifest = json.loads((out / 'candidate_manifest.json').read_text(encoding='utf-8'))
old_archive = old_dir / Path(old_manifest['archive']).name
new_archive = out / Path(new_manifest['archive']).name
target = 'tests/scored/functional/judge.toml'
expected_old_ids = {'keyboard', 'persistence', 'timeout', 'duplicate', 'rename', 'themes'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def package_bytes(path, manifest):
    assert sha(path.read_bytes()) == manifest['sha256'], ('archive hash', path)
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        names = [name for name in archive.namelist() if not name.endswith('/')]
        assert len(names) == manifest['files'] == 50
        assert all(name.startswith(slug + '/') and '..' not in name.split('/') and '\\' not in name for name in names)
        result = {name[len(slug) + 1:]: archive.read(name) for name in names}
        assert {name: sha(value) for name, value in result.items()} == manifest['source_sha256']
        for rel in ['solution/solve.sh', 'tests/test.sh']:
            assert (archive.getinfo(slug + '/' + rel).external_attr >> 16) & 0o111
            assert result[rel].startswith(b'#!/bin/bash\n') and b'\r\n' not in result[rel]
        return result

old_files = package_bytes(old_archive, old_manifest)
new_files = package_bytes(new_archive, new_manifest)
assert set(old_files) == set(new_files)
current = {str(p.relative_to(task)).replace('\\', '/'): p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert new_files == current
extracted = out / ('independent-extracted-' + new_manifest['sha256'][:12])
extracted.mkdir(exist_ok=True)
with zipfile.ZipFile(new_archive) as package:
    for member in package.namelist():
        assert (extracted / member).resolve().is_relative_to(extracted.resolve())
    package.extractall(extracted)
if '--reports-only' not in sys.argv:
    subprocess.run([sys.executable, '-X', 'utf8', str(out / 'source_audit.py'), slug, str(out / 'qc_source_evidence.json')], check=True)
    subprocess.run([sys.executable, '-X', 'utf8', str(out / 'source_audit.py'), slug, str(out / 'qc_extracted_source_evidence.json'), '--task-path', str(extracted / slug)], check=True)
    subprocess.run([sys.executable, '-X', 'utf8', str(out / 'check_contract.py')], check=True)
for name in ['qc_source_evidence.json', 'qc_extracted_source_evidence.json']:
    assertions = json.loads((out / name).read_text(encoding='utf-8'))
    assert assertions['passed'] == 80 and assertions['failed'] == 0
    assert assertions['source_hashes'] == new_manifest['source_sha256']
contract = json.loads((out / 'contract_checks.json').read_text(encoding='utf-8'))
assert len(contract['checks']) == 22 and all(c['passed'] for c in contract['checks'])
image = json.loads((out / 'verifier_image_evidence.json').read_text(encoding='utf-8'))
assert image['build_passed'] and image['verifier_source_hashes_match'] and image['files'] == 15
assert image['paid_judge_exercised'] is False
for rel, value in image['source_sha256'].items():
    assert sha((task / 'tests' / rel).read_bytes()) == value
changed = [name for name in old_files if old_files[name] != new_files[name]]
assert changed == [target], changed
old_toml = tomllib.loads(old_files[target].decode())
new_toml = tomllib.loads(new_files[target].decode())
assert len(old_toml['criterion']) == len(new_toml['criterion']) == 24
crosswalk = []
for position, (before, after) in enumerate(zip(old_toml['criterion'], new_toml['criterion']), 1):
    if before == after:
        continue
    assert before['id'] in expected_old_ids
    assert before['id'] == before['name'] and after['id'] == after['name']
    assert before['id'] != after['id']
    assert {k: v for k, v in before.items() if k not in ['id', 'name']} == {k: v for k, v in after.items() if k not in ['id', 'name']}
    crosswalk.append({'position': position, 'old_id': before['id'], 'new_id': after['id']})
assert {c['old_id'] for c in crosswalk} == expected_old_ids and len(crosswalk) == 6
normalized = copy.deepcopy(new_toml)
for before, after in zip(old_toml['criterion'], normalized['criterion']):
    after['id'], after['name'] = before['id'], before['name']
assert normalized == old_toml
expected_text = old_files[target].decode()
for row in crosswalk:
    for field in ['id', 'name']:
        old_line = f'{field} = "{row["old_id"]}"'
        new_line = f'{field} = "{row["new_id"]}"'
        assert expected_text.count(old_line) == 1
        expected_text = expected_text.replace(old_line, new_line)
assert expected_text.encode() == new_files[target], 'Additional text/formatting changed'

def collision_scan(files):
    ids = []
    for name, value in files.items():
        if re.fullmatch(r'tests/(?:gates|scored)/[^/]+/judge\.toml', name):
            ids.extend(c['id'] for c in tomllib.loads(value.decode())['criterion'])
    assert len(ids) == len(set(ids)) == 36
    public = {name: value.decode() for name, value in files.items() if name == 'instruction.md' or re.fullmatch(r'environment/instructions/[^/]+\.md', name)}
    assert len(public) == 7
    collisions = []
    for criterion_id in ids:
        pattern = re.compile(r'(?<!\w)' + re.escape(criterion_id) + r'(?!\w)', re.I)
        for name, value in public.items():
            for number, line in enumerate(value.splitlines(), 1):
                if pattern.search(line):
                    collisions.append({'criterion_id': criterion_id, 'path': name, 'line': number, 'text': line})
    return {'criteria': len(ids), 'public_files': len(public), 'collisions': collisions}

old_scan = collision_scan(old_files)
new_scan = collision_scan(new_files)
assert len(old_scan['collisions']) == 9
assert {c['criterion_id'] for c in old_scan['collisions']} == expected_old_ids
assert not new_scan['collisions']
evidence = {
    'scope': 'Independent bounded source/archive review with80 source assertions and22 contract assertions. No application or broad runtime suite, private platform checker or paid model was rerun by this reviewer.',
    'old_archive_sha256': old_manifest['sha256'],
    'new_archive_sha256': new_manifest['sha256'],
    'changed_files': changed,
    'unchanged_file_count': 49,
    'changed_label_lines': 12,
    'crosswalk': crosswalk,
    'criterion_descriptions_weights_order_and_all_other_values_unchanged': True,
    'literal_text_change_is_only_six_id_and_name_pairs': True,
    'all_non_rubric_task_files_byte_identical': True,
    'all_public_prose_byte_identical': True,
    'new_archive_matches_current_source': True,
    'source_assertions_passed': 80,
    'extracted_archive_source_assertions_passed': 80,
    'contract_assertions_passed': 22,
    'rebuilt_verifier_image_id': image['image_id'],
    'rebuilt_verifier_files_matching_source': 15,
    'crc_single_root_file_set_hashes_and_shell_modes_passed': True,
    'old_collision_scan': old_scan,
    'new_collision_scan': new_scan,
    'passed': True,
}
(out / 'independent_label_review.json').write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
table = '\n'.join(f'| `{row["old_id"]}` | `{row["new_id"]}` | {row["position"]} |' for row in crosswalk)
crosswalk_doc = f'''# Colderwater criterion label crosswalk

This candidate changes only six criterion `id` and matching `name` values in `tests/scored/functional/judge.toml`. Every description, type, weight, criterion position, judge setting, prompt, instruction, asset, golden file and harness file is unchanged. The independent review proved the literal diff consists of exactly twelve label lines; the other 49 task files are byte-identical.

| Previous evidence label | Current label | Functional position |
| --- | --- | ---: |
{table}

Use this crosswalk when reading the preserved [fairness ledger](../hardening-2026-09-26/FAIRNESS_LEDGER.md) and [golden frontend coverage](../hardening-2026-09-26/GOLDEN_FRONTEND_VALIDATION.md). All other criterion identifiers are unchanged. Those documents and their runtime results remain historical evidence; they were not silently rewritten to imply a new test execution.

The previous semantic hygiene PASS was incomplete and was disproven by the platform static failure. Six ordinary product words were also criterion IDs, causing nine case-insensitive whole-token matches in public prose. No actual grader instructions were exposed, but the platform's literal collision rule still failed. The correction gives those private labels distinctive names while preserving the natural public requirements.

The independent scan covers all 36 current criterion IDs against all seven public files: zero remaining matches. This reproduces the reported collision class; it is not execution of the unavailable private platform checker or a guarantee of upload acceptance.

Previous candidate: `{old_manifest['sha256']}`. Corrected candidate: `{new_manifest['sha256']}`.
'''
(out / 'CRITERION_ID_CROSSWALK.md').write_text(crosswalk_doc, encoding='utf-8')

payload = json.loads((old_dir / 'qc_final_findings.json').read_text(encoding='utf-8'))
payload['scope'] = 'Corrected candidate: independent comparison proves only six functional ID/name pairs changed. All 53 judgments and 48 deterministic inventory entries are retained, with affected evidence updated. Prior runtime evidence is reused for unchanged behavior, not rerun. The earlier semantic hygiene PASS missed literal ID collisions and was disproven by platform feedback; the new whole-token scan finds zero matches. Private checker execution and paid Oracle/model measurements remain unestablished.'
payload['candidate'] = {k: new_manifest[k] for k in ['archive', 'sha256', 'bytes', 'files', 'single_root', 'crc_passed', 'extraction_hash_match', 'shell_modes_passed']}
payload['prior_evidence_directory'] = '../hardening-2026-09-26/'
payload['criterion_id_crosswalk'] = crosswalk
payload['correction_history'] = {'previous_hygiene_pass_disproven_by_platform': True, 'missed_check': 'literal case-insensitive whole-token public-text matches against criterion IDs', 'old_colliding_ids': sorted(expected_old_ids), 'old_matching_lines': 9, 'new_matching_lines': 0}
checks = {c['id']: c for c in payload['tasks'][0]['checks']}

def update(id, evidence, verdict=None, action=None):
    checks[id]['evidence'] = evidence
    if verdict is not None:
        checks[id]['verdict'] = verdict
    if action is not None:
        checks[id]['action'] = action

update('instruction_leaks_no_grader_machinery', 'Public prose is byte-identical and contains ordinary product requirements. The previous semantic review missed that six of those ordinary words were also private criterion IDs. Current distinctive IDs yield zero whole-token matches across all36 IDs and seven public files; the platform-reported collision class is corrected.')
update('instruction_is_spelled_right_and_uncontaminated', 'All public prose and paths are byte-identical to the previously reviewed candidate. Six private labels were renamed; no unnatural synonyms or product requirements were introduced to bypass the hygiene check.')
update('grading_wiring_is_structurally_correct', 'Parsed all five judges with36 globally unique IDs,24 functional criteria and unchanged weight49.5. Full parsed-object comparison proves that only six ID/name pairs changed; descriptions, ordering, scoring, MCP settings and prompts remain identical.')
update('solution_is_frozen_and_deterministic', f'Corrected candidate frozen at SHA256 {new_manifest["sha256"]}. All golden and input files are byte-identical to the prior candidate. Generated IDs and ungraded timestamps retain the previously documented normal variation.')
update('dockerfile_builds_the_declared_world', 'Agent Dockerfile and public inputs are byte-identical, so prior successful empty-agent image inspection is reused. The new colderwater-verifier:20260926-hygiene image builds successfully and all15 copied verifier files match current source hashes, including renamed criterion labels.')
update('verifier_image_can_launch_and_grade', 'The rebuilt verifier image contains all15 exact current verifier files. Prior real browser, restart MCP and synthetic plumbing evidence applies to unchanged runtime. Application runtime suites and paid provider-judge calls were not repeated for private label changes.')
update('task_folder_holds_only_task_files', 'Corrected ZIP independently verified:50 files, one task root, CRC, entry hashes equal current source and manifest, valid shell executable modes. Exactly one existing file changed; the other49 files and complete file set are unchanged. Reports stay outside the task.')
update('everything_parses_and_would_run', 'Augmented source audit passed80/80 on both current source and extracted corrected ZIP, including the new shared literal-ID scanner. Mapped contract audit passed22/22. Exact semantic/textual comparison permits only six ID/name pairs. Application runtime suites were not rerun; their unchanged-behavior evidence is explicitly reused.')
update('cross_file_runtime_contract_is_consistent', 'Runtime facts, prompts, scoring, weights, source fixtures and descriptions are unchanged. Explicit CRITERION_ID_CROSSWALK.md maps the six renamed private labels to preserved fairness/frontend evidence. Current candidate/manifest/source hashes agree.')
for entry in payload['deterministic']:
    if entry['name'] == 'check-instruction-hygiene.py':
        entry.update(status='PASS', output='Corrected local equivalent: independent case-insensitive whole-token scan of all36 IDs against instruction.md and six notes yields0 matches. Preserved old ZIP reproduces6 colliding IDs across9 lines. Earlier semantic PASS was disproven by platform feedback; private checker itself was not rerun.')
    elif entry['name'] == 'check-rubric-schema.py':
        entry.update(status='PASS', output='All5 judges parsed;36 unique IDs; six ID/name pairs renamed. Exact parsed and textual comparison preserves every other field, description, weight, order and judge setting.')
    elif entry['name'] == 'check-dockerfiles.py':
        entry.update(status='PASS', output='Unchanged agent build evidence reused. Rebuilt colderwater-verifier:20260926-hygiene succeeds; all15 copied verifier files independently match the new candidate, including renamed labels. No paid judge call.')
    elif entry['name'] == 'check-no-stray-files.py':
        entry.update(status='PASS', output='Independent archive comparison confirms unchanged50-file set, one root, no new scratch/database/cache files;49 files are byte-identical.')
    elif entry['name'] == 'check-canonical-shared-files.py':
        entry.update(status='PASS', output='Canonical shared tools and task.toml are byte-identical to prior verified candidate; no helper, provider or scoring change.')
inventory = json.loads((old_dir / 'qc_inventory.json').read_text(encoding='utf-8'))
assert len(checks) == 53 and set(checks) == {c['id'] for c in inventory['quality']}
names = [c['name'] for c in payload['deterministic']]
assert len(names) == len(set(names)) == 48 and set(names) == {c['name'] for c in inventory['deterministic']}
(out / 'qc_inventory.json').write_text(json.dumps(inventory, indent=2) + '\n', encoding='utf-8')
(out / 'qc_final_findings.json').write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
counts = Counter(c['verdict'] for c in checks.values())
summary = f'''# Colderwater instruction-hygiene correction: final local QC

The corrected archive changes only six functional criterion IDs and their matching names. **Descriptions, weights, order, requirements, golden behavior and all other task files are unchanged.** Independent comparison proved exactly twelve label-line substitutions in one file; the other49 files are byte-identical.

## Correction to the previous review

The prior local `check-instruction-hygiene.py` PASS came from semantic review and did not perform the literal ID-collision scan. Platform feedback disproved that PASS: six ordinary public words were also criterion IDs, matching nine public-text lines. This was a local preflight omission. Public prose did not expose actual grading instructions, but it still violated the platform's literal rule.

The new independent whole-token scan checks all36 criterion IDs against `instruction.md` and six instruction notes and finds **zero collisions**. Private labels were renamed; public prose remains unchanged. This is a documented local equivalent, not execution of the private platform checker or a guarantee that the platform will accept the upload.

## Frozen candidate

- Archive: `{new_manifest['archive']}`
- SHA-256: `{new_manifest['sha256']}`
- {new_manifest['files']} files; {new_manifest['bytes']:,} bytes; one root `{slug}`.
- ZIP CRC, source/entry/manifest hashes and executable LF shell modes independently pass.
- Counts remain24 functional criteria, weight49.5; four polish checks; six visual topics; 60%/20%/20% shares and functional floor0.05.

## Evidence and scope

| Review | Evidence |
| --- | --- |
| Exact old/new ZIP and semantic comparison | `independent_label_review.json` |
| Augmented source audit:80/80 on source and extracted ZIP | `qc_source_evidence.json`, `qc_extracted_source_evidence.json` |
| Mapped contract audit:22/22 | `contract_checks.json` |
| Known-bad old candidate returns nonzero | `source_audit_regression.json` |
| Rebuilt verifier image:15 copied files match current source | `verifier_image_evidence.json`, `verifier_build.log` |
| Current-to-historical criterion mappings | [CRITERION_ID_CROSSWALK.md](CRITERION_ID_CROSSWALK.md) |
| Preserved fairness mapping | [Previous fairness ledger](../hardening-2026-09-26/FAIRNESS_LEDGER.md), read with the crosswalk |
| Preserved golden/frontend coverage | [Previous frontend validation](../hardening-2026-09-26/GOLDEN_FRONTEND_VALIDATION.md), read with the crosswalk |
| Prior runtime and complete source QC | [Previous local QC](../hardening-2026-09-26/QC_FINAL.md), subject to the hygiene correction above |

All53 workbook judgments and all48 deterministic inventory names are represented exactly once: **{counts['Pass']} Pass, {counts['Note']} Note, {counts['Fail']} Fail**. The retained results concern unchanged behavior; broad application tests were not rerun for private label changes. The rebuilt verifier image is `{image['image_id']}`; all15 copied verifier files match current source. No shared files, task requirements or goldens were altered by this review.

Paid Oracle/model scores and acceptance by the private platform checks remain unmeasured for this corrected candidate. Synthetic harness scores are not Oracle scores. Browser behavior still cannot prove the exact internal framework or database engine; those existing review limitations remain documented in the workbook.
'''
(out / 'QC_FINAL.md').write_text(summary, encoding='utf-8')
subprocess.run([sys.executable, '-X', 'utf8', 'harbor-webdev-rubric-qc/scripts/build_report.py', str(out / 'qc_final_findings.json'), '-o', str(out / 'QC_FINAL.xlsx'), '--client-safe'], check=True)
print(json.dumps({'candidate': new_manifest['sha256'], 'changed_files': changed, 'renamed_pairs': crosswalk, 'old_collisions': 9, 'new_collisions': 0, 'judgments': dict(counts), 'deterministic_inventory': len(names)}, indent=2))
