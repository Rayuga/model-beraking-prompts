"""Row 27 protocol counterexample, not a complete app or configured judge run.

An implementation may refresh a one-use anti-CSRF transport token while
retaining the logical restore-attempt identity. Public retry semantics hold;
the rubric's exact-request replay fails. Only synthetic local state is used.
"""
from pathlib import Path
import json
import sqlite3

db_file = Path(__file__).with_name('restore_retry_counterexample.sqlite')
if db_file.exists():
    raise SystemExit('Refusing to overwrite prior evidence database')


class Backend:
    def __init__(self):
        self.db = sqlite3.connect(db_file)
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS snapshots (revision INTEGER PRIMARY KEY, source TEXT);
        CREATE TABLE IF NOT EXISTS restores (attempt TEXT PRIMARY KEY, revision INTEGER);
        INSERT OR IGNORE INTO snapshots VALUES (1, 'first');
        INSERT OR IGNORE INTO snapshots VALUES (2, 'second');
        ''')
        self.db.commit()
        self.tokens = set()
        self.serial = 0

    def issue_transport_token(self, epoch):
        self.serial += 1
        token = f'synthetic-{epoch}-{self.serial}'
        self.tokens.add(token)
        return token

    def head(self):
        return self.db.execute('SELECT revision, source FROM snapshots ORDER BY revision DESC LIMIT 1').fetchone()

    def restore(self, request):
        token = request['csrf']
        if token not in self.tokens:
            return {'error': 'Refresh the transport token and retry the same attempt'}
        self.tokens.remove(token)
        prior = self.db.execute('SELECT revision FROM restores WHERE attempt=?', (request['attempt'],)).fetchone()
        if prior:
            return {'restored_revision': prior[0]}
        if request['base'] != self.head()[0]:
            return {'error': 'revision conflict'}
        source = self.db.execute('SELECT source FROM snapshots WHERE revision=?', (request['target'],)).fetchone()[0]
        revision = self.head()[0] + 1
        with self.db:
            self.db.execute('INSERT INTO snapshots VALUES (?,?)', (revision, source))
            self.db.execute('INSERT INTO restores VALUES (?,?)', (request['attempt'], revision))
        return {'restored_revision': revision}

    def save_newer(self):
        revision = self.head()[0] + 1
        with self.db:
            self.db.execute('INSERT INTO snapshots VALUES (?,?)', (revision, 'newer-work'))


backend = Backend()
captured = {'base': 2, 'target': 1, 'attempt': 'logical-attempt-A', 'csrf': backend.issue_transport_token('before')}
original = backend.restore(captured)
assert original == {'restored_revision': 3}
raw_replay = backend.restore(captured)
assert 'error' in raw_replay
ui_retry = backend.restore({**captured, 'csrf': backend.issue_transport_token('before')})
assert ui_retry == original and backend.head() == (3, 'first')
backend.save_newer()
ui_retry_after_save = backend.restore({**captured, 'csrf': backend.issue_transport_token('before')})
assert ui_retry_after_save == original and backend.head() == (4, 'newer-work')
backend.db.close()

# Reopen the persistent store with a fresh transport session, as after restart.
backend = Backend()
raw_replay_after_restart = backend.restore(captured)
assert 'error' in raw_replay_after_restart
ui_retry_after_restart = backend.restore({**captured, 'csrf': backend.issue_transport_token('after')})
history = backend.db.execute('SELECT revision, source FROM snapshots ORDER BY revision').fetchall()
assert ui_retry_after_restart == original and backend.head() == (4, 'newer-work')
assert history == [(1, 'first'), (2, 'second'), (3, 'first'), (4, 'newer-work')]
backend.db.close()
print(json.dumps({
    'scope': 'Executable protocol counterexample only; no browser, provider or configured judge run',
    'original_restore': original,
    'exact_request_replay': raw_replay,
    'same_logical_attempt_with_fresh_transport_token': ui_retry,
    'retry_after_newer_save': ui_retry_after_save,
    'exact_request_replay_after_restart': raw_replay_after_restart,
    'retry_after_restart_with_fresh_transport_token': ui_retry_after_restart,
    'final_history': history,
    'all_assertions_passed': True,
}, indent=2))
