import re
from typing import Any

from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_user, logout_user
from flask_wtf.csrf import generate_csrf
from sqlalchemy import select
from werkzeug.security import check_password_hash, generate_password_hash

from .errors import api_error
from .extensions import db, login_manager
from .models import User

blueprint = Blueprint("auth", __name__, url_prefix="/api/auth")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def user_json(user: User) -> dict[str, int | str]:
    return {"id": user.id, "email": user.email}


def credentials() -> tuple[str | None, str | None, dict[str, str]]:
    payload: Any = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, None, {"request": "A JSON object is required."}

    raw_email = payload.get("email")
    password = payload.get("password")
    email = raw_email.strip().lower() if isinstance(raw_email, str) else None
    fields: dict[str, str] = {}
    if not email or len(email) > 320 or not EMAIL_PATTERN.fullmatch(email):
        fields["email"] = "Enter a valid email address."
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        fields["password"] = "Password must be 8–128 characters."
    return email, password if isinstance(password, str) else None, fields


@login_manager.user_loader
def load_user(user_id: str) -> User | None:
    if not user_id.isdigit():
        return None
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    return api_error(401, "authentication_required", "Sign in to continue.")


@blueprint.get("/session")
def get_session():
    user = user_json(current_user) if current_user.is_authenticated else None
    return jsonify(user=user, csrfToken=generate_csrf())


@blueprint.post("/register")
def register():
    email, password, fields = credentials()
    if fields:
        return api_error(400, "validation_error", "Check the highlighted fields.", fields)

    existing = db.session.scalar(select(User).where(User.email == email))
    if existing:
        return api_error(
            409,
            "email_exists",
            "An account already exists for this email.",
            {"email": "This email is already registered."},
        )

    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    session.clear()
    login_user(user)
    return jsonify(user=user_json(user)), 201


@blueprint.post("/login")
def login():
    email, password, fields = credentials()
    if fields:
        return api_error(400, "validation_error", "Check the highlighted fields.", fields)

    user = db.session.scalar(select(User).where(User.email == email))
    if user is None or not check_password_hash(user.password_hash, password):
        return api_error(401, "invalid_credentials", "Email or password is incorrect.")

    session.clear()
    login_user(user)
    return jsonify(user=user_json(user))


@blueprint.post("/logout")
def logout():
    logout_user()
    session.clear()
    return "", 204

