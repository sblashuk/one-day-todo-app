from datetime import UTC, datetime
from typing import Any

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from .errors import api_error
from .extensions import db
from .models import Todo, utc_now

blueprint = Blueprint("todos", __name__, url_prefix="/api/todos")


def iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def todo_json(todo: Todo) -> dict[str, int | str | bool]:
    return {
        "id": todo.id,
        "title": todo.title,
        "completed": todo.completed,
        "createdAt": iso_utc(todo.created_at),
        "updatedAt": iso_utc(todo.updated_at),
    }


def owned_todo(todo_id: int) -> Todo | None:
    return db.session.scalar(
        select(Todo).where(
            Todo.id == todo_id,
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
        )
    )


@blueprint.get("")
@login_required
def list_todos():
    todos = db.session.scalars(
        select(Todo)
        .where(Todo.user_id == current_user.id, Todo.deleted_at.is_(None))
        .order_by(Todo.created_at.desc(), Todo.id.desc())
    ).all()
    return jsonify(todos=[todo_json(todo) for todo in todos])


@blueprint.post("")
@login_required
def add_todo():
    payload: Any = request.get_json(silent=True)
    raw_title = payload.get("title") if isinstance(payload, dict) else None
    title = raw_title.strip() if isinstance(raw_title, str) else ""
    if not 1 <= len(title) <= 200:
        return api_error(
            400,
            "validation_error",
            "Check the highlighted fields.",
            {"title": "Title must be 1–200 characters."},
        )

    todo = Todo(user_id=current_user.id, title=title)
    db.session.add(todo)
    db.session.commit()
    return jsonify(todo=todo_json(todo)), 201


@blueprint.patch("/<int:todo_id>")
@login_required
def update_todo(todo_id: int):
    todo = owned_todo(todo_id)
    if todo is None:
        return api_error(404, "todo_not_found", "Todo not found.")

    payload: Any = request.get_json(silent=True)
    completed = payload.get("completed") if isinstance(payload, dict) else None
    if not isinstance(completed, bool):
        return api_error(
            400,
            "validation_error",
            "Check the highlighted fields.",
            {"completed": "Completed must be a boolean."},
        )

    todo.completed = completed
    todo.updated_at = utc_now()
    db.session.commit()
    return jsonify(todo=todo_json(todo))


@blueprint.delete("/<int:todo_id>")
@login_required
def delete_todo(todo_id: int):
    todo = owned_todo(todo_id)
    if todo is None:
        return api_error(404, "todo_not_found", "Todo not found.")

    now = utc_now()
    todo.deleted_at = now
    todo.updated_at = now
    db.session.commit()
    return "", 204
