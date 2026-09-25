from pathlib import Path

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
path=ROOT/'deliverables/common-ground-ballot/README.md';text=path.read_text(encoding='utf-8')
start=text.index('Latest candidate:');end=text.index("r17's platform Oracle failed")
head='''Latest candidate: [common-ground-ballot.zip](2026-09-16-oracle-transport-r24/common-ground-ballot.zip).
**r24 repairs the reproduced Oracle Functional browser-helper crash.**
Read [the diagnosis and validation](2026-09-16-oracle-transport-r24/README.md).
The r23 platform Oracle scored0.4: Functional0, other four dimensions1. Its helper
was outside Playwright's allowed roots; after a workaround, an unhandled matcher
exception (`URL is not defined`) killed MCP before business tests. Both reproduced.
r24 sets the private working directory and contains capture-predicate failures.
The exact failure is now recoverable, and real browser recovery tests pass.

Golden, brief, all71criteria/weights/timeouts and score policy are unchanged.
Fresh full Oracle, model runs and platformQC forr24 remain pending. Supplied
model rewards are all0 with distinct app/agent failures; these are notr24scores.
Historical ZIP bytes remain unchanged; r23 is now a known failed Oracle candidate.

'''
text=text[:start]+head+text[end:]
old='| [2026-09-16-budget-revision-r23](2026-09-16-budget-revision-r23/) | Current: larger gate budgets within the standard cap, accepted-vote revision coverage, golden and three mutants checked |'
new='''| [2026-09-16-oracle-transport-r24](2026-09-16-oracle-transport-r24/) | Current: private helper file access and contained matcher exceptions; exact Oracle crash reproduced and recovery tested |
| [2026-09-16-budget-revision-r23](2026-09-16-budget-revision-r23/) | Failed platform Oracle0.4 due Functional MCP crash before business tests; repaired inr24 |'''
assert old in text;path.write_text(text.replace(old,new),encoding='utf-8',newline='\n')

path=ROOT/'TASK_AUTHORING_CONTEXT.md';text=path.read_text(encoding='utf-8')
title='# Current WebDev Task Authoring Context\n\n';assert text.startswith(title)
section='''## September 16: Common Ground Oracle transport repair r24 (current candidate)

ZIP: `deliverables/common-ground-ballot/2026-09-16-oracle-transport-r24/common-ground-ballot.zip`.
SHA-256 `116e38d85b9a8417e71c71d349887733e94472ae3d50ee03b269658a31a7aaf0`.
Report: `reports/common-ground-ballot/2026-09-16-oracle-transport-r24/README.md`.
The user added five r23 trials: Oracle N3HksDo reward0.4/F0, other dimensions1;
NOP0; Haiku4.5 reward0/F0.1239 plus agent exit exception; GPT5.4mini reward0/F0
with hidden wrong-password rejection; Gemini3.7Flash reward0/F0.6429, hidden
wrong-password rejection plus agent authentication exception. Full audit saved.
All exported provenance hashes match frozenr23; Oracle app matches golden.

Oracle Functional ended in111.77seconds, not a timeout. Helper filename under
/opt was outside MCP's /app allowed roots. Judge copied it into/app, then its
first wrong-password capture matcher used newURL in the unsafe-codeVM, where
URL is undefined. The unguarded request listener raised ReferenceError and
terminatedMCP;51Functional criteria were untested. Exact call and both faults
reproduced on pinnedMCP0.0.79 with process exit1; record in reproduction/.

r24 sets Functional judge.cwd=/opt/common-ground-verifier, and guards helper
observation/interception matcher callbacks. Sync exceptions, async rejection and
nonboolean matchers become retained evidence-missing results and clean up without
killing MCP. Prompt explains safe string predicates and correcting/recollecting
tool errors. No code copied intoapp or unrestricted file access added. Four
files changed: README,Functionaljudge,Functionalprompt,test.sh(helperbodyonly).
All71criteria,weights,timeouts,golden,brief,starter,scoreformula unchanged.
Functionalprompt nowr24, Render r22, othersr20. Five judge passes remain.

Exact crashing call now returns retained error; the same MCP session completes
all auth probes.9resilience +19realMCP recovery +30runner +294ZIP checks passed.
Cached dependency image, not fresh downloadbuild. No local provider credentials
available for fresh scoredOracle. Full autonomous completion/platformQC/newmodel
scores remain unverified. Do not claimOracle1 or treat oldr23 asOracle-ready.
Earlier current-candidate notes below are historical.

'''
text=text.replace('## September 16: Common Ground timeout and vote-revision repair r23 (current candidate)','## September 16: Common Ground timeout and vote-revision repair r23 (historical candidate)',1)
path.write_text(title+section+text[len(title):],encoding='utf-8',newline='\n')
