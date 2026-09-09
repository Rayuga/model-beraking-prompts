# GridForge 2.0.7 offline agent

Agent networking is now no-network. The agent Dockerfile installs curl and
coreutils while building the image, before the offline agent session starts.
Express 5.2.1 remains provided under /opt/gridforge-deps and SQLite comes from
Node's built-in module. The separate verifier keeps its judge API allowlist.

No golden application logic, criteria or scoring weights changed. Release
markers were advanced together. The main product brief does not discuss
build-time network configuration. Previous release archives are retained.

The local image build was attempted again but apt could not resolve the
configured corporate proxy. Consequently, tool installation and a complete
offline Harbor/OpenHands startup are not yet verified. A successful image
build and actual offline agent startup are still required; no new Oracle or
model score is claimed. This report remains outside the task upload ZIP.
