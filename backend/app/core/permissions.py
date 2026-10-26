from enum import Enum
from fastapi import Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.user import User, UserRole

class Permission(str, Enum):
    MANAGE_USERS="MANAGE_USERS"; MANAGE_ROLES="MANAGE_ROLES"; MANAGE_OFFICES="MANAGE_OFFICES"
    MANAGE_EMPLOYEE_OFFICES="MANAGE_EMPLOYEE_OFFICES"; MANAGE_MANAGERS="MANAGE_MANAGERS"
    VIEW_ALL_ATTENDANCE="VIEW_ALL_ATTENDANCE"; VIEW_TEAM_ATTENDANCE="VIEW_TEAM_ATTENDANCE"
    MANAGE_WFH="MANAGE_WFH"; MANAGE_EXCEPTIONS="MANAGE_EXCEPTIONS"
    MANAGE_ATTENDANCE_ADJUSTMENTS="MANAGE_ATTENDANCE_ADJUSTMENTS"; VIEW_AUDIT_LOGS="VIEW_AUDIT_LOGS"
    MANAGE_SYSTEM_SETTINGS="MANAGE_SYSTEM_SETTINGS"; PUNCH_ATTENDANCE="PUNCH_ATTENDANCE"
    REQUEST_WFH="REQUEST_WFH"; VIEW_OWN_ATTENDANCE="VIEW_OWN_ATTENDANCE"; VIEW_OWN_WFH="VIEW_OWN_WFH"
    VIEW_TEAM_EMPLOYEES="VIEW_TEAM_EMPLOYEES"
    MANAGE_WORK_HOURS="MANAGE_WORK_HOURS"; VIEW_OWN_WORK_HOURS="VIEW_OWN_WORK_HOURS"
    MANAGE_SCHEDULES="MANAGE_SCHEDULES"; VIEW_OWN_SCHEDULE="VIEW_OWN_SCHEDULE"
    REQUEST_LEAVE="REQUEST_LEAVE"; VIEW_OWN_LEAVE="VIEW_OWN_LEAVE"; MANAGE_LEAVE="MANAGE_LEAVE"

ROLE_PERMISSIONS = {
    UserRole.SUPER_ADMIN: set(Permission),
    UserRole.MANAGER: {
        Permission.PUNCH_ATTENDANCE,
        Permission.VIEW_OWN_ATTENDANCE,
        Permission.VIEW_OWN_WORK_HOURS,
        Permission.VIEW_TEAM_ATTENDANCE,
        Permission.MANAGE_WFH,
        Permission.MANAGE_EXCEPTIONS,
        Permission.VIEW_TEAM_EMPLOYEES,
        Permission.MANAGE_WORK_HOURS,
        Permission.MANAGE_LEAVE,
        Permission.REQUEST_LEAVE,
        Permission.VIEW_OWN_LEAVE,
    },
    UserRole.EMPLOYEE: {
        Permission.PUNCH_ATTENDANCE,
        Permission.REQUEST_WFH,
        Permission.VIEW_OWN_ATTENDANCE,
        Permission.VIEW_OWN_WFH,
        Permission.VIEW_OWN_WORK_HOURS,
        Permission.VIEW_OWN_SCHEDULE,
        Permission.REQUEST_LEAVE,
        Permission.VIEW_OWN_LEAVE,
    },
}
def require_permission(permission: Permission):
    def dep(user: User = Depends(get_current_user)):
        if permission not in ROLE_PERMISSIONS[user.role]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return user
    return dep
