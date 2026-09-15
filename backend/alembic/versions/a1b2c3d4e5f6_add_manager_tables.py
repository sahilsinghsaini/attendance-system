"""add manager tables

Revision ID: a1b2c3d4e5f6
Revises: 192305f47de3
Create Date: 2026-09-15 03:13:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a1b2c3d4e5f6'
down_revision = '192305f47de3'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS manager_profiles (
        id UUID PRIMARY KEY,
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(200) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS manager_offices (
        manager_id UUID NOT NULL REFERENCES manager_profiles(id) ON DELETE CASCADE,
        office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
        PRIMARY KEY (manager_id, office_id)
    );
    """)


def downgrade():
    op.drop_table('manager_offices')
    op.drop_table('manager_profiles')
