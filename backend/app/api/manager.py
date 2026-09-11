from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
import uuid
from app.db.session import get_db
from app.core.permissions import require_permission,Permission  
from app.models.employee import Employee
from app.models.wfh import WFHRequest
from app.models.user import UserStatus
from app.schemas.common import ReviewIn,WorkHoursSet
from pydantic import BaseModel, Field, field_validator
from datetime import date
from app.models.work_hours import WorkHoursPolicy
from app.models.schedule import WorkSchedule
from app.services.work_hours_service import summary_for
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from app.models.attendance import (
    AttendanceSession,
    AttendanceBreak,
    AttendanceException
)
from app.models.office import Office
from app.models.office import Office, EmployeeOffice
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
        select(Employee)
        .where(
            Employee.primary_manager_id == u.id
        )
    ).all()

    now = datetime.now(timezone.utc)
    out = []

    for e in team:

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
            out.append({
                "employee_id": e.id,
                "employee_name": e.full_name,
                "employee_code": e.employee_code,
                "state": "NOT_STARTED",
                "mode": None,
                "office": None,
                "punch_in_at": None,
                "punch_out_at": None,
                "break_minutes": 0,
                "worked_minutes": 0,
                "scheduled_start": None,
                "scheduled_end": None,
                "punch_status": "Not Started",
                "late_minutes": 0,
                "adjusted_scheduled_end": None
            })
            continue

        office = None

        if session.office_id:
            office = db.get(
                Office,
                session.office_id
            )

        timezone_name = (
            office.timezone
            if office
            else "UTC"
        )

        try:
            local_tz = ZoneInfo(timezone_name)
        except Exception:
            local_tz = ZoneInfo("UTC")
            timezone_name = "UTC"

        break_seconds = (
            session.total_break_seconds or 0
        )

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

        if active_break:
            break_start = active_break.start_at

            if break_start.tzinfo is None:
                break_start = break_start.replace(
                    tzinfo=timezone.utc
                )

            break_seconds += int(
                (
                    now - break_start
                ).total_seconds()
            )

        break_minutes = max(
            0,
            round(break_seconds / 60)
        )

        punch_in = session.punch_in_at
        worked_minutes = 0

        if punch_in:
            if punch_in.tzinfo is None:
                punch_in = punch_in.replace(
                    tzinfo=timezone.utc
                )

            end_time = (
                session.punch_out_at
                if session.punch_out_at
                else now
            )

            if end_time.tzinfo is None:
                end_time = end_time.replace(
                    tzinfo=timezone.utc
                )

            worked_seconds = max(
                0,
                int(
                    (
                        end_time - punch_in
                    ).total_seconds()
                ) - break_seconds
            )

            worked_minutes = round(
                worked_seconds / 60
            )

        schedule = None

        if e.schedule_id:
            schedule = db.get(
                WorkSchedule,
                e.schedule_id
            )

        scheduled_start = None
        scheduled_end = None
        adjusted_scheduled_end = None

        if schedule:
            scheduled_start_dt = datetime.combine(
                session.work_date,
                schedule.start_time,
                tzinfo=local_tz
            )

            scheduled_end_dt = datetime.combine(
                session.work_date,
                schedule.end_time,
                tzinfo=local_tz
            )

            if scheduled_end_dt <= scheduled_start_dt:
                scheduled_end_dt += timedelta(days=1)

            scheduled_start = scheduled_start_dt.isoformat()
            scheduled_end = scheduled_end_dt.isoformat()

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
            "Late"
            if late_minutes > 0
            else "On Time"
        )

        if scheduled_end:
            scheduled_end_dt = datetime.fromisoformat(
                scheduled_end
            )

            adjusted_scheduled_end = (
                scheduled_end_dt
                + timedelta(
                    minutes=late_minutes
                )
            ).isoformat()

        out.append({
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
            "scheduled_start": scheduled_start,
            "scheduled_end": scheduled_end,
            "punch_status": punch_status,
            "late_minutes": late_minutes,
            "adjusted_scheduled_end":
                adjusted_scheduled_end
        })

    return out
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
