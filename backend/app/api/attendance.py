from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from app.db.session import get_db
from app.core.permissions import require_permission, Permission
from app.schemas.common import PunchIn
from app.services.attendance_service import (
    punch_in,
    break_start,
    break_end,
    punch_out
)
from app.models.attendance import (
    AttendanceSession,
    AttendanceBreak,
    AttendanceException
)
from app.models.office import Office, EmployeeOffice
from app.models.schedule import WorkSchedule
from app.models.work_hours import WorkHoursPolicy
from app.services.work_hours_service import summary_for


router = APIRouter(
    prefix="/api/v1/attendance",
    tags=["attendance"]
)


def utc_iso(value):
    if value is None:
        return None

    if value.tzinfo is None:
        value = value.replace(
            tzinfo=timezone.utc
        )

    return value.isoformat().replace(
        "+00:00",
        "Z"
    )


def local_iso(value, timezone_name):
    if value is None:
        return None

    if value.tzinfo is None:
        value = value.replace(
            tzinfo=timezone.utc
        )

    return value.astimezone(
        ZoneInfo(timezone_name)
    ).isoformat()


@router.post("/punch-in")
def pi(
    data: PunchIn,
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.PUNCH_ATTENDANCE
        )
    )
):
    return punch_in(
        db,
        u,
        data
    )


@router.post("/break/start")
def bs(
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.PUNCH_ATTENDANCE
        )
    )
):
    return break_start(
        db,
        u
    )


@router.post("/break/end")
def be(
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.PUNCH_ATTENDANCE
        )
    )
):
    return break_end(
        db,
        u
    )


@router.post("/punch-out")
def po(
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.PUNCH_ATTENDANCE
        )
    )
):
    return punch_out(
        db,
        u
    )
@router.get("/profile")
def my_profile(
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.VIEW_OWN_ATTENDANCE))
):
    e = u.employee

    if not e:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )

    return {
        "id": e.id,
        "employee_code": e.employee_code,
        "full_name": e.full_name,
        "legal_name": e.legal_name,
        "preferred_first_name": e.preferred_first_name,
        "phone_number": e.phone_number,
        "home_address": e.home_address,
        "birth_date": e.birth_date,
        "gender": e.gender,
        "status": e.status,
        "hire_date": e.hire_date,
        "pay_schedule": e.pay_schedule,
        "department": e.department,
        "job_title": e.job_title,
        "primary_manager_id": e.primary_manager_id,
        "schedule_id": e.schedule_id,
    }

@router.get("/today")
def today(
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_OWN_ATTENDANCE
        )
    )
):
    e = u.employee

    if not e:
        return None

    # ---------------------------------------------------------
    # FIND THE MOST RECENT ATTENDANCE SESSION
    # ---------------------------------------------------------
    session = db.scalar(
        select(AttendanceSession)
        .where(
            AttendanceSession.employee_id == e.id
        )
        .order_by(
            AttendanceSession.work_date.desc()
        )
    )

    if not session:
        return None

    # ---------------------------------------------------------
    # USE THE OFFICE ATTACHED TO THIS ATTENDANCE SESSION
    # ---------------------------------------------------------
    office = None

    if session.office_id:
        office = db.get(
            Office,
            session.office_id
        )

    # ---------------------------------------------------------
    # DETERMINE LOCAL DATE
    # ---------------------------------------------------------
    if office:
        timezone_name = office.timezone
    else:
        timezone_name = "UTC"

        if e.schedule_id:
            schedule_for_timezone = db.get(
                WorkSchedule,
                e.schedule_id
            )

            if schedule_for_timezone:
                timezone_name = (
                    schedule_for_timezone.timezone
                )

    try:
        attendance_tz = ZoneInfo(
            timezone_name
        )
    except Exception:
        attendance_tz = ZoneInfo("UTC")
        timezone_name = "UTC"

    local_now = datetime.now(
        timezone.utc
    ).astimezone(
        attendance_tz
    )



    # ---------------------------------------------------------
    # ACTIVE BREAK
    # ---------------------------------------------------------
    active_break = db.scalar(
        select(AttendanceBreak)
        .where(
            AttendanceBreak.attendance_session_id == session.id,
            AttendanceBreak.end_at.is_(None)
        )
        .order_by(
            AttendanceBreak.start_at.desc()
        )
    )

    # ---------------------------------------------------------
    # SCHEDULE
    # ---------------------------------------------------------
    schedule = None

    if e.schedule_id:
        schedule = db.get(
            WorkSchedule,
            e.schedule_id
        )

    # ---------------------------------------------------------
    # LATE PUNCH INFORMATION
    # ---------------------------------------------------------
    late_exception = db.scalar(
        select(AttendanceException)
        .where(
            AttendanceException.attendance_session_id == session.id,
            AttendanceException.exception_type == "LATE_PUNCH_IN"
        )
        .order_by(
            AttendanceException.id.desc()
        )
    )

    late_minutes = (
        late_exception.difference_minutes
        if late_exception
        else 0
    )

    if late_minutes is None:
        late_minutes = 0

    punch_status = (
        "Late Punch In"
        if late_minutes > 0
        else "On Time"
    )

    # ---------------------------------------------------------
    # SCHEDULED TIMES
    # ---------------------------------------------------------
    scheduled_start_at = None
    scheduled_end_at = None
    adjusted_scheduled_end_at = None

    if schedule:
        try:
            scheduled_start_at = datetime.combine(
                session.work_date,
                schedule.start_time,
                tzinfo=attendance_tz
            )

            scheduled_end_at = datetime.combine(
                session.work_date,
                schedule.end_time,
                tzinfo=attendance_tz
            )

            if scheduled_end_at <= scheduled_start_at:
                scheduled_end_at = (
                    scheduled_end_at
                    + timedelta(days=1)
                )

            adjusted_scheduled_end_at = (
                scheduled_end_at
                + timedelta(
                    minutes=late_minutes
                )
            )

        except Exception:
            scheduled_start_at = None
            scheduled_end_at = None
            adjusted_scheduled_end_at = None

    # ---------------------------------------------------------
    # RETURN ATTENDANCE DETAILS
    # ---------------------------------------------------------
    return {
        "id": session.id,
        "employee_id": session.employee_id,
        "work_date": session.work_date,

        "mode": session.mode,
        "office_id": session.office_id,
        "approved_wfh_request_id": (
            session.approved_wfh_request_id
        ),

        "state": session.state,

        "punch_in_at": utc_iso(
            session.punch_in_at
        ),

        "punch_out_at": utc_iso(
            session.punch_out_at
        ),

        "total_break_seconds": (
            session.total_break_seconds
        ),

        "active_break_start_at": utc_iso(
            active_break.start_at
            if active_break
            else None
        ),

        "punch_status": punch_status,

        "late_minutes": late_minutes,

        "scheduled_start_at": (
            local_iso(
                scheduled_start_at,
                timezone_name
            )
            if scheduled_start_at
            else None
        ),

        "scheduled_end_at": (
            local_iso(
                scheduled_end_at,
                timezone_name
            )
            if scheduled_end_at
            else None
        ),

        "adjusted_scheduled_end_at": (
            local_iso(
                adjusted_scheduled_end_at,
                timezone_name
            )
            if adjusted_scheduled_end_at
            else None
        )
    }

@router.get("/history")
def history(
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_OWN_ATTENDANCE
        )
    )
):
    if not u.employee:
        return []

    return db.scalars(
        select(AttendanceSession)
        .where(
            AttendanceSession.employee_id == u.employee.id
        )
        .order_by(
            AttendanceSession.work_date.desc()
        )
    ).all()


@router.get("/work-hours")
def my_work_hours(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_OWN_WORK_HOURS
        )
    )
):
    e = u.employee

    if not e:
        return None

    p = db.scalar(
        select(WorkHoursPolicy)
        .where(
            WorkHoursPolicy.employee_id == e.id,
            WorkHoursPolicy.year == year,
            WorkHoursPolicy.month == month
        )
    )

    return summary_for(
        db,
        e.id,
        year,
        month,
        p.required_hours
        if p
        else None
    )

