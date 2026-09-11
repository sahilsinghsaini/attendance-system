from alembic import op
import sqlalchemy as sa


revision = "192305f47de3"
down_revision = "736a27ef9954"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "employees",
        sa.Column("pan", sa.String(length=10), nullable=True)
    )

    op.add_column(
        "employees",
        sa.Column("sin", sa.String(length=9), nullable=True)
    )


def downgrade():
    op.drop_column("employees", "sin")
    op.drop_column("employees", "pan")