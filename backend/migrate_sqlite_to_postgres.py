import sqlite3
import json
import uuid

from sqlalchemy import create_engine, MetaData, Table, select


SQLITE_URL = "sqlite:///./attendance.db"
POSTGRES_URL = "postgresql+psycopg://attendance:tobatax%401234@127.0.0.1:5433/attendance"
sqlite_engine = create_engine(SQLITE_URL)
postgres_engine = create_engine(POSTGRES_URL)

sqlite_meta = MetaData()
postgres_meta = MetaData()

sqlite_meta.reflect(bind=sqlite_engine)
postgres_meta.reflect(bind=postgres_engine)


# Parent tables must be copied before tables that reference them.
TABLE_ORDER = [
    "users",
    "offices",
    "work_schedules",
    "employees",
    "employee_offices",
    "wfh_requests",
    "attendance_sessions",
    "attendance_breaks",
    "attendance_events",
    "attendance_exceptions",
    "attendance_adjustments",
    "work_hours_policies",
    "audit_logs",
]


JSON_COLUMNS = {
    "attendance_adjustments": {"old_value", "new_value"},
    "audit_logs": {"old_value", "new_value"},
}


def convert_value(table_name, column_name, value):
    if value is None:
        return None

    # SQLite stores UUIDs as 32-character strings.
    if column_name.endswith("_id") or column_name == "id":
        text = str(value)
        if len(text) == 32:
            try:
                return uuid.UUID(text)
            except ValueError:
                pass

    if table_name in JSON_COLUMNS and column_name in JSON_COLUMNS[table_name]:
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value

    return value


with sqlite_engine.connect() as sqlite_conn, postgres_engine.begin() as pg_conn:

    for table_name in TABLE_ORDER:
        sqlite_table = sqlite_meta.tables[table_name]
        postgres_table = postgres_meta.tables[table_name]

        rows = sqlite_conn.execute(select(sqlite_table)).mappings().all()

        if not rows:
            print(f"{table_name}: 0 rows")
            continue

        converted_rows = []

        for row in rows:
            data = {}

            for column in postgres_table.columns:
                if column.name in row:
                    data[column.name] = convert_value(
                        table_name,
                        column.name,
                        row[column.name],
                    )

            converted_rows.append(data)

        pg_conn.execute(postgres_table.insert(), converted_rows)

        print(f"{table_name}: {len(converted_rows)} rows")


print()
print("Migration completed successfully.")