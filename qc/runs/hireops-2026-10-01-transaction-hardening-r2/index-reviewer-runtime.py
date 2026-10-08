from pathlib import Path
import hashlib,json
RUN=Path(__file__).resolve().parent;ROOT=RUN.parents[2]
index=json.loads((RUN/'raw-evidence-index.json').read_text());entries={e['path']:e for e in index['entries']}
for n in [15,16,19,21,30,39,40,42,43,44,47,51]:
    base=RUN/f'per-row-review/evidence/{n}'
    for p in base.rglob('*'):
        if not p.is_file() or p.name in ['index-hash-audit.json','artifact-hashes.json']:continue
        rel=p.relative_to(ROOT).as_posix()
        entries[rel]={'path':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'scope':'Raw isolated local runtime observation or diagnostic driver only. Deliberate fixtures/stub rewards are not app judge grades. Review verdicts are excluded.'}
index['entries']=list(entries.values());(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps({'raw_entries':len(entries),'added_runtime_folders':[15,16,19,21,30,39,40,42,43,44,47,51]}))
