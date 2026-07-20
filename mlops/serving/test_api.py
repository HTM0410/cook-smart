import os
os.environ['WANDB_SERVICE'] = 'false'
import wandb

# Login
key = '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'
wandb.login(key=key)

api = wandb.Api(timeout=60)

print('Logged in successfully')
print(f'API timeout: {60}')

# Try to list projects
try:
    for p in api.projects():
        print(f'Project: {p.name}')
except Exception as e:
    print(f'Error listing projects: {e}')
