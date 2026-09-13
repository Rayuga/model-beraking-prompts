from pathlib import Path

exec((Path(__file__).parent / 'migrate.py').read_text().split('old_cfg =', 1)[0])
policy = 'Independent criterion scoring: once the explicit shared prerequisites pass, score each criterion only on its own evidence and required observations. Continue after individual failures and return a verdict for every criterion. Do not cascade a missing focus ring, asset-origin violation or unrelated workflow failure across the batch. Keep every mandatory subcheck within its own criterion; missing evidence is not a pass. Only explicit shared prerequisites can invalidate the whole batch. Use the configured weighted aggregation, not an invented cross-criterion all-pass rule.\n\n'
for d in ['render','constraints','functional','polish','visual']:
    p = task / f'tests/{d}/prompt.md'
    text = get(p)
    if 'Independent criterion scoring:' in text:
        continue
    text = text.replace('that survives refresh, loads its essential assets from that origin, and authenticates', 'that survives refresh and authenticates')
    text = text.replace('This prerequisite carries no extra score.', 'External fonts, scripts, styles and other runtime assets do not by themselves fail this global gate under public networking. Grade the brief\'s local-resource restrictions only in the dedicated same_origin_shell criterion. The local page, actual protected backend data and successful authentication remain mandatory. This prerequisite carries no extra score.')
    text = re.sub(r'(?m)^(Prompt version: .*-r)(\d+)$', lambda m:m[1]+str(int(m[2])+1),text)
    text = text.replace('{criteria}', policy+'{criteria}')
    if d=='functional':
        text = text.replace('Complete Leila\'s Courtyard vote,', 'Test Leila\'s empty and two-choice Courtyard submissions after capturing Owen\'s request, then complete her valid visible Courtyard vote,')
    edit(p,text)

p = task / 'tests/functional/judge.toml'
text = get(p)
start = text.index('description = """', text.index('id = "single_choice_private_vote"'))
end = text.index('"""',start+17)+3
description = '''description = """
Setup: Confirm Courtyard closing time is Open and Owen and Leila are eligible and have not participated. Use their real signed-in contexts and the shared workflow.
Graded observations:
1. As Owen, submit Keep 8 pm through the visible one-final-ballot flow. Capture its genuine request and successful response. Require a private participation confirmation without returning or displaying his submitted choice in the post-submit confirmation.
2. Before Leila votes, use the discovered request shape with Leila's session and the current Courtyard revision to try an empty choice list and then both Courtyard choices, with a fresh operation id for each. Require non-2xx, no Leila participation, and unchanged turnout, revision and audit after each rejection.
3. As Leila, visibly submit Extend to 9 pm. Require her own participation and a private confirmation without her selected choice in the success response or post-submit confirmation. Capture this response too.
4. Other Member-only ballots must remain isolated. Do not require a receipt-number widget or a particular response key. Retain the captured successful request for the separate replay checks.
"""'''
text = text[:start]+description+text[end:]
edit(p,text)
for p in (task/'tests').rglob('*'):
    if p.is_file() and p.suffix in ['.toml','.md']:
        p.write_bytes(p.read_bytes().replace(b'\r\n',b'\n'))
