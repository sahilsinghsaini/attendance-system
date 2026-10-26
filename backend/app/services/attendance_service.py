from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app.models.attendance import *
from app.models.office import Office, EmployeeOffice
from app.models.schedule import WorkSchedule
from app.models.wfh import WFHRequest
from app.services.geofence_service import validate_gps


def employee_for(db, user):
    if user.employee:
        return user.employee

    return None


def punch_in(db, user, data):
    e = employee_for(db, user)

    if not e:
        raise HTTPException(
            403,
            "Manager attendance is not enabled yet"
        )

    now = datetime.now(timezone.utc)

    schedule = (
        db.get(WorkSchedule, e.schedule_id)
        if e.schedule_id
        else None
    )

    late_minutes = 0
    punch_status = "On Time"
    adjusted_scheduled_end = None

    office = None
    local_now = None
    today = None

    # ---------------------------------------------------------
    # OFFICE ATTENDANCE
    # ---------------------------------------------------------
    if data.mode == "OFFICE":
        if not data.office_id or not data.gps:
            raise HTTPException(
                422,
                "Office attendance requires office and GPS"
            )

        office = db.get(Office, data.office_id)

        if not office or not office.is_active:
            raise HTTPException(
                400,
                "Invalid office"
            )

        # Always use the selected office timezone.
        office_tz = ZoneInfo(office.timezone)
        local_now = now.astimezone(office_tz)

        # -----------------------------------------------------
        # WORK DATE + SCHEDULE CALCULATION
        # -----------------------------------------------------
        if schedule:
            overnight = (
                schedule.end_time <= schedule.start_time
            )

            # For an overnight shift such as:
            #
            # 7:30 PM -> 3:30 AM
            #
            # a punch at 1:00 AM belongs to the previous
            # calendar date because that is the shift's
            # start date.
            if (
                overnight
                and local_now.time() < schedule.end_time
            ):
                today = (
                    local_now.date()
                    - timedelta(days=1)
                )
            else:
                today = local_now.date()

            # Build scheduled start using the attendance
            # work date.
            scheduled_start = datetime.combine(
                today,
                schedule.start_time,
                tzinfo=office_tz
            )

            # Build scheduled end using the same work date.
            scheduled_end = datetime.combine(
                today,
                schedule.end_time,
                tzinfo=office_tz
            )

            # Move overnight scheduled end to the next day.
            if overnight:
                scheduled_end = (
                    scheduled_end
                    + timedelta(days=1)
                )

            # -------------------------------------------------
            # LATE PUNCH CALCULATION
            # -------------------------------------------------
            minutes_difference = int(
                (
                    local_now - scheduled_start
                ).total_seconds() / 60
            )

            if minutes_difference > schedule.grace_minutes:
                punch_status = "Late Punch In"
                late_minutes = minutes_difference

            # -------------------------------------------------
            # EXTENDED SCHEDULED END
            # -------------------------------------------------
            adjusted_scheduled_end = (
                scheduled_end
                + timedelta(minutes=late_minutes)
            )

        else:
            # No schedule assigned.
            today = local_now.date()

        # -----------------------------------------------------
        # EMPLOYEE OFFICE AUTHORIZATION
        # -----------------------------------------------------
        if not db.scalar(
            select(EmployeeOffice).where(
                EmployeeOffice.employee_id == e.id,
                EmployeeOffice.office_id == office.id
            )
        ):
            raise HTTPException(
                403,
                "Office not authorized"
            )

        # -----------------------------------------------------
        # GPS VALIDATION
        # -----------------------------------------------------
        ok, reason = validate_gps(
            office,
            data.gps.latitude,
            data.gps.longitude,
            data.gps.accuracy_meters
        )

        if not ok:
            raise HTTPException(
                400,
                reason
            )

        mode = AttendanceMode.OFFICE
        wfh_id = None

    # ---------------------------------------------------------
    # WFH ATTENDANCE
    # ---------------------------------------------------------
    elif data.mode == "WFH":
        # Use schedule timezone when available.
        # Otherwise fall back to UTC.
        if schedule:
            try:
                wfh_tz = ZoneInfo(schedule.timezone)
                local_wfh_now = now.astimezone(wfh_tz)
                today = local_wfh_now.date()
            except Exception:
                today = now.date()
        else:
            today = now.date()

        req = db.scalar(
            select(WFHRequest).where(
                WFHRequest.employee_id == e.id,
                WFHRequest.status == "APPROVED",
                WFHRequest.start_date <= today,
                WFHRequest.end_date >= today
            )
        )

        if not req:
            raise HTTPException(
                400,
                "WFH_NOT_APPROVED"
            )

        mode = AttendanceMode.WFH
        wfh_id = req.id

    else:
        raise HTTPException(
            422,
            "Invalid attendance mode"
        )

    # ---------------------------------------------------------
    # DUPLICATE ATTENDANCE CHECK
    # ---------------------------------------------------------
    existing = db.scalar(
        select(AttendanceSession)
        .where(
            AttendanceSession.employee_id == e.id,
            AttendanceSession.work_date == today
        )
        .with_for_update()
    )

    if existing:
        raise HTTPException(
            409,
            "Attendance already started"
        )

    # ---------------------------------------------------------
    # CREATE ATTENDANCE SESSION
    # ---------------------------------------------------------
    s = AttendanceSession(
        employee_id=e.id,
        work_date=today,
        mode=mode,
        office_id=(
            data.office_id
            if mode == AttendanceMode.OFFICE
            else None
        ),
        approved_wfh_request_id=wfh_id,
        punch_in_at=now,
        state=AttendanceState.WORKING
    )

    db.add(s)

    try:
        db.flush()

        # -----------------------------------------------------
        # PUNCH-IN EVENT
        # -----------------------------------------------------
        db.add(
            AttendanceEvent(
                attendance_session_id=s.id,
                event_type="PUNCH_IN",
                occurred_at=now,
                latitude=getattr(
                    data.gps,
                    "latitude",
                    None
                ),
                longitude=getattr(
                    data.gps,
                    "longitude",
                    None
                ),
                gps_accuracy_meters=getattr(
                    data.gps,
                    "accuracy_meters",
                    None
                )
            )
        )

        # -----------------------------------------------------
        # LATE PUNCH EXCEPTION
        # -----------------------------------------------------
        #
        # This stores the exact late minutes so Manager
        # reports can later show:
        #
        #   Late Punch In
        #   Late by 27 minutes
        #
        # The adjusted scheduled end is calculated from the
        # same late_minutes value when reporting.
        #
        if (
            punch_status == "Late Punch In"
            and late_minutes > 0
        ):
            db.add(
                AttendanceException(
                    attendance_session_id=s.id,
                    exception_type="LATE_PUNCH_IN",
                    difference_minutes=late_minutes
                )
            )

        db.commit()
        db.refresh(s)

        return s

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            409,
            "Attendance already started"
        )


def break_start(db, user):
    e = employee_for(db, user)

    if not e:
        raise HTTPException(
            403,
            "Employee profile required"
        )

    s = db.scalar(
        select(AttendanceSession)
        .where(
            AttendanceSession.employee_id == e.id
        )
        .order_by(
            AttendanceSession.work_date.desc()
        )
        .with_for_update()
    )

    if not s or s.state != AttendanceState.WORKING:
        raise HTTPException(
            409,
            "Invalid state transition"
        )

    now = datetime.now(timezone.utc)

    b = AttendanceBreak(
        attendance_session_id=s.id,
        start_at=now
    )

    db.add(b)

    s.state = AttendanceState.ON_BREAK

    db.commit()

    return s


def break_end(db, user):
    e = employee_for(db, user)

    if not e:
        raise HTTPException(
            403,
            "Employee profile required"
        )

    s = db.scalar(
        select(AttendanceSession)
        .where(
            AttendanceSession.employee_id == e.id
        )
        .order_by(
            AttendanceSession.work_date.desc()
        )
        .with_for_update()
    )

    if not s or s.state != AttendanceState.ON_BREAK:
        raise HTTPException(
            409,
            "Invalid state transition"
        )

    b = db.scalar(
        select(AttendanceBreak)
        .where(
            AttendanceBreak.attendance_session_id == s.id,
            AttendanceBreak.end_at.is_(None)
        )
        .order_by(
            AttendanceBreak.start_at.desc()
        )
    )

    if not b:
        raise HTTPException(
            409,
            "Active break not found"
        )

    start_at = b.start_at

    if start_at.tzinfo is None:
        start_at = start_at.replace(
            tzinfo=timezone.utc
        )

    now = datetime.now(timezone.utc)

    b.end_at = now

    s.total_break_seconds = (
        (s.total_break_seconds or 0)
        + int(
            (now - start_at).total_seconds()
        )
    )

    s.state = AttendanceState.WORKING

    db.commit()

    return s


def punch_out(db, user):
    e = employee_for(db, user)

    if not e:
        raise HTTPException(
            403,
            "Employee profile required"
        )

    s = db.scalar(
        select(AttendanceSession)
        .where(
            AttendanceSession.employee_id == e.id,
            AttendanceSession.state == AttendanceState.WORKING
        )
        .order_by(
            AttendanceSession.work_date.desc()
        )
        .with_for_update()
    )

    if not s or s.state != AttendanceState.WORKING:
        raise HTTPException(
            409,
            "Invalid state transition"
        )

    now = datetime.now(timezone.utc)

    s.punch_out_at = now
    s.state = AttendanceState.COMPLETED

    from app.core.config import settings

    actual = (
        (s.total_break_seconds or 0)
        / 60
    )

    if actual > settings.break_allowance_minutes:
        db.add(
            AttendanceException(
                attendance_session_id=s.id,
                exception_type="OVER_BREAK",
                difference_minutes=round(
                    actual
                    - settings.break_allowance_minutes
                )
            )
        )

    elif (
        settings.require_full_break
        and actual < settings.break_allowance_minutes
    ):
        db.add(
            AttendanceException(
                attendance_session_id=s.id,
                exception_type="UNDER_BREAK",
                difference_minutes=round(
                    actual
                    - settings.break_allowance_minutes
                )
            )
        )

    db.add(
        AttendanceEvent(
            attendance_session_id=s.id,
            event_type="PUNCH_OUT",
            occurred_at=now
        )
    )

    db.commit()

    return s

