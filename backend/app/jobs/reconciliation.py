from sqlalchemy import select
from app.models.attendance import AttendanceSession,AttendanceState,AttendanceException
from app.models.employee import Employee
from app.models.wfh import WFHRequest
def reconcile(db):
    created=0
    for s in db.scalars(select(AttendanceSession).where(AttendanceSession.state==AttendanceState.ON_BREAK,AttendanceSession.punch_out_at.is_not(None))).all():
        db.add(AttendanceException(attendance_session_id=s.id,exception_type="UNFINISHED_BREAK",status="OPEN"));created+=1
    for e in db.scalars(select(Employee).where(Employee.primary_manager_id.is_(None))).all():
        # No attendance time is invented; organizational exception can be emitted by a separate job.
        pass
    db.commit();return created
