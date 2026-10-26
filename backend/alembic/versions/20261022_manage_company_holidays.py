"""Add persistent organization holiday records and built-in event overrides."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261022_manage_company_holidays"
down_revision = "20261021_universal_leave_targets"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "holidays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("office_status", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_long_weekend", sa.Boolean(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_holidays_date", "holidays", ["date"])

    op.create_table(
        "holiday_overrides",
        sa.Column("event_id", sa.String(64), primary_key=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("office_status", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_long_weekend", sa.Boolean(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("holiday_overrides")
    op.drop_index("ix_holidays_date", table_name="holidays")
    op.drop_table("holidays")
