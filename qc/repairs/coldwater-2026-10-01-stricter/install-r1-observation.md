# Full delivery installation observation

The frozen R1 candidate (`ae1d6f45959dbff89eb8963973dd7cfd29f634674f246410819317a7a3fc57a0`) was mounted read-only at `/solution` in a fresh `colderwater-agent:postrepair-audit-20260930` container. `drivers/install_smoke.sh` ran the actual `solve.sh`, changed the working directory to `/tmp`, then started `/app/server.js`.

Observed exit: **1**. Node version: **22.23.2**. The startup error was:

```text
/app/node_modules/bindings/bindings.js:135
Error: Could not locate the bindings file.
    at new Database (/app/node_modules/better-sqlite3/lib/database.js:48:64)
    at Server.<anonymous> (/app/server.js:144:22)
```

This is the local Windows build-dependency residue in the frozen task, not a browser-product regression. It shadows the image's working global Linux dependency. The earlier scripted product proofs copied the server and built public assets only; those proofs cannot establish that this full delivery starts. Move the build dependency directory outside the task after the independent round finishes, then repeat this actual installation check on the corrected candidate.

Command actually executed:

```powershell
docker run --rm --name cw-frozen-install-r1 --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/.qc-cache/coldwater-2026-10-01-history-hardening-r1/task/solution,target=/solution,readonly' --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/qc/repairs/coldwater-2026-10-01-stricter/drivers/install_smoke.sh,target=/install_smoke.sh,readonly' --entrypoint bash colderwater-agent:postrepair-audit-20260930 /install_smoke.sh
```

This records an observed installation failure. It is not a configured judge run or a portal result.
