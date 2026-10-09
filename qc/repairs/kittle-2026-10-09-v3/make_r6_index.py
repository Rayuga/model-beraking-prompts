"""Write qc/runs/kittle-2026-10-09-r6/raw-evidence-index.json (run from the worktree root)."""
import glob
import hashlib
import json

h = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
T = 'projects/kittle-matter-chat/'
src = ["solution/app/package.json", "solution/app/public/app.js", "solution/app/public/index.html",
       "solution/app/public/styles.css", "solution/app/public/transcript.css", "solution/app/seed/seed_data.json",
       "solution/app/server.js", "solution/solve.sh", "environment/assets/seed_data.json"]
match = {f: h(T + f) for f in src}
run = 'qc/runs/kittle-2026-10-09-r6'
man = json.load(open(run + '/manifest.json'))
gold_scope = (
    "Scripted golden observations run on 9 October 2026 against the v3 source (commit 69ba916d (v3.1)) in cw-editor-agent-r3 "
    "(app installed by the frozen solve.sh, run as uid 65534 with env -i, DB_PATH and cwd /tmp) and cw-editor-verifier:current "
    "(Playwright/Chromium), with a real process kill and restart on the same database between the before and after phases. "
    "Check names match the 16 functional criteria in order, plus gate_constraints (the constraints gate steps) and polish_enter_sends, "
    "polish_escape_closes, polish_delete_confirm, polish_link_highlight, polish_transcript_phone and polish_refusal_in_place "
    "(the six polish criteria), plus persistence_before (the persistence step c positive controls before the restart). Not a configured judge run, Oracle grade, model score or judge-duration measurement; "
    "render and visual are not covered.")
entries = [{"path": p, "sha256": h(p), "scope": gold_scope, "matching_source_files": match} for p in [
    "qc/repairs/kittle-2026-10-08/run_golden.sh", "qc/repairs/kittle-2026-10-08/tests/functional.cjs",
    "qc/repairs/kittle-2026-10-08/results/golden-run.log", "qc/repairs/kittle-2026-10-08/results/functional-before.json",
    "qc/repairs/kittle-2026-10-08/results/functional-after.json", "qc/repairs/kittle-2026-10-08/results/restart-pids.json"]]
hosted_scope = (
    "Hosted Harbor runs on 9 October 2026 of the PREVIOUS v2 bytes (zip 0c0170a4, source 9766459f), not of this candidate: "
    "Oracle 0.9917 (visual phone_chambers 0.75 for a clipped search placeholder, fixed in v3), nop 0, openhands-sdk/GPT-5.6 0.8114. "
    "Verifier wall time from result.json: Oracle about 63 min, the model about 76 min, for 2 gates + 16 individual functional "
    "criteria (550 s cap each) + batched polish and visual. Indicative of judge workload on the earlier criteria only; v3 adds "
    "legs to five functional criteria and replaces three polish rows, so v3 durations are unmeasured.")
for p in sorted(glob.glob('qc/repairs/kittle-2026-10-09-v3/hosted-v2/*.json')):
    p = p.replace(chr(92), '/')
    entries.append({"path": p, "sha256": h(p), "scope": hosted_scope, "matching_source_files": {}})
idx = {"input_sha256": man["input_sha256"],
       "scope": "Raw observations only. A full configured grading run of this candidate, reward discrimination/ranking on "
                "these bytes and Oracle/target scores for these bytes are absent.",
       "entries": entries}
json.dump(idx, open(run + '/raw-evidence-index.json', 'w'), indent=1)
print(len(entries), man["input_sha256"])
