"""Add immutable todo completion events.

Revision ID: 20260902_0003
Revises: 20260902_0002
"""

import sqlalchemy as sa
from alembic import op

revision = "20260902_0003"
down_revision = "20260902_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "completion_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("todo_id", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["todo_id"], ["todos.id"], name=op.f("fk_completion_events_todo_id_todos")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_completion_events_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_completion_events")),
    )
    op.create_index(
        "ix_completion_events_user_completed",
        "completion_events",
        ["user_id", "completed_at"],
        unique=False,
    )
    op.execute(
        "INSERT INTO completion_events (user_id, todo_id, completed_at) "
        "SELECT user_id, id, updated_at FROM todos WHERE completed = 1"
    )


def downgrade() -> None:
    op.drop_index("ix_completion_events_user_completed", table_name="completion_events")
    op.drop_table("completion_events")
