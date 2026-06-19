"""Create verified dummy users/person profiles for message-load simulation."""

import argparse
import os

from werkzeug.security import generate_password_hash
import mysql.connector


def _connection():
    return mysql.connector.connect(
        host=os.environ.get("MYSQL_HOST", "db"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "collab_user"),
        password=os.environ.get("MYSQL_PASSWORD", ""),
        database=os.environ.get("MYSQL_DB", "collab_connect_db"),
        autocommit=False,
    )


def ensure_dummy_accounts(prefix: str, count: int, password: str):
    connection = _connection()
    cursor = connection.cursor(dictionary=True)

    try:
        for index in range(1, count + 1):
            email = f"{prefix}{index:04d}@example.local"
            name = f"{prefix.capitalize()} User {index:04d}"
            main_field = "Simulation"

            cursor.execute("SELECT user_id FROM User WHERE email = %s", (email,))
            existing_user = cursor.fetchone()

            if existing_user:
                print(f"Skipping existing user {email}")
                continue

            cursor.execute(
                """
                INSERT INTO Person (person_name, person_email, main_field)
                VALUES (%s, %s, %s)
                """,
                (name, email, main_field),
            )
            person_id = cursor.lastrowid

            cursor.execute(
                """
                INSERT INTO User (person_id, email, password_hash, is_verified)
                VALUES (%s, %s, %s, TRUE)
                """,
                (person_id, email, generate_password_hash(password)),
            )
            print(f"Created {email} (person_id={person_id})")

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed dummy verified users for messaging simulation")
    parser.add_argument("--prefix", default="simuser", help="Email/name prefix")
    parser.add_argument("--count", type=int, default=50, help="Number of dummy accounts to create")
    parser.add_argument("--password", default="SimPass1234", help="Password for all dummy accounts")
    args = parser.parse_args()

    ensure_dummy_accounts(args.prefix, args.count, args.password)
