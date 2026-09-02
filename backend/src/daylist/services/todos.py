from datetime import UTC, datetime

from sqlalchemy import case, select

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
            .order_by(
                case(
                    (Todo.priority == "high", 0),
                    (Todo.priority == "medium", 1),
                    (Todo.priority == "low", 2),
                    else_=3,
                ),
                Todo.created_at.desc(),
                Todo.id.desc(),
            )
        ).all()
    )


def create_todo(
    user_id: int,
    raw_title: object,
    raw_due_at: object = None,
    raw_priority: object = None,
) -> Todo:
    title = raw_title.strip() if isinstance(raw_title, str) else ""
    fields: dict[str, str] = {}
    if not 1 <= len(title) <= 200:
        fields["title"] = "Title must be 1–200 characters."
    due_at = _due_at(raw_due_at, fields)
    priority = _priority(raw_priority, fields)
    if fields:
        raise TodoValidationError(fields)

    todo = Todo(user_id=user_id, title=title, due_at=due_at, priority=priority)
    db.session.add(todo)
    db.session.commit()
    return todo


def _due_at(raw_due_at: object, fields: dict[str, str]) -> datetime | None:
    if raw_due_at is None:
        return None
    if not isinstance(raw_due_at, str):
        fields["dueAt"] = "Due date must be a date and time with a timezone."
        return None
    try:
        due_at = datetime.fromisoformat(raw_due_at.replace("Z", "+00:00"))
    except ValueError:
        due_at = None
    if due_at is None or due_at.tzinfo is None:
        fields["dueAt"] = "Due date must be a date and time with a timezone."
        return None
    return due_at.astimezone(UTC)


def _priority(raw_priority: object, fields: dict[str, str]) -> str | None:
    if raw_priority is None:
        return None
    if not isinstance(raw_priority, str) or raw_priority not in {"low", "medium", "high"}:
        fields["priority"] = "Priority must be low, medium, or high."
        return None
    return raw_priority


def update_todo(user_id: int, todo_id: int, changes: dict[str, object]) -> Todo:
    todo = _owned_todo(user_id, todo_id)
    fields: dict[str, str] = {}
    title: str | None = None
    due_at: datetime | None = None
    priority: str | None = None

    if "title" in changes:
        raw_title = changes["title"]
        title = raw_title.strip() if isinstance(raw_title, str) else ""
        if not 1 <= len(title) <= 200:
            fields["title"] = "Title must be 1–200 characters."
    if "completed" in changes and not isinstance(changes["completed"], bool):
        fields["completed"] = "Completed must be a boolean."
    if "dueAt" in changes:
        due_at = _due_at(changes["dueAt"], fields)
    if "priority" in changes:
        priority = _priority(changes["priority"], fields)
    if fields:
        raise TodoValidationError(fields)

    if "title" in changes:
        todo.title = title or ""
    if "completed" in changes:
        todo.completed = bool(changes["completed"])
    if "dueAt" in changes:
        todo.due_at = due_at
    if "priority" in changes:
        todo.priority = priority
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
