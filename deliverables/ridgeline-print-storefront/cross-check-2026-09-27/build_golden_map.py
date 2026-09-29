from pathlib import Path
import hashlib, json, tomllib, zipfile

out = Path(__file__).resolve().parent
task = Path.cwd() / 'projects/ridgeline-print-storefront'
archive = out / 'ridgeline-print-storefront.zip'
prior = json.loads((out / 'golden-archive-identity.json').read_text())
with zipfile.ZipFile(archive) as z:
    current = {name.split('/solution/', 1)[1]: hashlib.sha256(z.read(name)).hexdigest() for name in z.namelist() if '/solution/' in name and not name.endswith('/')}
assert current == prior['solution_files']
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
M = {
 'populated_public_shop_loads': ('gate-address/gate-address-browser-results.json; presentation/browser-criteria-results.json', 'Populated catalogue and actual reachable detail; no account prerequisite.'),
 'application_health_and_server_data': ('gate-address/gate-address-browser-results.json', 'Actual Kiln UI purchase; server response and clean independent-context normal lookup plus reload retrieve exact reference, recipient and line. No copied storage.'),
 'ridgeline_catalogue_cards_and_variant_details': ('commerce/results.json', 'Eight cards and all thirteen live variant details checked against seed price/paper/trade fields and observed current stock; detail images render larger than grid.'),
 'ridgeline_catalogue_title_search': ('mcp/catalogue-controls-mcp-results.json', 'Installed MCP observes exact case-insensitive Harbour membership and all-eight restoration.'),
 'ridgeline_catalogue_size_filter': ('mcp/catalogue-controls-mcp-results.json', 'Installed MCP observes exact five A2 prints including sold-out Harbour and all-eight restoration.'),
 'ridgeline_catalogue_paper_filter': ('mcp/catalogue-controls-mcp-results.json', 'Installed MCP observes exact three Munken prints and all-eight restoration.'),
 'ridgeline_catalogue_regular_price_ordering': ('mcp/catalogue-controls-mcp-results.json', 'Installed MCP compares all eight regular grid prices in both sort directions.'),
 'ridgeline_catalogue_alphabetical_title_ordering': ('mcp/catalogue-controls-mcp-results.json', 'Installed MCP compares all eight titles in both sort directions.'),
 'variant_stock_and_valid_basket_boundary': ('commerce/results.json; commerce/remaining-ui-legs-results.json', 'Actual Harbour A3 addition, sold-out Harbour A2/Allotment disabled, Slack A2 excess reports one and preserves one; basket cleared.'),
 'ridgeline_unplaced_basket_survives_full_reload': ('mcp/two-context-mcp-results.json', 'Actual MCP holds two independent contexts open, proves each exact distinct basket and total survives reload, clears both and restores original MCP page without stock changes.'),
 'ridgeline_zero_quantity_removal_stays_empty': ('commerce/results.json', 'Actual Night Ferry A2 addition then quantity-zero UI removal; full reload remains empty.'),
 'trade_threshold_reversal_and_size_isolation': ('commerce/results.json; commerce/remaining-ui-legs-results.json', 'Night Ferry A3 alone changes 4 to 5 to 4 in the same basket; all four amounts and both per-variant unit prices update/reverse correctly while A2 stays regular.'),
 'postage_inclusive_boundaries_and_collection': ('commerce/results.json', 'Browser-built baskets at 90/500/2000/2090 grams show exact expected postage and collection-only status; no orders during previews.'),
 'historical_receipt_uses_charged_prices': ('commerce/results.json; commerce/remaining-ui-legs-results.json', 'Historical two-unit 35.00/73.20 receipt versus new Long Field UI purchase at 37.95/39.70; fresh server lookups retain independent figures and UI historical recovery works.'),
 'ridgeline_unknown_reference_does_not_substitute_receipt': ('commerce/remaining-ui-legs-results.json', 'Known, unknown, known UI lookup sequence; no stale receipt presented on unknown reference and known receipt recovers.'),
 'mixed_trade_prices_survive_order_lookup': ('commerce/results.json; commerce/remaining-ui-legs-results.json', 'Real mixed UI purchase observes address and 326.35/31.25/4.95/300.05 before commitment; exact stock deltas; refreshed receipt shows individual 37.95/36.25 lines and saved address.'),
 'ridgeline_incomplete_delivery_address_refuses_atomically': ('gate-address/gate-address-browser-results.json', 'Independent valid UI control; four current fresh attempts separately omit/blank required address components and preserve all stocks/receipt; separate valid UI purchase afterward succeeds.'),
 'authoritative_prices_on_fresh_checkout': ('commerce/results.json', 'UI positive control, fresh forged monetary claims authoritatively repriced at 67.70; correct single stock decrement and immutable original receipt.'),
 'combined_quantities_and_invalid_checkout_are_atomic': ('commerce/results.json', 'UI control plus actual repeated additions combine five; observed request shape submits duplicate rows; unique stored quantity/tier then separate overstock, zero, negative, fractional and unknown-variant refusals leave stocks/receipts exact.'),
 'stale_multiline_checkout_leaves_every_stock_unchanged': ('commerce/results.json', 'Valid UI basket before competing eight-Harbour UI order; fresh stale multiline server request refuses without touching valid Long Field companion or competitor receipt.'),
 'checkout_retry_identity_and_new_purchase': ('commerce/results.json', 'UI original, two exact replays, changed quantity/address refusals, and genuinely new UI purchase with distinct reference; correct remaining stock and unchanged original receipt.'),
 'cancellation_is_terminal_and_restores_stock_once': ('commerce/results.json', 'Five-unit trade UI order/cancel, immutable receipt, two cancel replays, checkout replay stays cancelled, dispatched cancellation refusal preserves stocks/historical receipt.'),
 'simultaneous_last_copy_commits_only_once': ('commerce/results.json', 'Successful UI one-unit control then Promise.all of two distinct fresh attempts; exactly one winner, one refusal, zero stock and distinct correct receipts.'),
 'ridgeline_sold_out_cheapest_variant_keeps_grid_price': ('commerce/results.json; conditional/results.json', 'Both branches observed: inherited race zero A3 and own exact-current-stock UI setup. Grid remains 37.95 and available before/after reload; dearer A2 is still untouched and purchasable.'),
 'last_unit_order_and_fresh_oversell_refusal': ('commerce/results.json', 'Actual last Slack A2 UI purchase at 59.70, stock zero, fresh-identity server oversell refusal, original receipt unchanged.'),
 'successive_orders_use_remaining_stock_and_own_tiers': ('commerce/results.json', 'Separate actual two-unit regular and three-unit trade UI purchases; exact 116.20/155.45 receipts, three then zero stock, both immutable fresh reads.'),
 'restart_preserves_receipts_stock_and_retry_terminality': ('browser_restart_results.json', 'Harness owner freshly proves own UI cancelled/placed controls, actual MCP PID30 to196, exact fresh-browser receipts/addresses, all variant stocks, historical receipt and terminal checkout/cancel replays.'),
 'responsive_layout': ('presentation/browser-criteria-results.json', 'Both-theme mobile catalogue and basket reached without page-wide overflow; all five surfaces captured at desktop and mobile.'),
 'labelled_controls_and_focus': ('presentation/browser-criteria-results.json', 'Named search/filter/sort/basket/theme controls plus actual Tab to search and two selects with visible focus styling.'),
 'interaction_feedback': ('presentation/browser-criteria-results.json', 'Matching search/clear updates results; successful available-unit addition displays acknowledgement and basket count; unplaced basket cleared afterward.'),
 'theme_and_navigation': ('presentation/browser-criteria-results.json', 'Both themes visibly change chrome/control colors; usable catalogue/detail/basket/checkout/receipt navigation, return and cleanup.'),
}
visual = 'Fresh 21-screenshot set across five surfaces, both themes and desktop/mobile; manual sampled screenshot review is consistent with attainable top anchors, not a paid rating.'
for topic in ['typography','color_and_contrast','spacing_and_layout','hierarchy_and_scanability','overall_craft','responsive_consistency']:
    M['visual_'+topic] = ('presentation/browser-criteria-results.json', visual)
rows=[]
for area,dimension in [('gates','render'),('gates','constraints'),('scored','functional'),('scored','polish'),('scored','visual')]:
    file=task/f'tests/{area}/{dimension}/judge.toml'
    for c in tomllib.loads(file.read_text())['criterion']:
        paths,note=M.pop(c['id']); evidence=paths.split('; ')
        for p in evidence:
            d=json.loads((out/p).read_text(encoding='utf-8'));assert d.get('passed') is True,p
        rows.append({'dimension':f'{area}/{dimension}','id':c['id'],'type':c['type'],'weight':c['weight'],'result':'manual_rendered_review_consistent_with_top_anchors' if c['type']=='likert' else 'local_observed_pass','evidence':evidence,'observation':note})
assert not M and len(rows)==37
assert sum(r['weight'] for r in rows if r['dimension']=='scored/functional') == 35
raw=json.loads((out/'commerce/results.json').read_text())
seed=json.loads((task/'environment/assets/seed_data.json').read_text())
variants={(r['sku'],r['size']):r for r in seed['variants']}
line_checks=0
for response in raw['requests']:
    if response.get('purpose') != 'ordinary UI positive purchase':continue
    body=response['body']; request=response['request']
    assert all(body['address_'+k]==v for k,v in request['address'].items())
    combined={}
    for r in request['lines']:combined[(r['sku'],r['size'])]=combined.get((r['sku'],r['size']),0)+r['qty']
    assert len(body['lines'])==len(combined)
    for r in body['lines']:
        key=(r['sku'],r['size']);v=variants[key];qty=combined[key];unit=v['tier_price_pence'] if qty>=v['tier_qty'] else v['price_pence']
        assert r['qty']==qty and r['unit_price_pence']==unit and r['base_unit_price_pence']==v['price_pence'] and r['line_total_pence']==qty*unit
        line_checks+=1
result={'archive_sha256':digest,'baseline_application_archive_sha256':prior['archive_sha256'],'all_19_solution_files_unchanged_in_final_archive':True,'scope':'Fresh local browser evidence; actual paid Oracle and model scores unmeasured','criteria':rows,'counts':{'functional':25,'gates':2,'polish':4,'visual':6,'total':37},'functional_weight':35,'fresh_successful_UI_receipt_line_assertions':line_checks,'solution_hashes':current,'rubric_sha256':{p.relative_to(task).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()for p in (task/'tests').rglob('judge.toml')}}
(out/'GOLDEN_CRITERION_EVIDENCE.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
table='\n'.join('| '+r['dimension']+' | `'+r['id']+'` | '+r['observation']+' | '+', '.join('`'+p+'`'for p in r['evidence'])+' |'for r in rows)
(out/'GOLDEN_CRITERION_MAP.md').write_text('# Final Ridgeline golden criterion map\n\nArchive SHA-256: `'+digest+'`. All 19 solution files match the baseline app used for the fresh runs. 25 Functional / 2 gates / 4 Polish / 6 Visual; total Functional weight 35. Binary entries are local observations, and Visual entries are a local rendered review, not actual Oracle scores.\n\n| Dimension | Criterion | Observed evidence | Results |\n| --- | --- | --- | --- |\n'+table+'\n',encoding='utf-8')
print(json.dumps({'archive_sha256':digest,'criteria':len(rows),'receipt_lines_validated':line_checks,'all_solution_hashes_unchanged':True}))
