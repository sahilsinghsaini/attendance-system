import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ManagerProfile(Base):
    __tablename__ = "manager_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        index=True
    )

    full_name: Mapped[str] = mapped_column(
        String(200)
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


class ManagerOffice(Base):
    __tablename__ = "manager_offices"

    __table_args__ = (
        UniqueConstraint("manager_id", "office_id"),
    )

    manager_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("manager_profiles.id"),
        primary_key=True
    )

    office_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("offices.id"),
        primary_key=True
    )