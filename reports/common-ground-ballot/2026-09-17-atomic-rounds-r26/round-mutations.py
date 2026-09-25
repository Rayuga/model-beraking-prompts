from pathlib import Path
import re
import sys

kind = sys.argv[1]
path = Path('/app/server.js' if kind != 'upgrade-round-retry' else '/app/public/app.js')
s = path.read_text()
if kind == 'partial-round':
    start = s.index('      const current = ballots.map(row => {')
    stop = s.index('      const active = members.filter', start)
    s = s[:start] + '      const current = ballots.map(row => ballotOrThrow(row.id));\n' + s[stop:]
    old = '      for (const ballot of current) {\n        for (const member of active)'
    new = '''      for (const ballot of current) {
        if (ballot.status !== "draft" || ballot.revision !== ballots.find(b => b.id === ballot.id).revision) return {statusCode:409,body:{error:"A selected draft changed. Nothing opened. Review the round again."}};
        for (const member of active)'''
elif kind == 'roster-status-only':
    old = 'JSON.stringify(roster) !== JSON.stringify(members.map(m => ({ id: m.id, revision: m.revision })))'
    new = 'roster.length !== members.length || roster.some((r,i) => r.id !== members[i].id || (members[i].revision - r.revision) % 2 !== 0)'
elif kind == 'ordered-round-receipt':
    old = '    }).sort((a, b) => a.id.localeCompare(b.id));\n    roundIds(ballots.map(b => b.id));'
    new = '    });\n    roundIds(ballots.map(b => b.id));'
elif kind == 'forgotten-round-refusal':
    old = '    body = error.body;\n    db.prepare(`'
    new = '    body = error.body;\n    if (action === "round.open") return response.status(statusCode).json(body);\n    db.prepare(`'
elif kind == 'round-role-bypass':
    old = 'app.post("/api/rounds/open", requireUser, requireRole("coordinator"),'
    new = 'app.post("/api/rounds/open", requireUser,'
elif kind == 'upgrade-round-retry':
    old = '    let response;\n    try {\n      response = await fetch(saved.url'
    new = '''    if (saved.url === "/api/rounds/open") {
      const payload = JSON.parse(saved.body);
      if (payload.ballots.some(b => state.ballots.find(current => current.id === b.id)?.status === "closed")) {
        payload.ballots = payload.ballots.map(b => ({...b, revision: state.ballots.find(current => current.id === b.id)?.revision || b.revision}));
        saved.body = JSON.stringify(payload);
      }
    }
    let response;
    try {
      response = await fetch(saved.url'''
else:
    raise ValueError(kind)
assert s.count(old) == 1, (kind, s.count(old))
path.write_text(s.replace(old, new))
print('Applied disposable round mutant:', kind, flush=True)
