from pathlib import Path
import json,subprocess,sys,hashlib
root=Path(__file__).resolve().parents[6]
snapshot=root/".qc-cache/hireops-2026-10-01-transaction-hardening-r2/task"
out=Path(__file__).parent
cases=[("render_failed",{"render":0,"constraints":1},{"functional":1,"polish":1,"visual":1}), ("constraints_failed",{"render":1,"constraints":0},{"functional":1,"polish":1,"visual":1}), ("both_failed",{"render":0,"constraints":0},{"functional":1,"polish":1,"visual":1}), ("below_floor",{"render":1,"constraints":1},{"functional":0,"polish":1,"visual":1}), ("at_floor",{"render":1,"constraints":1},{"functional":0.05,"polish":1,"visual":1}), ("working_control",{"render":1,"constraints":1},{"functional":0.5,"polish":0.5,"visual":0.5})]
results=[]
for name,gates,scored in cases:
 p=out/name
 (p/"gates").mkdir(parents=True,exist_ok=True);(p/"scored").mkdir(exist_ok=True)
 (p/"gates/reward.json").write_text(json.dumps(gates));(p/"scored/reward.json").write_text(json.dumps(scored))
 cmd=[sys.executable,"-B",str(snapshot/"tests/tools/score.py"),str(p)]
 completed=subprocess.run(cmd,capture_output=True,text=True)
 result=json.loads((p/"reward.json").read_text())
 assert result["reward"] == (0.5 if name=="working_control" else 0.0),(name,result)
 results.append({"case":name,"command":cmd,"exit_code":completed.returncode,"stdout":completed.stdout,"stderr":completed.stderr,"gate_fixture":gates,"scored_fixture":scored,"output":result})
report={"scope":"Synthetic score-aggregator branch execution only. Hand-authored numeric fixture values are NOT application or provider-judge scores.","input_sha256":"7e8adb4257e0b520304b0c4c7b2d16e184c9f951d54e3b3e77345643d59023f0","source_sha256":{str(p.relative_to(root)).replace(chr(92),"/"):hashlib.sha256(p.read_bytes()).hexdigest() for p in [snapshot/"tests/tools/score.py",snapshot/"tests/scoring.toml"]},"results":results}
(out/"aggregator-results.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"scope":report["scope"],"cases":[{"case":x["case"],"reward":x["output"]["reward"],"exit_code":x["exit_code"]} for x in results]}))
