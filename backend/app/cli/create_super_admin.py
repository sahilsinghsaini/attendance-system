import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models import Employee
from app.models.user import User, UserRole, UserStatus
from app.core.security import hash_password



BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)


# ============================================================
# Environment Variables
# ============================================================

INITIAL_SUPER_ADMIN_NAME = os.getenv("INITIAL_SUPER_ADMIN_NAME")
INITIAL_SUPER_ADMIN_EMAIL = os.getenv("INITIAL_SUPER_ADMIN_EMAIL")
INITIAL_SUPER_ADMIN_PASSWORD = os.getenv("INITIAL_SUPER_ADMIN_PASSWORD")


# ============================================================
# Validation
# ============================================================

def validate_environment():
    """Validate required Super Admin environment variables."""

    required_variables = {
        "INITIAL_SUPER_ADMIN_NAME": INITIAL_SUPER_ADMIN_NAME,
        "INITIAL_SUPER_ADMIN_EMAIL": INITIAL_SUPER_ADMIN_EMAIL,
        "INITIAL_SUPER_ADMIN_PASSWORD": INITIAL_SUPER_ADMIN_PASSWORD,
    }

    missing_variables = [
        name
        for name, value in required_variables.items()
        if not value
    ]

    if missing_variables:
        raise SystemExit(
            "Missing required environment variables: "
            + ", ".join(missing_variables)
        )


# ============================================================
# Bootstrap Super Admin
# ============================================================

def main():
    """Create the initial Super Admin account."""

    validate_environment()

    db = SessionLocal()

    try:
        # ----------------------------------------------------
        # Prevent duplicate bootstrap
        # ----------------------------------------------------

        user_count = db.scalar(
            select(func.count()).select_from(User)
        )

        if user_count != 0:
            raise SystemExit(
                "Super Admin already exists. "
                "Bootstrap operation denied."
            )

        # ----------------------------------------------------
        # Create Super Admin
        # ----------------------------------------------------

        super_admin = User(
            email=INITIAL_SUPER_ADMIN_EMAIL,
            password_hash=hash_password(
                INITIAL_SUPER_ADMIN_PASSWORD
            ),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            email_verified=True,
        )

        db.add(super_admin)

        # Flush so SQLAlchemy sends the INSERT before commit.
        db.flush()

        # ----------------------------------------------------
        # Super Admin does NOT get an Employee record
        # ----------------------------------------------------

        # No Employee record is created here.

        # ----------------------------------------------------
        # Commit transaction
        # ----------------------------------------------------

        db.commit()

        print(
            f"Bootstrap Super Admin created successfully: "
            f"{INITIAL_SUPER_ADMIN_EMAIL}"
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    main()