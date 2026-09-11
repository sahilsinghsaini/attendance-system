from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_permission,Permission
from app.models.schedule import WorkSchedule

router=APIRouter(prefix="/api/v1/schedule",tags=["schedule"])

@router.get("/mine")
def my_schedule(db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_OWN_SCHEDULE))):
    e=u.employee
    if not e or not e.schedule_id:
        return None
    s=db.get(WorkSchedule,e.schedule_id)
    if not s:
        return None
    return {
        "id":s.id,
        "name":s.name,
        "start_time":s.start_time.strftime("%H:%M"),
        "end_time":s.end_time.strftime("%H:%M"),
        "timezone":s.timezone,
        "grace_minutes":s.grace_minutes,
    }
