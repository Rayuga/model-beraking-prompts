from pathlib import Path
import hashlib
import json
import re
import tomllib

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / "projects/ridgeline-print-storefront"
OUT = Path(__file__).parent
results = []

def check(name, condition, detail=None):
    results.append({"check": name, "passed": bool(condition), "detail": detail})
    if not condition:
        raise AssertionError(name)

functional = tomllib.loads((TASK / "tests/scored/functional/judge.toml").read_text())
criteria = functional["criterion"]
by_id = {c["id"]: c for c in criteria}
check("21 unique functional criteria", len(criteria) == len(by_id) == 21)
check("all functional checks binary", all(c["type"] == "binary" for c in criteria))
check("functional weight preserved at 35", sum(c["weight"] for c in criteria) == 35)
expected_weights = {
    "ridgeline_catalogue_cards_and_variant_details": .4,
    "ridgeline_catalogue_search_and_filter_membership": .3,
    "ridgeline_catalogue_price_and_title_ordering": .3,
    "ridgeline_unplaced_basket_survives_full_reload": .75,
    "ridgeline_zero_quantity_removal_stays_empty": .75,
    "historical_receipt_uses_charged_prices": 1.25,
    "ridgeline_unknown_reference_does_not_substitute_receipt": .25,
    "ridgeline_incomplete_delivery_address_refuses_atomically": 2,
    "trade_threshold_reversal_and_size_isolation": 1,
    "postage_inclusive_boundaries_and_collection": 1,
}
check("requested split and funding weights", all(by_id[k]["weight"] == v for k, v in expected_weights.items()))
check("static catalogue and lookup share stays below floor", (1 + .25) / 35 < .05)
adversarial = [c for c in criteria if c["id"] in {
    "ridgeline_incomplete_delivery_address_refuses_atomically",
    "authoritative_prices_on_fresh_checkout",
    "combined_quantities_and_invalid_checkout_are_atomic",
    "stale_multiline_checkout_leaves_every_stock_unchanged",
    "checkout_retry_identity_and_new_purchase",
    "cancellation_is_terminal_and_restores_stock_once",
    "simultaneous_last_copy_commits_only_once",
    "last_unit_order_and_fresh_oversell_refusal",
    "restart_preserves_receipts_stock_and_retry_terminality",
}]
check("nine adversarial/replay criteria carry weight 23", len(adversarial) == 9 and sum(c["weight"] for c in adversarial) == 23)

seed = json.loads((TASK / "environment/assets/seed_data.json").read_text())
papers = {"A":"Colorplan Pristine White 270gsm", "B":"Munken Pure Rough 240gsm", "C":"Colorplan Bright White 270gsm"}
reference_rows = []
for line in criteria[0]["description"].splitlines():
    if not line.startswith("RP-"):
        continue
    product, size, paper, regular, stock, threshold, trade = [s.strip() for s in line.split("|")]
    sku, title = product.split(" ", 1)
    reference_rows.append({"sku":sku, "title":title, "size":size, "stock_sheet":papers[paper], "price_pence":int(regular), "in_stock":int(stock), "tier_qty":int(threshold), "tier_price_pence":int(trade)})
expected_rows = []
for row in seed["variants"]:
    expected = {k:row[k] for k in reference_rows[0]}
    if row["sku"] == "RP-105" and row["size"] == "A3":
        expected["in_stock"] -= 1
    expected_rows.append(expected)
check("all 13 trusted variant rows match seed after one gate purchase", reference_rows == expected_rows and len(reference_rows) == 13)

kiln = next(v for v in seed["variants"] if v["sku"] == "RP-105" and v["size"] == "A3")
weight = next(w["grams"] for w in seed["size_weights"] if w["size"] == "A3")
band = next(b for b in sorted(seed["postage_bands"], key=lambda b:b["sort_order"]) if b["up_to_grams"] is None or weight <= b["up_to_grams"])
check("one Kiln address control independently computes 3970 pence", kiln["price_pence"] + band["price_pence"] == 3970)
allocation = {"seed":kiln["in_stock"]}
allocation["after_gate"] = allocation["seed"] - 1
allocation["after_mixed"] = allocation["after_gate"] - 1
allocation["after_address_valid"] = allocation["after_mixed"] - 1
allocation["after_four_refusals"] = allocation["after_address_valid"]
allocation["after_address_followup"] = allocation["after_four_refusals"] - 1
allocation["after_persistence_place_cancel"] = allocation["after_address_followup"]
allocation["after_persistence_placed"] = allocation["after_persistence_place_cancel"] - 1
check("Kiln sequence leaves positive independent restart allocation", list(allocation.values()) == [7,6,5,4,4,3,3,2], allocation)
address = by_id["ridgeline_incomplete_delivery_address_refuses_atomically"]["description"]
check("address criterion has four fresh missing components and new valid followup", all(s in address for s in ["four separate fresh", "recipient name", "address line", "city", "postcode", "reach the server", "S minus one", "separate NEW", "S minus two", "stop further probe orders"]))
check("normal persistence starts at observed three Kiln", "normally three" in by_id["restart_preserves_receipts_stock_and_retry_terminality"]["description"])

public_paths = [TASK / "instruction.md", *sorted((TASK / "environment/instructions").glob("*.md"))]
public_text = "\n".join(p.read_text() for p in public_paths)
all_ids = [c["id"] for file in (TASK / "tests").rglob("judge.toml") for c in tomllib.loads(file.read_text())["criterion"]]
check("all 33 rubric IDs are absent from public prose", len(all_ids) == 33 and not [i for i in all_ids if i in public_text])
check("brief delegates technical launch to integration", "/instructions/integration.md" in public_paths[0].read_text() and "node /app/server.js" not in public_paths[0].read_text())
integration = (TASK / "environment/instructions/integration.md").read_text()
check("integration retains required runtime and stack", all(s in integration for s in ["React", "Node.js", "Express", "SQLite", "NODE_PATH", "node /app/server.js", "0.0.0.0:3000", "/app/public/index.html", "GET /api/health", "/app/app.db", "DB_PATH", "/assets/seed_data.json", "/assets/prints", "external network requests"]))
check("public request anchors server address and unknown lookup", all(s in (TASK / "environment/instructions/checkout-note.md").read_text() for s in ["None can be missing or blank", "server needs to refuse", "without creating an order or taking any stock", "reference doesn't exist"]))
ledger = (OUT / "REQUIREMENT_COVERAGE.md").read_text()
check("requirement-first ledger names every functional criterion", all(c["id"] in ledger for c in criteria))

config = tomllib.loads((TASK / "task.toml").read_text())
template = tomllib.loads((ROOT / "projects/webdev-task-template/task.toml").read_text())
check("frozen verifier environment unchanged from template", config["verifier"]["env"] == template["verifier"]["env"])
check("shared runtime budgets unchanged", config["agent"]["timeout_sec"] == 7200 and config["verifier"]["timeout_sec"] == 13200 and config["environment"]["build_timeout_sec"] == 600)
check("metadata describes the actual criterion totals", all(s in config["metadata"]["difficulty_explanation"] for s in ["Twenty-one", "weight is 35", "nine criteria", "23 of that weight"]))
owned = [*public_paths, TASK / "task.toml", TASK / "tests/scored/functional/judge.toml"]
hashes = {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in owned}
report = {"scope":"Targeted authoring consistency checks, not official platform QC or paid judge execution", "passed":True, "checks":results, "check_count":len(results), "owned_source_hashes":hashes}
(OUT / "contract-checks.json").write_text(json.dumps(report, indent=2)+"\n")
print(json.dumps({"passed":True, "checks":len(results), "criteria":len(criteria), "functional_weight":sum(c["weight"] for c in criteria)}, indent=2))
