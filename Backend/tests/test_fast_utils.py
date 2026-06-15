import sys
from types import SimpleNamespace

from flask import Flask, jsonify, request

from utils.authorization import verify_project_ownership, verify_user_access
from utils.jwt_utils import decode_access_token, generate_access_token, token_required
from utils.validators import (
    sanitize_string,
    validate_email,
    validate_password,
    validate_project_data,
    validate_string_length,
)


def test_validate_email_and_password_rules():
    assert validate_email("person@example.com")
    assert not validate_email("not-an-email")

    ok, message = validate_password("Password123")
    assert ok
    assert message == "Password is valid"

    assert validate_password("") == (False, "Password is required")
    assert validate_password("short1") == (False, "Password must be at least 8 characters long")
    assert validate_password("password") == (False, "Password must contain at least one number")
    assert validate_password("12345678") == (False, "Password must contain at least one letter")


def test_validate_string_length_and_sanitizing():
    assert validate_string_length("  ok  ", "Field") == (True, "")
    assert validate_string_length("", "Field") == (True, "")
    assert validate_string_length(123, "Field") == (False, "Field must be a string")
    assert validate_string_length("a", "Field", min_length=2) == (False, "Field must be at least 2 characters")
    assert validate_string_length("abc", "Field", max_length=2) == (False, "Field must not exceed 2 characters")
    assert sanitize_string("  hello\x00world  ") == "helloworld"


def test_validate_project_data_dates_and_lengths():
    valid, errors = validate_project_data(
        {
            "project_title": "AI Research",
            "project_description": "Testing project validation",
            "tag_name": "Research",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        }
    )
    assert valid
    assert errors == []

    valid, errors = validate_project_data(
        {
            "project_title": "AI",
            "start_date": "2025-12-31",
            "end_date": "2025-01-01",
        }
    )
    assert not valid
    assert any("Project title" in error for error in errors)
    assert "End date must be after start date" in errors


def test_jwt_token_round_trip_includes_person_id():
    token = generate_access_token(7, "test@example.com", person_id=42)
    payload = decode_access_token(token)

    assert isinstance(token, str)
    assert payload["user_id"] == 7
    assert payload["email"] == "test@example.com"
    assert payload["person_id"] == 42


def test_token_required_accepts_and_rejects_tokens():
    app = Flask(__name__)

    @app.route("/protected")
    @token_required
    def protected():
        return jsonify(request.current_user)

    client = app.test_client()
    token = generate_access_token(3, "token@example.com")

    response = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.get_json()["user_id"] == 3

    assert client.get("/protected").status_code == 401
    assert client.get("/protected", headers={"Authorization": "Bearer"}).status_code == 401


def test_verify_user_access_enforces_own_account():
    app = Flask(__name__)

    @app.route("/users/<int:user_id>")
    @verify_user_access
    def protected(user_id):
        return jsonify({"user_id": user_id})

    with app.test_request_context("/users/5"):
        request.current_user = {"user_id": 5}
        assert protected(user_id=5).status_code == 200

    with app.test_request_context("/users/6"):
        request.current_user = {"user_id": 5}
        response, status_code = protected(user_id=6)
        assert status_code == 403
        assert response.get_json()["message"] == "You can only access your own data"


class _StaticCursor:
    def __init__(self, responses):
        self._responses = list(responses)
        self.executed = []

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return self._responses.pop(0) if self._responses else None

    def close(self):
        return None


def _patch_app_mysql(monkeypatch, cursor):
    dummy_app_module = SimpleNamespace(
        mysql=SimpleNamespace(connection=SimpleNamespace(cursor=lambda: cursor))
    )
    monkeypatch.setitem(sys.modules, "app", dummy_app_module)


def test_verify_project_ownership_allows_owner(monkeypatch):
    cursor = _StaticCursor([
        {"person_id": 11},
        {"person_id": 11},
    ])
    _patch_app_mysql(monkeypatch, cursor)

    app = Flask(__name__)

    @app.route("/projects/<int:project_id>")
    @verify_project_ownership
    def protected(project_id):
        return jsonify({"project_id": project_id})

    with app.test_request_context("/projects/9"):
        request.current_user = {"user_id": 1}
        response = protected(project_id=9)
        assert response.status_code == 200
        assert response.get_json()["project_id"] == 9


def test_verify_project_ownership_blocks_non_owner(monkeypatch):
    cursor = _StaticCursor([
        {"person_id": 11},
        {"person_id": 22},
    ])
    _patch_app_mysql(monkeypatch, cursor)

    app = Flask(__name__)

    @app.route("/projects/<int:project_id>")
    @verify_project_ownership
    def protected(project_id):
        return jsonify({"project_id": project_id})

    with app.test_request_context("/projects/9"):
        request.current_user = {"user_id": 1}
        response, status_code = protected(project_id=9)
        assert status_code == 403
        assert response.get_json()["message"] == "You do not have permission to modify this project"
