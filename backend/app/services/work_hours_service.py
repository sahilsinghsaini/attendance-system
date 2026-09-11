from calendar import monthrange
from datetime import date, datetime, timezone
from sqlalchemy import select
from app.models.attendance import AttendanceSession

def fulfilled_seconds(db, employee_id, year: int, month: int) -> int:
    """Sum worked seconds (punch_in -> punch_out/now, minus breaks) for all
    sessions whose work_date falls in the given calendar month."""
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    sessions = db.scalars(
        select(AttendanceSession).where(
            AttendanceSession.employee_id == employee_id,
            AttendanceSession.work_date >= start,
            AttendanceSession.work_date <= end,
        )
    ).all()
    total = 0
    now = datetime.now(timezone.utc)
    for s in sessions:
        end_at = s.punch_out_at or now

        punch_in_at = s.punch_in_at
        if punch_in_at.tzinfo is None:
            punch_in_at = punch_in_at.replace(tzinfo=timezone.utc)
        if end_at.tzinfo is None:
            end_at = end_at.replace(tzinfo=timezone.utc)

        worked = (end_at - punch_in_at).total_seconds() - (s.total_break_seconds or 0)
        if worked > 0:
            total += int(worked)
    return total

def summary_for(db, employee_id, year: int, month: int, required_hours: float | None):
    fulfilled = fulfilled_seconds(db, employee_id, year, month)
    fulfilled_hours = round(fulfilled / 3600, 2)
    result = {
        "employee_id": str(employee_id),
        "year": year,
        "month": month,
        "required_hours": required_hours,
        "fulfilled_hours": fulfilled_hours,
    }
    if required_hours is not None:
        result["remaining_hours"] = max(0.0, round(required_hours - fulfilled_hours, 2))
        result["met_target"] = fulfilled_hours >= required_hours
    return result
