from alembic import op
import sqlalchemy as sa


revision = "736a27ef9954"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "employees",
        sa.Column(
            "legal_name",
            sa.String(length=200),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "preferred_first_name",
            sa.String(length=100),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "phone_number",
            sa.String(length=30),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "home_address",
            sa.String(length=500),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "birth_date",
            sa.Date(),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "gender",
            sa.String(length=50),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "sin_pan",
            sa.String(length=100),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "hire_date",
            sa.Date(),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "pay_schedule",
            sa.String(length=50),
            nullable=True
        )
    )

    op.add_column(
        "employees",
        sa.Column(
            "job_title",
            sa.String(length=150),
            nullable=True
        )
    )


def downgrade():
    op.drop_column("employees", "job_title")
    op.drop_column("employees", "pay_schedule")
    op.drop_column("employees", "hire_date")
    op.drop_column("employees", "sin_pan")
    op.drop_column("employees", "gender")
    op.drop_column("employees", "birth_date")
    op.drop_column("employees", "home_address")
    op.drop_column("employees", "phone_number")
    op.drop_column("employees", "preferred_first_name")
    op.drop_column("employees", "legal_name")