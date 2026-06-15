from types import SimpleNamespace

import app as app_module
from utils.jwt_utils import generate_access_token


class DummyCursor:
    def __init__(self, responses=None):
        self.responses = list(responses or [])
        self.executed = []
        self.callprocs = []
        self.closed = False

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def callproc(self, name, args=None):
        self.callprocs.append((name, args))

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


def test_create_project_missing_fields_returns_400(monkeypatch):
    cursor = DummyCursor()
    _set_mock_mysql(monkeypatch, cursor)

    response = _client().post(
        "/project/",
        json={
            "title": "Research Project",
            "description": "A valid project",
            "person_id": 1,
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["message"] == "Missing fields: tag_name"
    assert cursor.callprocs == []


def test_create_project_success(monkeypatch):
    cursor = DummyCursor()
    _set_mock_mysql(monkeypatch, cursor)

    response = _client().post(
        "/project/",
        json={
            "title": "Research Project",
            "description": "A valid project",
            "person_id": 7,
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "tag_name": "Research",
        },
    )

    assert response.status_code == 201
    assert response.get_json()["status"] == "success"
    assert cursor.callprocs[0][0] == "InsertIntoProject"


def test_update_project_rejects_invalid_payload(monkeypatch):
    cursor = DummyCursor([
        {"person_id": 11},
        {"person_id": 11},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(1, "owner@example.com")
    response = _client().put(
        "/project/9",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "project_title": "AI",
            "project_description": "Invalid because title is too short",
            "tag_name": "Research",
        },
    )

    assert response.status_code == 400
    body = response.get_json()
    assert body["status"] == "error"
    assert body["message"] == "Validation failed"
    assert "Project title" in body["errors"][0]
    assert cursor.callprocs == []


def test_update_project_success(monkeypatch):
    cursor = DummyCursor([
        {"person_id": 11},
        {"person_id": 11},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(1, "owner@example.com")
    response = _client().put(
        "/project/9",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "project_title": "Updated Project Title",
            "project_description": "Updated description",
            "tag_name": "Research",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        },
    )

    assert response.status_code == 200
    assert response.get_json()["message"] == "Project updated successfully"
    assert cursor.callprocs[-1][0] == "UpdateProjectDetails"


def test_delete_project_forbidden_for_non_owner(monkeypatch):
    cursor = DummyCursor([
        {"person_id": 11},
        {"person_id": 22},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(1, "owner@example.com")
    response = _client().delete(
        "/project/9",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.get_json()["message"] == "You do not have permission to modify this project"
    assert cursor.callprocs == []


def test_add_user_project_success(monkeypatch):
    cursor = DummyCursor([
        {"person_id": 55},
        {"project_id": 9001},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(5, "user@example.com")
    response = _client().post(
        "/user/5/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "project_title": "New Research Project",
            "project_description": "Valid description",
            "tag_name": "Research",
            "project_role": "Contributor",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        },
    )

    assert response.status_code == 201
    assert response.get_json()["data"]["project_id"] == 9001
    assert cursor.callprocs[0][0] == "SelectUserById"
    assert cursor.callprocs[1][0] == "InsertIntoProject"
    assert cursor.callprocs[2][0] == "sp_insert_workedon"


def test_add_user_project_requires_title(monkeypatch):
    cursor = DummyCursor([
        {"person_id": 55},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(5, "user@example.com")
    response = _client().post(
        "/user/5/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "project_description": "Missing title on purpose",
            "tag_name": "Research",
            "project_role": "Contributor",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["message"] == "Project title required"


def test_claim_person_success(monkeypatch):
    cursor = DummyCursor([
        {"person_id": 55},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(5, "user@example.com")
    response = _client().post(
        "/user/5/claim-person/77",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["message"] == "Profile claimed"
    assert body["data"]["person_id"] == 77
    assert "access_token" in body["data"]
    assert cursor.callprocs[0][0] == "LinkUserToPerson"


def test_create_profile_with_affiliation_success(monkeypatch):
    cursor = DummyCursor([
        None,
        {"new_id": 101},
        None,
        {"new_id": 202},
        {"person_id": 303},
    ])
    _set_mock_mysql(monkeypatch, cursor)

    token = generate_access_token(5, "user@example.com")
    response = _client().post(
        "/user/create-profile-with-affiliation",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "person_name": "Example Researcher",
            "person_email": "researcher@example.com",
            "person_phone": "555-0101",
            "bio": "A sample profile",
            "expertise_1": "AI",
            "expertise_2": "ML",
            "expertise_3": "Data",
            "institution_name": "Example University",
            "institution_type": "University",
            "department_name": "Computer Science",
        },
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["message"] == "Profile created"
    assert body["data"]["person_id"] == 303
    assert body["data"]["user_id"] == 5
    assert "access_token" in body["data"]
    assert cursor.callprocs[0][0] == "SelectInstitutionByName"
    assert cursor.callprocs[1][0] == "InsertIntoInstitution"
    assert cursor.callprocs[2][0] == "InsertIntoDepartment"
    assert cursor.callprocs[3][0] == "InsertPerson"
    assert cursor.callprocs[4][0] == "InsertWorksIn"
    assert cursor.callprocs[5][0] == "sp_insert_belongsto"
    assert cursor.callprocs[6][0] == "LinkUserToPerson"
