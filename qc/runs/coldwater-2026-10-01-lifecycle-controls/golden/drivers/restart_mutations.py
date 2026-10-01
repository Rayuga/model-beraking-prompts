"""Focused startup defects, applied only to the launcher's disposable app copy."""
import hashlib
import json
import re


def mutate(app, case):
    if case not in {"restart-example-duplicates", "restart-record-corruption"}:
        return None
    server = app / "server.js"
    before = server.read_bytes()
    text = before.decode("utf-8")
    anchor = "let db;"
    assert text.count(anchor) == 1
    startup = """
// Local focused mutation: preserve a boot count alongside the disposable DB.
const qcBootPath = databasePath + '.qc-example-boots';
const qcBootCount = (fs.existsSync(qcBootPath) ? Number(fs.readFileSync(qcBootPath, 'utf8')) : 0) + 1;
fs.writeFileSync(qcBootPath, String(qcBootCount));
console.log('QC focused mutation boot ' + qcBootCount);
"""
    text = text.replace(anchor, anchor + startup)
    details = {"case": case, "startup_control": "first boot unchanged; defect active only from second boot"}
    if case == "restart-example-duplicates":
        source = (app / "src/app.tsx").read_text(encoding="utf-8")
        match = re.search(r"const examples = (\[[^\n]+\]);", source)
        assert match, "Reference example array changed; update this focused mutation explicitly"
        examples = json.loads(match[1].replace("'", '"'))
        token = json.dumps(examples, separators=(",", ":"))
        array_pattern = re.compile(r"\[\s*" + r"\s*,\s*".join(re.escape(json.dumps(name)) for name in examples) + r"\s*\]")
        bundles = [(p, array_pattern.findall(p.read_text(encoding="utf-8"))) for p in (app / "public/assets").glob("*.js")]
        bundles = [(p, matches) for p, matches in bundles if matches]
        assert len(bundles) == 1, "Expected exactly one served bundle containing the reference inventory"
        bundle, matches = bundles[0]
        assert len(matches) == 1
        served_token = matches[0]
        route = "/" + bundle.relative_to(app / "public").as_posix()
        anchor = "app.use(express.static(path.join(root, 'public'), { dotfiles: 'deny' }));"
        assert text.count(anchor) == 1
        middleware = f"""
// Preserve every app feature and source file; only the served example array
// grows with each real startup, reproducing duplicate example seeding.
app.get({json.dumps(route)}, (_req, res) => {{
  const script = fs.readFileSync(path.join(root, {json.dumps(bundle.relative_to(app).as_posix())}), 'utf8');
  const repeated = Array.from({{length: qcBootCount}}, () => {token}).flat();
  res.type('application/javascript').send(script.replace({json.dumps(served_token)}, JSON.stringify(repeated)));
}});
"""
        text = text.replace(anchor, middleware + anchor)
        details.update(examples=examples, served_bundle=route, original_served_array=served_token, mutation="repeat built-in array once per actual boot; saved SQL records and handlers unchanged")
    else:
        anchor = "  db = connection;"
        assert text.count(anchor) == 1
        text = text.replace(anchor, "  if (qcBootCount > 1) connection.prepare('DELETE FROM snippets WHERE title = ?').run('QC Restart Primary');\n" + anchor)
        details.update(mutation="remove only pre-restart Primary on second boot; example array and ordinary writes unchanged")
    server.write_text(text, encoding="utf-8", newline="\n")
    details.update(server_sha256_before=hashlib.sha256(before).hexdigest(), server_sha256_after=hashlib.sha256(server.read_bytes()).hexdigest())
    return details
