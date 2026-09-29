import hashlib
import json
import subprocess
import sys
import tomllib
import zipfile
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True
root = Path.cwd()
out = root / 'deliverables/colderwater-playground-devtools/full-qc-2026-09-27'
task = root / 'projects/colderwater-playground-devtools'
inventory = json.loads((out / 'qc_inventory.json').read_text())
manifest = json.loads((out / 'candidate_manifest.json').read_text())
archive = out / manifest['archive']
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha(archive.read_bytes()) == manifest['sha256']
assert archive.stat().st_size == manifest['bytes']
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    entries = [i for i in z.infolist() if not i.is_dir()]
    assert len(entries) == len({i.filename for i in entries}) == manifest['files']
    assert all(i.filename.startswith(manifest['single_root'] + '/') and '..' not in Path(i.filename).parts and not i.filename.startswith('/') and '\\' not in i.filename for i in entries)
    archive_hashes = {i.filename.split('/', 1)[1]: sha(z.read(i)) for i in entries}
    assert all((i.external_attr >> 16) & 0o111 for i in entries if i.filename.endswith('.sh'))
source_hashes = {p.relative_to(task).as_posix(): sha(p.read_bytes()) for p in task.rglob('*') if p.is_file()}
assert archive_hashes == source_hashes == manifest['source_sha256']
for name in ['qc_source_evidence.json', 'qc_extracted_source_evidence.json']:
    evidence = json.loads((out / name).read_text())
    assert evidence['failed'] == 0 and evidence['source_hashes'] == source_hashes
image_evidence = json.loads((out / 'final_image_evidence.json').read_text())
assert image_evidence['passed'] and not image_evidence['agent']['privateSolutionOrVerifierPresent'] and not image_evidence['verifier_private_solution_present']
assert set(image_evidence['agent']['appFiles']) == {'.git', '.gitkeep'}
expected_public = {k.removeprefix('environment'): v for k,v in source_hashes.items() if k.startswith(('environment/instructions/', 'environment/assets/'))}
assert expected_public == image_evidence['agent']['sourceFiles']
expected_tests = {k.removeprefix('tests/'): v for k,v in source_hashes.items() if k.startswith('tests/') and k not in ['tests/Dockerfile','tests/.dockerignore']}
assert expected_tests == image_evidence['verifier_source_hashes']
for p in ['environment/Dockerfile', 'tests/Dockerfile', 'tests/.dockerignore']:
    assert image_evidence['source_before_build'][p] == source_hashes[p]
baseline = out.parent / 'network-policy-fix-2026-09-26/colderwater-playground-devtools.zip'
assert sha(baseline.read_bytes()) == '998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686'
with zipfile.ZipFile(baseline) as z:
    baseline_hashes = {i.filename.split('/',1)[1]:sha(z.read(i)) for i in z.infolist() if not i.is_dir()}
    old_functional = tomllib.loads(z.read(manifest['single_root'] + '/tests/scored/functional/judge.toml').decode())['criterion']
new_functional = tomllib.loads((task / 'tests/scored/functional/judge.toml').read_text())['criterion']
old_by_id = {c['id']:c for c in old_functional}
new_by_id = {c['id']:c for c in new_functional}
assert set(new_by_id) - set(old_by_id) == {'cw_runtime_files_not_publicly_exposed'} and not (set(old_by_id)-set(new_by_id))
changed_existing_criteria = [k for k in old_by_id if old_by_id[k] != new_by_id[k]]
assert set(changed_existing_criteria) == {'language_dispatch','fresh_cancel','auto_run','cw_theme_switch_legibility'}
assert sum(c['weight'] for c in old_functional) == sum(c['weight'] for c in new_functional) == 49.5
delta = {'baseline_sha256':sha(baseline.read_bytes()),'current_sha256':manifest['sha256'],'changed_or_added_or_removed_paths':sorted(k for k in set(baseline_hashes)|set(source_hashes) if baseline_hashes.get(k)!=source_hashes.get(k)), 'changed_existing_functional_criteria':changed_existing_criteria,'added_functional_criterion':'cw_runtime_files_not_publicly_exposed','unchanged_existing_functional_criteria':len(old_by_id)-len(changed_existing_criteria),'functional_weights_before_after':[sum(c['weight'] for c in old_functional),sum(c['weight'] for c in new_functional)]}
(out/'independent_delta.json').write_text(json.dumps(delta,indent=2)+'\n',encoding='utf-8')

# These decisions are freshly authored from the complete workbook review.
# The inventories supply identifiers only; no earlier verdict is imported.
quality = {
1: ('Pass', 'instruction.md opens with the owner wanting a browser playground to try UI ideas, then explains saved experiments and recovery. Implementation/runtime details are linked notes; it is not a numbered rubric checklist.'),
2: ('Pass', 'The brief and six notes use concrete owner reasons and contractions, including preserving failed experiments and preventing another editor from silently overwriting work. No scoring vocabulary is needed to describe the product.'),
3: ('Pass', 'Read all public notes and five prompt/judge pairs. Source/extracted scans cover draft markers, author paths and forbidden vocabulary. Supersession wording and stale starter help were reviewed against current supported-code scope.'),
4: ('Pass', 'integration.md states /app/server.js, node launch, 0.0.0.0:3000, /api/health, /app/app.db with DB_PATH, NODE_PATH and supplied runtime. The six linked notes and canonical empty seed resolve in environment/.'),
5: ('Pass', 'Executed shared whole-token criterion-ID, public-grader-term and network-policy guards on source and extracted archive. The historical six-ID/nine-line hygiene false-PASS is not reused; actual new scans and manual overlap review are required.'),
6: ('Pass', 'Supported source execution is explicitly bounded; unsupported dynamic families are named, public CDN assets allowed, and runtime-file probes accept benign/large responses without a hidden status/size rule. Supersession notices are optional; actual Stop/timeout reasons remain required.'),
7: ('Pass', 'The task requires three-language execution, lifecycle/error recovery, a real shared revision-aware library, imports/exports and restart durability. A static editor or a localStorage library cannot satisfy the authored-Run/shared-storage prerequisites.'),
8: ('Pass', 'task.toml identity is turing/colderwater-playground-devtools, matching the folder and product. Parsed inventory is 33 functional criteria with weight49.5, four usability and six visual criteria; metadata is checked against those counts.'),
9: ('Pass', 'Both network phases are public; agent resources match the current template at2CPU/4096MiB. No allow_internet override, prebuilt image shadow or literal key is supplied.'),
10: ('Pass', 'The separate verifier frozen env and shared tools match the staged template. Claude-code fallback is expected; model/reasoning/temperature/dimension weight are absent from judge headers. Pinned CLI/MCP/RewardKit versions are checked in source and rebuilt image.'),
11: ('Note', 'Numerical nesting is executed: gates600+600=1200<1500; scored9000+900+900=10800<11100; suite sum12600<13200, leaving600 seconds outside suites. Real browser probes fit, but a complete33-criterion paid judge runtime and cold-build envelope are not measured by synthetic/local tests.'),
12: ('Pass', 'task.toml has no environment.docker_image; the agent Dockerfile remains the active installation path.'),
13: ('Pass', 'All six /instructions files and /assets/seed_data.json exist, parse where applicable and are COPYed. Empty snippets are intentional; app-provided examples are separate from the agent seed.'),
14: ('Pass', 'The canonical seed contains product identity, an empty snippets collection and an explanatory note. There are no accounts, orphan records, live credentials or personal data.'),
15: ('Pass', 'The agent Dockerfile installs Node22, Express5.1.0 and better-sqlite3 12.4.1, stages the public files and initializes an empty /app Git workspace. Final image evidence verifies actual installed runtime/input hashes, not Dockerfile prose alone.'),
16: ('Pass', 'The agent image contains inputs/instructions and only Git scaffolding in /app, with no solution or verifier. The public notes give product requirements rather than a route schema, implementation skeleton or grading fixtures.'),
17: ('Pass', 'Authored TS/React source, preview runtime, Express/SQLite server, examples, build configuration and installer were read against the brief. Current browser/installer proofs support the requested execution, editing, library and lifecycle flows; generated dependency code is accounted for through build/hash evidence.'),
18: ('Note', 'All criteria were walked against authored source and current browser evidence, including the newly added confidentiality, CSS-handler and debounce-reset branches. This establishes local golden plausibility, not a paid Oracle1.0 or a measured aesthetic-judge score.'),
19: ('Pass', 'solve.sh copies a shipped built app to /app and checks open database descriptors before resetting its owned database files. The launched server honors DB_PATH, serves built assets and needs no startup installation. Both harness launch paths enter the app directory.'),
20: ('Pass', 'The final ZIP and every source/extracted hash are bound below. Seed/examples/fixtures are fixed; record identities, revisions and timestamps are observed rather than compared with invented constants. Runtime-created nonce IDs do not change graded expected invariants.'),
21: ('Pass', 'Read the complete test.sh: initial zero record and EXIT safeguard, unprivileged sanitized app environment, node_modules symlink boundary, readiness, gates before scored and canonical score helper after each. Fresh harness regressions distinguish failures from successful stub aggregation; stubs are not judges.'),
22: ('Note', 'The rebuilt verifier and actual MCP browser/restart evidence establish local launch/tool capability. The pinned browser is Chromium152.0.7977.8. No live judge-provider call was made, so paid credential/provider grading remains unexercised.'),
23: ('Pass', 'The hard launch/health/database facts agree with integration.md. Initial and restart child shells use the app CWD and retain DB state; the app is never required to work from an undisclosed /tests CWD. Public browser dependencies remain permitted.'),
24: ('Pass', 'Parsed all five judges, canonical scoring.toml and both shared tools. Gates are all_pass binary, scored dimensions weighted_mean, all45 IDs unique, all five prompts resolve context/criteria, and only Functional declares the single-use restart MCP.'),
25: ('Pass', 'All five prompts require live Playwright evidence and ban application-source reasoning. The sole Functional exception classifies bounded HTTP prefixes for three stated confidentiality paths; it never permits filesystem reads, body dumps or inferring other behavior from source.'),
26: ('Note', 'REQUIREMENT_COVERAGE.md is a requirement-first map. Concrete missing HTTP exposure, CSS-handler isolation and debounce-reset witnesses were added instead of excused as unobservable. Browser grading still cannot establish the exact framework/database engine or exhaust every possible escape/file route; those remaining architecture limits are stated explicitly.'),
27: ('Pass', 'Reverse review found no remaining forced supersession notice, exact layout/label/API schema, exact status, arbitrary file-size cutoff, forbidden app CDN, mandatory language selector or indent width. The private-file probes use public runtime filenames solely as negative probes and tolerate benign payloads.'),
28: ('Pass', 'The four error families, unsupported execution/origin isolation, normal/stale rename, native/in-app dirty warnings and export/import have distinct outcomes. Mobile access/overflow belongs to Polish; Visual owns composition; Functional theme credit proves switching/state preservation rather than regrading readability.'),
29: ('Pass', 'Render requires newly authored DOM and console output. Constraints writes a unique snippet through UI and retrieves exact identity/fields in a clean independent context plus reload. Scored prompts inherit both gates and locally reload usable server-supplied content without repeat purchases/saves or generated-record dependencies.'),
30: ('Pass', 'Each refusal is paired with its own successful control and recovery/current-state read. Private-file checks require working UI/HTTP before and after; network blocking has a locally fulfilled unprotected positive control; stale/title checks use the correct observed revisions and actual operation shapes.'),
31: ('Pass', 'All five unsupported families, four parent-access attempts, both network paths, all dirty replacement actions and all three confidentiality paths are explicit. Record-list comparisons preserve unrelated/gate records; denied writes compare complete affected fields/revisions and meaningful siblings.'),
32: ('Pass', 'Criteria ask for rendered output, actual browser input/download, observed requests, exact saved data and bounded response signatures. Clean contexts and classifiers were exercised through the installed MCP. The HTTP confidentiality exception is behavioral exposure evidence, not a source-based implementation verdict.'),
33: ('Pass', 'Each criterion has one conjunctive bar. Optional supersession text, equivalent layouts and free debounce milliseconds are explicit freedoms, not waived required legs. Completed capped HTTP observations without private signatures are valid; absent transport evidence cannot become a claimed pass.'),
34: ('Pass', 'Judges run code, wait beyond cancellation/debounce deadlines, trigger callbacks, drag dividers, reload, switch themes and resize. CSS old-handler and repeated-edit timing now have actual interactions, not source inference or still screenshots.'),
35: ('Pass', 'Both product cores are exercised: newly authored execution and server-shared library state. Dedicated restart records prove exact surviving fields/revisions, deletion and subsequent saving after the actual single-use process-restart tool.'),
36: ('Pass', 'The empty seed and example files do not contain the distinctive gate markers, QC saved-record titles or authored success/error/recovery strings. Generic language examples or forEeach are not treated as evidence of a newly entered probe; every relevant result must be produced through the stated action.'),
37: ('Pass', 'Functional preserves the CW gate record and uses dedicated records per flow, one continuous database and state-relative list guards. Later presentation dimensions accept current content and legitimate empty states; startup does not require an empty library.'),
38: ('Pass', 'All three scored prompts demand independent verdicts and continuing after ordinary failures. A true global prerequisite failure zeros the dimension; missing evidence is never inherited as a pass from another criterion.'),
39: ('Note', 'Concrete inert-Run and localStorage-only-library fixtures fail the stronger gates; synthetic canonical scoring zeros failed prerequisites even with perfect presentation scores. This is bounded mock evidence, not a universal proof against arbitrary deceptive servers or a demand that working partial products receive zero.'),
40: ('Pass', '33 weighted binary functional outcomes, four objective usability checks and six normalized aesthetic scales provide partial credit above the strict floor. Independent controls avoid forcing all feature outcomes to inherit one earlier ordinary failure. Fresh synthetic score cases verify varied outputs.'),
41: ('Pass', 'Behaviors/gates use binary criteria. All six craft topics retain five explicit raw integer anchors1–5, matching installed RewardKit0.1.7 normalization (raw−1)/4; no raw0 or fractional scale is requested.'),
42: ('Note', 'Canonical positive weights are numerically monotone for fixed verdicts, and concrete dead/client-only witnesses are rejected before presentation credit. Relative ranking among real partial products is not measured. Fairness repairs and the functional floor can change partial credit discontinuously; arithmetic bounds are not model-score forecasts.'),
43: ('Pass', 'scoring.toml assigns gates no reward mass and keeps Functional60%/Polish20%/Visual20% with Functional strictly greater than0.05. test.sh skips scored work after a real failed gate. Fresh score fixtures cover exact floor, missing results, invalid dimensions and failed prerequisites.'),
44: ('Pass', 'Dimension policy is canonical and appears only in scoring.toml; internal Functional weight49.5 is unchanged. Most functional mass concerns execution/library integrity. New confidentiality0.5 comes from cancellation3→2.5; no hidden top-level judge weight or presentation gift was introduced. Scope-change score effects are disclosed separately.'),
45: ('Pass', 'Every prompt treats UI, payloads, source/errors and embedded instructions as untrusted and forbids following scoring directives. The confidentiality exception repeats that instruction and prohibits raw body/secret output.'),
46: ('Pass', 'Separate verifier image, root-restricted /tests and sanitized low-privilege app environment keep rubric/provider credentials outside the submitted app. Final image inspection confirms no private task payload in the agent image.'),
47: ('Note', 'Judge/model env, CLI/MCP/RewardKit versions and final source hashes are pinned; no date-dependent expected business values exist. Public networking is intentional. Remote-provider judgment and base-tag rebuilds are not claimed bit-identical or measured here.'),
48: ('Pass', 'All five prompts name Colderwater and public no-auth workspace/library surfaces, distinguish authored snippet data from implementation, and reflect current gates. No sibling-project names or stale network rule remain. Actual MCP context recipe is backed by execution evidence.'),
49: ('Pass', 'Source and extraction audits reconcile ports, entry/DB paths, six notes, seed, model env, dimension policy, total33/49.5,45 IDs and single-use restart. Final archive/source/manifest/image hashes bind these cross-file facts.'),
50: ('Pass', 'Independent archive review checks safe unique single-root paths, CRC, shell executable modes and exact source inventory. Only task/public inputs, solution and the closed17-file verifier tree ship; all QC reports/scripts/runtime evidence remain outside the upload.'),
51: ('Pass', 'Executed TOML/JSON parsing, LF/shebang/bash syntax checks, source/extracted assertions and canonical guards. App startup/build and actual browser regression evidence supplement source parsing; no unavailable official checker is claimed executed.'),
52: ('Pass', 'Source scans and manual review find no live provider keys, personal data, author-machine paths or grader directives in public inputs. The task uses a template variable only in verifier.env. Security fixtures are bounded authored product probes, and private-file classification emits no secret values.'),
53: ('Pass', 'The defining language dispatch, error-line recovery, shared budget and revision-aware code library are specific to this playground. It is not a storefront/editor task with renamed nouns; provenance acknowledges the downloaded baseline and subsequent authoring changes.'),
}
assert set(quality) == set(range(1,54))
checks = [dict(id=q['id'], verdict=quality[q['number']][0], severity='', evidence=quality[q['number']][1], finding='', action='') for q in inventory['quality']]

det = {
'check-allowlist-matches-provider.py': ('NOTE','Public network intentionally has no allowlist; frozen judge provider is OpenRouter.'),
'check-app-manifest.py': ('NOTE','Retired manifest shape is a staged no-op; fixed server entry and integration note are authoritative.'),
'check-assets-referenced.py': ('PASS','Executed path resolution and final image public-input hashes cover the seed and six linked notes.'),
'check-batched-independence-wording.py': ('PASS','Read all three scored prompts: each independently grades evidence and continues after ordinary failure.'),
'check-canary.sh': ('NOTE','Current WebDev profile explicitly overrides canary-GUID requirements.'),
'check-canonical-shared-files.py': ('PASS','Executed exact shared score.py/restart_mcp.py and frozen verifier.env comparisons against the current staged template.'),
'check-demo-accounts-agree.py': ('N-A','Public no-auth product; no demo account emails/passwords are specified or used.'),
'check-dockerfile-references.sh': ('PASS','Actual COPY/ADD statements stage only public inputs into the agent image; final image proves absence of solution/tests.'),
'check-dockerfile-sanity.sh': ('NOTE','Suite override: apt pin policy is handled by the Dockerfile check, not generic canary-era shell rules.'),
'check-dockerfiles.py': ('NOTE','Versioned bases, exact npm/pip runtime/verifier installs, current build success and image parity are verified. Unpinned apt packages and mutable version tags permit rebuild drift; the workbook treats the apt limitation as a Note, not a blocker.'),
'check-fixtures.py': ('PASS','Dockerfile COPY sources exist; canonical JSON seed parses and matches installed public asset hashes.'),
'check-instruction-content.py': ('PASS','Executed minimum brief length and draft-marker scans; finished owner request and six notes read manually.'),
'check-instruction-hygiene.py': ('PASS','Executed criterion-ID and grader-term scanners on source/extraction plus manual long-overlap review. No inference from a prior semantic-only PASS.'),
'check-instruction-states-offline-constraint.py': ('NOTE','Network is public; app fonts/scripts/CDN assets are explicitly allowed. Authored-snippet isolation is a separate product feature.'),
'check-instruction-suffix.sh': ('PASS','No terminal-bench time-limit/anti-cheat suffix; this WebDev profile requires none.'),
'check-no-cdn-or-remote-assets.py': ('NOTE','Public networking permits off-origin browser assets; this checker cannot turn an app CDN request into failure.'),
'check-no-host-paths.py': ('PASS','Executed source scan and manual runtime contract review find no author-machine paths in shipped files.'),
'check-no-literal-secrets.py': ('PASS','Executed key/PEM scans and manual env review; only the expected verifier ${OPENROUTER_API_KEY} template exists.'),
'check-no-placeholders.sh': ('PASS','Executed draft-marker scans and manual authored-file review; no unfinished task placeholders.'),
'check-no-stray-files.py': ('PASS','Exact archive/source inventory and closed verifier tree exclude caches, databases, archives, QC evidence and editor junk.'),
'check-no-trialforge-judge-keys.py': ('PASS','Parsed judge schemas have no files/target_claims or retired text-answer/check.py/expected structures.'),
'check-package-manifest-deps-preinstalled.py': ('NOTE','Express/better-sqlite3 runtime versions are preinstalled in both images. TS/Vite are build-only and public setup networking is allowed; built frontend ships.'),
'check-probe-not-in-seed.py': ('PASS','Manually inventoried distinctive saved titles/markers against empty seed and golden starter markup. Controls require new authored actions; existing generic examples cannot establish a pass.'),
'check-required-files.py': ('PASS','Executed staged tree and exact17 verifier-file inventory including app_context, two shared tools and all five judge/prompt pairs.'),
'check-reward-schema.py': ('NOTE','Retired reward.toml is absent; current scoring.toml schema parsed and compared to canonical policy.'),
'check-reward-weights.py': ('NOTE','Retired weight checker is a staged no-op; canonical scoring policy and positive per-criterion weights checked directly.'),
'check-rubric-prompt.py': ('PASS','All five complete prompts read and mechanically checked for localhost, context/criteria substitution, untrusted evidence and correct per-dimension gates.'),
'check-rubric-schema.py': ('PASS','Executed parsing/schema assertions:33 functional/49.5,4 polish,6 Likert,2 binary gates;45 unique IDs; fallback and MCP wiring correct.'),
'check-rubric-segments.py': ('NOTE','Legacy segments.json is not part of staged tasks and is absent.'),
'check-runtime-contract-strings.py': ('PASS','Read integration, harness and all prompts; port3000, health, entry, NODE_PATH and DB_PATH agree. Both child launches enter the app directory.'),
'check-runtime-deps-in-both-images.py': ('PASS','Both Dockerfiles/images contain matching Node22, Express5.1.0 and better-sqlite3 12.4.1; no startup install is needed.'),
'check-scoring-policy.py': ('PASS','Canonical two gates,60/20/20 weights,strict Functional>0.05,ordered suites and timeout sums validated;20 fresh synthetic score cases exercise output behavior.'),
'check-solve-contract.py': ('PASS','Executed LF/bash syntax and installer lifecycle evidence; installer writes /app only, no pkill/NODE_ENV production or verifier mutation.'),
'check-task-name.py': ('PASS','turing/colderwater-playground-devtools matches org and directory exactly.'),
'check-verifier-contract.py': ('PASS','Executed bash syntax plus full harness reading and fresh harness cases; zero result first, trap retained, sanitized unprivileged launch, liveness, ordered grading and restart export.'),
'check-allow-internet.sh': ('PASS','allow_internet is absent; public network modes are explicit.'),
'check-compose-host-binds.sh': ('N-A','No Docker Compose file or host bind configuration ships in the task.'),
'check-dockerfile-platform.sh': ('PASS','Source scan finds no FROM --platform CPU architecture pin.'),
'check-gpu-types.sh': ('N-A','No GPU resource configuration is requested.'),
'check-no-allow-internet-true.sh': ('PASS','The redundant allow_internet=true key is omitted.'),
'check-nproc.sh': ('PASS','No bare nproc call exists in either Dockerfile or shell entrypoint.'),
'check-pip-pinning.sh': ('PASS','Only shipped pip install is harbor-rewardkit==0.1.7; no trial-time pip installation.'),
'check-pytest-version.sh': ('N-A','No pytest/pytest-json-ctrf dependency or pin is used.'),
'check-task-absolute-path.sh': ('PASS','Public runtime/input paths are absolute; example filenames are product data, not shell CWD assumptions.'),
'check-task-slug.sh': ('PASS','colderwater-playground-devtools has exactly three hyphen-separated tokens.'),
'check-test-file-references.sh': ('PASS','Output runtime paths and three bounded privacy probes derive from integration/security requirements; product imported/exported filenames are explicitly entered test data.'),
'check-trial-network-fetch.sh': ('PASS','test.sh does not download/install trial resources; readiness contacts localhost only. Remote judge provider use is the expected verifier configuration.'),
'check-verifier-tooling-baked.sh': ('PASS','Pinned rewardkit/CLI/MCP/browser tooling is baked into tests/Dockerfile; no test-time tooling install.'),
}
assert set(det) == {d['name'] for d in inventory['deterministic']}
deterministic = [dict(name=d['name'],status=det[d['name']][0],output=det[d['name']][1],note='Local/manual equivalent supported by cited executed artifacts; official private checker implementation was not available or executed.') for d in inventory['deterministic']]
report = {
 'scope': 'Fresh independent review of all53 quality and48 deterministic workbook entries; no task edits, platform-private checker, paid Oracle or target-model measurement.',
 'candidate': manifest,
 'tasks': [{'name':'colderwater-playground-devtools','layout':'staged','checks':checks,'findings':[]}],
 'deterministic': deterministic,
}
(out/'qc_final_findings.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
binding = {'archive_sha256':manifest['sha256'],'archive_bytes':manifest['bytes'],'archive_files':manifest['files'],'safe_unique_root_crc_and_shell_modes':True,'source_archive_manifest_and_extracted_hashes_equal':True,'source_assertions':json.loads((out/'qc_source_evidence.json').read_text())['passed'],'extracted_assertions':json.loads((out/'qc_extracted_source_evidence.json').read_text())['passed'],'image_public_hashes_match':True,'image_verifier_hashes_match':True,'image_input_counts':[len(expected_public),len(expected_tests)],'image_builds':image_evidence['builds'],'quality_counts':dict(Counter(x['verdict'] for x in checks)),'deterministic_counts':dict(Counter(x['status'] for x in deterministic)),'inventory_exact_53_48':True,'paid_oracle_measured':False,'target_model_measured':False,'source_hashes':source_hashes}
(out/'independent_review_evidence.json').write_text(json.dumps(binding,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:binding[k] for k in ['archive_sha256','source_assertions','extracted_assertions','quality_counts','deterministic_counts']}))
