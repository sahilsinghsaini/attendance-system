from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision="0002";down_revision="0001";branch_labels=None;depends_on=None
def upgrade():
    op.create_table(
        "work_hours_policies",
        sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),
        sa.Column("employee_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("employees.id"),nullable=False),
        sa.Column("year",sa.Integer(),nullable=False),
        sa.Column("month",sa.Integer(),nullable=False),
        sa.Column("required_hours",sa.Float(),nullable=False),
        sa.Column("set_by",postgresql.UUID(as_uuid=True),sa.ForeignKey("users.id"),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True)),
        sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("employee_id","year","month",name="uq_work_hours_employee_month"),
    )
    op.create_index("ix_work_hours_policies_employee_id","work_hours_policies",["employee_id"])
def downgrade():
    op.drop_index("ix_work_hours_policies_employee_id",table_name="work_hours_policies")
    op.drop_table("work_hours_policies")
