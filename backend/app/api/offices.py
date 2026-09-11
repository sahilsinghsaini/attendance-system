from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.office import Office,EmployeeOffice
from app.models.user import UserRole
from app.models.manager import ManagerProfile,ManagerOffice
router=APIRouter(prefix="/api/v1/offices",tags=["offices"])
@router.get("/my-offices")
def my_offices(db:Session=Depends(get_db),u=Depends(get_current_user)):

    if u.employee:
        return db.scalars(
            select(Office)
            .join(EmployeeOffice,EmployeeOffice.office_id==Office.id)
            .where(
                EmployeeOffice.employee_id==u.employee.id,
                Office.is_active==True
            )
        ).all()

    if u.role==UserRole.MANAGER:
        profile=db.scalar(
            select(ManagerProfile).where(
                ManagerProfile.user_id==u.id
            )
        )

        if not profile:
            return []

        return db.scalars(
            select(Office)
            .join(ManagerOffice,ManagerOffice.office_id==Office.id)
            .where(
                ManagerOffice.manager_id==profile.id,
                Office.is_active==True
            )
        ).all()

    return []