from __future__ import annotations

import hashlib
import json
import re
import shutil
import tomllib
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SLUG = "brickfall-breaker-arcade"
TASK = ROOT / "projects" / SLUG
RUNS = ROOT / "run-outputs" / SLUG
OUT = HERE.parent / "final-submission-20260912"
SOURCE_ZIP = HERE.parent / "1.0.0-coverage-gaps" / f"{SLUG}.zip"
TASK_ZIP_SHA = "e41998a64346e553627ab7ce9263c129c4dcaad66bec8c45aaff71ab887c8c1a"
CHECKSUM = "8c7bf92834e785cb53cc9c3b524c721adf74df7296c25d0049a260e83338bf8a"
TEMPLATES = {
    "eval": Path(r"C:\Users\00518507\Downloads\EVAL-REPORT-drawbill-progress-desk.docx"),
    "case": Path(r"C:\Users\00518507\Downloads\CASE-STUDY-drawbill-progress-desk.docx"),
}
JOBS = {
    "oracle": ("run-68a1687d-379a-4722-8813-84fe4b74ccc6", "4ZZo7QK", "Oracle"),
    "gpt-5.4-mini-high": ("run-fa9adc6b-4e7b-47ba-a8dd-f92a2dda2968", "gWKVQwC", "GPT-5.4 mini (high)"),
    "gemini-3.7-flash": ("run-82ef5e39-356b-40f3-9939-838f81bc04ce", "g7SDSC3", "Gemini 3.7 Flash (high)"),
    "claude-haiku-4.5": ("run-8e4c12dd-0dbb-449a-a3a8-ad70d8758786", "6uqBDww", "Claude Haiku 4.5"),
}
DIMS = ["render", "constraints", "functional", "polish", "visual"]
sha = lambda b: hashlib.sha256(b).hexdigest()
read_json = lambda p: json.loads(p.read_text(encoding="utf-8-sig"))


def tree_hashes(path):
    return {p.relative_to(path).as_posix(): sha(p.read_bytes()) for p in sorted(path.rglob("*")) if p.is_file()}


def load_evidence():
    records = {}
    for key, (job, suffix, label) in JOBS.items():
        trial = RUNS / job / f"{SLUG}__{suffix}"
        result = read_json(trial / "result.json")
        assert result["task_checksum"] == CHECKSUM
        details_path = trial / "verifier/reward-details.json"
        details = read_json(details_path) if details_path.exists() else None
        rewards_path = trial / "verifier/reward.json"
        rewards = read_json(rewards_path) if rewards_path.exists() else None
        if details:
            assert [len(details[d]["criteria"]) for d in DIMS] == [2, 2, 25, 5, 6]
            assert rewards == result["verifier_result"]["rewards"]
            final = 0 if rewards["render"] <= 0 or rewards["constraints"] <= 0 else round(
                .6 * rewards["functional"] + .2 * rewards["polish"] + .2 * rewards["visual"], 4)
            assert final == rewards["reward"]
            provenance = read_json(trial / "verifier/prompt-provenance.json")
            for d in DIMS:
                for kind, ext in [("prompt", "md"), ("judge", "toml")]:
                    assert sha((TASK / f"tests/{d}/{kind}.{ext}").read_bytes()) == provenance["judges"][d][kind + "_sha256"]
            assert sha((TASK / "tests/test.sh").read_bytes()) == provenance["runner_sha256"]
            assert sha((TASK / "tests/reward.toml").read_bytes()) == provenance["reward_config_sha256"]
        records[key] = dict(path=trial, job=job, result=result, rewards=rewards, details=details, label=label)
    assert records["oracle"]["rewards"]["functional"] == 1
    assert all(c["value"] == 1 for c in records["oracle"]["details"]["functional"]["criteria"])
    assert records["claude-haiku-4.5"]["result"]["exception_info"] is None
    assert records["claude-haiku-4.5"]["rewards"]["graded"] == 1
    assert records["claude-haiku-4.5"]["rewards"]["reward"] == .1689
    nop = read_json(RUNS / JOBS["oracle"][0] / f"{SLUG}__ypcGR7m/result.json")
    assert nop["verifier_result"]["rewards"]["no_op"] == 1
    assert nop["verifier_result"]["rewards"]["reward"] == 0
    for p in (TASK / "solution/app").rglob("*"):
        if p.is_file():
            assert p.read_bytes() == (records["oracle"]["path"] / "artifacts/app" / p.relative_to(TASK / "solution/app")).read_bytes()
    return records, nop


SECRET_KEY = re.compile(r"(?:api[_-]?key|api[_-]?token|client[_-]?secret|secret[_-]?key|access[_-]?key)", re.I)
SECRET_LITERAL = re.compile(r"\bsk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{20,}\b")


def discover_secrets(paths):
    secrets = set()
    def walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if SECRET_KEY.search(k) and isinstance(v, str) and len(v) >= 12:
                    if not any(s in v.lower() for s in ["${", "redacted", "placeholder", "your_", "your-", "dummy", "not-set"]):
                        secrets.add(v)
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)
    for p in paths:
        if p.suffix.lower() == ".json":
            try:
                walk(read_json(p))
            except (ValueError, UnicodeError):
                pass
        try:
            secrets.update(SECRET_LITERAL.findall(p.read_text(encoding="utf-8")))
        except UnicodeError:
            pass
    return sorted(secrets, key=len, reverse=True)


def build_job_zips(records):
    paths = [p for job, _, _ in JOBS.values() for p in (RUNS / job).rglob("*") if p.is_file()]
    secrets = discover_secrets(paths)
    audit = {}
    for key, record in records.items():
        source = RUNS / record["job"]
        wrapper = f"{SLUG}-{key}-job-directory"
        archive = OUT / f"{wrapper}.zip"
        expected = {}
        changed = []
        excluded = []
        with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as z:
            for p in sorted(source.rglob("*")):
                if not p.is_file():
                    continue
                rel = p.relative_to(source).as_posix()
                if any(x in {"node_modules", ".git", "__pycache__", ".cache"} for x in p.relative_to(source).parts) or p.name == ".env":
                    excluded.append(rel)
                    continue
                original = p.read_bytes()
                data = original
                try:
                    txt = data.decode("utf-8")
                    for secret in secrets:
                        txt = txt.replace(secret, "[REDACTED_PROVIDER_CREDENTIAL]")
                        escaped = json.dumps(secret)[1:-1]
                        txt = txt.replace(escaped, "[REDACTED_PROVIDER_CREDENTIAL]")
                    data = txt.encode("utf-8")
                except UnicodeError:
                    assert not any(secret.encode() in data for secret in secrets), f"credential found in binary file: {rel}"
                if data != original:
                    changed.append(dict(path=rel, source_sha256=sha(original), packaged_sha256=sha(data)))
                info = zipfile.ZipInfo(wrapper + "/" + rel, (2026, 9, 12, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (0o100755 if p.suffix == ".sh" else 0o100644) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, data)
                expected[info.filename] = sha(data)
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            assert {n: sha(z.read(n)) for n in z.namelist()} == expected
            assert all(n.startswith(wrapper + "/") for n in z.namelist())
            assert all(not any(s.encode() in z.read(n) for s in secrets) for n in z.namelist())
            suffix = JOBS[key][1]
            packaged_result = json.loads(z.read(f"{wrapper}/{SLUG}__{suffix}/result.json"))
            assert packaged_result["verifier_result"] == record["result"]["verifier_result"]
            if record["details"]:
                packaged_details = json.loads(z.read(f"{wrapper}/{SLUG}__{suffix}/verifier/reward-details.json"))
                assert packaged_details == record["details"]
        audit[key] = dict(file=archive.name, file_count=len(expected), sha256=sha(archive.read_bytes()),
                          redacted_files=changed, excluded=excluded, entry_hashes=expected)
    return audit, len(secrets)


NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
DOCREL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ET.register_namespace("w", NS)
ET.register_namespace("r", DOCREL)
def w(tag):
    return "{" + NS + "}" + tag


class Report:
    def __init__(self, title, kind):
        self.title, self.kind = title, kind
        self.root = ET.Element(w("document"))
        self.body = ET.SubElement(self.root, w("body"))
        self.plain = []

    def paragraph(self, text, style=None, size=None, bold=False, color=None, parent=None):
        p = ET.SubElement(parent if parent is not None else self.body, w("p"))
        pr = ET.SubElement(p, w("pPr"))
        if style:
            ET.SubElement(pr, w("pStyle"), {w("val"): style})
        ET.SubElement(pr, w("spacing"), {w("after"): "95", w("line"): "250", w("lineRule"): "auto"})
        if style and ("Heading" in style or style == "Title"):
            ET.SubElement(pr, w("keepNext"))
        run = ET.SubElement(p, w("r"))
        rp = ET.SubElement(run, w("rPr"))
        if size:
            ET.SubElement(rp, w("sz"), {w("val"): str(size)})
        if bold:
            ET.SubElement(rp, w("b"))
        if color:
            ET.SubElement(rp, w("color"), {w("val"): color})
        for i, chunk in enumerate(str(text).split("\n")):
            if i:
                ET.SubElement(run, w("br"))
            t = ET.SubElement(run, w("t"), {"{http://www.w3.org/XML/1998/namespace}space": "preserve"})
            t.text = chunk
        self.plain.append(str(text))
        return p

    def heading(self, text, level=1):
        self.paragraph(text, f"Heading{level}")

    def bullet(self, text):
        self.paragraph(text, "ListBullet")

    def page_break(self):
        p = ET.SubElement(self.body, w("p"))
        ET.SubElement(ET.SubElement(p, w("r")), w("br"), {w("type"): "page"})

    def table(self, headers, rows, widths=None, size=17):
        widths = widths or [10440 // len(headers)] * len(headers)
        tbl = ET.SubElement(self.body, w("tbl"))
        props = ET.SubElement(tbl, w("tblPr"))
        ET.SubElement(props, w("tblW"), {w("w"): "10440", w("type"): "dxa"})
        ET.SubElement(props, w("tblLayout"), {w("type"): "fixed"})
        margins = ET.SubElement(props, w("tblCellMar"))
        for side in ["top", "bottom", "left", "right"]:
            ET.SubElement(margins, w(side), {w("w"): "70", w("type"): "dxa"})
        borders = ET.SubElement(props, w("tblBorders"))
        for side in ["top", "left", "bottom", "right", "insideH", "insideV"]:
            ET.SubElement(borders, w(side), {w("val"): "single", w("sz"): "4", w("color"): "D8E2EE"})
        grid = ET.SubElement(tbl, w("tblGrid"))
        for width in widths:
            ET.SubElement(grid, w("gridCol"), {w("w"): str(width)})
        for ri, row in enumerate([headers] + list(rows)):
            tr = ET.SubElement(tbl, w("tr"))
            trpr = ET.SubElement(tr, w("trPr"))
            ET.SubElement(trpr, w("cantSplit"))
            if ri == 0:
                ET.SubElement(trpr, w("tblHeader"))
            for ci, value in enumerate(row):
                tc = ET.SubElement(tr, w("tc"))
                tcp = ET.SubElement(tc, w("tcPr"))
                ET.SubElement(tcp, w("tcW"), {w("w"): str(widths[ci]), w("type"): "dxa"})
                ET.SubElement(tcp, w("vAlign"), {w("val"): "center"})
                if ri == 0 or ri % 2 == 0:
                    ET.SubElement(tcp, w("shd"), {w("fill"): "17365D" if ri == 0 else "F2F6FA"})
                self.paragraph(value, size=size, bold=ri == 0, color="FFFFFF" if ri == 0 else "1D2733", parent=tc)
        self.paragraph("")

    def save(self, path):
        section = ET.SubElement(self.body, w("sectPr"))
        ET.SubElement(section, w("pgSz"), {w("w"): "12240", w("h"): "15840"})
        ET.SubElement(section, w("pgMar"), {w("top"): "850", w("right"): "900", w("bottom"): "850", w("left"): "900", w("header"): "400", w("footer"): "400", w("gutter"): "0"})
        doc = ET.tostring(self.root, encoding="utf-8", xml_declaration=True)
        with zipfile.ZipFile(TEMPLATES[self.kind]) as source:
            parts = {n: source.read(n) for n in ["word/styles.xml", "word/numbering.xml", "word/fontTable.xml", "word/theme/theme1.xml"]}
        styles = ET.fromstring(parts["word/styles.xml"])
        styles.attrib.pop("{http://schemas.openxmlformats.org/markup-compatibility/2006}Ignorable", None)
        normal = styles.find(f"{w('style')}[@{w('styleId')}='Normal']")
        if normal is not None:
            rp = normal.find(w("rPr"))
            if rp is None:
                rp = ET.SubElement(normal, w("rPr"))
            for key, attrs in [("sz", {w("val"): "20"}), ("rFonts", {w("ascii"): "Calibri", w("hAnsi"): "Calibri"})]:
                e = rp.find(w(key))
                if e is None:
                    e = ET.SubElement(rp, w(key))
                e.attrib.update(attrs)
        parts["word/styles.xml"] = ET.tostring(styles, encoding="utf-8", xml_declaration=True)
        parts["word/document.xml"] = doc
        settings = ET.Element(w("settings"))
        ET.SubElement(settings, w("defaultTabStop"), {w("val"): "720"})
        parts["word/settings.xml"] = ET.tostring(settings, encoding="utf-8", xml_declaration=True)
        rels = ET.Element("Relationships", xmlns=REL)
        for i, (typ, target) in enumerate([("styles", "styles.xml"), ("numbering", "numbering.xml"), ("fontTable", "fontTable.xml"), ("theme", "theme/theme1.xml"), ("settings", "settings.xml")], 1):
            ET.SubElement(rels, "Relationship", Id=f"rId{i}", Type=DOCREL + "/" + typ, Target=target)
        parts["word/_rels/document.xml.rels"] = ET.tostring(rels, encoding="utf-8", xml_declaration=True)
        package_rels = ET.Element("Relationships", xmlns=REL)
        ET.SubElement(package_rels, "Relationship", Id="rId1", Type=DOCREL + "/officeDocument", Target="word/document.xml")
        ET.SubElement(package_rels, "Relationship", Id="rId2", Type=REL + "/metadata/core-properties", Target="docProps/core.xml")
        parts["_rels/.rels"] = ET.tostring(package_rels, encoding="utf-8", xml_declaration=True)
        core = ET.Element("{http://schemas.openxmlformats.org/package/2006/metadata/core-properties}coreProperties")
        ET.SubElement(core, "{http://purl.org/dc/elements/1.1/}title").text = self.title
        ET.SubElement(core, "{http://purl.org/dc/elements/1.1/}creator").text = "Brickfall task delivery"
        ET.SubElement(core, "{http://purl.org/dc/elements/1.1/}description").text = "Recorded platform run results; prepared 12 September 2026. Completed Oracle, GPT-mini, Gemini and Haiku exports."
        parts["docProps/core.xml"] = ET.tostring(core, encoding="utf-8", xml_declaration=True)
        types = ET.Element("Types", xmlns="http://schemas.openxmlformats.org/package/2006/content-types")
        ET.SubElement(types, "Default", Extension="rels", ContentType="application/vnd.openxmlformats-package.relationships+xml")
        ET.SubElement(types, "Default", Extension="xml", ContentType="application/xml")
        for name, suffix in [("word/document.xml", "wordprocessingml.document.main+xml"), ("word/styles.xml", "wordprocessingml.styles+xml"), ("word/numbering.xml", "wordprocessingml.numbering+xml"), ("word/settings.xml", "wordprocessingml.settings+xml"), ("word/fontTable.xml", "wordprocessingml.fontTable+xml"), ("word/theme/theme1.xml", "theme+xml")]:
            ET.SubElement(types, "Override", PartName="/" + name, ContentType="application/vnd.openxmlformats-officedocument." + suffix)
        ET.SubElement(types, "Override", PartName="/docProps/core.xml", ContentType="application/vnd.openxmlformats-package.core-properties+xml")
        parts["[Content_Types].xml"] = ET.tostring(types, encoding="utf-8", xml_declaration=True)
        with zipfile.ZipFile(path, "x", zipfile.ZIP_DEFLATED) as z:
            for name, data in parts.items():
                z.writestr(name, data)
        (HERE / (path.stem + ".txt")).write_text("\n".join(self.plain), encoding="utf-8")
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            for n in z.namelist():
                if n.endswith((".xml", ".rels")):
                    ET.fromstring(z.read(n))
            text = " ".join(t.text or "" for t in ET.fromstring(z.read("word/document.xml")).iter(w("t")))
            assert "DrawBill" not in text and "drawbill" not in text
            assert "0.9583" in text and "0.6094" in text and "0.1689" in text
            assert "Fairness Assessment" not in text


def fmt(x):
    return "Not run" if x is None else f"{x:.4f}"


def score_table(report, records):
    rows = []
    for key in ["oracle", "gpt-5.4-mini-high", "gemini-3.7-flash", "claude-haiku-4.5"]:
        r = records[key]
        scores = r["rewards"]
        if scores:
            count = sum(c['value'] == 1 for c in r['details']['functional']['criteria'])
            status = f"{count}/25 Functional"
            if key == "gemini-3.7-flash":
                status += "; gate-zero"
            rows.append([r["label"], fmt(scores["reward"])] + [fmt(scores[d]) for d in DIMS] + [status])
        else:
            rows.append([r["label"], "Not scored"] + ["Not run"] * 5 + ["Startup timeout; replacement pending"])
    rows.append(["No-op control", "0.0000", "0", "0", "0", "0", "0", "graded=0; no_op=1"])
    report.table(["Run", "Overall", "Render", "Constr.", "Func.", "Polish", "Visual", "Recorded status"], rows,
                 [1880, 850, 820, 820, 820, 820, 820, 3610], size=16)


def intro(report, subtitle):
    report.paragraph(report.title, "Title")
    report.paragraph(subtitle, color="52657A")
    report.paragraph("Harbor task: turing/brickfall-breaker-arcade | version 1.0.0 | prepared 12 September 2026", size=18)
    report.paragraph("Scope: recorded run outcomes and task description. This document is not an independent fairness assessment or complete QC sign-off. The completed Haiku replacement is included alongside Oracle, GPT-mini and Gemini.", size=18)


def build_eval(records, nop):
    report = Report("Brickfall Breaker Arcade - Evaluation Report", "eval")
    intro(report, "Harbor Web Development Task | Golden Oracle and model-run results")
    report.heading("Headline")
    report.paragraph("The golden Oracle scored 0.9583 overall and passed all 25 Functional criteria, plus every Render, Constraints and Polish criterion. Its remaining deductions were Visual. GPT-5.4 mini scored 0.6094; Claude Haiku 4.5 scored 0.1689 with both gates passed; Gemini 3.7 Flash recorded a Constraints-gated 0.0000. The empty-submission control scored 0.0000.")
    report.heading("Title and description")
    report.paragraph("Brickfall is a full-stack, deterministic brick-breaker arcade game with authenticated player profiles, ten seeded levels, power-ups, resumable SQLite-backed games, personal run records, a global leaderboard and a non-scoring mechanics lab. The short product brief is expanded by eight supplied specification files, a workbook and deterministic scenario data.")
    report.paragraph("The delivered app uses vanilla HTML/CSS/JavaScript and canvas, Node.js, Express and SQLite. The runtime entry is node /app/server.js on port 3000, serving /app/public/index.html and persisting /app/brickfall.db. Both agent and separate verifier networking are public. The packaged runtime brief nevertheless requires local assets and no runtime installation; this report describes the package as supplied.")
    report.paragraph("Five batched browser judge dimensions contain 40 criteria: Render 2, Constraints 2, Functional 25, Polish 5 and Visual 6. The judge is Codex with gpt-5.6-luna, temperature 0 and configured reasoning effort max. Render and Constraints are prerequisites; the final runner writes the gated score below.")
    report.paragraph("if Render <= 0 or Constraints <= 0: Overall = 0\notherwise: Overall = 0.6 x Functional + 0.2 x Polish + 0.2 x Visual", size=19)
    report.heading("Overall scores")
    score_table(report, records)
    report.paragraph("Binary counts are not equivalent to weighted scores. GPT-mini and Gemini each received 9/25 Functional passes, but their earned criterion weights differ; Haiku received 2/25. Visual uses 1-5 ratings normalized by the installed runner: raw 4 becomes 0.75, while raw 5 becomes 1.00. No-op dimension zeros are control outputs, not 40 independently graded failures.")
    report.heading("Reward arithmetic")
    report.table(["Run", "Functional weight earned", "Final calculation"], [
        ["Oracle", "34.5 / 34.5 = 1.0000", "0.6 x 1 + 0.2 x 1 + 0.2 x 0.7917 = 0.9583"],
        ["GPT-5.4 mini", "13 / 34.5 = 0.3768", "0.6 x 0.3768 + 0.2 x 1 + 0.2 x 0.9167 = 0.6094"],
        ["Gemini 3.7 Flash", "13.75 / 34.5 = 0.3986", "Constraints = 0; final reward = 0.0000"],
        ["Claude Haiku 4.5", "3 / 34.5 = 0.0870", "0.6 x 0.0870 + 0.2 x 0 + 0.2 x 0.5833 = 0.1689"],
    ], [1950, 2350, 6140])
    report.heading("Features and subfeatures")
    features = [
        ("Sign-in and server authority", "Three seeded profiles; issued bearer tokens; account-wide revocation; protected reads; account isolation; forged client identity handling."),
        ("Seed and manifest", "Ten exact workbook walls, brick-type totals, constants, level names, speed limits and SHA-256 digests; Mira/Dev checkpoints and Polly history."),
        ("Ranked gameplay and progression", "Fixed-step physics, paddle input, launch/pause/restart, Assist takeover, level progression, extra lives, terminal results and upward best-score persistence."),
        ("Deterministic mechanics lab", "Brick types, Power relay, Multiball, Sticky catch, Last ball, Extra life and Final wall; visible simulation-step counter; practice leaves ranked state unchanged."),
        ("Persistence and coordination", "Complete saved runs and terminal snapshots; refresh durability; expected revisions; stale-tab reconciliation; operation receipts and duplicate activation handling."),
        ("Interface and presentation", "Keyboard/pointer/touch use, readable semantic state, visible feedback, reduced motion and six graded visual axes including the mobile layout."),
    ]
    report.table(["Area", "Coverage"], features, [2700, 7740])
    report.heading("Dimension / session scores")
    report.table(["Dimension", "Criteria", "Budget", "Role", "Oracle", "GPT-mini", "Gemini", "Haiku"], [
        [d.title(), str(len(records["oracle"]["details"][d]["criteria"])), str(records["oracle"]["details"][d]["judge"]["timeout"]) + " s", "Gate" if d in ["render", "constraints"] else {"functional": "60%", "polish": "20%", "visual": "20%"}[d]] + [fmt(records[k]["rewards"][d]) for k in ["oracle", "gpt-5.4-mini-high", "gemini-3.7-flash", "claude-haiku-4.5"]] for d in DIMS
    ], [1750, 850, 1150, 950, 1430, 1430, 1430, 1450])
    report.page_break()
    report.heading("All verifiers - recorded results")
    report.paragraph("Entries below reproduce the exported verdicts, not a fresh regrade. Binary criteria show Pass/Fail; Visual entries show the raw five-point rating. All four evaluated applications have 40 exported criteria. A shared gate can assign Fail without independently exercising each affected criterion.")
    for d in DIMS:
        report.heading(d.title(), 2)
        data = []
        for i, criterion in enumerate(records["oracle"]["details"][d]["criteria"]):
            row = [criterion["id"].replace("_", " "), str(criterion["weight"])]
            for key in ["oracle", "gpt-5.4-mini-high", "gemini-3.7-flash", "claude-haiku-4.5"]:
                c = records[key]["details"][d]["criteria"][i]
                assert c["id"] == criterion["id"]
                row.append(str(c["raw"]) + "/5" if d == "visual" else "Pass" if c["value"] == 1 else "Fail")
            data.append(row)
        report.table(["Criterion (underscores shown as spaces)", "Weight", "Oracle", "GPT-mini", "Gemini", "Haiku"], data, [4800, 800, 1210, 1210, 1210, 1210])
    report.heading("Oracle - remaining Visual deductions")
    for c in records["oracle"]["details"]["visual"]["criteria"]:
        report.paragraph(f"{c['id']} - {c['raw']}/5: {c['reasoning']}", size=19)
    report.paragraph("The exported Oracle contains all 40 criteria; no dimension or Functional criterion is missing. All 34 binary criteria passed, while five Visual ratings were 4/5 and responsive consistency was 5/5. An overall score of 1.0000 is not claimed.")
    report.page_break()
    report.heading("Failed verifiers - exported judge reasoning")
    report.paragraph("These are the judge's recorded explanations. They are retained as evidence and are not presented as an independent certification of every causal interpretation.")
    for key in ["gpt-5.4-mini-high", "gemini-3.7-flash", "claude-haiku-4.5"]:
        report.heading(records[key]["label"], 2)
        for d in ["constraints", "functional", "polish"]:
            failures = [c for c in records[key]["details"][d]["criteria"] if c["value"] == 0]
            if failures:
                report.heading(f"{d.title()} - {len(failures)} recorded failures", 3)
                report.table(["Criterion", "Recorded judge explanation"], [(c["id"].replace("_", " "), c["reasoning"]) for c in failures], [3700, 6740])
    report.heading("Haiku - latest completed run and comparison")
    report.paragraph("The final Haiku archive contains run-8e4c12dd-0dbb-449a-a3a8-ad70d8758786 / brickfall-breaker-arcade__6uqBDww, completed without a trial exception. It scored 0.1689 with graded=1 and no_op=0. Both gates passed; Functional was 0.0870 (2/25), Polish 0.0000 and Visual 0.5833. This latest completed run replaces run-05fd6dc8 / gJZNsAw in the final submission. The prior completed export and delivery files are preserved separately; it also scored 0.1689. The earlier run-35ea2a7d environment-start timeout is not treated as a model score.")
    report.paragraph("The two completed Haiku runs have identical dimension totals but different applications and criterion verdicts. Sign-in/token basics changes from Fail to Pass; the initial leaderboard changes from Pass to Fail. Forged-client-identity handling passes in both. Visual color changes from 5/5 to 4/5 while spacing changes from 3/5 to 4/5, leaving the Visual average unchanged. Selection is the latest completed run, not the lowest score.")
    report.heading("Latest Haiku - source corroboration and caveats", 2)
    for text in [
        "Checkpoint-dependent failures share a root gap: exported db.js seeds users, levels, bricks, drills and histories, but does not import the scenario checkpoints into runs. The judge observed activeRun=null for Mira and Dev. These missing prerequisites cascade through several terminal/progression criteria; 23 Functional failures do not mean 23 independent root bugs.",
        "Mechanics Lab controls are present in this run, unlike the earlier run. However, client.js has no handler for the Advance button, updateLabTelemetry hardcodes score/lives/combo to '-', and the database advanceDrill routine returns placeholder state without simulation. This supports the judge's blank telemetry and zero-step observations.",
        "The leaderboard guest insert omits run_id although the table declares it NOT NULL; INSERT OR IGNORE silently skips these records. The brick query uses the unquoted reserved alias drop. Isolated in-memory SQLite probes reproduce the skipped insert and query syntax error, consistent with the judge's four-row leaderboard and HTTP 500 brick requests. These probes are not a full local app/browser rerun.",
        "The combined session-security criterion failed despite the judge confirming distinct tokens, account-wide logout rejecting tab-B access, and unchanged Polly data. Its remaining reasons are Dev's missing checkpoint and stale resume state. This is a bundled/dependent failure, not evidence that logout revocation failed. The report retains the recorded score and does not assign a substitute grade.",
        "This review corroborates the main Haiku defects but does not independently reproduce every browser action or certify every judge interpretation. Two completed Haiku totals agreeing at 0.1689 do not guarantee future scores or platform acceptance. No new paid run or platform QC was performed.",
    ]:
        report.bullet(text)
    report.heading("Run timing and reported agent usage")
    rows = []
    for key, record in records.items():
        r = record["result"]
        duration = (datetime.fromisoformat(r["finished_at"].replace("Z", "+00:00")) - datetime.fromisoformat(r["started_at"].replace("Z", "+00:00"))).total_seconds()
        ar = r.get("agent_result") or {}
        rows.append([record["label"], f"{duration / 60:.1f} min", f"{ar['n_input_tokens']:,}" if ar.get("n_input_tokens") is not None else "Not reported", f"{ar['n_output_tokens']:,}" if ar.get("n_output_tokens") is not None else "Not reported", f"${ar['cost_usd']:.4f}" if ar.get("cost_usd") is not None else "Not reported"])
    report.table(["Run", "Trial wall time", "Input tokens", "Output tokens", "Agent cost"], rows, [2850, 1700, 2050, 1900, 1940])
    report.paragraph("Costs are the agent_result values in the exports, not a full bill including verifier charges. Trial times include setup and verification. Export timestamps are 11 September UTC (the run series spans early 12 September IST).")
    report.heading("Grading integrity and provenance")
    for text in [
        "All five included trials, including the completed Haiku and no-op, identify the same uploaded task checksum. Oracle, GPT, Gemini and Haiku each export all five dimensions and 40 criteria; graded=1 and no_op=0 are present.",
        "All ten prompt/judge file hashes plus runner and reward-configuration hashes match current source for the judged trials. Oracle's package.json, server.js and public/index.html also match the current golden solution byte-for-byte.",
        "The task ZIP contains 32 source-matching files beneath exactly one brickfall-breaker-arcade/ wrapper. No task source, verifier definition or recorded score was changed during this submission preparation.",
        "The Oracle job archive includes its original no-op sibling. Run archives preserve original job/trial structure and verdict evidence; provider credentials, if encountered, are redacted only in delivery copies. Original exports remain unchanged.",
        "No new paid Oracle/model run, browser regrade or platform QC pass is claimed by this report. Two completed Haiku trials are available and both scored 0.1689; the latest is included. Oracle, GPT-mini and Gemini each have one selected measured trial. This is not a statistical repeatability study.",
    ]:
        report.bullet(text)
    report.paragraph("Uploaded task checksum: " + CHECKSUM, size=16)
    report.paragraph("Task ZIP SHA-256: " + TASK_ZIP_SHA, size=16)
    report.heading("Delivery contents and source index")
    for name in expected_names():
        report.bullet(name)
    for key, record in records.items():
        report.paragraph(f"{record['label']}: {record['job']} / {record['result']['trial_name']}", size=16)
    report.paragraph("Evidence is under each job archive's original trial directory: result.json; verifier/reward.json; verifier/reward-details.json; verifier/prompt-provenance.json; test output; and available app/agent artifacts. The Haiku archive contains its completed replacement run. JSON files are authoritative for recorded scores.")
    report.heading("Current standing")
    report.paragraph("Oracle Functional is 1.0000, and its overall 0.9583 is above 0.95. GPT-5.4 mini's recorded 0.6094 lies within the repository's documented 0.1-0.7 keeper band. Haiku's completed score is 0.1689. Gemini's 0.0000 is a gate-zero result, not an independent measure of all its product behavior. All requested run exports are now included. This is a results handoff, not a declaration that every platform requirement has been independently certified.")
    report.save(OUT / f"EVAL-REPORT-{SLUG}.docx")


def build_case(records):
    report = Report("Case Study - Brickfall Breaker Arcade", "case")
    intro(report, "A canvas arcade game whose difficulty lies in physics, durable state and coordinated writes")
    report.paragraph("Recorded scores: Oracle 0.9583 | GPT-5.4 mini 0.6094 | Haiku 4.5 0.1689 | Gemini 3.7 Flash 0.0000 (gate)", bold=True)
    report.heading("1. What the task is")
    report.paragraph("Build a complete web-based brick-breaker from an empty /app. The game should feel responsive immediately and remain correct through seeded checkpoints, a full run, refreshes and concurrent tabs. A convincing canvas alone is insufficient: player identity, game state and results must persist in SQLite.")
    for text in [
        "Three seeded players - Mira, Dev and Polly - with distinct profiles, checkpoints and history. The demo password is password123.",
        "Ten workbook-defined levels with normal, strong and solid bricks; fixed 120 Hz simulation; controlled launch/pause/restart; pointer, keyboard, touch and optional Assist.",
        "Power-ups, combo scoring, extra-life thresholds and terminal bonuses must agree with deterministic fixtures and ordinary gameplay.",
        "Every state-changing server operation uses an expected revision and unpredictable operation id. Retries return the original receipt; stale tabs reconcile without silently overwriting the winner.",
        "A non-scoring mechanics lab exposes seven deterministic drills and a visible engine-step counter. Practice must leave ranked saves, best scores, history and leaderboard unchanged.",
        "Eight supplied instruction files plus workbook/scenario assets define the contract. The agent budget is 7,200 seconds; the separate verifier budget is 13,200 seconds. Both environments use public networking.",
    ]:
        report.bullet(text)
    report.heading("2. What is verified")
    report.paragraph("Codex / gpt-5.6-luna evaluates the live application using Playwright MCP. The task has 40 criteria in five batched dimensions: 2 Render, 2 Constraints, 25 Functional, 5 Polish and 6 Visual. Functional has 34.5 total criterion weight; the final reward is 60% Functional, 20% Polish and 20% Visual after the Render/Constraints prerequisites.")
    report.table(["Area", "Examples of graded observations"], [
        ["Server-backed identity", "Rejected wrong password; issued bearer credentials; protected reads; account revocation and token-owned state despite client identity claims."],
        ["Exact state transitions", "Mira/Dev seeded checkpoint outcomes; level progression and terminal records; rising best score retained after reload."],
        ["Mechanics", "Exact drill counters and events; speed/collision handling; multiball, sticky capture, life loss and solid bricks not blocking completion."],
        ["Consistency", "Saved-state restoration, retry receipts, stale revisions, distinct operation ids and duplicate-activation suppression."],
        ["Usability and appearance", "Semantic HUD/event feedback, keyboard and touch behavior, reduced motion; typography, contrast, layout, hierarchy, craft and mobile consistency."],
    ], [2800, 7640])
    report.heading("3. Where each run landed")
    score_table(report, records)
    report.heading("Oracle - 0.9583; Functional 1.0000", 2)
    report.paragraph("The current golden solution passed every one of the 25 Functional criteria. Render, Constraints and Polish also scored 1.0. All 40 criteria are present in the export; no Functional session was omitted. This includes the added checks for higher best-score persistence, forged identity and completing a level with an intact solid brick.")
    report.paragraph("Visual was 0.7917: five axes received 4/5 and mobile consistency received 5/5. The judge described small/dense telemetry, minor muted contrast and lower-page empty space. These are the only recorded Oracle deductions; this run is not an overall 1.0000.")
    report.heading("GPT-5.4 mini, high reasoning - 0.6094", 2)
    report.paragraph("The model built an application that cleared both prerequisites and scored 1.0 Polish and 0.9167 Visual. Functional was 0.3768: 9/25 binary criteria passed, earning 13 of 34.5 weight. Its recorded overall score falls inside the documented 0.1-0.7 keeper band.")
    report.paragraph("The judge reported a non-finite canvas-gradient error when resuming seeded checkpoints, preventing the terminal/progression journey from completing. Several lab checks observed one or two steps where the required outcomes called for 120 or 240. Other deductions involved manifest digest visibility, complete history snapshots and coordination/security evidence. The evaluation report reproduces the full criterion-level verdicts and explanations.")
    report.heading("Gemini 3.7 Flash, high reasoning - recorded gate-zero", 2)
    report.paragraph("Render scored 1.0, Functional 0.3986 (9/25), Polish 0.2 and Visual 0.9583. Constraints was 0.0, so the final runner wrote 0.0000. The Constraints judge reported that successful sign-in automatically issued a Start request, and stopped at its non-mutating gate rule. These are the recorded outcomes; the zero is not described as 40 independently demonstrated product failures.")
    report.paragraph("The Functional and Polish explanations repeatedly report createDrillState is not defined during Load Drill. Inspection of the exported source found both physics.js and drills.js declaring the same top-level CONSTANTS in classic browser scripts; a local combined-script syntax check reports the duplicate declaration. The judge also reported that Next Level reset score/lives rather than preserving progression. The run achieved strong Visual ratings despite those recorded functional gaps.")
    report.heading("Claude Haiku 4.5 - completed at 0.1689", 2)
    report.paragraph("The latest run-8e4c12dd / 6uqBDww completed without a trial exception and cleared both gates. Functional was 0.0870: 2/25 criteria passed, earning 3 of 34.5 weight. Polish was 0.0000 and Visual was 0.5833, giving an overall 0.1689. The previous completed run-05fd6dc8 also scored 0.1689 but had different criterion outcomes; its export and prior delivery remain preserved. The latest run is selected, not the earlier startup-timeout attempt.")
    report.paragraph("Sign-in/token basics and forged-client-identity handling passed. The judge found missing Mira/Dev checkpoints, only four leaderboard rows and failed brick-data requests. Lab Load/Advance controls exist, but telemetry stays blank and the counter stays zero. Exported source corroborates the omissions: no checkpoint import, guest inserts missing a required run_id, an invalid unquoted SQL alias, unwired Advance controls and a placeholder advance routine. These prevent the exact checkpoint, terminal and drill journeys from being demonstrated.")
    report.paragraph("Important interpretation limit: missing checkpoints cause several dependent failures. The combined session criterion also failed although the judge confirmed distinct tokens and successful account-wide revocation; its remaining objections were missing Dev state and stale resume UI. Do not count each failed criterion as a separate defect or call this a proven logout failure. Source/isolated SQLite checks corroborate the main gaps; this was not a new full browser regrade.")
    report.heading("No-op control - 0.0000", 2)
    report.paragraph("The Oracle job contains a separate empty-submission control. It scored 0.0000 with graded=0 and no_op=1, distinct from an application that was built and received criterion grades.")
    report.heading("4. What the observed results show")
    report.paragraph("The strongest concrete result is the separation between the golden implementation and GPT-mini on exact Functional behavior: 25/25 versus 9/25, while both received full Polish credit. Their overall gap is 0.3489. This illustrates why the task checks deterministic state and persistence alongside presentation instead of relying solely on an attractive canvas.")
    report.paragraph("Gemini and GPT each passed nine Functional criteria but earned different weighted scores. Gemini's overall was then gated to zero, so these results do not support a simple product-quality ranking based only on their final totals. Haiku's replacement adds a lower measured result at 0.1689, with both gates passed and two Functional passes.")
    report.heading("5. Delivery status and evidence")
    for text in [
        "The reports summarize the supplied platform exports; preparation did not change the task, golden solution, criteria, weights or scores and did not launch a paid run.",
        "The completed exports share one uploaded task checksum. Current verifier file hashes and golden source match the Oracle evidence; the task ZIP has 32 source-matching files in one correct wrapper.",
        "Oracle Functional is complete at 1.0000. Overall Oracle is 0.9583, not 1.0000. GPT-mini is 0.6094 and the completed Haiku replacement is 0.1689. All requested exports are included.",
        "Two completed Haiku trials share the 0.1689 total with different criterion outcomes; the latest is delivered. One selected trial is reported for each other evaluated model. This is not a repeatability study, complete QC sign-off or blanket fairness certification.",
    ]:
        report.bullet(text)
    report.paragraph("Task ZIP SHA-256: " + TASK_ZIP_SHA, size=16)
    report.paragraph("The companion EVAL-REPORT-brickfall-breaker-arcade.docx contains all 40 recorded verifier results, exported failure explanations, score arithmetic and the source/run index. Four named job-directory ZIPs preserve Oracle/no-op, GPT-mini, Gemini and the completed Haiku replacement.")
    report.save(OUT / f"CASE-STUDY-{SLUG}.docx")


def expected_names():
    return sorted([f"{SLUG}.zip", f"EVAL-REPORT-{SLUG}.docx", f"CASE-STUDY-{SLUG}.docx"] + [f"{SLUG}-{k}-job-directory.zip" for k in JOBS])


def main():
    assert not OUT.exists(), "Refuse to overwrite an existing delivery folder."
    assert sha(SOURCE_ZIP.read_bytes()) == TASK_ZIP_SHA
    task_before = tree_hashes(TASK)
    runs_before = tree_hashes(RUNS)
    templates_before = {k: sha(p.read_bytes()) for k, p in TEMPLATES.items()}
    cfg = tomllib.loads((TASK / "task.toml").read_text())
    assert cfg["task"]["version"] == "1.0.0"
    assert cfg["environment"]["network_mode"] == cfg["verifier"]["environment"]["network_mode"] == "public"
    with zipfile.ZipFile(SOURCE_ZIP) as z:
        assert len(z.namelist()) == 32 and z.testzip() is None
        assert {n.split("/", 1)[1]: sha(z.read(n)) for n in z.namelist()} == task_before
    records, nop = load_evidence()
    OUT.mkdir()
    shutil.copy2(SOURCE_ZIP, OUT / SOURCE_ZIP.name)
    jobs, secret_count = build_job_zips(records)
    build_eval(records, nop)
    build_case(records)
    assert sorted(p.name for p in OUT.iterdir()) == expected_names()
    assert tree_hashes(TASK) == task_before
    assert tree_hashes(RUNS) == runs_before
    assert {k: sha(p.read_bytes()) for k, p in TEMPLATES.items()} == templates_before
    summary = {
        "prepared_at": datetime.now(timezone.utc).isoformat(),
        "delivery": str(OUT), "task_version": cfg["task"]["version"],
        "uploaded_task_checksum": CHECKSUM, "task_zip_sha256": TASK_ZIP_SHA,
        "task_source_unchanged": True, "original_run_exports_unchanged": True,
        "reference_documents_unchanged": True, "report_scope": "recorded outcomes, not full QC/fairness clearance",
        "haiku_status": "Completed replacement run; reward 0.1689; Functional 0.0870 (2/25)",
        "agent_network": "public", "verifier_network": "public",
        "reference_document_hashes": templates_before, "files": tree_hashes(OUT),
        "provider_credential_values_redacted": secret_count,
        "job_archives": jobs, "source_hashes": task_before,
        "recorded_scores": {k: r["rewards"] for k, r in records.items()},
        "checks": {"all_32_task_files_match_source": True, "oracle_golden_source_matches": True,
                   "all_12_verifier_hashes_match_per_graded_trial": True, "oracle_functional_25_of_25": True,
                   "scores_recomputed": True, "single_wrapper_per_zip": True, "zip_crc": True,
                   "docx_xml_well_formed": True, "no_reference_project_text_in_report_bodies": True,
                   "exact_seven_delivery_filenames": True},
        "not_performed": ["new platform QC", "paid Oracle/model run", "fresh browser regrade"],
    }
    (HERE / "package-audit.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: summary[k] for k in ["delivery", "files", "provider_credential_values_redacted", "haiku_status", "checks"]}, indent=2))


if __name__ == "__main__":
    main()
