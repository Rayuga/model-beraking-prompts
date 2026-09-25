import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/utilibill-metrics-dashboard'
def change(rel,old,new):
 p=TASK/rel;s=p.read_text(encoding='utf-8');assert s.count(old)==1,(rel,old[:90],s.count(old));p.write_text(s.replace(old,new),encoding='utf-8',newline='\n')
change('solution/public/js/utilibill.js', "  const plan = b.trueup_plan;", "  const plan = b.trueup_plan;\n  nodes.push(kv('Trailing twelve actual bills (sum)', plan.trailing_total_display));")
change('solution/public/js/utilibill.js', "  nodes.push(kv('Re-billed energy (this period’s own fresh blocks)', b.total_display));", "  for (const t of bd.tiers || []) nodes.push(kv(`Tier ${t.tier} (${t.kwh} kWh @ ${t.rate}¢)`, money(t.cents)));\n  nodes.push(kv('Re-billed energy (this period’s own fresh blocks)', b.total_display));")
change('solution/public/js/utilibill.js', "  nodes.push(el('div', { class: 'section-title', text: 'Cycles' }));", """  const batches = {};
  for (const c of a.cycles || []) for (const b of c.bills || []) {
    const trigger = b.breakdown && b.breakdown.trueup_actual_cycle;
    if (trigger) batches[trigger] = (batches[trigger] || 0) + b.energy_cents;
  }
  for (const [trigger,total] of Object.entries(batches)) nodes.push(kv(`Correction batch energy · ${trigger}`, money(total)));
  nodes.push(el('div', { class: 'section-title', text: 'Cycles' }));""")
change('solution/public/js/utilibill.js', "nodes.push(kv(`${a.kind} rider (base ${a.base_display})`, a.amount_display));", "nodes.push(kv(`${a.kind} rider (base ${a.kind === 'SBC' ? `${b.delivered_kwh} kWh` : a.base_display})`, a.amount_display));")
change('solution/src/index.js', "let db = null;\ntry { db = dbmod.open(); }\ncatch (e) { console.error('[utilibill] database open failed:', e.message); }", "const db = dbmod.open();")
change('solution/src/index.js', "    if (i > 0) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());", "    if (i > 0) {\n      try { req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch {}\n    }")
change('solution/public/styles.css', '--accent: #2f6fed;', '--accent: #285fd0;\n  --action-fg: #ffffff;')
change('solution/public/styles.css', '--accent: #74a8ff;', '--accent: #74a8ff;\n  --action-fg: #0a1420;')
change('solution/public/styles.css', 'button.action { background: var(--accent); color: #fff;', 'button.action { background: var(--accent); color: var(--action-fg);')
with (TASK/'solution/public/styles.css').open('a',encoding='utf-8',newline='\n') as p:
 p.write('''
button, input:not([type="checkbox"]) { min-height: 44px; }
input[type="checkbox"] { width: 20px; min-width: 20px; height: 20px; accent-color: var(--accent); }
label.row:has(input[type="checkbox"]) { min-height: 44px; cursor: pointer; }
.drawer .form-grid { grid-template-columns: 1fr; }
.drawer .card, .kv .v, .row > span { min-width: 0; overflow-wrap: anywhere; }
.drawer-head { z-index: 2; }
#login-view { max-width: 620px; margin: 48px auto; padding: 32px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
#login-view input { display: block; width: 100%; }
#login-view code { overflow-wrap: anywhere; }
@media (max-width: 520px) { #login-view { margin: 12px auto; padding: 20px; } .drawer { max-height: 100dvh; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
''')

def strip_comments(s):
 out=[];i=0
 while i<len(s):
  c=s[i]
  if c in "'\"`":
   quote=c;out.append(c);i+=1
   while i<len(s):
    c=s[i];out.append(c);i+=1
    if c=='\\' and i<len(s):out.append(s[i]);i+=1
    elif c==quote:break
  elif s.startswith('//',i):
   end=s.find('\n',i);i=len(s) if end<0 else end
  elif s.startswith('/*',i):
   end=s.find('*/',i+2);assert end>=0;out.append('\n'*s[i:end+2].count('\n'));i=end+2
  else:out.append(c);i+=1
 return re.sub(r'\n{3,}','\n\n',''.join(out))
for p in (TASK/'solution').rglob('*.js'):
 s=p.read_text(encoding='utf-8');s=re.sub(r'^\s*--[^\n]*$', '',s,flags=re.M) if p.name=='db.js' else s
 p.write_text(strip_comments(s).strip()+'\n',encoding='utf-8',newline='\n')
for p in (TASK/'tests').glob('*/prompt.md'):
 s=p.read_text(encoding='utf-8').replace('Score every criterion independently after the shared gate:', 'Independent criterion scoring: evaluate each criterion independently and score each criterion only on its own evidence after the shared gate:').replace('Continue to independent scenarios after a failure and return a verdict for every criterion.', 'Continue after individual failures and return a verdict for every criterion. Try independent scenarios even if another failed.')
 p.write_text(s,encoding='utf-8',newline='\n')
p=TASK/'tests/functional/judge.toml';s=p.read_text(encoding="utf-8")
s=s.replace('finalize C1 M2 into a third locally created period only if the product offers period creation; otherwise finalize it into still-open P2 before P2 remittance, together with C10.', 'finalize C1 M2 into still-open P2 before P2 remittance, together with C10.')
s=s.replace('Never invent a period-creation requirement.', 'Use the supplied periods; period creation is not required.')
p.write_text(s,encoding='utf-8',newline='\n')
print('Golden details, accessibility and comment cleanup complete.')
