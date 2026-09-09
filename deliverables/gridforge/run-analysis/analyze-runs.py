"""Summarize exported runs without executing or modifying submitted apps."""

import json
from pathlib import Path


ROOT = next(p for p in Path(__file__).resolve().parents if (p / "run-outputs").is_dir())
OUT = Path(__file__).parent
runs = []
for path in sorted((ROOT / "run-outputs/gridforge-spreadsheet-v2").glob("*/*/result.json")):
    result = json.loads(path.read_text(encoding="utf-8-sig"))
    agent = result["agent_info"]
    details_path = path.parent / "verifier/reward-details.json"
    details = json.loads(details_path.read_text(encoding="utf-8-sig")) if details_path.exists() else {}
    dimensions = {}
    for name, dimension in details.items():
        criteria = dimension.get("criteria", [])
        dimensions[name] = {
            "score": dimension.get("score"),
            "criteria_count": len(criteria),
            "full_credit_count": sum(c["value"] == 1 for c in criteria),
            "zero_credit_count": sum(c["value"] == 0 for c in criteria),
            "partial_credit_count": sum(0 < c["value"] < 1 for c in criteria),
            "below_full_credit": [c for c in criteria if c["value"] < 1],
        }
    runs.append({
        "agent": agent["name"],
        "model": (agent.get("model_info") or {}).get("name"),
        "trial": result["trial_name"],
        "result_path": path.relative_to(ROOT).as_posix(),
        "task_checksum": result["task_checksum"],
        "started_at": result.get("started_at"),
        "finished_at": result.get("finished_at"),
        "exception": result.get("exception_info"),
        "rewards": result["verifier_result"]["rewards"],
        "dimensions": dimensions,
    })

report = {
    "scope": "Exported run results, judge explanations, current brief and selected submitted source. No fresh browser replay or paid run.",
    "delivery_ready": False,
    "same_task_checksum_for_all_exports": len({r["task_checksum"] for r in runs}) == 1,
    "range_rules": {
        "source": "TASK_AUTHORING_CONTEXT.md:323 and MODEL_BREAKING_TASK_EXECUTION_PROMPT.md",
        "gpt": "0.1 through 0.7 inclusive; internal goal <=0.5",
        "oracle": "Above 0.95 AND every Functional criterion passes; user additionally requested a full 1.0",
        "haiku": "A genuine graded score below 0.7, including zero, is allowed by the recorded exception",
        "gemini": "No separate Gemini band found. 0.6848 is inside the general 0.1-0.7 band, but above the internal <=0.5 goal",
    },
    "verdicts": {
        "oracle": "0.9545: not ready; 34/36 Functional criteria passed, two failed",
        "gpt-5.4-mini": "0.2697: inside formal and internal targets",
        "gemini-3.7-flash": "0.6848: inside general formal band, only 0.0152 below upper bound",
        "claude-haiku-4-5": "0.0268: below general 0.1 lower bound, allowed by Haiku exception; evidence-quality concerns remain",
        "nop": "0.0 with graded=0 and no_op=1: expected negative control",
    },
    "findings": [
        {
            "id": "oracle_edit_commit_navigation", "severity": "P1",
            "criterion": "keyboard_edit_delete_undo",
            "assessment": "Judge reports correct value deletion/undo but wrong Enter and Shift+Tab destinations. Submitted golden formula-bar Enter handler commits and focuses the grid without advancing selection; this supports a real focus-path bug. No fresh UI reproduction in this audit.",
            "next_step": "Reproduce grid-started text entry with real keys, repair golden commit navigation, retain independent delete/undo checks.",
        },
        {
            "id": "oracle_reverse_drag", "severity": "P1",
            "criterion": "shift_click_and_reverse_drag_range_selection",
            "assessment": "Judge reports K36:L37 instead of J35:L37 on reverse drag; Shift-click passed. Endpoint mouse trace is absent, so judge targeting versus app defect is unresolved. Source rerenders the grid during drag, a possible event-handling risk, not a confirmed root cause.",
            "next_step": "Replay exact reverse drag with endpoint coordinates and intermediate steps on golden; keep expected nine-cell range.",
        },
        {
            "id": "gpt_session_schema_assumption", "severity": "P1",
            "criterion": "api_session_user_mismatch_rejected",
            "assessment": "Failure solely cites absence of a separate claimed-user save field. Brief requires valid session-bound attribution, not duplicate user identity in every save. Submitted server extracts sessionId/baseRevisionId/snapshot/kind/message. Missing duplicate userId is not itself an impersonation defect. Missing/invalid session probes still need independent execution.",
            "next_step": "Verify the actual session/identity contract without prescribing redundant payload fields; do not automatically convert this score to pass.",
        },
        {
            "id": "haiku_autosave_short_observation", "severity": "P1",
            "criterion": "autosave_completed_edit",
            "assessment": "Failure reasoning cites 2.5 seconds while the criterion allows five. Insufficient recorded evidence for this timeout-based failure.",
            "next_step": "Observe the full five-second allowance before deciding.",
        },
        {
            "id": "haiku_incomplete_and_mismatched_evidence", "severity": "P1",
            "assessment": "Many Functional failures only say not completed, not an observed independent feature defect. keyboard_edit_delete_undo also cites restoring G3, although the requested restored cell is F3. Overall infrastructure reports completion, but this does not establish that every criterion was exercised correctly.",
            "next_step": "Recheck independent criteria, especially those not attempted. Distinguish cascading app corruption from directly reproduced feature failures.",
        },
        {
            "id": "find_initial_match_convention", "severity": "P2",
            "criterion": "find_replace_navigation_and_atomic_replace_all",
            "assessment": "GPT and Gemini both visit J51 first. The brief asks for familiar find/replace, without specifying whether typing Find first selects J50 automatically. Exact initial Find Next ordering may reject a legitimate live-search convention. GPT additionally lacks Replace Current, so its overall failure has a separate substantive basis.",
            "next_step": "Inspect selection immediately after query entry; test all matches/wraparound and replacement atomicity without accidentally double-advancing.",
        },
        {
            "id": "keyboard_grid_focus_convention", "severity": "P2",
            "criterion": "keyboard_focus_and_grid_entry",
            "assessment": "Gemini fails because Tab/Shift+Tab stays inside the grid, while Functional explicitly requires cell traversal with those keys. Check for a discoverable keyboard exit before declaring a trap; clarify grid-entry versus active cell-navigation modes.",
            "next_step": "Inspect actual keyboard exit behavior. A missing exit can be a real defect; cell navigation alone is not proof of a trap.",
        },
    ],
    "limitations": [
        "Official scores are preserved, not corrected speculatively.",
        "All exports share one checksum; equivalence to current working-tree edits was not asserted.",
        "Reward-details explanations are available but full judge mouse/key trajectories were not found in the exported verifier folders.",
        "Any rubric revision requires fresh evidence on the revised frozen package; old scores do not automatically transfer.",
    ],
    "runs": runs,
}
target = OUT / "gridforge-four-run-review.json"
target.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
print(json.dumps({"report": str(target.relative_to(ROOT)), "runs": len(runs), "delivery_ready": False}))
