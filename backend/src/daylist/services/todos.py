from datetime import UTC, datetime

from sqlalchemy import select

from ..extensions import db
from ..models import Todo


class TodoValidationError(Exception):
    def __init__(self, fields: dict[str, str]) -> None:
        super().__init__("Invalid todo fields")
        self.fields = fields


class TodoNotFoundError(Exception):
    pass


def list_todos(user_id: int) -> list[Todo]:
    return list(
        db.session.scalars(
            select(Todo)
            .where(Todo.user_id == user_id, Todo.deleted_at.is_(None))
            .order_by(Todo.created_at.desc(), Todo.id.desc())
        ).all()
    )


def create_todo(user_id: int, raw_title: object) -> Todo:
    title = raw_title.strip() if isinstance(raw_title, str) else ""
    if not 1 <= len(title) <= 200:
        raise TodoValidationError({"title": "Title must be 1–200 characters."})

    todo = Todo(user_id=user_id, title=title)
    db.session.add(todo)
    db.session.commit()
    return todo


def set_todo_completed(user_id: int, todo_id: int, raw_completed: object) -> Todo:
    todo = _owned_todo(user_id, todo_id)
    if not isinstance(raw_completed, bool):
        raise TodoValidationError({"completed": "Completed must be a boolean."})

    todo.completed = raw_completed
    todo.updated_at = datetime.now(UTC)
    db.session.commit()
    return todo


def delete_todo(user_id: int, todo_id: int) -> None:
    todo = _owned_todo(user_id, todo_id)
    now = datetime.now(UTC)
    todo.deleted_at = now
    todo.updated_at = now
    db.session.commit()


def _owned_todo(user_id: int, todo_id: int) -> Todo:
    todo = db.session.scalar(
        select(Todo).where(
            Todo.id == todo_id,
            Todo.user_id == user_id,
            Todo.deleted_at.is_(None),
        )
    )
    if todo is None:
        raise TodoNotFoundError
    return todo
