# PatchPad: feedback-criterion scope correction

Point 2 of the new platform feedback is corrected in current project source.
The `history_and_feedback_readability` criterion retains readable revision
numbers/timestamps and clear normal-save versus failure feedback. Its extra
blanket colour-independence rule is removed. Coloured indicators with
understandable wording are explicitly acceptable.

Polish prompt revision is now `patchpad-editor-v2-polish-v1.0.0-r2`.
Task version remains 1.0.0. Existing runner provenance logs the changed prompt
and judge hashes. No criteria, weights, golden code, or product requirements
were removed. All 39 criteria and 60/20/20 scoring remain.

Point 1 (requiring separate read APIs while the brief permits server-rendered
data) is still unresolved. Deleting the affected persistence/revision/restart
criteria would leave explicit requirements ungraded and would not remove the
same assumption from all five gates. Recommendation: preserve those checks and
accept the app's actual fresh server responses rather than require JSON GET APIs.

This is an intermediate source correction, not a new upload release. Historical
ZIPs are unchanged. No platform QC, paid run, or new browser run was performed.
