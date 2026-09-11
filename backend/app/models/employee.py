import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Date
from sqlalchemy.orm import Mapped,mapped_column,relationship
from app.db.base import Base
class Employee(Base):
    __tablename__="employees"

    id: Mapped[uuid.UUID]=mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID]=mapped_column(
        ForeignKey("users.id"),
        unique=True,
        index=True
    )

    employee_code: Mapped[str]=mapped_column(
        String(50),
        unique=True
    )

    full_name: Mapped[str]=mapped_column(
        String(200)
    )

    legal_name: Mapped[str|None]=mapped_column(
        String(200),
        nullable=True
    )

    preferred_first_name: Mapped[str|None]=mapped_column(
        String(100),
        nullable=True
    )

    phone_number: Mapped[str|None]=mapped_column(
        String(30),
        nullable=True
    )

    home_address: Mapped[str|None]=mapped_column(
        String(500),
        nullable=True
    )

    birth_date: Mapped[date|None]=mapped_column(
        Date,
        nullable=True
    )

    gender: Mapped[str|None]=mapped_column(
        String(50),
        nullable=True
    )

    pan: Mapped[str|None]=mapped_column(
    String(10),
    nullable=True
)

    sin: Mapped[str|None]=mapped_column(
    String(9),
    nullable=True
)

    department: Mapped[str]=mapped_column(
        String(150)
    )

    primary_manager_id: Mapped[uuid.UUID|None]=mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    schedule_id: Mapped[uuid.UUID|None]=mapped_column(
        ForeignKey("work_schedules.id"),
        nullable=True,
        index=True
    )

    hire_date: Mapped[date|None]=mapped_column(
        Date,
        nullable=True
    )

    pay_schedule: Mapped[str|None]=mapped_column(
        String(50),
        nullable=True
    )

    job_title: Mapped[str|None]=mapped_column(
        String(150),
        nullable=True
    )

    status: Mapped[str]=mapped_column(
        String(30),
        default="PENDING_APPROVAL"
    )

    created_at: Mapped[datetime]=mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime]=mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    user=relationship(
        "User",
        back_populates="employee",
        foreign_keys=[user_id]
    )

    schedule=relationship(
        "WorkSchedule",
        foreign_keys=[schedule_id]
    )
