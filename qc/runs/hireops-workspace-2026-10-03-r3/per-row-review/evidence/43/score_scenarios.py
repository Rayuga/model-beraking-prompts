"""Row 43 evidence: executes the frozen tests/tools/score.py against synthetic suite outputs.
Copies score.py + scoring.toml into a temp tree (score.py reads ../scoring.toml); frozen files are not modified."""
import hashlib, json, shutil, subprocess, sys, tempfile
from pathlib import Path
FROZEN = Path(".qc-cache/hireops-workspace-2026-10-03-r3/task/tests")
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
print("score.py", sha(FROZEN/"tools/score.py")); print("scoring.toml", sha(FROZEN/"scoring.toml"))
S = {
 "gate_render_fail_scored_perfect": ({"render":0.0,"constraints":1.0}, {"functional":1,"polish":1,"visual":1}),
 "gate_constraints_fail": ({"render":1.0,"constraints":0.0}, {"functional":1,"polish":1,"visual":1}),
 "gates_pass_no_scored_yet": ({"render":1.0,"constraints":1.0}, None),
 "gate_only_app_func_1of58.5": ({"render":1,"constraints":1}, {"functional":round(1/58.5,4),"polish":1,"visual":1}),
 "func_at_floor_0.05": ({"render":1,"constraints":1}, {"functional":0.05,"polish":1,"visual":1}),
 "func_3.5of58.5_cheap_rows": ({"render":1,"constraints":1}, {"functional":round(3.5/58.5,4),"polish":0,"visual":1}),
 "golden_like_all_ones": ({"render":1,"constraints":1}, {"functional":1,"polish":1,"visual":1}),
 "missing_gate_dimension": ({"render":1}, None),
}
out={}
for name,(g,s) in S.items():
    with tempfile.TemporaryDirectory() as d:
        d=Path(d); (d/"tools").mkdir(); shutil.copy(FROZEN/"tools/score.py", d/"tools/score.py"); shutil.copy(FROZEN/"scoring.toml", d/"scoring.toml")
        log=d/"log"; (log/"gates").mkdir(parents=True); (log/"gates/reward.json").write_text(json.dumps(g))
        if s is not None: (log/"scored").mkdir(); (log/"scored/reward.json").write_text(json.dumps(s))
        r=subprocess.run([sys.executable, str(d/"tools/score.py"), str(log)],capture_output=True,text=True)
        res=json.loads((log/"reward.json").read_text()) if (log/"reward.json").exists() else None
        out[name]={"exit":r.returncode,"stderr":r.stderr.strip(),"reward_json":res}
        print(name, "exit",r.returncode, res and {k:res[k] for k in ("reward","gates_passed","floors_passed","weighted_score")}, r.stderr.strip())
json.dump(out, open(Path(sys.argv[1])/"score_scenarios_result.json","w"), indent=1)
