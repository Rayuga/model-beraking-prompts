# DropLine asset-reference static-check fix

Upload `dropline-four-connect.zip` from this folder.

SHA-256: `11f5a57a5fff54ea523cc15ed03f477dff3e0ae85f87158d36b43974e6d9c696`.
Exactly one `dropline-four-connect/` wrapper, containing 36 task files.

## Finding and fix

Platform check-assets-referenced.py reported that `/instructions/analysis.md`
did not exist under environment. The prior ZIP actually contains
`environment/assets/instructions/analysis.md`, and the existing Dockerfile
copies that directory to `/instructions/`. The same assets are also copied
to `/assets/`. This is consistent with a static path-resolution limitation,
not a missing instruction file. The exact platform checker source was not
available locally, so its internal resolution behavior is not proven.

Only instruction.md changed: it now refers to
`/assets/instructions/analysis.md` and `/assets/instructions` for the full
contract. These paths directly match the packaged assets and existing Docker
COPY mapping. No instruction content, feature, verifier, weight, task.toml,
Dockerfile, golden solution or lifecycle behavior changed.

## Fresh validation

- All 121 shared-standard checks passed.
- Every explicit /assets reference in the brief resolves under environment/.
- A small local Docker image built successfully using the environment
  Dockerfile's exact two COPY statements and the same Node base image.
- In that image, unprivileged UID 65534 successfully read BOTH the old and
  new analysis paths, and both matched the source SHA-256. Networking was
  disabled for this filesystem-only test. The delivered task still uses
  public networking for both agent and separate verifier.
- All 35 other files are byte-identical to the previous ZIP. The entire
  member list is unchanged; CRC, wrapper and all member/source hashes passed.
- The previous ZIP remains unchanged. No historical reports were overwritten.

See package-verification.json, standard-check.json, asset-copy-build.log and
container-path-check.txt. The test-only AssetPath.Dockerfile and reports are
outside the upload ZIP.

This is NOT a full dependency-install image build, an execution of the actual
platform static checker, a 53-item semantic rubric review or a new Oracle run.
The earlier 27 gameplay/analysis regression groups were not rerun for this
path-only brief edit; their source code and verifiers are byte-identical.
Rerun platform QC on this ZIP. A new Oracle 1.0 is not claimed.
