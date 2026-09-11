import pytest
from app.models.user import UserRole
from app.core.permissions import ROLE_PERMISSIONS,Permission
def test_only_three_roles():
    assert set(r.value for r in UserRole)=={"SUPER_ADMIN","MANAGER","EMPLOYEE"}
def test_employee_permissions_are_limited():
    assert Permission.MANAGE_ROLES not in ROLE_PERMISSIONS[UserRole.EMPLOYEE]
    assert Permission.PUNCH_ATTENDANCE in ROLE_PERMISSIONS[UserRole.EMPLOYEE]
def test_manager_has_no_admin_permissions():
    assert Permission.MANAGE_SYSTEM_SETTINGS not in ROLE_PERMISSIONS[UserRole.MANAGER]
    assert Permission.VIEW_TEAM_ATTENDANCE in ROLE_PERMISSIONS[UserRole.MANAGER]
