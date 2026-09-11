import uuid
from enum import Enum
from datetime import datetime,date
from sqlalchemy import String,DateTime,Date,ForeignKey,Float,Enum as SAEnum,Text,JSON,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
class AttendanceMode(str,Enum): OFFICE="OFFICE"; WFH="WFH"
class AttendanceState(str,Enum): NOT_STARTED="NOT_STARTED"; WORKING="WORKING"; ON_BREAK="ON_BREAK"; COMPLETED="COMPLETED"
class AttendanceSession(Base):
    __tablename__="attendance_sessions"
    __table_args__=(UniqueConstraint("employee_id","work_date"),)
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("employees.id"),index=True)
    work_date: Mapped[date]=mapped_column(Date,index=True)
    mode: Mapped[AttendanceMode]=mapped_column(SAEnum(AttendanceMode,name="attendance_mode"))
    office_id: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("offices.id"),nullable=True)
    approved_wfh_request_id: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("wfh_requests.id"),nullable=True)
    state: Mapped[AttendanceState]=mapped_column(SAEnum(AttendanceState,name="attendance_state"),default=AttendanceState.WORKING)
    punch_in_at: Mapped[datetime]=mapped_column(DateTime(timezone=True))
    punch_out_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    total_break_seconds: Mapped[int]=mapped_column(default=0)
class AttendanceBreak(Base):
    __tablename__="attendance_breaks"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    attendance_session_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("attendance_sessions.id"),index=True)
    start_at: Mapped[datetime]=mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
class AttendanceEvent(Base):
    __tablename__="attendance_events"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    attendance_session_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("attendance_sessions.id"),index=True)
    event_type: Mapped[str]=mapped_column(String(40)); occurred_at: Mapped[datetime]=mapped_column(DateTime(timezone=True))
    latitude: Mapped[float|None]=mapped_column(Float); longitude: Mapped[float|None]=mapped_column(Float); gps_accuracy_meters: Mapped[float|None]=mapped_column(Float)
class AttendanceException(Base):
    __tablename__="attendance_exceptions"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    attendance_session_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("attendance_sessions.id"),index=True)
    exception_type: Mapped[str]=mapped_column(String(50)); difference_minutes: Mapped[int|None]=mapped_column()
    status: Mapped[str]=mapped_column(String(30),default="OPEN"); notes: Mapped[str|None]=mapped_column(Text)
class AttendanceAdjustment(Base):
    __tablename__="attendance_adjustments"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    attendance_session_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("attendance_sessions.id"))
    old_value: Mapped[dict]=mapped_column(JSON); new_value: Mapped[dict]=mapped_column(JSON); reason: Mapped[str]=mapped_column(Text)
    adjusted_by: Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id")); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=datetime.utcnow)
