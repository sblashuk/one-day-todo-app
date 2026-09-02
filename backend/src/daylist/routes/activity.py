from datetime import UTC, datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from ..errors import api_error
from ..extensions import db
from ..models import CompletionEvent
from .todos import iso_utc

blueprint = Blueprint("activity", __name__, url_prefix="/api/activity")


def _timestamp(name: str, fields: dict[str, str]) -> datetime | None:
    raw_value = request.args.get(name)
    if raw_value is None:
        fields[name] = f"{name.capitalize()} timestamp is required."
        return None
    try:
        value = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        value = None
    if value is None or value.tzinfo is None:
        fields[name] = f"{name.capitalize()} must be a timestamp with a timezone."
        return None
    return value.astimezone(UTC)


@blueprint.get("/completions")
@login_required
def list_completions():
    fields: dict[str, str] = {}
    start = _timestamp("from", fields)
    end = _timestamp("to", fields)
    if start is not None and end is not None and start >= end:
        fields["to"] = "To must be later than from."
    if fields:
        return api_error(
            400, "validation_error", "Check the highlighted fields.", fields
        )

    events = db.session.scalars(
        select(CompletionEvent)
        .where(
            CompletionEvent.user_id == current_user.id,
            CompletionEvent.completed_at >= start,
            CompletionEvent.completed_at < end,
        )
        .order_by(CompletionEvent.completed_at, CompletionEvent.id)
    ).all()
    return jsonify(
        completions=[{"completedAt": iso_utc(event.completed_at)} for event in events]
    )
