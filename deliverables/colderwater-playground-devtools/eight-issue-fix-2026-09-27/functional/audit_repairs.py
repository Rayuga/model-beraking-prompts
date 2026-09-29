from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tomllib


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
TASK = ROOT / "projects/colderwater-playground-devtools"
JUDGE = TASK / "tests/scored/functional/judge.toml"
PROMPT = TASK / "tests/scored/functional/prompt.md"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def criterion_map(path: Path) -> tuple[dict, dict]:
    document = tomllib.loads(path.read_text(encoding="utf-8"))
    return document, {item["id"]: item for item in document["criterion"]}


before, old = criterion_map(HERE / "before-judge.toml")
after, new = criterion_map(JUDGE)
prompt = PROMPT.read_text(encoding="utf-8")
checks: list[dict] = []


def check(name: str, passed: bool, evidence: object) -> None:
    checks.append({"name": name, "passed": bool(passed), "evidence": evidence})


check("criterion_count", len(after["criterion"]) == 35, len(after["criterion"]))
check("unique_criterion_ids", len(new) == 35, len(new))
check("functional_mass_preserved", sum(c["weight"] for c in new.values()) == sum(c["weight"] for c in old.values()) == 49.5, {"before": sum(c["weight"] for c in old.values()), "after": sum(c["weight"] for c in new.values())})
check("all_binary", all(c["type"] == "binary" for c in new.values()), sorted({c["type"] for c in new.values()}))
check("judge_timeout_preserved", after["judge"]["timeout"] == before["judge"]["timeout"] == 9000, after["judge"]["timeout"])
check("language_split_mass", new["language_dispatch"]["weight"] + new["cw_completed_preview_interactions"]["weight"] == old["language_dispatch"]["weight"] == 2.5, [new["language_dispatch"]["weight"], new["cw_completed_preview_interactions"]["weight"]])
check("budget_split_mass", new["cw_shared_run_deadline_recovery"]["weight"] + new["cw_pending_interaction_budget_nonextension"]["weight"] == old["recovery_persistence_chain"]["weight"] == 2.5, [new["cw_shared_run_deadline_recovery"]["weight"], new["cw_pending_interaction_budget_nonextension"]["weight"]])
check("old_conjunction_removed", "recovery_persistence_chain" not in new, sorted(set(old) - set(new)))
check("language_no_delayed_wait", "six seconds" not in new["language_dispatch"]["description"], "The language check grades filename dispatch, fresh context and CSS copy without delayed-event deadlines.")
check("delayed_interaction_has_own_control", all(s in new["cw_completed_preview_interactions"]["description"] for s in ["completed-interaction-ready", "six seconds", "completed-interaction-click", "completed-interaction-key", "completed-interaction-input"]), "Own complete HTML fixture; delayed real click and key/input outcomes.")
check("loop_checks_post_termination_recovery", "does not require unrelated host controls to respond while the loop is executing" in new["cw_execution_budget_termination"]["description"] and "temporary pause" in new["cw_execution_budget_termination"]["description"], "Timely loop termination, log preservation, preview restoration and actual recovery remain required.")
check("prompt_matches_post_termination_contract", "Do not demand that unrelated host controls respond while a loop is executing" in prompt, "Prompt accepts a temporary pause followed by timely termination and recovery.")
check("autorun_observation_measured_plus_margin", "longest successful auto-run delay" in new["auto_run"]["description"] and "plus one second" in new["auto_run"]["description"] and "wait two seconds" not in new["auto_run"]["description"].lower(), "Observe OFF and cancelled queue longer than the observed deadline, then prove manual Run.")
check("stale_save_requires_real_dirty_editor", all(s in new["persistent_snippets"]["description"] for s in ["two real editor pages", "B must remain open and dirty", "Attempt Save from B's actual dirty UI", "exact unsaved title, filename and source", "deliberately load the latest saved record in B"]), "Request-only evidence cannot demonstrate UI draft retention.")
check("stale_save_allows_proactive_conflict", "Proactive conflict detection" in new["persistent_snippets"]["description"], "A disabled stale Save is accepted only with retained draft, conflict feedback and observed server rejection.")
check("stale_rename_scoped_to_server_state", "Keep any actual unsaved stale-editor draft" not in new["cw_stale_rename_preserves_newer_record"]["description"] and "saved-state invariant" in new["cw_stale_rename_preserves_newer_record"]["description"], "No conditional UI-draft claim is inferred from request replay.")
check("original_budget_own_positive_and_recovery", all(s in new["cw_shared_run_deadline_recovery"]["description"] for s in ["own ordinary .js positive control", "4000", "ORIGINAL Run", "shared-deadline-recovered"]), "No saved-record precondition or delayed interaction is scored in the shared-run check.")
check("interaction_budget_own_positive_and_recovery", all(s in new["cw_pending_interaction_budget_nonextension"]["description"] for s in ["interaction-initial-ready", "6000", "About two seconds later", "interaction-budget-recovered"]), "Own HTML fixture checks pending-work nonextension and rollback independently.")
check("browser_context_recipe_present", "await page.context().browser().newContext()" in prompt and "page.__cwConflictEditor" in prompt, "Actual supported tool recipe preserves both live editors.")
check("incomplete_evaluation_protocol", "EVALUATION_INCOMPLETE:" in prompt and 'score: "no"' in prompt and "graded=0" in prompt, "Tool setup errors after bounded retry invalidate evaluation instead of grading application failure.")

changed = {key: {"before": old[key], "after": value} for key, value in new.items() if key in old and value != old[key]}
added = {key: value for key, value in new.items() if key not in old}
removed = {key: value for key, value in old.items() if key not in new}
unchanged = [key for key, value in new.items() if key in old and value == old[key]]
result = {
    "scope": "Functional source repair invariants only; not a measured hosted judge or Oracle run.",
    "source_sha256": {str(p.relative_to(ROOT)): digest(p) for p in [JUDGE, PROMPT]},
    "baseline_sha256": {p.name: digest(p) for p in [HERE / "before-judge.toml", HERE / "before-prompt.md"]},
    "passed": sum(c["passed"] for c in checks), "failed": sum(not c["passed"] for c in checks), "checks": checks,
    "changed_criteria": changed, "added_criteria": added, "removed_criteria": removed,
    "unchanged_criteria": unchanged,
    "partial_credit_effect": {
        "max_new_functional_weight_from_two_splits": 3.0,
        "max_reward_from_split_partial_credit_alone": 0.6 * 3.0 / 49.5,
        "explanation": "Each formerly all-or-nothing 2.5 group can now retain at most its 1.5 subcheck if the other fails. Total weight and full-pass score are unchanged. This is a bound on split mechanics, not a model-score prediction."
    },
}
(HERE / "repair_invariants.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": result["passed"], "failed": result["failed"], "source_sha256": result["source_sha256"]}, indent=2))
raise SystemExit(1 if result["failed"] else 0)
