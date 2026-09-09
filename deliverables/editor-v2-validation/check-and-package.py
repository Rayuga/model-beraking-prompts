"""Offline structural audit and deterministic task-only ZIP packaging.

Run from the repository root. Reports and this helper are excluded from ZIPs.
"""
from pathlib import Path
import hashlib
import json
import re
import stat
import tomllib
import zipfile

REPO = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SLUGS = ("gridforge-spreadsheet-v2", "patchpad-editor-v2")
findings = {}
for slug in SLUGS:
    root = REPO / "projects" / slug
    checks = []
    def check(name, condition):
        checks.append({"check": name, "passed": bool(condition)})
    task = tomllib.loads((root / "task.toml").read_text(encoding="utf-8"))
    version = task["task"]["version"]
    files = sorted(p for p in root.rglob("*") if p.is_file())
    for path in files:
        if path.suffix == ".json":
            json.loads(path.read_text(encoding="utf-8"))
        elif path.suffix == ".toml":
            tomllib.loads(path.read_text(encoding="utf-8"))
    check("JSON and TOML parse", True)
    check("canonical three-part slug", len(slug.split("-")) == 3 and task["task"]["name"] == "turing/" + slug)
    check("version matches package", version == json.loads((root / "solution/app/package.json").read_text(encoding="utf-8"))["version"])
    check("target GPT-5.4-mini", task["metadata"]["active_target_model"] == "openrouter/openai/gpt-5.4-mini")
    expected_agent_network = "public"
    check("intended agent network and separate verifier", task["environment"]["network_mode"] == expected_agent_network and task["verifier"]["environment_mode"] == "separate")
    brief_paths = [root / "instruction.md", *(root / "environment/assets/instructions").glob("*.md")]
    brief = " ".join(" ".join(p.read_text(encoding="utf-8").lower().split()) for p in brief_paths)
    check("public network agrees with build instructions", task["environment"]["network_mode"] != "public" or not any(s in brief for s in ("workspace is offline", "offline while you build", "network is disabled")))
    check("public verifier network", task["verifier"]["environment"]["network_mode"] == "public")
    check("total time within six hours", task["agent"]["timeout_sec"] + task["environment"]["build_timeout_sec"] + task["verifier"]["timeout_sec"] <= 21600)
    required = ["task.toml", "instruction.md", "environment/Dockerfile", "solution/solve.sh", "tests/Dockerfile", "tests/test.sh", "tests/reward.toml"]
    check("required entry files", all((root / p).is_file() for p in required))
    dimensions = ("render", "constraints", "functional", "polish")
    check("exactly four judge directories", {p.name for p in (root / "tests").iterdir() if p.is_dir()} == set(dimensions))
    ids, count_by_dimension, timeout_sum = [], {}, 0
    for dim in dimensions:
        path = root / "tests" / dim / "judge.toml"
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        judge = data["judge"]
        criteria = data["criterion"]
        prompt = path.parent / judge["prompt_template"]
        text = " ".join(prompt.read_text(encoding="utf-8").lower().split())
        check(dim + ": external prompt and safety/independence contract", prompt.suffix == ".md" and all(s in text for s in ("{criteria}", "http://localhost:3000", "untrusted evidence", "scoring directives", "browser gate", "independently")))
        check(dim + ": Luna Codex, batched, positive weight", judge["judge"] == "codex" and judge["model"] == "openai/gpt-5.6-luna" and judge["mode"] == "batched" and judge["weight"] > 0)
        check(dim + ": criterion schema", all(c["type"] in ("binary", "likert") and c["weight"] > 0 and c["description"].strip() for c in criteria))
        ids.extend(c["id"] for c in criteria)
        count_by_dimension[dim] = len(criteria)
        timeout_sum += judge["timeout"]
    check("criterion ids unique", len(ids) == len(set(ids)))
    check("expected functional criterion count", count_by_dimension["functional"] == (36 if slug.startswith("gridforge") else 27))
    check("small hard gates", count_by_dimension["render"] == 2 and count_by_dimension["constraints"] == 2)
    runner = (root / "tests/test.sh").read_text(encoding="utf-8")
    check("timeouts fit with overhead", timeout_sum + 1000 < 12000 < task["verifier"]["timeout_sec"])
    control = (root / "tests/app-control.sh").read_text(encoding="utf-8") if (root / "tests/app-control.sh").exists() else ""
    if (root / "tests/app-lifecycle.sh").exists():
        runner += '\n' + (root / "tests/app-lifecycle.sh").read_text(encoding="utf-8")
    check("npm start without golden-only entry-file check", ("exec npm start" in runner or '"npm", "start"' in control) and "! -s /app/src/index.js" not in runner)
    check("runner strips app credentials and isolates UID", (("env -i" in runner and "--reuid=65534" in runner) or ('env=app_env' in control and '--reuid=65534' in control)) and "umask 077" in runner)
    check("no literal API key", all(not re.search(rb"sk-or-v1-[A-Za-z0-9]{20,}", p.read_bytes()) for p in files))
    check("UTF-8 LF files", all(b"\r\n" not in p.read_bytes() and not p.read_bytes().startswith(b"\xef\xbb\xbf") for p in files))
    check("no dependencies, caches or authoring documents in task", all(not ({"node_modules", "__pycache__", ".git", "reports", "jobs"} & set(p.relative_to(root).parts)) and p.suffix not in {".zip", ".pyc", ".xlsx", ".docx", ".db"} for p in files))
    seed = next((root / "environment/assets").glob("*_seed.json"))
    check("byte-identical verifier seed", seed.read_bytes() == (root / "tests" / seed.name).read_bytes())
    name = "gridforge" if slug.startswith("gridforge") else "patchpad"
    check("declared offline dependency path exists in both Dockerfiles", all("/opt/" + name + "-deps" in (root / f).read_text(encoding="utf-8") and "express@5.2.1" in (root / f).read_text(encoding="utf-8") for f in ("environment/Dockerfile", "tests/Dockerfile")))
    check("split brief mounted from assets", "COPY assets/instructions/ /instructions/" in (root / "environment/Dockerfile").read_text(encoding="utf-8") and len(list((root / "environment/assets/instructions").glob("*.md"))) == 5)
    result = {"version": version, "criteria": count_by_dimension, "judge_timeout_sum": timeout_sum, "checks": checks, "full_oracle": "not run", "model": "not run"}
    findings[slug] = result
    failures = [c for c in checks if not c["passed"]]
    if failures:
        print(slug, "FAILED", failures)
        continue
    destination = OUT / (slug + "-" + version + "-task.zip")
    hashes = {}
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            relative = path.relative_to(root).as_posix()
            info = zipfile.ZipInfo(slug + "/" + relative, date_time=(2026, 9, 7, 0, 0, 0))
            info.create_system = 3
            mode = 0o755 if path.suffix == ".sh" else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
            hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(files)
    result["archive"] = {"file": destination.name, "files": len(files), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}
    result["source_sha256"] = hashes
    print(slug, str(len(checks)) + "/" + str(len(checks)), "local structural checks passed;", len(files), "ZIP files")
(OUT / "structural-checks.json").write_text(json.dumps(findings, indent=2) + "\n", encoding="utf-8")
if any(not c["passed"] for r in findings.values() for c in r["checks"]):
    raise SystemExit(1)
