# Gambit asset-layout correction

Upload `gambit-hollow-cribbage.zip` from this directory.

The platform reported 43/45 static checks passed. Both failures (`check-assets-referenced.py` and `check-required-files.py`) share one cause: the task referenced `/assets/club/...` but packaged those files under `environment/club/`, without the canonical `environment/assets/` directory. The previous Dockerfile mapped that folder correctly at runtime, but the static asset resolver requires the reference's source layout.

The five club files now live under `environment/assets/club/`. The environment Dockerfile uses `COPY assets/ /assets/`, matching Bazaarbridge. All runtime paths, file contents, instructions, verifiers and golden solution are preserved. No scoring or gameplay requirements were changed.

Validation:

- All five instruction asset references resolve inside the new ZIP at their canonical environment paths.
- Environment and verifier copies of the five assets remain byte-identical.
- Compared the new package against the previous wrapped ZIP: exactly five path relocations and one Dockerfile COPY change, with 37 files total.
- All 124 reference-format checks pass. ZIP CRC, member contents, single task-named wrapper and Unix script permissions are checked by the packager.
- An isolated cached-base Docker smoke build executed the actual `COPY assets/ /assets/` against the current environment build context and verified that all five runtime files exist and are nonempty. Its log is `asset-copy-smoke.log`. This does not constitute a fresh build of the entire task image.
- The platform static checks have not yet been rerun. Previous behavioral evidence still applies to the unchanged app and verifier contents; no new Oracle score is asserted.

Future packaging check: a correct Docker COPY alone is insufficient. For every `/assets/...` reference, assert that `environment/assets/...` exists in the actual ZIP. Require the asset directory explicitly before traversing it, so an empty traversal cannot silently pass the audit. The earlier candidate's packaging checker has been updated with these checks.
