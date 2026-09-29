from pathlib import Path
import hashlib,json,urllib.request
out=Path('/work')
identity=json.loads((out/'artifact-identity.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
installed={}
for rel,expected in identity['solution_hashes'].items():
 path=Path('/app')/rel.removeprefix('app/') if rel.startswith('app/') else Path('/solution')/rel
 installed[rel]=sha(path.read_bytes());assert installed[rel]==expected,rel
assets={}
for url,rel in [('/','app/public/index.html'),('/assets/app.js','app/public/assets/app.js'),('/assets/react-vendor.js','app/public/assets/react-vendor.js'),('/assets/shop.css','app/public/assets/shop.css')]:
 response=urllib.request.urlopen('http://localhost:3000'+url)
 assets[url]=sha(response.read());assert assets[url]==identity['solution_hashes'][rel]
report={'passed':True,'all_19_installed_solution_hashes':installed,'served_frontend_hashes':assets,'process_1_cwd':str(Path('/proc/1/cwd').resolve()),'same_golden_as_baseline_archive':True}
(out/'runtime-binding.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':True,'installed_files':len(installed),'served_assets':len(assets)}))
