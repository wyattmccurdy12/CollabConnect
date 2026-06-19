from types import SimpleNamespace

import app as app_module
from utils.jwt_utils import generate_access_token


class DummyCursor:
    def __init__(self, responses=None, rowcount=1):
        self.responses = list(responses or [])
        self.executed = []
        self.callprocs = []
        self.closed = False
        self.lastrowid = 1001
        self.rowcount = rowcount

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        if self.responses:
            return self.responses.pop(0)
        return None

    def fetchall(self):
        if self.responses:
            value = self.responses.pop(0)
            return value if value is not None else []
        return []

    def nextset(self):
        return False

    def close(self):
        self.closed = True


class DummyConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _set_mock_mysql(monkeypatch, cursor):
    monkeypatch.setattr(
        app_module,
        "mysql",
        SimpleNamespace(connection=DummyConnection(cursor)),
        raising=True,
    )


def _client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_messages_inbox_requires_linked_profile(monkeypatch):
    cursor = DummyCursor()
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(10, "researcher@example.com")
    response = _client().get(
        "/messages/inbox",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.get_json()["message"] == "Messaging requires a linked profile"


def test_messages_inbox_returns_conversations(monkeypatch):
    cursor = DummyCursor([
        [{
            "conversation_id": 5,
            "conversation_key": "10:11",
            "participant_a_user_id": 10,
            "participant_b_user_id": 11,
            "created_by_user_id": 10,
            "last_message_id": 88,
            "last_message_preview": "Hello there",
            "created_at": "2026-06-16 12:00:00",
            "updated_at": "2026-06-16 12:01:00",
            "last_message_at": "2026-06-16 12:01:00",
            "other_user_id": 11,
            "other_person_id": 22,
            "other_person_name": "Dr. Collaborator",
            "other_person_email": "collaborator@example.com",
            "unread_count": 2,
        }],
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(10, "researcher@example.com", person_id=22)
    response = _client().get(
        "/messages/inbox",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["count"] == 1
    assert body["data"][0]["conversation_id"] == 5
    assert body["data"][0]["unread_count"] == 2


def test_create_or_send_message_creates_thread(monkeypatch):
    cursor = DummyCursor([
        {
            "user_id": 11,
            "person_id": 22,
            "person_name": "Dr. Collaborator",
            "person_email": "collaborator@example.com",
        },
        None,
        {
            "message_id": 1001,
            "conversation_id": 77,
            "sender_user_id": 10,
            "sender_person_id": 44,
            "body": "Hello from CollabConnect",
            "created_at": "2026-06-16 12:05:00",
            "updated_at": "2026-06-16 12:05:00",
            "read_at": None,
            "sender_name": "Researcher One",
            "sender_email": "researcher@example.com",
        },
        {
            "conversation_id": 77,
            "conversation_key": "10:11",
            "participant_a_user_id": 10,
            "participant_b_user_id": 11,
            "created_by_user_id": 10,
            "last_message_id": 1001,
            "last_message_preview": "Hello from CollabConnect",
            "created_at": "2026-06-16 12:05:00",
            "updated_at": "2026-06-16 12:05:00",
            "last_message_at": "2026-06-16 12:05:00",
            "other_user_id": 11,
            "other_person_id": 22,
            "other_person_name": "Dr. Collaborator",
            "other_person_email": "collaborator@example.com",
        },
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(10, "researcher@example.com", person_id=44)
    response = _client().post(
        "/messages/conversations",
        headers={"Authorization": f"Bearer {token}"},
        json={"recipient_person_id": 22, "body": "Hello from CollabConnect"},
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["data"]["conversation"]["conversation_id"] == 77
    assert body["data"]["message"]["message_id"] == 1001


def test_send_message_requires_body(monkeypatch):
    cursor = DummyCursor()
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(10, "researcher@example.com", person_id=44)
    response = _client().post(
        "/messages/conversations/77/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "   "},
    )

    assert response.status_code == 400
    assert response.get_json()["message"] == "Message body is required"


def test_mark_conversation_read(monkeypatch):
    cursor = DummyCursor([
        {"conversation_id": 77},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(10, "researcher@example.com", person_id=44)
    response = _client().post(
        "/messages/conversations/77/read",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.get_json()["message"] == "Conversation marked as read"