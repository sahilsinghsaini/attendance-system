"""Allow leave records for managers as well as employees.

Revision ID: 20261021_universal_leave_targets
Revises: 85c1797b6b0d
Create Date: 2026-10-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261021_universal_leave_targets"
down_revision: Union[str, Sequence[str], None] = "85c1797b6b0d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("leave_requests") as batch_op:
        batch_op.alter_column(
            "employee_id",
            existing_type=sa.Uuid(),
            nullable=True,
        )
        batch_op.add_column(sa.Column("target_user_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            "fk_leave_requests_target_user_id_users",
            "users",
            ["target_user_id"],
            ["id"],
        )
        batch_op.create_index(
            "ix_leave_requests_target_user_id",
            ["target_user_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("leave_requests") as batch_op:
        batch_op.drop_index("ix_leave_requests_target_user_id")
        batch_op.drop_constraint(
            "fk_leave_requests_target_user_id_users",
            type_="foreignkey",
        )
        batch_op.drop_column("target_user_id")
        batch_op.alter_column(
            "employee_id",
            existing_type=sa.Uuid(),
            nullable=False,
        )
