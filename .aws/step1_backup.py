#!/usr/bin/env python3
"""
Backup current Supabase Tokyo project.
Requires SUPABASE_DB_PASSWORD env var.
Output: backup.dump (custom format, ~10-50 MB)
"""
import os
import sys
import subprocess
import time

DB_HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
DB_PORT = "6543"
DB_USER = "postgres.hcswzmpqkhtqdwbhevqb"
DB_NAME = "postgres"
BACKUP_FILE = r"D:\supabase-tokyo-backup.dump"


def main():
    password = os.environ.get("SUPABASE_DB_PASSWORD")
    if not password:
        print("ERROR: Set SUPABASE_DB_PASSWORD env first:")
        print('  $env:SUPABASE_DB_PASSWORD="hoanghhk123."')
        sys.exit(1)

    # Set PGPASSWORD env for pg_dump
    env = os.environ.copy()
    env["PGPASSWORD"] = password

    # Check pg_dump exists
    pg = subprocess.run(["where", "pg_dump"], capture_output=True, text=True)
    if pg.returncode != 0:
        print("ERROR: pg_dump not in PATH. Install Postgres client tools first:")
        print("  https://www.postgresql.org/download/windows/")
        sys.exit(1)
    print("pg_dump path:", pg.stdout.strip())

    # Get table list first to gauge size
    print("\nDiscovering tables...")
    list_cmd = [
        "psql",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", DB_NAME,
        "-c", "SELECT schemaname,tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;",
    ]
    r = subprocess.run(list_cmd, env=env, capture_output=True, text=True)
    print(r.stdout)
    if r.returncode != 0:
        print("Connect error:", r.stderr)
        sys.exit(1)

    # Get table sizes
    print("\nGetting table sizes...")
    size_cmd = [
        "psql",
        "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME,
        "-c", "SELECT tablename, pg_size_pretty(pg_total_relation_size('\"'||tablename||'\"')) as size, n_live_tup FROM pg_tables JOIN pg_stat_user_tables USING(tablename) WHERE schemaname='public' ORDER BY pg_total_relation_size('\"'||tablename||'\"') DESC LIMIT 30;",
    ]
    subprocess.run(size_cmd, env=env, capture_output=False)

    # Run pg_dump with compression
    print(f"\n=== pg_dump → {BACKUP_FILE} ===")
    print("This may take 2-10 minutes depending on DB size...")
    start = time.time()
    dump_cmd = [
        "pg_dump",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", DB_NAME,
        "--schema=public",
        "--no-owner",     # don't preserve ownership
        "--no-privileges", # don't preserve grants
        "--clean",        # drop tables before recreating
        "--if-exists",
        "-Fc",            # custom format (compressed)
        "-f", BACKUP_FILE,
    ]
    r = subprocess.run(dump_cmd, env=env, capture_output=True, text=True)
    elapsed = time.time() - start
    if r.returncode != 0:
        print("pg_dump FAILED:")
        print(r.stderr)
        sys.exit(1)

    size = os.path.getsize(BACKUP_FILE) if os.path.exists(BACKUP_FILE) else 0
    print(f"\n✓ Backup complete in {elapsed:.1f}s")
    print(f"  File: {BACKUP_FILE} ({size/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()