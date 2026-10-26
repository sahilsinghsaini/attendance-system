import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.models.holiday import Holiday, HolidayOverride

router = APIRouter(prefix="/api/v1/holidays", tags=["holidays"])

# Organization calendar dates explicitly removed from the 2026 holiday schedule.
REMOVED_HOLIDAY_DATES = {"2026-11-09", "2026-11-18"}

# Curated default list of official holidays, cultural festivals, and annual company days
DEFAULT_EVENTS = [
    # 2026
    {
        "id": "2026-01-01",
        "title": "New Year's Day",
        "date": "2026-01-01",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Welcoming the new year 2026. Paid public holiday. All offices closed.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-01-14",
        "title": "Makar Sankranti / Pongal",
        "date": "2026-01-14",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Harvest festival celebrating the sun's journey into the Northern hemisphere.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-01-26",
        "title": "Republic Day",
        "date": "2026-01-26",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "National Holiday honoring the enactment of the Constitution of India. 3-day long weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-02-15",
        "title": "Maha Shivratri",
        "date": "2026-02-15",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Annual sacred festival dedicated to Lord Shiva, spiritual reflection and prayers.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-03-03",
        "title": "Holi (Festival of Colors)",
        "date": "2026-03-03",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Grand festival celebrating the arrival of spring, joy, and unity with organic colors.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-03-20",
        "title": "Eid-ul-Fitr",
        "date": "2026-03-20",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Celebration of the conclusion of Ramadan with feasts, charity, and fellowship. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-03-31",
        "title": "Annual Financial Year Closing",
        "date": "2026-03-31",
        "category": "ANNUAL_DAY",
        "office_status": "WORKING_CELEBRATION",
        "description": "Corporate milestone celebrating year-end wrap up, tax filing accomplishments, and team lunch.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-04-03",
        "title": "Good Friday",
        "date": "2026-04-03",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Solemn Christian observance commemorating the crucifixion of Jesus Christ. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-04-14",
        "title": "Dr. Ambedkar Jayanti / Vaisakhi",
        "date": "2026-04-14",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Birth anniversary of Dr. B.R. Ambedkar and traditional harvest festival Vaisakhi.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-05-01",
        "title": "International Workers' Day",
        "date": "2026-05-01",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Global observance honoring the dedication and achievements of workers. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-05-27",
        "title": "Eid al-Adha (Bakrid)",
        "date": "2026-05-27",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Feast of the Sacrifice commemorating devotion, charity, and communal prayers.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-07-15",
        "title": "Tobatax Annual Foundation Day",
        "date": "2026-07-15",
        "category": "ANNUAL_DAY",
        "office_status": "WORKING_CELEBRATION",
        "description": "Tobatax's founding anniversary! Annual townhall, corporate milestones, cake cutting, and recognition.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-08-15",
        "title": "Independence Day",
        "date": "2026-08-15",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "National Holiday commemorating India's sovereignty in 1947. Flag hoisting & patriotic ceremony.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-08-28",
        "title": "Raksha Bandhan",
        "date": "2026-08-28",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Sacred festival celebrating brotherly and sisterly bonds with rakhi and sweets. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-09-04",
        "title": "Janmashtami",
        "date": "2026-09-04",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Celebrating the birth of Lord Krishna with devotional singing and traditions. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-09-15",
        "title": "Tobatax Annual Tech & Innovation Day",
        "date": "2026-09-15",
        "category": "ANNUAL_DAY",
        "office_status": "WORKING_CELEBRATION",
        "description": "Annual hackathon demos, engineering innovation keynotes, and product showcases.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-10-02",
        "title": "Mahatma Gandhi Jayanti",
        "date": "2026-10-02",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "National Holiday honoring Mahatma Gandhi's principles of truth, peace, and non-violence. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-10-20",
        "title": "Dussehra (Vijayadashami)",
        "date": "2026-10-20",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Grand festival celebrating the triumph of good over evil, righteousness, and victory.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-11-08",
        "title": "Diwali (Festival of Lights)",
        "date": "2026-11-08",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "The auspicious Festival of Lights celebrating prosperity, light, and joy. Deepavali festivities.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-11-09",
        "title": "Govardhan Puja / New Year",
        "date": "2026-11-09",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Post-Diwali celebrations, Annakut offerings, and regional new year blessings. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-11-24",
        "title": "Guru Nanak Jayanti",
        "date": "2026-11-24",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Birth anniversary of Guru Nanak Dev Ji celebrating equality, unity, and selfless service.",
        "is_long_weekend": False,
    },
    {
        "id": "2026-12-18",
        "title": "Tobatax Annual Gala & Awards Night",
        "date": "2026-12-18",
        "category": "ANNUAL_DAY",
        "office_status": "WORKING_CELEBRATION",
        "description": "Flagship annual party with dinner, yearly excellence awards, team entertainment, and gift exchange.",
        "is_long_weekend": True,
    },
    {
        "id": "2026-12-25",
        "title": "Christmas Day",
        "date": "2026-12-25",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Worldwide celebration of Christmas. Office secret Santa, festivities, and year-end spirit. 3-day weekend.",
        "is_long_weekend": True,
    },
    # 2025 Highlights
    {
        "id": "2025-01-26",
        "title": "Republic Day",
        "date": "2025-01-26",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "National Holiday honoring the Constitution of India.",
        "is_long_weekend": False,
    },
    {
        "id": "2025-08-15",
        "title": "Independence Day",
        "date": "2025-08-15",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "National holiday commemorating Indian Independence.",
        "is_long_weekend": True,
    },
    {
        "id": "2025-10-20",
        "title": "Diwali",
        "date": "2025-10-20",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Festival of Lights and festive celebration.",
        "is_long_weekend": True,
    },
    {
        "id": "2025-12-25",
        "title": "Christmas Day",
        "date": "2025-12-25",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Christmas holiday celebrations.",
        "is_long_weekend": False,
    },
    # 2027 Highlights
    {
        "id": "2027-01-01",
        "title": "New Year's Day",
        "date": "2027-01-01",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Welcoming the year 2027. 3-day weekend.",
        "is_long_weekend": True,
    },
    {
        "id": "2027-01-13",
        "title": "Lohri",
        "date": "2027-01-13",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Lohri, the winter harvest festival celebrated with bonfires and community gatherings.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-01-26",
        "title": "Republic Day",
        "date": "2027-01-26",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "78th Republic Day celebration.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-03-06",
        "title": "Maha Shivratri",
        "date": "2027-03-06",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Festival dedicated to Lord Shiva, observed with prayer and reflection.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-03-22",
        "title": "Holi",
        "date": "2027-03-22",
        "category": "FESTIVAL",
        "office_status": "CLOSED",
        "description": "Festival of colors celebrating the arrival of spring.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-08-15",
        "title": "Independence Day",
        "date": "2027-08-15",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "National Independence celebration.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-08-17",
        "title": "Raksha Bandhan",
        "date": "2027-08-17",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Festival celebrating the bond between siblings.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-08-25",
        "title": "Janmashtami",
        "date": "2027-08-25",
        "category": "FESTIVAL",
        "office_status": "OPTIONAL",
        "description": "Celebration of the birth of Lord Krishna.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-10-09",
        "title": "Dussehra (Vijayadashami)",
        "date": "2027-10-09",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Festival marking the victory of good over evil.",
        "is_long_weekend": False,
    },
    {
        "id": "2027-10-29",
        "title": "Diwali",
        "date": "2027-10-29",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Festival of lights celebrations.",
        "is_long_weekend": True,
    },
    {
        "id": "2027-12-25",
        "title": "Christmas Day",
        "date": "2027-12-25",
        "category": "PUBLIC_HOLIDAY",
        "office_status": "CLOSED",
        "description": "Christmas celebration.",
        "is_long_weekend": False,
    },
]


class HolidayCreate(BaseModel):
    title: str
    date: date
    category: str = "PUBLIC_HOLIDAY"
    office_status: str = "CLOSED"
    description: Optional[str] = None
    is_long_weekend: bool = False


@router.get("")
def get_holidays(
    year: Optional[int] = Query(None, description="Filter by year (e.g. 2026)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retrieve all holidays, festivals, and company annual days."""
    custom_events = [
        {
            "id": str(h.id),
            "title": h.title,
            "date": h.date.isoformat(),
            "category": h.category,
            "office_status": h.office_status,
            "description": h.description,
            "is_long_weekend": h.is_long_weekend,
            "is_custom": True,
        }
        for h in db.scalars(select(Holiday)).all()
    ]
    overrides = {
        item.event_id: item
        for item in db.scalars(select(HolidayOverride)).all()
    }

    all_events = []
    for default_event in DEFAULT_EVENTS:
        if default_event["date"] in REMOVED_HOLIDAY_DATES:
            continue
        override = overrides.get(default_event["id"])
        if override and override.is_deleted:
            continue
        event = dict(default_event)
        if override:
            for field in ("title", "date", "category", "office_status", "description", "is_long_weekend"):
                value = getattr(override, field)
                if value is not None:
                    event[field] = value.isoformat() if field == "date" else value
        all_events.append(event)

    all_events.extend(custom_events)
    all_events = [event for event in all_events if event["date"] not in REMOVED_HOLIDAY_DATES]

    if year:
        all_events = [e for e in all_events if e["date"].startswith(f"{year}-")]

    # Sort chronologically
    all_events.sort(key=lambda x: x["date"])

    return all_events


@router.post("")
def create_holiday(
    payload: HolidayCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a company holiday or festival (Super Admin only)."""
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can manage organization holidays")

    holiday = Holiday(
        title=payload.title,
        date=payload.date,
        category=payload.category,
        office_status=payload.office_status,
        description=payload.description,
        is_long_weekend=payload.is_long_weekend,
        created_by=user.id,
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)

    return {
        "id": str(holiday.id),
        "title": holiday.title,
        "date": holiday.date.isoformat(),
        "category": holiday.category,
        "office_status": holiday.office_status,
        "description": holiday.description,
        "is_long_weekend": holiday.is_long_weekend,
        "is_custom": True,
    }


@router.put("/{holiday_id}")
def update_holiday(
    holiday_id: str,
    payload: HolidayCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can manage organization holidays")

    values = payload.model_dump()
    try:
        holiday = db.get(Holiday, uuid.UUID(holiday_id))
    except ValueError:
        holiday = None

    if holiday:
        for field, value in values.items():
            setattr(holiday, field, value)
        db.commit()
        db.refresh(holiday)
        return {
            "id": str(holiday.id), "title": holiday.title,
            "date": holiday.date.isoformat(), "category": holiday.category,
            "office_status": holiday.office_status, "description": holiday.description,
            "is_long_weekend": holiday.is_long_weekend, "is_custom": True,
        }

    default_event = next((event for event in DEFAULT_EVENTS if event["id"] == holiday_id), None)
    if not default_event:
        raise HTTPException(status_code=404, detail="Holiday not found")

    override = db.get(HolidayOverride, holiday_id)
    if not override:
        override = HolidayOverride(event_id=holiday_id)
        db.add(override)
    override.is_deleted = False
    for field, value in values.items():
        setattr(override, field, value)
    db.commit()
    return {"id": holiday_id, **{**values, "date": values["date"].isoformat()}, "is_custom": False}


@router.delete("/{holiday_id}")
def delete_holiday(
    holiday_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a holiday from the organization calendar (Super Admin only)."""
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Permission denied. Only Super Admin can delete holidays.")

    try:
        uid = uuid.UUID(holiday_id)
    except ValueError:
        uid = None

    if uid:
        holiday = db.get(Holiday, uid)
        if not holiday:
            raise HTTPException(status_code=404, detail="Holiday not found")
        db.delete(holiday)
        db.commit()
        return {"message": "Holiday removed successfully", "id": holiday_id}

    if not any(event["id"] == holiday_id for event in DEFAULT_EVENTS):
        raise HTTPException(status_code=404, detail="Holiday not found")
    override = db.get(HolidayOverride, holiday_id)
    if not override:
        override = HolidayOverride(event_id=holiday_id)
        db.add(override)
    override.is_deleted = True
    db.commit()

    return {"message": "Holiday removed successfully", "id": holiday_id}

