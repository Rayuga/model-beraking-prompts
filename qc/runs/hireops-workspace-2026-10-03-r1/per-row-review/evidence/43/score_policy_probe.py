# Copies frozen tests/tools/score.py + tests/scoring.toml into a temp tree and feeds synthetic RewardKit outputs.
import json, shutil, subprocess, sys, tempfile, pathlib
SRC = pathlib.Path(sys.argv[1])  # frozen task/tests
def run(gates, scored):
    t = pathlib.Path(tempfile.mkdtemp()); (t/"tools").mkdir()
    shutil.copy(SRC/"tools/score.py", t/"tools/score.py"); shutil.copy(SRC/"scoring.toml", t/"scoring.toml")
    log = t/"log"; (log/"gates").mkdir(parents=True)
    (log/"gates/reward.json").write_text(json.dumps(gates))
    if scored is not None:
        (log/"scored").mkdir(); (log/"scored/reward.json").write_text(json.dumps(scored))
    p = subprocess.run([sys.executable, str(t/"tools/score.py"), str(log)], capture_output=True, text=True)
    r = json.loads((log/"reward.json").read_text()) if (log/"reward.json").exists() else None
    return p.returncode, (log/"reward.txt").read_text().strip() if (log/"reward.txt").exists() else None, r and {k: r[k] for k in ("reward","gates_passed","floors_passed","weighted_score")}
full = {"functional":1.0,"polish":1.0,"visual":1.0}
cases = {
 "gates pass, all perfect": ({"render":1,"constraints":1}, full),
 "render gate fail, perfect scored present": ({"render":0,"constraints":1}, full),
 "constraints gate fail, perfect scored present": ({"render":1,"constraints":0}, full),
 "gates pass, scored missing (timeout)": ({"render":1,"constraints":1}, None),
 "gates pass, functional 0.05 exactly, polish/visual 1": ({"render":1,"constraints":1}, {"functional":0.05,"polish":1,"visual":1}),
 "gates pass, functional 0.0513 (3/58.5), polish/visual 1": ({"render":1,"constraints":1}, {"functional":3/58.5,"polish":1,"visual":1}),
 "gates pass, functional 0, polish/visual 1": ({"render":1,"constraints":1}, {"functional":0,"polish":1,"visual":1}),
 "gates missing key": ({"render":1}, full),
}
for name,(g,s) in cases.items(): print(f"{name}: {run(g,s)}")
