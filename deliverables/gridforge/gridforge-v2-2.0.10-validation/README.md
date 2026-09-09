# GridForge 2.0.10: Agent Bootstrap Fix

Upload `gridforge-spreadsheet-v2.zip` from this directory. It contains one
`gridforge-spreadsheet-v2/` folder with all 32 task files.

`run-ce624351` used OpenHands SDK 1.44.1 and Gemini 3.7 Flash. It failed before
model execution because curl could not load the agent image's missing CA bundle.
It produced neither an agent result nor a verifier result. Its displayed zero
is not an app quality score.

The agent image now installs and updates CA certificates and asserts the bundle
exists during build. A secure GET of the exact failing bootstrap URL returned
HTTP 200 in the new image. No certificate checking was disabled; no installer,
paid model, or Oracle was run for this diagnosis. The remaining bootstrap steps
and platform retry still need the platform run.

All 34 local structural checks passed. The golden implementation, all verifier
criteria, and dependency versions are unchanged from 2.0.9. Only release metadata
and the agent trust-store setup changed. Agent and verifier networking remain
public, and the verifier remains separate. Historical ZIPs and reports are intact.
