import uuid
from datetime import datetime, time

from sqlalchemy import String, Time, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(
        String(150),
        unique=True
    )

    start_time: Mapped[time] = mapped_column(Time)

    end_time: Mapped[time] = mapped_column(Time)

    timezone: Mapped[str] = mapped_column(
        String(64),
        default="Asia/Kolkata"
    )

    grace_minutes: Mapped[int] = mapped_column(
        default=0
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )