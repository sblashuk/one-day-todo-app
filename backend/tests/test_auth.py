from flask import Flask
from flask.testing import FlaskClient
from werkzeug.security import check_password_hash

from todo_app.extensions import db
from todo_app.models import User

from .conftest import csrf_token


def test_anonymous_session_issues_csrf_token(client: FlaskClient) -> None:
    response = client.get("/api/auth/session")

    assert response.status_code == 200
    assert response.get_json() == {
        "user": None,
        "csrfToken": response.get_json()["csrfToken"],
    }
    assert response.get_json()["csrfToken"]


def test_registration_requires_csrf(client: FlaskClient) -> None:
    response = client.post(
        "/api/auth/register", json={"email": "person@example.com", "password": "password1"}
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "csrf_error"


def test_registration_normalizes_email_hashes_password_and_signs_in(
    app: Flask, client: FlaskClient
) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": " Person@Example.COM ", "password": "password1"},
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert response.status_code == 201
    assert response.get_json() == {"user": {"id": 1, "email": "person@example.com"}}
    session_response = client.get("/api/auth/session")
    assert session_response.get_json()["user"] == {"id": 1, "email": "person@example.com"}
    assert "Expires=" not in response.headers["Set-Cookie"]
    assert "Max-Age=" not in response.headers["Set-Cookie"]
    with app.app_context():
        user = db.session.get(User, 1)
        assert user is not None
        assert user.password_hash != "password1"
        assert check_password_hash(user.password_hash, "password1")


def test_registration_validates_email_and_password(client: FlaskClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "password": "short"},
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["fields"] == {
        "email": "Enter a valid email address.",
        "password": "Password must be 8–128 characters.",
    }


def test_duplicate_email_is_rejected_case_insensitively(client: FlaskClient) -> None:
    token = csrf_token(client)
    client.post(
        "/api/auth/register",
        json={"email": "person@example.com", "password": "password1"},
        headers={"X-CSRFToken": token},
    )
    client.post("/api/auth/logout", headers={"X-CSRFToken": csrf_token(client)})

    response = client.post(
        "/api/auth/register",
        json={"email": "PERSON@example.com", "password": "password2"},
        headers={"X-CSRFToken": csrf_token(client)},
    )

    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "email_exists"


def test_user_can_log_in_and_log_out(client: FlaskClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "person@example.com", "password": "password1"},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    client.post("/api/auth/logout", headers={"X-CSRFToken": csrf_token(client)})

    invalid = client.post(
        "/api/auth/login",
        json={"email": "person@example.com", "password": "incorrect"},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    assert invalid.status_code == 401
    assert invalid.get_json()["error"] == {
        "code": "invalid_credentials",
        "message": "Email or password is incorrect.",
    }

    login = client.post(
        "/api/auth/login",
        json={"email": "PERSON@example.com", "password": "password1"},
        headers={"X-CSRFToken": csrf_token(client)},
    )
    assert login.status_code == 200

    logout = client.post("/api/auth/logout", headers={"X-CSRFToken": csrf_token(client)})
    assert logout.status_code == 204
    assert client.get("/api/auth/session").get_json()["user"] is None
