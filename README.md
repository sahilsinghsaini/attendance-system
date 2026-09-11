# Secure Multi-Office Employee Attendance System

Production-oriented modular monolith implementation of the supplied 51-page specification. The implementation uses FastAPI + SQLAlchemy + PostgreSQL + Alembic and a React/Vite frontend.

## Architecture
Browser → FastAPI → centralized RBAC/resource authorization → business services → PostgreSQL → append-only audit trail.

The only roles are `SUPER_ADMIN`, `MANAGER`, and `EMPLOYEE`.

## Repository
- `backend/app/api`: API surface
- `backend/app/core`: configuration, authentication and permissions
- `backend/app/models`: PostgreSQL domain model
- `backend/app/services`: attendance and geofence business rules
- `backend/app/jobs`: reconciliation hooks
- `backend/alembic`: migration
- `backend/tests`: security/geofence tests
- `frontend/src`: React UI
- `docs`: architecture, ERD, API and verification

## Run
1. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a strong secret.
2. `docker compose up --build`
3. Run migration from the backend container: `docker compose exec backend alembic upgrade head`
4. Bootstrap the first Super Admin manually:
   `docker compose exec backend python -m app.cli.create_super_admin`
5. Open `http://localhost:5173`.

The bootstrap command refuses to run when the database contains any user. Bootstrap secrets are never exposed by an API.

## Security notes
- Argon2id password hashing.
- Short-lived access tokens plus refresh tokens.
- Server-side timestamps in UTC.
- CORS allowlist; no wildcard credentialed CORS.
- Backend is the authorization source of truth.
- Office geofence distance is calculated server-side with Haversine.
- Manager data access is scoped to `primary_manager_id`.
- Attendance has a unique `(employee_id, work_date)` constraint and row locking.
- Audit records have no delete API.
- Idempotency header is accepted at the CORS boundary; a production deployment should add a persistent idempotency-key table before claiming full idempotency guarantees.

## Important implementation status
The supplied document asks for incremental implementation and a security review. This repository implements the core Phase 1–8 domain and a responsive employee UI, with migration, tests, docs and explicit limitations. Some breadth items from the document remain marked as gaps rather than being falsely represented as complete (notably full admin/manager frontend screens, email delivery/retry worker, verification-token flow, full adjustment APIs, scheduled job runner, and persistent idempotency storage).

## Production limitations
GPS validation cannot prove physical presence against a compromised/spoofed device. Browser location can be manipulated. JWT/session theft, device compromise, email compromise, malicious administrators and privacy risks require operational controls. HTTPS, secret management, backups, monitoring and SMTP infrastructure must be configured in deployment.

## Tests
From `backend`: `pytest -q`.
