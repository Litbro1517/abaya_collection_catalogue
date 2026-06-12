import json, sys

data = json.load(sys.stdin)

print('='*70)
print('RAPPORT DINSPECTION PRODUCTION POSTGRESQL')
print('='*70)
print(f'Timestamp: {data["timestamp"]}')
print(f'Database: {data["databaseProvider"]}')
print()

# Data Sources
print('--- DATA SOURCES ---')
for ds in data['dataSources']:
    print(f'  - {ds["name"]} (id: {ds["id"]})')
print()

# RELATION Columns
print('--- COLONNES RELATION - INSPECTION COMPLETE ---')
for i, rc in enumerate(data['relationColumns']):
    col = rc['relationColumn']
    print(f'')
    print(f'  RELATION #{i+1}: "{col["name"]}" (slug: {col["slug"]})')
    print(f'  dataSourceId: {col["dataSourceId"]}')
    print(f'  config: {json.dumps(col["config"], ensure_ascii=False)}')
    print(f'  targetTableId: {rc["targetTableId"]}')
    print(f'  targetColumnsCount: {rc["targetColumnsCount"]}')
    print(f'  effectivePivotSlug: {rc["effectivePivotSlug"]}')
    print(f'  pivotSource: {rc["pivotSource"]}')

    # Show TEXT columns in target
    text_cols = [c for c in rc['targetColumns'] if c['type'] == 'TEXT']
    visible_text_cols = [c for c in text_cols if c['visible']]
    print(f'  TEXT columns (all): {len(text_cols)}')
    for tc in text_cols:
        vis = 'VISIBLE' if tc['visible'] else 'HIDDEN'
        print(f'    - {tc["slug"]} ({tc["name"]}) - {vis}, order={tc["order"]}')
    print(f'  TEXT columns (visible only): {len(visible_text_cols)}')
    for tc in visible_text_cols:
        print(f'    - {tc["slug"]} ({tc["name"]}) - VISIBLE, order={tc["order"]}')
print()

# Lookup simulation
print('--- SIMULATION DU LOOKUP (relationLookupMap) ---')
if data.get('lookupSimulation'):
    sim = data['lookupSimulation']
    print(f'  effectivePivotSlug: {sim["effectivePivotSlug"]}')
    print(f'  Match count: {sim["matchCount"]}/{sim["totalChecked"]}')
    print(f'  Lookup map (first 10):')
    for key, val in list(sim['lookupMapPreview'].items())[:10]:
        key_disp = key[:60] + '...' if len(key) > 60 else key
        val_disp = val[:60] + '...' if len(val) > 60 else val
        print(f'    "{key_disp}" -> "{val_disp}"')
    print(f'  Source cell values:')
    for cv in sim['sourceCellValues']:
        raw = str(cv.get('rawValue', ''))[:80]
        print(f'    rawValue: "{raw}" -> resolved: {cv["resolved"]}')
else:
    print('  No lookup simulation available')
print()

# Sample row
print('--- SAMPLE ROW (main datasource) ---')
if data.get('sampleRowFromMainDs'):
    sr = data['sampleRowFromMainDs']
    print(f'  id: {sr["id"]}')
    all_keys = list(sr.get('data', {}).keys())
    print(f'  data keys count: {len(all_keys)}')
    # Show RELATION cell values specifically
    for rc in data['relationColumns']:
        slug = rc['relationColumn']['slug']
        val = sr.get('data', {}).get(slug)
        print(f'  RELATION cell [{slug}]: "{val}"')
else:
    print('  No sample row')
print()

# Target sample rows
print('--- TARGET TABLE SAMPLE ROWS ---')
if data.get('targetSampleRows'):
    for i, tr in enumerate(data['targetSampleRows'][:3]):
        td = tr.get('data', {})
        print(f'  Target row #{i+1} (id: {tr["id"]}):')
        # Show TEXT column values
        for rc in data['relationColumns']:
            for tc in rc['targetColumns']:
                if tc['type'] == 'TEXT':
                    val = td.get(tc['slug'], '(empty)')
                    val_str = str(val)[:80]
                    print(f'    {tc["slug"]}: "{val_str}"')
                    break  # just first TEXT col per relation
else:
    print('  No target sample rows')
