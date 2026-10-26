from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    print("Starting production cleanup...")

    old_users = """
        SELECT id FROM users
        WHERE email != 'info@tobatax.com'
    """

    old_employees = """
        SELECT id FROM employees
        WHERE user_id IN (
            SELECT id FROM users
            WHERE email != 'info@tobatax.com'
        )
    """

    old_sessions = """
        SELECT id FROM attendance_sessions
        WHERE employee_id IN (
            SELECT id FROM employees
            WHERE user_id IN (
                SELECT id FROM users
                WHERE email != 'info@tobatax.com'
            )
        )
    """

    # Attendance children
    db.execute(text(f"""
        DELETE FROM attendance_breaks
        WHERE attendance_session_id IN ({old_sessions});
    """))

    db.execute(text(f"""
        DELETE FROM attendance_events
        WHERE attendance_session_id IN ({old_sessions});
    """))

    db.execute(text(f"""
        DELETE FROM attendance_exceptions
        WHERE attendance_session_id IN ({old_sessions});
    """))

    # Attendance sessions
    db.execute(text(f"""
        DELETE FROM attendance_sessions
        WHERE id IN ({old_sessions});
    """))

    # Employee related tables
    db.execute(text(f"""
        DELETE FROM employee_offices
        WHERE employee_id IN ({old_employees});
    """))

    db.execute(text(f"""
        DELETE FROM work_hours_policies
        WHERE employee_id IN ({old_employees});
    """))

    db.execute(text(f"""
        DELETE FROM wfh_requests
        WHERE employee_id IN ({old_employees});
    """))

    # Employee profiles
    db.execute(text(f"""
        DELETE FROM employees
        WHERE id IN ({old_employees});
    """))

    # User related records
    db.execute(text(f"""
        DELETE FROM audit_logs
        WHERE actor_user_id IN ({old_users});
    """))

    db.execute(text(f"""
        DELETE FROM work_schedules
        WHERE created_by IN ({old_users});
    """))

    # Finally remove old users
    db.execute(text("""
        DELETE FROM users
        WHERE email != 'info@tobatax.com';
    """))

    db.commit()

    print("================================")
    print("✅ CLEANUP COMPLETE")
    print("Remaining production admin:")
    print("info@tobatax.com")
    print("================================")

except Exception as e:
    db.rollback()
    print("❌ ERROR:", e)

finally:
    db.close()