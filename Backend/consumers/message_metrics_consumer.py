"""Consume message outbox events from Kafka and materialize load metrics in MySQL."""

import json
import os
import time
from datetime import datetime, timezone

from kafka import KafkaConsumer
import mysql.connector


KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
KAFKA_TOPIC = os.environ.get("MESSAGE_EVENT_TOPIC", "collabconnect.outbox.message.sent.v1")
KAFKA_GROUP_ID = os.environ.get("MESSAGE_METRICS_GROUP_ID", "message-load-metrics-v1")

MYSQL_HOST = os.environ.get("MYSQL_HOST", "db")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))
MYSQL_USER = os.environ.get("MYSQL_USER", "collab_user")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "")
MYSQL_DB = os.environ.get("MYSQL_DB", "collab_connect_db")


def _minute_bucket(timestamp_str):
    try:
        parsed = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        parsed = parsed.astimezone(timezone.utc)
    except Exception:
        parsed = datetime.now(timezone.utc)

    return parsed.replace(second=0, microsecond=0, tzinfo=None)


def _mysql_connection():
    return mysql.connector.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        autocommit=False,
    )


def _upsert_metrics(connection, event):
    event_time = event.get("event_time")
    sender_user_id = event.get("sender_user_id")
    payload_size_bytes = int(event.get("payload_size_bytes") or 0)

    minute_bucket = _minute_bucket(event_time)
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO MessageLoadMinute (minute_bucket, message_count, total_payload_bytes)
            VALUES (%s, 1, %s)
            ON DUPLICATE KEY UPDATE
                message_count = message_count + 1,
                total_payload_bytes = total_payload_bytes + VALUES(total_payload_bytes),
                updated_at = CURRENT_TIMESTAMP
            """,
            (minute_bucket, payload_size_bytes),
        )

        if sender_user_id is not None:
            cursor.execute(
                """
                INSERT INTO MessageLoadSenderMinute (minute_bucket, sender_user_id, message_count)
                VALUES (%s, %s, 1)
                ON DUPLICATE KEY UPDATE
                    message_count = message_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (minute_bucket, int(sender_user_id)),
            )

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()


def _build_consumer():
    return KafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=KAFKA_GROUP_ID,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )


def run():
    print(f"Starting message metrics consumer on topic={KAFKA_TOPIC}")

    while True:
        try:
            connection = _mysql_connection()
            consumer = _build_consumer()
            break
        except Exception as exc:
            print(f"Startup dependency not ready ({exc}); retrying in 5s")
            time.sleep(5)

    while True:
        try:
            records = consumer.poll(timeout_ms=1000, max_records=100)

            for _, batch in records.items():
                for message in batch:
                    event = message.value
                    if not isinstance(event, dict):
                        continue

                    _upsert_metrics(connection, event)
                    consumer.commit()
        except Exception as exc:
            print(f"Consumer loop error: {exc}")
            try:
                connection.close()
            except Exception:
                pass
            try:
                consumer.close()
            except Exception:
                pass
            time.sleep(3)

            while True:
                try:
                    connection = _mysql_connection()
                    consumer = _build_consumer()
                    break
                except Exception as reconnect_exc:
                    print(f"Reconnection failed ({reconnect_exc}); retrying in 5s")
                    time.sleep(5)


if __name__ == "__main__":
    run()
