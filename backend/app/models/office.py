import uuid
from datetime import datetime
from sqlalchemy import String,Boolean,Float,DateTime,ForeignKey,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
class Office(Base):
    __tablename__="offices"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    name: Mapped[str]=mapped_column(String(150),unique=True)
    address: Mapped[str]=mapped_column(String(300))
    latitude: Mapped[float]=mapped_column(Float); longitude: Mapped[float]=mapped_column(Float)
    geofence_radius_meters: Mapped[float]=mapped_column(Float,default=150)
    maximum_gps_accuracy_meters: Mapped[float]=mapped_column(Float,default=100)
    timezone: Mapped[str]=mapped_column(String(64),default="Asia/Kolkata")
    is_active: Mapped[bool]=mapped_column(Boolean,default=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=datetime.utcnow)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=datetime.utcnow,onupdate=datetime.utcnow)
class EmployeeOffice(Base):
    __tablename__="employee_offices"
    __table_args__=(UniqueConstraint("employee_id","office_id"),)
    employee_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("employees.id"),primary_key=True)
    office_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("offices.id"),primary_key=True)

