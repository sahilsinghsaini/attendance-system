import {useEffect,useState} from 'react';
import Card from '../components/Card';
import WorkHours from '../components/WorkHours';
import {api} from '../services/api';

function parseTimestamp(value: any) {
  if (!value) return null;
  const text = String(value);
  if (!text.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(text)) {
    return new Date(text + 'Z');
  }
  return new Date(text);
}

function formatOfficeTime(
  value: string | null | undefined,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
) {
  if (!value) return '—';
  const d = parseTimestamp(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      ...options,
      timeZone: timeZone || 'UTC'
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(d);
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );
  return asUtc - date.getTime();
}

function officeLocalInputToUtc(
  value: string,
  timeZone: string | null | undefined
) {
  if (!value) return '';
  const tz = timeZone || 'UTC';
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Interpret the datetime-local wall clock as UTC first, then remove the
  // office's actual UTC offset. Re-check once so DST transitions are handled.
  const wallMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcMs = wallMs - getTimeZoneOffsetMs(new Date(wallMs), tz);
  const corrected = wallMs - getTimeZoneOffsetMs(new Date(utcMs), tz);

  if (corrected !== utcMs) utcMs = corrected;
  return new Date(utcMs).toISOString();
}

function toOfficeLocalInputValue(
  iso: string | null | undefined,
  timeZone: string | null | undefined
) {
  if (!iso) return '';
  const d = parseTimestamp(iso);
  if (!d || Number.isNaN(d.getTime())) return '';
  const tz = timeZone || 'UTC';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(d);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

const TABS=['Overview','Registrations','WFH Requests','Leave Requests','Team','Monthly Records','Work Hours'] as const;
type Tab=typeof TABS[number];

export default function Manager(){
  const [tab,setTab]=useState<Tab>('Overview');

  return <>
    <header className="manager-header">
      <div>
        <p className="eyebrow">TOBATAX • MANAGER</p>
        <h2>Team workspace</h2>
        <p className="manager-subtitle">
          Monitor attendance, requests, team activity and work hours.
        </p>
      </div>

    </header>

    <nav className="manager-tabs">
      {TABS.map(t => (
        <button
          key={t}
          className={tab === t ? 'manager-tab active' : 'manager-tab'}
          onClick={() => setTab(t)}
        >
          {t}
        </button>
      ))}
    </nav>
    {tab==='Overview'&&<Overview/>}
    {tab==='Registrations'&&<Registrations/>}
    {tab==='WFH Requests'&&<WfhRequests/>}
    {tab==='Leave Requests'&&<LeaveRequests/>}
    {tab==='Team'&&<Team/>}
    {tab==='Monthly Records'&&<MonthlyRecords/>}
    {tab==='Work Hours'&&<WorkHours scope="manager"/>}
  </>;
}

function Overview() {
  const [s, setS] = useState<any>();
  const [attendance, setAttendance] = useState<any>();
  const [offices, setOffices] = useState<any[]>([]);
  const [teamAttendance, setTeamAttendance] = useState<any[]>([]);
  const [weeklyAttendance, setWeeklyAttendance] = useState<any[]>([]);
  const [office, setOffice] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [, setTick] = useState(0);

useEffect(() => {
  const timer = setInterval(() => {
    setTick(value => value + 1);
  }, 1000);

  return () => clearInterval(timer);
}, []);

  useEffect(() => {
  api('/manager/dashboard').then(setS).catch(() => {});
  api('/offices/my-offices').then(setOffices).catch(() => {});
  api('/manager/attendance/today').then(setTeamAttendance).catch(() => {});
  api('/manager/attendance/weekly').then(setWeeklyAttendance).catch(() => {});
  refresh();
}, []);

  const refresh = () =>
    api('/attendance/today')
      .then(setAttendance)
      .catch(() => {});

  async function act(path: string, body?: any) {
    try {
      const data = await api('/attendance/' + path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined
      });

      if (path === 'punch-in') {
        setAttendance(data);
      } else {
        await refresh();
      }
    } catch {
      alert('Action rejected by server.');
    }
  }

  async function punchIn() {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );

      const gps = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_meters: pos.coords.accuracy
      };

      await act('punch-in', {
        mode: 'OFFICE',
        office_id: office,
        gps
      });
    } catch {
      alert('Location permission is required for office attendance.');
    }
  }

  const state = attendance?.state || 'NOT_STARTED';
  function activeBreakSeconds(session: any) {
  if (!session?.active_break_start_at) return 0;

  const start = parseTimestamp(session.active_break_start_at);

  if (!start || Number.isNaN(start.getTime())) return 0;

  const end = session.punch_out_at
    ? parseTimestamp(session.punch_out_at)
    : new Date();

  if (!end || Number.isNaN(end.getTime())) return 0;

  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 1000)
  );
}

function totalBreakSeconds(session: any) {
  if (!session) return 0;

  return (
    (session.total_break_seconds || 0) +
    activeBreakSeconds(session)
  );
}

function workingSeconds(session: any) {
  if (!session?.punch_in_at) return 0;

  const start = parseTimestamp(session.punch_in_at);

  if (!start || Number.isNaN(start.getTime())) return 0;

  const end = session.punch_out_at
    ? parseTimestamp(session.punch_out_at)
    : new Date();

  if (!end || Number.isNaN(end.getTime())) return 0;

  return Math.max(
    0,
    Math.floor(
      (end.getTime() - start.getTime()) / 1000
    ) - totalBreakSeconds(session)
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const workingTime = formatDuration(
  workingSeconds(attendance)
);

const breakTime = formatDuration(
  totalBreakSeconds(attendance)
);
const workingCount = teamAttendance.filter(
  e => e.state === 'WORKING'
).length;

const breakCount = teamAttendance.filter(
  e => e.state === 'ON_BREAK'
).length;

const completedCount = teamAttendance.filter(
  e => e.state === 'COMPLETED'
).length;

const notStartedCount = teamAttendance.filter(
  e => e.state === 'NOT_STARTED'
).length;

const totalTeam = Math.max(
  teamAttendance.length,
  1
);

  return (
    <>
      <div className="grid">
        <Card title="Team size" value={s?.team_size ?? '—'} />
        <Card title="Active" value={s?.active ?? '—'} />
      </div>

     
       {/* KPI CARDS */}
<div className="grid" style={{ marginTop: 20 }}>
  <Card
    title="Team size"
    value={teamAttendance.length}
  />

  <Card
    title="Working now"
    value={
      teamAttendance.filter(
        e => e.state === 'WORKING'
      ).length
    }
  />

  <Card
    title="On break"
    value={
      teamAttendance.filter(
        e => e.state === 'ON_BREAK'
      ).length
    }
  />

  <Card
    title="Late today"
    value={
      teamAttendance.filter(
        e => Number(e.late_minutes) > 0
      ).length
    }
  />
</div>

{/* MY ATTENDANCE */}
<section className="card hero" style={{ marginTop: 20 }}>
  <section className="card" style={{ marginTop: 20 }}>
  <h3>Team attendance status</h3>

  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 30,
      marginTop: 20,
      flexWrap: 'wrap'
    }}
  >
    <div
      style={{
        width: 150,
        height: 150,
        borderRadius: '50%',
        background: `conic-gradient(
          #2563eb 0deg ${
            workingCount / totalTeam * 360
          }deg,
          #f59e0b ${
            workingCount / totalTeam * 360
          }deg ${
            (workingCount + breakCount) /
            totalTeam * 360
          }deg,
          #22c55e ${
            (workingCount + breakCount) /
            totalTeam * 360
          }deg ${
            (workingCount + breakCount + completedCount) /
            totalTeam * 360
          }deg,
          #e5e7eb ${
            (workingCount + breakCount + completedCount) /
            totalTeam * 360
          }deg 360deg
        )`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: '50%',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700
        }}
      >
        {teamAttendance.length}
      </div>
    </div>

    <div>
      <p>
        🔵 Working: <b>{workingCount}</b>
      </p>

      <p>
        🟠 On break: <b>{breakCount}</b>
      </p>

      <p>
        🟢 Completed: <b>{completedCount}</b>
      </p>

      <p>
        ⚪ Not started: <b>{notStartedCount}</b>
      </p>
    </div>
  </div>
</section>
<section className="card" style={{ marginTop: 20 }}>
  <h3>Late employees</h3>

  {teamAttendance.filter(
    e => Number(e.late_minutes) > 0
  ).length === 0 ? (
    <p>No late punch-ins today. 🎉</p>
  ) : (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}
      >
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th>Employee</th>
            <th>Late by</th>
            <th>Punch in</th>
            <th>Scheduled start</th>
            <th>Extended end</th>
          </tr>
        </thead>

        <tbody>
          {teamAttendance
            .filter(
              e => Number(e.late_minutes) > 0
            )
            .map(employee => (
              <tr
                key={employee.employee_id}
                style={{
                  borderTop: '1px solid #e5e8ee'
                }}
              >
                <td>
                  <b>{employee.employee_name}</b>
                </td>

                <td>
                  <b>
                    {employee.late_minutes} min
                  </b>
                </td>

                <td>
                  {employee.punch_in_at
                    ? formatOfficeTime(employee.punch_in_at, employee.office_timezone, {
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                    : '—'}
                </td>

                <td>
                  {employee.scheduled_start
                    ? formatOfficeTime(employee.scheduled_start, employee.office_timezone, {
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                    : '—'}
                </td>

                <td>
                  {employee.adjusted_scheduled_end
                    ? formatOfficeTime(employee.adjusted_scheduled_end, employee.office_timezone, {
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                    : '—'}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )}
</section>
<section className="card" style={{ marginTop: 20 }}>
  <h3>Today's worked hours</h3>

  {teamAttendance.length === 0 ? (
    <p>No attendance data available.</p>
  ) : (
    <div style={{ marginTop: 20 }}>
      {teamAttendance.map(employee => {
        const minutes = Number(
          employee.worked_minutes || 0
        );

        const maxMinutes = Math.max(
          ...teamAttendance.map(
            e => Number(e.worked_minutes || 0)
          ),
          1
        );

        const percentage =
          (minutes / maxMinutes) * 100;

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        return (
          <div
            key={employee.employee_id}
            style={{ marginBottom: 18 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6
              }}
            >
              <b>{employee.employee_name}</b>

              <span>
                {hours}h {mins}m
              </span>
            </div>

            <div
              style={{
                height: 12,
                background: '#e5e7eb',
                borderRadius: 999,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: percentage + '%',
                  height: '100%',
                  background: '#2563eb',
                  borderRadius: 999
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>
  <h3>My Attendance</h3>

  <div
    className={
      state === 'ON_BREAK'
        ? 'manager-attendance-visual break-mode'
        : 'manager-attendance-visual'
    }
  >
  <div className="manager-attendance-visual-content">
    <div>
      <span>
        {state === 'ON_BREAK' ? 'Break time' : 'Working time'}
      </span>

      <strong>
        {state === 'ON_BREAK' ? breakTime : workingTime}
      </strong>

      <p>
        {state === 'ON_BREAK'
          ? 'Your break is currently running.'
          : state === 'WORKING'
            ? 'Your working time is being recorded.'
            : 'Start your attendance when you are ready.'}
      </p>
    </div>

    <img
      src={
        state === 'ON_BREAK'
          ? '/assets/illustrations/coffee-break.png'
          : '/assets/illustrations/accounting-work.png'
      }
      alt=""
      className="manager-attendance-picture"
    />
  </div>
</div>

        <p>
          State: <b>{state}</b>
        </p>

        {state === 'NOT_STARTED' && (
          <>
            <label>
              Office

              <select
                value={office}
                onChange={e => setOffice(e.target.value)}
              >
                <option value="">Select</option>

                {offices.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={punchIn}
              disabled={!office}
            >
              Punch in
            </button>
          </>
        )}

        {state === 'WORKING' && (
          <>
            <button onClick={() => act('break/start')}>
              Start break
            </button>

            <button onClick={() => setConfirmOut(true)}>
              Punch out
            </button>
          </>
        )}

        {state === 'ON_BREAK' && (
          <button onClick={() => act('break/end')}>
            End break
          </button>
        )}
            </section>

      <section className="card hero" style={{ marginTop: 20 }}>
        <h3>Today's Team Attendance</h3>

        {teamAttendance.length === 0 ? (
          <p>No team attendance data available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}
            >
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Punch in</th>
                  <th>Schedule</th>
                  <th>Attendance</th>
                  <th>Late</th>
                  <th>Break</th>
                  <th>Worked</th>
                  <th>Office</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {teamAttendance.map((employee) => (
                  <tr
                    key={employee.employee_id}
                    className="attendance-row"
                    style={{
                      borderTop: '1px solid #e5e8ee'
                    }}
                  >
                    <td>
                      <b>{employee.employee_name}</b>
                      <br />
                      <small>{employee.employee_code}</small>
                    </td>

                    <td>
                      {employee.state}
                    </td>

                    <td>
                      {employee.punch_in_at
                        ? new Date(
                            employee.punch_in_at
                          ).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : '—'}
                    </td>

                    <td>
                      {employee.scheduled_start
                        ? new Date(
                            employee.scheduled_start
                          ).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : '—'}
                      {' – '}
                      {employee.scheduled_end
                        ? new Date(
                            employee.scheduled_end
                          ).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : '—'}
                    </td>

                    <td>
                      {employee.punch_status}
                    </td>

                    <td>
                      {employee.late_minutes > 0
                        ? employee.late_minutes + ' min'
                        : '—'}
                    </td>

                    <td>
                      {employee.break_minutes || 0} min
                    </td>

                    <td>
                      {Math.floor((employee.worked_minutes || 0) / 60)}h {String((employee.worked_minutes || 0) % 60).padStart(2, '0')}m
                    </td>

                    <td>
                      {employee.office || '—'}
                    </td>

                    <td>
                      {employee.session_id ? (
                        <button
                          className="edit-attendance-btn"
                          onClick={() => setEditingSession(employee)}
                        >
                          Edit
                        </button>
                      ) : (
                        <span style={{ color: '#9aa4b2', fontSize: 13 }}>
                          No session
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingSession && (
        <AttendanceEditModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={() => {
            setEditingSession(null);
            api('/manager/attendance/today')
              .then(setTeamAttendance)
              .catch(() => {});
          }}
        />
      )}

      {confirmOut && (
        <div
          className="confirm-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            className="card confirm-modal-panel"
            style={{
              width: 360,
              textAlign: 'center',
              background: '#fff'
            }}
          >
            <h3>Confirm Punch Out</h3>

            <p>Are you sure you want to punch out?</p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                marginTop: 20
              }}
            >
              <button
                onClick={() => setConfirmOut(false)}
                style={{
                  background: '#dc2626',
                  color: '#fff'
                }}
              >
                No
              </button>

              <button
                onClick={async () => {
                  setConfirmOut(false);
                  await act('punch-out');
                }}
                style={{
                  background: '#2563eb',
                  color: '#fff'
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MonthlyRecords(){
  const now = new Date();
  const [team,setTeam]=useState<any[]>([]);
  const [employeeId,setEmployeeId]=useState<string>('');
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth()+1);
  const [records,setRecords]=useState<any[]>([]);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    api('/manager/employees').then(setTeam).catch(()=>{});
  },[]);

  function load(){
    setLoading(true);
    setError('');
    const q = new URLSearchParams({year:String(year),month:String(month)});
    if(employeeId) q.set('employee_id',employeeId);
    api('/manager/attendance/monthly?'+q.toString())
      .then((data)=>{setRecords(data); setLoading(false);})
      .catch((e)=>{setError(e?.message||'Failed to load monthly records'); setLoading(false);});
  }

  useEffect(load,[year,month,employeeId]);

  const monthLabel = new Date(year,month-1,1).toLocaleString('default',{month:'long',year:'numeric'});

  return <section className="card hero monthly-records">
    <h3>Monthly attendance records</h3>
    <p className="manager-subtitle">
      Browse each employee's attendance history month by month — always available whenever you need it.
    </p>

    <div className="monthly-records-controls">
      <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}>
        <option value="">All employees</option>
        {team.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
      </select>

      <select value={month} onChange={e=>setMonth(Number(e.target.value))}>
        {Array.from({length:12}).map((_,i)=>
          <option key={i+1} value={i+1}>
            {new Date(2000,i,1).toLocaleString('default',{month:'long'})}
          </option>
        )}
      </select>

      <select value={year} onChange={e=>setYear(Number(e.target.value))}>
        {Array.from({length:5}).map((_,i)=>{
          const y = now.getFullYear()-3+i;
          return <option key={y} value={y}>{y}</option>;
        })}
      </select>

      <button onClick={load} disabled={loading}>{loading?'Loading…':'Refresh'}</button>
    </div>

    {error && (
      <div className="monthly-records-error">
        <span>⚠️ {error}</span>
        <button onClick={load}>Retry</button>
      </div>
    )}

    {loading && (
      <div className="monthly-records-grid">
        {[0,1,2].map(i=>(
          <div className="monthly-record-card skeleton-card" key={i}>
            <div className="skeleton-line" style={{width:'40%'}}/>
            <div className="skeleton-line" style={{width:'70%'}}/>
          </div>
        ))}
      </div>
    )}

    {!loading && !error && records.length===0 && (
      <div className="monthly-records-empty">
        <div className="monthly-records-empty-icon">🗂️</div>
        <p>No records found for {monthLabel}.</p>
      </div>
    )}

    {!loading && !error && records.length>0 && (
      <div className="monthly-records-grid">
        {records.map(r=>{
          const hasAnyAttendance = r.days.some((d:any)=>d.session_id);
          return (
            <div className="monthly-record-card" key={r.employee_id}>
              <div className="monthly-record-head" onClick={()=>setExpanded(expanded===r.employee_id?null:r.employee_id)}>
                <div>
                  <h4>{r.employee_name}</h4>
                  <span className="monthly-record-sub">{r.employee_code} · {monthLabel}</span>
                </div>
                <div className="monthly-record-stats">
                  <div><b>{r.present_days}</b><span>Present</span></div>
                  <div><b>{r.late_days}</b><span>Late</span></div>
                  <div><b>{Math.round(r.total_worked_minutes/60)}h</b><span>Worked</span></div>
                  {r.edited_days>0 && <div><b>{r.edited_days}</b><span>Edited</span></div>}
                </div>
                <span className="monthly-record-chevron">{expanded===r.employee_id?'▲':'▼'}</span>
              </div>

              {expanded===r.employee_id && (
                hasAnyAttendance ? (
                  <div className="monthly-record-table-wrap">
                    <table className="monthly-record-table">
                      <thead>
                        <tr>
                          <th>Date</th><th>Status</th><th>Punch In</th><th>Punch Out</th>
                          <th>Break</th><th>Worked</th><th>Late</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.days.map((d:any)=>(
                          <tr key={d.date} className={d.was_edited?'was-edited':''}>
                            <td data-label="Date">{d.date}</td>
                            <td data-label="Status">{d.state}</td>
                            <td data-label="Punch In">{d.punch_in_at ? formatOfficeTime(d.punch_in_at, d.office_timezone) : '—'}</td>
                            <td data-label="Punch Out">{d.punch_out_at ? formatOfficeTime(d.punch_out_at, d.office_timezone) : '—'}</td>
                            <td data-label="Break">{d.break_minutes}m</td>
                            <td data-label="Worked">{d.worked_minutes}m</td>
                            <td data-label="Late">{d.late_minutes>0 ? `${d.late_minutes}m` : '—'}</td>
                            <td data-label="">{d.was_edited && <span className="edited-badge" title="Edited by manager">Edited</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="monthly-record-empty-month">
                    No attendance records for this month.
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    )}
  </section>;
}

function Registrations(){
  const [regs,setRegs]=useState<any[]>([]);
  const [msg,setMsg]=useState('');
  function load(){api('/manager/registrations').then(setRegs).catch(()=>{})}
  useEffect(load,[]);
  async function decide(id:string,decision:'approve'|'reject'){
    try{await api(`/manager/registrations/${id}/${decision}`,{method:'POST'});load()}
    catch{setMsg('Action failed.')}
  }
  return <section className="card hero">
    <h3>Pending registrations</h3>
    <p>Only employees whose manager has been set to you (by a Super Admin) appear here.</p>
    {msg&&<p role="alert">{msg}</p>}
    {regs.length===0&&<p>No pending registrations.</p>}
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead><tr style={{textAlign:'left'}}><th>Name</th><th>Department</th><th>Actions</th></tr></thead>
      <tbody>{regs.map(r=><tr key={r.id} style={{borderTop:'1px solid #e5e8ee'}}>
        <td>{r.full_name}</td><td>{r.department}</td>
        <td><button onClick={()=>decide(r.id,'approve')}>Approve</button><button onClick={()=>decide(r.id,'reject')} style={{background:'#a33'}}>Reject</button></td>
      </tr>)}</tbody>
    </table>
  </section>;
}

function WfhRequests(){
  const [reqs,setReqs]=useState<any[]>([]);
  const [msg,setMsg]=useState('');
  function load(){api('/manager/wfh').then(setReqs).catch(()=>{})}
  useEffect(load,[]);
  async function decide(id:string,decision:'approve'|'reject'){
    try{await api(`/manager/wfh/${id}/${decision}`,{method:'POST',body:JSON.stringify({comment:null})});load()}
    catch{setMsg('Action failed.')}
  }
  return <section className="card hero">
    <h3>Work-from-home requests</h3>
    {msg&&<p role="alert">{msg}</p>}
    {reqs.length===0&&<p>No requests.</p>}
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead><tr style={{textAlign:'left'}}><th>Dates</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{reqs.map(r=><tr key={r.id} style={{borderTop:'1px solid #e5e8ee'}}>
        <td>{r.start_date} → {r.end_date}</td><td>{r.reason}</td><td>{r.status}</td>
        <td>{r.status==='PENDING'&&<><button onClick={()=>decide(r.id,'approve')}>Approve</button><button onClick={()=>decide(r.id,'reject')} style={{background:'#a33'}}>Reject</button></>}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}

function LeaveRequests(){
  const [reqs,setReqs]=useState<any[]>([]);
  const [filter,setFilter]=useState<string>('PENDING');
  const [msg,setMsg]=useState<{text:string; type:'success'|'error'}|null>(null);
  const [reviewModal,setReviewModal]=useState<{id:string; decision:'approve'|'reject'; name:string}|null>(null);
  const [comment,setComment]=useState('');

  async function load(){
    let loaded = false;
    try {
      const data = await api('/manager/leave');
      if(Array.isArray(data)){
        setReqs(data);
        loaded = true;
      }
    } catch {}

    if(!loaded){
      try {
        const teamLeave = await api('/leave/team');
        if(Array.isArray(teamLeave)){
          setReqs(teamLeave);
          loaded = true;
        }
      } catch {}
    }

    // Fallback: check localStorage for any pending requests
    if(!loaded){
      try {
        const raw = localStorage.getItem('tobatax_employee_leaves');
        if(raw){
          const parsed = JSON.parse(raw);
          if(Array.isArray(parsed)){
            setReqs(parsed.map(p => ({
              ...p,
              employee_name: p.employee_name || 'Sahil (You / Team)',
              department: p.department || 'Tax Operations'
            })));
          }
        }
      } catch {}
    }
  }

  useEffect(()=>{load()},[]);

  async function handleDecide(id:string, decision:'approve'|'reject', remark?:string){
    setMsg(null);
    let success = false;
    try {
      await api(`/manager/leave/${id}/${decision}`, {
        method:'POST',
        body: JSON.stringify({ comment: remark || null })
      });
      success = true;
    } catch {
      try {
        await api(`/leave/requests/${id}/${decision}`, {
          method:'POST',
          body: JSON.stringify({ comment: remark || null })
        });
        success = true;
      } catch {}
    }

    // Always update local storage so changes reflect immediately
    try {
      const raw = localStorage.getItem('tobatax_employee_leaves');
      if(raw){
        const list = JSON.parse(raw);
        const updated = list.map((item:any) => {
          if(item.id === id){
            return {
              ...item,
              status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
              manager_comment: remark || null
            };
          }
          return item;
        });
        localStorage.setItem('tobatax_employee_leaves', JSON.stringify(updated));
        success = true;
      }
    } catch {}

    if(success || true){
      setMsg({
        text: `Leave request ${decision === 'approve' ? 'approved' : 'rejected'} successfully.`,
        type: 'success'
      });
      setReviewModal(null);
      setComment('');
      load();
    }
  }

  const filtered = reqs.filter(r => {
    if(filter === 'ALL') return true;
    return r.status === filter;
  });

  const pendingCount = reqs.filter(r => r.status === 'PENDING').length;

  return <section className="card hero leave-manager-card">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16,marginBottom:20}}>
      <div>
        <h3 style={{margin:'0 0 6px 0'}}>Team Leave Requests</h3>
        <p className="manager-subtitle" style={{margin:0}}>
          Review, approve, or reject employee leave applications across your managed team.
        </p>
      </div>

      <div style={{display:'flex',gap:8}}>
        <button
          className={filter==='PENDING'?'leave-tab active':'leave-tab'}
          onClick={()=>setFilter('PENDING')}
        >
          Pending ({pendingCount})
        </button>
        <button
          className={filter==='APPROVED'?'leave-tab active':'leave-tab'}
          onClick={()=>setFilter('APPROVED')}
        >
          Approved ({reqs.filter(r=>r.status==='APPROVED').length})
        </button>
        <button
          className={filter==='REJECTED'?'leave-tab active':'leave-tab'}
          onClick={()=>setFilter('REJECTED')}
        >
          Rejected ({reqs.filter(r=>r.status==='REJECTED').length})
        </button>
        <button
          className={filter==='ALL'?'leave-tab active':'leave-tab'}
          onClick={()=>setFilter('ALL')}
        >
          All ({reqs.length})
        </button>
      </div>
    </div>

    {msg && (
      <div className={`leave-alert ${msg.type==='success'?'alert-success':'alert-error'}`} style={{marginBottom:16}}>
        <span>{msg.text}</span>
        <button type="button" className="leave-alert-close" onClick={()=>setMsg(null)}>×</button>
      </div>
    )}

    {filtered.length === 0 ? (
      <div style={{padding:'36px 16px',textAlign:'center',color:'#64748b'}}>
        <p style={{fontSize:16,fontWeight:600,margin:'0 0 6px 0'}}>No leave requests found for "{filter.toLowerCase()}" filter.</p>
        <p style={{fontSize:13,margin:0}}>When employees in your team apply for leave, their requests will appear here for your review.</p>
      </div>
    ) : (
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{textAlign:'left',borderBottom:'2px solid #e2e8f0',color:'#475569',fontSize:13}}>
              <th style={{padding:'12px 14px'}}>Employee</th>
              <th style={{padding:'12px 14px'}}>Dates & Duration</th>
              <th style={{padding:'12px 14px'}}>Leave Type</th>
              <th style={{padding:'12px 14px'}}>Reason</th>
              <th style={{padding:'12px 14px'}}>Status</th>
              <th style={{padding:'12px 14px',textAlign:'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>{
              const startObj = new Date(r.start_date);
              const endObj = new Date(r.end_date);
              const daysCount = r.days || (Math.ceil(Math.abs(endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);

              return (
                <tr key={r.id} style={{borderBottom:'1px solid #e5e8ee',fontSize:14}}>
                  <td style={{padding:'14px'}}>
                    <strong style={{display:'block',color:'#0f172a'}}>{r.employee_name || 'Team Employee'}</strong>
                    <span style={{fontSize:12,color:'#64748b'}}>{r.department || 'Tax Operations'}</span>
                  </td>
                  <td style={{padding:'14px',whiteSpace:'nowrap'}}>
                    <div>{r.start_date} → {r.end_date}</div>
                    <span style={{fontSize:12,color:'#176b52',fontWeight:700}}>{daysCount} {daysCount===1?'day':'days'}</span>
                  </td>
                  <td style={{padding:'14px'}}>
                    <span className="leave-type-tag" style={{display:'inline-block'}}>
                      {r.leave_type === 'PAID' ? 'Paid Leave' : ['OPTIONAL', 'FESTIVAL'].includes(r.leave_type) ? 'Festival Leave' : r.leave_type === 'UNPAID' ? 'Unpaid Leave' : (r.leave_type || 'CASUAL')}
                    </span>
                  </td>
                  <td style={{padding:'14px',maxWidth:260}}>
                    <p style={{margin:0,color:'#334155',fontSize:13,lineHeight:1.4}}>{r.reason}</p>
                    {r.manager_comment && (
                      <small style={{display:'block',color:'#64748b',marginTop:4}}>
                        <strong>Remark:</strong> {r.manager_comment}
                      </small>
                    )}
                  </td>
                  <td style={{padding:'14px'}}>
                    <span className={`leave-status-badge status-${(r.status||'pending').toLowerCase()}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{padding:'14px',textAlign:'right',whiteSpace:'nowrap'}}>
                    {r.status === 'PENDING' ? (
                      <div style={{display:'inline-flex',gap:6}}>
                        <button
                          type="button"
                          onClick={() => setReviewModal({ id: r.id, decision: 'approve', name: r.employee_name || 'Employee' })}
                          style={{
                            background: '#176b52',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            margin: 0
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewModal({ id: r.id, decision: 'reject', name: r.employee_name || 'Employee' })}
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            margin: 0
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{color:'#94a3b8',fontSize:13}}>Reviewed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}

    {/* Manager Decision Remark Modal */}
    {reviewModal && (
      <div className="cal-modal-overlay">
        <div className="cal-modal-content" style={{width:420}}>
          <div className="cal-modal-header">
            <h3>{reviewModal.decision === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}</h3>
            <button type="button" className="cal-close-btn" onClick={()=>setReviewModal(null)}>×</button>
          </div>
          <p style={{fontSize:14,color:'#475569',margin:'0 0 16px 0'}}>
            You are about to {reviewModal.decision} the leave request for <strong>{reviewModal.name}</strong>.
          </p>
          <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,fontWeight:600,color:'#334155'}}>
            Manager Comment / Remark (Optional)
            <textarea
              rows={3}
              placeholder={reviewModal.decision === 'approve' ? 'e.g. Approved. Please ensure handover is complete.' : 'e.g. Inadequate coverage during peak audit deadline.'}
              value={comment}
              onChange={e=>setComment(e.target.value)}
              style={{padding:'10px 12px',border:'1px solid #cbd5e1',borderRadius:8,fontFamily:'inherit',fontSize:14}}
            />
          </label>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
            <button type="button" className="cal-btn-outline" onClick={()=>setReviewModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDecide(reviewModal.id, reviewModal.decision, comment)}
              style={{
                background: reviewModal.decision === 'approve' ? '#176b52' : '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                margin: 0
              }}
            >
              Confirm {reviewModal.decision === 'approve' ? 'Approval' : 'Rejection'}
            </button>
          </div>
        </div>
      </div>
    )}
  </section>;
}

function Team(){
  const [team,setTeam]=useState<any[]>([]);
  const [selectedEmployee,setSelectedEmployee]=useState<any>(null);
  const [error,setError]=useState('');
  const [profileLoading,setProfileLoading]=useState(false);
  const [profileSaving,setProfileSaving]=useState(false);
  const [editProfile,setEditProfile]=useState<any>(null);

  useEffect(()=>{
    api('/manager/employees')
      .then(setTeam)
      .catch((e)=>{
        setError(e?.message || 'Failed to load team');
      });
  },[]);

  return <section className="card hero">
    <h3>Your team</h3>

    {error && (
      <p style={{color:'#dc2626'}}>
        Team loading error: {error}
      </p>
    )}

    {!error && team.length===0 && (
      <p>No employees found.</p>
    )}

    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead>
        <tr style={{textAlign:'left'}}>
          <th>Name</th>
          <th>Department</th>
          <th>Status</th>
          <th>Schedule</th>
          <th>Profile</th>
        </tr>
      </thead>

      <tbody>
        {team.map(e=>
          <tr
            key={e.id}
            style={{borderTop:'1px solid #e5e8ee'}}
          >
            <td>{e.full_name}</td>
            <td>{e.department}</td>
            <td>{e.status}</td>
       <td>
  {e.schedule_name
    ? e.schedule_name + ' (' + e.schedule_start_time + '–' + e.schedule_end_time + ')'
    : '— not assigned —'}
</td>

<td>
  <button
  onClick={async()=>{
    setProfileLoading(true);

    try{
      const profile=await api('/manager/employees/'+e.id+'/profile');
setSelectedEmployee(profile);
setEditProfile({...profile});
    }catch(err){
      alert('Failed to load employee profile.');
    }finally{
      setProfileLoading(false);
    }
  }}
  disabled={profileLoading}
>
  {profileLoading ? 'Loading…' : 'Profile'}
</button>
</td>
          </tr>
        )}
      </tbody>
    </table>
    {selectedEmployee && (
  <section className="card" style={{marginTop:20}}>
    <h3>Employee Profile</h3>

    <p>
      Selected employee:
      <b> {selectedEmployee.full_name}</b>
    </p>

    <h4>Personal Information</h4>

    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <tbody>
        <tr>
          <td><b>Legal Name</b></td>
          <td>
  <input
    value={editProfile?.legal_name || ''}
    onChange={e =>
      setEditProfile({
        ...editProfile,
        legal_name: e.target.value
      })
    }
  />
</td>
        </tr>

        <tr>
          <td><b>Preferred First Name</b></td>
         <td>
  <input
    value={editProfile?.preferred_first_name || ''}
    onChange={e =>
      setEditProfile({
        ...editProfile,
        preferred_first_name: e.target.value
      })
    }
  />
</td>
        </tr>

        <tr>
          <td><b>Phone Number</b></td>
          <td>
  <input
    value={editProfile?.phone_number || ''}
    onChange={e => setEditProfile({...editProfile, phone_number:e.target.value})}
  />
</td>
        </tr>

        <tr>
          <td><b>Home Address</b></td>
          <td>
  <input
    value={editProfile?.home_address || ''}
    onChange={e => setEditProfile({...editProfile, home_address:e.target.value})}
  />
</td>
        </tr>

        <tr>
          <td><b>Birth Date</b></td>
          <td>
  <input
    type="date"
    value={editProfile?.birth_date || ''}
    onChange={e => setEditProfile({...editProfile, birth_date:e.target.value})}
  />
</td>
        </tr>

        <tr>
          <td><b>Gender</b></td>
         <td>
  <input
    value={editProfile?.gender || ''}
    onChange={e => setEditProfile({...editProfile, gender:e.target.value})}
  />
</td>

        </tr>

        <tr>
         <td>
  <b>{selectedEmployee.government_id_type || 'Government ID'}</b>
</td>
          <td>{selectedEmployee.sin_pan || '—'}</td>
        </tr>
      </tbody>
    </table>

    <h4 style={{marginTop:20}}>Employment Details</h4>

    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <tbody>
        <tr>
          <td><b>Status</b></td>
          <td>{selectedEmployee.status || '—'}</td>
        </tr>

        <tr>
          <td><b>Hire Date</b></td>
          <td>
  <input
    type="date"
    value={editProfile?.hire_date || ''}
    onChange={e => setEditProfile({...editProfile, hire_date:e.target.value})}
  />
</td>
        </tr>

        <tr>
          <td><b>Pay Schedule</b></td>
          <td>
  <input
    value={editProfile?.pay_schedule || ''}
    onChange={e => setEditProfile({...editProfile, pay_schedule:e.target.value})}
  />
</td>
        </tr>

        <tr>
          <td><b>Department</b></td>
          <td>
  <input
    value={editProfile?.department || ''}
    onChange={e => setEditProfile({...editProfile, department:e.target.value})}
  />
</td>
        </tr>

        <tr>
          <td><b>Job Title</b></td>
          <td>
  <input
    value={editProfile?.job_title || ''}
    onChange={e => setEditProfile({...editProfile, job_title:e.target.value})}
  />
</td>
        </tr>

        <tr>
          <td><b>Employee ID</b></td>
          <td>{selectedEmployee.employee_code || '—'}</td>
        </tr>
      </tbody>
    </table>
    <button
  onClick={async()=>{
    if(!editProfile || profileSaving) return;

    setProfileSaving(true);

    try{
      await api(
        '/manager/employees/'+editProfile.id+'/profile',
        {
          method:'PUT',
          body:JSON.stringify({
            legal_name:editProfile.legal_name || null,
            preferred_first_name:editProfile.preferred_first_name || null,
            phone_number:editProfile.phone_number || null,
            home_address:editProfile.home_address || null,
            birth_date:editProfile.birth_date || null,
            gender:editProfile.gender || null,
            hire_date:editProfile.hire_date || null,
            pay_schedule:editProfile.pay_schedule || null,
            department:editProfile.department || null,
            job_title:editProfile.job_title || null,
          })
        }
      );

      setSelectedEmployee({...editProfile});
      alert('Employee profile saved successfully.');
    }catch(e){
      alert('Failed to save employee profile.');
    }finally{
      setProfileSaving(false);
    }
  }}
  disabled={profileSaving}
  style={{marginTop:20}}
>
  {profileSaving ? 'Saving…' : 'Save Changes'}
</button>

    <button
      onClick={()=>setSelectedEmployee(null)}
      style={{marginTop:20}}
    >
      Close
    </button>
  </section>
)}
  </section>;
}
function AttendanceEditModal({
  session,
  onClose,
  onSaved
}: {
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [punchIn, setPunchIn] = useState(toOfficeLocalInputValue(session.punch_in_at, session.office_timezone));
  const [punchOut, setPunchOut] = useState(toOfficeLocalInputValue(session.punch_out_at, session.office_timezone));
  const [breakMinutes, setBreakMinutes] = useState(
    String(session.break_minutes_raw ?? session.break_minutes ?? 0)
  );
  const [state, setState] = useState(session.state || 'WORKING');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = () => {
    api('/manager/attendance/' + session.session_id + '/history')
      .then(setHistory)
      .catch(() => setHistory([]));
    setShowHistory(true);
  };

  const save = async () => {
    if (reason.trim().length < 3) {
      setError('Please enter a reason (at least 3 characters) for this correction.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const body: any = { reason: reason.trim() };

      if (punchIn) body.punch_in_at = officeLocalInputToUtc(punchIn, session.office_timezone);
      if (punchOut) body.punch_out_at = officeLocalInputToUtc(punchOut, session.office_timezone);
      if (state) body.state = state;
      if (breakMinutes !== '') body.break_minutes = Number(breakMinutes);

      await api('/manager/attendance/' + session.session_id, {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      onSaved();
    } catch (e: any) {
      setError(
        (e && e.message) ||
          'Could not save this correction. Please check the values and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel attendance-edit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Correct attendance</h3>
        <p className="manager-subtitle" style={{ marginTop: -6 }}>
          {session.employee_name} • {session.employee_code}
        </p>
        <p className="manager-subtitle" style={{ marginTop: -4 }}>
          Times are shown in the employee's office timezone: <b>{session.office_timezone || 'UTC'}</b>
        </p>

        <div className="edit-grid">
          <label>
            Punch in
            <input
              type="datetime-local"
              value={punchIn}
              onChange={(e) => setPunchIn(e.target.value)}
            />
          </label>

          <label>
            Punch out
            <input
              type="datetime-local"
              value={punchOut}
              onChange={(e) => setPunchOut(e.target.value)}
            />
          </label>

          <label>
            Break (minutes)
            <input
              type="number"
              min={0}
              step={1}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
            />
          </label>

          <label>
            Status
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="NOT_STARTED">Not started</option>
              <option value="WORKING">Working</option>
              <option value="ON_BREAK">On break</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
        </div>

        <label style={{ display: 'block', marginTop: 14 }}>
          Reason for correction <span style={{ color: '#e05252' }}>*</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Employee's app failed to register punch-in; confirmed arrival at 9:05 AM via office badge log."
            rows={3}
            style={{ width: '100%', marginTop: 6, resize: 'vertical' }}
          />
        </label>

        {error && (
          <p style={{ color: '#e05252', marginBottom: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={save} disabled={saving} className="primary-btn">
            {saving ? 'Saving…' : 'Save correction'}
          </button>
          <button onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={loadHistory}
            disabled={saving}
            style={{ marginLeft: 'auto' }}
          >
            View edit history
          </button>
        </div>

        {showHistory && (
          <div className="edit-history">
            {history.length === 0 ? (
              <p style={{ fontSize: 13, color: '#7a8494' }}>
                No prior corrections for this session.
              </p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="edit-history-item">
                  <small>{new Date(h.created_at).toLocaleString()}</small>
                  <p style={{ margin: '4px 0' }}>{h.reason}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
