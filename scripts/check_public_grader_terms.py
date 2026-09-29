"""Flag internal grading vocabulary in participant-facing Markdown.

This is a narrow regression guard for the reported 'verifier files' leak,
not proof that prose is natural or that all rubric information is absent.
Do not treat ordinary product words such as score, model or test as leaks.
"""

import argparse
import json
import re
from pathlib import Path

MARKERS = re.compile(r'\b(?:verifiers?|graders?|rubrics?|RewardKit)\b', re.IGNORECASE)


def scan_task(task):
    task = Path(task)
    public_files = [task / 'instruction.md', *sorted((task / 'environment').rglob('*.md'))]
    matches = []
    for source in public_files:
        for number, line in enumerate(source.read_text(encoding='utf-8').splitlines(), 1):
            for match in MARKERS.finditer(line):
                matches.append({'public_file': source.relative_to(task).as_posix(), 'line': number,
                                'term': match.group(), 'text': line.strip()})
    return {'task': task.name, 'scope': 'Local grading-vocabulary regression guard; not complete platform instruction hygiene or a natural-voice judgment.',
            'public_files_scanned': len(public_files), 'matches': matches, 'passed': not matches}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = scan_task(args.task)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
