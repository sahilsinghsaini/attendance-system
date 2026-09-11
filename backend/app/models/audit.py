import uuid
from datetime import datetime
from sqlalchemy import String,DateTime,ForeignKey,JSON,Text
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
class AuditLog(Base):
    __tablename__="audit_logs"
    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("users.id"))
    action: Mapped[str]=mapped_column(String(80),index=True); entity_type: Mapped[str]=mapped_column(String(80)); entity_id: Mapped[str]=mapped_column(String(80))
    old_value: Mapped[dict|None]=mapped_column(JSON); new_value: Mapped[dict|None]=mapped_column(JSON)
    ip_address: Mapped[str|None]=mapped_column(String(64)); user_agent: Mapped[str|None]=mapped_column(Text)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=datetime.utcnow)
