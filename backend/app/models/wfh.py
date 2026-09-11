import uuid
from datetime import date,datetime
from sqlalchemy import Date,DateTime,String,Text,ForeignKey
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
class WFHRequest(Base):
    __tablename__="wfh_requests"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("employees.id"),index=True)
    start_date: Mapped[date]=mapped_column(Date); end_date: Mapped[date]=mapped_column(Date)
    reason: Mapped[str]=mapped_column(Text); status: Mapped[str]=mapped_column(String(20),default="PENDING")
    manager_comment: Mapped[str|None]=mapped_column(Text); reviewed_by: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=datetime.utcnow)
