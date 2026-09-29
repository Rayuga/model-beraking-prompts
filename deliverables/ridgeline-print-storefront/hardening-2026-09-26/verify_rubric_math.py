import json
import tomllib
from pathlib import Path

root = Path(__file__).resolve().parents[3] / "projects" / "ridgeline-print-storefront"
seed = json.loads((root / "environment/assets/seed_data.json").read_text(encoding="utf-8"))
rubric = tomllib.loads((root / "tests/scored/functional/judge.toml").read_text(encoding="utf-8"))
variants = {(v["sku"], v["size"]): v for v in seed["variants"]}
weights = {w["size"]: w["grams"] for w in seed["size_weights"]}
bands = sorted((b for b in seed["postage_bands"] if b["up_to_grams"] > 0), key=lambda b: b["up_to_grams"])

def quote(lines):
    gross = saving = grams = 0
    quantities = {}
    for sku, size, qty in lines:
        quantities[(sku, size)] = quantities.get((sku, size), 0) + qty
    for key, qty in quantities.items():
        variant = variants[key]
        charged = variant["tier_price_pence"] if qty >= variant["tier_qty"] else variant["price_pence"]
        gross += variant["price_pence"] * qty
        saving += (variant["price_pence"] - charged) * qty
        grams += weights[key[1]] * qty
    postage = next((band["price_pence"] for band in bands if grams <= band["up_to_grams"]), 0)
    return {"gross": gross, "saving": saving, "postage": postage, "total": gross - saving + postage, "grams": grams}

cases = [
    ("basket_reload", [("RP-108","A2",2)], (12900,0,320,13220,320)),
    ("night_ferry_below", [("RP-108","A3",4),("RP-108","A2",1)], (23450,0,495,23945,520)),
    ("night_ferry_qualifies", [("RP-108","A3",5),("RP-108","A2",1)], (27700,3125,495,25070,610)),
    ("letter", [("RP-103","A3",1)], (4250,0,175,4425,90)),
    ("exact_500", [("RP-103","A3",2),("RP-101","A2",2)], (19800,0,320,20120,500)),
    ("exact_2000", [("RP-103","A3",8),("RP-101","A2",4),("RP-108","A2",4)], (82400,7300,495,75595,2000)),
    ("over_2000", [("RP-103","A3",9),("RP-101","A2",4),("RP-108","A2",4)], (86650,7925,0,78725,2090)),
    ("historical_current_control", [("RP-101","A3",1)], (3795,0,175,3970,90)),
    ("mixed_trade", [("RP-101","A3",2),("RP-105","A3",1),("RP-106","A3",5)], (32635,3125,495,30005,720)),
    ("price_integrity", [("RP-106","A2",1)], (6450,0,320,6770,160)),
    ("combined_entries", [("RP-103","A3",3),("RP-103","A3",2)], (21250,3125,320,18445,450)),
    ("atomic_competing_order", [("RP-102","A3",8)], (30360,3040,495,27815,720)),
    ("retry_order", [("RP-108","A2",1)], (6450,0,320,6770,160)),
    ("cancel_trade_order", [("RP-108","A3",5)], (21250,3125,320,18445,450)),
    ("race_control", [("RP-104","A3",1)], (3795,0,175,3970,90)),
    ("last_A2", [("RP-104","A2",1)], (5650,0,320,5970,160)),
    ("successive_regular", [("RP-101","A2",2)], (11300,0,320,11620,320)),
    ("successive_trade", [("RP-101","A2",3)], (16950,1725,320,15545,480)),
    ("persistence_control", [("RP-105","A3",1)], (3795,0,175,3970,90)),
]
results = []
for name, lines, expected in cases:
    actual = quote(lines)
    assert tuple(actual.values()) == expected, (name, actual, expected)
    results.append({"scenario": name, "lines": lines, **actual, "passed": True})
assert len(variants) == 13
assert len({v["sku"] for v in seed["variants"]}) == 8
assert len(rubric["criterion"]) == 16
assert len({c["id"] for c in rubric["criterion"]}) == 16
assert sum(c["weight"] for c in rubric["criterion"]) == 35
historical = seed["orders"][0]
assert historical["reference"] == "RP-100001"
assert historical["status"] == "dispatched"
output = {"scenarios_passed": len(results), "criterion_count": 16, "functional_weight": 35, "enforcement_weight": 21, "enforcement_share": 0.6, "results": results}
Path(__file__).with_name("rubric_math_results.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key:value for key,value in output.items() if key != "results"}))