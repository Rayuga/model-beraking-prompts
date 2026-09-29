"""Combine independent review and executed proof without importing old verdicts."""
from collections import Counter
import hashlib
import json
from pathlib import Path

out = Path(__file__).resolve().parent
root = out.parents[2]

def read(name):
    return json.loads((out / name).read_text(encoding='utf-8-sig'))

def write(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

candidate = read('candidate_manifest.json')
binding = read('final_candidate_binding.json')
semantic = read('qc_semantic_findings.json')
assert binding['passed'] and binding['candidate_sha256'] == candidate['sha256']
assert all(candidate['source_sha256'][p] == digest for p,digest in semantic['source_hashes'].items())
inventory = read('semantic-qc-inventory.json')
quality_rows = [
('Pass', 'Public-first reread: a studio owner asks for browsing, scarce-edition purchases and usable receipts; product reasons precede the separate runtime notes. No public prose changed in this review.'),
('Pass', 'The brief and three working notes use contractions, specific customer situations and varied voice. This remains a human editorial judgment, not a regex claim.'),
('Pass', 'Read all four public Markdown files; no foreign product residue, accidental draft text or conflicting product statement found. Fresh source/extraction scans also pass.'),
('Pass', 'Brief/integration define /app, Node server.js from /app, port3000, root storefront, public/index.html, SQLite path/DB_PATH, health and supplied seed/photos. Runtime file hashes are unchanged and verified in actual images.'),
('Pass', 'Current public instructions have zero whole-token collisions with all37 criterion IDs and zero guarded grading vocabulary hits. Guards pass on source and extraction; their narrow scope does not replace the prose reread.'),
('Pass', 'Re-read required prices, stock, retry/cancellation, addresses, filters and runtime as an independent implementer. Removed unsupported tie stability and target-origin assumptions; new stock snapshots record actual prior state.20 arithmetic controls agree.'),
('Pass', 'The shared-order gate requires a new real purchase retrieved in clean storage. Scored outcomes require authoritative money/stock, concurrent last-copy protection, retries, cancellation and durable restart.'),
('Pass', 'Directory and turing/ridgeline-print-storefront match task identity. Metadata, parsed counts and archive all agree on25 Functional/35weight and37 overall criteria.'),
('Pass', 'Current canonical task limits/env and public network profile match the staged template. Actual image build verifies declared inputs and runtime. Local backend requirement remains distinct from permitted frontend CDN assets.'),
('Pass', 'Separate verifier, canonical provider placeholders and pinned tools are preserved. Both rebuilt images match source and keep the private solution out of the agent image. Credential availability for a paid provider was not tested.'),
('Note', 'Numerical budgets fit: gate600+600 within1500, scored9000+900+900 within11100, outer12600 within13200. Current final cleanup is bounded (~5.3s resistant cases); prior restart helper is byte-identical and bounded. Full paid25-criterion judge duration/cold-cache envelope remain unmeasured.'),
('Pass', 'Parsed task environment has no prebuilt docker_image; the active Dockerfile builds successfully.'),
('Pass', 'Exactly12 public inputs in the final agent image match source: three notes, seed and eight print images. Golden photo copies remain identical. Assets resolve from required /assets paths.'),
('Pass', 'Fresh seed review and20 independent monetary/postage checks plus16 stock transitions agree. Eight distinct prints/thirteen offered variants include sold-out Allotment and a historical dispatched receipt without planted probe markers.'),
('Pass', 'Both final images built. Agent probe confirms public inputs, empty submission app and preinstalled runtime modules; verifier confirms all15 shipped files and Chromium152.0.7977.8.'),
('Pass', 'Agent Dockerfile copies only public instructions/assets. Actual agent probe and context paths reveal no private tests or solution; verifier also contains no preinstalled golden app.'),
('Pass', 'All19 golden/installer files match baseline, fresh installed files and served frontend. Eight fresh browser groups plus explicitly hash-reused37-criterion observations cover the requested product; no app defect found.'),
('Note', 'All37 criteria have current evidence mapping; strengthened paper/keyboard checks pass fresh, all13-stock restart is proven in retained actual process-restart evidence. Local render assessments support the Visual anchors, but full paid Oracle/aesthetic assignment is unmeasured.'),
('Pass', 'Golden starts from /app on3000 with a fresh private database in the browser proof. Current full harness fixture starts the golden, restarts it and retains orders/retries. Unchanged installer lifecycle proofs distinguish reinstall reset from durable runtime restart.'),
('Note', 'All51 archive/source hashes and19 tested golden files match. Seed/calculation logic is fixed; generated order references and times legitimately vary. No universal bit-for-bit runtime determinism is claimed.'),
('Pass', 'Confirmed and repaired unbounded EXIT wait. Seven actual cleanup/exit cases preserve valid0.64 or required zero outputs, stop resistant parent/child groups and preserve original exit23; four current orchestration cases also pass. These are synthetic score fixtures, not model runs.'),
('Note', 'Actual final verifier image, installed MCP browser flows, real process restart and synthetic RewardKit orchestration work. Live paid-provider authentication and complete judging were not invoked.'),
('Pass', 'Current harness launches with /app CWD and isolated environment. Fresh relative-CWD, golden and restart fixtures pass. Same loopback backend may use its actual observed URL/origin/credential policy, as both public contract and gates permit.'),
('Pass', 'Five TOML judges parse with valid templates/tools, two all-pass gates and three weighted suites; entrypoint calls canonical scoring only after gates.37 criterion IDs are unique and public hygiene scans pass.'),
('Pass', 'All five prompts require rendered/browser evidence and explicitly prohibit scoring from app implementation/comments/claims. Observed browser requests may establish state; no shell/database inspection substitutes for product behavior.'),
('Note', 'Fresh bidirectional ledger maps45 requirement groups to37 criteria and harness obligations. Keyboard views, wholly sold-out paper membership and all13 stocks now have explicit witnesses. Browser evidence cannot identify the exact React/Express/SQLite engine, and exact photo identity has bounded visual evidence.'),
('Pass', 'Removed equal-price tie stability and forced same-origin target. Postage grams/band names remain optional display; route/schema/layout/currency formatting are not prescribed. Added keyboard, sold-out membership and stock durability witnesses correspond to existing public asks.'),
('Pass', 'Independent catalogue controls remain separate. Polish label/reachability/focus owns enabled controls; navigation owns actual keyboard view transitions; Visual owns readability/composition. Linked transaction/refusal/recovery legs remain one outcome. Weights unchanged.'),
('Pass', 'Render requires a populated usable storefront; Constraints requires fresh server-backed write and clean-context retrieval. All scored prompts carry these prerequisites and stop scoring broken shells. Public CDN assets are allowed; no login is invented.'),
('Pass', 'Refusal tests use real successful controls, observed request shapes, fresh identities and post-refusal stock/receipt readback. Fresh whitespace, lost-response/cancel and collection scenarios passed with subsequent valid actions.'),
('Pass', 'Explicit all13 pre/post-restart stock snapshot includes zero variants. Paper filter now includes fully sold-out Allotment. Existing criteria separately cover all four address components and both title/price directions; labels cover every named enabled catalogue control.'),
('Pass', 'Actual installed MCP proved independent browser contexts and76 real keyboard events without focus/click shortcuts during route. Replay uses observed local app requests and preserves real credential policy. No hidden DB enumeration or special order-list screen is required.'),
('Pass', 'Final prompts, shared context and criteria agree: Polish may prepare/empty an unplaced basket, makes no purchase and does not regrade Functional; Visual stays observational. Snapshot setup now matches the all-recorded-stocks comparison.'),
('Pass', 'Fresh proof covers both themes and390/1440 widths, exact keyboard navigation, reload isolation and lost-response recovery after another visitor cancels. Prior unchanged concurrency and actual process-restart evidence is linked by hash.'),
('Pass', 'Clean-context lookup proves shared order state; observed process replacement preserves both statuses/receipts and all13 recorded quantities. Current harness golden restart passes; exact database engine identity remains the separate coverage limitation.'),
('Pass', 'New order references come from actual fresh UI purchases/attempts and are checked after mutation. Seed history is only the explicitly requested RP-100001 control, not a pre-satisfied substitute for new writes.'),
('Pass', 'Fresh16-transition ledger accounts for gate/Functional purchases, cancellations and alternative price outcomes. Later presentation chooses an actually available variant; snapshot records real prior state; no inherited success, DB reset or private cross-judge context is assumed.'),
('Pass', 'Scored prompts return every criterion, continue after ordinary independent failures and retain local observations. Restart creates its own controls; price-state setup has its own fallback. Genuine global browser failure is separately gated.'),
('Note', 'Static/client-only shells fail the required shared-order gate; earlier unchanged negative fixtures are retained. Scorer floor is strict >0.05 and tested. Finite witnesses do not prove rejection of every possible mock; no universal anti-mock claim.'),
('Pass', 'Canonical weighted means and continuous Visual normalization allow partial scores; four fresh orchestration fixtures and retained20 canonical scorer inputs establish graded arithmetic. No score policy was changed to target a model.'),
('Pass', 'Functional/Polish use observable binary outcomes; six Visual criteria have all five raw1-5 anchors. RewardKit normalization and canonical scorer are unchanged; fixed positive weights parse correctly.'),
('Note', 'With fixed gates/floor and other outcomes, positive canonical weights are mathematically monotone; partial/floor fixtures are retained. Relative ranking and target-model separation require actual submissions/paid evaluation and are not measured.'),
('Pass', 'Fresh failed-gate fixture skips scored suites and emits zero. Gates carry no reward weight; score.py applies gates and strict Functional floor before60/20/20 reward.'),
('Pass', 'All IDs/types/order/weights retained:25Functional/35,4Polish/4,6Visual/6. Most functional mass remains in transactional/adversarial behavior; minor filter witness remains0.1. Stronger coverage may change verdicts without changing weights.'),
('Pass', 'Prompts treat submission, displayed claims and tool outputs as untrusted and forbid obeying app-internal grading instructions. They require product observations; absolute immunity to arbitrary prompt injection is not asserted.'),
('Pass', 'Actual public image has no tests/solution; verifier protects /tests and logs and launches app under a low-privilege user with cleared judge credentials. Current relative-CWD/env isolation fixture passes.'),
('Note', 'Tools/Chromium/runtime dependency versions are pinned and no runtime installation is performed. Public-network task profile intentionally permits frontend CDN assets; provider/network/LLM judgment nondeterminism prevents a promise of identical remote reruns.'),
('Pass', 'All five prompts/context match current runtime/product and separate dimension ownership. Corrected replay target and Polish route permissions have no conflicting shared restriction. No sibling product text remains.'),
('Pass', 'Fresh source/extracted audits each89/89; final images match12 public and15 verifier files. Config, budgets, gates, score/helpers and all public/golden bytes remain unchanged. Five changed task files are explicitly bound.'),
('Pass', 'Final ZIP has exactly51 safe single-root regular files, correct shell modes/LF, CRC and matching extraction/source hashes. No report, database, cache, node_modules or internal workbook ships in it.'),
('Pass', 'Fresh TOML/JSON parsing, shell syntax/audits, actual image builds and installed-MCP/harness execution pass. No complete paid grader execution is claimed by a syntax pass.'),
('Pass', 'Fresh literal-secret/private-key/hostpath scans and canonical env comparison pass. App gets cleared provider environment, tests/logs are private, and archive contains only intended task files. This is not an exhaustive security audit.'),
('Pass', 'Ridgeline has a coherent studio identity, supplied original catalogue and specific trade-tier/stock/receipt/cancellation workflows. Reference reuse is confined to the staged harness/profile rather than copied unrelated product prose.'),
]
assert len(quality_rows) == len(inventory['quality']) == 53
checks = []
for entry, (verdict, evidence) in zip(inventory['quality'], quality_rows):
    checks.append({'id': entry['id'], 'verdict': verdict, 'severity': '', 'evidence': evidence + ' Evidence: final_candidate_binding.json; SEMANTIC_REVIEW.md; golden/CRITERION_EVIDENCE.json; harness/HARNESS_REVIEW.md.', 'finding': '', 'action': ''})

det_rows = {
'check-allowlist-matches-provider.py': ('NOTE', 'Current public-network profile uses no provider allowlist; canonical verifier.env matches the staged template.'),
'check-app-manifest.py': ('NOTE', 'Staged /app/server.js entry and explicit DB_PATH/path replace the legacy APP_MANIFEST convention.'),
'check-assets-referenced.py': ('PASS', 'All seed/photo/note references resolve;12 final public-image hashes match source/extraction.'),
'check-batched-independence-wording.py': ('PASS', 'All batched prompts continue after independent failures, return each verdict and use their own preparation; exact final prompt text reviewed.'),
'check-canary.sh': ('NOTE', 'Current WebDev no-canary override applies; no canary is required or shipped.'),
'check-canonical-shared-files.py': ('PASS', 'Canonical score.py, restart_mcp.py and scoring.toml match template; task-only test.sh has a documented tested bounded-cleanup deviation. Generated restart helper unchanged from previous repair.'),
'check-demo-accounts-agree.py': ('N-A', 'No authentication or demo accounts requested.'),
'check-dockerfile-references.sh': ('PASS', 'COPY sources resolve; agent receives only public instructions/assets; actual builds pass.'),
'check-dockerfile-sanity.sh': ('NOTE', 'Generic legacy pin/base requirements yield to current staged WebDev Dockerfile profile; actual Dockerfiles checked separately.'),
'check-dockerfiles.py': ('PASS', 'Both final images build and exact current public/verifier bytes match. Pinned Chromium152 and runtime modules are available.'),
'check-fixtures.py': ('PASS', 'Seed has8prints/13variants;20 independent arithmetic checks and16 stock transitions pass; paper counterexample proves the distinguishing sold-out fixture.'),
'check-instruction-content.py': ('PASS', 'Complete owner-facing request and three notes reread; runtime requirements resolve and45 requirement groups map to rubric/harness.'),
'check-instruction-hygiene.py': ('PASS', 'Fresh source and extracted guards scan37 unique IDs and grading vocabulary against all public prose; no hits.'),
'check-instruction-states-offline-constraint.py': ('NOTE', 'Current public network profile permits frontend external assets; no blanket app-offline restriction applies.'),
'check-instruction-suffix.sh': ('PASS', 'No legacy terminal-bench suffix found in current instruction.'),
'check-no-cdn-or-remote-assets.py': ('NOTE', 'Frontend CDNs/fonts/images are expressly permitted; local backend requirement remains. Current public-network policy guard passes source/extraction.'),
'check-no-host-paths.py': ('PASS', 'Fresh shipped-text scan finds no developer host paths.'),
'check-no-literal-secrets.py': ('PASS', 'Fresh literal-secret/private-key scan passes; verifier environment contains canonical placeholders.'),
'check-no-placeholders.sh': ('PASS', 'Fresh draft/placeholder scan and complete manual public/rubric reread found no unresolved template residue.'),
'check-no-stray-files.py': ('PASS', 'Exactly51 intended archive files, no database/cache/local evidence; CRC, shell modes and every extraction hash match.'),
'check-no-trialforge-judge-keys.py': ('PASS', 'Five current judges use permitted staged keys, no foreign target_claims/check.py/expected artifacts.'),
'check-package-manifest-deps-preinstalled.py': ('PASS', 'Declared Express5.1.0/better-sqlite3 12.4.1 are installed in the inspected images; app starts without install.'),
'check-probe-not-in-seed.py': ('NOTE', 'Fresh attempts/references are dynamically observed rather than a distinct canary. Supplied historical receipt is intentionally a separate control.'),
'check-required-files.py': ('PASS', 'Complete staged layout: task/instruction, active environment,seed,solution,tests/.dockerignore,context,5judges/prompts,scoring andshared tools.'),
'check-reward-schema.py': ('NOTE', 'Legacy reward.toml retired by staged scoring.toml/tools/score.py.'),
'check-reward-weights.py': ('NOTE', 'Legacy reward.toml weights replaced by exact canonical staged60/20/20 policy.'),
'check-rubric-prompt.py': ('PASS', 'All5 prompts use browser/source-ban rules and gates, context/criteria substitutions, real tool recipes and separate presentation ownership.'),
'check-rubric-schema.py': ('PASS', 'Five judges parse with37 criteria in1/1/25/4/6, unique IDs and valid positive weights; Visual has six1-5 anchors.'),
'check-rubric-segments.py': ('NOTE', 'Retired segments layout absent; current gates/scored folders valid.'),
'check-runtime-contract-strings.py': ('PASS', 'Entry/CWD/port/health/DB_PATH agree; actual local backend URL/origin is allowed; hidden grams/ties/schema/display assumptions removed.'),
'check-runtime-deps-in-both-images.py': ('PASS', 'Final image probe and manifest inspection confirm declared runtime modules in both images.'),
'check-scoring-policy.py': ('PASS', 'Canonical zero-mass gates, strict Functional>0.05 floor and60/20/20 preserved. Fresh failed-gate orchestration plus hash-reused20 synthetic score cases pass.'),
'check-solve-contract.py': ('PASS', 'Installer LF/syntax/path checks pass and golden unchanged. Earlier executed7-case installer proof remains scoped to identical solve.sh; ordinary restart preserves state.'),
'check-task-name.py': ('PASS', 'Parsed turing/ridgeline-print-storefront matches folder and archive.'),
'check-verifier-contract.py': ('PASS', 'Current seven cleanup/exit and four orchestration cases pass, including real restart and valid/zero score preservation. Paid judge invocation remains unmeasured.'),
'check-allow-internet.sh': ('PASS', 'Deprecated allow_internet key absent; public network defined by current schema.'),
'check-compose-host-binds.sh': ('N-A', 'No Docker Compose artifact.'),
'check-dockerfile-platform.sh': ('PASS', 'Both Dockerfiles inspected: no FROM --platform override.'),
'check-gpu-types.sh': ('N-A', 'No GPU requirement or GPU schema.'),
'check-no-allow-internet-true.sh': ('PASS', 'Deprecated key absent from parsed task configuration.'),
'check-nproc.sh': ('PASS', 'No nproc call in shipped scripts or Dockerfiles.'),
'check-pip-pinning.sh': ('PASS', 'Verifier pins harbor-rewardkit==0.1.7; no unpinned runtime pip/trialpip install.'),
'check-pytest-version.sh': ('N-A', 'No pytest-based verifier.'),
'check-task-absolute-path.sh': ('PASS', 'Required /app,/assets,/instructions paths are absolute and match image/runtime proof.'),
'check-task-slug.sh': ('PASS', 'ridgeline-print-storefront is the required three-token slug.'),
'check-test-file-references.sh': ('PASS', 'Entry/index/seed/database contract is public; rubric references exist and impose no undisclosed submitted-file layout or endpoint.'),
'check-trial-network-fetch.sh': ('PASS', 'No install/curl/wget/git fetch in test.sh; loopback readiness and intended configured judging only.'),
'check-verifier-tooling-baked.sh': ('PASS', 'RewardKit,CLIs,Chromium,MCP and runtime modules are baked into successfully built final verifier; no judging-time install.'),
}
assert len(det_rows) == 48
expected_det = {x['name'] for x in semantic['deterministic']}
assert expected_det == det_rows.keys()
deterministic = [{'name': name, 'status': status, 'output': text, 'note': 'Local/manual equivalent of the documented procedure, not execution of unavailable private platform checker. Final source/extraction audits, image proof, semantic review, harness and archive bindings establish the stated scope.'} for name,(status,text) in det_rows.items()]
findings = {'scope': 'Fresh complete53-quality/48-procedure review with independent requirements-first semantics, actual golden browser/harness probes and final source/extraction/image binding. Earlier unchanged observations are identified by hashes rather than relabelled fresh. No paid provider or private platform checker execution.', 'candidate_zip_sha256': candidate['sha256'], 'candidate': candidate, 'evidence_binding': binding, 'tasks': [{'name':'ridgeline-print-storefront','layout':'staged','checks':checks}], 'deterministic':deterministic}
write('qc_final_findings.json', findings)
quality = dict(Counter(c['verdict'] for c in checks))
mechanical = dict(Counter(c['status'] for c in deterministic))
report = f'''# Ridgeline second full cross-check - 27 September 2026

The fresh full review found and repaired five rubric gaps plus one harness defect. No unresolved concrete Ridgeline blocker remains in the local checks below. This is not a guarantee of platform acceptance or Oracle1.0.

## Current upload

[Replacement ZIP](ridgeline-print-storefront.zip), SHA-256 `{candidate['sha256']}`. It contains51 files / {candidate['bytes']} bytes. All CRCs, safe single-root paths, shell modes/LF and source/extraction hashes match. This replaces the preserved9944734b archive in the previous cross-check folder.

Exactly five task files changed: Functional and Polish judge/prompt files plus tests/test.sh. All19 golden/installer files, public notes/assets, configuration, gates, Visual rubric, scoring policy, canonical Python tools and Dockerfiles remain identical. Criterion counts/types/IDs/order/weights are unchanged:25Functional/35weight and37 total. [Exact diff](candidate.diff) and [binding](final_candidate_binding.json).

## Repairs

1. **Keyboard access:** three Tab stops could hide mouse-only print/basket views. Named controls now require keyboard reachability and visible focus, while the existing navigation check uses real keys through detail → catalogue → basket → catalogue. No keyboard purchase or repeated Functional verdict is added.
2. **Sold-out paper filtering:** the old Munken witness could not expose an app that dropped wholly sold-out prints. The same0.1-weight criterion now also checks Colorplan Pristine White with Allotment, Long Field and Nine Windows, then resets to all eight.
3. **Equal-price ties:** removed the unrequested stable ordering condition; both price directions remain required.
4. **Observed local API:** replay follows the actual browser-observed local server URL/origin/credentials instead of imposing same-origin targets on a permitted local topology.
5. **Restart coverage:** setup explicitly records all13 current variant stocks, including zero, before the real process restart. The comparison already existed but an incomplete setup could miss reset stock elsewhere.
6. **Final cleanup:** a server ignoring SIGTERM could leave test.sh blocked in its EXIT wait even after writing reward. Bounded TERM/KILL cleanup now stops resistant parents/children, preserves existing reward and original exit status. Generated restart helper and canonical scoring/MCP Python are unchanged.

## Validation

| Check | Result |
| --- | --- |
| Complete quality review | {quality} across53 entries |
| Documented deterministic procedures | {mechanical} across48 local/manual equivalents |
| Final source / extracted-source assertions | 89/89 each |
| Fresh golden browser groups | 8/8,76 real key events,zero page errors |
| Fresh cleanup / orchestration cases | 7/7 and4/4 |
| Independent monetary cases / stock transitions | 20/20 and16/16 |
| Actual final images | Exact12 public inputs and15 verifier files;Chromium152.0.7977.8 |
| Golden identity and criterion map | All19 files unchanged;all37 criteria mapped |

Read the [semantic review](SEMANTIC_REVIEW.md), [golden report](golden/GOLDEN_SECOND_RECHECK.md), [harness review](harness/HARNESS_REVIEW.md), [full findings](qc_final_findings.json) and [client-safe workbook](QC_FINAL.xlsx). The fresh browser chain also covers clean-context server reads, blank-address refusal, collection checkout/cancellation and a lost response followed by cancellation from another visitor before recovery. Earlier unchanged commerce/installer/presentation observations, five restart lifecycle controls and twenty canonical scorer inputs are explicitly reused, not newly rerun. The retained actual restart proof records all13 stock quantities and changed process identity.

## Limits and score effect

The eight quality Notes cover full paid timing, aesthetic/Oracle assignment, legitimate random references/times, provider execution, browser-only architecture/photo identity, finite anti-mock coverage, empirical ranking and remote reproducibility. The private checker executables are unavailable; this applies their documented procedures locally. No complete paid Oracle/model run occurred. Synthetic reward0.64 fixtures test plumbing only.

Weights and60/20/20 policy are unchanged. Added paper coverage has0.001714 reward mass; keyboard checks strengthen existing Polish outcomes. Correcting unsupported tie/origin restrictions can restore deserved credit, while explicit all-stock restart can remove false credit. With passed gates and full presentation, failing the nine high-weight transactional/adversarial criteria while passing the remaining Functional checks would give about0.606. That is a scenario calculation, not a model forecast. Actual Oracle1.0 and model0.1-0.7 remain measurement targets.

The harness review also identified the same old cleanup pattern in the separate Colderwater candidate. This Ridgeline review does not modify or validate that candidate's cleanup; its existing ZIP/hash remains unchanged and that cross-task follow-up is recorded explicitly. No paid call, upload, commit or push was made.
'''
(out / 'QC_FINAL.md').write_text(report, encoding='utf-8')
print(json.dumps({'quality':quality,'deterministic':mechanical,'candidate':candidate['sha256']}))
