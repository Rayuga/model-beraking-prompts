import argparse
import hashlib
import json
import os
from pathlib import Path

LABELS = {
    'legacy_stale_conflict': ('hiring@pellmoor.test', False),
    'legacy_note_success': (None, True),
    'legacy_stage_rejection': ('hiring@pellmoor.test', False),
    'individual_offer_success': ('hiring@pellmoor.test', True),
    'individual_capacity_rejection': ('hiring@pellmoor.test', False),
    'wren_note_success': ('panel2@pellmoor.test', True),
    'batch_ac_success': ('hiring@pellmoor.test', True),
    'batch_cd_lost_success': ('hiring@pellmoor.test', True),
    'batch_ab_capacity_rejection': ('hiring@pellmoor.test', False),
}

ACTORS = {'hiring@pellmoor.test', 'coord@pellmoor.test', 'panel1@pellmoor.test', 'panel2@pellmoor.test'}


def validate(label, record):
    actor, success = LABELS[label]
    required = {'actor', 'method', 'url', 'operation_id', 'request_headers', 'request_body', 'status', 'response_body', 'before', 'after'}
    if not isinstance(record, dict) or not required <= record.keys():
        raise ValueError('Receipt is missing required capture fields')
    if record['actor'] not in ACTORS or (actor is not None and record['actor'] != actor) or record['method'] not in ('POST', 'PUT', 'PATCH', 'DELETE'):
        raise ValueError('Unexpected actor or method')
    if not all(isinstance(record[key], str) and record[key] for key in ('url', 'operation_id', 'request_body', 'response_body')):
        raise ValueError('Keep the actual request/response bodies and operation identity')
    json.loads(record['request_body'])
    json.loads(record['response_body'])
    if not isinstance(record['request_headers'], dict):
        raise ValueError('Preserve observed non-credential request metadata headers')
    status = record['status']
    if type(status) is not int or not (200 <= status < 300 if success else 400 <= status < 500):
        raise ValueError('Receipt status does not match its label')
    if not isinstance(record['before'], dict) or not record['before'] or not isinstance(record['after'], dict) or not record['after']:
        raise ValueError('Full before/after product checkpoints are required')
    if not success and record['before'] != record['after']:
        raise ValueError('A rejection must preserve product state')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, default=Path('/logs/verifier/functional-evidence'))
    actions = parser.add_subparsers(dest='action', required=True)
    put = actions.add_parser('put')
    put.add_argument('label', choices=LABELS)
    put.add_argument('capture', type=Path)
    check = actions.add_parser('check')
    check.add_argument('--scope', choices=('persistence', 'legacy', 'all'), default='persistence')
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    if args.action == 'put':
        record = json.loads(args.capture.read_text())
        validate(args.label, record)
        target = args.directory / (args.label + '.json')
        encoded = (json.dumps(record, sort_keys=True, indent=2) + '\n').encode()
        if target.exists():
            if target.read_bytes() != encoded:
                raise ValueError('An original receipt cannot be replaced by a later operation')
        else:
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'wb') as stream:
                stream.write(encoded)
    missing = []
    saved = {}
    scope = args.scope if args.action == 'check' else 'all'
    labels = [label for label in LABELS if scope == 'all' or label.startswith('legacy_') == (scope == 'legacy')]
    for label in labels:
        path = args.directory / (label + '.json')
        if not path.exists():
            missing.append(label)
            continue
        validate(label, json.loads(path.read_text()))
        saved[label] = hashlib.sha256(path.read_bytes()).hexdigest()
    print(json.dumps({'scope': scope, 'saved': saved, 'missing': missing, 'complete': not missing}))
    if args.action == 'check' and missing:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
