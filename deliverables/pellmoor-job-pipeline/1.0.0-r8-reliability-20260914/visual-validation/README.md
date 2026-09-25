# Golden batch dialog layout regression

The new uploaded Oracle trial `pellmoor-job-pipeline__sfvtUWB` deducted Visual spacing because the lower batch action area could clip at desktop height. This is a concrete golden UI defect: the footer used a negative sticky bottom offset inside the native dialog's scrollport.

The baseline reproduces the defect with eight additional applicants created through the authenticated application API. At 1280 by 800, the dialog ends at y=784 but the Review selection button ends at y=805, clipping 21 pixels. At 390 by 844 and 320 by 568, the corresponding action button extends 13 pixels beyond the dialog. Six of 18 captured layout views have clipped action areas.

The fix adds a scrollable body around the existing capacity, status and candidate list. The dialog header and action footer keep their space within the viewport; both negative sticky offsets are removed. Scrolling a long candidate list cannot hide the action buttons. All existing controls, events, backend behavior, verifier anchors and scoring remain unchanged.

Changed task files:

- `solution/src/app.ts`: one body wrapper around the existing batch content.
- `solution/public/index.html`: bounded flex layout with a scrolling body and a nonshrinking header/footer.

## Local evidence

- The golden TypeScript app compiled successfully with its existing esbuild command.
- `baseline/measurements.json` records 18 views and six clipping cases.
- `fixed/measurements.json` records the same 18 combinations with zero clipped or occluded action areas and no horizontal page overflow.
- Coverage includes 1280 by 800, 390 by 844 and an additional 320 by 568 size, both themes, selection at the top and bottom of a long list, and a blocked review.
- Real browser actions select an applicant, open the server-generated review, edit selection and close the dialog. Natural focus restoration to the batch opener is asserted after closing.
- No browser page errors were observed. Screenshots for every captured view are alongside the measurements. Desktop light selection, phone dark review and the smaller light review were visually inspected.

The isolated test used cached image `pellmoor-tests:2.0.3`, a read-only source mount and an evidence mount. The setup script copies and compiles the current golden into the temporary container, starts its backend, and shuts it down afterwards. The container is removed after exit. These are local browser regressions, not a new exact-image build or an Oracle score.

Reproduction uses `setup.sh baseline` before the fix and `setup.sh fixed` after it, with `/source` mapped to the task and `/evidence` mapped to this folder. `dialog-layout.cjs` requires a clean temporary app/database provided by `setup.sh`. A final fixed run also verifies natural focus restoration; all 18 views passed.
