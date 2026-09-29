import argparse
import hashlib
import json
import subprocess
import sys
import zipfile
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('slug')
parser.add_argument('folder')
args = parser.parse_args()
root = Path.cwd()
out = root / 'deliverables' / args.slug / args.folder
taskroot = root / 'projects' / args.slug
source_audit = root / 'deliverables/colderwater-playground-devtools/hardening-2026-09-26/source_audit.py'
subprocess.run([sys.executable, '-X', 'utf8', str(source_audit), args.slug, str(out / 'qc_source_evidence.json')], check=True)
source = json.loads((out / 'qc_source_evidence.json').read_text())
assert source['failed'] == 0
manifest = json.loads((out / 'candidate_manifest.json').read_text())
archive = Path(manifest['archive'])
if not archive.is_absolute():
    options = [root / archive, out / archive, root / 'deliverables' / archive]
    archive = next(p for p in options if p.exists())
archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive_hash == manifest['sha256']
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    names = [n for n in package.namelist() if not n.endswith('/')]
    assert len(names) == manifest['files']
    assert all(n.startswith(args.slug + '/') and '\\' not in n and '..' not in n.split('/') for n in names)
    zipped = {n[len(args.slug) + 1:]: hashlib.sha256(package.read(n)).hexdigest() for n in names}
    assert zipped == source['source_hashes'] == manifest['source_sha256']
    for rel in ['solution/solve.sh', 'tests/test.sh']:
        assert (package.getinfo(args.slug + '/' + rel).external_attr >> 16) & 0o111
    extracted = out / ('qc-extracted-' + archive_hash[:12])
    extracted.mkdir(exist_ok=True)
    for member in package.namelist():
        target = (extracted / member).resolve()
        assert target.is_relative_to(extracted.resolve())
    package.extractall(extracted)
subprocess.run([sys.executable, '-X', 'utf8', str(source_audit), args.slug, str(out / 'qc_extracted_source_evidence.json'), '--task-path', str(extracted / args.slug)], check=True)
extracted_evidence = json.loads((out / 'qc_extracted_source_evidence.json').read_text())
assert extracted_evidence['failed'] == 0 and extracted_evidence['source_hashes'] == source['source_hashes']
image_evidence = json.loads((out / 'final_image_evidence.json').read_text())
assert image_evidence['agent']['passed'] and image_evidence['verifier_source_hashes_match']
assert image_evidence['agent']['appFiles'] == ['.git', '.gitkeep']
assert image_evidence['agent']['privateSolutionOrVerifierPresent'] is False
for path, expected in image_evidence['agent']['sourceFiles'].items():
    assert hashlib.sha256((taskroot / 'environment' / path.lstrip('/')).read_bytes()).hexdigest() == expected
data = json.loads((out / 'qc_review_findings.json').read_text())
data['scope'] = 'Final local authoring review: all 53 workbook judgments and all 48 deterministic inventory names are answered. The deterministic entries are manual equivalents augmented by executed local source/runtime checks, not results from unavailable private platform scripts. Paid Oracle, provider-judge and target-model runs were not exercised. Synthetic harness scores are plumbing fixtures only.'
data['candidate'] = {k: manifest[k] for k in ['archive', 'sha256', 'bytes', 'files', 'single_root', 'crc_passed', 'extraction_hash_match', 'shell_modes_passed']}
answers = {c['id']: c for c in data['tasks'][0]['checks']}

def result(id, verdict, evidence, action=''):
    answers[id].update(verdict=verdict, evidence=evidence, action=action, severity='', finding='')

result('task_folder_holds_only_task_files', 'Pass', f"Independently validated final archive: {manifest['files']} task files under one root, valid CRC, every entry hash equals current source and manifest, executable shell modes, no database/cache/scratch. Reports remain outside the task.")
result('everything_parses_and_would_run', 'Pass', f"Final refreshed source assertions: {source['passed']} passed, zero failures. TOML/JSON, LF bash syntax, schema, weights, timeouts, paths, canonical shared bytes and source scans pass. Actual runtime/build evidence is separately recorded.")
result('dockerfile_builds_the_declared_world', 'Pass', 'Final built-image evidence confirms an agent app directory containing only .git/.gitkeep, exact current instruction/asset hashes, Node22.23.2, Express5.1.0 and better-sqlite3 12.4.1, with no solution/tests leakage. Final verifier /tests hashes match current source.')
result('dimensions_cover_every_graded_requirement', 'Note', 'Requested browser behaviors are mapped to the functional/usability/visual criteria. The technical stack is disclosed and the golden uses it, but browser health and durable behavior cannot establish the exact internal framework or SQLite engine. No invented SQL endpoint or false browser proof was added.', 'Keep this browser-only observability limit explicit; do not infer source-level architecture from a successful health request.')
result('solution_is_frozen_and_deterministic', 'Note', f"Candidate is frozen at SHA256 {archive_hash}. Authored input values are fixed; generated record IDs and ungraded timestamps may vary legitimately. No graded expected value depends on a generated identifier or run date.")
result('verifier_is_deterministic_and_offline_pinned', 'Note', 'Shared model, judge environment, RewardKit, browser/MCP and CLI versions are pinned. Actual installed RewardKit raw 1–5 normalization and browser tool inventory were inspected. Public network and a remote model provider still prevent a promise of bit-identical paid judgments.')
result('solution_covers_every_graded_dimension', 'Note', 'Local source, deterministic API and actual Chromium browser evidence cover the requested functional and presentation surfaces. This supports golden readiness, but does not constitute a paid Oracle 1.0 or guarantee every model-judge verdict.', 'Measure the paid Oracle and target model on this exact candidate when authorized.')
result('verifier_image_can_launch_and_grade', 'Note', 'Pinned verifier image builds and launches the app, actual Chromium, browser tooling, restart MCP and scorer. Local harness cases use synthetic RewardKit output to test plumbing. A paid provider-judge call was not exercised.', 'Do not report synthetic 1.0 harness records as Oracle scores.')

is_colderwater = args.slug.startswith('colderwater')
if is_colderwater:
    backend = json.loads((out / 'backend_results.json').read_text())
    assert len(backend['checks']) == 127 and all(c['passed'] for c in backend['checks'])
    harness = json.loads((out / 'harness_results.json').read_text())
    assert len(harness) == 4 and all(c['exit_code'] == 0 and c['paid_judge_exercised'] is False for c in harness)
    runtime = json.loads((out / 'ui-evidence-chromium152/runtime-results.json').read_text())
    library = json.loads((out / 'ui-evidence-library152/library-results.json').read_text())
    assert len(runtime['results']) == 13 and not runtime['errors'] and all(c['result'] == 'pass' for c in runtime['results'])
    assert len(library['results']) >= 11 and not library['errors'] and all(c['result'] == 'pass' for c in library['results'])
    assert '"browser_restart_criterion": "passed"' in (out / 'browser_restart_harness.log').read_text()
    result('instruction_is_achievable_and_unambiguous_in_the_environment', 'Pass', 'All six notes explicitly define supported source, shared time budget, exact source-line reporting, rollback and revision conflicts. Actual Chromium 152 demonstrated supported loops terminating while the host stayed responsive, asynchronous error lines, fresh-run cancellation and recovery.')
    result('solution_covers_every_deliverable', 'Pass', f'Golden includes editable TypeScript/React source, real CodeMirror/Acorn, Vite config, lockfile, compiled local assets and Express/SQLite. Backend 127/127 assertions, 13 runtime groups and {len(library["results"])} library groups pass. Exact user-source errors, time limits, dirty navigation, revision conflicts and actual restart were observed.')
    result('solution_honors_the_runtime_contract_and_is_self_contained', 'Pass', 'solve.sh copies the built app without runtime installation. The real verifier harness starts /app/server.js as UID 65534 with sanitized environment and DB_PATH. Actual Chromium and restart MCP retain exact records/revisions and permit a subsequent valid save.')
    result('verifier_entrypoint_is_safe_and_always_scores', 'Pass', 'Four actual verifier-container cases pass: relative working directory, golden restart, gate failure skipping scored, and missing app producing zero. Initial/restart launches use the app directory; the outer reward EXIT trap remains intact. Scores in these harness cases are explicitly synthetic.')
    result('tests_and_key_are_out_of_agent_reach', 'Pass', 'Separate verifier image, restrictive /tests permissions, UID 65534 app launches and env -i are confirmed by source and actual harness observations. Injected HARNESS_SECRET is absent before and after restart; agent image contains no tests or solution.')
    result('floor_is_low_for_shells_mocks_and_stuffing', 'Note', 'Static presentation, pane sizing, syntax display and themes total at most 2/49.5 functional credit, below the 0.05 floor. A genuinely working editor with multiline indentation can reach 3/49.5 and an upper-bound reward near 0.436 with perfect presentation. This is a partial-product witness, not a measured model score.')
    for c in data['deterministic']:
        if c['name'] == 'check-verifier-contract.py':
            c.update(status='PASS', output='Valid LF bash plus four actual verifier-container harness cases. Actual browser-generated records survive the single-use restart MCP and allow a subsequent revision-aware save. RewardKit scores are synthetic fixtures.')
        elif c['name'] == 'check-dockerfiles.py':
            c.update(status='PASS', output='Pinned staged agent/verifier images build. Agent excludes solution/tests; verifier bakes tools and runtime dependencies. System apt package versions follow the canonical template.')
        elif c['name'] == 'check-package-manifest-deps-preinstalled.py':
            c.update(status='NOTE', output='Runtime Express and better-sqlite3 are preinstalled in both images. Vite and TypeScript are development-only locked dependencies; the delivered frontend is already compiled. Public setup network is permitted.')
        elif c['name'] == 'check-no-cdn-or-remote-assets.py':
            c.update(status='NOTE', output='Public platform network permits CDN generally, but this task requests local delivered assets. Actual Chromium runs use local scripts/editor assets and a local loopback runner; source inspection found no required external runtime service.')
    evidence_lines = [
        '| Source | 79 local assertions passed | `qc_source_evidence.json` |',
        '| Contract fixtures | 22 source/fixture assertions passed | `contract_checks.json`, `FAIRNESS_LEDGER.md` |',
        '| Backend | 127/127 assertions passed | `backend_results.json` |',
        f'| Actual Chromium 152 | 13 execution groups + {len(library["results"])} library/usability groups passed | `ui-evidence-chromium152/runtime-results.json`, `ui-evidence-library152/library-results.json` |',
        '| Actual process restart | Own original, independent edited copy and deleted control verified after restart; new save succeeds | `browser_restart_harness.log` |',
        '| Verifier plumbing | Four cases passed; synthetic score fixtures only | `harness_results.json` |',
        '| Screenshots | Desktop light/dark, library and mobile inspected; focused mobile preview remains visible | `ui-evidence-chromium152`, `ui-evidence-library152` |',
    ]
else:
    with zipfile.ZipFile(out / 'input-baseline.zip') as baseline:
        old = {n[len(args.slug) + 1:]: hashlib.sha256(baseline.read(n)).hexdigest() for n in baseline.namelist() if not n.endswith('/')}
    changed = {p for p in source['source_hashes'] if source['source_hashes'][p] != old.get(p)}
    assert changed == {'tests/scored/polish/judge.toml', 'tests/scored/polish/prompt.md', 'tests/scored/visual/judge.toml', 'tests/scored/visual/prompt.md'}
    presentation_dir = root / 'deliverables/ridgeline-print-storefront/hardening-2026-09-26/round2'
    presentation = json.loads((presentation_dir / 'browser-criteria-results.json').read_text())
    navigation = json.loads((presentation_dir / 'navigation-supplement-results.json').read_text())
    assert len(presentation['checks']) == 45 and all(c['passed'] for c in presentation['checks']) and presentation['passed']
    assert len(navigation['checks']) == 4 and all(c['passed'] for c in navigation['checks']) and navigation['passed']
    assert not presentation['pageErrors'] and not presentation['externalRequests'] and not presentation['orderWrites']
    data['round2_scope'] = 'Only polish/visual judges and prompts changed. Frozen baseline comparison confirms the golden, functional rubric, gates, harness and shared tools remain unchanged. Prior evidence is reused with that scope, not described as newly rerun.'
    result('floor_is_low_for_shells_mocks_and_stuffing', 'Note', 'A static seed page can receive discovery only: 1/35 is below the 0.05 floor. A functioning cart/preview without order writes can reach about 0.454 with perfect presentation. This is a partial-product calibration witness, not a static-shell pass or measured model result.')
    evidence_lines = [
        '| Round-2 source | 79 local assertions passed | `qc_source_evidence.json` |',
        '| New presentation browser walk | 45 main + 4 return-navigation assertions passed in actual Chromium 152; 21 screenshots | `../hardening-2026-09-26/round2/REVIEW.md` |',
        '| Unchanged backend | Prior 203/203 assertions passed | `../hardening-2026-09-26/backend_smoke_results.json` |',
        '| Unchanged arithmetic | Prior 19 cases passed | `../hardening-2026-09-26/rubric_math_results.json` |',
        '| Unchanged browser flows | Prior 9 primary + 5 resilience groups passed | `../hardening-2026-09-26/ui-evidence` |',
        '| Unchanged harness/scorer | Prior four harness cases and 13 scoring fixtures passed | `../hardening-2026-09-26/harness_results.json`, `../hardening-2026-09-26/scorer_results.json` |',
    ]
assert len(answers) == 53
known = {r['name'] for r in json.loads((out / 'qc_inventory.json').read_text())['deterministic']}
assert len(data['deterministic']) == len({r['name'] for r in data['deterministic']}) == 48
assert {r['name'] for r in data['deterministic']} == known
counts = Counter(c['verdict'] for c in answers.values())
(out / 'qc_final_findings.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
summary = f'''# {args.slug}: final local QC

All 53 workbook judgments are answered: **{counts['Pass']} Pass, {counts['Note']} Note, {counts['Fail']} Fail**. All 48 deterministic inventory names have explicit manual-equivalent results. No unresolved source or demonstrated runtime blocker was identified in this review.

This is local authoring QC. The private official checker executables, platform QC, paid Oracle and target-model runs were not exercised. Synthetic harness scores test plumbing and must not be presented as Oracle scores.

## Candidate

- Archive: `{manifest['archive']}`
- {manifest['files']} files; {manifest['bytes']:,} bytes; one root `{args.slug}`.
- SHA-256: `{archive_hash}`
- Independent CRC, every entry/source/manifest hash and executable shell-mode checks passed.
- Source counts: {source['counts']['functional']['criteria']} functional criteria, weight {source['counts']['functional']['weight']:g}; four polish checks; six visual topics. Outer shares remain 60%/20%/20%.

## Evidence

| Layer | Observed result | Artifact |
| --- | --- | --- |
''' + '\n'.join(evidence_lines) + '''
| Packaging | CRC, exact source hashes, one root and executable shell modes passed | `candidate_manifest.json` |
| Extracted archive | All 79 local source assertions rerun successfully on the extracted ZIP; hashes equal current source | `qc_extracted_source_evidence.json` |
| Built images | Empty agent app, exact input/verifier source hashes, correct dependencies and no solution/tests leakage | `final_image_evidence.json` |

Polish now checks straightforward usability. Visual uses six attainable, independent raw 1–5 aesthetic scales matching installed RewardKit 0.1.7 normalization. Clear conventional styling can earn full credit; no automatic pass, invented brand or perfection bar was added. Functional rules retain their substantive difficulty.

## Measurement limits

Browser behavior cannot prove a specific internal framework or database engine; the gates honestly check observable prerequisites. Generated identifiers and ungraded timestamps vary normally. Local evidence establishes readiness but cannot guarantee an Oracle 1.0, a platform pass or a particular target-model score. The analytic partial-product floor witness is recorded in the workbook.

Use `QC_FINAL.xlsx` and `qc_final_findings.json` for this frozen candidate. `QC_REVIEW.xlsx` is the earlier source-review checkpoint with its then-pending runtime notes.
'''
if not is_colderwater:
    summary += '\nRound-2 scope: only the four polish/visual description and prompt files changed. Prior commercial/harness evidence above is reused against unchanged source, not claimed to have been rerun. The new 49-assertion presentation walk directly exercises the simplified gates and polish criteria; its screenshot review is local, not a paid visual score. The review discloses a corrected test-only background-colour probe (the root element paints the page, not the transparent body); no app change was made for that probe.\n'
(out / 'QC_FINAL.md').write_text(summary, encoding='utf-8')
subprocess.run([sys.executable, '-X', 'utf8', 'harbor-webdev-rubric-qc/scripts/build_report.py', str(out / 'qc_final_findings.json'), '-o', str(out / 'QC_FINAL.xlsx'), '--client-safe'], check=True)
print(json.dumps({'task': args.slug, 'judgments': dict(counts), 'inventory': 48, 'candidate_sha256': archive_hash}))
