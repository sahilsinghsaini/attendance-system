import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.models  # noqa: F401  (registers all mapped models on Base.metadata)
from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.models.employee import Employee
from app.models.manager import ManagerProfile
from app.models.schedule import WorkSchedule
from app.core.security import hash_password, create_access_token

# ---- isolated in-memory sqlite shared across threads (TestClient runs sync
# endpoints in a threadpool, so a single StaticPool connection is required) ----
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def auth_header(user_id):
    token = create_access_token(str(user_id))
    return {"Authorization": f"Bearer {token}"}


def make_user(db, role, status=UserStatus.ACTIVE):
    u = User(
        email=f"{uuid.uuid4().hex}@example.com",
        password_hash=hash_password("x" * 12),
        role=role,
        status=status,
        email_verified=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def super_admin(db):
    return make_user(db, UserRole.SUPER_ADMIN)


@pytest.fixture()
def manager_user(db):
    u = make_user(db, UserRole.MANAGER)
    db.add(ManagerProfile(user_id=u.id, full_name="Test Manager"))
    db.commit()
    return u


@pytest.fixture()
def employee_with_manager(db, manager_user):
    u = make_user(db, UserRole.EMPLOYEE)
    e = Employee(
        user_id=u.id,
        employee_code=f"E-{uuid.uuid4().hex[:8].upper()}",
        full_name="Test Employee",
        department="Engineering",
        primary_manager_id=manager_user.id,
        status="ACTIVE",
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return u, e


# ---------------------------------------------------------------------------
# 1. Model registration
# ---------------------------------------------------------------------------

def test_work_schedule_registered_on_metadata():
    assert "work_schedules" in Base.metadata.tables


def test_employee_has_schedule_column():
    assert hasattr(Employee, "schedule_id")


# ---------------------------------------------------------------------------
# 2. Super Admin can create schedules
# ---------------------------------------------------------------------------

def test_super_admin_can_create_schedule(super_admin):
    r = client.post(
        "/api/v1/admin/schedules",
        json={"name": f"Day Shift {uuid.uuid4().hex[:6]}", "start_time": "09:00:00", "end_time": "18:00:00", "grace_minutes": 10},
        headers=auth_header(super_admin.id),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["start_time"] == "09:00:00"
    assert body["grace_minutes"] == 10


def test_duplicate_schedule_name_rejected(super_admin):
    name = f"Unique Shift {uuid.uuid4().hex[:6]}"
    payload = {"name": name, "start_time": "09:00:00", "end_time": "17:00:00"}
    r1 = client.post("/api/v1/admin/schedules", json=payload, headers=auth_header(super_admin.id))
    assert r1.status_code == 200
    r2 = client.post("/api/v1/admin/schedules", json=payload, headers=auth_header(super_admin.id))
    assert r2.status_code == 409


def test_non_admin_cannot_create_schedule(employee_with_manager):
    emp_user, _ = employee_with_manager
    r = client.post(
        "/api/v1/admin/schedules",
        json={"name": f"Blocked {uuid.uuid4().hex[:6]}", "start_time": "09:00:00", "end_time": "17:00:00"},
        headers=auth_header(emp_user.id),
    )
    assert r.status_code == 403


def test_manager_cannot_create_schedule(manager_user):
    r = client.post(
        "/api/v1/admin/schedules",
        json={"name": f"Blocked Mgr {uuid.uuid4().hex[:6]}", "start_time": "09:00:00", "end_time": "17:00:00"},
        headers=auth_header(manager_user.id),
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 3. Super Admin can assign a schedule to an employee
# ---------------------------------------------------------------------------

def test_super_admin_can_assign_schedule(super_admin, employee_with_manager, db):
    emp_user, employee = employee_with_manager
    create = client.post(
        "/api/v1/admin/schedules",
        json={"name": f"Morning {uuid.uuid4().hex[:6]}", "start_time": "08:00:00", "end_time": "16:00:00"},
        headers=auth_header(super_admin.id),
    )
    schedule_id = create.json()["id"]

    r = client.post(
        f"/api/v1/admin/employees/{employee.id}/schedule",
        json={"schedule_id": schedule_id},
        headers=auth_header(super_admin.id),
    )
    assert r.status_code == 200, r.text
    assert r.json()["schedule_id"] == schedule_id

    db.refresh(employee)
    assert str(employee.schedule_id) == schedule_id


def test_assign_invalid_schedule_rejected(super_admin, employee_with_manager):
    _, employee = employee_with_manager
    r = client.post(
        f"/api/v1/admin/employees/{employee.id}/schedule",
        json={"schedule_id": str(uuid.uuid4())},
        headers=auth_header(super_admin.id),
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 4. Employee page shows their assigned schedule
# ---------------------------------------------------------------------------

def test_employee_sees_own_schedule(super_admin, employee_with_manager):
    emp_user, employee = employee_with_manager
    create = client.post(
        "/api/v1/admin/schedules",
        json={"name": f"Evening {uuid.uuid4().hex[:6]}", "start_time": "14:00:00", "end_time": "22:00:00", "grace_minutes": 5},
        headers=auth_header(super_admin.id),
    )
    schedule = create.json()
    client.post(
        f"/api/v1/admin/employees/{employee.id}/schedule",
        json={"schedule_id": schedule["id"]},
        headers=auth_header(super_admin.id),
    )

    r = client.get("/api/v1/schedule/mine", headers=auth_header(emp_user.id))
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == schedule["name"]
    assert body["start_time"] == "14:00"
    assert body["end_time"] == "22:00"
    assert body["grace_minutes"] == 5


def test_employee_without_schedule_gets_null(employee_with_manager):
    emp_user, _ = employee_with_manager
    r = client.get("/api/v1/schedule/mine", headers=auth_header(emp_user.id))
    assert r.status_code == 200
    assert r.json() is None


# ---------------------------------------------------------------------------
# 5. Manager page shows each employee's assigned schedule
# ---------------------------------------------------------------------------

def test_manager_sees_team_member_schedule(super_admin, manager_user, employee_with_manager):
    emp_user, employee = employee_with_manager
    create = client.post(
        "/api/v1/admin/schedules",
        json={"name": f"Night {uuid.uuid4().hex[:6]}", "start_time": "22:00:00", "end_time": "06:00:00"},
        headers=auth_header(super_admin.id),
    )
    schedule = create.json()
    client.post(
        f"/api/v1/admin/employees/{employee.id}/schedule",
        json={"schedule_id": schedule["id"]},
        headers=auth_header(super_admin.id),
    )

    r = client.get("/api/v1/manager/employees", headers=auth_header(manager_user.id))
    assert r.status_code == 200
    rows = r.json()
    row = next(x for x in rows if x["id"] == str(employee.id))
    assert row["schedule_name"] == schedule["name"]
    assert row["schedule_start_time"] == "22:00"


def test_manager_sees_null_schedule_for_unassigned_employee(manager_user, employee_with_manager):
    emp_user, employee = employee_with_manager
    r = client.get("/api/v1/manager/employees", headers=auth_header(manager_user.id))
    row = next(x for x in r.json() if x["id"] == str(employee.id))
    assert row["schedule_name"] is None
