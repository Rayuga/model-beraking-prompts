from pathlib import Path
import csv
import io
import json

task = Path('projects/ridgeline-print-storefront')
assets = task / 'environment/assets'
variants = list(csv.DictReader((assets / 'variants.csv').read_text().splitlines()))
for row in variants:
    for key in ('price_pence', 'in_stock', 'tier_qty', 'tier_price_pence'):
        row[key] = int(row[key])
blocks = (assets / 'postage.csv').read_text().strip().split('\n\n')
bands = list(csv.DictReader(io.StringIO(blocks[0])))
for i, band in enumerate(bands):
    band.update(up_to_grams=int(band['up_to_grams']), price_pence=int(band['price_pence']), sort_order=i)
weights = [{**row, 'grams': int(row['grams'])} for row in csv.DictReader(io.StringIO(blocks[1]))]
historical = {
    'reference': 'RP-100001', 'placed_at': '2026-05-04T09:15:00.000Z', 'status': 'dispatched',
    'address_name': 'Elena Marsh', 'address_line1': '14 Foundry Row', 'address_line2': '',
    'address_city': 'Bristol', 'address_postcode': 'BS1 4ND', 'address_country': 'United Kingdom',
    'subtotal_pence': 7000, 'trade_saving_pence': 0, 'weight_grams': 180,
    'postage_band': 'Large letter', 'postage_pence': 320, 'collection_only': 0, 'total_pence': 7320,
    'lines': [{'sku':'RP-101','size':'A3','title':'Long Field','stock_sheet':'Colorplan Pristine White 270gsm',
               'qty':2,'unit_price_pence':3500,'base_unit_price_pence':3500,'trade_applied':0,'line_total_pence':7000}]
}
seed = {'shop': 'Ridgeline Press', 'currency': 'GBP', 'variants': variants,
        'postage_bands': bands, 'size_weights': weights, 'orders': [historical]}
data = json.dumps(seed, indent=2, ensure_ascii=False) + '\n'
(assets / 'seed_data.json').write_text(data, encoding='utf-8')
(task / 'solution/app/seed_data.json').write_text(data, encoding='utf-8')
print('Created canonical seed: 13 variants, 8 prints, 4 postage bands, 1 historical order')
