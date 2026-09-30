# Colderwater fairness repair drivers

This directory preserves a new driver generation for the task-owned S16 Run-duration, S24 valid-write fallback, and S03 live-handler/Stop-control repairs. It does not edit the task or shared harness. Prior driver generations and reports remain history.

See [driver instructions](drivers/README.md) for the complete golden command, focused variant matrix, exact offline preparation/execution commands, output interpretation and evidence limits. The relevant workbook guidance is quality rows 27, 28, 30 and 38, applied with the workspace review policy's independent-credit and matching-positive-control requirements.

`prepare_golden.py <existing-frozen-run-name>` binds the copied drivers to that frozen task and refuses to overwrite an already-prepared manifest. Runtime logs are created only by real execution; this directory itself makes no passed-browser or provider-score claim.
