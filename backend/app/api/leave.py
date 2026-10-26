import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user
from app.core.permissions import require_permission, Permission
from app.models.user import User, UserRole, UserStatus
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.manager import ManagerProfile
from app.schemas.common import AdminLeaveCreate, LeaveCreate, ReviewIn
from app.services.audit_service import audit

router = APIRouter(prefix="/api/v1/leave", tags=["leave"])


@router.post("/requests")
def create_leave_request(
    data: LeaveCreate,
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.REQUEST_LEAVE)),
):
    if not u.employee and u.role != UserRole.MANAGER:
        raise HTTPException(403, "Employee record not found")

    if data.end_date < data.start_date:
        raise HTTPException(422, "End date cannot be earlier than start date")

    # Check for overlapping pending or approved leave requests
    subject_filter = (
        LeaveRequest.employee_id == u.employee.id
        if u.employee
        else LeaveRequest.target_user_id == u.id
    )
    existing = db.scalars(
        select(LeaveRequest).where(
            subject_filter,
            LeaveRequest.status.in_(["PENDING", "APPROVED"]),
            LeaveRequest.start_date <= data.end_date,
            LeaveRequest.end_date >= data.start_date,
        )
    ).first()

    if existing:
        raise HTTPException(
            409,
            f"You already have a {existing.status.lower()} leave request overlapping these dates ({existing.start_date} to {existing.end_date})",
        )

    r = LeaveRequest(
        employee_id=u.employee.id if u.employee else None,
        target_user_id=None if u.employee else u.id,
        start_date=data.start_date,
        end_date=data.end_date,
        leave_type=data.leave_type.upper(),
        reason=data.reason,
        status="PENDING",
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    # Days count
    days = (r.end_date - r.start_date).days + 1

    return {
        "id": str(r.id),
        "employee_id": str(r.employee_id) if r.employee_id else None,
        "user_id": str(u.id),
        "start_date": r.start_date.isoformat(),
        "end_date": r.end_date.isoformat(),
        "leave_type": r.leave_type,
        "reason": r.reason,
        "status": r.status,
        "days": days,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/requests")
def my_leave_requests(
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.VIEW_OWN_LEAVE)),
):
    subject_filter = (
        LeaveRequest.employee_id == u.employee.id
        if u.employee
        else LeaveRequest.target_user_id == u.id
    )
    requests = db.scalars(
        select(LeaveRequest)
        .where(subject_filter)
        .order_by(LeaveRequest.created_at.desc())
    ).all()

    out = []
    for r in requests:
        days = (r.end_date - r.start_date).days + 1
        out.append({
            "id": str(r.id),
            "employee_id": str(r.employee_id) if r.employee_id else None,
            "user_id": str(u.id) if not r.employee_id else None,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "leave_type": r.leave_type,
            "reason": r.reason,
            "status": r.status,
            "days": days,
            "manager_comment": r.manager_comment,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return out


@router.delete("/requests/{id}")
def cancel_leave_request(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.VIEW_OWN_LEAVE)),
):
    r = db.get(LeaveRequest, id)
    owns_request = bool(
        r and (
            (u.employee and r.employee_id == u.employee.id)
            or (not u.employee and r.target_user_id == u.id)
        )
    )
    if not owns_request:
        raise HTTPException(404, "Leave request not found")

    if r.status != "PENDING":
        raise HTTPException(409, "Only pending leave requests can be cancelled")

    r.status = "CANCELLED"
    r.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Leave request cancelled", "id": str(r.id), "status": r.status}


@router.get("/balance")
def leave_balance(
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.VIEW_OWN_LEAVE)),
):
    """Returns the employee's current annual paid leave balance (12 days total)."""
    TOTAL_PAID_DAYS = 12

    subject_filter = (
        LeaveRequest.employee_id == u.employee.id
        if u.employee
        else LeaveRequest.target_user_id == u.id
    )
    approved = db.scalars(select(LeaveRequest).where(
        subject_filter,
        LeaveRequest.status == "APPROVED",
    )).all()

    # Fetch pending count
    pending_count = len(
        db.scalars(select(LeaveRequest).where(
            subject_filter,
            LeaveRequest.status == "PENDING",
        )).all()
    )

    paid_used = 0
    for r in approved:
        days = (r.end_date - r.start_date).days + 1
        t = (r.leave_type or "").upper()
        if t not in {"UNPAID", "OPTIONAL", "FESTIVAL"}:
            paid_used += days

    return {
        "paid": {
            "total": TOTAL_PAID_DAYS,
            "used": paid_used,
            "available": max(0, TOTAL_PAID_DAYS - paid_used),
        },
        "pending_count": pending_count,
    }



# ========================================================
# Manager Endpoints for Team Leave Review
# ========================================================

@router.get("/team")
def team_leave_requests(
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.MANAGE_LEAVE)),
):
    """Retrieve all leave requests for team members under this manager."""
    query = select(LeaveRequest).order_by(LeaveRequest.created_at.desc())
    if u.role != UserRole.SUPER_ADMIN:
        query = query.join(Employee, Employee.id == LeaveRequest.employee_id).where(
            Employee.primary_manager_id == u.id
        )

    rows = db.scalars(query).all()
    out = []
    for r in rows:
        emp = db.get(Employee, r.employee_id) if r.employee_id else None
        target_user = db.get(User, emp.user_id) if emp else (
            db.get(User, r.target_user_id) if r.target_user_id else None
        )
        profile = db.scalar(select(ManagerProfile).where(
            ManagerProfile.user_id == target_user.id
        )) if target_user and target_user.role == UserRole.MANAGER else None
        days = (r.end_date - r.start_date).days + 1
        out.append({
            "id": str(r.id),
            "employee_id": str(emp.id) if emp else None,
            "user_id": str(target_user.id) if target_user else None,
            "employee_name": emp.full_name if emp else (profile.full_name if profile else (target_user.email if target_user else "Staff member")),
            "employee_code": emp.employee_code if emp else None,
            "department": emp.department if emp else None,
            "target_role": target_user.role.value if target_user else "EMPLOYEE",
            "email": target_user.email if target_user else None,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "leave_type": r.leave_type,
            "reason": r.reason,
            "status": r.status,
            "days": days,
            "manager_comment": r.manager_comment,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return out


@router.get("/eligible-users")
def eligible_leave_users(
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.MANAGE_LEAVE)),
):
    """List all active employees and managers for Super Admin leave entry."""
    if u.role != UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Only Super Admin can add leave for other staff")

    users = db.scalars(select(User).where(
        User.role.in_([UserRole.EMPLOYEE, UserRole.MANAGER]),
        User.status == UserStatus.ACTIVE,
    ).order_by(User.email)).all()
    eligible = []
    for target in users:
        employee = db.scalar(select(Employee).where(Employee.user_id == target.id))
        profile = db.scalar(select(ManagerProfile).where(ManagerProfile.user_id == target.id))
        eligible.append({
            "user_id": str(target.id),
            "employee_id": str(employee.id) if employee else None,
            "full_name": employee.full_name if employee else (profile.full_name if profile else target.email),
            "email": target.email,
            "role": target.role.value,
        })
    return eligible


@router.post("/admin/requests")
def create_staff_leave(
    data: AdminLeaveCreate,
    request: Request,
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.MANAGE_LEAVE)),
):
    """Record approved leave for any active employee or manager."""
    if u.role != UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Only Super Admin can add leave for other staff")
    if data.end_date < data.start_date:
        raise HTTPException(422, "End date cannot be earlier than start date")

    target = db.get(User, data.target_user_id)
    if not target or target.role not in (UserRole.EMPLOYEE, UserRole.MANAGER):
        raise HTTPException(404, "Active employee or manager not found")
    if target.status != UserStatus.ACTIVE:
        raise HTTPException(409, "Leave can only be added for active staff")

    employee = db.scalar(select(Employee).where(Employee.user_id == target.id))
    if target.role == UserRole.EMPLOYEE and not employee:
        raise HTTPException(404, "Employee profile not found")

    subject_filter = (
        LeaveRequest.employee_id == employee.id
        if employee
        else LeaveRequest.target_user_id == target.id
    )
    overlap = db.scalars(select(LeaveRequest).where(
        subject_filter,
        LeaveRequest.status.in_(["PENDING", "APPROVED"]),
        LeaveRequest.start_date <= data.end_date,
        LeaveRequest.end_date >= data.start_date,
    )).first()
    if overlap:
        raise HTTPException(409, f"Existing {overlap.status.lower()} leave overlaps these dates")

    leave = LeaveRequest(
        employee_id=employee.id if employee else None,
        target_user_id=None if employee else target.id,
        start_date=data.start_date,
        end_date=data.end_date,
        leave_type=data.leave_type.upper(),
        reason=data.reason,
        status="APPROVED",
        reviewed_by=u.id,
        manager_comment="Recorded by Super Admin",
    )
    db.add(leave)
    audit(
        db,
        u,
        "LEAVE_RECORDED_BY_ADMIN",
        "LeaveRequest",
        leave.id,
        new={
            "target_user_id": str(target.id),
            "target_role": target.role.value,
            "start_date": data.start_date.isoformat(),
            "end_date": data.end_date.isoformat(),
            "leave_type": data.leave_type.upper(),
            "status": "APPROVED",
        },
        request=request,
    )
    db.commit()
    db.refresh(leave)

    profile = db.scalar(select(ManagerProfile).where(ManagerProfile.user_id == target.id)) if target.role == UserRole.MANAGER else None
    return {
        "id": str(leave.id),
        "employee_id": str(employee.id) if employee else None,
        "user_id": str(target.id),
        "employee_name": employee.full_name if employee else (profile.full_name if profile else target.email),
        "target_role": target.role.value,
        "email": target.email,
        "start_date": leave.start_date.isoformat(),
        "end_date": leave.end_date.isoformat(),
        "leave_type": leave.leave_type,
        "reason": leave.reason,
        "status": leave.status,
        "days": (leave.end_date - leave.start_date).days + 1,
        "manager_comment": leave.manager_comment,
        "reviewed_by": str(leave.reviewed_by),
    }


@router.post("/requests/{id}/{decision}")
def review_leave_request(
    id: uuid.UUID,
    decision: str,
    data: ReviewIn | None = None,
    db: Session = Depends(get_db),
    u: User = Depends(require_permission(Permission.MANAGE_LEAVE)),
):
    """Approve or reject an employee's leave request."""
    if decision not in ("approve", "reject"):
        raise HTTPException(422, "Decision must be 'approve' or 'reject'")

    r = db.get(LeaveRequest, id)
    if not r:
        raise HTTPException(404, "Leave request not found")

    emp = db.get(Employee, r.employee_id)
    if u.role != UserRole.SUPER_ADMIN:
        if not emp or emp.primary_manager_id != u.id:
            raise HTTPException(403, "Outside management scope")

    r.status = "APPROVED" if decision == "approve" else "REJECTED"
    r.manager_comment = data.comment if data else None
    r.reviewed_by = u.id
    r.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(r)

    days = (r.end_date - r.start_date).days + 1

    return {
        "id": str(r.id),
        "employee_id": str(r.employee_id),
        "employee_name": emp.full_name if emp else "Employee",
        "start_date": r.start_date.isoformat(),
        "end_date": r.end_date.isoformat(),
        "leave_type": r.leave_type,
        "reason": r.reason,
        "status": r.status,
        "days": days,
        "manager_comment": r.manager_comment,
        "reviewed_by": str(r.reviewed_by) if r.reviewed_by else None,
    }
