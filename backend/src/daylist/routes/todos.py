from datetime import UTC, datetime
from typing import Any

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from ..errors import api_error
from ..models import Todo
from ..services import todos as todo_service

blueprint = Blueprint("todos", __name__, url_prefix="/api/todos")


def todo_json(todo: Todo) -> dict[str, int | str | bool | None]:
    return {
        "id": todo.id,
        "title": todo.title,
        "completed": todo.completed,
        "dueAt": iso_utc(todo.due_at) if todo.due_at is not None else None,
        "priority": todo.priority,
        "createdAt": iso_utc(todo.created_at),
        "updatedAt": iso_utc(todo.updated_at),
    }


def iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


@blueprint.get("")
@login_required
def list_todos():
    todos = todo_service.list_todos(current_user.id)
    return jsonify(todos=[todo_json(todo) for todo in todos])


@blueprint.post("")
@login_required
def add_todo():
    payload: Any = request.get_json(silent=True)
    raw_title = payload.get("title") if isinstance(payload, dict) else None
    raw_due_at = payload.get("dueAt") if isinstance(payload, dict) else None
    raw_priority = payload.get("priority") if isinstance(payload, dict) else None
    try:
        todo = todo_service.create_todo(
            current_user.id, raw_title, raw_due_at, raw_priority
        )
    except todo_service.TodoValidationError as error:
        return api_error(
            400, "validation_error", "Check the highlighted fields.", error.fields
        )
    return jsonify(todo=todo_json(todo)), 201


@blueprint.patch("/<int:todo_id>")
@login_required
def update_todo(todo_id: int):
    payload: Any = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return api_error(
            400,
            "validation_error",
            "Check the highlighted fields.",
            {"request": "A JSON object is required."},
        )
    if not payload:
        return api_error(
            400,
            "validation_error",
            "Check the highlighted fields.",
            {"request": "Provide at least one todo field."},
        )
    supported_fields = {"title", "completed", "dueAt", "priority"}
    if not payload.keys() <= supported_fields:
        return api_error(
            400,
            "validation_error",
            "Check the highlighted fields.",
            {"request": "Provide only supported todo fields."},
        )
    try:
        todo = todo_service.update_todo(current_user.id, todo_id, payload)
    except todo_service.TodoNotFoundError:
        return api_error(404, "todo_not_found", "Todo not found.")
    except todo_service.TodoValidationError as error:
        return api_error(
            400, "validation_error", "Check the highlighted fields.", error.fields
        )
    return jsonify(todo=todo_json(todo))


@blueprint.delete("/<int:todo_id>")
@login_required
def delete_todo(todo_id: int):
    try:
        todo_service.delete_todo(current_user.id, todo_id)
    except todo_service.TodoNotFoundError:
        return api_error(404, "todo_not_found", "Todo not found.")
    return "", 204
