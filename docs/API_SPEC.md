# API Specification

## Authentication
- POST `/api/v1/auth/register` — employee-only public registration.
- POST `/api/v1/auth/login` — returns short-lived access and refresh tokens.
- POST `/api/v1/auth/refresh` — refresh access.
- Planned contract from source: verify-email/logout/me should be added before production sign-off.

## Employee
- GET `/api/v1/offices/my-offices`
- POST `/api/v1/attendance/punch-in`
- POST `/api/v1/attendance/break/start`
- POST `/api/v1/attendance/break/end`
- POST `/api/v1/attendance/punch-out`
- GET `/api/v1/attendance/today`
- GET `/api/v1/attendance/history`
- POST `/api/v1/wfh/requests`
- GET `/api/v1/wfh/requests`
- DELETE `/api/v1/wfh/requests/{id}`

## Manager
- GET `/api/v1/manager/dashboard`
- GET `/api/v1/manager/employees`
- GET `/api/v1/manager/wfh`
- POST `/api/v1/manager/wfh/{id}/approve|reject`
- GET `/api/v1/manager/registrations`
- POST `/api/v1/manager/registrations/{id}/approve|reject`

## Super Admin
Implemented core endpoints include dashboard, users, manager/employee creation, manager assignment, office CRUD/listing, office assignment/removal, and audit log reads. The source specification additionally calls for role changes, activation/deactivation, attendance/WFH/exception reporting, attendance adjustment and settings endpoints; these are explicitly tracked as remaining gaps rather than hidden.

## Authorization
Frontend routing is UX only. Every protected operation uses backend permission dependencies and, for manager operations, checks the specific employee's manager relationship.
