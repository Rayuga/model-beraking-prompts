## Application

Colderwater is a local JavaScript/HTML code playground at http://localhost:3000. No sign-in. It has a custom code editor, preview, console and shared saved-snippet library. New drafts can be used for editor probes. Titles identify records by server identity, not by uniqueness of displayed text.

The browser may load public app assets, but user-entered preview code has a separate isolation/network boundary. Grading actions use the public UI, observed application requests and the supplied Playwright/restart tools. A successful rendered gate proves basic editing and execution; a successful constraints gate proves the custom editing surface and independent server readback of one saved record. Later criteria retain independent credit for outcomes they observe. Do not assume an empty library, delete a gate record or use arbitrary source inspection as behavior evidence.

A restored preview after failure may be static. Saved state must be read freshly to distinguish it from browser memory. The functional judge may run compatible editor actions together while assigning results by the criterion's named behavior. If the verifier-owned restart tool is unavailable, distinguish that missing observation from a product failure.
