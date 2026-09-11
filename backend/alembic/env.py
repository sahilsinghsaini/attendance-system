from logging.config import fileConfig
from sqlalchemy import create_engine,pool
from alembic import context
from app.db.base import Base
import app.models
config=context.config
if config.config_file_name:
    pass
target_metadata=Base.metadata
def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"),target_metadata=target_metadata,literal_binds=True,compare_type=True)
    with context.begin_transaction(): context.run_migrations()
def run_migrations_online():
    url=config.get_main_option("sqlalchemy.url")
    connectable=create_engine(url,poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True
        )

        with context.begin_transaction():
            context.run_migrations()
if context.is_offline_mode(): run_migrations_offline()
else: run_migrations_online()
