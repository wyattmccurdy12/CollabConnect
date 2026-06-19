"""Messaging routes for direct researcher-to-researcher conversations."""

import json
from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request

from utils.jwt_utils import token_required
from utils.logger import log_error, log_info
from utils.validators import sanitize_string, validate_string_length

messages_bp = Blueprint("messages", __name__, url_prefix="/messages")


def _db():
    from app import mysql

    return mysql


def _current_user_context():
    user_id = request.current_user.get("user_id")
    person_id = request.current_user.get("person_id")

    if not person_id:
        return None, None, (jsonify({"status": "error", "message": "Messaging requires a linked profile"}), 403)

    return user_id, person_id, None


def _conversation_key(first_user_id, second_user_id):
    participant_ids = sorted([int(first_user_id), int(second_user_id)])
    return f"{participant_ids[0]}:{participant_ids[1]}"


def _serialize_message(row):
    return {
        "message_id": row["message_id"],
        "conversation_id": row["conversation_id"],
        "sender_user_id": row["sender_user_id"],
        "sender_person_id": row.get("sender_person_id"),
        "sender_name": row.get("sender_name"),
        "sender_email": row.get("sender_email"),
        "body": row["body"],
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]) if row.get("updated_at") else None,
        "read_at": str(row["read_at"]) if row.get("read_at") else None,
    }


def _serialize_conversation(row):
    return {
        "conversation_id": row["conversation_id"],
        "conversation_key": row["conversation_key"],
        "participant_a_user_id": row["participant_a_user_id"],
        "participant_b_user_id": row["participant_b_user_id"],
        "created_by_user_id": row["created_by_user_id"],
        "last_message_id": row.get("last_message_id"),
        "last_message_preview": row.get("last_message_preview"),
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]) if row.get("updated_at") else None,
        "last_message_at": str(row["last_message_at"]) if row.get("last_message_at") else None,
        "other_user_id": row.get("other_user_id"),
        "other_person_id": row.get("other_person_id"),
        "other_person_name": row.get("other_person_name"),
        "other_person_email": row.get("other_person_email"),
        "unread_count": int(row.get("unread_count") or 0),
    }


def _load_recipient(cursor, recipient_person_id):
    cursor.execute(
        """
        SELECT u.user_id, u.person_id, p.person_name, p.person_email
        FROM User u
        INNER JOIN Person p ON p.person_id = u.person_id
        WHERE u.person_id = %s
        LIMIT 1
        """,
        (recipient_person_id,),
    )
    return cursor.fetchone()


def _get_conversation(cursor, conversation_id, current_user_id):
    cursor.execute(
        """
        SELECT conversation_id, conversation_key, participant_a_user_id, participant_b_user_id,
               created_by_user_id, last_message_id, last_message_preview,
               created_at, updated_at, last_message_at
        FROM Conversation
        WHERE conversation_id = %s
          AND (%s IN (participant_a_user_id, participant_b_user_id))
        LIMIT 1
        """,
        (conversation_id, current_user_id),
    )
    return cursor.fetchone()


def _find_conversation(cursor, conversation_key):
    cursor.execute(
        """
        SELECT conversation_id, conversation_key, participant_a_user_id, participant_b_user_id,
               created_by_user_id, last_message_id, last_message_preview,
               created_at, updated_at, last_message_at
        FROM Conversation
        WHERE conversation_key = %s
        LIMIT 1
        """,
        (conversation_key,),
    )
    return cursor.fetchone()


def _create_conversation(cursor, sender_user_id, recipient_user_id, conversation_key):
    participant_a_user_id, participant_b_user_id = sorted([int(sender_user_id), int(recipient_user_id)])
    cursor.execute(
        """
        INSERT INTO Conversation (
            conversation_key,
            participant_a_user_id,
            participant_b_user_id,
            created_by_user_id,
            last_message_at
        )
        VALUES (%s, %s, %s, %s, NOW())
        """,
        (conversation_key, participant_a_user_id, participant_b_user_id, sender_user_id),
    )
    return cursor.lastrowid


def _insert_message(cursor, conversation_id, sender_user_id, sender_person_id, body):
    cursor.execute(
        """
        INSERT INTO Message (
            conversation_id,
            sender_user_id,
            sender_person_id,
            body,
            created_at
        )
        VALUES (%s, %s, %s, %s, NOW())
        """,
        (conversation_id, sender_user_id, sender_person_id, body),
    )
    message_id = cursor.lastrowid
    cursor.execute(
        """
        UPDATE Conversation
        SET last_message_id = %s,
            last_message_preview = %s,
            last_message_at = NOW()
        WHERE conversation_id = %s
        """,
        (message_id, body[:280], conversation_id),
    )
    return message_id


def _insert_outbox_event(cursor, event_type, aggregate_id, payload):
    cursor.execute(
        """
        INSERT INTO MessageOutbox (id, aggregatetype, aggregateid, type, payload)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            str(uuid4()),
            "message",
            str(aggregate_id),
            event_type,
            json.dumps(payload),
        ),
    )


@messages_bp.route("/inbox", methods=["GET"])
@token_required
def get_inbox():
    """Return the authenticated user's conversations ordered by recency."""

    user_id, _, error_response = _current_user_context()
    if error_response:
        return error_response

    mysql = _db()
    cursor = None
    try:
        log_info(f"Loading message inbox for user_id={user_id}")
        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            SELECT
                c.conversation_id,
                c.conversation_key,
                c.participant_a_user_id,
                c.participant_b_user_id,
                c.created_by_user_id,
                c.last_message_id,
                c.last_message_preview,
                c.created_at,
                c.updated_at,
                c.last_message_at,
                CASE
                    WHEN c.participant_a_user_id = %s THEN c.participant_b_user_id
                    ELSE c.participant_a_user_id
                END AS other_user_id,
                other_user.person_id AS other_person_id,
                other_person.person_name AS other_person_name,
                other_person.person_email AS other_person_email,
                COALESCE(unread.unread_count, 0) AS unread_count
            FROM Conversation c
            INNER JOIN User other_user
                ON other_user.user_id = CASE
                    WHEN c.participant_a_user_id = %s THEN c.participant_b_user_id
                    ELSE c.participant_a_user_id
                END
            LEFT JOIN Person other_person ON other_person.person_id = other_user.person_id
            LEFT JOIN (
                SELECT conversation_id, COUNT(*) AS unread_count
                FROM Message
                WHERE sender_user_id != %s
                  AND read_at IS NULL
                  AND deleted_at IS NULL
                GROUP BY conversation_id
            ) unread ON unread.conversation_id = c.conversation_id
            WHERE c.participant_a_user_id = %s OR c.participant_b_user_id = %s
            ORDER BY c.last_message_at DESC, c.updated_at DESC, c.conversation_id DESC
            """,
            (user_id, user_id, user_id, user_id, user_id),
        )
        conversations = [_serialize_conversation(row) for row in cursor.fetchall()]
        mysql.connection.commit()
        return jsonify({"status": "success", "data": conversations, "count": len(conversations)}), 200
    except Exception as exc:
        mysql.connection.rollback()
        log_error(f"Failed to load inbox for user_id={user_id}: {exc}")
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()


@messages_bp.route("/conversations", methods=["POST"])
@token_required
def create_or_send_message():
    """Create a direct conversation if needed and optionally send its first message."""

    user_id, person_id, error_response = _current_user_context()
    if error_response:
        return error_response

    data = request.get_json(silent=True) or {}
    recipient_person_id = data.get("recipient_person_id")
    body = sanitize_string(data.get("body"))

    try:
        recipient_person_id = int(recipient_person_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "recipient_person_id must be a valid integer"}), 400

    if not recipient_person_id:
        return jsonify({"status": "error", "message": "recipient_person_id is required"}), 400

    if body:
        valid, message = validate_string_length(body, "Message body", min_length=1, max_length=5000)
        if not valid:
            return jsonify({"status": "error", "message": message}), 400

    if recipient_person_id == int(person_id):
        return jsonify({"status": "error", "message": "You cannot message your own profile"}), 400

    mysql = _db()
    cursor = None
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("START TRANSACTION")

        recipient = _load_recipient(cursor, recipient_person_id)
        if not recipient:
            mysql.connection.rollback()
            return jsonify({"status": "not_found", "message": "Recipient profile must be linked to a user account"}), 404

        recipient_user_id = recipient["user_id"]
        conversation_key = _conversation_key(user_id, recipient_user_id)

        conversation = _find_conversation(cursor, conversation_key)
        if not conversation:
            conversation_id = _create_conversation(cursor, user_id, recipient_user_id, conversation_key)
            conversation = {
                "conversation_id": conversation_id,
                "conversation_key": conversation_key,
                "participant_a_user_id": min(int(user_id), int(recipient_user_id)),
                "participant_b_user_id": max(int(user_id), int(recipient_user_id)),
                "created_by_user_id": user_id,
                "last_message_id": None,
                "last_message_preview": None,
                "created_at": None,
                "updated_at": None,
                "last_message_at": None,
            }
        else:
            conversation_id = conversation["conversation_id"]

        message_payload = None
        if body:
            message_id = _insert_message(cursor, conversation_id, user_id, person_id, body)
            simulation_run_id = request.headers.get("X-Simulation-Run-Id")
            _insert_outbox_event(
                cursor,
                "message.sent.v1",
                conversation_id,
                {
                    "event_time": datetime.now(timezone.utc).isoformat(),
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "sender_user_id": user_id,
                    "sender_person_id": person_id,
                    "payload_size_bytes": len(body.encode("utf-8")),
                    "simulation_run_id": simulation_run_id,
                    "source": "api",
                },
            )
            cursor.execute(
                """
                SELECT message_id, conversation_id, sender_user_id, sender_person_id, body,
                       created_at, updated_at, read_at
                FROM Message
                WHERE message_id = %s
                LIMIT 1
                """,
                (message_id,),
            )
            message_payload = _serialize_message(cursor.fetchone())

        cursor.execute(
            """
            SELECT
                c.conversation_id,
                c.conversation_key,
                c.participant_a_user_id,
                c.participant_b_user_id,
                c.created_by_user_id,
                c.last_message_id,
                c.last_message_preview,
                c.created_at,
                c.updated_at,
                c.last_message_at,
                CASE
                    WHEN c.participant_a_user_id = %s THEN c.participant_b_user_id
                    ELSE c.participant_a_user_id
                END AS other_user_id,
                other_user.person_id AS other_person_id,
                other_person.person_name AS other_person_name,
                other_person.person_email AS other_person_email,
                0 AS unread_count
            FROM Conversation c
            INNER JOIN User other_user
                ON other_user.user_id = CASE
                    WHEN c.participant_a_user_id = %s THEN c.participant_b_user_id
                    ELSE c.participant_a_user_id
                END
            LEFT JOIN Person other_person ON other_person.person_id = other_user.person_id
            WHERE c.conversation_id = %s
            LIMIT 1
            """,
            (user_id, user_id, conversation_id),
        )
        conversation_payload = _serialize_conversation(cursor.fetchone())

        mysql.connection.commit()
        status_code = 201 if message_payload else 200
        message_text = "Message sent" if message_payload else "Conversation ready"
        return jsonify({
            "status": "success",
            "message": message_text,
            "data": {
                "conversation": conversation_payload,
                "message": message_payload,
            },
        }), status_code
    except Exception as exc:
        mysql.connection.rollback()
        log_error(f"Failed to create/send message for user_id={user_id}: {exc}")
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()


@messages_bp.route("/conversations/<int:conversation_id>/messages", methods=["GET"])
@token_required
def get_conversation_messages(conversation_id):
    """Fetch paginated messages for a conversation the user belongs to."""

    user_id, _, error_response = _current_user_context()
    if error_response:
        return error_response

    page = max(int(request.args.get("page", 1)), 1)
    page_size = min(max(int(request.args.get("page_size", 50)), 1), 200)
    offset = (page - 1) * page_size

    mysql = _db()
    cursor = None
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            SELECT conversation_id
            FROM Conversation
            WHERE conversation_id = %s
              AND (%s IN (participant_a_user_id, participant_b_user_id))
            LIMIT 1
            """,
            (conversation_id, user_id),
        )
        if not cursor.fetchone():
            return jsonify({"status": "not_found", "message": "Conversation not found"}), 404

        cursor.execute(
            """
            SELECT
                m.message_id,
                m.conversation_id,
                m.sender_user_id,
                m.sender_person_id,
                m.body,
                m.created_at,
                m.updated_at,
                m.read_at,
                p.person_name AS sender_name,
                p.person_email AS sender_email
            FROM Message m
            INNER JOIN User u ON u.user_id = m.sender_user_id
            LEFT JOIN Person p ON p.person_id = u.person_id
            WHERE m.conversation_id = %s
              AND m.deleted_at IS NULL
            ORDER BY m.created_at ASC, m.message_id ASC
            LIMIT %s OFFSET %s
            """,
            (conversation_id, page_size, offset),
        )

        messages = [_serialize_message(row) for row in cursor.fetchall()]
        return jsonify({"status": "success", "data": messages, "count": len(messages), "page": page, "page_size": page_size}), 200
    except Exception as exc:
        log_error(f"Failed to fetch conversation {conversation_id}: {exc}")
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()


@messages_bp.route("/conversations/<int:conversation_id>/messages", methods=["POST"])
@token_required
def send_conversation_message(conversation_id):
    """Send a message into an existing conversation."""

    user_id, person_id, error_response = _current_user_context()
    if error_response:
        return error_response

    data = request.get_json(silent=True) or {}
    body = sanitize_string(data.get("body"))

    if not body:
        return jsonify({"status": "error", "message": "Message body is required"}), 400

    valid, message = validate_string_length(body, "Message body", min_length=1, max_length=5000)
    if not valid:
        return jsonify({"status": "error", "message": message}), 400

    mysql = _db()
    cursor = None
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("START TRANSACTION")

        conversation = _get_conversation(cursor, conversation_id, user_id)
        if not conversation:
            mysql.connection.rollback()
            return jsonify({"status": "not_found", "message": "Conversation not found"}), 404

        message_id = _insert_message(cursor, conversation_id, user_id, person_id, body)

        simulation_run_id = request.headers.get("X-Simulation-Run-Id")
        _insert_outbox_event(
            cursor,
            "message.sent.v1",
            conversation_id,
            {
                "event_time": datetime.now(timezone.utc).isoformat(),
                "message_id": message_id,
                "conversation_id": conversation_id,
                "sender_user_id": user_id,
                "sender_person_id": person_id,
                "payload_size_bytes": len(body.encode("utf-8")),
                "simulation_run_id": simulation_run_id,
                "source": "api",
            },
        )

        cursor.execute(
            """
            SELECT message_id, conversation_id, sender_user_id, sender_person_id, body,
                   created_at, updated_at, read_at
            FROM Message
            WHERE message_id = %s
            LIMIT 1
            """,
            (message_id,),
        )
        message_payload = _serialize_message(cursor.fetchone())
        mysql.connection.commit()

        return jsonify({"status": "success", "message": "Message sent", "data": message_payload}), 201
    except Exception as exc:
        mysql.connection.rollback()
        log_error(f"Failed to send message in conversation {conversation_id}: {exc}")
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()


@messages_bp.route("/conversations/<int:conversation_id>/read", methods=["POST"])
@token_required
def mark_conversation_read(conversation_id):
    """Mark all unread incoming messages in a conversation as read."""

    user_id, _, error_response = _current_user_context()
    if error_response:
        return error_response

    mysql = _db()
    cursor = None
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("START TRANSACTION")

        cursor.execute(
            """
            SELECT conversation_id
            FROM Conversation
            WHERE conversation_id = %s
              AND (%s IN (participant_a_user_id, participant_b_user_id))
            LIMIT 1
            """,
            (conversation_id, user_id),
        )
        if not cursor.fetchone():
            mysql.connection.rollback()
            return jsonify({"status": "not_found", "message": "Conversation not found"}), 404

        cursor.execute(
            """
            UPDATE Message
            SET read_at = NOW()
            WHERE conversation_id = %s
              AND sender_user_id != %s
              AND read_at IS NULL
              AND deleted_at IS NULL
            """,
            (conversation_id, user_id),
        )
        updated_rows = int(getattr(cursor, "rowcount", 0) or 0)

        if updated_rows > 0:
            simulation_run_id = request.headers.get("X-Simulation-Run-Id")
            _insert_outbox_event(
                cursor,
                "message.read.v1",
                conversation_id,
                {
                    "event_time": datetime.now(timezone.utc).isoformat(),
                    "conversation_id": conversation_id,
                    "reader_user_id": user_id,
                    "read_messages_count": int(updated_rows),
                    "simulation_run_id": simulation_run_id,
                    "source": "api",
                },
            )
        mysql.connection.commit()

        return jsonify({"status": "success", "message": "Conversation marked as read"}), 200
    except Exception as exc:
        mysql.connection.rollback()
        log_error(f"Failed to mark conversation {conversation_id} as read: {exc}")
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()