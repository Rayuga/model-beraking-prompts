"""Bind the independent 53/48 review to the exact frozen task archive.

Evidence assertions below validate recorded local runs and unchanged-source reuse.
They do not run unavailable official checkers or a provider-backed judge.
"""
from __future__ import annotations

from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
TASK = ROOT / "projects/ridgeline-print-storefront"
OLD = OUT.parent / "hardening-2026-09-26-round2"
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "harbor-webdev-rubric-qc/scripts"))
from list_checks import DEFAULT_WORKBOOK, load_checks


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


manifest = read(OUT / "candidate_manifest.json")
assert manifest["sha256"] == "f8a9b605699d7e87dc1a0a08fb2f48e23a16e784588c7380d3a5aa47a77b706d"
archive = OUT / manifest["archive"]
assert sha256(archive.read_bytes()).hexdigest() == manifest["sha256"]
assert archive.stat().st_size == manifest["bytes"] == 698609
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    members = [i for i in z.infolist() if not i.is_dir()]
    assert len(members) == manifest["files"] == 51
    assert len({i.filename for i in members}) == 51
    zipped = {}
    for item in members:
        parts = Path(item.filename).parts
        assert parts[0] == "ridgeline-print-storefront" and ".." not in parts
        relative = Path(*parts[1:]).as_posix()
        blob = z.read(item)
        digest = sha256(blob).hexdigest()
        assert digest == manifest["source_sha256"][relative]
        assert blob == (TASK / relative).read_bytes()
        if relative.endswith(".sh"):
            assert stat.S_IMODE(item.external_attr >> 16) & 0o111
        zipped[relative] = blob
    assert set(zipped) == set(manifest["source_sha256"])

old_manifest = read(OLD / "candidate_manifest.json")
assert sha256((OLD / old_manifest["archive"]).read_bytes()).hexdigest() == old_manifest["sha256"]
with zipfile.ZipFile(OLD / old_manifest["archive"]) as z:
    old_files = {Path(*Path(n).parts[1:]).as_posix(): z.read(n) for n in z.namelist() if not n.endswith("/")}
changed = sorted(k for k in zipped if zipped[k] != old_files.get(k))
added = sorted(set(zipped) - set(old_files))
removed = sorted(set(old_files) - set(zipped))
assert not added and not removed
unchanged = sorted(set(zipped) - set(changed))
for prefix in ("solution/app/", "environment/assets/"):
    assert all(k in unchanged for k in zipped if k.startswith(prefix))
for name in ("tests/test.sh", "tests/tools/score.py", "tests/tools/restart_mcp.py", "tests/scoring.toml", "tests/scored/polish/judge.toml", "tests/scored/visual/judge.toml", "environment/Dockerfile", "tests/Dockerfile"):
    assert name in unchanged

source = read(OUT / "qc_source_evidence.json")
extracted = read(OUT / "qc_extracted_source_evidence.json")
for result in (source, extracted):
    assert result["passed"] == 80 and result["failed"] == 0
    assert result["source_hashes"] == manifest["source_sha256"]
preflight = read(OUT / "revision_preflight.json")
extracted_preflight = read(OUT / "extracted_revision_preflight.json")
for result in (preflight, extracted_preflight):
    assert result["passed"] == 24 and result["failed"] == 0
    assert result["source_hashes"] == manifest["source_sha256"]
contract = read(OUT / "contract-checks.json")
assert contract["passed"] and contract["check_count"] == 19
assert all(c["passed"] for c in contract["checks"])
math = read(OUT / "rubric_math_results.json")
assert math["scenarios_passed"] == 19 and math["criterion_count"] == 21
assert math["functional_weight"] == 35 and math["enforcement_weight"] == 23
mock = read(OUT / "mock_gate_evidence.json")
assert len(mock["checks"]) == 6 and all(c["passed"] for c in mock["checks"])
assert mock["old_gate_observations_satisfied"] and not mock["new_server_backing_prerequisite_satisfied"]
gate = read(OUT / "gate-address-browser-results.json")
assert len(gate["checks"]) == 7 and all(c["passed"] for c in gate["checks"])
baskets = read(OUT / "basket-context-browser-results.json")
assert baskets["passed"] and len(baskets["checks"]) == 4 and all(c["passed"] for c in baskets["checks"])
reinstall = read(OUT / "oracle-reinstall-results.json")
assert reinstall["result"] == "pass" and reinstall["checks"] == 7
assert len(reinstall["results"]) == 7 and all(c["result"] == "pass" for c in reinstall["results"])
images = read(OUT / "final_image_evidence.json")
assert images["agent"]["passed"] and not images["agent"]["privateSolutionOrVerifierPresent"]
assert images["verifier_source_hashes_match"] and images["verifier_source_files"] == 15

quality, deterministic = load_checks(DEFAULT_WORKBOOK)
assert len(quality) == 53 and len(deterministic) == 48
dump("qc_inventory.json", {"quality": quality, "deterministic": deterministic})
data = read(OLD / "qc_final_findings.json")
data.pop("round2_scope", None)
data["scope"] = (
    "Independent final source and evidence review of Ridgeline rubric repair, 26 September 2026. "
    "All 53 workbook judgment checks and 48 deterministic inventory entries answered. "
    "Official/private checker implementations and paid provider judge were not executed. "
    "Recorded executable local checks, new real-browser witnesses, bounded arithmetic and manual equivalents are distinguished. "
    "Earlier reports are retained, but their acceptance of insufficient server prerequisites and a .454 mock-floor estimate is explicitly superseded."
)
data["candidate"] = manifest
data["repair_scope"] = {
    "changed_files": changed,
    "unchanged_file_count": len(unchanged),
    "old_candidate_sha256": old_manifest["sha256"],
    "golden_application_unchanged": True,
    "installer_changed": "solution/solve.sh" in changed,
    "shared_harness_scoring_tools_presentation_criteria_unchanged": True,
    "paid_oracle_measured": False,
    "target_model_measured": False,
}
task = data["tasks"][0]
task["findings"] = []
answers = {c["id"]: c for c in task["checks"]}


def answer(number, evidence, verdict="Pass", action=""):
    cid = next(c["id"] for c in quality if c["number"] == number)
    answers[cid].update(verdict=verdict, severity="", evidence=evidence, finding="", action=action)


answer(1, "instruction.md: opening paragraphs use a print-studio owner's request; technical launch details reside in the linked integration note.")
answer(2, "Read the final brief and all three notes: consistent ordinary shop language, explicit customer situations and concise business rules. No rubric instructions in public prose.")
answer(3, "Final public prose and source scans are clear of draft/host-path/cross-task residue. The strengthened constraints accepts embedded/data/blob and loopback aliases rather than an unstated same-origin restriction.")
answer(4, "instruction.md plus README.md, checkout-note.md and integration.md state the graded product and runtime contract. REQUIREMENT_COVERAGE.md begins with public requirements and includes visitor-local baskets, unknown lookup and server-side address rejection.")
answer(5, "Executed public-ID scanner covers all33 criterion IDs against4 public Markdown files with zero collisions, on source and extracted archive. Manual prose review finds no grader machinery, scores or sentinels.")
answer(6, "All21 functional checks map to explicit public rules. Golden's unchanged application passes the changed gate/address and independent-basket browser cases. Fresh and exercised-workspace installations pass7 local checks. No fixed unbriefed endpoint, payload schema or postcode format.")
answer(8, "Final task.toml matches task identity and reports21 functional criteria/weight35, nine adversarial/replay criteria/weight23, four Polish and six Visual criteria. It explicitly leaves paid scores unmeasured.")
answer(9, "Parsed both phases as public network, agent2CPUs/4096MB, no allow_internet/docker_image. This particular product's explicit self-contained delivery rule is separate from the public-network profile; the gate does not reject merely off-origin local assets.")
answer(10, "Final frozen verifier.env and dependency pins match template. Rebuilt verifier image1e8bdf... has all15 copied /tests files equal to final source; agent and verifier dependency versions checked. No live credentials scanned.")
answer(11, "Unchanged nested budgets: gates600+600=1200<1500; scored9000+900+900=10800<11100; suites12600<13200 verifier; agent7200/build600. Basic gate adds one bounded checkout/fresh lookup; seven targeted browser groups completed in seconds. Paid-judge latency is unmeasured.")
answer(13, "Source/ZIP hash checks preserve canonical source/golden seed equality, eight prints/thirteen variants, and all eight exact photograph copies. Docker image hashes verify actual asset and instruction mounting.")
answer(14, "Canonical seed unchanged. Nineteen independent monetary cases were rerun against the revised21-criterion inventory and pass. New19 contract assertions verify trusted13-row table and Kiln allocation7→6→5→4→3→2, including refusal legs with zero decrement.")
answer(15, "final_image_evidence.json: actual rebuilt agent0b5f433... has only.git/.gitkeep in /app, exact inputs, Node22.23.2/Express5.1.0/better-sqlite3 12.4.1 and no solution/tests. Rebuilt verifier1e8bdf... copied15 final source files exactly.")
answer(16, "Actual final agent image confirms no golden/verifier leakage; Dockerfile copies only the public instructions/assets and initializes an empty /app repository.")
answer(17, "Golden application bytes are unchanged from the prior validated candidate:203 backend assertions,9+5 browser groups,49 presentation/navigation assertions remain applicable to their recorded scopes. New actual Chromium152 gate/address7 groups and visitor-basket4 groups pass. Installer7 checks now cover stale workspace reuse. These are targeted deterministic proofs, not all21 new criteria judged end-to-end.")
answer(18, "The golden has local backend, actual-browser and presentation evidence, including all changed behaviors. A full paid Oracle run against this exact new21-criterion rubric is not measured.", "Note", "Run the authorized platform Oracle/target-model evaluation on the exact frozen archive; never relabel local evidence as a paid score.")
answer(19, "Golden application/runtime bytes unchanged and final images rebuilt. Prior actual low-privilege verifier launch/restart proof still applies. New installer7-case regression runs without network, prevents active-database reset and preserves ordinary restart state.")
answer(20, f"Candidate frozen at SHA256 {manifest['sha256']}; independent CRC/hash/mode verification matches all51 source files. Generated order IDs and timestamps are observed rather than asserted as fixed constants. Tests intentionally keep one continuing database.", "Note")
answer(21, "tests/test.sh and canonical scorer/restart tools are byte-identical to the previously executed4-case harness proof: correct CWD, sanitized low-privilege launch, gate-failure skip and missing-app zero. Final source80 and extracted80 checks pass. Synthetic harness outputs are not judge scores.")
answer(22, "Final pinned verifier image builds with all current test files. Actual Chromium152 can execute independent contexts and observed request replays; earlier unchanged harness/MCP/scorer runtime proofs remain valid. No provider-backed judge invocation was made.", "Note", "Paid provider execution, Oracle reward and judge latency remain unmeasured.")
answer(23, "integration.md names node /app/server.js from /app, port3000, health and DB_PATH. Unchanged initial/restart launcher cd behavior was proved in actual container. Gate requires only success at the stated health path, with no invented JSON body.")
answer(24, "Source/extracted audits parse five judges and33 criteria in1/1/21/4/6 dimensions, positive weights, unique IDs and appropriate aggregation. Browser MCP is present throughout, restart only in Functional. Shared tools/scoring remain byte-identical to the canonical template.")
answer(25, "All five prompts explicitly use Playwright against localhost:3000 and forbid inspecting submitted implementation/source/comments/bundles as scoring evidence. Rendered DOM/screenshots and legitimate browser requests remain allowed.")
answer(26, "REQUIREMENT_COVERAGE.md now maps public requirements first to real shipped checks, including new address enforcement, known/unknown lookup and two visitor baskets. F01 includes a trusted13-row table. Exact SQLite/Express/React internals and concealed topology remain unprovable by browser-only judging; they are not falsely inferred from a health response.", "Note", "Keep source-level architecture limitations explicit; do not invent an SQL endpoint or claim the shared-write gate identifies an engine.")
answer(27, "Reviewed all33 criteria against the final brief/notes. New server gate follows explicitly required independent receipt lookup, without exact route/schema; addresses require only four stated nonblank components. No extra auth, one preferred layout, postal-format check or same-origin requirement. Presentation criteria unchanged.")
answer(28, "One basic shared order is a zero-weight prerequisite. Price, stock, retry, cancellation and real restart remain scored. Catalogue/search/order, basket retention/removal and missing-reference cases have distinct outcomes; linked transactional criteria keep coherent multi-leg bars. Visitor baskets are cleaned without stock changes.")
answer(29, "Constraints now performs one actual new write plus clean-context server lookup/reload. Golden positive7-group browser proof passes; independent mock6-check proof rejects staticJSON+localStorage receipts despite health/product responses and no-opHTTP200 write. Every scored prompt inherits that gate, then locally reloads populated server content without repeating purchases. Visual gate raw1 correctly normalizes0.")
answer(30, "Every rejection chain starts from a working observed operation and rereads affected state. New four address probes sit between separate valid purchases and each uses a fresh identity. Unknown lookup opens known RP-100001 before/after. Zero-removal first adds its own real line; no failure is treated as successful enforcement.")
answer(31, "F01 covers all13 trusted variant facts; F02/F03 compare complete matches/order; F05 proves both visitors stay separate after reload. Address probes cover all four stated required components. Atomicity rereads all affected stocks/receipts; persistence compares observed8/13 identities without an unrequested hidden all-orders API.")
answer(32, "Shared-write proof requires the actual server receipt in a clean browser, not its framework. Business probes observe real requests, valid controls, refusal outcomes and fresh reads. Source inspection is explicitly prohibited in all prompts; routes/payloads follow the implemented UI.")
answer(33, "Read complete21 functional descriptions and prompts: numbered legs state conjunctive bars, fail-and-continue rules prevent inherited verdicts, and fresh identities distinguish retries from new validation. Failed address mutation stops further probes to limit damage; later persistence uses observed stock.")
answer(34, "Criteria exercise real reload, separate browser contexts, desktop/mobile themes, basic visible keyboard focus, concurrency and process restart. New visitor-basket4 groups pass in Chromium152. Prior presentation49 assertions still apply because app and four/six presentation criteria are unchanged. Full keyboard purchase is not an added polish requirement.")
answer(35, "Functional grades true commercial actions and process-restart durability; constraints first proves a new order independently retrievable from the server. New golden gate evidence establishes this cross-browser behavior. Prior203 API/restart assertions and real single-use restart-MCP proof apply to unchanged app/harness; these do not substitute for a paid final rubric run.")
answer(36, "New gate recipient/reference generated during run cannot be satisfied by the historical seed. Negative fixture demonstrates seed data plus a locally forged receipt does not pass. Dynamic purchase and changed-address controls require writes; historical checks also compare an actual current purchase.")
answer(37, "App context and all prompts account for the gate's one Kiln purchase. Normal chain7→6 gate→5 mixed→3 address→2 final persistence; observed-state fallback handles earlier failures. Browser baskets clean up without orders. Polish uses live available variants; Visual uses historical RP-100001 and makes no new durable write.")
answer(38, "Scored prompts preserve independent continue-and-return-all wording. The global shared-write prerequisite is the stated harness exception. Local business-rule failure does not zero unrelated presentation or silently satisfy later negative tests.")
answer(39, "Corrected prior conclusion: old first-five functional weights7.5/35 could yield.528571 with perfect presentation; conditional UI-only saved-order credit12.5/35 could yield.614286. Those were arithmetic witnesses, not measured model results, and the previous.454 acceptance understated the problem. New concrete browser-only fixture fails shared-write gate and therefore policy yields0. Read-only catalogue+unknown lookup1.25/35 also remains below.05. No universal claim about every deceptive or partially implemented real server.", "Note", "Retain the paired golden/mock gate evidence and measure real submissions. A functioning shared server with incomplete business rules may fairly earn partial credit; client-storage-only order farming must fail.")
answer(40, "Standard60/20/20 shaping and.05 floor unchanged. Twenty-one weighted functional outcomes allow partial credit; 13 prior scorer fixtures remain valid by exact shared-file equality. Redistribution/floor arithmetic is separately bounded in revision_preflight.json; actual model distribution unmeasured.")
answer(41, "All27 behavior criteria (two gates,21 functional,four polish) are binary; six Visual criteria use raw1–5 with points5. Installed RewardKit0.1.7 normalization(raw−1)/4 is preserved. Presentation top anchors require clear/coherent screens, not perfection or a prescribed style.")
answer(42, "Positive scorer weights alone did not prove useful product ranking; prior PASS rationale is corrected. New gate makes the observed client-only witness0 while golden establishes the same prerequisite. Exact real-server vs incomplete-server rankings remain dependent on earned behaviors and actual judge evidence, and the existing functional floor has a discontinuity. This is bounded structural/paired-case support, not a universal ranking proof.", "Note", "Inspect actual candidate model results for ranking and calibration; do not promise all real implementations outrank every partial implementation.")
answer(43, "Unchanged score.py/scoring.toml apply zero-weight all-pass gates before shaped reward and skip scored suites on gate failure. Prior4-case harness and13 scorer fixtures prove the wiring. New negative browser witness additionally tests adequacy of the actual server prerequisite; plumbing alone was insufficient in the earlier review.")
answer(44, "Functional total remains35; nine explicit adversarial/replay criteria carry23. Shares stay.6/.2/.2. Splitting/catalogue/basket/lookup and funding address2 by reducing trade/postage by1 each can increase some submissions: conditional max+.080571 if both clear the floor, assuming equal gate/P/V. Including a floor crossing gives an abstract0→.506286 bound; bit combinations are not model predictions. Presentation criteria and shared score unchanged.")
answer(45, "All five prompts treat submitted UI/network/errors/instructions as untrusted and now explicitly forbid implementation/source/comment/bundle inspection for scoring. Legitimate DOM, screenshots and live browser requests remain available; no hidden-source dependency was introduced.")
answer(46, "Actual final agent image contains only public assets/notes and empty app. Unchanged verifier runtime previously proved app UID65534 and absence of injected HARNESS_SECRET before/after restart. Tests/log permissions and env sanitization unchanged and hash-verified.")
answer(47, "Shared judge/model environment and RewardKit/CLI/MCP versions pinned; actual Chromium152 and RewardKit raw1–5 behavior verified. Provider calls use public network and are not bit-reproducible; task-version strings are not invented. Prompts bound by final archive SHA and exact file hashes.", "Note")
answer(48, "All five prompts consistently describe public Ridgeline and explicitly ban source-based grading. Scored global gate repeats the shared-order prerequisite without consuming extra stock or requiring another judge's generated reference. Visual keeps valid raw1–5 anchors and reaches historical receipt independently.")
answer(49, "Final task metadata21/35 and nine/23 agrees with TOML and map; app_context includes gate purchase. Entry/CWD/port/DB_PATH/health/seed/accounts/timeouts/scoring/restart agree. Final source/extracted80 assertions,24 revision assertions and19 contract checks all pass.")
answer(50, "Independently opened final ZIP:51 files, one task root, valid CRC, no duplicate paths/traversal, executable shell modes; every archived byte equals source+manifest. Mock/report files stay outside the task. Added/removed task files versus prior candidate: zero.")
answer(51, "Final source80 and independently extracted80 executable assertions pass; revision24 and extracted24 pass; contract19 pass. Independent archive/source/evidence binding rederives exact53/48 workbook inventories. Both final images built and copied-source hashes checked. Official private scripts and paid judge unexecuted.")
answer(52, "Final source scans exclude live secrets and host paths; verifier env placeholders are intentional. Seed addresses are synthetic. Golden browser proof runs without external network; prompt ban resists instructions embedded in source/UI/data. No tools were used to send messages externally.")
answer(53, "Task remains an authored print-shop product with per-variant trade/stock, weight bands, immutable receipts, atomic checkout, distinct retry identities and one-time restocking. Provenance retained. Hardening ties strict checks to stated behavior rather than arbitrary UI/API details.")

det_updates = {
    "check-instruction-hygiene.py": "Executed shared exact whole-token case-insensitive scanner:33 IDs across4 public Markdown files, zero collisions on source and extracted archive; manual no-machinery review also complete. This avoids the earlier Colderwater false-PASS gap.",
    "check-rubric-schema.py": "Parsed five judges/33 criteria in1/1/21/4/6; unique IDs, positive weights, canonical schema, correct MCP scopes. Six visual points5 anchors are raw1–5, matching the installed runtime.",
    "check-rubric-prompt.py": "All five prompts contain live-browser entry, untrusted-evidence handling and explicit source-inspection prohibition. Every scored prompt requires proven shared server write/read plus local reload, without repeating the order; raw1 visual failure normalizes0.",
    "check-solve-contract.py": "Installer syntax/LF checks pass. It validates source, rejects open canonical DB handles, removes only /app/app.db and its two SQLite sidecars, then copies local golden files. New seven-case isolated install/reinstall/restart regression passes; no runtime installs/process killing.",
    "check-dockerfiles.py": "Both exact final images built; final_image_evidence verifies agent inputs and all15 copied verifier files against settled source. Runtime dependency pins unchanged; paid provider call untested.",
    "check-fixtures.py": "Canonical13-variant/eight-print seed and photographs unchanged and byte-equal in golden/input. Contract19 assertions now validate all13 trusted expected rows plus the gate/address/persistence stock allocation.",
    "check-no-stray-files.py": "Independent51-file ZIP/source equality, one root, valid CRC and shell modes; no reports, fixture, database, cache or node_modules in the shipped task.",
    "check-scoring-policy.py": "Shared60/20/20, zero gates and functional.05 floor unchanged. Verified nested budgets and prior13 scorer fixtures by unchanged-file reuse. New weight/floor-change bounds explicitly disclosed; no model-score prediction.",
    "check-instruction-content.py": "Final human product request exceeds40words, delegates runtime details to/instructions/integration.md and has no draft markers. Public behavior-first map is external and includes all newly graded behaviors.",
    "check-no-cdn-or-remote-assets.py": "Public-network profile still permits off-origin assets generally. This product explicitly requests local/self-contained runtime; its gate observes actual required external dependencies, allows embedded/data/blob and local aliases/ports, and imposes no identical-origin test. This is a documented task-contract distinction.",
    "check-instruction-states-offline-constraint.py": "Public-network setup preserved. Brief/integration explicitly request local delivered assets and no opening/startup installs; required runtime dependencies are supplied. This product-specific requirement is separate from an environment network ban.",
    "check-task-absolute-path.sh": "Public runtime/input references /app/server.js,/app/public/index.html,/app/app.db,/assets/seed_data.json,/assets/prints,/instructions are absolute and implemented; no stale CSV naming.",
    "check-test-file-references.sh": "Required entry/DB/index/seed paths are stated. No source-reading grader requirement or unbriefed endpoint/schema is introduced; installed/shared tool files are verifier-private.",
    "check-runtime-contract-strings.py": "Entry/CWD/port/DB_PATH/health and supplied dependencies agree. Shared-write gate uses observed purchase/lookup routes without inventing names; existing relative-CWD actual harness witness remains valid by byte equality.",
}
for entry in data["deterministic"]:
    if entry["name"] in det_updates:
        entry["output"] = det_updates[entry["name"]]
    entry["note"] = "Documented local/manual equivalent of an unavailable official checker. Executed assertions and reused unchanged-source runtime evidence are identified separately; this is not a platform verdict."

assert len(task["checks"]) == 53 and set(answers) == {c["id"] for c in quality}
assert len(data["deterministic"]) == 48
assert len({x["name"] for x in data["deterministic"]}) == 48
assert {x["name"] for x in data["deterministic"]} == {c["name"] for c in deterministic}
counts = dict(Counter(c["verdict"] for c in task["checks"]))
det_counts = dict(Counter(c["status"] for c in data["deterministic"]))
dump("qc_final_findings.json", data)
dump("independent_review_evidence.json", {
    "scope": "Independent archive/source/evidence binding and exact workbook completeness; not official checker execution or paid judging",
    "passed": True,
    "candidate_sha256": manifest["sha256"],
    "candidate_files": 51,
    "candidate_bytes": manifest["bytes"],
    "crc_source_manifest_modes_match": True,
    "changed_files": changed,
    "unchanged_files": unchanged,
    "quality_inventory": 53,
    "deterministic_inventory": 48,
    "quality_counts": counts,
    "deterministic_counts": det_counts,
    "source_assertions": 80,
    "extracted_source_assertions": 80,
    "revision_assertions": 24,
    "extracted_revision_assertions": 24,
    "contract_assertions": 19,
    "monetary_scenarios": 19,
    "mock_browser_assertions": 6,
    "golden_gate_address_groups": 7,
    "golden_basket_groups": 4,
    "golden_installer_groups": 7,
    "score_analysis": preflight["score_analysis"],
    "paid_oracle_measured": False,
    "target_model_measured": False,
})
print(json.dumps({"quality": counts, "deterministic": det_counts, "changed_files": changed, "hash": manifest["sha256"]}, indent=2))
