import json
import os

path = os.path.join(os.environ['TEMP'], 'cw_quotas.json')
with open(path, 'rb') as f:
    raw = f.read()
data = json.loads(raw.decode('utf-16'))

quotas = data['Quotas']
print(f'Total CloudWatch quotas: {len(quotas)}')
print('=' * 100)
# Non-rate quotas
print('\n[NON-RATE QUOTAS]')
for q in quotas:
    if 'Rate of' not in q['QuotaName']:
        print(f"  {q['QuotaName']:75s} | Value: {q['Value']:>10} {q['Unit']}")