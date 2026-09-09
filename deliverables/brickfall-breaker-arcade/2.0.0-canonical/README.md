# Brickfall naming correction

The updated task now uses the original canonical name brickfall-breaker-arcade
in its project folder, task.toml, package.json, Docker labels, prompt markers
and ZIP wrapper. Its internal version remains 2.0.0 from the separate V2 work.

The accepted original 2.2.1 source was moved to
projects/brickfall-breaker-arcade-v0 without changing its contents. Its internal
identity and all historical accepted ZIPs/runs are preserved for archival
traceability. The archive folder is not the current upload task.

Only identity strings changed from the previously tested V2 package. The
existing twelve browser regression groups and Docker builds apply to the same
gameplay/verifier logic; this name-only export was checked by exact transformed
source comparison, TOML/JSON parsing, LF checks and archive-to-source hashes.
There was no new paid Oracle/model or platform QC run.

Both networks remain public. All 27 criteria, weights and game rules are
unchanged. Previously documented new-rubric policy/scoring conflicts remain;
this rename does not resolve them or establish platform acceptance. See
deliverables/brickfall-breaker-arcade-v2/2.0.0/README.md for that review and local
evidence, treating its former source path and identity as historical.

Use the ZIP in this folder for the updated canonical-name task. It contains
only 30 task files under brickfall-breaker-arcade/, not the v0 source or reports.
