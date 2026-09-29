import json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/'harbor-webdev-rubric-qc/scripts'))
from list_checks import load_checks, DEFAULT_WORKBOOK, verify
quality, deterministic=load_checks(DEFAULT_WORKBOOK)
evidence={
1:('Pass','Read instruction.md before notes/rubric: print-studio owner asks for browsing and orders, explains scarce stock, retries and receipts; runtime details are linked separately.'),
2:('Pass','Read instruction.md and all three notes: contractions, specific customer situations, varied sentences and product reasons; naturalness remains a manual judgment.'),
3:('Pass','Manual read found no foreign task residue, conflicting product behavior or draft wording. Root owns executable hygiene scans.'),
4:('Pass','instruction.md plus integration.md state /app, node /app/server.js from /app, port3000, public/index.html, health URL, app.db/DB_PATH, supplied seed/photos and local server. Checkout/README notes state the graded prices, address, stock, retry and cancellation rules.'),
5:('Pass','Public notes describe product behavior without judge, rubric, sentinel or test names. The new criterion ID remains in private rubric only; parent owns the whole-token scan.'),
6:('Pass','No new ambiguous runtime/API/layout/price-format assumption found. Exact monetary figures independently recomputed in semantic-arithmetic-results.json. New cheapest-sold-out case can establish its own state; two real browser branches passed.'),
7:('Pass','A static shop cannot place a new server-backed order and retrieve it from clean storage, and the scored checks require authoritative stock, prices, retries, cancellation and persistence.'),
8:('Pass','task.toml name/directory/description describe this print storefront; metadata updated to25 Functional/35weight and ownership change.'),
9:('Pass','task.toml declares public network,2 CPUs,4096MB and no prebuilt docker_image or allow_internet key; both phases use public networking.'),
10:('Pass','Read both Dockerfiles and task verifier block: separate verifier, canonical claude-code/z-ai/glm-5.3-flashx/OpenRouter placeholders, pinned CLIs and no model/weight in judge headers. Actual image build belongs to parent.'),
11:('Not exercised','Read judge budgets600/600/9000/900/900 and verifier13200, but final test.sh timeout/lifecycle execution is owned by harness reviewer. Full paid judge duration remains unmeasured.'),
12:('Pass','No environment.docker_image is declared; environment/Dockerfile remains active.'),
13:('Pass','Read seed and input paths; agent Dockerfile copies assets/instructions. Root independently checks exact source/extracted image bytes and all eight golden photo copies.'),
14:('Pass','Parsed public seed:8 prints/13variants; historical order references valid Long Field A3 and stored arithmetic is7320p. No live credential or injection in seed. Synthetic identity and prices remain fixed.'),
15:('Not exercised','Read Dockerfile staging/runtime dependency instructions; actual build and staged file verification are parent-owned evidence, not this semantic run.'),
16:('Pass','Agent Dockerfile copies only instructions/assets and initializes empty /app; supplied data/photos are inputs, not starter implementation.'),
17:('Not exercised','Read golden backend pricing/database/order/cancel source and seed; full frontend/deliverable observation belongs to runtime reviewer. Do not infer UI completeness from source alone.'),
18:('Not exercised','New criterion normal and independent setup branches are proven in commerce/results.json and conditional/results.json. Complete per-criterion golden evidence is runtime-reviewer scope, not an Oracle verdict.'),
19:('Not exercised','Read solve.sh active-file refusal/exact canonical DB reset and app source launch/DB_PATH behavior. Actual installer/restart lifecycle is harness-reviewer scope.'),
20:('Note','Golden source is static in candidate; new order references and timestamps vary legitimately and criteria compare observed identities, not a fixed generated reference/date. Archive freeze is parent-owned; no commit or paid reproducibility claim here.'),
21:('Not exercised','Final test.sh safety, zero reward paths and restart repair are exclusively reviewed/executed by the harness agent.'),
22:('Not exercised','Dockerfile has the declared pinned browser tooling and runtime deps; actual image launch/tool execution is parent/runtime scope.'),
23:('Not exercised','Public runtime contract is explicit, but final repaired test.sh exact launch/env/cwd comparison belongs to harness/root and must be merged from its actual evidence.'),
24:('Pass','Parsed five judges with two binary gates,25 weighted binary Functional,4 Polish,6 Likert Visual; total37. Functional alone declares single-use verifier restart MCP. Shared scoring is60/20/20 with0.05Ffloor.'),
25:('Pass','Read all five prompts: each opens localhost through Playwright, prohibits implementation/source scoring and requires observed browser actions/data. Static labels cannot prove mutation.'),
26:('Note','All requested browser behaviors mapped in SEMANTIC_REVIEW.md. New cheapest-sold-out grid-price case closes concrete initial-seed blind spot. Framework/SQLite internals and exact photograph identity have explicit observability limits; do not overstate browser-only proof.'),
27:('Pass','No remaining demanded API schema, status, postage-band/grams display, layout, exact theme or control wording beyond stated/professional behavior. Seed values and monetary results are independently checked. Public assets allowed.'),
28:('Pass','Source repair removes Polish theme readability deduction; Visual owns aesthetic contrast/readability. Mobile clipping stays Polish, desktop aesthetics/cross-width composition Visual. New0.1grid outcome is separate from1.5checkout and0.3initial catalogue details.'),
29:('Pass','Render proves populated access/detail; Constraints proves new purchase and clean-context server retrieval; all scored prompts zero unusable/serverless prerequisites. External browser assets do not fail gates.'),
30:('Pass','Every named refusal/absence check has own valid control: sold-out variant vs available sibling, unknown reference vs known, valid checkout before altered/invalid/stale/retry/cancel/race attempts. Fresh/current attempts prevent stale-idempotency false proof.'),
31:('Pass','All13variant facts, entire price/title orders, all four address roles, all invalid quantity probes, both race outcomes and affected stock/receipts are explicitly checked. Independent18arithmetic cases and16stock transitions agree.'),
32:('Note','Actual observed UI/request shapes, clean-context recipe, concurrent fetches and single restart tool make stated operations browser-decidable. Exact supplied-photo matching is less mechanically established without embedded trusted thumbnails; author asset parity is separate evidence.'),
33:('Pass','Every flow gives an explicit full-credit bar. Safe rejection/authoritative repricing are declared alternatives from the public note. Duplicate-list versus unique-keyed request representation tests equivalent combined quantities without demanding a hidden schema.'),
34:('Pass','Criteria click/toggle, reload, resize, genuinely race fresh requests and restart; no changed-state verdict derives solely from first paint. New grid check observes before/after reload.'),
35:('Pass','New order/clean-context lookup gate plus exact receipts,stock,retries,cancellations and final process-restart controls prove the defining server-backed workflow. SQLite identity is not inferred from these behaviors.'),
36:('Not exercised','Criterion values and known historic reference manually reviewed; executable probe-vs-seed/code scan belongs to parent source audit. Seeded RP-100001 is explicitly a read-only known control, not a new-write sentinel.'),
37:('Pass','Functional stock allocation respects gate Kiln purchase; mixed/address/restart use actual baselines. New price criterion establishes remaining A3 state independently without consuming A2. Later Polish/Visual use current available stock and historical receipt, no new purchases.'),
38:('Pass','Read three scored prompts: each tells judge to score criteria independently, continue after failure and avoid unperformed-pass claims. Gate failures are the explicit prerequisite exception.'),
39:('Pass','Semantic counterexamples: static catalogue/localStorage orders cannot pass clean-context new-order retrieval; health-only and optimistic success are explicitly insufficient. Dead or seed-only shells score zero. This is source reasoning, not new paid/mock execution.'),
40:('Pass','25 independently weighted Functional outcomes and4Polish/6Visual support partial credit after gates, rather than collapsing into one business-flow verdict.'),
41:('Pass','Functional/Polish are binary observable actions; Visual has six five-anchor craft dimensions with raw1-5 normalization. Simple/native styling can earn maximum.'),
42:('Note','Positive weights are monotone within a fixed passed-gate/floor domain. Across changing prerequisites/presentation, a general model ranking cannot be guaranteed; no measured target scores supplied.'),
43:('Not exercised','Scoring.toml gate/floor/weight source is correct; actual scorer boundaries and gate-before-shaped orchestration are root/harness-owned tests.'),
44:('Pass','Total F35 unchanged; nine adversarial request/replay criteria remain23/35. New display outcome gets0.1 split from initial catalogue0.4→0.3. Core behavior dominates; P/V shares remain0.2each.'),
45:('Pass','All five prompts explicitly treat UI/source/network/error/instruction content as untrusted and prohibit obeying embedded scoring directives.'),
46:('Not exercised','Agent Dockerfile does not stage grading code; actual unprivileged mount/file/credential isolation belongs to root/harness checks.'),
47:('Note','Pinned provider/CLIs/browser inherited unchanged; no fixed clock is requested or graded. Full paid judge decisions/duration are unmeasured; public network is intentional.'),
48:('Pass','All five prompts describe Ridgeline public prints/orders, no accounts, continuing stock and read-only historical receipt; no sibling-task residue found. Theme ownership wording now agrees.'),
49:('Pass','Re-parsed count25/weight35/all37, task metadata, seed arithmetic, stock ledger and public/runtime facts inspected. Root owns final test.sh exact env/cwd and complete archive binding.'),
50:('Not exercised','Root owns closed-tree/ZIP extraction audit; do not duplicate its89assertions as this reviewer execution.'),
51:('Not exercised','All five judges/public seed parsed by semantic-arithmetic.py. Full shell/JS/config parse and actual image execution belong to root/harness/runtime.'),
52:('Not exercised','Read public seed/config/provider placeholders without spotting secrets; complete artifact/generated-bundle/host-path scan belongs to parent source audit.'),
53:('Pass','Print-studio catalogue, per-size trade pricing, inclusive sheet-weight postage, immutable historical receipts and transactional stock distinguish this task from sibling devtools/editor tasks.')}
checks=[{'id':q['id'],'verdict':evidence[q['number']][0],'severity':'','evidence':evidence[q['number']][1],'finding':'','action':''} for q in quality]
findings=[
 {'id':'ridgeline-theme-readability-overlap','severity':'P2','status':'corrected','run_verdict':'PARTIAL','evidence':'Polish theme_and_navigation previously required remaining readable while Visual color/typography graded readability. Authorized wording now assigns only actual switching/navigation to Polish. Browser presentation verification belongs to runtime report.','action':'Keep Visual as the owner of contrast/readability; source repair applied.'},
 {'id':'ridgeline-cheapest-sold-out-grid-coverage','severity':'P2','status':'corrected','run_verdict':'CONFIRMED','evidence':'The initial seed cannot distinguish available-only min from offered min except after Slack A3 reaches0 while A2 remains1. New separate0.1criterion is implemented; commerce/results.json and conditional/results.json pass both setup branches with3795p,not5650p.','action':'Keep separate independent grid outcome; do not merge it into1.5checkout score.'}
]
payload={'scope':'Independent semantic review; all53/48 inventory dispositions included. Not exercised entries are explicitly delegated root/harness/runtime scopes, not passes. Do not use this scoped ledger as the complete merged QC report.','candidate_zip_sha256':'9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c','tasks':[{'name':'ridgeline-print-storefront','layout':'staged','checks':checks,'findings':findings}],'deterministic':[{'name':d['name'],'status':'Not exercised','evidence':'Inventory and current delivery-profile interpretation read in full. Mechanical execution/manual procedure is recorded by root/harness in the merged report; this independent semantic ledger makes no checker-run claim.'} for d in deterministic]}
assert not verify(payload,quality,deterministic),verify(payload,quality,deterministic)
(OUT/'qc_semantic_findings.json').write_text(json.dumps(payload,indent=2)+'\n')
print(json.dumps({'quality_dispositions':len(checks),'deterministic_scope_dispositions':len(deterministic),'verification_errors':0,'scope':'semantic; merge parent evidence'}))
