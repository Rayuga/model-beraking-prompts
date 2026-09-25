"""Apply two data contract repairs only inside a disposable /app copy."""
from pathlib import Path
import hashlib
import json

path=Path('/app/server.js')
before=path.read_bytes()
text=before.decode('utf-8')
changes=[(
    "vote: visibleBallots.filter((ballot) => ballot.status === 'open' && ballot.eligible && !ballot.youParticipated),",
    "vote: visibleBallots.filter((ballot) => ballot.status === 'open' && ballot.eligible && !ballot.youParticipated).map((ballot) => workspacePayloadForBallot(user, ballot.id)),"
),(
    "          eligibleCount: ballot.eligibleCount,\n          participantCount: ballot.participantCount,",
    "          eligibleCount: ballot.eligibleCount,\n          participantCount: ballot.participantCount,\n          eligibleMembers: getEligibility(ballot.id).map((m) => ({ userId: m.user_id, name: m.name, active: Boolean(rosterSnapshot().find((r) => r.userId === m.user_id)?.active) })),\n          participants: getParticipation(ballot.id).map((m) => ({ userId: m.user_id, name: m.name, submittedAt: m.submitted_at })),"
)]
for old,new in changes:
    assert text.count(old)==1,text.count(old)
    text=text.replace(old,new)
path.write_text(text,encoding='utf-8')
Path('/results/diagnostic-patch.json').write_text(json.dumps({'scope':'disposable submitted-app copy only; not a new model submission or official score','before_sha256':hashlib.sha256(before).hexdigest(),'after_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'replacements':changes},indent=2)+'\n')
