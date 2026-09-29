"""Print small witness indexes; never print response bodies or source code."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
paths = sorted((root / 'runtime').rglob('*results.json'))
paths += [root / 'installer/oracle-reinstall-results.json', root / 'restart/logs/scored/local-stub-evidence.json']
for path in paths:
    data = json.loads(path.read_text(encoding='utf-8'))
    print(path.relative_to(root).as_posix())
    if isinstance(data, dict):
        print(' top:', ', '.join(data))
        for key, value in data.items():
            if isinstance(value, list):
                print(' ', key, [item.get('id', item.get('name', item.get('test', '?'))) if isinstance(item, dict) else str(item)[:60] for item in value])
    elif isinstance(data, list):
        print([item.get('id', item.get('name', item.get('test', '?'))) if isinstance(item, dict) else str(item)[:60] for item in data])
