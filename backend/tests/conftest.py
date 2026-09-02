from collections.abc import Iterator
from pathlib import Path

import pytest
from flask import Flask
from flask.testing import FlaskClient
from flask_migrate import upgrade

from daylist import create_app


@pytest.fixture()
def app(tmp_path: Path) -> Iterator[Flask]:
    database_path = tmp_path / "test.sqlite"
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path}",
            "WTF_CSRF_ENABLED": True,
        }
    )

    with app.app_context():
        upgrade(directory=str(Path(__file__).parents[1] / "migrations"))

    yield app


@pytest.fixture()
def client(app: Flask) -> FlaskClient:
    return app.test_client()


def csrf_token(client: FlaskClient) -> str:
    response = client.get("/api/auth/session")
    return response.get_json()["csrfToken"]
