from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from ._timestamps import utc_now


class CompletionEvent(db.Model):
    __tablename__ = "completion_events"
    __table_args__ = (
        Index("ix_completion_events_user_completed", "user_id", "completed_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    todo_id: Mapped[int] = mapped_column(ForeignKey("todos.id"), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
