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
