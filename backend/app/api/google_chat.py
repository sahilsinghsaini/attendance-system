from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.attendance import (
    AttendanceSession,
    AttendanceBreak,
    AttendanceException,
    AttendanceState,
)
from app.models.office import Office, EmployeeOffice
from app.models.schedule import WorkSchedule


router = APIRouter(
    prefix="/api/v1/google-chat",
    tags=["google-chat"],
)


def format_time(value, timezone_name):
    if value is None:
        return "â€”"

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    try:
        local_value = value.astimezone(
            ZoneInfo(timezone_name)
        )
    except Exception:
        local_value = value

    return local_value.strftime("%I:%M %p").lstrip("0")


def format_duration(seconds):
    seconds = int(seconds or 0)

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60

    if hours:
        return f"{hours}h {minutes}m"

    return f"{minutes}m"


def get_chat_email(event):
    user = event.get("user") or {}

    email = user.get("email")

    if email:
        return email.strip().lower()

    return None


def build_attendance_card(
    display_name,
    employee,
    session,
    active_break,
    late_minutes,
    schedule,
    timezone_name,
):  
    if session is None:
        state = "NOT_STARTED"
        mode = "🟡"
        punch_in = "-"
        punch_out = "-"
        break_text = "No break"
        break_total = "0m"
        status_text = "Not started"
        status_icon = "🟡"

    else:
        state = (
            session.state.value
            if hasattr(session.state, "value")
            else str(session.state)
        )

        mode = (
            session.mode.value
            if hasattr(session.mode, "value")
            else str(session.mode)
        )

        punch_in = format_time(
            session.punch_in_at,
            timezone_name,
        )

        punch_out = format_time(
            session.punch_out_at,
            timezone_name,
        )

        break_total = format_duration(
            session.total_break_seconds
        )

        if state == "WORKING":
            status_text = "Working"
            status_icon = "🟢"

        elif state == "ON_BREAK":
            status_text = "On Break"
            status_icon = "🟠"

        elif state == "COMPLETED":
            status_text = "Completed"
            status_icon = "🔵"

        else:
            status_text = state.replace(
                "_",
                " "
            ).title()
            status_icon = "🟡"

        if active_break:
            break_text = (
                "Currently on break"
            )
        else:
            break_text = "No active break"

    if late_minutes and late_minutes > 0:
        attendance_status = (
            f"Late by {late_minutes} minutes"
        )
    else:
        attendance_status = "On Time"

    if schedule:
        scheduled_start = schedule.start_time.strftime(
            "%I:%M %p"
        ).lstrip("0")

        scheduled_end = schedule.end_time.strftime(
            "%I:%M %p"
        ).lstrip("0")

        schedule_text = (
           f"{scheduled_start} – {scheduled_end}"
        )
    else:
        schedule_text = "No schedule assigned"

    widgets = [
        {
            "textParagraph": {
                "text": (
                    f"<b>{status_icon} {status_text}</b><br>"
                    f"{attendance_status}"
                )
            }
        },
        {
            "divider": {}
        },
        {
            "textParagraph": {
                "text": (
                    f"<b>Mode:</b> {mode}<br>"
                    f"<b>Punch In:</b> {punch_in}<br>"
                    f"<b>Punch Out:</b> {punch_out}<br>"
                    f"<b>Break:</b> {break_text}<br>"
                    f"<b>Total Break:</b> {break_total}<br>"
                    f"<b>Schedule:</b> {schedule_text}"
                )
            }
        },
        {
            "divider": {}
        },
        {
            "buttonList": {
                "buttons": [
                    {
                        "text": "Open Attendance",
                        "onClick": {
                            "openLink": {
                                "url": (
                                    "https://tobacentral.com"
                                )
                            }
                        },
                    }
                ]
            }
        },
    ]

    return {
        "cardsV2": [
            {
                "cardId": "attendance-home",
                "card": {
                    "header": {
                        "title": "Tobacentral",
                        "subtitle": display_name,
                    },
                    "sections": [
                        {
                            "header": "Today's Attendance",
                            "widgets": widgets,
                        }
                    ],
                },
            }
        ]
    }

CHAT_ISSUER = "chat@system.gserviceaccount.com"

CHAT_AUDIENCE = (
    "https://attendance-backend-524557555278.asia-south2.run.app/api/v1/google-chat/events"
)


def verify_google_chat_request(request: Request):
    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing Google Chat authorization token",
        )

    bearer_token = authorization.split(" ", 1)[1].strip()

    if not bearer_token:
        raise HTTPException(
            status_code=401,
            detail="Missing Google Chat authorization token",
        )

    try:
        token = id_token.verify_oauth2_token(
            bearer_token,
            google_requests.Request(),
            CHAT_AUDIENCE,
        )

        if token.get("email") != CHAT_ISSUER:
            raise HTTPException(
                status_code=401,
                detail="Invalid Google Chat issuer",
            )

        return token

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google Chat authorization token",
        )
@router.post("/events")
async def google_chat_event(
    request: Request,
    db: Session = Depends(get_db),
):
    verify_google_chat_request(request)
    event = await request.json()

    chat_user = event.get("user") or {}

    email = get_chat_email(event)

    display_name = (
        chat_user.get("displayName")
        or "Employee"
    )

    if not email:
        return {
            "text": (
                "I couldn't identify your Google Chat account."
            )
        }

    # ---------------------------------------------------------
    # MATCH GOOGLE CHAT USER TO EXISTING ATTENDANCE USER
    # ---------------------------------------------------------

    user = db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if not user:
        return {
            "text": (
                "Your Google Chat email is not registered "
                "in the attendance system."
            )
        }

    employee = user.employee

    if not employee:
        return {
            "text": (
                "Your attendance employee profile "
                "has not been configured yet."
            )
        }

    # ---------------------------------------------------------
    # FIND EMPLOYEE OFFICE / TIMEZONE
    # ---------------------------------------------------------

    office = None

    employee_office = db.scalar(
        select(EmployeeOffice)
        .where(
            EmployeeOffice.employee_id == employee.id
        )
        .limit(1)
    )

    if employee_office:
        office = db.get(
            Office,
            employee_office.office_id
        )

    timezone_name = "UTC"

    if office:
        timezone_name = office.timezone

    elif employee.schedule_id:
        schedule_for_timezone = db.get(
            WorkSchedule,
            employee.schedule_id
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
        timezone_name = "UTC"
        attendance_tz = ZoneInfo("UTC")

    # ---------------------------------------------------------
    # TODAY IN EMPLOYEE'S OFFICE TIMEZONE
    # ---------------------------------------------------------

    local_now = datetime.now(
        timezone.utc
    ).astimezone(
        attendance_tz
    )

    today_date = local_now.date()

    # ---------------------------------------------------------
    # TODAY'S ATTENDANCE ONLY
    # ---------------------------------------------------------

    session = db.scalar(
        select(AttendanceSession)
        .where(
            AttendanceSession.employee_id == employee.id,
            AttendanceSession.work_date == today_date,
        )
        .order_by(
            AttendanceSession.punch_in_at.desc()
        )
    )

    active_break = None
    late_minutes = 0

    if session:
        active_break = db.scalar(
            select(AttendanceBreak)
            .where(
                AttendanceBreak.attendance_session_id
                == session.id,
                AttendanceBreak.end_at.is_(None),
            )
            .order_by(
                AttendanceBreak.start_at.desc()
            )
        )

        late_exception = db.scalar(
            select(AttendanceException)
            .where(
                AttendanceException.attendance_session_id
                == session.id,
                AttendanceException.exception_type
                == "LATE_PUNCH_IN",
            )
            .order_by(
                AttendanceException.id.desc()
            )
        )

        if late_exception:
            late_minutes = (
                late_exception.difference_minutes
                or 0
            )

    # ---------------------------------------------------------
    # SCHEDULE
    # ---------------------------------------------------------

    schedule = None

    if employee.schedule_id:
        schedule = db.get(
            WorkSchedule,
            employee.schedule_id
        )

    return build_attendance_card(
        display_name=(
            employee.preferred_first_name
            or employee.full_name
            or display_name
        ),
        employee=employee,
        session=session,
        active_break=active_break,
        late_minutes=late_minutes,
        schedule=schedule,
        timezone_name=timezone_name,
    )
