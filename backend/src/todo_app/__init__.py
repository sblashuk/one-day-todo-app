"""One-day todo Flask application."""

import os
from pathlib import Path
from typing import Any

from flask import Flask, jsonify
from flask_wtf.csrf import CSRFError

from .extensions import csrf, db, login_manager, migrate


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    app.config.from_mapping(
        SECRET_KEY=os.getenv("SECRET_KEY"),
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL", "sqlite:///todos.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
        WTF_CSRF_HEADERS=["X-CSRFToken"],
    )
    if test_config:
        app.config.update(test_config)
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY must be configured")

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)

    from . import models  # noqa: F401
    from .auth import blueprint as auth_blueprint
    from .todos import blueprint as todos_blueprint

    app.register_blueprint(auth_blueprint)
    app.register_blueprint(todos_blueprint)

    @app.get("/api/health")
    def health() -> tuple[dict[str, str], int]:
        return {"status": "ok"}, 200

    @app.errorhandler(CSRFError)
    def handle_csrf_error(error: CSRFError):
        return jsonify(error={"code": "csrf_error", "message": error.description}), 400

    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        return response

    return app
