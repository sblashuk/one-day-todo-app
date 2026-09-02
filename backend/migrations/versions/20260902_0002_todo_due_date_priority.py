"""Add due date and priority to todos.

Revision ID: 20260902_0002
Revises: 20260901_0001
"""

import sqlalchemy as sa
from alembic import op

revision = "20260902_0002"
down_revision = "20260901_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("todos") as batch_op:
        batch_op.add_column(sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("priority", sa.String(length=6), nullable=True))
        batch_op.create_check_constraint(
            "ck_todos_priority",
            "priority IS NULL OR priority IN ('low', 'medium', 'high')",
        )


def downgrade() -> None:
    with op.batch_alter_table("todos") as batch_op:
        batch_op.drop_constraint("ck_todos_priority", type_="check")
        batch_op.drop_column("priority")
        batch_op.drop_column("due_at")
