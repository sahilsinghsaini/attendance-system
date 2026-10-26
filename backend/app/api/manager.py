from fastapi import APIRouter,Depends,HTTPException,Request
from sqlalchemy.orm import Session
from sqlalchemy import select
import uuid
from app.db.session import get_db
from app.core.permissions import require_permission,Permission  
from app.models.employee import Employee
from app.models.wfh import WFHRequest
from app.models.leave import LeaveRequest
from app.models.user import UserStatus
from app.schemas.common import ReviewIn,WorkHoursSet
from pydantic import BaseModel, Field, field_validator
from datetime import date
from app.models.work_hours import WorkHoursPolicy
from app.models.schedule import WorkSchedule
from app.services.work_hours_service import summary_for
from app.services.audit_service import audit
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from app.models.attendance import (
    AttendanceSession,
    AttendanceBreak,
    AttendanceException,
    AttendanceAdjustment,
    AttendanceState,
)
from app.models.office import Office, EmployeeOffice


class AttendanceEditIn(BaseModel):
    punch_in_at: datetime | None = None
    punch_out_at: datetime | None = None
    state: AttendanceState | None = None
    break_minutes: float | None = Field(default=None, ge=0, le=1440)
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("punch_in_at", "punch_out_at")
    @classmethod
    def _ensure_tz(cls, v):
        if v is not None and v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v
PAN_PATTERN = r"^[A-Z]{5}[0-9]{4}[A-Z]$"
SIN_PATTERN = r"^[0-9]{9}$"
def validate_pan(value):
    if value is None or value == "":
        return None
    value = value.strip().upper()
    import re
    if not re.fullmatch(PAN_PATTERN, value):
        raise ValueError("Invalid PAN format")
    return value


def validate_sin(value):
    if value is None or value == "":
        return None
    value = value.strip()
    import re
    if not re.fullmatch(SIN_PATTERN, value):
        raise ValueError("Invalid SIN format")
    return value
class EmployeeProfileUpdate(BaseModel):
    legal_name: str | None = Field(default=None, max_length=200)
    preferred_first_name: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=30)
    home_address: str | None = Field(default=None, max_length=500)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=50)
    hire_date: date | None = None
    pay_schedule: str | None = Field(default=None, max_length=50)
    department: str | None = Field(default=None, max_length=150)
    job_title: str | None = Field(default=None, max_length=150)
router=APIRouter(prefix="/api/v1/manager",tags=["manager"])
def scoped(r,u):
    if r.employee_id not in [e.id for e in []]: pass
    return True
@router.get("/employees")
def employees(
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.VIEW_TEAM_EMPLOYEES))
):
    team = db.scalars(
        select(Employee).where(
            Employee.primary_manager_id == u.id,
            Employee.status == "ACTIVE"
        )
    ).all()


    out = []

    for e in team:
        s = db.get(
            WorkSchedule,
            e.schedule_id
        ) if e.schedule_id else None

        out.append({
            "id": e.id,
            "employee_code": e.employee_code,
            "full_name": e.full_name,
            "department": e.department,
            "primary_manager_id": e.primary_manager_id,
            "status": e.status,
            "schedule_id": e.schedule_id,
            "schedule_name": s.name if s else None,
            "schedule_start_time": (
                s.start_time.strftime("%H:%M")
                if s else None
            ),
            "schedule_end_time": (
                s.end_time.strftime("%H:%M")
                if s else None
            ),
        })

    return out
@router.get("/employees/{employee_id}/profile")
def get_employee_profile(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_TEAM_EMPLOYEES
        )
    )
):
    employee = db.get(Employee, employee_id)

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    if employee.primary_manager_id != u.id:
        raise HTTPException(
            status_code=403,
            detail="Employee is not assigned to you"
        )
    employee_offices = db.scalars(
    select(EmployeeOffice).where(
        EmployeeOffice.employee_id == employee.id
    )
).all()
    offices = db.scalars(
        select(Office).where(
            Office.id.in_([x.office_id for x in employee_offices]),
            Office.is_active == True
        )
    ).all()

    has_india_office = any(
        o.timezone == "Asia/Kolkata"
        for o in offices
    )

    has_canada_office = any(
        o.timezone == "America/Winnipeg"
        for o in offices
    )

    government_id_type = (
        "PAN"
        if has_india_office and not has_canada_office
        else "SIN"
        if has_canada_office and not has_india_office
        else None
    )

    return {
        "id": employee.id,
        "employee_code": employee.employee_code,
        "full_name": employee.full_name,
        "legal_name": employee.legal_name,
        "preferred_first_name": employee.preferred_first_name,
        "phone_number": employee.phone_number,
        "home_address": employee.home_address,
        "birth_date": employee.birth_date,
        "gender": employee.gender,
        "pan": employee.pan,
        "sin": employee.sin,
        "status": employee.status,
        "hire_date": employee.hire_date,
        "pay_schedule": employee.pay_schedule,
        "department": employee.department,
        "job_title": employee.job_title,
        "primary_manager_id": employee.primary_manager_id,
        "schedule_id": employee.schedule_id,
        "government_id_type": government_id_type,
    }
@router.put("/employees/{employee_id}/profile")
def update_employee_profile(
    employee_id: uuid.UUID,
    data: EmployeeProfileUpdate,
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_TEAM_EMPLOYEES
        )
    )
):
    employee = db.get(Employee, employee_id)

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    if employee.primary_manager_id != u.id:
        raise HTTPException(
            status_code=403,
            detail="Employee is not assigned to you"
        )

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Inactive employee profile cannot be edited"
        )

    employee.legal_name = data.legal_name
    employee.preferred_first_name = data.preferred_first_name
    employee.phone_number = data.phone_number
    employee.home_address = data.home_address
    employee.birth_date = data.birth_date
    employee.gender = data.gender
    employee.hire_date = data.hire_date
    employee.pay_schedule = data.pay_schedule
    employee.department = data.department
    employee.job_title = data.job_title

    db.commit()
    db.refresh(employee)

    return employee
@router.get("/attendance/today")
def today_attendance(
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_TEAM_EMPLOYEES
        )
    )
):
    team = db.scalars(
        select(Employee).where(
            Employee.primary_manager_id == u.id
        )
    ).all()

    schedule_ids = {
        e.schedule_id
        for e in team
        if e.schedule_id
    }

    schedules = {}

    if schedule_ids:
        rows = db.scalars(
            select(WorkSchedule).where(
                WorkSchedule.id.in_(schedule_ids)
            )
        ).all()

        for s in rows:
            schedules[s.id] = s


    now = datetime.now(timezone.utc)

    team_ids = [
        e.id for e in team
    ]


    candidate_sessions = []

    if team_ids:

        utc_today = datetime.now(
            ZoneInfo("Asia/Kolkata")
        ).date()


        candidate_sessions = db.scalars(
            select(AttendanceSession)
            .where(
                AttendanceSession.employee_id.in_(team_ids),
                AttendanceSession.work_date >= utc_today - timedelta(days=1),
                AttendanceSession.work_date <= utc_today + timedelta(days=1)
            )
        ).all()


    office_ids = {
        s.office_id
        for s in candidate_sessions
        if s.office_id
    }


    offices_by_id = {}

    if office_ids:

        offices = db.scalars(
            select(Office)
            .where(
                Office.id.in_(office_ids)
            )
        ).all()

        for o in offices:
            offices_by_id[o.id] = o



    sessions_today = {}


    for candidate in candidate_sessions:

        office = (
            offices_by_id.get(candidate.office_id)
            if candidate.office_id
            else None
        )


        try:
            tz = ZoneInfo(
                office.timezone
                if office
                else "UTC"
            )

        except Exception:
            tz = ZoneInfo("UTC")


        local_date = now.astimezone(tz).date()


        is_today = candidate.work_date == local_date
        is_active_carryover = (
            candidate.work_date == local_date - timedelta(days=1)
            and candidate.punch_out_at is None
            and candidate.state in (AttendanceState.WORKING, AttendanceState.ON_BREAK)
        )

        if is_today or is_active_carryover:

            existing = sessions_today.get(
                candidate.employee_id
            )

            if (
                existing is None
                or candidate.id > existing.id
            ):
                sessions_today[
                    candidate.employee_id
                ] = candidate



    out = []


    for e in team:

        session = sessions_today.get(e.id)


        schedule = (
            schedules.get(e.schedule_id)
            if e.schedule_id
            else None
        )


        if not session:

            out.append({
                "session_id": None,
                "employee_id": e.id,
                "employee_name": e.full_name,
                "employee_code": e.employee_code,
                "state": "NOT_STARTED",
                "mode": None,
                "office": None,
                "office_timezone": None,
                "punch_in_at": None,
                "punch_out_at": None,
                "break_minutes": 0,
                "worked_minutes": 0,
                "scheduled_start": None,
                "scheduled_end": None,
                "punch_status": "NOT_STARTED",
                "late_minutes": 0,
                "adjusted_scheduled_end": None
            })

            continue



        office = (
            offices_by_id.get(session.office_id)
            if session.office_id
            else None
        )


        break_minutes = round(
            (session.total_break_seconds or 0) / 60,
            1
        )


        worked_minutes = 0


        if session.punch_in_at:

            start = session.punch_in_at
            end = session.punch_out_at or now


            if start.tzinfo is None:
                start = start.replace(
                    tzinfo=timezone.utc
                )


            if end.tzinfo is None:
                end = end.replace(
                    tzinfo=timezone.utc
                )


            seconds = (
                end - start
            ).total_seconds()


            seconds -= (
                session.total_break_seconds or 0
            )


            worked_minutes = round(
                max(seconds,0) / 60
            )



        out.append({

            "session_id": session.id,
            "employee_id": e.id,
            "employee_name": e.full_name,
            "employee_code": e.employee_code,

            "state": session.state,
            "mode": session.mode,

            "office": (
                office.name
                if office
                else None
            ),

            "office_timezone": (
                office.timezone
                if office
                else None
            ),

            "punch_in_at": (
                session.punch_in_at.isoformat()
                if session.punch_in_at
                else None
            ),

            "punch_out_at": (
                session.punch_out_at.isoformat()
                if session.punch_out_at
                else None
            ),

            "break_minutes": break_minutes,

            "worked_minutes": worked_minutes,

            "scheduled_start": (
                schedule.start_time.strftime("%H:%M")
                if schedule
                else None
            ),

            "scheduled_end": (
                schedule.end_time.strftime("%H:%M")
                if schedule
                else None
            ),

            "punch_status": (
                "WORKING"
                if session.punch_in_at
                and not session.punch_out_at
                else "COMPLETED"
            ),

            "late_minutes": 0,

            "adjusted_scheduled_end": None
        })


    return out
@router.put("/attendance/{session_id}")
def edit_attendance_session(
    session_id: uuid.UUID,
    data: AttendanceEditIn,
    request: Request,
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_EXCEPTIONS)),
):
    session = db.get(AttendanceSession, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    employee = db.get(Employee, session.employee_id)

    if not employee or employee.primary_manager_id != u.id:
        raise HTTPException(status_code=403, detail="Outside management scope")

    if data.punch_in_at is None and data.punch_out_at is None and data.state is None and data.break_minutes is None:
        raise HTTPException(status_code=422, detail="No changes supplied")

    if data.punch_in_at and data.punch_out_at and data.punch_out_at <= data.punch_in_at:
        raise HTTPException(status_code=422, detail="Punch-out must be after punch-in")

    old_value = {
        "punch_in_at": session.punch_in_at.isoformat() if session.punch_in_at else None,
        "punch_out_at": session.punch_out_at.isoformat() if session.punch_out_at else None,
        "state": session.state,
        "total_break_seconds": session.total_break_seconds,
    }

    if data.punch_in_at is not None:
        session.punch_in_at = data.punch_in_at
    if data.punch_out_at is not None:
        session.punch_out_at = data.punch_out_at
    if data.state is not None:
        session.state = data.state
    if data.break_minutes is not None:
        session.total_break_seconds = int(data.break_minutes * 60)

    new_value = {
        "punch_in_at": session.punch_in_at.isoformat() if session.punch_in_at else None,
        "punch_out_at": session.punch_out_at.isoformat() if session.punch_out_at else None,
        "state": session.state,
        "total_break_seconds": session.total_break_seconds,
    }

    adjustment = AttendanceAdjustment(
        attendance_session_id=session.id,
        old_value=old_value,
        new_value=new_value,
        reason=data.reason,
        adjusted_by=u.id,
    )
    db.add(adjustment)

    audit(
        db,
        actor=u,
        action="MANAGER_EDIT_ATTENDANCE",
        entity_type="attendance_session",
        entity_id=session.id,
        old=old_value,
        new=new_value,
        request=request,
    )

    db.commit()
    db.refresh(session)

    return {
        "id": session.id,
        "employee_id": session.employee_id,
        "work_date": session.work_date,
        "state": session.state,
        "punch_in_at": session.punch_in_at.isoformat() if session.punch_in_at else None,
        "punch_out_at": session.punch_out_at.isoformat() if session.punch_out_at else None,
        "total_break_seconds": session.total_break_seconds,
        "reason": data.reason,
    }


@router.get("/attendance/{session_id}/history")
def attendance_edit_history(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_EXCEPTIONS)),
):
    session = db.get(AttendanceSession, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    employee = db.get(Employee, session.employee_id)

    if not employee or employee.primary_manager_id != u.id:
        raise HTTPException(status_code=403, detail="Outside management scope")

    rows = db.scalars(
        select(AttendanceAdjustment)
        .where(AttendanceAdjustment.attendance_session_id == session_id)
        .order_by(AttendanceAdjustment.created_at.desc())
    ).all()

    return [
        {
            "id": r.id,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "reason": r.reason,
            "adjusted_by": r.adjusted_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/attendance/weekly")
def weekly_attendance(
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_TEAM_EMPLOYEES
        )
    )
):
    team = db.scalars(
        select(Employee).where(
            Employee.primary_manager_id == u.id
        )
    ).all()

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=6)

    out = []

    for i in range(7):
        day = start_date + timedelta(days=i)

        total = 0
        attended = 0
        late = 0
        late_minutes = 0
        worked_minutes = 0

        for e in team:
            session = db.scalar(
                select(AttendanceSession)
                .where(
                    AttendanceSession.employee_id == e.id,
                    AttendanceSession.work_date == day
                )
            )

            total += 1

            if session:
                attended += 1

                exception = db.scalar(
                    select(AttendanceException)
                    .where(
                        AttendanceException.attendance_session_id == session.id,
                        AttendanceException.exception_type == "LATE_PUNCH_IN"
                    )
                    .order_by(
                        AttendanceException.id.desc()
                    )
                )

                minutes_late = (
                    exception.difference_minutes
                    if exception
                    else 0
                )

                minutes_late = minutes_late or 0

                if minutes_late > 0:
                    late += 1
                    late_minutes += minutes_late

                if session.punch_in_at:
                    end = (
                        session.punch_out_at
                        or datetime.now(timezone.utc)
                    )

                    punch_in = session.punch_in_at
                    if punch_in.tzinfo is None:
                        punch_in = punch_in.replace(
                            tzinfo=timezone.utc
                        )

                    if end.tzinfo is None:
                        end = end.replace(
                            tzinfo=timezone.utc
                        )

                    break_seconds = (
                        session.total_break_seconds or 0
                    )

                    worked_seconds = max(
                        0,
                        int(
                            (
                                end - punch_in
                            ).total_seconds()
                        ) - break_seconds
                    )

                    worked_minutes += round(
                        worked_seconds / 60
                    )

        out.append({
            "date": day.isoformat(),
            "total_employees": total,
            "attended": attended,
            "not_attended": total - attended,
            "late": late,
            "late_minutes": late_minutes,
            "worked_minutes": worked_minutes
        })

    return out
@router.get("/attendance/monthly")
def monthly_attendance(
    year: int,
    month: int,
    employee_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    u=Depends(
        require_permission(
            Permission.VIEW_TEAM_EMPLOYEES
        )
    )
):
    if month < 1 or month > 12:
        raise HTTPException(status_code=422, detail="Invalid month")

    current_year = datetime.now(timezone.utc).year
    if year < 2000 or year > current_year + 1:
        raise HTTPException(status_code=422, detail="Invalid year")

    team_query = select(Employee).where(
        Employee.primary_manager_id == u.id
    )

    if employee_id is not None:
        team_query = team_query.where(Employee.id == employee_id)

    team = db.scalars(team_query).all()

    if employee_id is not None and not team:
        raise HTTPException(status_code=403, detail="Outside management scope")

    if not team:
        return []

    start_date = date(year, month, 1)
    end_date = (
        date(year + 1, 1, 1)
        if month == 12
        else date(year, month + 1, 1)
    ) - timedelta(days=1)

    team_ids = [e.id for e in team]

    # --- Batch 1: all sessions for the whole team in one query ---
    all_sessions = db.scalars(
        select(AttendanceSession).where(
            AttendanceSession.employee_id.in_(team_ids),
            AttendanceSession.work_date >= start_date,
            AttendanceSession.work_date <= end_date,
        )
    ).all()

    session_ids = [s.id for s in all_sessions]

    # --- Batch 2: all LATE_PUNCH_IN exceptions for those sessions, one query ---
    exceptions_by_session: dict = {}
    if session_ids:
        exc_rows = db.scalars(
            select(AttendanceException)
            .where(
                AttendanceException.attendance_session_id.in_(session_ids),
                AttendanceException.exception_type == "LATE_PUNCH_IN",
            )
            .order_by(AttendanceException.id.desc())
        ).all()
        # first row per session wins (id desc => most recent kept)
        for exc in exc_rows:
            exceptions_by_session.setdefault(exc.attendance_session_id, exc)

    # --- Batch 3: all adjustments for those sessions, one query ---
    edited_session_ids: set = set()
    if session_ids:
        adj_rows = db.scalars(
            select(AttendanceAdjustment.attendance_session_id)
            .where(AttendanceAdjustment.attendance_session_id.in_(session_ids))
            .distinct()
        ).all()
        edited_session_ids = set(adj_rows)

    # --- Batch 4: offices for all sessions that have one, resolved once ---
    office_ids = {s.office_id for s in all_sessions if s.office_id}
    offices_by_id: dict = {}
    if office_ids:
        for o in db.scalars(select(Office).where(Office.id.in_(office_ids))).all():
            offices_by_id[o.id] = o

    def resolve_tz(office_id):
        office = offices_by_id.get(office_id) if office_id else None
        tz_name = office.timezone if office else "UTC"
        try:
            return ZoneInfo(tz_name)
        except Exception:
            return ZoneInfo("UTC")

    sessions_by_employee: dict = {}
    for s in all_sessions:
        sessions_by_employee.setdefault(s.employee_id, {})[s.work_date] = s

    now_utc = datetime.now(timezone.utc)
    out = []

    for e in team:
        sessions_by_date = sessions_by_employee.get(e.id, {})

        days = []
        present_days = 0
        late_days = 0
        total_worked_minutes = 0
        total_late_minutes = 0
        total_edited = 0

        d = start_date
        while d <= end_date:
            session = sessions_by_date.get(d)

            if session is None:
                days.append({
                    "date": d.isoformat(),
                    "session_id": None,
                    "state": "NOT_STARTED",
                    "punch_in_at": None,
                    "punch_out_at": None,
                    "break_minutes": 0,
                    "worked_minutes": 0,
                    "late_minutes": 0,
                    "was_edited": False,
                    "office_timezone": None,
                })
                d += timedelta(days=1)
                continue

            # Resolve "is this day still in progress" using the *office's*
            # local timezone (same rule today_attendance uses), not a bare
            # UTC date comparison - a session's work_date is assigned in
            # office-local time, so open sessions must be judged the same way.
            local_tz = resolve_tz(session.office_id)
            today_local = datetime.now(local_tz).date()

            punch_in = session.punch_in_at
            end_time = session.punch_out_at
            if end_time is None and d == today_local:
                end_time = now_utc

            worked_minutes = 0

            if punch_in and end_time:
                if punch_in.tzinfo is None:
                    punch_in = punch_in.replace(tzinfo=timezone.utc)
                if end_time.tzinfo is None:
                    end_time = end_time.replace(tzinfo=timezone.utc)

                break_seconds = session.total_break_seconds or 0
                worked_seconds = max(
                    0,
                    int((end_time - punch_in).total_seconds()) - break_seconds
                )
                worked_minutes = round(worked_seconds / 60)

            late_exception = exceptions_by_session.get(session.id)
            late_minutes = (late_exception.difference_minutes if late_exception else 0) or 0

            was_edited = session.id in edited_session_ids

            if session.punch_in_at:
                present_days += 1
            if late_minutes > 0:
                late_days += 1
            if was_edited:
                total_edited += 1

            total_worked_minutes += worked_minutes
            total_late_minutes += late_minutes

            days.append({
                "date": d.isoformat(),
                "session_id": session.id,
                "state": session.state,
                "punch_in_at": session.punch_in_at.isoformat() if session.punch_in_at else None,
                "punch_out_at": session.punch_out_at.isoformat() if session.punch_out_at else None,
                "break_minutes": round((session.total_break_seconds or 0) / 60),
                "worked_minutes": worked_minutes,
                "late_minutes": late_minutes,
                "was_edited": was_edited,
                "office_timezone": local_tz.key,
            })

            d += timedelta(days=1)

        out.append({
            "employee_id": e.id,
            "employee_name": e.full_name,
            "employee_code": e.employee_code,
            "year": year,
            "month": month,
            "present_days": present_days,
            "late_days": late_days,
            "edited_days": total_edited,
            "total_worked_minutes": total_worked_minutes,
            "total_late_minutes": total_late_minutes,
            "days": days,
        })

    return out


@router.get("/dashboard")
def dashboard(db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_TEAM_EMPLOYEES))):
    team=db.scalars(select(Employee).where(Employee.primary_manager_id==u.id)).all()
    return {"team_size":len(team),"active":sum(x.status=="ACTIVE" for x in team),"unassigned":0}
@router.get("/wfh")
def wfh(db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_WFH))):
    return db.scalars(select(WFHRequest).join(Employee,Employee.id==WFHRequest.employee_id).where(Employee.primary_manager_id==u.id)).all()
@router.post("/wfh/{id}/{decision}")
def review_wfh(id:uuid.UUID,decision,data:ReviewIn|None=None,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_WFH))):
    r=db.get(WFHRequest,id)
    if not r: raise HTTPException(404,"Not found")
    e=db.get(Employee,r.employee_id)
    if not e or e.primary_manager_id!=u.id: raise HTTPException(403,"Outside management scope")
    if decision not in ("approve","reject"): raise HTTPException(422,"Invalid decision")
    r.status="APPROVED" if decision=="approve" else "REJECTED"; r.manager_comment=data.comment if data else None; r.reviewed_by=u.id; db.commit(); return r
@router.get("/leave")
def manager_leave(db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_LEAVE))):
    query = (
        select(LeaveRequest, Employee)
        .join(Employee, Employee.id == LeaveRequest.employee_id)
        .where(Employee.primary_manager_id == u.id)
        .order_by(LeaveRequest.created_at.desc())
    )
    rows = db.execute(query).all()
    out = []
    for r, emp in rows:
        days = (r.end_date - r.start_date).days + 1
        out.append({
            "id": str(r.id),
            "employee_id": str(emp.id),
            "employee_name": emp.full_name,
            "employee_code": emp.employee_code,
            "department": emp.department,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "leave_type": r.leave_type,
            "reason": r.reason,
            "status": r.status,
            "days": days,
            "manager_comment": r.manager_comment,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return out
@router.post("/leave/{id}/{decision}")
def review_leave(id:uuid.UUID,decision,data:ReviewIn|None=None,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_LEAVE))):
    r=db.get(LeaveRequest,id)
    if not r: raise HTTPException(404,"Not found")
    e=db.get(Employee,r.employee_id)
    if not e or e.primary_manager_id!=u.id: raise HTTPException(403,"Outside management scope")
    if decision not in ("approve","reject"): raise HTTPException(422,"Invalid decision")
    r.status="APPROVED" if decision=="approve" else "REJECTED"
    r.manager_comment=data.comment if data else None
    r.reviewed_by=u.id
    r.updated_at=datetime.now(timezone.utc)
    db.commit()
    return r
@router.get("/work-hours")
def team_work_hours(year:int,month:int,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_WORK_HOURS))):
    team=db.scalars(select(Employee).where(Employee.primary_manager_id==u.id)).all()
    policies={p.employee_id:p for p in db.scalars(select(WorkHoursPolicy).where(WorkHoursPolicy.year==year,WorkHoursPolicy.month==month)).all()}
    out=[]
    for e in team:
        p=policies.get(e.id)
        out.append({**summary_for(db,e.id,year,month,p.required_hours if p else None),"employee_name":e.full_name,"policy_id":str(p.id) if p else None})
    return out
@router.post("/work-hours")
def set_team_work_hours(data:WorkHoursSet,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_WORK_HOURS))):
    e=db.get(Employee,data.employee_id)
    if not e or e.primary_manager_id!=u.id: raise HTTPException(403,"Outside management scope")
    existing=db.scalar(select(WorkHoursPolicy).where(WorkHoursPolicy.employee_id==data.employee_id,WorkHoursPolicy.year==data.year,WorkHoursPolicy.month==data.month))
    if existing: existing.required_hours=data.required_hours; existing.set_by=u.id; db.commit(); return existing
    x=WorkHoursPolicy(employee_id=data.employee_id,year=data.year,month=data.month,required_hours=data.required_hours,set_by=u.id)
    db.add(x); db.commit(); return x
@router.get("/registrations")
def registrations(db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_TEAM_EMPLOYEES))):
    return db.scalars(select(Employee).where(Employee.primary_manager_id==u.id,Employee.status=="PENDING_APPROVAL")).all()
@router.post("/registrations/{id}/{decision}")
def review_reg(id:uuid.UUID,decision,db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_TEAM_EMPLOYEES))):
    e=db.get(Employee,id)
    if not e or e.primary_manager_id!=u.id: raise HTTPException(403,"Outside management scope")
    if decision not in ("approve","reject"): raise HTTPException(422,"Invalid decision")
    e.status="ACTIVE" if decision=="approve" else "REJECTED"; user=e.user; user.status=UserStatus.ACTIVE if decision=="approve" else UserStatus.REJECTED; db.commit(); return e
