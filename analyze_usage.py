import json, os
p = os.path.join('d:/2025.2/DA/food_suggest', 'cw_usage_metrics.json')
raw = open(p, 'rb').read()
text = raw.decode('utf-16') if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else raw.decode('utf-8')
d = json.loads(text)
ms = d.get('Metrics', [])

print('=' * 90)
print('[Service = CloudWatch] - All metrics')
print('=' * 90)
for m in ms:
    dims = m.get('Dimensions', [])
    service_dim = next((dim for dim in dims if dim.get('Name') == 'Service'), None)
    if not service_dim or service_dim.get('Value') != 'CloudWatch':
        continue
    parts = []
    for dim in dims:
        parts.append(f"{dim['Name']}={dim['Value']}")
    print(f"  {m.get('MetricName'):18s} | {' | '.join(parts)}")