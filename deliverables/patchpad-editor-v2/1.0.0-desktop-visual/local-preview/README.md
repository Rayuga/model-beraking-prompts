# Current golden preview

Running at http://localhost:3034/ in `patchpad-golden-preview-100-desktop`.
Current golden package version: 1.0.0. Browser startup verified the report,
visible editor, revision 1 and no browser errors; host health endpoint passed.
The container remains running for user inspection.

This uses the cached `patchpad-preflight-tests:2.0.9` dependency image and a
fresh copy of current solution source. It is a local app preview, not a fresh
image build, full verifier execution or oracle grade. No provider calls made.
Preview data is inside the container; source and assets are mounted read-only.
Restarting the container preserves the preview database. The older preview
on port 3033 is separate and was left intact.
