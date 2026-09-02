from pathlib import Path

from daylist import create_app


def test_default_instance_path_is_outside_source_tree() -> None:
    app = create_app(
        {
            "SECRET_KEY": "test-secret",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    assert Path(app.instance_path) == Path(__file__).parents[1] / "instance"
