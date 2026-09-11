from pathlib import Path
import json
out=Path(__file__).resolve().parent
for p in out.glob('patchpad-postrun-*.log'):
    for line in p.read_text(encoding='utf-8').splitlines():
        if line.startswith('{"kind":'):
            r=json.loads(line)
            (out/(p.stem+'-browser.json')).write_text(json.dumps(r,indent=2,ensure_ascii=True)+'\n')
            print(r['kind'], 'diagnostic recorded', 'error' not in r)
