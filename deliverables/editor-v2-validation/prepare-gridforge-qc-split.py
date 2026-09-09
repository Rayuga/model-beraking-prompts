"""Print an apply_patch patch; authoring helper, never included in task ZIP."""
from pathlib import Path
import json
import tomllib

path = Path("projects/gridforge-spreadsheet-v2/tests/functional/judge.toml")
source = path.read_text(encoding="utf-8")
old = tomllib.loads(source)
groups = {}
def group(parent, rows):
    groups[parent] = rows

group("workbook_load_status_and_keyboard_basics", [
("custom_grid_surface", .125, "Enter the workbook using the ordinary seeded-user choice if needed. Inspect the live editable grid read-only: it must not be a textarea, contenteditable, one input per cell, or a prohibited third-party spreadsheet/grid/calculation widget. Small controls outside the grid are allowed. Prove it is an editing surface by entering CUSTOM-GRID-PROOF in F2 through real grid keyboard input and committing; require the exact value."),
("workbook_seed_and_status", .125, "Enter the workbook through its normal UI. Require title Northwind Operations Plan, sheet Plan, row numbers, column letters, selected-address status, raw formula/value editor, saved revision and saved/dirty state. Before formula criteria run, select B2, C2 and D2 and require numeric results 3,120,360 and raw D2 exactly =B2*C2. Do not require an immediately visible workbook before choosing a seeded user."),
("keyboard_cell_navigation", .125, "Select B10 through the visible grid. Use real keys and record every selected address: ArrowRight=C10, ArrowDown=C11, ArrowLeft=B11, ArrowUp=B10, Enter=B11, Shift+Enter=B10, Tab=C10, Shift+Tab=B10. Score this navigation behavior independently of grid implementation and other edits."),
("keyboard_edit_delete_undo", .125, "Through the grid, enter DELETE-ME-F3 in F3 and commit with Enter; require F4 selected. Enter KEYBOARD-G3 in G3 and commit with Shift+Tab; require F3 selected. Record F2 unchanged as an outside control. Delete once must blank F3 only. Undo once must restore DELETE-ME-F3 with G3 and F2 unchanged. Establish these values yourself regardless of earlier criterion results.")
])
group("autosave_reload_revision_attribution", [
("autosave_completed_edit", .25, "Use visible UI; select Riley Stone, record current revision R, set F30 to AUTOSAVE-F30 and commit without pressing Save. Require visible Dirty or Saving followed within five seconds by Saved, one new revision R+1 and the exact saved value. This criterion measures autosave only, not history preview or reload."),
("unchanged_save_no_new_revision", .125, "Establish a successful visible changed save of G30=NOOP-BASE-G30, using manual Save if autosave is broken. Wait for Saved. Record current revision and revision-list count. Press visible Save twice without edits if enabled; a disabled Save is acceptable. Require revision and list count unchanged. Do not depend on a previous autosave criterion passing."),
("saved_workbook_restart_and_seed_idempotence", .25, "Establish your own successful visible save: set Q70=RESTART-Q70 and R70 raw formula =7*8, and save. Require displayed R70=56. From actual UI-generated API reads record the complete stored workbook (all raw cells/formulas, workbook and sheet identity), current revision, workbook-list identities/count, and saved revision history; exclude transient presence/session fields. Keep the server-read snapshot, not only browser storage. Invoke the trusted verifier control exactly as bash /tests/restart-app.sh. This stops and starts the same application with the same SQLite file, never clears or reseeds it on the verifier's behalf. Open a fresh browser context without copied storage, choose a seeded user if needed, and observe fresh same-origin reads. Require Q70 and raw/calculated R70 and the complete saved snapshot to remain unchanged, with exactly one seeded workbook and no duplicate revision. Invoke the control once more and repeat the readback to check idempotent startup. Do not edit or save during either restart/readback. Do not execute any other terminal command to repair, reset or modify the app."),
("cell_edit_history_attribution", .125, "Select Riley Stone. Record current raw F31, enter HISTORY-F31 and save through UI. Inspect history for F31: require the previous raw value, exact new HISTORY-F31 value, Riley Stone and a nonempty parseable timestamp. Check this saved edit's entry rather than assuming the cell previously blank. History from another cell does not count."),
("revision_history_listing", .125, "Establish a successful visible save of G31=HISTORY-G31 and record its new revision. Open history. Require its revision number and a parseable timestamp, and unique revision identifiers throughout the returned history list. This scores the revision list, not preview or restore."),
("revision_preview_nonmutation", .125, "Through UI establish your own pair of versions: set F32=PREVIEW-BASE and save, record revision P; change F32 to PREVIEW-CURRENT and save, recording the current complete workbook and revision. Preview P through its visible control. Require preview F32=PREVIEW-BASE while live F32 remains PREVIEW-CURRENT and fresh same-origin reads show the current complete workbook/revision unchanged. Do not restore or save while testing preview."),
("revision_restore_draft_single_undo", .25, "Through UI establish your own pair of saved versions: F33=RESTORE-BASE, then F33=RESTORE-CURRENT. Record both revision ids, the current complete workbook and revision list. Restore the earlier version through its visible control. Require F33=RESTORE-BASE as a Dirty draft and no immediate new saved revision or stored content change. Undo once before saving must restore the whole pre-restore workbook including F33=RESTORE-CURRENT; stored content and revision history remain unchanged. Do not make this criterion depend on preview working."),
("distant_row_saved_integrity", .25, "Using the actual grid scrollbar or mouse wheel, visit rows 14,40,80 and require A14=ANCHOR-TOP, A40=ANCHOR-MIDDLE,A80=ANCHOR-BOTTOM. Set B14=TOP-EDIT-14,B40=MIDDLE-EDIT-40,B80=BOTTOM-EDIT-80,C80=7,D80=8,E80 raw =C80*D80 and require E80=56. Save through normal UI, using manual Save if needed, reload and complete seeded-user entry if shown. Scroll again and require every anchor, raw formula and value at its exact row. Recalculation after changing dependencies is scored by the dedicated formula criteria, not here.")
])
group("formula_errors_and_cycle_recovery", [
("division_by_zero_error", .5, "Use normal visible editing to set H2 raw =10/0. Require a visible division-by-zero or formula error, not Infinity, blank or a normal numeric value. Correct H2 to =10/2 and require 5 without reload; this positive recovery is part of the same error-handling behavior."),
("invalid_formula_recovery", .5, "Use normal visible editing to set H3 raw =SUM(. Require a visible invalid-formula error. Correct H3 to =SUM(2,3) and require 5 without reload; edit I3=OK and require the grid remains usable. Circular-reference behavior is scored only by the dedicated cycle criteria.")
])
group("circular_reference_isolation_and_undo_recovery", [
("scalar_cycle_isolation_single_undo", .5, "Use visible editing: K20=9,J20=5,J21 raw =J20+1; require J21=6. Replace J20 with =J21+1. Require J20 and J21 circular/dependency-loop errors while K20=9 and A14=ANCHOR-TOP remain unchanged. Undo once must restore J20=5 and automatically recalculate J21=6, preserving the outside controls. Do not reload or repair the formula manually."),
("range_cycle_isolation_recovery", .5, "Set J23=1,J24=2,J25=3,J22 raw =SUM(J23:J25) and K22=RANGE-CONTROL through UI; require J22=6. Replace J25 with =J22. Require J22 and J25 circular/dependency-loop errors, J23=1,J24=2 and K22 unchanged. Replace J25 with 4 and require J22=7 and no remaining cycle error without reload. This criterion tests range-based dependency cycles, not the separate scalar Undo test.")
])
group("tsv_csv_range_paste_undo_redo_atomic", [
("tsv_rectangular_import", .5, "Using actual browser clipboard setup, paste once at J2 with Ctrl/Cmd+V exact TSV text TSV-A<TAB>11<TAB>12<NEWLINE>TSV-B<TAB>21<TAB>22<NEWLINE>TSV-C<TAB>31<TAB>32, using real tab/newline characters. Require all nine exact raw values at J2:L4. Do not type the transferred cells manually or dispatch synthetic clipboard events. Undo/Redo is scored separately."),
("paste_single_undo_redo", .5, "Record every raw value at J8:L10 and neighboring I8,M10,J11 through visible UI. Paste exact TSV UNDO-A<TAB>41<TAB>42<NEWLINE>UNDO-B<TAB>51<TAB>52<NEWLINE>UNDO-C<TAB>61<TAB>62 at J8 using real clipboard and shortcut. Require all nine imported values. Undo exactly once must restore the entire pre-paste snapshot; Redo once must restore the entire imported matrix. The three outside controls must remain unchanged. Establish your own paste, not one left by another criterion."),
("csv_rectangular_import", .5, "Put exact CSV text CSV-A,CSV-B<NEWLINE>CSV-C,CSV-D on the real clipboard with an actual newline. Paste once at O2 using normal Ctrl/Cmd+V. Require O2=CSV-A,P2=CSV-B,O3=CSV-C,P3=CSV-D. Do not require TSV, cut or Undo behavior for this CSV criterion."),
("range_copy_preserves_source", .25, "Enter J55=COPY-A,K55=COPY-B,J56=COPY-C,K56=COPY-D through UI. Select J55:K56 with the visible name box, Copy once, select M55 and Paste once through normal shortcuts. Require M55=COPY-A,N55=COPY-B,M56=COPY-C,N56=COPY-D and all four source values unchanged. No manually retyping the destination."),
("range_cut_moves_source", .25, "Independently enter M55=CUT-A,N55=CUT-B,M56=CUT-C,N56=CUT-D through UI; record neighboring L55,O56. Select M55:N56 with the name box, Cut once, select P55 and Paste once using real clipboard shortcuts. Require M55:N56 blank, P55=CUT-A,Q55=CUT-B,P56=CUT-C,Q56=CUT-D and outside controls unchanged. Do not depend on the Copy criterion preparing the source.")
])

criteria = []
mapping = []
for c in old["criterion"]:
    rows = groups.get(c["id"])
    if not rows:
        criteria.append(c)
        continue
    assert sum(x[1] for x in rows) == c["weight"]
    mapping.append((c["id"], c["weight"], [(x[0],x[1]) for x in rows]))
    for name, weight, description in rows:
        criteria.append(dict(id=name,name=name,type="binary",weight=weight,description=description))
assert sum(c["weight"] for c in criteria) == sum(c["weight"] for c in old["criterion"])
prefix = source.split("[[criterion]]",1)[0]
if not prefix.startswith("# Prompt version:"):
    prefix = "# Prompt version: gridforge-spreadsheet-v2-functional-v2.0.2\n" + prefix
rendered = prefix
for c in criteria:
    rendered += "[[criterion]]\n"
    for k in ("id","name","type","weight","description"):
        rendered += k + " = " + json.dumps(c[k],ensure_ascii=False) + "\n"
    rendered += "\n"
rendered += '[scoring]\naggregation = "weighted_mean"\n'
print("*** Begin Patch\n*** Update File: "+path.as_posix()+"\n@@")
for line in source.splitlines(): print("-"+line)
for line in rendered.splitlines(): print("+"+line)
print("*** End Patch")
