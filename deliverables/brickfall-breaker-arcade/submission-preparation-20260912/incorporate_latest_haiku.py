import json
import re
import shutil
import sqlite3

from build_submission import (
    HERE, OUT, TASK, RUNS, JOBS, SLUG, DIMS, CHECKSUM, TEMPLATES,
    sha, tree_hashes, read_json, load_evidence, build_job_zips,
    build_eval, build_case, expected_names,
)


def review_haiku(records):
    latest = records['claude-haiku-4.5']
    prior_path = RUNS / 'run-05fd6dc8-b477-4dae-8b8c-90b06fef2667' / f'{SLUG}__gJZNsAw'
    prior_result = read_json(prior_path / 'result.json')
    prior_details = read_json(prior_path / 'verifier/reward-details.json')
    assert prior_result['exception_info'] is None
    assert prior_result['task_checksum'] == latest['result']['task_checksum'] == CHECKSUM
    assert prior_result['verifier_result']['rewards'] == latest['rewards']
    assert read_json(prior_path / 'verifier/prompt-provenance.json') == read_json(latest['path'] / 'verifier/prompt-provenance.json')
    changes = []
    for dim in DIMS:
        for old, new in zip(prior_details[dim]['criteria'], latest['details'][dim]['criteria'], strict=True):
            assert old['id'] == new['id'] and old['weight'] == new['weight']
            if old['value'] != new['value']:
                changes.append({'dimension': dim, 'id': new['id'], 'old_value': old['value'],
                                'new_value': new['value'], 'old_raw': old['raw'], 'new_raw': new['raw']})
    assert {c['id'] for c in changes if c['dimension'] == 'functional'} == {
        'seeded_sign_in_and_token_basics', 'initial_global_leaderboard_core'}
    functional = latest['details']['functional']['criteria']
    assert sum(c['value'] == 1 for c in functional) == 2
    assert sum(c['weight'] * c['value'] for c in functional) == 3
    assert sum(c['weight'] for c in functional) == 34.5
    assert round(3 / 34.5, 4) == latest['rewards']['functional']

    app = latest['path'] / 'artifacts/app'
    db_source = (app / 'db.js').read_text(encoding='utf-8')
    client = (app / 'public/js/client.js').read_text(encoding='utf-8')
    html = (app / 'public/index.html').read_text(encoding='utf-8')
    seed = db_source.split('function seedDatabase() {', 1)[1].split('function hashPassword(', 1)[0]
    assert 'INTO runs ' not in seed and 'checkpoint' not in seed.lower()
    assert 'id="lab-advance-btn"' in html and 'lab-advance-btn' not in client
    assert "document.getElementById('lab-score').textContent = '-'" in client
    assert "document.getElementById('lab-lives').textContent = '-'" in client
    assert 'For now, return placeholder' in db_source
    assert tree_hashes(app) != tree_hashes(prior_path / 'artifacts/app')

    # Read only exported SQL; execute it against a disposable in-memory database.
    con = sqlite3.connect(':memory:')
    for table in ['leaderboard', 'bricks']:
        create_sql = re.search(r'CREATE TABLE IF NOT EXISTS ' + table + r' \([\s\S]*?\n      \)', db_source).group()
        con.execute(create_sql)
    guest_sql = re.search(r"'(INSERT OR IGNORE INTO leaderboard \(initials, score, level, achieved_at\)[^']+)'", seed).group(1)
    con.execute(guest_sql, ('ZZZ', 100, 1, '2026-09-12'))
    assert con.execute('SELECT COUNT(*) FROM leaderboard').fetchone()[0] == 0
    brick_sql = re.search(r"'(SELECT row, column, type, drop_type as drop FROM bricks[^']+)'", db_source).group(1)
    try:
        con.execute(brick_sql, (1,))
    except sqlite3.OperationalError as error:
        sql_error = str(error)
        assert 'syntax error' in sql_error
    else:
        raise AssertionError('Expected the exported unquoted drop alias to fail')
    con.execute(brick_sql.replace('as drop FROM', 'as "drop" FROM'), (1,))
    con.close()
    return {
        'latest_job': latest['job'], 'latest_trial': latest['result']['trial_name'],
        'previous_job': prior_path.parent.name, 'previous_trial': prior_result['trial_name'],
        'completed_without_trial_exception': True, 'graded': 1, 'no_op': 0,
        'task_checksum': CHECKSUM, 'all_12_current_verifier_hashes_match': True,
        'same_recorded_dimension_totals_as_prior': True, 'scores': latest['rewards'],
        'criterion_score_changes': changes,
        'functional_passes': [c['id'] for c in functional if c['value'] == 1],
        'functional_weight_earned': 3, 'functional_weight_total': 34.5,
        'source_corroboration': {
            'checkpoint_seed_import_missing': True, 'lab_advance_button_unwired': True,
            'lab_telemetry_hardcoded_blank': True, 'server_lab_advance_placeholder': True,
        },
        'isolated_sqlite_probes': {
            'sqlite_version': sqlite3.sqlite_version,
            'exported_guest_insert_ignored_due_to_missing_required_run_id': True,
            'exported_brick_query_error': sql_error, 'quoted_alias_control_succeeds': True,
        },
        'caveats': [
            'Checkpoint failures cascade: 23 Functional criterion failures are not 23 independent root bugs.',
            'The combined session criterion failed although recorded token separation and account-wide logout checks passed; missing Dev checkpoint and stale resume UI remain.',
            'Latest and prior Haiku totals match but criterion outcomes and implementations differ.',
            'No full browser rerun or independent reproduction of every verdict; no new paid runs or platform QC.',
        ],
    }


def main():
    audit_path = HERE / 'package-audit.json'
    audit = read_json(audit_path)
    assert tree_hashes(OUT) == audit['files']
    task_before, runs_before = tree_hashes(TASK), tree_hashes(RUNS)
    templates_before = {k: sha(p.read_bytes()) for k, p in TEMPLATES.items()}
    records, nop = load_evidence()
    review = review_haiku(records)

    backup = HERE / 'haiku-05fd6dc8-delivery-backup'
    assert backup.resolve().parent == HERE.resolve() and not backup.exists()
    backup.mkdir()
    for name in ['package-audit.json', 'word-validation.json',
                 f'EVAL-REPORT-{SLUG}.txt', f'CASE-STUDY-{SLUG}.txt']:
        source = HERE / name
        assert source.resolve().parent == HERE.resolve()
        shutil.copy2(source, backup / name)
    names = [f'{SLUG}-claude-haiku-4.5-job-directory.zip',
             f'CASE-STUDY-{SLUG}.docx', f'EVAL-REPORT-{SLUG}.docx']
    for name in names:
        source, target = OUT / name, backup / name
        assert source.resolve().parent == OUT.resolve() and target.resolve().parent == backup.resolve()
        assert sha(source.read_bytes()) == audit['files'][name]
        shutil.move(str(source), str(target))
    for stem in [f'CASE-STUDY-{SLUG}', f'EVAL-REPORT-{SLUG}']:
        source, target = HERE / (stem + '.pdf'), backup / (stem + '.pdf')
        assert source.resolve().parent == HERE.resolve() and target.resolve().parent == backup.resolve()
        shutil.move(str(source), str(target))

    jobs, secret_count = build_job_zips({'claude-haiku-4.5': records['claude-haiku-4.5']})
    build_eval(records, nop)
    build_case(records)
    assert sorted(p.name for p in OUT.iterdir()) == expected_names()
    assert tree_hashes(TASK) == task_before and tree_hashes(RUNS) == runs_before
    assert {k: sha(p.read_bytes()) for k, p in TEMPLATES.items()} == templates_before
    for name, digest in audit['files'].items():
        if name not in names:
            assert sha((OUT / name).read_bytes()) == digest

    audit['files'] = tree_hashes(OUT)
    audit['job_archives']['claude-haiku-4.5'] = jobs['claude-haiku-4.5']
    audit['haiku_status'] = 'Latest completed run-8e4c12dd / 6uqBDww; overall 0.1689; Functional 0.0870, 2/25; both gates pass'
    audit['recorded_scores'] = {k: r['rewards'] for k, r in records.items()}
    audit['provider_credential_values_redacted'] = secret_count
    audit['latest_haiku_replacement'] = {'prior_completed_delivery_preserved_in': str(backup),
                                        'source_exports_unchanged': True, 'review': 'haiku-8e4c12dd-review.json'}
    audit.pop('final_validation', None)
    (HERE / 'haiku-8e4c12dd-review.json').write_text(json.dumps(review, indent=2) + '\n', encoding='utf-8')
    audit_path.write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'haiku_status': audit['haiku_status'], 'new_haiku_archive': jobs['claude-haiku-4.5']['file'],
                      'file_count': jobs['claude-haiku-4.5']['file_count'], 'files': audit['files'],
                      'source_and_other_archives_unchanged': True, 'sql_probes': review['isolated_sqlite_probes']}, indent=2))


if __name__ == '__main__':
    main()
