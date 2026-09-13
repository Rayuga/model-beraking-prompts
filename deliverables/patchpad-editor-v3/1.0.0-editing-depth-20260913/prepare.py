from pathlib import Path
import hashlib
import json
root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
old=root/'projects/patchpad-editor-v2'
new=root/'projects/patchpad-editor-v3'
assert not (out/'v2-baseline.json').exists()
hashes={p.relative_to(old).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in old.rglob('*') if p.is_file()}
(out/'v2-baseline.json').write_text(json.dumps(hashes,indent=2)+'\n')
for p in new.rglob('*'):
    if p.is_file() and p.suffix in ('.toml','.md','.sh','.json','.js','.html') or p.is_file() and p.name=='Dockerfile':
        text=p.read_text(encoding='utf-8')
        text=text.replace('patchpad-editor-v2','patchpad-editor-v3')
        if p.name=='prompt.md':
            import re
            text=re.sub(r'(Prompt version: .*?-v1\.0\.0)-r\d+',r'\1-r1',text)
        p.write_text(text,encoding='utf-8',newline='\n')
print('Created independent PatchPad v3; original source baseline recorded')
