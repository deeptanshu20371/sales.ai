
#!/usr/bin/env python3
"""
test_sqlite.py — Sanity tests & example queries for the Sales.ai SQLite DB.

Usage:
  python3 test_sqlite.py --db /absolute/path/to/genreach.db
  python3 test_sqlite.py --db ./genreach.db --limit 25 --export-queue ./queue.csv --demo-writes
"""
import argparse
import csv
import os
import sqlite3
import sys
from contextlib import closing

REQUIRED_TABLES = {
    "organization",
    "user",
    "campaign",
    "opportunity",
    "campaign_member",
    "message_attempt",
}

def connect(db_path: str) -> sqlite3.Connection:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    with closing(con.cursor()) as cur:
        cur.execute("PRAGMA foreign_keys = ON;")
        cur.execute("PRAGMA journal_mode = WAL;")
        cur.execute("PRAGMA synchronous = NORMAL;")
    return con

def print_db_info(con: sqlite3.Connection):
    path = con.execute("SELECT file FROM pragma_database_list WHERE name='main'").fetchone()[0]
    ver = con.execute("SELECT sqlite_version()").fetchone()[0]
    print(f"DB file     : {path}")
    print(f"SQLite ver  : {ver}\n")

def verify_schema(con: sqlite3.Connection):
    have = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    missing = sorted(list(REQUIRED_TABLES - have))
    if missing:
        print("[ERROR] Missing tables:", ', '.join(missing))
        print("        Run your schema initialization first (init_sqlite.py or .read schema.sql).\n")
        sys.exit(2)
    print("Schema check: OK (all required tables present)\n")

def show_counts(con: sqlite3.Connection):
    print("Row counts:")
    for t in sorted(REQUIRED_TABLES):
        c = con.execute(f"SELECT COUNT(*) AS c FROM {t}").fetchone()[0]
        print(f"  {t:17s} {c:5d}")
    print()

def list_pending(con: sqlite3.Connection, limit: int = 50):
    q = """
    SELECT cm.id AS campaign_member_id,
           o.full_name,
           o.email,
           o.li_profile_url,
           c.name AS campaign_name,
           cm.priority,
           cm.status,
           cm.created_at
    FROM campaign_member cm
    JOIN campaign c  ON c.id = cm.campaign_id
    JOIN opportunity o ON o.id = cm.opportunity_id
    WHERE cm.status = 'pending' AND c.status = 'running'
    ORDER BY cm.priority DESC, cm.created_at
    LIMIT ?;
    """
    rows = con.execute(q, (limit,)).fetchall()
    print(f"Pending queue (limit {limit}): {len(rows)} rows\n")
    for r in rows:
        print(f"  cm={r['campaign_member_id']} • {r['full_name']} <{r['email'] or '-'}> • camp={r['campaign_name']} • prio={r['priority']} • status={r['status']}")
    if not rows:
        print("  (none)\n")
    else:
        print()
    return rows

def export_queue_csv(rows, out_path: str):
    if not rows:
        print("Nothing to export (queue empty).\n")
        return
    keys = rows[0].keys()
    with open(out_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for r in rows:
            writer.writerow(dict(r))
    print(f"Exported queue to: {out_path}\n")

def _first(con: sqlite3.Connection, table: str):
    row = con.execute(f"SELECT * FROM {table} LIMIT 1").fetchone()
    return row

def demo_writes(con: sqlite3.Connection):
    print("-- Demo writes --")
    org = _first(con, "organization")
    if not org:
        raise SystemExit("No organization found; seed first.")
    org_id = org["id"]

    # Find or create a campaign in 'running' status
    camp = con.execute("SELECT * FROM campaign WHERE org_id=? AND status='running' LIMIT 1", (org_id,)).fetchone()
    if not camp:
        con.execute("""
            INSERT INTO campaign (id, org_id, name, status, throttle_per_hour, daily_send_limit)
            VALUES ('camp-auto', ?, 'Auto Campaign', 'running', 30, 100)
        """, (org_id,))
        camp = con.execute("SELECT * FROM campaign WHERE id='camp-auto'").fetchone()
    camp_id = camp["id"]

    # Insert a new opportunity with a unique email (append a counter until unique)
    base_email = "test.client@example.com"
    email = base_email
    i = 1
    while True:
        try:
            con.execute("""
                INSERT INTO opportunity (id, org_id, full_name, email, stage)
                VALUES ('opp-auto', ?, 'Test Client', ?, 'new')
            """, (org_id, email))
            break
        except sqlite3.IntegrityError:
            i += 1
            email = f"test.client+{i}@example.com"
            if i > 20:
                raise

    opp = con.execute("SELECT * FROM opportunity WHERE id='opp-auto'").fetchone()
    print(f"Inserted opportunity: {opp['id']} • {opp['full_name']} <{opp['email']}>\n")

    # Upsert campaign_member (org_id, campaign_id, opportunity_id)
    con.execute("""            INSERT INTO campaign_member (id, org_id, campaign_id, opportunity_id, status, priority)
        VALUES ('cm-auto', ?, ?, 'opp-auto', 'pending', 5)
        ON CONFLICT(org_id, campaign_id, opportunity_id)
        DO UPDATE SET status=excluded.status, updated_at=datetime('now')
    """, (org_id, camp_id))
    cm = con.execute("SELECT * FROM campaign_member WHERE id='cm-auto'").fetchone()
    print(f"Upserted campaign_member: {cm['id']} for campaign={camp_id}\n")

    # Add a message attempt (queued)
    con.execute("""            INSERT INTO message_attempt (id, org_id, campaign_member_id, status, message_body)
        VALUES ('ma-auto', ?, 'cm-auto', 'queued', 'Hello from demo_writes')
    """, (org_id,))
    ma = con.execute("SELECT * FROM message_attempt WHERE id='ma-auto'").fetchone()
    print(f"Inserted message_attempt: {ma['id']} status={ma['status']}\n")

    con.commit()
    print("Demo writes committed.\n")

def parse_args():
    ap = argparse.ArgumentParser(description="Test the Sales.ai SQLite database.")
    ap.add_argument("--db", default=os.environ.get("GENREACH_DB_PATH", "genreach.db"), help="Path to SQLite DB file")
    ap.add_argument("--limit", type=int, default=20, help="Limit for pending queue query")
    ap.add_argument("--export-queue", dest="export_queue", default=None, help="Optional CSV export path for pending queue")
    ap.add_argument("--demo-writes", action="store_true", help="Insert a sample opportunity, campaign_member, and message_attempt")
    return ap.parse_args()

def main():
    args = parse_args()
    if not os.path.exists(args.db):
        print(f"[ERROR] DB not found: {args.db}")
        sys.exit(1)

    con = connect(args.db)
    try:
        print_db_info(con)
        verify_schema(con)
        show_counts(con)
        rows = list_pending(con, args.limit)
        if args.export_queue:
            export_queue_csv(rows, args.export_queue)
        if args.demo_writes:
            demo_writes(con)
            show_counts(con)
            list_pending(con, args.limit)
    finally:
        con.close()

if __name__ == "__main__":
    main()
