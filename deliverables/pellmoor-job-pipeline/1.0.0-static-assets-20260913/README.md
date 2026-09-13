# Pellmoor static asset reference fix

Upload `pellmoor-job-pipeline.zip` from this directory as a new platform version.

Moved the four instruction files from `environment/assets/instructions/` to
`environment/instructions/` and gave each file an explicit Dockerfile COPY to
its `/instructions/` path. This makes the source layout match the paths cited
in instruction.md and exposes each mapping directly to static inspection.
All four files retain their prior contents. Compared with the standard delivery,
the only content change is the environment Dockerfile; the ZIP still has 32 files.

Validation passed: all four source/reference/COPY mappings, all COPY source
existence checks, ZIP CRC and byte equality, TOML parsing, and 123 shared standard
checks. A Docker build using the exact COPY lines and cached Node base also
verified that all four instruction files and both recruitment files exist and
are nonempty at their container destinations. This was a focused COPY check,
not a full dependency build or a run of the platform's 45 static checks.

SHA-256: `80302f8bf05cf6df19be71f5ba0ea568cc6d96aecc39bd73f998f16a70cdb2b5`

Previous delivery ZIPs remain available. Rerun platform QC after uploading.
