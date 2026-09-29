"""Check the staged profile's public browser-asset policy.

This is a narrow guard for the previous blanket offline/CDN ban. It does not
prove runtime network behavior or replace semantic review. Restrictions on
network requests made by user-authored sandbox snippets are a separate feature.
"""

import argparse
import json
import re
import tomllib
from pathlib import Path


DISALLOWED = [
    r"a required runtime CDN script, remote font/image",
    r"must not depend on remote assets",
    r"must(?:n't| not) install packages or make external network requests",
    r"Everything it needs to run should be included locally",
    r"\boffline (?:code )?playground\b",
]


def scan_task(task):
    task = Path(task)
    config = tomllib.loads((task / 'task.toml').read_text(encoding='utf-8'))
    integration = (task / 'environment/instructions/integration.md').read_text(encoding='utf-8')
    checks = [
        {'name': 'agent network is public', 'passed': config.get('environment', {}).get('network_mode') == 'public'},
        {'name': 'verifier network is public', 'passed': config.get('verifier', {}).get('environment', {}).get('network_mode') == 'public'},
        {'name': 'integration explicitly allows external browser assets',
         'passed': bool(re.search(r'may load external fonts[^.]*scripts[^.]*CDN assets', ' '.join(integration.split()), re.IGNORECASE))},
    ]
    files = [task / 'instruction.md', task / 'task.toml']
    files += sorted((task / 'environment').rglob('*.md'))
    files += sorted(p for p in (task / 'tests').rglob('*') if p.suffix in {'.md', '.toml'})
    matches = []
    for source in files:
        for number, line in enumerate(source.read_text(encoding='utf-8').splitlines(), 1):
            for pattern in DISALLOWED:
                if re.search(pattern, line, re.IGNORECASE):
                    matches.append({'file': source.relative_to(task).as_posix(), 'line': number, 'text': line.strip()})
                    break
    checks.append({'name': 'known blanket asset bans absent', 'passed': not matches})
    return {'task': task.name, 'scope': __doc__.strip(), 'checks': checks,
            'matches': matches, 'passed': all(item['passed'] for item in checks)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = scan_task(args.task)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
