"""Build a source-bound review, not a hosted-QC or Oracle certificate."""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path('harbor-webdev-rubric-qc/scripts').resolve()))
from list_checks import load_checks

out = Path(__file__).resolve().parent
quality, deterministic = load_checks(Path('WebDev Rubrics QC.xlsx'))
audit = json.loads((out/'source_audit.json').read_text())
comparison = json.loads((out/'template_and_archive_comparison.json').read_text())
probe = json.loads((out/'mobile-probe/boundary-observations.json').read_text())
golden = out.parent/'golden-difficulty-review-2026-09-28'
prior = json.loads((out.parent/'final-audit-2026-09-28/qc_final_findings.json').read_text())
old_hashes = prior['candidate']['source_sha256']
unchanged_golden = all(old_hashes.get(p) == h for p,h in audit['source_hashes'].items() if p.startswith('solution/'))
assert unchanged_golden and probe['passed'] and audit['failed'] == 0

# Numbered in the exact supplied workbook order. These are fresh, scoped
# dispositions; no old archive or superseded custom-harness result is a pass.
rows = [
('Pass', 'instruction.md and the three public notes describe the studio, customers, print catalogue and ordering problems in owner-facing prose.'),
('Pass', 'Public prose contains natural contractions and concrete needs; technical launch details are in integration.md. Human-voice judgment remains subjective.'),
('Pass', 'Public names, seed facts and instructions agree. Current draft-marker, grader-term and criterion-ID scans pass. Internal procedure headings contain cosmetic mojibake, not a conflicting public requirement.'),
('Note', 'Public instructions state the app entry, port, health, assets, DB_PATH and observed commerce behavior. Browser evidence cannot prove hidden React/Express/SQLite identity.'),
('Pass', 'All public Markdown was scanned against all 57 current criterion IDs and grader vocabulary; neither scanner found leakage.'),
('Pass', 'Current notes allow varied routes/layouts, valid money formatting and public assets. Postage grams/band labels are optional. No auth, fixed API schema or price-tie ordering is imposed.'),
('Pass', 'Real browsing, ordering, stock accounting, retry recovery and durable receipts are requested; the constraints gate needs an actual new server write/read.'),
('Pass', 'task.toml and folder identify turing/ridgeline-print-storefront. Metadata is short product prose. Extra tags are separately a lead-policy violation, F1.'),
('Pass', 'Agent/environment sections equal the current template: public network, 7200 seconds, 2 CPUs and 4096 MB. No environment.docker_image override.'),
('Note', 'verifier.env and all judge headers equal the template, including claude-code / z-ai/glm-5.3-flashx. Credentials are placeholders. Provider connectivity was not exercised.'),
('Not exercised', 'Timeout nesting fits: gates 1200<1500, scored 10800<11100, suites12600<verifier13200. Functional has42 outcomes in25 shared feature flows. A full LLM session has not been timed; nesting does not prove sufficient work budget.'),
('Pass', 'Parsed task.toml has no prebuilt agent-image override; environment/Dockerfile is active and byte-identical to template.'),
('Pass', 'All explicit public asset/note paths resolve. Eight image identities and13 variants are present; golden images match supplied bytes.'),
('Pass', 'Seed identities are unique, historical lines resolve and historical charged prices intentionally differ. Seed bytes match the golden input; recorded commerce arithmetic remains applicable.'),
('Note', 'Both Dockerfiles match template. Current mounted golden/browser and canonical-harness runs succeed in the existing built verifier image. No fresh full image rebuild was performed in this review.'),
('Pass', 'Agent Dockerfile copies only public assets/instructions. No tests or finished solution are copied into the agent image by this configuration.'),
('Note', 'All19 solution/installer files match the tested golden. Recent13 commerce plus9 browser groups passed; this review also confirms mobile checkout visibility. This is bounded coverage, not proof of every possible interaction.'),
('Not exercised', 'A complete judge-driven Oracle was not run. Local browser success and synthetic harness scores cannot certify Oracle1.0 or subjective visual ratings.'),
('Pass', 'Golden server paths are independent of CWD. Actual canonical test.sh launch and single process restart succeeded; stored receipts/stock/retries survived. solve.sh and golden bytes are unchanged.'),
('Note', 'Source is recorded by SHA256. Seed state and calculations are reproducible, while generated references/timestamps legitimately vary. Current workspace includes uncommitted task files.'),
('Note', 'test.sh equals the template, initializes zero and retains the EXIT fallback. The old custom whole-report error validator is gone. A whole RewardKit process failure can still produce zero under shared policy; partial model-failure behavior was not measured.'),
('Note', 'Existing image runs the real browser MCP and canonical restart harness. Provider calls and a complete live RewardKit judge session were not run; synthetic scores only tested orchestration.'),
('Pass', 'integration.md explicitly says launch CWD is not guaranteed; node /app/server.js, port3000, DB_PATH and health match canonical test.sh and the tested golden.'),
('Pass', 'Current TOML parses:42 Functional(weight35),7 Polish(weight4),6 Visual(1-5),2 gates;57 globally unique IDs. Five [judge] headers match template. Shared scoring and tools are byte-identical.'),
('Pass', 'All five prompts require live browser evidence, forbid source-based scoring and treat submission text as untrusted. Actual browser_run_code_unsafe context recipe ran successfully.'),
('Fail', 'instruction.md promises phone use, but Polish responsive_layout only requires catalogue/basket; Visual can choose any two mobile surfaces and excludes mobile operability. A temporary CSS counterexample hides the mobile checkout form while preserving those observations and desktop checkout. See mobile-probe/boundary-observations.json.'),
('Pass', 'The previously reported hidden gram/band labels are explicitly optional; reference formatting, routes, tie order and address-field names are flexible. No new unrequested behavior was found in the current source review.'),
('Note', 'Search, filters, ordering, basket persistence/isolation, retry variants and persistence facts have distinct outcomes with original budgets retained. Shared flows still require capability controls. No new concrete unrelated all-legs veto was established; hosted interpretation remains unmeasured.'),
('Pass', 'Render checks populated basic access; Constraints requires a new UI order and independent-context server receipt after reload. Scored prompts restate the prerequisite without another purchase. Static/localStorage-only witnesses cannot satisfy that written gate.'),
('Pass', 'Negative request probes begin with observed successful operations and reread stock/receipts after refusal. Zero-basket and unknown-reference checks include positive controls.'),
('Pass', 'Catalogue checks inspect all8 prints/13 variants; filters compare complete sets, address probes each required component, quantity probes zero/negative/fraction, restart all13 stock values.'),
('Note', 'Observed UI/network requests and restart MCP establish commerce behavior. Exact asset identity needs access to reference images; hidden framework/database identity is not browser-provable. No source-code reading or private JS-global timing test is required.'),
('Pass', 'Current app_context has no magic EVALUATION_INCOMPLETE prefix. Own-outcome rules preserve independent credit, and R25 calls restart once. Fixed procedural quantities have an observed-stock fallback after earlier failures.'),
('Note', 'Real browser evidence covers keys, themes, reload, clean contexts, race/lost-response behavior and narrow screens. Mobile checkout was visible in the golden, but rubric coverage of it is incomplete (F2).'),
('Pass', 'R25 uses actual restart_app once over the same database; the current canonical harness confirmed retained receipt, stock, historical order and attempt identity. Browser reload alone is explicitly insufficient.'),
('Pass', 'New purchases use newly chosen recipients and fresh attempts; retrieved references come from the live operation. Historical RP-100001 is a separate known read-only control.'),
('Pass', 'Constraints consumes one Kiln; Functional reserves stock and reads actual state after failures; Polish/Visual use currently available variants without durable mutation. Single continuing database is explicit.'),
('Pass', 'Prompts instruct one verdict per outcome, reuse shared observations and continue after ordinary failures. There is no current custom reasoning-prefix veto of the full suite.'),
('Note', 'The strengthened server-write/read gate blocks the known static/local-storage shell. Exhaustive adversarial fake-server cases have not been measured; no universal anti-mock guarantee is claimed.'),
('Note', 'Canonical positive weighted means provide partial scores for completed observations. The actual harness used synthetic judge scores; no measured Luna distribution. Whole-process grading failures still use the shared zero fallback.'),
('Pass', 'Objective outcomes are binary; six visual criteria use valid integer1-5 anchors. Current TOML/source validation passes; aesthetic scores remain judge-dependent.'),
('Note', 'Weights are positive and algebraically monotone above the floor. Empirical ranking is unmeasured. Separating bundled criteria can increase deserved partial credit even with unchanged totals.'),
('Pass', 'scoring.toml and score.py exactly match template: zero-mass all-pass gates before scoring, strict Functional>0.05 floor, then60/20/20.'),
('Pass', 'Decimal checks conserve all25 original Functional budgets exactly at35. Polish remains4; Visual6. Dimension shares are canonical. No target model score is represented as measured.'),
('Note', 'Each prompt rejects grading directives in submitted material and bans source scoring. This is instruction-level protection, not a comprehensive prompt-injection red-team result.'),
('Pass', 'Separate verifier configuration and agent build context keep tests out of agent image. Canonical launch uses an unprivileged app process; real canonical launch/restart evidence exists.'),
('Note', 'Pinned RewardKit/tool configuration and source hashes aid reproducibility. Image tags, LLM responses and scheduling are not fully deterministic; public-network use is allowed.'),
('Note', 'Prompts refer to Ridgeline and consistent browser/context/outcome scopes; no old sentinel rule remains. Several changes improve consistency but violate the later frozen-template rule (F1); do not silently restore contradictory generic wording.'),
('Note', 'Current paths, judge headers, limits, weights and shared context agree. However the lead requires untouched non-CHANGE_ME template content: ten whole files plus tags violate that policy (F1), and the old ZIP differs in eight files (F3).'),
('Pass', 'Current source has a closed staged task structure; no database, node_modules, ZIP, caches or reports inside it. Review artifacts live outside the task. Existing release ZIP is stale, separately F3.'),
('Note', 'All current TOML/JSON and LF bash checks pass, as do94 local source assertions. Current real browser probe and reused matching golden/harness evidence succeed. No hosted checker executables or full paid judge run were available/executed.'),
('Pass', 'Current text scan finds no literal credential/private-key or developer host path. API-key variable names are absent from Dockerfiles/test.sh; canonical placeholders remain in verifier.env.'),
('Pass', 'Task has a coherent print-shop problem with variant trade prices, postage, scarce shared stock and receipt/retry durability. No personal attribution or QC narrative in metadata.'),
]
assert len(rows) == len(quality) == 53
checks=[]
for meta,(verdict,evidence) in zip(quality,rows):
    checks.append(dict(id=meta['id'],verdict=verdict,severity='P2' if verdict=='Fail' else '',evidence=evidence,
        finding='Required mobile checkout can escape prescribed mobile observations.' if verdict=='Fail' else '',
        action='Cover checkout/delivery controls in a permitted mobile usability check, after reconciling frozen-template scope; preserve dimension ownership and total weights.' if verdict=='Fail' else '',
        run_verdict='NOT EXERCISED' if verdict=='Not exercised' else 'PARTIAL' if verdict=='Note' else 'CONFIRMED'))

det_rows = [
('NOTE','Public-network profile; no provider allowlist required. verifier.env equals template.'),
('NOTE','Staged entry/DB_PATH contract supersedes the legacy APP_MANIFEST convention.'),
('PASS','Explicit seed/photo/note paths resolve; eight golden image files equal supplied images.'),
('PASS','All batched prompts require independent scores and continuation; shared procedures execute once.'),
('NOTE','Current WebDev no-canary override applies.'),
('FAIL','Seven shared files equal template, including test.sh and .dockerignore; however ten unmarked template files differ and metadata.tags adds two entries. See template_and_archive_comparison.json and F1. Broader lead policy remains violated.'),
('N-A','Public shop has no authentication or demo credentials.'),
('PASS','Docker COPY sources exist; agent stages public instructions/assets only.'),
('NOTE','Current staged Dockerfile profile supersedes legacy base-image rules; both files equal template.'),
('NOTE','Both Dockerfiles equal template. Existing built verifier runs current mounts; no fresh complete image rebuild in this review.'),
('PASS','Seed has8 distinct prints/13 variants; identities resolve and source/golden seed bytes match. Recent commerce calculations passed.'),
('PASS','Owner-facing request and three notes define product/runtime; mobile rubric-coverage defect is separately reported under quality26.'),
('PASS','Fresh criterion-ID and grading-term scanners find no public leaks across57 unique criteria.'),
('NOTE','Public network policy allows external browser assets; no blanket offline restriction applies.'),
('PASS','No obsolete terminal-bench suffix in instruction.md.'),
('NOTE','Public frontend/CDN assets expressly allowed; external backend dependence is prohibited. Current network-policy scanner passes.'),
('PASS','Fresh shipped-text host-path scan passes.'),
('PASS','Fresh credential/private-key scan passes; verifier.env uses canonical placeholders.'),
('PASS','Fresh TODO/FIXME/CHANGE_ME scan passes.'),
('PASS','Closed source tree; no runtime database, node_modules, caches or review artifacts. Old ZIP differs and must not be treated as current.'),
('PASS','All five judge headers match the permitted staged schema.'),
('PASS','Declared Express/better-sqlite3 start successfully in existing verifier image without installing packages.'),
('NOTE','Fresh attempt IDs/references arise from actual operations; historical receipt is an intentional control, not completion evidence.'),
('PASS','All five staged judge/prompt pairs, context, scoring, tools, Dockerfiles, solution and public assets are present.'),
('NOTE','Legacy reward.toml replaced by canonical scoring.toml and score.py.'),
('NOTE','Current staged policy is exactly60/20/20 with zero-mass gates.'),
('PASS','Five prompts include URL, context, criteria, browser evidence, submission distrust and appropriate prerequisites. Semantic/frozen-template issues are separately recorded.'),
('PASS','Five TOMLs parse;57 unique criteria:1render,1constraints,42functional,7polish,6visual; positive weights, valid visual1-5 anchors.'),
('NOTE','No obsolete segments layout; gates/scored structure is complete.'),
('PASS','Current integration explicitly permits unspecified launch CWD; entry, port, DB_PATH and health match test.sh/golden. No mandatory grams/band display.'),
('NOTE','Matching Dockerfile declarations and successful current golden execution support runtime dependencies; prior image evidence retained, no fresh rebuild.'),
('PASS','scoring.toml and score.py byte-match template: gates, Functional>0.05 and60/20/20 unchanged.'),
('PASS','solve.sh LF/syntax and source contract pass; unchanged installer used in fresh disposable mobile probe.'),
('PASS','Parsed name turing/ridgeline-print-storefront matches source folder.'),
('NOTE','Canonical test.sh launch and actual single-use restart passed recently with matching hash. Judge scores were synthetic; provider failures/full timing unmeasured.'),
('PASS','Deprecated allow_internet key absent.'),
('N-A','No Compose artifact.'),
('PASS','No FROM --platform override in either Dockerfile.'),
('N-A','No GPU request.'),
('PASS','No deprecated allow_internet=true setting.'),
('PASS','No nproc calls in shipped shell/Dockerfiles.'),
('PASS','Verifier pins harbor-rewardkit==0.1.7; no trial-time pip install.'),
('N-A','No pytest-based verifier.'),
('PASS','Absolute /app,/assets,/instructions paths match the current contract.'),
('PASS','ridgeline-print-storefront is a three-token slug.'),
('PASS','Referenced task files exist; routes/payloads are discovered from live app rather than imposed.'),
('PASS','No trial-time package/network installation in test.sh; expected readiness and judging operations only.'),
('NOTE','Template Dockerfile bakes tooling; installed browser MCP successfully ran this review. Full fresh-image/provider grading was not performed.'),
]
assert len(det_rows) == len(deterministic) == 48
det=[dict(name=m['name'],status=s,output=e,note='Local/manual equivalent of the supplied sheet, not execution of the private platform checker. See source_audit.json and evidence manifest.') for m,(s,e) in zip(deterministic,det_rows)]
findings=[
dict(id='F1',check='Lead frozen-template policy / check-canonical-shared-files.py',severity='P1',run_verdict='CONFIRMED',title='Unmarked template content still differs',evidence='template_and_archive_comparison.json lists ten whole files without CHANGE_ME and extra task metadata tags; seven shared files match.',impact='Not compliant with the explicit lead instruction despite canonical timeouts, environment and scoring. Some deviations address earlier source-QC failures.',fix='Reconcile against an approved template and restrict edits to authorized placeholders. Do not blindly undo working gate/visual-schema fixes; obtain a lead decision where the instructions conflict.'),
dict(id='F2',check='dimensions_cover_every_graded_requirement',severity='P2',run_verdict='CONFIRMED',title='Mobile checkout coverage gap',evidence='Temporary CSS probe hides mobile .address-panel form; catalogue/basket observations and desktop form remain valid. Eight probe assertions pass. No app source was edited.',impact='A broken phone checkout can avoid the prescribed mobile checks. This is a rubric gap; the golden mobile checkout is visible.',fix='After resolving template scope, explicitly observe mobile checkout/delivery controls, preserving existing weight and avoiding duplicate visual penalties.'),
dict(id='F3',check='Release artifact freshness',severity='P1',run_verdict='CONFIRMED',title='Existing final ZIP is stale',evidence='template_and_archive_comparison.json lists eight differing files in ridgeline-print-storefront-final.zip.',impact='Uploading that archive would omit current changes and use an older harness/rubric.',fix='After resolving findings, create and hash-verify a fresh archive. No archive was regenerated during this review.'),
dict(id='F4',check='timeouts_fit_the_work / solution_covers_every_graded_dimension',severity='P2',run_verdict='NOT EXERCISED',title='Full judge timing and Oracle score unmeasured',evidence='9000-second functional budget is canonical and nested correctly. Available golden/harness results are scripted/synthetic, not a full judge-driven evaluation.',impact='Cannot certify timeout fit, Oracle1.0, Luna range or zero hosted-QC failures.',fix='Use an authorized complete evaluation to measure these; do not alter frozen budgets based on speculation.'),
]
task_path=Path('projects/ridgeline-print-storefront')
after={p.relative_to(task_path).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in task_path.rglob('*') if p.is_file()}
assert after == audit['source_hashes'], 'Task changed during read-only review'
payload={'scope':'All53 quality and48 deterministic dispositions for current source. Review only; no hosted QC, paid Oracle/model or source edits. Pass means local evidence for that item, not platform certification.',
 'evidence_binding':{'task_source_hashes':after,'task_unchanged_during_review':True,'golden_files_match_previously_tested_hashes':unchanged_golden,'local_source_assertions':{'passed':94,'failed':0},'mobile_probe':'mobile-probe/boundary-observations.json','prior_matching_golden_evidence':str(golden),'template_comparison':'template_and_archive_comparison.json','official_checker_execution':False,'oracle_measured':False,'luna_measured':False},
 'tasks':[{'name':'ridgeline-print-storefront','layout':'staged','checks':checks,'findings':findings}], 'deterministic':det}
(out/'qc_findings.json').write_text(json.dumps(payload,indent=2)+'\n',encoding='utf8')
print(json.dumps({'quality':dict(Counter(c['verdict'] for c in checks)),'deterministic':dict(Counter(c['status'] for c in det)),'source_unchanged':True},indent=2))
