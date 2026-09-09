# Common Ground 1.0.7: QC Work In Progress

Work was interrupted to diagnose GridForge `run-ce624351`. This folder is local
validation evidence, not an upload bundle. No new Common Ground ZIP has been
prepared yet; do not substitute this work for the historical 1.0.6 delivery.

Historical `deliverables/common-ground-ballot/common-ground-ballot-oracle-run.zip`
records Oracle 1.0 in all four sections for version 1.0.6. That is not a score
for the modified 1.0.7 task.

Changes currently saved in `projects/common-ground-ballot`:
- Public network for agent and separate verifier; pinned base images.
- Bounded HTTP readiness requiring a successful health response; timeout headroom,
  strict all-pass gate composition, and bounded process cleanup.
- A trusted restart helper and actual two-restart durability checks.
- Shared authenticated-backend gates in all four dimension prompts.
- Current-session logout and later roster changes explicitly checked.
- Pre-publication anonymous counts deferred until published results are visible;
  removed an incidental JSON-key and receipt-widget assumption.
- Visual hierarchy uses anchored Likert scoring; 28 total criteria remain.
- Mobile golden-app header now retains signed-in name/role and both sign-out
  actions instead of hiding them.

Already completed locally without provider calls:
- Agent and verifier Docker builds succeeded.
- Eleven browser regression groups passed before the final mobile-header edit,
  including two real restarts, session/receipt persistence and exact vote totals.
- Nine runner unit cases passed (explicit RewardKit test double, not Oracle),
  including missing app, HTTP 500, delayed boot, malformed scores and failed gates.

Remaining before upload: rerun the browser checks with the final mobile-header
assertions; update coverage hashes; finish the 53-row QC report and seed/schema
checks; rebuild final test image; package a clean single-folder ZIP. Keep the
root workbook's no-network/allowlist wording as a disclosed policy exception to
the user's explicit public-network requirement, not a claimed literal pass.
Fresh platform QC and Oracle are still needed; no paid run was started.
