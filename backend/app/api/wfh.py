from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
import uuid
from app.db.session import get_db
from app.api.deps import get_current_user
from app.core.permissions import require_permission,Permission
from app.models.wfh import WFHRequest
from app.schemas.common import WFHCreate
router=APIRouter(prefix="/api/v1/wfh",tags=["wfh"])
@router.post("/requests")
def create(data:WFHCreate,db:Session=Depends(get_db),u=Depends(require_permission(Permission.REQUEST_WFH))):
    if data.end_date<data.start_date: raise HTTPException(422,"Invalid date range")
    r=WFHRequest(employee_id=u.employee.id,start_date=data.start_date,end_date=data.end_date,reason=data.reason); db.add(r); db.commit(); db.refresh(r); return r
@router.get("/requests")
def mine(db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_OWN_WFH))):
    return db.scalars(select(WFHRequest).where(WFHRequest.employee_id==u.employee.id).order_by(WFHRequest.created_at.desc())).all()
@router.delete("/requests/{id}")
def cancel(id:uuid.UUID,db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_OWN_WFH))):
    r=db.get(WFHRequest,id)
    if not r or r.employee_id!=u.employee.id: raise HTTPException(404,"Not found")
    if r.status!="PENDING": raise HTTPException(409,"Only pending requests can be cancelled")
    r.status="CANCELLED"; db.commit(); return r
