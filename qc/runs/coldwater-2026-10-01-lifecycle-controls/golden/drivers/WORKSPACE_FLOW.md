# Workspace flow preparation

`runWorkspaceScenario(id, driver, ledger, inputs, emit, state)` supports S01, S14-S20, S34 and S35. It requires `inputs.freeze_confirmed === true` and `inputs.scenarios[id].protocol`. Optional per-scenario overrides live under `.fixtures`. It emits the compact final evidence keys through `emit(key, observedProductPass, evidence)`; it does not calculate a score or launch a browser.

The seventh argument is a serializable shared object. State under `state.workspace[id]` retains the selected example, shortcut source/documentation and console observations across phases/restart. Successful S16 and S17 execution can publish `state.currentLastGood` with exact fields/body/logs, completed status, observation time and source scenario. S34 reuses an unchanged observed S16 state, otherwise establishing its own ordinary control.

Staged calls match frozen candidate `9bec05c2155f`'s seven-phase plan:

- S01 `inputs.stage='initial'` emits startup/examples only; `'deferred'` saves the recorded edited example and checks separation.
- S16 `'history'` emits duration/history/scroll and preserves the console for S34; `'clear'` performs and emits only ordinary Clear.
- S35 `'initial'` documents bindings and tests Run/Clear; `'deferred'` re-enters the recorded authored source in a new draft and tests Save without another Run.
- Other supported scenarios run once. Omitting `stage` runs the original complete scenario, which the seven-phase launcher should not do for the staged cases.

S17 measures the automatic delay, timestamps real source edits, records full off/cancel windows, and separately clicks manual Run on unchanged source while Auto-run is on. The off-state and queued-source manual controls are retained. S20 may reselect the three lines; if Tab fails, a manually indented source provides independent Shift+Tab evidence. Internal `attempt` records keep later independent observations running after an earlier action failure.

All selectors target the known disposable golden app; this proof driver is not the general evaluator. Source/fixture mappings and actual runtime outcomes require the parent's bound execution. `node --check workspace_flow.cjs` passed during preparation; this module has not been executed against a browser by its author.
