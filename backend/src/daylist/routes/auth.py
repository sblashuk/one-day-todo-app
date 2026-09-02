from typing import Any

from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_user, logout_user
from flask_wtf.csrf import generate_csrf

from ..errors import api_error
from ..extensions import login_manager
from ..models import User
from ..services import auth as auth_service

blueprint = Blueprint("auth", __name__, url_prefix="/api/auth")


def user_json(user: User) -> dict[str, int | str]:
    return {"id": user.id, "email": user.email}


def credentials() -> tuple[object, object, dict[str, str]]:
    payload: Any = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, None, {"request": "A JSON object is required."}
    return payload.get("email"), payload.get("password"), {}


@login_manager.user_loader
def load_user(user_id: str) -> User | None:
    if not user_id.isdigit():
        return None
    return auth_service.get_user(int(user_id))


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
    try:
        user = auth_service.register_user(email, password)
    except auth_service.CredentialsValidationError as error:
        return api_error(
            400, "validation_error", "Check the highlighted fields.", error.fields
        )
    except auth_service.EmailExistsError:
        return api_error(
            409,
            "email_exists",
            "An account already exists for this email.",
            {"email": "This email is already registered."},
        )

    session.clear()
    login_user(user)
    return jsonify(user=user_json(user)), 201


@blueprint.post("/login")
def login():
    email, password, fields = credentials()
    if fields:
        return api_error(400, "validation_error", "Check the highlighted fields.", fields)
    try:
        user = auth_service.authenticate_user(email, password)
    except auth_service.CredentialsValidationError as error:
        return api_error(
            400, "validation_error", "Check the highlighted fields.", error.fields
        )
    except auth_service.InvalidCredentialsError:
        return api_error(401, "invalid_credentials", "Email or password is incorrect.")

    session.clear()
    login_user(user)
    return jsonify(user=user_json(user))


@blueprint.post("/logout")
def logout():
    logout_user()
    session.clear()
    return "", 204
