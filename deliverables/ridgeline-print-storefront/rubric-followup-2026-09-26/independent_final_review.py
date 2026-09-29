"""Bind the complete local 53/48 follow-up review to the final Ridgeline archive."""
from collections import Counter
from hashlib import sha256
from pathlib import Path
import json
import stat
import sys
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/ridgeline-print-storefront'
OLD = OUT.parent / 'rubric-fix-2026-09-26'
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'harbor-webdev-rubric-qc/scripts'))
from list_checks import DEFAULT_WORKBOOK, load_checks

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def dump(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

manifest = read(OUT / 'candidate_manifest.json')
assert manifest['sha256'] == '7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6'
archive = OUT / manifest['archive']
assert sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
assert archive.stat().st_size == manifest['bytes'] == 699956
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    members = [m for m in bundle.infolist() if not m.is_dir()]
    assert len(members) == len({m.filename for m in members}) == 51
    current = {}
    for member in members:
        parts = Path(member.filename).parts
        assert parts[0] == 'ridgeline-print-storefront' and '..' not in parts
        relative = Path(*parts[1:]).as_posix()
        blob = bundle.read(member)
        assert blob == (TASK / relative).read_bytes()
        assert sha256(blob).hexdigest() == manifest['source_sha256'][relative]
        if relative.endswith('.sh'):
            assert stat.S_IMODE(member.external_attr >> 16) & 0o111
        current[relative] = blob
    assert set(current) == set(manifest['source_sha256'])
old_manifest = read(OLD / 'candidate_manifest.json')
assert old_manifest['sha256'] == 'f8a9b605699d7e87dc1a0a08fb2f48e23a16e784588c7380d3a5aa47a77b706d'
assert sha256((OLD / old_manifest['archive']).read_bytes()).hexdigest() == old_manifest['sha256']
with zipfile.ZipFile(OLD / old_manifest['archive']) as bundle:
    previous = {name.split('/', 1)[1]: bundle.read(name) for name in bundle.namelist() if not name.endswith('/')}
assert set(previous) == set(current)
changed = sorted(path for path in current if current[path] != previous[path])
unchanged = sorted(set(current) - set(changed))
for prefix in ['solution/', 'environment/assets/', 'tests/tools/']:
    assert all(current[path] == previous[path] for path in current if path.startswith(prefix))
for path in ['tests/test.sh', 'tests/scoring.toml', 'tests/scored/polish/judge.toml', 'environment/Dockerfile', 'tests/Dockerfile']:
    assert path in unchanged

source = read(OUT / 'qc_source_evidence.json')
extracted = read(OUT / 'qc_independent_extracted_source_evidence.json')
for evidence in [source, extracted]:
    assert evidence['failed'] == 0 and evidence['passed'] == 83
    assert evidence['source_hashes'] == manifest['source_sha256']
contract = read(OUT / 'contract-checks.json')
assert contract['passed'] and contract['check_count'] == 22
assert all(check['passed'] for check in contract['checks'])
assert contract['functional_sha256'] == manifest['source_sha256']['tests/scored/functional/judge.toml']
for name in ['network-policy-source.json', 'network-policy-extracted.json', 'network-regression-results.json']:
    assert read(OUT / name)['passed']
images = read(OUT / 'final_image_evidence.json')
assert images['passed'] and images['agent']['passed'] and images['source_unchanged_during_build']
assert images['agent_public_hashes_match'] and not images['agent']['privateSolutionOrVerifierPresent']
assert images['verifier_source_hashes_match'] and images['verifier_source_files'] == 15
assert not images['verifier_private_solution_present']
assert all(manifest['source_sha256'][p] == h for p, h in images['source_before_build'].items())
for name in ['two-context-mcp-results.json', 'catalogue-controls-mcp-results.json']:
    probe = read(OUT / name)
    assert probe['passed'] and probe['tool'] == 'browser_run_code_unsafe'
    assert probe['command'] == ['playwright-mcp', '--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox']
contexts = read(OUT / 'two-context-observations.json')
assert contexts['browserVersion'] == '152.0.7977.8'
assert contexts['bInitialStorageState'] == {'cookies': [], 'origins': []}
assert contexts['simultaneousDistinctContexts'] and contexts['bStartedEmpty']
assert contexts['aBeforeReload'] == contexts['aAfterInitialReload'] == contexts['aAfterBWrites']
assert contexts['bBeforeReload'] == contexts['bAfterReload']
assert contexts['bothBasketsCleared'] and contexts['purchaseRequests'] == 0
assert contexts['initialStock'] == contexts['finalStock']
assert contexts['originalPageStillUsable'] and contexts['originalContextCount'] == contexts['contextCountAfterCleanup']
controls = read(OUT / 'catalogue-controls-observations.json')
assert len(controls['criteria']) == 5 and all(c['passed'] for c in controls['criteria'])
assert controls['initialStock'] == controls['finalStock']
asset = controls['optionalFrontendAsset']
assert asset['unprotectedControlLoaded'] and asset['goldenLoaded'] and asset['appActionStillWorks']
assert len(asset['delivered']) == 2
score = read(OUT / 'score-bound-results.json')
assert score['passed'] and score['combined_max_published_reward_delta'] == .0918
assert score['floor_before_tool']['reward'] == 0 and score['floor_after_tool']['reward'] == .5217
assert (OUT / 'REQUIREMENT_COVERAGE.md').is_file()

quality, deterministic = load_checks(DEFAULT_WORKBOOK)
assert len(quality) == 53 and len(deterministic) == 48
dump('qc_inventory.json', {'quality': quality, 'deterministic': deterministic})
data = read(OLD / 'qc_final_findings.json')
data['scope'] = ('Independent full 53/48 local review of the final Ridgeline follow-up. Exact task bytes, new actual MCP evidence and reused unchanged-source evidence are distinguished. Official private checkers and paid Oracle/provider/model evaluation were not executed. Earlier acceptance of blanket app-asset restrictions, unrequested receipt labels and duplicated mobile observations is superseded. The reported inherent MCP single-context limitation is refuted by actual tools/call evidence.')
data['candidate'] = manifest
data['repair_scope'] = {'old_candidate_sha256': old_manifest['sha256'], 'changed_files': changed, 'unchanged_file_count': len(unchanged), 'golden_application_and_installer_unchanged': True, 'scoring_harness_tools_unchanged': True, 'paid_oracle_measured': False, 'target_model_measured': False}
data['tasks'][0]['findings'] = []
E = {
1: "The print-studio owner's request explains browsing, small stock runs, unreliable checkout connections and retained receipts; runtime details remain in the linked integration note.",
2: "Read the brief and three notes. Ordinary customer situations and contractions are retained. Exact pricing/stock rules support the product rather than expose a grading procedure. Naturalness remains a manual judgment.",
3: "Source scans and manual read find no draft, host-path or copied-task residue. The former external-asset prohibition is removed from both integration and the gate instead of being justified by repeating it.",
4: "The brief and README/checkout/integration notes state delivery, variants, trade/postage calculations, addresses, retries, cancellations and launch contract. Grams and band names are calculation inputs; no public requirement mandates displaying them on receipts.",
5: "Executed scans cover 36 IDs against four public documents and grading vocabulary, on source and extracted archive. No matches remain. Internal browser recipes live only in private judge files.",
6: "The corrected 24 Functional outcomes have stated requirements and independently established controls. Actual pinned MCP calls prove two simultaneous clean contexts and all five catalogue controls. An incorrect claim that --isolated makes the basket test impossible is refuted.",
7: "The task asks for a usable print storefront with a real shared order/stock backend, not a mockup or screenshot. Stock commitments, immutable receipts and restart behavior require actual state changes.",
8: "Final metadata matches 24 Functional criteria totaling 35, nine adversarial/replay criteria totaling 23, four Polish, six Visual and two gates. Task identity matches the folder. No paid score is claimed.",
9: "Both phases use public network. Integration and the gate now explicitly permit external fonts/scripts/images/CDN assets. The supplied local backend restriction remains distinct. Previous acceptance of an app-wide offline exception was unsupported and is withdrawn.",
10: "Frozen verifier.env and tool versions match the current template. Final image records bind every copied verifier file and public input to this source; no live credentials are shipped.",
11: "Unchanged serial budgets nest: 1200 seconds of gate allowances within 1500; 10800 scored within 11100; wrappers total 12600 within 13200. New independent UI controls are bounded and execute quickly locally, but full provider-judge latency is not measured.",
12: "No environment.docker_image or allow_internet key overrides the active Dockerfile. Both final images are built from current source.",
13: "Source and archived canonical seed/photographs are unchanged and match golden copies. Eight prints, thirteen variants and eight photograph files are preserved; all referenced public inputs exist in the agent image.",
14: "Seed is unchanged. The 22-check contract audit independently recomputes complete search/size/paper/order expectations and mixed, successive and inclusive-postage figures. Generated gate orders are accounted for rather than confused with original stock.",
15: "Both follow-up images build. Actual agent /app contains only Git scaffolding, public input hashes match, runtime versions match and all 15 copied verifier files equal frozen source. The image checks also show no embedded private solution.",
16: "Agent image inspection confirms it includes public inputs but no golden solution, rubric or verifier files. The source Dockerfile has the same restricted COPY scope as before.",
17: "Golden app and installer are byte-identical to f8a9. Prior backend, checkout, restart, installer and visual evidence remains applicable within its recorded scope. New actual MCP probes pass five catalogue controls, independent baskets and an optional locally routed external-style frontend script.",
18: "Golden has local behavior and presentation evidence for the changed obligations, with preserved deep-flow proof for unchanged code. A full paid Oracle under the final 24-criterion rubric is unmeasured.",
19: "App/installer/launcher bytes are unchanged. Previous low-privilege launch, proper CWD, active-database refusal and ordinary restart preservation proofs still apply. External app assets are now permitted; golden's own local assets remain valid.",
20: "Final archive, CRC, all 51 entry hashes and shell modes are independently verified. Generated references/timestamps are observed, not treated as fixed expected constants; criteria intentionally share one continuing database.",
21: "Canonical score/restart tools and test.sh are unchanged. Earlier four harness cases establish launch, gate-failure skip, missing-app zero and restart plumbing; current source/extracted checks verify the same bytes. Synthetic outputs are not paid scores.",
22: "Actual installed playwright-mcp with --isolated exposes browser_run_code_unsafe and supports browser.newContext(), live UI actions and cleanup. The final image builds and matches source. No remote judge/provider invocation was exercised.",
23: "Public entry/CWD, port, health, DB_PATH and seed agree with the unchanged launcher. Constraints asks only for health success, not an invented response schema. Explicit context recipes require browser automation, not source inspection or shell access.",
24: "Parsed 36 unique criteria in 1/1/24/4/6 dimensions, positive weights and correct aggregations. Only Functional exposes restart. Policy and canonical shared tools are unchanged and dimension weights remain in scoring.toml only.",
25: "All five prompts require actual Playwright observations and forbid submitted implementation/source/comment/bundle inspection. Rendered DOM, screenshots and observed application requests are valid evidence. The context tool recipes preserve that boundary.",
26: "The updated requirement-first ledger maps public behaviors to the 24 outcomes and both gates. The five catalogue controls have separate observations; monetary labels no longer exceed the public ask. Browser evidence cannot establish exact SQLite/Express/React internals or hidden topology.",
27: "No mandatory postage-band label or grams display remains in the monetary criteria. Exact subtotal/saving/postage/total, collection-only behavior and stored prices remain required. App CDN choices are permitted; routes, response field names, layout and postcode format stay flexible.",
28: "Search, size filter, paper filter, price ordering and alphabetical ordering now have independent scores/setup. Polish owns mobile access/clipping/overflow; the sixth Visual check grades cross-viewport proportions/density/composition, while the first five use desktop views. Coherent transaction control/rejection/recovery legs remain together.",
29: "The real shared-order gate remains intact: a new UI purchase must be independently retrieved with clean browser state and after reload. Scored prompts inherit that result, locally reload server content and avoid repeat purchases. Permitted external assets no longer zero the gate. Prior golden/mock gate witnesses apply to this unchanged shared-write requirement.",
30: "Refusal chains establish successful controls and fresh reads. New catalogue criteria reset their own controls and verify clear/reverse outcomes; unknown-reference lookup surrounds refusal with a known receipt. Network-policy guard reproduces old violations before accepting corrected candidates.",
31: "Catalogue facts cover all thirteen variants; each control compares complete membership/order in its own criterion. Two visitor baskets remain separate through reload. Address validation covers all four named components. Transaction checks reread all affected records/stock without a hidden database enumeration requirement.",
32: "Criteria judge UI outcomes and real observed requests; they do not infer database technology or hardcode unrequested routes. The two-context test is actually available through the installed MCP tool, and its recipe does not prescribe selectors or client storage technology.",
33: "Monetary criteria consistently require only the requested monetary fields, not the derivation's optional labels. Every independent control has an explicit setup. Valid controls, fresh attempt identities and observed remaining stock keep multi-leg transaction outcomes meaningful.",
34: "Reload, independent simultaneous contexts, themes, mobile composition and real restart are exercised where required. New JSON-RPC tool evidence verifies both contexts stay alive, neither overwrites the other and cleanup preserves the original MCP page. Existing screenshots support the unchanged UI under clarified presentation scopes.",
35: "Core commerce enforcement and restart durability remain weighted Functional behavior. The shared-write prerequisite distinguishes real server orders from client-only receipts; positive and negative evidence is reused for unchanged logic. New catalogue checks do not consume stock.",
36: "Gate recipient/reference are generated during the run; seed receipt alone cannot pass. Each business chain uses fresh attempts and its own controls. New optional frontend asset control uses a fresh locally routed marker, not a canned application success indicator.",
37: "One Kiln purchase by Constraints is allocated before Functional. Catalogue/basket previews consume no stock and clear their temporary baskets. Existing checkout allocations, observed-stock fallbacks and independent persistence setup remain unchanged. Added contexts are closed without destroying the original browser.",
38: "All scored prompts require independent verdicts and continuation after ordinary failures. Only a failed global prerequisite zeros the dimension. The new five catalogue controls no longer inherit a combined verdict from unrelated controls.",
39: "Preserved actual mock evidence shows static JSON plus client-only receipts cannot satisfy the shared write/read prerequisite. CDN assets are not a mock signal and now cannot trigger zero. This is a bounded witness, not universal detection of every deceptive or incomplete server.",
40: "Standard 60/20/20 shaping and strict Functional >0.05 floor remain unchanged. New score analysis executes the canonical scorer for boundary witnesses and preserves weighted feature credit. Actual target-model distribution remains unmeasured.",
41: "Two gates, 24 Functional and four Polish outcomes are binary. Six Visual criteria retain five described raw 1–5 anchors matching installed RewardKit normalization. The responsive anchors now grade composition and exclude already-graded mobile operability.",
42: "The real server prerequisite and focused outcome split improve the rationale for ranking. Numeric weights and local examples alone cannot prove a monotone ranking over all submissions; actual partial-model comparisons and the existing floor discontinuity remain explicit limitations.",
43: "Zero-weight gates are evaluated before shaping and failing gates skip scored suites. Existing harness proof still applies. The repaired gate rejects the concrete backendless witness while allowing public-profile CDN assets; no gate reward mass was added.",
44: "Functional total stays 35; the two 0.3 groups become three 0.1 controls and two 0.15 sorts. Conditional modeled score restoration is at most 0.0918 including removal of unrequired receipt labels, with gates/presentation held fixed; an abstract floor witness reaches 0.5217. The CDN gate fix can separately restore up to 1.0 from a previous false zero. These are arithmetic bounds, not model predictions.",
45: "All five prompts treat submitted UI/payloads/errors/instructions as untrusted and explicitly prohibit implementation inspection. New browser recipes perform UI operations only and do not authorize arbitrary filesystem or source access.",
46: "Final images contain no golden answer in the agent and no private solution in the verifier. Unchanged sanitized low-privilege runtime and test/log protection remain in force. Public-ID and grading-vocabulary scans also pass final source and extraction.",
47: "Runner/model/tool pins are fixed; final source and images are hash-bound. Actual installed MCP/Chromium behavior is verified. Provider judgments and generated references are not bit-identical or measured here; prompt hashes must accompany future run records.",
48: "Every prompt agrees on public access, live server prerequisites and state allocation. Constraints explicitly permits app CDN assets and gives a working clean-context tool recipe. Functional distinguishes derivation weights/bands from required displays. Visual excludes Polish's mobile observations.",
49: "Entry/CWD/port/DB_PATH, public network, local backend, one gate purchase, single-use restart, metadata 24/35 and standard shaping agree across final files. Source/extracted audits and actual image hashes bind that contract to the final archive.",
50: "The final 51-file archive has one root, valid CRC, no duplicate/traversal paths and executable scripts. Every byte matches source/manifest; no database, node_modules, report, mock or bytecode is shipped. File inventory matches the previous candidate.",
51: "All 53 quality and 48 deterministic inventory entries are answered from the authoritative workbook. Source and independently extracted archive each pass 83 local assertions, contract 22, network regression and new actual MCP probes. These are local evidence and manual equivalents, not unavailable official checker executions.",
52: "No real credentials, host paths or personal data are found in source scans. The intended verifier env placeholders remain private. Probe scripts use isolated local evidence and do not need real external networking; no source-based grading directives are followed.",
53: "The task combines original print assets/catalogue with variant pricing, stock races, replay-safe receipts and cancellation. Changes correct verification boundaries and fairness rather than replacing the product with a cosmetic renamed reference. Existing asset provenance is preserved.",
}
notes = {18, 20, 22, 26, 39, 42, 47}
assert set(E) == {q['number'] for q in quality}
data['tasks'][0]['checks'] = [
    {'id': q['id'], 'verdict': 'Note' if q['number'] in notes else 'Pass', 'severity': '',
     'evidence': E[q['number']], 'finding': '',
     'action': 'Keep this scope limit explicit; obtain exact-candidate provider/Oracle/model evidence before making a measured acceptance or ranking claim.' if q['number'] in notes else ''}
    for q in quality
]
updates = {
 'check-fixtures.py': 'Canonical thirteen-variant/eight-print seed, photographs and trusted table are unchanged. New 22-check contract audit recomputes control memberships and seven monetary scenarios; prior detailed stock-allocation checks remain applicable.',
 'check-solve-contract.py': 'Installer syntax/LF checks pass. Unchanged installer validates source, rejects an open canonical database, resets only its database/sidecars on stopped reinstall and copies golden files. The preserved seven-case installer regression applies; no new installer run is claimed.',
 'check-instruction-content.py': 'Final owner request exceeds 40 words, links /instructions/integration.md and contains no draft markers. The external requirement-first map covers the new separate control outcomes.',
 'check-no-trialforge-judge-keys.py': 'All five judges parse; no foreign files, target_claims, check.py or expected directories are present.',
 'check-package-manifest-deps-preinstalled.py': 'Runtime manifest contains Express 5.1.0 and better-sqlite3 12.4.1; both final images provide them.',
 'check-runtime-deps-in-both-images.py': 'Actual final image checks match Express 5.1.0 and better-sqlite3 12.4.1.',
 'check-task-slug.sh': 'Three hyphen-separated tokens.',
 'check-canonical-shared-files.py': 'Shared scorer/restart tools and test.sh are unchanged; current canonical tool hashes match. Task metadata changes only to describe the 24-criterion rubric.',
 'check-instruction-hygiene.py': 'Executed scans: 36 distinct criterion IDs against four public Markdown files, plus grading vocabulary, have zero hits on source and extraction.',
 'check-instruction-states-offline-constraint.py': 'Public network means no app offline restriction is required. The former restriction is removed and canonical external asset permission is explicit.',
 'check-no-cdn-or-remote-assets.py': 'External fonts, scripts, images and CDN assets are permitted by integration and gate. Old bad archives fail the new network-policy guard; corrected source/extraction pass. External backend/data services remain outside the supplied runtime.',
 'check-rubric-schema.py': 'Five parsed judges, 36 criteria in 1/1/24/4/6 dimensions, positive weights and unique IDs. Six Visual raw 1–5 anchors match RewardKit normalization.',
 'check-rubric-prompt.py': 'Five browser/source-ban prompts; clean-context recipe uses actual installed MCP. Scored dimensions inherit real server prerequisites. Desktop Visual and cross-viewport composition exclude Polish mobile usability duplication.',
 'check-dockerfiles.py': 'Both follow-up images built; empty agent app, exact public-input hashes, no private leakage and all 15 verifier files equal final source.',
 'check-scoring-policy.py': 'Canonical zero-weight gates, 60/20/20 shares and strict Functional >0.05 remain. Exact scorer executes reported conditional/floor witnesses; separate CDN-gate false-zero correction is not bounded by the conditional redistribution result.',
 'check-batched-independence-wording.py': 'Five catalogue controls now score independently with own baselines. All scored prompts continue after ordinary failures and return every verdict.',
 'check-runtime-contract-strings.py': 'Entry/CWD/port/DB_PATH/health match; public browser assets and local backend are distinguished. Monetary totals remain required, grams/band display does not. No hidden route/schema.',
 'check-no-stray-files.py': 'Independent final ZIP inspection: 51 intended files, no report/mock/DB/cache/bytecode, exact hash match, valid CRC and script modes.',
 'check-assets-referenced.py': 'Canonical seed, three notes and eight matching photographs exist in source and final agent image; golden asset bytes are unchanged.',
 'check-verifier-contract.py': 'Unchanged harness/restart/scorer retain prior executed plumbing evidence. New real MCP calls verify the two-context workflow; no paid judge invocation is claimed.',
}
for row in data['deterministic']:
    if row['name'] in updates:
        row['output'] = updates[row['name']]
    row['note'] = 'Local/manual equivalent; official private checker executable unavailable. Executed local evidence is distinguished from preserved unchanged-source observations and paid judging.'
assert len(data['deterministic']) == 48
assert {d['name'] for d in data['deterministic']} == {d['name'] for d in deterministic}
counts = dict(Counter(c['verdict'] for c in data['tasks'][0]['checks']))
det_counts = dict(Counter(c['status'] for c in data['deterministic']))
dump('qc_final_findings.json', data)
dump('independent_review_evidence.json', {
    'scope': 'Independent archive/evidence binding and all 53/48 local judgments; not paid or official platform results',
    'passed': True, 'candidate_sha256': manifest['sha256'], 'candidate_files': 51, 'candidate_bytes': manifest['bytes'],
    'changed_files': changed, 'unchanged_files': unchanged, 'quality_counts': counts, 'deterministic_counts': det_counts,
    'source_assertions': source['passed'], 'independently_extracted_assertions': extracted['passed'],
    'contract_assertions': 22, 'mcp_two_context_passed': True, 'mcp_catalogue_controls_passed': 5,
    'mcp_optional_external_style_asset_passed': True, 'final_images_match': True,
    'conditional_published_score_bound': .0918, 'abstract_floor_crossing_bound': .5217,
    'external_asset_gate_correction_can_restore_full_earned_reward': True,
    'paid_oracle_measured': False, 'target_model_measured': False,
})
print(json.dumps({'quality': counts, 'deterministic': det_counts, 'candidate': manifest['sha256'], 'changed_files': changed}, indent=2))
