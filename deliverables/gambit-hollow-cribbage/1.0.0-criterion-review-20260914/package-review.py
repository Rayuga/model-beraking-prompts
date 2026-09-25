from pathlib import Path
import hashlib, json, re, tomllib, zipfile

root=Path('projects/gambit-hollow-cribbage').resolve()
out=Path(__file__).resolve().parent
dims=('render','constraints','functional','polish','visual')
checks=[]
def check(name,value):
    assert value,name
    checks.append(name)

files=sorted(p for p in root.rglob('*') if p.is_file())
check('Only intended task roots', {p.relative_to(root).parts[0] for p in files}=={'instruction.md','task.toml','environment','solution','tests'})
check('No build outputs, databases or reviewer artifacts inside task',all(not any(x in p.parts for x in ('node_modules','__pycache__','.git','deliverables')) and p.suffix not in ('.db','.zip','.log','.png','.pyc') for p in files))
asset_root=root/'environment/assets/club'
check('Environment assets directory exists',asset_root.is_dir())
check('Reference asset COPY mapping','COPY assets/ /assets/' in (root/'environment/Dockerfile').read_text())
for asset in re.findall(r'`(/assets/[^`]+)`',(root/'instruction.md').read_text()):
    check('Instruction asset exists in canonical archive location '+asset,(root/'environment'/asset.lstrip('/')).is_file())
for p in asset_root.rglob('*'):
    if p.is_file(): check('Identical supplied/verifier asset '+str(p.relative_to(asset_root)),p.read_bytes()==(root/'tests/assets/club'/p.relative_to(asset_root)).read_bytes())
for p in files:
    if p.suffix in ('.js','.sh','.toml','.json','.html') or p.name=='Dockerfile':
        s=p.read_text(encoding='utf-8')
        pattern=r'^\s*(?://|/\*|<!--)'
        if p.suffix in ('.sh','.toml') or p.name=='Dockerfile': pattern=r'^\s*#(?!\!)'
        check('No comment lines '+str(p.relative_to(root)),not re.search(pattern,s,re.M))
        if p.suffix=='.sh': check('LF shell source '+p.name,b'\r' not in p.read_bytes())
    if p.suffix=='.json': json.loads(p.read_text())
    if p.suffix=='.toml': tomllib.loads(p.read_text())

judges={d:tomllib.loads((root/f'tests/{d}/judge.toml').read_text()) for d in dims}
all_ids=[c['id'] for v in judges.values() for c in v['criterion']]
check('45 unique criterion IDs',len(all_ids)==len(set(all_ids))==45)
gates=[]
for d in dims:
    s=(root/f'tests/{d}/prompt.md').read_text()
    gates.append(s[s.index('Global browser gate:'):s.index('Evaluate each criterion')])
    check(d+' independently scored and no false asset veto','Evaluate each criterion independently' in s and 'never fail the' in s and 'off-origin asset' in s)
check('Shared minimal browser prerequisite identical across five dimensions',len(set(gates))==1)

browser=json.loads((out/'browser-results.json').read_text())
unit=json.loads((out/'unit-results.json').read_text())
negative=json.loads((out/'negative-runner-results.json').read_text())
check('22 browser scenario groups passed',len(browser['results'])==22 and all(x['passed'] for x in browser['results']))
check('11 unit groups passed',len(unit['results'])==11 and all(x['passed'] for x in unit['results']))
check('Seven negative runner groups passed',len(negative['results'])==7 and all(x['passed'] for x in negative['results']))

mapping={
'seed_ladder_import':[0], 'the_twenty_nine_hand':[1], 'the_app_agrees_with_the_supplied_fixture':[2,4],
'a_card_counts_in_every_combination':[2], 'the_crib_flush_needs_five':[2], 'a_five_card_flush_counts_in_both':[2],
'the_ace_is_low_and_does_not_wrap':[2], 'nobs_needs_the_matching_suit':[2], 'fifteen_in_the_play_is_two':[7,16],
'a_run_in_the_play_need_not_be_in_order':[7], 'the_count_cannot_pass_thirty_one':[7], 'a_hand_that_is_not_a_hand_is_refused':[5],
'two_cards_each_go_to_the_crib':[6], 'the_crib_is_hidden_until_the_show':[6,8], 'moves_out_of_order_are_refused':[6,16],
'the_show_counts_in_order':[8], 'the_game_stops_at_the_target':[15], 'a_game_is_a_sequence_of_hands':[8,9],
'the_deal_alternates_between_hands':[9], 'a_game_survives_a_reload':[19,20], 'the_ladder_updates_when_a_game_ends':[14],
'hand_order_invariance':[4], 'pairs_and_last_card_in_real_play':[11], 'go_resets_and_other_player_leads':[10],
'heels_immediate_and_capped':[14], 'show_wins_stop_at_each_boundary':[12],
'practice_and_scoring_do_not_corrupt_saved_games':[16,17], 'pegging_scoring_bench':[3,17],
'runtime_manifest_routes':[20], 'final_restart_persistence':[20],
'board_renders':[0], 'cards_render_as_cards':[6], 'server_backed_local_application':[6,7,20], 'drawn_as_svg_not_images':[0,6,21],
'keyboard_controls_and_focus':[18], 'responsive_controls_and_reachability':[8,18], 'illegal_move_feedback':[7],
'pending_action_and_empty_state':[0,19], 'readable_state_and_reduced_motion':[1,6,8,18]
}
# Resolve against names rather than relying on positions after suite growth.
names=[r['name'] for r in browser['results']]
prefix={
'seed_ladder_import':['live page'], 'the_twenty_nine_hand':['visible hand/play'],
'the_app_agrees_with_the_supplied_fixture':['visible representative','all forty'],
'fifteen_in_the_play_is_two':['real play unsorted','normal new game'],
'the_game_stops_at_the_target':['pegging immediate'],
'moves_out_of_order_are_refused':['repeatable practice','normal new game'],
'the_ladder_updates_when_a_game_ends':['heels immediate'],
'heels_immediate_and_capped':['heels immediate'],
'show_wins_stop_at_each_boundary':['show stops'],
'practice_and_scoring_do_not_corrupt_saved_games':['normal new game','practice validation'],
'pegging_scoring_bench':['visible pegging','practice validation'],
'a_game_survives_a_reload':['reload, clean','manifest contract'],
'runtime_manifest_routes':['manifest contract'], 'final_restart_persistence':['manifest contract'],
'keyboard_controls_and_focus':['mobile reachability'], 'responsive_controls_and_reachability':['ordered complete','mobile reachability'],
'pending_action_and_empty_state':['live page','pending save'], 'readable_state_and_reduced_motion':['visible hand/play','repeatable practice','ordered complete','mobile reachability'],
'drawn_as_svg_not_images':['live page','repeatable practice','no fatal'], 'server_backed_local_application':['repeatable practice','real play unsorted','manifest contract']
}
for cid in ('a_card_counts_in_every_combination','the_crib_flush_needs_five','a_five_card_flush_counts_in_both','the_ace_is_low_and_does_not_wrap','nobs_needs_the_matching_suit'): prefix[cid]=['visible representative']
for cid,starts in prefix.items(): mapping[cid]=[i for i,n in enumerate(names) if any(n.startswith(p) for p in starts)]
rows=[]
for d,j in judges.items():
    for c in j['criterion']:
        evidence=[names[i] for i in mapping.get(c['id'],[])]
        if d=='visual': evidence=['Manual desktop/mobile screenshot review: live table, show, populated benches and ladder; no LLM numeric rating asserted.']
        check('Evidence mapped '+c['id'],bool(evidence))
        rows.append({'dimension':d,'id':c['id'],'weight':c['weight'],'evidence':evidence,'status':'local evidence reviewed; platform verdict pending'})
(out/'coverage.json').write_text(json.dumps(rows,indent=2)+'\n')
(out/'coverage.md').write_text('# Gambit criterion evidence\n\nLocal evidence supports review; it is not a platform verdict. Some scenarios cover representative portions of a criterion and are complemented by source inspection. Visual anchors were retained and reviewed manually, without assigning an Oracle score.\n\n| Dimension | Criterion | Local evidence |\n|---|---|---|\n'+'\n'.join('| '+r['dimension']+' | `'+r['id']+'` | '+'; '.join(r['evidence'])+' |' for r in rows)+'\n')

sha=lambda b:hashlib.sha256(b).hexdigest()
provenance={str(p.relative_to(root)).replace('\\','/'):sha(p.read_bytes()) for p in files}
(out/'source-sha256.json').write_text(json.dumps(provenance,indent=2)+'\n')
archive=out/'gambit-hollow-cribbage.zip'
wrapper='gambit-hollow-cribbage/'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files:
        name=p.relative_to(root).as_posix()
        info=zipfile.ZipInfo(wrapper+name,(2026,9,14,0,0,0))
        info.create_system=3
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,p.read_bytes())
with zipfile.ZipFile(archive) as z:
    check('ZIP CRC validation',z.testzip() is None)
    check('Exactly one task-named wrapper',{n.split('/')[0] for n in z.namelist()}=={root.name})
    check('No unsafe or Windows member paths',all('\\' not in n and '..' not in n.split('/') and not n.startswith('/') for n in z.namelist()))
    check('Unix regular-file and executable script permissions',all(i.create_system==3 and i.external_attr>>16==(0o100755 if i.filename.endswith('.sh') else 0o100644) for i in z.infolist()))
    check('ZIP member bytes match every source file',len(z.namelist())==len(files) and all(sha(z.read(wrapper+name))==digest for name,digest in provenance.items()))
(out/'package-audit.json').write_text(json.dumps({'passed':True,'checks':checks,'file_count':len(files),'zip_sha256':sha(archive.read_bytes()),'platform_oracle_run':False,'exact_fresh_image_build':False},indent=2)+'\n')
print(f'PASS {len(checks)} package/evidence checks; {len(files)} files; ZIP SHA256 {sha(archive.read_bytes())}')
