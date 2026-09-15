import os
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite:///./attendance_test.db"

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole, UserStatus
from app.models.office import Office, EmployeeOffice
from app.models.employee import Employee
from app.models.attendance import AttendanceSession, AttendanceMode, AttendanceState


TEST_DB_URL = "sqlite:///./attendance_test.db"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


@pytest.fixture()
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def auth_as(db_session):
    previous_override = app.dependency_overrides.get(get_db)

    def _auth_as(user):
        token = create_access_token(str(user.id))

        def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db

        client = TestClient(app)
        client.headers.update({"Authorization": f"Bearer {token}"})
        return client

    yield _auth_as

    if previous_override is not None:
        app.dependency_overrides[get_db] = previous_override
    else:
        app.dependency_overrides.pop(get_db, None)


def make_user(
    db_session,
    role=UserRole.EMPLOYEE,
    email=None,
):
    if email is None:
        email = f"{role.value.lower()}-{datetime.now(timezone.utc).timestamp()}@example.com"

    user = User(
        email=email,
        password_hash=hash_password("TestPassword123!"),
        role=role,
        status=UserStatus.ACTIVE,
        email_verified=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


def make_office(
    db_session,
    name=None,
    timezone_name="Asia/Kolkata",
):
    if name is None:
        name = f"Test Office {datetime.now(timezone.utc).timestamp()}"

    office = Office(
        name=name,
        address="Test Address",
        latitude=30.7046,
        longitude=76.7179,
        geofence_radius_meters=150,
        maximum_gps_accuracy_meters=100,
        timezone=timezone_name,
        is_active=True,
    )
    db_session.add(office)
    db_session.flush()
    return office


def make_employee(
    db_session,
    user,
    manager_id=None,
    full_name="Test Employee",
):
    employee = Employee(
        user_id=user.id,
        employee_code=f"EMP-{str(user.id)[:8]}",
        full_name=full_name,
        department="Testing",
        primary_manager_id=manager_id,
        status="ACTIVE",
    )
    db_session.add(employee)
    db_session.flush()
    return employee


def make_session(
    db_session,
    employee,
    work_date,
    punch_in_at,
    punch_out_at=None,
    office=None,
    office_id=None,
    state=AttendanceState.COMPLETED,
    mode=AttendanceMode.OFFICE,
    total_break_seconds=0,
):
    session = AttendanceSession(
        employee_id=employee.id,
        work_date=work_date,
        mode=mode,
        office_id=office.id if office is not None else office_id,
        state=state,
        punch_in_at=punch_in_at,
        punch_out_at=punch_out_at,
        total_break_seconds=total_break_seconds,
    )
    db_session.add(session)
    db_session.flush()
    return session





