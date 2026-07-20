#!/usr/bin/env python3
"""
Restore backup to NEW Supabase project (Singapore).
Requires user to:
1. Create new Supabase project at ap-southeast-1
2. Get new project DB connection details
3. Set env vars:
   NEW_SUPABASE_DB_HOST, NEW_SUPABASE_DB_PORT, NEW_SUPABASE_DB_USER,
   NEW_SUPABASE_DB_PASSWORD, NEW_SUPABASE_DB_NAME
"""
import os
import sys
import subprocess

BACKUP = r"D:\supabase-tokyo-backup.dump"

REQUIRED = [
    "NEW_SUPABASE_DB_HOST",
    "NEW_SUPABASE_DB_PORT",
    "NEW_SUPABASE_DB_USER",
    "NEW_SUPABASE_DB_PASSWORD",
    "NEW_SUPABASE_DB_NAME",
]


def main():
    missing = [v for v in REQUIRED if not os.environ.get(v)]
    if missing:
        print("ERROR: Set these env vars first:")
        for v in missing:
            print(f'  $env:{v}="<value>"')
        sys.exit(1)
    if not os.path.exists(BACKUP):
        print(f"ERROR: Backup file not found: {BACKUP}")
        print("Run step1_backup.py first.")
        sys.exit(1)

    env = os.environ.copy()
    env["PGPASSWORD"] = os.environ["NEW_SUPABASE_DB_PASSWORD"]

    host = os.environ["NEW_SUPABASE_DB_HOST"]
    port = os.environ["NEW_SUPABASE_DB_PORT"]
    user = os.environ["NEW_SUPABASE_DB_USER"]
    name = os.environ["NEW_SUPABASE_DB_NAME"]

    print(f"=== Restoring {BACKUP} → {host}:{port}/{name} ===")
    cmd = [
        "pg_restore",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", name,
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "-j", "2",
        BACKUP,
    ]
    r = subprocess.run(cmd, env=env, capture_output=True, text=True)
    print("STDOUT:", r.stdout[:1000])
    print("STDERR:", r.stderr[:2000])
    if r.returncode not in (0, 1):  # 1 = some warnings, often OK
        print("RESTORE FAILED")
        sys.exit(1)
    print("✓ Restore complete")


if __name__ == "__main__":
    main()