# GridForge 2.0.6 bootstrap tools

The agent image preinstalls curl and coreutils, the tools identified in the
earlier OpenHands bootstrap failure. Agent networking remains public at the
user's request; verifier networking remains separate and allowlisted.

The main product brief no longer describes build-time network availability.
It still asks for locally served resources and the supplied runtime dependencies.
Golden application code, criterion definitions, weights and scoring are unchanged.

This does not resolve the platform review's explicit requirement for no-network
agent builds. Keeping public access requires a platform exception or a change
to that requirement; this release is not claimed to pass that review.
No new paid Oracle or model run is included in this release.

Local validation: 34/34 structural checks passed and the 32-file task-only ZIP
was generated. The source comparison confirms unchanged golden code and
criteria. Image build verification is blocked: apt could not resolve the
configured corporate proxy, so curl installation could not complete locally.
The Dockerfile change is present, but this release is not build-verified.
