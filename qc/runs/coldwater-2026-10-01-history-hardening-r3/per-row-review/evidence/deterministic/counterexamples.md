# Deterministic counterexample analysis

Source review only; no private deterministic checker, exploit run, provider judge, Oracle, Luna or portal run was performed.

A weak app can satisfy the Render gate by computing a freshly chosen marker/sum in a narrow parser and can satisfy Constraints by saving one record in volatile server memory for an independent browser context. Those two gate checks do not prove full language behavior or restart durability. The scored criteria contain separate browser scenarios for those promises.

A conforming app can serve its library through a server-rendered page instead of a JSON list endpoint. `tests/gates/constraints/judge.toml:27` explicitly accepts that representation, and `tests/scored/functional/prompt.md:5` agrees. We found no deterministic route assumption that rejects this alternative.

The concrete grader bypass is in frozen `task/tests/test.sh:152-175`: a submitted server that ignores SIGTERM can retain port 3000. The helper keeps going after its 5-second wait and accepts health from that old listener as evidence of a new process. `task/tests/tools/restart_mcp.py:23-46` reports the helper's successful exit. This is a source-confirmed failure mode, not an observed exploit run.
