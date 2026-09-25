from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / 'projects/common-ground-ballot'
REPORT = Path(__file__).resolve().parent

def write(path, text):
    path.write_text(text, encoding='utf-8', newline='\n')

backup = REPORT / 'before-r19.zip'
if not backup.exists():
    with zipfile.ZipFile(backup, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(TASK.rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(TASK).as_posix())

docs = TASK / 'environment/instructions'
overview = (docs / 'overview.md').read_text(encoding='utf-8').replace(
    "participation. Show the signed-in person's name and role.",
    "participation. In every protected workspace, show the signed-in person's name,\nrole, and the group name Riverside Residents Association; a shared header is fine.")
ballots = (docs / 'ballots.md').read_text(encoding='utf-8').replace(
    'A viewed revision or approval maximum represents a single positive whole',
    'Each newly created draft starts at revision 1. Each accepted draft edit, Open,\nClose, or Publish advances that ballot revision by exactly one. Voting does not\nadvance the ballot revision. Preserve the revisions provided for seeded ballots.\nRefusals and exact replays never advance a revision.\n\nA viewed revision or approval maximum represents a single positive whole')
privacy = (docs / 'privacy.md').read_text(encoding='utf-8').replace(
    'Roster changes need the revision the Coordinator actually viewed, just like',
    'Membership records start at revision 1. Each accepted membership update advances\nthe applicable membership revision by exactly one; refusals and exact replays\ndo not advance it.\n\nRoster changes need the revision the Coordinator actually viewed, just like')
runtime = (docs / 'runtime.md').read_text(encoding='utf-8').replace(
    '`/instructions` are build-time inputs and may be absent at startup.',
    'this brief are build-time inputs and may be absent at startup.')
intro = '''# Common Ground Ballot

Build Common Ground, a private ballot workspace for Riverside Residents Association.
Deliver the complete running application under `/app`. This file contains the full
brief. The authoritative starting records are `/assets/artifacts/common_ground_seed.json`.

Start by copying `/assets/starter/.` into `/app/`, then copy the seed to
`/app/common_ground_seed.json`. The supplied foundation already implements the SQLite
schema, transactional seed-once import, secure persistent sessions, password checks,
sign-in, sign-out, end-all-sessions, and a responsive six-workspace shell. Extend it
with ballot workflows, protected projections, receipts, and recovery. You may adapt
its schema, routes, and UI; their exact names are not requirements. The foundation
does not implement ballot business routes or pending actions.

Work through the supplied ballots as each demo user, make a new decision from draft
through publication, and check that accepted changes survive a fresh sign-in and
server restart. Registration, email delivery, public result links, imports, exports,
and real-world election certification are out of scope.

'''
sections = [overview, ballots, privacy, runtime,
            (docs / 'interface.md').read_text(encoding='utf-8'),
            (docs / 'recovery.md').read_text(encoding='utf-8')]
write(TASK / 'instruction.md', intro + '\n\n'.join(sections).rstrip() + '\n')
docker = TASK / 'environment/Dockerfile'
write(docker, docker.read_text().replace('COPY instructions/ /instructions/\n', '').replace('chmod -R a+rX /instructions /assets', 'chmod -R a+rX /assets'))
for path in docs.iterdir():
    assert path.is_file() and path.parent == docs
    path.unlink()
docs.rmdir()

meta = TASK / 'task.toml'
write(meta, meta.read_text().replace('difficulty = "medium"', 'difficulty = "hard"').replace(
    'A compact six-workspace product combines',
    'A supplied SQLite/authentication foundation leaves a six-workspace product requiring'))

# Supply generic infrastructure already used by the reference. Business mutations,
# result projections, receipt handling, and recovery remain the implementation task.
golden = (TASK / 'solution/server.js').read_text(encoding='utf-8')
foundation = golden[:golden.index('function integer(')]
auth = golden[golden.index('app.get("/api/health"'):golden.index('app.get("/api/ballots"')]
tail = golden[golden.index('app.use(express.static'):]
placeholder = '''// Add protected ballot, membership, turnout, results, and audit routes here.
// Call requireUser/requireRole and return role-appropriate projections.
app.use('/api', (_request, response) => response.status(501).json({error: 'This workflow is not implemented yet.'}));

'''
write(TASK / 'environment/assets/starter/server.js',
      '// Foundation: persistence, seed import, authentication, and HTTP shell.\n' + foundation + auth + placeholder + tail)
print('Brief consolidated; explicit revisions and identity; runnable persistence/auth foundation supplied.')
