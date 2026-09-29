"""Check public Markdown for literal rubric-ID collisions before packaging.

This local preflight covers the ID-collision behavior reported by the platform's
check-instruction-hygiene.py. It does not replace that checker's other rules.
"""

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path


def scan_task(task):
    task = Path(task)
    criteria = []
    for source in sorted((task / 'tests').rglob('judge.toml')):
        data = tomllib.loads(source.read_text(encoding='utf-8'))
        for criterion in data.get('criterion', []):
            criterion_id = criterion.get('id')
            if not isinstance(criterion_id, str) or not criterion_id.strip():
                raise ValueError(f'Missing or empty criterion ID in {source}')
            criteria.append((criterion_id, source.relative_to(task).as_posix()))
    if not criteria:
        raise ValueError(f'No criteria found under {task / "tests"}')
    public_files = [task / 'instruction.md']
    public_files += sorted((task / 'environment').rglob('*.md'))
    matches = []
    for source in public_files:
        for number, line in enumerate(source.read_text(encoding='utf-8').splitlines(), 1):
            for criterion_id, judge_file in criteria:
                if re.search(r'(?<!\w)' + re.escape(criterion_id) + r'(?!\w)', line, re.IGNORECASE):
                    matches.append({'criterion_id': criterion_id, 'public_file': source.relative_to(task).as_posix(),
                                    'line': number, 'judge_file': judge_file, 'text': line.strip()})
    return {'task': task.name, 'scope': 'Local literal criterion-ID scan, not the complete private platform checker',
            'criteria_scanned': len(criteria), 'public_files_scanned': len(public_files),
            'colliding_ids': sorted({match['criterion_id'] for match in matches}),
            'matches': matches, 'passed': not matches}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        result = scan_task(args.task)
    except (OSError, ValueError, tomllib.TOMLDecodeError) as error:
        print(f'Criterion-ID scan failed: {error}', file=sys.stderr)
        return 2
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in result.items() if key != 'matches'}, indent=2))
    for match in result['matches']:
        print(f"{match['public_file']}:{match['line']}: public text contains criterion ID {match['criterion_id']!r}")
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
