from datetime import UTC, datetime, timedelta
from pathlib import Path

from flask import Flask
from flask.testing import FlaskClient
from flask_migrate import upgrade
from sqlalchemy import text

from daylist import create_app
from daylist.extensions import db

from .conftest import csrf_token
from .test_todos import register


def activity(client: FlaskClient, start: datetime, end: datetime):
    return client.get(
        "/api/activity/completions",
        query_string={"from": start.isoformat(), "to": end.isoformat()},
    )


def complete(client: FlaskClient, todo_id: int, completed: bool = True):
    return client.patch(
        f"/api/todos/{todo_id}",
        json={"completed": completed},
        headers={"X-CSRFToken": csrf_token(client)},
    )


def test_activity_requires_authentication_and_valid_range(client: FlaskClient) -> None:
    now = datetime.now(UTC)
    assert activity(client, now - timedelta(days=1), now + timedelta(days=1)).status_code == 401
    register(client)

    malformed = client.get(
        "/api/activity/completions", query_string={"from": "not-a-date", "to": now.isoformat()}
    )
    missing = client.get("/api/activity/completions", query_string={"from": now.isoformat()})
    reversed_range = activity(client, now, now)

    for response in (malformed, missing, reversed_range):
        assert response.status_code == 400
        assert response.get_json()["error"]["code"] == "validation_error"


def test_completion_transitions_are_chronological_and_immutable(client: FlaskClient) -> None:
    register(client)
    created = client.post(
        "/api/todos",
        json={"title": "Ship profile"},
        headers={"X-CSRFToken": csrf_token(client)},
    ).get_json()["todo"]

    assert complete(client, created["id"]).status_code == 200
    assert complete(client, created["id"]).status_code == 200
    assert complete(client, created["id"], False).status_code == 200
    assert complete(client, created["id"]).status_code == 200
    assert (
        client.delete(
            f"/api/todos/{created['id']}", headers={"X-CSRFToken": csrf_token(client)}
        ).status_code
        == 204
    )

    response = activity(
        client, datetime.now(UTC) - timedelta(minutes=1), datetime.now(UTC) + timedelta(minutes=1)
    )

    assert response.status_code == 200
    completions = response.get_json()["completions"]
    assert len(completions) == 2
    assert completions == sorted(completions, key=lambda item: item["completedAt"])
    assert list(completions[0]) == ["completedAt"]

    first = datetime.fromisoformat(completions[0]["completedAt"].replace("Z", "+00:00"))
    inclusive = activity(client, first, first + timedelta(microseconds=1))
    exclusive = activity(client, first - timedelta(microseconds=1), first)
    assert inclusive.get_json()["completions"] == [completions[0]]
    assert exclusive.get_json()["completions"] == []


def test_activity_is_scoped_to_the_authenticated_user(app: Flask) -> None:
    first = app.test_client()
    second = app.test_client()
    register(first, "first@example.com")
    created = first.post(
        "/api/todos",
        json={"title": "Private completion"},
        headers={"X-CSRFToken": csrf_token(first)},
    ).get_json()["todo"]
    complete(first, created["id"])
    register(second, "second@example.com")

    response = activity(
        second, datetime.now(UTC) - timedelta(days=1), datetime.now(UTC) + timedelta(days=1)
    )

    assert response.get_json() == {"completions": []}


def test_migration_backfills_completed_todos_through_activity_http(tmp_path: Path) -> None:
    database_path = tmp_path / "legacy.sqlite"
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path}",
            "WTF_CSRF_ENABLED": True,
        }
    )
    migration_directory = str(Path(__file__).parents[1] / "migrations")
    with app.app_context():
        upgrade(directory=migration_directory, revision="20260902_0002")
        db.session.execute(
            text(
                "INSERT INTO users (id, email, password_hash, created_at) "
                "VALUES (1, 'legacy@example.com', 'unused', '2026-06-01 08:00:00')"
            )
        )
        db.session.execute(
            text(
                "INSERT INTO todos "
                "(id, user_id, title, completed, created_at, updated_at, deleted_at) "
                "VALUES (1, 1, 'Legacy work', 1, '2026-06-01 08:00:00', "
                "'2026-06-02 09:30:00', NULL)"
            )
        )
        db.session.commit()
        upgrade(directory=migration_directory)

    client = app.test_client()
    with client.session_transaction() as session:
        session["_user_id"] = "1"
        session["_fresh"] = True

    response = activity(
        client,
        datetime(2026, 6, 2, 9, 0, tzinfo=UTC),
        datetime(2026, 6, 2, 10, 0, tzinfo=UTC),
    )

    assert response.status_code == 200
    assert response.get_json() == {"completions": [{"completedAt": "2026-06-02T09:30:00Z"}]}
