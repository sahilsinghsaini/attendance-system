from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision="0003";down_revision="0002";branch_labels=None;depends_on=None
def upgrade():
    op.create_table(
        "work_schedules",
        sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),
        sa.Column("name",sa.String(150),nullable=False,unique=True),
        sa.Column("start_time",sa.Time(),nullable=False),
        sa.Column("end_time",sa.Time(),nullable=False),
        sa.Column("timezone",sa.String(64),nullable=False),
        sa.Column("grace_minutes",sa.Integer(),nullable=False),
        sa.Column("created_by",postgresql.UUID(as_uuid=True),sa.ForeignKey("users.id"),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True)),
        sa.Column("updated_at",sa.DateTime(timezone=True)),
    )
    op.add_column(
        "employees",
        sa.Column("schedule_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("work_schedules.id"),nullable=True),
    )
    op.create_index("ix_employees_schedule_id","employees",["schedule_id"])
def downgrade():
    op.drop_index("ix_employees_schedule_id",table_name="employees")
    op.drop_column("employees","schedule_id")
    op.drop_table("work_schedules")
