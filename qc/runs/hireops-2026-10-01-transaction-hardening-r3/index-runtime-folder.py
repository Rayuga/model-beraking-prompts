"""Index explicitly selected raw runtime folders; never row verdict reports."""
from pathlib import Path
import hashlib,json,sys
RUN=Path(__file__).resolve().parent; ROOT=RUN.parents[2]
index=json.loads((RUN/'raw-evidence-index.json').read_text())
entries={e['path']:e for e in index['entries']}
for arg in sys.argv[1:]:
    number=int(arg)
    for p in (RUN/f'per-row-review/evidence/{number}').rglob('*'):
        if not p.is_file() or p.name in ['hash-verification.json','raw-index-verification.json','artifact-hashes.json']:continue
        rel=p.relative_to(ROOT).as_posix()
        entries[rel]={'path':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
                      'scope':'Raw local runtime/diagnostic or source-binding artifact only. Preserved fixture failures remain evidence. No peer review verdict or configured app grade.'}
index['entries']=list(entries.values())
(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps({'raw_artifacts':len(entries),'selected_folders':sys.argv[1:]}))
