from flask import Flask
from flask.testing import FlaskClient

from .conftest import csrf_token


def register(client: FlaskClient, email: str = "person@example.com") -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password1"},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    assert response.status_code == 201


def test_todo_routes_require_authentication(client: FlaskClient) -> None:
    assert client.get("/api/todos").status_code == 401
    response = client.post(
        "/api/todos",
        json={"title": "Plan the day"},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    assert response.status_code == 401


def test_user_can_add_and_list_trimmed_todos_newest_first(client: FlaskClient) -> None:
    register(client)

    first = client.post(
        "/api/todos",
        json={"title": "  Plan the day  "},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    second = client.post(
        "/api/todos",
        json={"title": "Ship the app"},
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert first.status_code == 201
    assert first.get_json()["todo"] | {"createdAt": "ignored", "updatedAt": "ignored"} == {
        "id": 1,
        "title": "Plan the day",
        "completed": False,
        "dueAt": None,
        "priority": None,
        "createdAt": "ignored",
        "updatedAt": "ignored",
    }
    assert first.get_json()["todo"]["createdAt"].endswith("Z")
    assert second.status_code == 201
    listed = client.get("/api/todos")
    assert [todo["title"] for todo in listed.get_json()["todos"]] == [
        "Ship the app",
        "Plan the day",
    ]


def test_user_can_add_a_todo_with_due_date_and_priority(client: FlaskClient) -> None:
    register(client)

    response = client.post(
        "/api/todos",
        json={
            "title": "Ship the app",
            "dueAt": "2026-09-02T14:30:00+02:00",
            "priority": "high",
        },
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert response.status_code == 201
    assert response.get_json()["todo"] | {"createdAt": "ignored", "updatedAt": "ignored"} == {
        "id": 1,
        "title": "Ship the app",
        "completed": False,
        "dueAt": "2026-09-02T12:30:00Z",
        "priority": "high",
        "createdAt": "ignored",
        "updatedAt": "ignored",
    }
    assert client.get("/api/todos").get_json()["todos"][0]["dueAt"] == (
        "2026-09-02T12:30:00Z"
    )


def test_todo_title_is_validated(client: FlaskClient) -> None:
    register(client)

    empty = client.post(
        "/api/todos",
        json={"title": "   "},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    too_long = client.post(
        "/api/todos",
        json={"title": "a" * 201},
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert empty.status_code == 400
    assert empty.get_json()["error"]["fields"] == {
        "title": "Title must be 1–200 characters."
    }
    assert too_long.status_code == 400


def test_todo_details_are_validated_on_create(client: FlaskClient) -> None:
    register(client)

    response = client.post(
        "/api/todos",
        json={
            "title": "Plan the day",
            "dueAt": "2026-09-03T09:00:00",
            "priority": "urgent",
        },
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["fields"] == {
        "dueAt": "Due date must be a date and time with a timezone.",
        "priority": "Priority must be low, medium, or high.",
    }


def test_todos_are_sorted_by_priority_then_newest_first(client: FlaskClient) -> None:
    register(client)
    for title, priority in [
        ("Older high", "high"),
        ("No priority", None),
        ("Low", "low"),
        ("Medium", "medium"),
        ("Newer high", "high"),
    ]:
        response = client.post(
            "/api/todos",
            json={"title": title, "priority": priority},
            headers={"X-CSRFToken": csrf_token(client)},
        )
        assert response.status_code == 201

    listed = client.get("/api/todos").get_json()["todos"]

    assert [todo["title"] for todo in listed] == [
        "Newer high",
        "Older high",
        "Medium",
        "Low",
        "No priority",
    ]


def test_user_can_edit_and_clear_todo_details(client: FlaskClient) -> None:
    register(client)
    created = client.post(
        "/api/todos",
        json={
            "title": "Draft release",
            "dueAt": "2026-09-02T12:30:00Z",
            "priority": "low",
        },
        headers={"X-CSRFToken": csrf_token(client)},
    ).get_json()["todo"]

    edited = client.patch(
        f"/api/todos/{created['id']}",
        json={
            "title": "Ship release",
            "dueAt": "2026-09-03T09:00:00-04:00",
            "priority": "high",
        },
        headers={"X-CSRFToken": csrf_token(client)},
    )
    cleared = client.patch(
        f"/api/todos/{created['id']}",
        json={"dueAt": None, "priority": None},
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert edited.status_code == 200
    assert edited.get_json()["todo"] | {"createdAt": "ignored", "updatedAt": "ignored"} == {
        "id": created["id"],
        "title": "Ship release",
        "completed": False,
        "dueAt": "2026-09-03T13:00:00Z",
        "priority": "high",
        "createdAt": "ignored",
        "updatedAt": "ignored",
    }
    assert cleared.status_code == 200
    assert cleared.get_json()["todo"]["title"] == "Ship release"
    assert cleared.get_json()["todo"]["dueAt"] is None
    assert cleared.get_json()["todo"]["priority"] is None


def test_todo_updates_validate_each_supported_field(client: FlaskClient) -> None:
    register(client)
    created = client.post(
        "/api/todos",
        json={"title": "Plan the day"},
        headers={"X-CSRFToken": csrf_token(client)},
    ).get_json()["todo"]
    cases = [
        ({}, {"request": "Provide at least one todo field."}),
        ({"unknown": True}, {"request": "Provide only supported todo fields."}),
        ({"title": "   "}, {"title": "Title must be 1–200 characters."}),
        (
            {"dueAt": "2026-09-03T09:00:00"},
            {"dueAt": "Due date must be a date and time with a timezone."},
        ),
        (
            {"dueAt": 7},
            {"dueAt": "Due date must be a date and time with a timezone."},
        ),
        (
            {"priority": "urgent"},
            {"priority": "Priority must be low, medium, or high."},
        ),
        (
            {"priority": 7},
            {"priority": "Priority must be low, medium, or high."},
        ),
    ]

    for payload, expected_fields in cases:
        response = client.patch(
            f"/api/todos/{created['id']}",
            json=payload,
            headers={"X-CSRFToken": csrf_token(client)},
        )
        assert response.status_code == 400
        assert response.get_json()["error"]["fields"] == expected_fields

    assert client.get("/api/todos").get_json()["todos"][0]["title"] == "Plan the day"


def test_user_can_toggle_and_soft_delete_a_todo(client: FlaskClient) -> None:
    register(client)
    created = client.post(
        "/api/todos",
        json={"title": "Plan the day"},
        headers={"X-CSRFToken": csrf_token(client)},
    ).get_json()["todo"]

    toggled = client.patch(
        f"/api/todos/{created['id']}",
        json={"completed": True},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    assert toggled.status_code == 200
    assert toggled.get_json()["todo"]["completed"] is True

    deleted = client.delete(
        f"/api/todos/{created['id']}", headers={"X-CSRFToken": csrf_token(client)}
    )
    assert deleted.status_code == 204
    assert client.get("/api/todos").get_json() == {"todos": []}

    missing = client.patch(
        f"/api/todos/{created['id']}",
        json={"completed": False},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    assert missing.status_code == 404


def test_toggle_requires_a_boolean(client: FlaskClient) -> None:
    register(client)
    created = client.post(
        "/api/todos",
        json={"title": "Plan the day"},
        headers={"X-CSRFToken": csrf_token(client)},
    ).get_json()["todo"]

    response = client.patch(
        f"/api/todos/{created['id']}",
        json={"completed": "yes"},
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["fields"] == {
        "completed": "Completed must be a boolean."
    }


def test_users_cannot_see_or_change_each_others_todos(app: Flask) -> None:
    first_client = app.test_client()
    second_client = app.test_client()
    register(first_client, "first@example.com")
    created = first_client.post(
        "/api/todos",
        json={"title": "Private task"},
        headers={"X-CSRFToken": csrf_token(first_client)},
    ).get_json()["todo"]
    register(second_client, "second@example.com")

    assert second_client.get("/api/todos").get_json() == {"todos": []}
    changed = second_client.patch(
        f"/api/todos/{created['id']}",
        json={"completed": True},
        headers={"X-CSRFToken": csrf_token(second_client)},
    )
    removed = second_client.delete(
        f"/api/todos/{created['id']}",
        headers={"X-CSRFToken": csrf_token(second_client)},
    )
    assert changed.status_code == 404
    assert removed.status_code == 404
    assert first_client.get("/api/todos").get_json()["todos"][0]["title"] == "Private task"
