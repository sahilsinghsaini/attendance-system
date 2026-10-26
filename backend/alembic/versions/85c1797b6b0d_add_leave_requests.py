"""add leave requests

Revision ID: 85c1797b6b0d
Revises: a1b2c3d4e5f6
Create Date: 2026-09-16 05:38:08.609691

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "85c1797b6b0d"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "leave_requests",

        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False
        ),

        sa.Column(
            "employee_id",
            sa.Uuid(),
            nullable=False
        ),

        sa.Column(
            "start_date",
            sa.Date(),
            nullable=False
        ),

        sa.Column(
            "end_date",
            sa.Date(),
            nullable=False
        ),

        sa.Column(
            "leave_type",
            sa.String(length=50),
            nullable=False
        ),

        sa.Column(
            "reason",
            sa.Text(),
            nullable=False
        ),

        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False
        ),

        sa.Column(
            "manager_comment",
            sa.Text(),
            nullable=True
        ),

        sa.Column(
            "reviewed_by",
            sa.Uuid(),
            nullable=True
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False
        ),

        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.id"]
        ),

        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"]
        ),

        sa.PrimaryKeyConstraint(
            "id"
        )
    )


    op.create_index(
        "ix_leave_requests_employee_id",
        "leave_requests",
        ["employee_id"],
        unique=False
    )


    op.create_index(
        "ix_leave_requests_status",
        "leave_requests",
        ["status"],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        "ix_leave_requests_status",
        table_name="leave_requests"
    )

    op.drop_index(
        "ix_leave_requests_employee_id",
        table_name="leave_requests"
    )

    op.drop_table(
        "leave_requests"
    )