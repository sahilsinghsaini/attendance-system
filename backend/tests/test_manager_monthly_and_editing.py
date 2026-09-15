"""
Covers the pre-production checklist items:

  2. Year validation on Monthly Records
  3. Manager security on Monthly Records (no cross-manager leakage)
  4. Manager attendance editing (punch-in/out, break, state, reason,
     AttendanceAdjustment + AuditLog rows)
  5. Monthly calculations (present/late/edited days, total hours,
     open sessions, no-attendance days, previous months)
  6. Timezone behaviour (India vs Canada office, month boundaries)
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from zoneinfo import ZoneInfo

from app.models.user import UserRole
from app.models.attendance import (
    AttendanceState,
    AttendanceAdjustment,
    AttendanceException,
)
from app.models.audit import AuditLog

from tests.conftest import make_user, make_office, make_employee, make_session


# --------------------------------------------------------------------------
# 3. Manager security on Monthly Records
# --------------------------------------------------------------------------

def test_manager_cannot_see_own_month_with_no_team(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    client = auth_as(manager)

    resp = client.get("/api/v1/manager/attendance/monthly", params={"year": 2026, "month": 8})
    assert resp.status_code == 200
    assert resp.json() == []


def test_manager_a_cannot_retrieve_manager_b_employee(db_session, auth_as):
    manager_a = make_user(db_session, role=UserRole.MANAGER, email="mgr.a@example.com")
    manager_b = make_user(db_session, role=UserRole.MANAGER, email="mgr.b@example.com")

    emp_b_user = make_user(db_session, role=UserRole.EMPLOYEE, email="emp.b@example.com")
    emp_b = make_employee(db_session, emp_b_user, manager_id=manager_b.id, full_name="Employee B")

    client = auth_as(manager_a)

    # Manager A explicitly asking for Manager B's employee must be refused,
    # not silently return that employee's data.
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2026, "month": 8, "employee_id": str(emp_b.id)},
    )
    assert resp.status_code == 403

    # Manager A's unfiltered view must also never include Manager B's team.
    resp_all = client.get("/api/v1/manager/attendance/monthly", params={"year": 2026, "month": 8})
    assert resp_all.status_code == 200
    returned_ids = {row["employee_id"] for row in resp_all.json()}
    assert str(emp_b.id) not in returned_ids


def test_manager_can_see_own_employee_monthly_record(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)

    client = auth_as(manager)
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2026, "month": 8, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["employee_id"] == str(emp.id)


# --------------------------------------------------------------------------
# 2. Year validation
# --------------------------------------------------------------------------

@pytest.mark.parametrize("year", [0, -1, 1899, 3000, 20260])
def test_monthly_records_rejects_bad_year(db_session, auth_as, year):
    manager = make_user(db_session, role=UserRole.MANAGER)
    client = auth_as(manager)
    resp = client.get("/api/v1/manager/attendance/monthly", params={"year": year, "month": 5})
    assert resp.status_code == 422


@pytest.mark.parametrize("month", [0, -1, 13, 100])
def test_monthly_records_rejects_bad_month(db_session, auth_as, month):
    manager = make_user(db_session, role=UserRole.MANAGER)
    client = auth_as(manager)
    resp = client.get("/api/v1/manager/attendance/monthly", params={"year": 2026, "month": month})
    assert resp.status_code == 422


def test_monthly_records_accepts_reasonable_year(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    client = auth_as(manager)
    resp = client.get("/api/v1/manager/attendance/monthly", params={"year": 2024, "month": 5})
    assert resp.status_code == 200


# --------------------------------------------------------------------------
# 4. Manager attendance editing
# --------------------------------------------------------------------------

def _setup_manager_and_session(db_session, office_tz="Asia/Kolkata"):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    office = make_office(db_session, timezone_name=office_tz)
    work_date = date(2026, 8, 10)
    punch_in = datetime(2026, 8, 10, 9, 30, tzinfo=timezone.utc)
    session = make_session(db_session, emp, work_date, punch_in, office=office)
    return manager, emp, office, session


def test_manager_edit_requires_reason(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={"punch_in_at": "2026-08-10T09:00:00Z"},  # no reason
    )
    assert resp.status_code == 422


def test_manager_edit_rejects_short_reason(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={"punch_in_at": "2026-08-10T09:00:00Z", "reason": "ok"},
    )
    assert resp.status_code == 422


def test_manager_can_correct_punch_in(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={
            "punch_in_at": "2026-08-10T09:00:00Z",
            "reason": "Employee was late due to transit delay, corrected per manager verification",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["punch_in_at"].startswith("2026-08-10T09:00:00")

    adj = db_session.scalars(
        select(AttendanceAdjustment).where(AttendanceAdjustment.attendance_session_id == session.id)
    ).all()
    assert len(adj) == 1
    assert adj[0].adjusted_by == manager.id

    logs = db_session.scalars(
        select(AuditLog).where(AuditLog.entity_id == str(session.id))
    ).all()
    assert len(logs) == 1
    assert logs[0].action == "MANAGER_EDIT_ATTENDANCE"


def test_manager_can_correct_punch_out(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={
            "punch_out_at": "2026-08-10T18:00:00Z",
            "reason": "Forgot to punch out, confirmed with employee and security logs",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["punch_out_at"].startswith("2026-08-10T18:00:00")


def test_manager_can_correct_break_minutes(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={
            "break_minutes": 45,
            "reason": "Break was longer than system recorded due to a scanner issue",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["total_break_seconds"] == 45 * 60


def test_manager_can_correct_state(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={
            "state": "COMPLETED",
            "reason": "Session should be marked complete, employee left for the day",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["state"] == "COMPLETED"


def test_manager_edit_rejects_punch_out_before_punch_in(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={
            "punch_in_at": "2026-08-10T09:00:00Z",
            "punch_out_at": "2026-08-10T08:00:00Z",
            "reason": "Testing an invalid correction on purpose to check validation",
        },
    )
    assert resp.status_code == 422


def test_manager_edit_rejects_no_changes(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={"reason": "Nothing actually changed here but reason is long enough"},
    )
    assert resp.status_code == 422


def test_manager_cannot_edit_other_managers_employee(db_session, auth_as):
    manager_a = make_user(db_session, role=UserRole.MANAGER, email="a2@example.com")
    manager_b = make_user(db_session, role=UserRole.MANAGER, email="b2@example.com")
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE, email="e2@example.com")
    emp = make_employee(db_session, emp_user, manager_id=manager_b.id)
    office = make_office(db_session)
    session = make_session(
        db_session, emp, date(2026, 8, 10),
        datetime(2026, 8, 10, 9, 30, tzinfo=timezone.utc), office=office,
    )

    client = auth_as(manager_a)
    resp = client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={
            "punch_in_at": "2026-08-10T09:00:00Z",
            "reason": "Attempting to edit an employee outside my management scope",
        },
    )
    assert resp.status_code == 403


def test_edit_history_reflects_adjustment(db_session, auth_as):
    manager, emp, office, session = _setup_manager_and_session(db_session)
    client = auth_as(manager)

    client.put(
        f"/api/v1/manager/attendance/{session.id}",
        json={
            "punch_in_at": "2026-08-10T09:00:00Z",
            "reason": "Correcting punch-in time after verifying with security desk",
        },
    )

    resp = client.get(f"/api/v1/manager/attendance/{session.id}/history")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert "Correcting punch-in" in body[0]["reason"]


# --------------------------------------------------------------------------
# 5. Monthly calculations
# --------------------------------------------------------------------------

def test_monthly_present_late_edited_and_hours(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    office = make_office(db_session, timezone_name="Asia/Kolkata")

    # Day 1: normal present day, worked 8 hours, no lateness
    s1 = make_session(
        db_session, emp, date(2026, 8, 3),
        datetime(2026, 8, 3, 3, 30, tzinfo=timezone.utc),   # 09:00 IST
        punch_out_at=datetime(2026, 8, 3, 11, 30, tzinfo=timezone.utc),  # 17:00 IST
        office=office,
    )

    # Day 2: late punch-in, flagged via AttendanceException
    s2 = make_session(
        db_session, emp, date(2026, 8, 4),
        datetime(2026, 8, 4, 4, 30, tzinfo=timezone.utc),
        punch_out_at=datetime(2026, 8, 4, 12, 30, tzinfo=timezone.utc),
        office=office,
    )
    db_session.add(AttendanceException(
        attendance_session_id=s2.id,
        exception_type="LATE_PUNCH_IN",
        difference_minutes=30,
    ))
    db_session.commit()

    client = auth_as(manager)

    # Manager edits day 1's break time -> should be counted as "edited"
    resp = client.put(
        f"/api/v1/manager/attendance/{s1.id}",
        json={"break_minutes": 30, "reason": "Adjusting recorded break duration for day 1"},
    )
    assert resp.status_code == 200

    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2026, "month": 8, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    row = resp.json()[0]

    assert row["present_days"] == 2
    assert row["late_days"] == 1
    assert row["edited_days"] == 1
    assert row["total_late_minutes"] == 30
    # Day1: 8h - 30min break = 7.5h = 450 min. Day2: 8h = 480 min.
    assert row["total_worked_minutes"] == 450 + 480

    days_by_date = {d["date"]: d for d in row["days"]}
    assert days_by_date["2026-08-03"]["was_edited"] is True
    assert days_by_date["2026-08-04"]["late_minutes"] == 30

    # No-attendance day somewhere else in the month
    assert days_by_date["2026-08-05"]["state"] == "NOT_STARTED"
    assert days_by_date["2026-08-05"]["session_id"] is None
    assert days_by_date["2026-08-05"]["worked_minutes"] == 0


def test_monthly_open_incomplete_session_counts_worked_minutes_to_now(db_session, auth_as, monkeypatch):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    office = make_office(db_session, timezone_name="Asia/Kolkata")

    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    today = now_ist.date()

    # Punched in 2 hours ago, no punch-out yet (still open/incomplete).
    punch_in = datetime.now(timezone.utc) - timedelta(hours=2)
    make_session(db_session, emp, today, punch_in, punch_out_at=None, office=office)

    client = auth_as(manager)
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": today.year, "month": today.month, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    row = resp.json()[0]
    today_row = next(d for d in row["days"] if d["date"] == today.isoformat())

    assert today_row["punch_out_at"] is None
    # worked_minutes should be ~120 (computed against "now"), not zero.
    assert 110 <= today_row["worked_minutes"] <= 130
    assert row["present_days"] == 1


def test_monthly_no_attendance_for_employee_returns_all_not_started(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)

    client = auth_as(manager)
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2026, "month": 6, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    row = resp.json()[0]
    assert row["present_days"] == 0
    assert row["late_days"] == 0
    assert row["edited_days"] == 0
    assert row["total_worked_minutes"] == 0
    assert all(d["state"] == "NOT_STARTED" for d in row["days"])
    assert len(row["days"]) == 30  # June has 30 days


def test_monthly_previous_month_still_computable(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    office = make_office(db_session)

    make_session(
        db_session, emp, date(2025, 12, 15),
        datetime(2025, 12, 15, 9, 0, tzinfo=timezone.utc),
        punch_out_at=datetime(2025, 12, 15, 17, 0, tzinfo=timezone.utc),
        office=office,
    )

    client = auth_as(manager)
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2025, "month": 12, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    row = resp.json()[0]
    assert row["present_days"] == 1
    assert len(row["days"]) == 31  # December has 31 days


# --------------------------------------------------------------------------
# 6. Timezone behaviour
# --------------------------------------------------------------------------

def test_india_office_open_session_uses_kolkata_today(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    india_office = make_office(db_session, name="India HQ", timezone_name="Asia/Kolkata")

    # Just after midnight IST (which is still "yesterday evening" UTC) —
    # work_date should follow India-local date semantics, exactly like the
    # existing today_attendance logic does.
    kolkata_now = datetime.now(ZoneInfo("Asia/Kolkata"))
    work_date = kolkata_now.date()
    punch_in_utc = datetime.now(timezone.utc) - timedelta(hours=1)

    make_session(db_session, emp, work_date, punch_in_utc, punch_out_at=None, office=india_office)

    client = auth_as(manager)
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": work_date.year, "month": work_date.month, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    row = resp.json()[0]
    today_row = next(d for d in row["days"] if d["date"] == work_date.isoformat())
    # Session is still open and "today" in India time -> worked minutes
    # should be computed against now, not left at 0.
    assert today_row["worked_minutes"] > 0


def test_canada_office_timezone_used_for_open_session(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    canada_office = make_office(db_session, name="Canada Office", timezone_name="America/Toronto")

    toronto_now = datetime.now(ZoneInfo("America/Toronto"))
    work_date = toronto_now.date()
    punch_in_utc = datetime.now(timezone.utc) - timedelta(hours=1)

    make_session(db_session, emp, work_date, punch_in_utc, punch_out_at=None, office=canada_office)

    client = auth_as(manager)
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": work_date.year, "month": work_date.month, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    row = resp.json()[0]
    today_row = next(d for d in row["days"] if d["date"] == work_date.isoformat())
    assert today_row["worked_minutes"] > 0


def test_monthly_month_boundary_respects_calendar_dates(db_session, auth_as):
    """
    A session on the last day of a month must not leak into next month's
    results, and one on the first day of a month must not leak into the
    previous month's results.
    """
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    office = make_office(db_session, timezone_name="Asia/Kolkata")

    make_session(
        db_session, emp, date(2026, 7, 31),
        datetime(2026, 7, 31, 5, 0, tzinfo=timezone.utc),
        punch_out_at=datetime(2026, 7, 31, 13, 0, tzinfo=timezone.utc),
        office=office,
    )
    make_session(
        db_session, emp, date(2026, 8, 1),
        datetime(2026, 8, 1, 5, 0, tzinfo=timezone.utc),
        punch_out_at=datetime(2026, 8, 1, 13, 0, tzinfo=timezone.utc),
        office=office,
    )

    client = auth_as(manager)

    july_resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2026, "month": 7, "employee_id": str(emp.id)},
    )
    august_resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2026, "month": 8, "employee_id": str(emp.id)},
    )

    assert july_resp.json()[0]["present_days"] == 1
    assert august_resp.json()[0]["present_days"] == 1


def test_manager_today_uses_employee_office_local_date_not_utc_or_manager_timezone(
    db_session, auth_as
):
    """A Canada employee's 'today' record is based on Toronto's calendar date."""
    manager = make_user(db_session, role=UserRole.MANAGER, email="today-manager@example.com")
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE, email="toronto-employee@example.com")
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    office = make_office(
        db_session,
        name="Toronto Today Office",
        timezone_name="America/Toronto",
    )

    toronto_today = datetime.now(ZoneInfo("America/Toronto")).date()
    yesterday = toronto_today - timedelta(days=1)

    # This stale record must not be returned as today's attendance.
    make_session(
        db_session,
        emp,
        yesterday,
        datetime.now(timezone.utc) - timedelta(days=2),
        punch_out_at=datetime.now(timezone.utc) - timedelta(days=2, hours=-8),
        office=office,
    )

    client = auth_as(manager)
    resp = client.get("/api/v1/manager/attendance/today")
    assert resp.status_code == 200
    row = next(r for r in resp.json() if r["employee_id"] == str(emp.id))
    assert row["session_id"] is None
    assert row["office_timezone"] is None

    # A session assigned to Toronto's current local date must be selected,
    # regardless of where the manager's browser is located.
    make_session(
        db_session,
        emp,
        toronto_today,
        datetime.now(timezone.utc) - timedelta(minutes=30),
        punch_out_at=None,
        office=office,
    )

    resp = client.get("/api/v1/manager/attendance/today")
    assert resp.status_code == 200
    row = next(r for r in resp.json() if r["employee_id"] == str(emp.id))
    assert row["session_id"] is not None
    assert row["office_timezone"] == "America/Toronto"


def test_monthly_returns_office_timezone_for_manager_display(db_session, auth_as):
    manager = make_user(db_session, role=UserRole.MANAGER)
    emp_user = make_user(db_session, role=UserRole.EMPLOYEE)
    emp = make_employee(db_session, emp_user, manager_id=manager.id)
    office = make_office(
        db_session,
        name="Toronto Monthly Office",
        timezone_name="America/Toronto",
    )

    # 09:30 Toronto local during EDT = 13:30 UTC.
    make_session(
        db_session,
        emp,
        date(2026, 8, 10),
        datetime(2026, 8, 10, 13, 30, tzinfo=timezone.utc),
        punch_out_at=datetime(2026, 8, 10, 21, 30, tzinfo=timezone.utc),
        office=office,
    )

    client = auth_as(manager)
    resp = client.get(
        "/api/v1/manager/attendance/monthly",
        params={"year": 2026, "month": 8, "employee_id": str(emp.id)},
    )
    assert resp.status_code == 200
    day = next(d for d in resp.json()[0]["days"] if d["date"] == "2026-08-10")
    assert day["office_timezone"] == "America/Toronto"
    assert day["punch_in_at"].startswith("2026-08-10T13:30:00")


