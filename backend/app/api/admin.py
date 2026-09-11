from fastapi import APIRouter,Depends,HTTPException,Request
from sqlalchemy.orm import Session
from sqlalchemy import select,func
import uuid
from app.db.session import get_db
from app.core.permissions import require_permission,Permission
from app.core.security import hash_password
from app.models.user import User,UserRole,UserStatus
from app.models.employee import Employee
from app.models.office import Office,EmployeeOffice
from app.models.attendance import AttendanceSession,AttendanceException
from app.models.wfh import WFHRequest
from app.models.audit import AuditLog
from app.schemas.common import ManagerCreate,EmployeeCreate,EmployeeUpdate,ManagerAssign,OfficeCreate,AdjustmentIn,WorkHoursSet,ScheduleCreate,ScheduleAssign
from app.models.work_hours import WorkHoursPolicy
from app.services.audit_service import audit
from app.services.work_hours_service import summary_for
from app.models.manager import ManagerProfile,ManagerOffice
from app.models.schedule import WorkSchedule
router=APIRouter(prefix="/api/v1/admin",tags=["admin"])
sa=Depends(require_permission(Permission.MANAGE_USERS))
@router.get("/dashboard")
def dashboard(db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_ALL_ATTENDANCE))):
    return {"employees":db.scalar(select(func.count()).select_from(Employee)),"managers":db.scalar(select(func.count()).select_from(User).where(User.role==UserRole.MANAGER)),"offices":db.scalar(select(func.count()).select_from(Office).where(Office.is_active==True)),"exceptions":db.scalar(select(func.count()).select_from(AttendanceException).where(AttendanceException.status=="OPEN"))}
@router.get("/users")
def users(db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_USERS))): return db.scalars(select(User).order_by(User.created_at.desc())).all()
@router.post("/managers")
def create_manager(
    data: ManagerCreate,
    request: Request,
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_MANAGERS))
):
    if db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(409, "Email exists")

    x = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=UserRole.MANAGER,
        status=UserStatus.ACTIVE,
        email_verified=True
    )
    db.add(x)
    db.flush()

    profile = ManagerProfile(
        user_id=x.id,
        full_name=data.full_name
    )
    db.add(profile)
    db.flush()

    audit(
        db,
        u,
        "USER_CREATED",
        "User",
        x.id,
        new={"role": "MANAGER"},
        request=request
    )

    db.commit()
    return x

@router.get("/employees")
def list_employees(
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_USERS))
):
    employees = db.scalars(
        select(Employee).order_by(Employee.created_at.desc())
    ).all()

    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "employee_code": e.employee_code,
            "full_name": e.full_name,
            "department": e.department,
            "pan": e.pan,
            "sin": e.sin,
            "government_id_type": (
             "PAN"
    if e.pan
    else "SIN"
    if e.sin
    else None
),
            "primary_manager_id": e.primary_manager_id,
            "schedule_id": e.schedule_id,
            "status": e.status,
"email": db.get(User, e.user_id).email if db.get(User, e.user_id) else "",
"government_id_type": (
    "PAN"
    if any(
        o.timezone == "Asia/Kolkata"
        for o in db.scalars(
            select(Office)
            .join(
                EmployeeOffice,
                EmployeeOffice.office_id == Office.id
            )
            .where(
                EmployeeOffice.employee_id == e.id,
                Office.is_active == True
            )
        ).all()
    )
    else "SIN"
    if any(
        o.timezone == "America/Winnipeg"
        for o in db.scalars(
            select(Office)
            .join(
                EmployeeOffice,
                EmployeeOffice.office_id == Office.id
            )
            .where(
                EmployeeOffice.employee_id == e.id,
                Office.is_active == True
            )
        ).all()
    )
    else None
)
        }
        for e in employees
    ]
@router.post("/employees")
def create_employee(data:EmployeeCreate,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_USERS))):
    if db.scalar(select(User).where(User.email==data.email)): raise HTTPException(409,"Email exists")
    x=User(email=data.email,password_hash=hash_password(data.password),role=UserRole.EMPLOYEE,status=UserStatus.ACTIVE,email_verified=True); db.add(x); db.flush(); e=Employee(user_id=x.id,employee_code="A-"+__import__("uuid").uuid4().hex[:8].upper(),full_name=data.full_name,department=data.department,status="ACTIVE"); db.add(e); audit(db,u,"USER_CREATED","User",x.id,request=request); db.commit(); return x
@router.put("/employees/{id}")
def update_employee(
    id: uuid.UUID,
    data: EmployeeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_USERS))
):
    e = db.get(Employee, id)

    if not e:
        raise HTTPException(404, "Employee not found")

    user = db.get(User, e.user_id)

    if not user:
        raise HTTPException(404, "Employee user not found")

    existing = db.scalar(
        select(User).where(
            User.email == data.email,
            User.id != user.id
        )
    )

    if existing:
        raise HTTPException(409, "Email exists")

    employee_offices = db.scalars(
        select(EmployeeOffice).where(
            EmployeeOffice.employee_id == e.id
        )
    ).all()

    offices = db.scalars(
        select(Office).where(
            Office.id.in_([x.office_id for x in employee_offices]),
            Office.is_active == True
        )
    ).all()

    has_india_office = any(
        o.timezone == "Asia/Kolkata"
        for o in offices
    )

    has_canada_office = any(
        o.timezone == "America/Winnipeg"
        for o in offices
    )

    if has_india_office and has_canada_office:
        raise HTTPException(
            400,
            "Employee cannot have both India and Winnipeg government ID types."
        )

    if data.pan and not has_india_office:
        raise HTTPException(
            400,
            "PAN can only be assigned to an India office employee."
        )

    if data.sin and not has_canada_office:
        raise HTTPException(
            400,
            "SIN can only be assigned to a Winnipeg office employee."
        )

    import re

    pan = data.pan.strip().upper() if data.pan else None
    sin = data.sin.strip() if data.sin else None

    if pan and not re.fullmatch(r"^[A-Z]{5}[0-9]{4}[A-Z]$", pan):
        raise HTTPException(422, "Invalid PAN format.")

    if sin and not re.fullmatch(r"^[0-9]{9}$", sin):
        raise HTTPException(422, "Invalid SIN format.")

    old = {
        "full_name": e.full_name,
        "email": user.email,
        "department": e.department,
    }

    e.full_name = data.full_name
    e.department = data.department
    user.email = data.email
    e.pan = data.pan
    e.sin = data.sin

    if has_india_office:
        e.pan = pan
        e.sin = None
    elif has_canada_office:
        e.sin = sin
        e.pan = None
    else:
        e.pan = None
        e.sin = None

    audit(
        db,
        u,
        "EMPLOYEE_UPDATED",
        "Employee",
        e.id,
        old=old,
        new={
            "full_name": e.full_name,
            "email": user.email,
            "department": e.department,
        },
        request=request
    )

    db.commit()
    db.refresh(e)

    return e
@router.delete("/employees/{id}")
def deactivate_employee(
    id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_USERS))
):
    e = db.get(Employee, id)

    if not e:
        raise HTTPException(404, "Employee not found")

    user = db.get(User, e.user_id)

    e.status = "INACTIVE"

    if user:
         user.status = UserStatus.DEACTIVATED

    audit(
        db,
        u,
        "EMPLOYEE_DEACTIVATED",
        "Employee",
        e.id,
        new={"status": "INACTIVE"},
        request=request
    )

    db.commit()

    return {"ok": True}
@router.post("/employees/{id}/manager")
def assign_manager(id:uuid.UUID,data:ManagerAssign,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_USERS))):
    e=db.get(Employee,id); m=db.get(User,data.manager_id)
    if not e or not m or m.role!=UserRole.MANAGER or m.status!=UserStatus.ACTIVE: raise HTTPException(422,"Valid active manager required")
    old=e.primary_manager_id;e.primary_manager_id=m.id;audit(db,u,"MANAGER_CHANGED","Employee",e.id,old={"manager_id":str(old) if old else None},new={"manager_id":str(m.id)},request=request);db.commit();return e
@router.get("/work-hours")
def list_work_hours(year:int,month:int,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_WORK_HOURS))):
    policies={p.employee_id:p for p in db.scalars(select(WorkHoursPolicy).where(WorkHoursPolicy.year==year,WorkHoursPolicy.month==month)).all()}
    out=[]
    for e in db.scalars(select(Employee)).all():
        p=policies.get(e.id)
        out.append({**summary_for(db,e.id,year,month,p.required_hours if p else None),"employee_name":e.full_name,"policy_id":str(p.id) if p else None})
    return out
@router.post("/work-hours")
def set_work_hours(data:WorkHoursSet,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_WORK_HOURS))):
    e=db.get(Employee,data.employee_id)
    if not e: raise HTTPException(404,"Employee not found")
    existing=db.scalar(select(WorkHoursPolicy).where(WorkHoursPolicy.employee_id==data.employee_id,WorkHoursPolicy.year==data.year,WorkHoursPolicy.month==data.month))
    if existing:
        old={"required_hours":existing.required_hours};existing.required_hours=data.required_hours;existing.set_by=u.id
        audit(db,u,"WORK_HOURS_UPDATED","WorkHoursPolicy",existing.id,old=old,new={"required_hours":data.required_hours},request=request);db.commit();return existing
    x=WorkHoursPolicy(employee_id=data.employee_id,year=data.year,month=data.month,required_hours=data.required_hours,set_by=u.id)
    db.add(x);db.flush();audit(db,u,"WORK_HOURS_SET","WorkHoursPolicy",x.id,new={"employee_id":str(data.employee_id),"year":data.year,"month":data.month,"required_hours":data.required_hours},request=request);db.commit();return x
@router.get("/offices")
def offices(db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_OFFICES))):
    return db.scalars(select(Office)).all()

@router.post("/offices")
def create_office(data:OfficeCreate,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_OFFICES))):
    o=Office(**data.model_dump());db.add(o);db.flush();audit(db,u,"OFFICE_CREATED","Office",o.id,new=data.model_dump(),request=request);db.commit();return o
@router.put("/offices/{id}")
def update_office(
    id: uuid.UUID,
    data: OfficeCreate,
    request: Request,
    db: Session = Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_OFFICES))
):
    office = db.get(Office, id)

    if not office:
        raise HTTPException(404, "Office not found")
    office.name = data.name
    office.address = data.address
    office.latitude = data.latitude
    office.longitude = data.longitude
    office.geofence_radius_meters = data.geofence_radius_meters
    office.maximum_gps_accuracy_meters = data.maximum_gps_accuracy_meters
    office.timezone = data.timezone

    audit(
        db,
        u,
        "OFFICE_UPDATED",
        "Office",
        office.id,
        request=request
    )

    db.commit()
    db.refresh(office)

    return office

@router.get("/employee-offices")
def employee_offices(
    db:Session=Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_OFFICES)),
):
    return db.scalars(select(EmployeeOffice)).all()
@router.post("/employees/{id}/offices/{office_id}")
def add_office(id:uuid.UUID,office_id:uuid.UUID,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_EMPLOYEE_OFFICES))):
    if not db.get(Employee,id) or not db.get(Office,office_id): raise HTTPException(404,"Not found")
    db.merge(EmployeeOffice(employee_id=id,office_id=office_id));audit(db,u,"OFFICE_ASSIGNED","Employee",id,new={"office_id":str(office_id)},request=request);db.commit();return {"ok":True}
@router.delete("/employees/{id}/offices/{office_id}")
def remove_office(id:uuid.UUID,office_id:uuid.UUID,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_EMPLOYEE_OFFICES))):
    x=db.scalar(select(EmployeeOffice).where(EmployeeOffice.employee_id==id,EmployeeOffice.office_id==office_id))
    if x: db.delete(x);audit(db,u,"OFFICE_REMOVED","Employee",id,new={"office_id":str(office_id)},request=request);db.commit()
    return {"ok":True}
@router.post("/managers/{manager_id}/offices/{office_id}")
def add_manager_office(
    manager_id:uuid.UUID,
    office_id:uuid.UUID,
    request:Request,
    db:Session=Depends(get_db),
    u=Depends(require_permission(Permission.MANAGE_EMPLOYEE_OFFICES))
):
    manager=db.get(User,manager_id)
    office=db.get(Office,office_id)

    if not manager or manager.role!=UserRole.MANAGER or manager.status!=UserStatus.ACTIVE:
        raise HTTPException(404,"Manager not found")

    if not office:
        raise HTTPException(404,"Office not found")

    profile=db.scalar(
        select(ManagerProfile).where(ManagerProfile.user_id==manager.id)
    )

    if not profile:
        raise HTTPException(404,"Manager profile not found")

    existing=db.scalar(
        select(ManagerOffice).where(
            ManagerOffice.manager_id==profile.id,
            ManagerOffice.office_id==office.id
        )
    )

    if not existing:
        db.add(
            ManagerOffice(
                manager_id=profile.id,
                office_id=office.id
            )
        )

    audit(
        db,
        u,
        "OFFICE_ASSIGNED",
        "Manager",
        manager.id,
        new={"office_id":str(office.id)},
        request=request
    )

    db.commit()

    return {"ok":True}
@router.get("/schedules")
def list_schedules(db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_SCHEDULES))):
    return db.scalars(select(WorkSchedule).order_by(WorkSchedule.name)).all()
@router.post("/schedules")
def create_schedule(data:ScheduleCreate,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_SCHEDULES))):
    if db.scalar(select(WorkSchedule).where(WorkSchedule.name==data.name)): raise HTTPException(409,"Schedule name exists")
    x=WorkSchedule(**data.model_dump(),created_by=u.id)
    db.add(x);db.flush()
    audit(db,u,"SCHEDULE_CREATED","WorkSchedule",x.id,new={**data.model_dump(mode="json")},request=request)
    db.commit();db.refresh(x);return x
@router.post("/employees/{id}/schedule")
def assign_schedule(id:uuid.UUID,data:ScheduleAssign,request:Request,db:Session=Depends(get_db),u=Depends(require_permission(Permission.MANAGE_SCHEDULES))):
    e=db.get(Employee,id);s=db.get(WorkSchedule,data.schedule_id)
    if not e or not s: raise HTTPException(422,"Valid employee and schedule required")
    old=e.schedule_id;e.schedule_id=s.id
    audit(db,u,"SCHEDULE_ASSIGNED","Employee",e.id,old={"schedule_id":str(old) if old else None},new={"schedule_id":str(s.id)},request=request)
    db.commit();db.refresh(e);return e
@router.get("/audit-logs")
def logs(db:Session=Depends(get_db),u=Depends(require_permission(Permission.VIEW_AUDIT_LOGS))): return db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(500)).all()
