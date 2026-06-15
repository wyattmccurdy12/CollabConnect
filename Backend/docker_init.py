"""One-shot Docker initialization for CollabConnect."""

import sys

from app import app, mysql
from db_init import create_functions, create_procedures, create_tables, insert_initial_data


def _table_exists(cursor, table_name):
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def _institution_count(cursor):
    cursor.execute("SELECT COUNT(*) AS count FROM Institution")
    row = cursor.fetchone()
    return int(row["count"]) if row else 0


def main():
    with app.app_context():
        cursor = mysql.connection.cursor()
        try:
            if _table_exists(cursor, "Institution"):
                if _institution_count(cursor) > 0:
                    print("Database already seeded; skipping initialization.")
                    return 0
                print("Schema exists but appears empty; seed loading is skipped to avoid partial re-creation.")
                return 1

            print("Creating schema, procedures, functions, and seed data...")
            create_tables(cursor)
            create_procedures()
            create_functions()
            insert_initial_data()
            print("Database initialization complete.")
            return 0
        finally:
            cursor.close()


if __name__ == "__main__":
    raise SystemExit(main())