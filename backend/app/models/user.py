import uuid
from enum import Enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
class UserRole(str,Enum): SUPER_ADMIN="SUPER_ADMIN"; MANAGER="MANAGER"; EMPLOYEE="EMPLOYEE"
class UserStatus(str,Enum): PENDING_APPROVAL="PENDING_APPROVAL"; ACTIVE="ACTIVE"; REJECTED="REJECTED"; SUSPENDED="SUSPENDED"; DEACTIVATED="DEACTIVATED"
class User(Base):
    __tablename__="users"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    email: Mapped[str]=mapped_column(String(320),unique=True,index=True)
    password_hash: Mapped[str]=mapped_column(String(512))
    role: Mapped[UserRole]=mapped_column(SAEnum(UserRole,name="user_role"))
    status: Mapped[UserStatus]=mapped_column(SAEnum(UserStatus,name="user_status"),default=UserStatus.PENDING_APPROVAL)
    email_verified: Mapped[bool]=mapped_column(Boolean,default=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=datetime.utcnow)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=datetime.utcnow,onupdate=datetime.utcnow)
    employee: Mapped["Employee|None"]=relationship(back_populates="user",uselist=False,foreign_keys="Employee.user_id")
