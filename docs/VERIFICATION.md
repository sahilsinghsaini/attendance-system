# Re-verification / Traceability

## Checks performed on the implementation
- Role enum contains exactly SUPER_ADMIN, MANAGER, EMPLOYEE.
- Public registration hardcodes EMPLOYEE and PENDING_APPROVAL; role/status/manager/office/permission fields are not accepted.
- Bootstrap checks the total user count and refuses repeat initialization.
- Passwords are Argon2id hashes.
- Access tokens are short-lived; refresh tokens are separate.
- Office attendance requires office assignment, active office, GPS and server-side geofence/accuracy validation.
- WFH attendance requires an approved request covering the server's current date.
- Server timestamps are used for attendance events; client timestamps are not accepted.
- Attendance sessions have a unique employee/work-date constraint and row locking before creation.
- Only one open break is permitted by the state transition.
- Break durations are calculated from server timestamps.
- Over-break and optional under-break exceptions are created on punch-out.
- Manager WFH/registration reads and writes are scoped by primary_manager_id.
- Audit logs are append-only at the application API level and no delete route exists.
- No fourth role is present in code, migration, docs or UI.

## Automated tests
`backend/tests/test_security.py` verifies the three-role model and permission boundaries.
`backend/tests/test_geofence.py` verifies server-side distance calculation.

## Source acceptance criteria not yet fully implemented
1. Email verification token lifecycle and logout/token revocation.
2. Persistent idempotency-key storage/atomic replay handling.
3. Full Super Admin role-change/activate/deactivate workflows including last-active-Super-Admin invariant.
4. Full admin attendance/WFH/exception/settings/adjustment APIs.
5. Email NotificationService, templates, retry queue/status and manager alerts.
6. Scheduled reconciliation runner with all listed checks.
7. Full Manager and Super Admin frontend dashboards/tables/forms.
8. React Bits Flying Posters integration; current UI intentionally avoids unnecessary animation and honors reduced motion.
9. Full CSRF strategy if cookie-based credentials are introduced.
10. Full security test suite for IDOR, privilege escalation, CORS, XSS, concurrency and rate-limit behavior.

These are documented gaps because the supplied specification explicitly says not to claim security merely because tests pass.
