# Coursemark browser recovery repair ? 15 September 2026

Upload **coursemark-assessment-workspace.zip** from this directory.

SHA-256: `06867c037765d1c50bb2fb6e9ebb8748ab164fe4096c187f271ed38d73a3bebb`

The latest uploaded Oracle was 0.7909: Functional 0.9849, Polish 0.0 because of judge timeout, Visual 1.0, Render/Constraints 1.0. This revision repairs browser recovery, process cleanup, evidence batching and the two missing Functional observations. The golden, seed, 66 criterion IDs/weights, operational configuration and timeout values are preserved.

Validation: 45 local application regression groups, 11 transport/process/evidence checks, a reproduced old-wrapper timeout failure, a reproduced hidden-checkbox timing pitfall, actual RewardKit integration with synthetic CLI responses, 145 extracted standard checks and 423 archive checks all passed. The final archive matches current source byte for byte.

Local runtime checks used cached coursemark-tests:1.0.17. Fresh image builds were blocked by PyPI/ Debian mirror access; see build-attempts.json. No new paid Oracle, model run or platform rubric-source QC was performed. Synthetic scores in local runner/integration logs are not model scores.

Run QC and Oracle on this exact ZIP before treating the task as complete. A 1.0 Oracle score is unconfirmed. Detailed findings and all latest model scores: ANALYSIS.md. Supporting files: oracle-evidence.json, criterion-results.csv, package-verification.json, runtime/validation.json, runner-logs/, integration/, exact-release-ui-replay.json and revoked-after-restart-from-blank.json.

The initial archive failed a literal independent-verdict wording check in Visual; its semantics already required every verdict. The wording was made explicit, and the final archive passed. The rejected archive is retained as archive-attempt-1.zip; upload only coursemark-assessment-workspace.zip.
