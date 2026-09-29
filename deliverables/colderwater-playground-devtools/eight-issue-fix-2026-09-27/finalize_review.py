import hashlib
import json
import subprocess
import sys
import tomllib
from collections import Counter
from pathlib import Path

root = Path.cwd()
out = Path(__file__).resolve().parent
task = root / 'projects/colderwater-playground-devtools'
read = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
write = lambda name, data: (out / name).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
manifest = read(out / 'candidate_manifest.json')
current = {p.relative_to(task).as_posix(): sha(p) for p in task.rglob('*') if p.is_file()}
assert current == manifest['source_sha256']
assert sha(out / manifest['archive']) == manifest['sha256']
old = read(out.parent / 'metadata-cleanup-2026-09-27/candidate_manifest.json')['source_sha256']
delta = {'baseline_sha256': '09f4f6cb3647f7d8395a4367fa931c1fb2ac56713bc25df431bd10b6a8b88f7e',
         'candidate_sha256': manifest['sha256'],
         'changed': [p for p in current if p in old and current[p] != old[p]],
         'added': sorted(set(current) - set(old)), 'removed': sorted(set(old) - set(current)),
         'unchanged': [p for p in current if old.get(p) == current[p]]}
write('change_scope.json', delta)
images = read(out / 'final_image_evidence.json')
assert images['passed'] and images['source_unchanged_during_build']
assert images['source_before_build'] == {p: h for p,h in current.items() if p.startswith(('environment/', 'tests/'))}
for name in ['source_audit.json', 'extracted_source_audit.json']:
    audit = read(out / name)
    assert audit['failed'] == 0 and audit['passed'] == 90, audit.keys()
harness = read(out / 'harness/review_binding.json')
assert harness['passed'] and harness['test_sh_sha256'] == current['tests/test.sh']
golden = read(out / 'golden/golden_evidence_binding.json')
assert golden['solution_files'] == {p.removeprefix('solution/'): h for p,h in current.items() if p.startswith('solution/')}
assert golden['generated_javascript_only_badge_text_changed'] and golden['unchanged_runtime_server_installer']
for path, expected in golden['owned_source_bindings'].items(): assert current[path] == expected, path
for name, proof in golden['fresh_proofs'].items():
    assert proof['passed'] and sha(out / 'golden' / name) == proof['sha256']
assert read(out / 'regression_mutation_results.json')['passed']
probe = read(out / 'functional/browser_probe_results.json')
assert probe['passed'], 'New browser recipes/fixtures must finish before finalization'
inventory = read(out / 'qc_inventory.json')

quality_evidence = {
1: 'instruction.md asks for a local playground, explains loss of working previews and two-editor conflicts, and points to six product notes. The new security paragraph asks for a narrow reserved-URL boundary rather than describing a grading probe.',
2: 'instruction.md uses ordinary first-person needs and varied sentences. security.md says Keep the database and server files private; no rubric terminology or polished testing checklist was added. Naturalness remains a human judgment.',
3: 'Source/extraction audits parse all text formats and find no task placeholders, author-machine paths or matching secret shapes. Short metadata describes this product; no sibling terminology added.',
4: 'integration.md states /app, node /app/server.js, 3000, DB_PATH, /api/health, built assets and supplied dependencies. Unrequested during-loop responsiveness and escape-help requirements were removed. The three reserved URLs are now explicit in security.md.',
5: 'Public criterion-ID, grading-term and public-network guards passed on current source and extraction. EVALUATION_INCOMPLETE and controlled network URLs remain solely in inaccessible verifier files.',
6: 'behaviour.md distinguishes original execution, pending callbacks and completed-preview interactions. Standard undocumented Escape then Tab is accepted and freshly exercised. Declared reserved URL alternatives include equivalent denial responses and working SPA/redirect fallback.',
7: 'A real authored Run, error recovery, isolated preview and shared durable library are needed. Editor-only and static-seed shells cannot meet the two existing prerequisites.',
8: 'task.toml identity matches turing/colderwater-playground-devtools; difficulty is hard and category programming. Product description and provenance remain short; no personal attribution or QC history.',
9: 'Agent public network, 2 CPU/4096MB and 7200-second task limit match the current template. No environment.allow_internet or prebuilt image override. Frozen provider placeholders are confined to verifier.env.',
10: 'Separate verifier and canonical environment match the template. Actual final images contain pinned RewardKit0.1.7, Playwright MCP0.0.79 and Chromium152. The judge header contains only the permitted claude-code fallback, not a model override.',
11: 'functional/TIMING_AND_COVERAGE_LEDGER.md enumerates all35 checks and about66 seconds of explicit waits excluding UI/tool/reasoning/restart overhead. Redundant recovery saves and custom classification were removed; restart is earlier.9000+900+900<11100;600+600<1500;12600<13200. Paid end-to-end duration remains unmeasured, so timeout adequacy is not certified.',
12: 'task.toml has no environment.docker_image; both Dockerfiles retain active build instructions and final actual builds succeeded.',
13: 'All six instructions and seed_data.json exist and all seven public-file hashes match the rebuilt agent image. The empty synthetic library description agrees with the public opening-state alternatives.',
14: 'environment/assets/seed_data.json parses and contains product scope plus an empty snippets list; no identities, secrets, or orphan relationships. Runnable examples are intentionally authored by the builder.',
15: 'The actual agent image builds with Node22, Express5.1.0, better-sqlite3 12.4.1 and public instruction/asset copies; the image probe confirms staged data and empty app. See final_image_evidence.json.',
16: 'Agent image inspection confirms no golden app, solution or verifier files; /app contains only initialization. Golden/graded files are separate shipped task directories.',
17: 'golden/GOLDEN_CRITERION_EVIDENCE.json maps all47 criteria with fresh versus historical observations. Runtime/server/installer are unchanged; compiled JS differs from the last upload only by badge text. Fresh affected flows support the public deliverables.',
18: 'Six corrected Functional scenarios and two five-group keyboard variants pass, plus the new privacy/network proof and real harness restart. Unchanged implementation witnesses are explicitly reused. This supports golden capability but is not a full paid Oracle result or a fresh aesthetic judgment of every anchor.',
19: 'solve.sh is valid LF bash, copies the frozen app to /app, refuses active database installation and removes only its exact closed canonical database files at install. Runtime/restart preserve saved records; four fresh harness cases cover real launch/restart, with prior installer evidence reused for identical code.',
20: 'All50 current files match the ZIP and extracted hashes; source/build output is frozen and bundled, not fetched at runtime. This pass did not commit or push, and runtime-generated user IDs are intentionally observed rather than pinned. Do not call this a committed release.',
21: 'harness/HARNESS_REVIEW.md records bounded TERM/KILL cleanup, reward/status retention,40 structured-report guard cases and four orchestration cases. Evaluator errors produce graded0/no_op1 plus diagnostic; legitimate app failures preserve valid grading. Canonical score.py is unchanged.',
22: 'The final verifier image builds and has the pinned CLI/MCP/browser/runtime. Actual MCP recipes and restart execute locally. Full provider authentication and paid judging have not been exercised; synthetic verdict fixtures prove plumbing only.',
23: 'Launch and restart both chdir to the app entry directory and use the declared PORT/DB_PATH/runtime dependencies. Shared context agrees with the public no-account library. Tests do not require an undeclared external service or package installation.',
24: '90 source assertions and90 extraction assertions validate the exact staged inventory, TOML types, positive criterion weights, two all-pass gates, three weighted dimensions, one Functional restart server and prompt substitutions.',
25: 'All five prompts direct Playwright to localhost:3000 and prohibit submitted implementation inspection. The previous private-source exception is removed; reserved URLs are judged through visible HTTP/navigation outcomes. Supplied network recipes provide instrumentation, not product verdicts.',
26: 'The all35 Functional review maps public lifecycle, editor, library, import/export and isolation behavior; Polish covers real keyboard example/library navigation and Visual presentation. Exact framework/database-engine prescriptions cannot be proved solely through a browser, and finite security examples are representative coverage, not exhaustive proof.',
27: 'Removed during-loop host-control demand and documentation-only editor exit. Stale UI proof requires a real editor instead of a fake replay substitute. Public reserved routes are explicit and equivalent denial responses are accepted. See functional/FUNCTIONAL_REPAIRS.md and golden/GOLDEN_REPAIR_REVIEW.md.',
28: 'The former language/interactions and original-run/interaction-budget conjunctions each split2.5 into1.5+1.0. Redundant save/reload legs are removed. Stale rename owns server fields; stale save owns dirty UI. Polish mobile operability remains distinct from Visual composition.',
29: 'Render requires a new authored preview and console result. Constraints requires UI save and retrieval from an independent empty-storage context. Each scored prompt restates live surfaces and observed server content, tolerates empty current libraries, and zeroes actual broken prerequisites; tool failures are distinguished.',
30: 'Negative execution, stale writes, filename/title rejection, source-file requests and network blocks have their own successful controls and recovery. The network setup proves both resources load outside the restricted preview; a failed control invalidates evaluation instead of earning credit.',
31: 'The reviewed rubric covers all five unsupported execution families, four dirty-navigation destinations, save/rename/delete stale operations and declared reserved paths. Security remains finite representative probes, not exhaustive proofs over every possible program or URL. Exact database engine is not inferred from HTTP.',
32: 'Private-source parsing is replaced by declared URL denial/rendered fallback. Exact network setup/count/cleanup callbacks run on installed MCP, with an unrestricted-source counterexample. Dirty-state retention uses actual editor UI. Tool failure has a tested ungraded path.',
33: 'Auto-run OFF/cancel waits exceed observed positive delay. Captured old requests no longer stand in for visible dirty drafts. Shared context and all five prompts agree on incomplete evaluations, actual observed failures and the earlier single-use restart.',
34: 'Fresh MCP evidence observes delayed click/key/input, original shared timeout, pending second-click nonextension, timed auto-run windows and real two-editor conflict. Keyboard routes use actual key events; desktop/mobile screenshots cover both themes.',
35: 'Core Run and clean-context server library retrieval are prerequisites. save_load, real dirty-editor conflict and single actual process restart establish durable mutation/recovery. The restart now follows basic save/load with its own controls.',
36: 'Distinctive QC/probe markers reside in tests and are absent from public seed and initial golden content. Public seed contains no snippets; successful authored actions are required rather than recognition of prefilled probe text.',
37: 'Shared context preserves gate-created and earlier saved records; criteria use independent titles and tolerate current library state. Restart retains the ongoing database. Polish may create one harmless own record; Visual remains read-only.',
38: 'Functional, Polish and Visual explicitly score independently and continue after ordinary criterion failure. Only observed global prerequisite failure zeroes a dimension; a malformed/incomplete judge report is separately ungraded.',
39: 'Existing authored-Run and clean-browser save gates reject an inert editor and browser-only library. Their source is unchanged; prior negative gate fixtures are reused, not relabelled fresh. The strict functional floor remains0.05.',
40: '35 Functional outcomes, four independent usability checks and six anchored Visual scales provide partial credit. Both new splits preserve49.5 total Functional weight and let otherwise working subfeatures retain earned credit.',
41: 'Functional/Polish/gates are binary. Six Visual criteria retain five explicit raw1-5 anchors, normalized by installed RewardKit. Report validation accepts actual compatible raw score formats while rejecting invalid-domain values.',
42: 'Positive weights make the canonical formula monotone in its dimension inputs; fairer independent checks remove specific inverse incentives. Broader human quality ranking is not mathematically guaranteed, particularly where functionality and presentation differ; target-model calibration is unmeasured.',
43: 'Unchanged scoring.toml keeps zero-weight gates,60/20/20 shares and strict Functional>0.05. Fresh gate-error/ordinary-gate-failure fixtures confirm no invalid scored continuation. Identical canonical scorer retains its prior20 arithmetic tests.',
44: 'Two2.5 Functional weights split into1.5+1.0, total49.5. Reserved URL/network checks remain0.5 each; hard lifecycle/server work remains dominant. Split mechanics can add at most0.03636 final reward above the same floor/gates; this is not a model prediction.',
45: 'Every prompt treats UI, source, payloads, errors and instructions as untrusted. Incomplete marker is recognized only at the start of a structured criterion reasoning field; quoted marker and log-only marker controls remain ordinary valid results.',
46: 'Final actual agent/verifier probes confirm role separation; verifier tests are inaccessible to unprivileged app. Canonical provider template values are not literal secrets. No solution is copied into the verifier image.',
47: 'Judge route and tools/browser versions remain pinned under the public-network profile. The concrete browser recipes reduce evaluator variation; probabilistic judge decisions and provider timing are still not deterministic or measured for this candidate.',
48: 'All five prompts and injected context independently reread for this playground. No marketplace or sibling terms. The global incomplete protocol, documented shortcuts versus editor escape, real stale editor and restart order agree across files.',
49: 'All50 source/ZIP/extracted files agree; the applicable public and verifier image subsets match. Staged runtime facts,35 Functional/49.5 and47 total are re-derived. The package guard was updated with those counts. Short metadata contains no stale rubric-count claims.',
50: 'Exactly50 task files with one root and the closed17-file tests inventory. No logs, QC reports, databases, caches, node_modules or ZIPs are inside the task. Reports and probe fixtures stay outside it.',
51: 'TOML/JSON parse, bash syntax/LF, actual image builds, pinned frontend rebuild and local browser/harness execution pass. Source/extraction audits each90/90; exact ZIP CRC/hash/mode checks pass.',
52: 'Source/extraction scans find no matching literal secrets, private-key blocks, host-machine paths or placeholders. Seed is synthetic and empty; allowed provider placeholders remain in canonical verifier.env. Browser probes do not emit private file content.',
53: 'The task is a code playground with source-language execution, last-good render recovery and revision-aware library behavior. Difficulty now says hard; golden badge says Local library. It is not a nouns-only storefront/editor clone.'
}
assert set(quality_evidence) == set(range(1,54))
notes = {11,18,20,22,26,31,42,47}
checks = [{'id': c['id'], 'verdict': 'Note' if c['number'] in notes else 'Pass', 'severity': '',
           'evidence': quality_evidence[c['number']], 'finding': '',
           'action': 'Measure complete hosted Oracle/model execution on this exact candidate when authorized.' if c['number'] in {11,18,22,47} else ''}
          for c in inventory['quality']]

manual = {
'check-assets-referenced.py': 'Explicit /assets and /instructions references resolve; all seven actual agent public hashes match source.',
'check-batched-independence-wording.py': 'Read all scored prompts: independent verdicts, continuation after ordinary failures, tool-failure exception explicit.',
'check-canonical-shared-files.py': 'score.py, restart_mcp.py and frozen verifier.env match current template byte-for-byte; harness/review_binding.json.',
'check-dockerfile-references.sh': 'Read actual COPY/ADD instructions and final image contents: agent excludes tests/solution; verifier copies own tests only.',
'check-dockerfiles.py': 'Read both Dockerfiles; versioned base tags, pinned npm/pip; final builds and role contents passed. Apt packages remain profile-permitted unpinned system installs.',
'check-fixtures.py': 'COPY inputs exist; seed JSON parses; actual image has its exact bytes.',
'check-instruction-content.py': 'instruction.md exceeds40 words, contains no draft markers, and directs to six present notes.',
'check-instruction-hygiene.py': 'Source and extraction pass criterion-ID, grading-term and public-network scans; manual public-prose review finds no probe names or grading machinery.',
'check-instruction-suffix.sh': 'No terminal-bench time-limit or anti-cheating suffix in the brief.',
'check-no-host-paths.py': 'Source/extraction author-path scan has no hits; runtime public paths are absolute Linux task paths.',
'check-no-literal-secrets.py': 'Secret-shape/PEM scans clear; canonical verifier.env has template placeholders, not a token.',
'check-no-placeholders.sh': 'Source/extraction placeholder scans clear; supplied authored examples intentionally include demonstration errors, not TODO stubs.',
'check-no-stray-files.py': 'Closed task/test inventory and packaging reject junk, caches, runtime DBs, reports and extra ZIPs;50 actual task files.',
'check-no-trialforge-judge-keys.py': 'Parsed five judge headers have no files/target_claims/model keys; no legacy check.py or expected directories.',
'check-probe-not-in-seed.py': 'Review of distinctive authored titles/markers against empty seed and shipped examples; probes are created by actions, not prefilled.',
'check-required-files.py': 'Source/extraction closed-tree assertion includes context, two canonical helpers, all five judge/prompt pairs and no reward.toml.',
'check-rubric-prompt.py': 'Five substantial browser prompts resolve context/criteria, carry injection/source bans and correct global-gate/incomplete-evidence instructions.',
'check-rubric-schema.py': 'Parsed five judge TOMLs:35F+4P+6V+2gate criteria; unique IDs, positive weights, binary/Likert anchors and MCP wiring validated.',
'check-runtime-contract-strings.py': 'Public integration, test.sh, shared context, prompts and solve.sh agree on entry, CWD, port3000, health and DB_PATH.',
'check-runtime-deps-in-both-images.py': 'Both built images contain Express5.1.0/better-sqlite3 12.4.1 under NODE_PATH; actual golden launch/restart succeeds.',
'check-scoring-policy.py': 'Canonical scorer/policy unchanged: gate0, weight.6/.2/.2, floor.05, ordered suites and13200 nesting.40 guard cases retain legitimate failures.',
'check-solve-contract.py': 'bash-n/LF pass; exact /app install only, no grading writes, pkill or NODE_ENV=production. Unchanged installer evidence retained by hash.',
'check-task-name.py': 'task.name equals turing/colderwater-playground-devtools and archive root matches.',
'check-verifier-contract.py': 'bash-n, LF, initial zero and bounded EXIT cleanup; sanitized unprivileged app; gates then scored; actual single-use restart;4 final orchestration cases.',
'check-allow-internet.sh': 'environment.allow_internet absent; network_mode public.',
'check-dockerfile-platform.sh': 'No FROM --platform on either Dockerfile.',
'check-no-allow-internet-true.sh': 'environment.allow_internet absent.',
'check-nproc.sh': 'No bare nproc in Dockerfiles, solve.sh or test.sh.',
'check-pip-pinning.sh': 'Only pip install is harbor-rewardkit==0.1.7 in tests/Dockerfile; no trial-time pip/uv installs.',
'check-task-absolute-path.sh': 'Public runtime paths are absolute; shell launches explicitly from app entry directory.',
'check-task-slug.sh': 'colderwater-playground-devtools has three hyphen-separated tokens.',
'check-test-file-references.sh': 'Graded output/runtime paths are declared in instruction/integration/security; no hidden required APP_MANIFEST.',
'check-trial-network-fetch.sh': 'test.sh performs only local readiness and launches installed tools; no external curl/wget/git-clone/install.',
'check-verifier-tooling-baked.sh': 'All verifier tools installed in image; no test-time package installation.',
}
note_names = {'check-allowlist-matches-provider.py', 'check-app-manifest.py', 'check-canary.sh', 'check-dockerfile-sanity.sh', 'check-instruction-states-offline-constraint.py', 'check-no-cdn-or-remote-assets.py', 'check-package-manifest-deps-preinstalled.py', 'check-reward-schema.py', 'check-reward-weights.py', 'check-rubric-segments.py'}
na_names = {'check-demo-accounts-agree.py', 'check-compose-host-binds.sh', 'check-gpu-types.sh', 'check-pytest-version.sh'}
det = []
for item in inventory['deterministic']:
    name = item['name']
    if name in note_names:
        status, output = 'Note', 'Current staged/public-network profile makes this legacy/override/no-network check non-blocking. ' + item['what']
    elif name in na_names:
        status, output = 'N-A', 'Inspected source: no relevant demo account, compose file, GPU configuration or pytest dependency for this checker.'
    else:
        assert name in manual, name
        status, output = 'Pass', manual[name]
    det.append({'name': name, 'status': status, 'output': output,
                'note': 'Documented local/manual equivalent; private platform checker implementation was not available or executed. Current evidence is bound by candidate_manifest.json and release_validation.json.'})
assert len(checks) == 53 and len(det) == 48
findings = {'scope': 'Current-source review of all53 quality and48 documented deterministic checks; focused fresh behavioral proofs with explicit historical reuse. Not a hosted QC/Oracle/model result.',
            'candidate': manifest, 'tasks': [{'name': 'colderwater-playground-devtools', 'checks': checks, 'findings': []}], 'deterministic': det}
write('qc_final_findings.json', findings)
subprocess.run([sys.executable, '-B', '-X', 'utf8', 'harbor-webdev-rubric-qc/scripts/build_report.py', str(out / 'qc_final_findings.json'), '-o', str(out / 'QC_FINAL.xlsx'), '--client-safe'], check=True)
print(json.dumps({'candidate': manifest['sha256'], 'quality': dict(Counter(c['verdict'] for c in checks)), 'deterministic': dict(Counter(c['status'] for c in det)), 'changed_existing_paths': len(delta['changed']), 'unchanged_paths': len(delta['unchanged'])}))
