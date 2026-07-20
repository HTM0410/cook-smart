"""Helper để tạo task definition JSON mới từ task hiện tại.

Loại bỏ các env var YOLO_TIMEOUT và YOLO_MAX_RETRIES (để fallback về default 30s/2)
và thêm YOLO_INFERENCE_TIMEOUT=30000, YOLO_RETRY_DELAY=1500.
"""
import json
import subprocess

REV = 21

def load_current_td():
    out = subprocess.check_output([
        'aws', 'ecs', 'describe-task-definition',
        '--task-definition', f'cooksmart-backend-task:{REV}',
        '--region', 'ap-southeast-1',
        '--query', 'taskDefinition',
    ])
    return json.loads(out)

def main():
    td = load_current_td()
    if td is None:
        raise SystemExit('Failed to load current task def')

    # Filter env: bỏ các override gây hại, thêm giá trị mới
    DROP = {'YOLO_TIMEOUT', 'YOLO_MAX_RETRIES'}
    ADD = {
        'YOLO_INFERENCE_TIMEOUT': '30000',
        'YOLO_RETRY_DELAY': '1500',
    }

    for c in td['containerDefinitions']:
        env = c.get('environment', [])
        env = [e for e in env if e['name'] not in DROP]
        # Ensure no duplicate
        env_names = {e['name'] for e in env}
        for k, v in ADD.items():
            if k not in env_names:
                env.append({'name': k, 'value': v})
        c['environment'] = env
        c['image'] = '294060270105.dkr.ecr.ap-southeast-1.amazonaws.com/cooksmart-backend:fix-yolo-timeout'
        # Container-level memoryReservation (task-level memory is shared)
        c.setdefault('memoryReservation', 1024)

    # Strip fields AWS auto-fills (read-only) but KEEP cpu/memory (required for Fargate).
    for k in [
        'taskDefinitionArn', 'revision', 'status', 'requiresAttributes',
        'compatibilities', 'registeredAt', 'registeredBy',
        'inferenceAccelerators', 'ephemeralStorage',
    ]:
        td.pop(k, None)

    out_path = r'C:\Users\Admin\AppData\Local\Temp\new-td.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(td, f, indent=2, ensure_ascii=False)

    # Quick check
    new_env = td['containerDefinitions'][0]['environment']
    yolo_env = [e for e in new_env if 'YOLO' in e['name']]
    print('YOLO env vars in new TD:')
    for e in yolo_env:
        print(f"  {e['name']}={e['value']}")
    print(f'Wrote {out_path}')

if __name__ == '__main__':
    main()
