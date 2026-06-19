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


def _index_exists(cursor, table_name, index_name):
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = %s
          AND index_name = %s
        LIMIT 1
        """,
        (table_name, index_name),
    )
    return cursor.fetchone() is not None


def _ensure_outbox_and_metrics_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS MessageOutbox (
            id CHAR(36) PRIMARY KEY,
            aggregatetype VARCHAR(100) NOT NULL,
            aggregateid VARCHAR(100) NOT NULL,
            type VARCHAR(100) NOT NULL,
            payload JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS MessageLoadMinute (
            minute_bucket DATETIME NOT NULL PRIMARY KEY,
            message_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            total_payload_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS MessageLoadSenderMinute (
            minute_bucket DATETIME NOT NULL,
            sender_user_id BIGINT UNSIGNED NOT NULL,
            message_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (minute_bucket, sender_user_id),
            CONSTRAINT fk_message_load_sender_user
                FOREIGN KEY (sender_user_id) REFERENCES User(user_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        )
        """
    )

    if not _index_exists(cursor, "MessageOutbox", "idx_message_outbox_created"):
        cursor.execute("CREATE INDEX idx_message_outbox_created ON MessageOutbox(created_at DESC)")
    if not _index_exists(cursor, "MessageOutbox", "idx_message_outbox_type_created"):
        cursor.execute("CREATE INDEX idx_message_outbox_type_created ON MessageOutbox(type, created_at DESC)")
    if not _index_exists(cursor, "MessageLoadSenderMinute", "idx_message_load_sender_minute"):
        cursor.execute(
            "CREATE INDEX idx_message_load_sender_minute ON MessageLoadSenderMinute(sender_user_id, minute_bucket DESC)"
        )


def main():
    with app.app_context():
        cursor = mysql.connection.cursor()
        try:
            if _table_exists(cursor, "Institution"):
                _ensure_outbox_and_metrics_schema(cursor)
                mysql.connection.commit()
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
            _ensure_outbox_and_metrics_schema(cursor)
            mysql.connection.commit()
            print("Database initialization complete.")
            return 0
        finally:
            cursor.close()


if __name__ == "__main__":
    raise SystemExit(main())