import uuid
from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )

    date: Mapped[date] = mapped_column(
        Date,
        index=True,
        nullable=False
    )

    category: Mapped[str] = mapped_column(
        String(50),
        default="PUBLIC_HOLIDAY"
    )

    office_status: Mapped[str] = mapped_column(
        String(50),
        default="CLOSED"
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    is_long_weekend: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
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


class HolidayOverride(Base):
    """Persist Super Admin edits and removals for built-in calendar entries."""
    __tablename__ = "holiday_overrides"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    office_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_long_weekend: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
