import {useEffect,useState} from 'react';
import Card from '../components/Card';
import WorkHours from '../components/WorkHours';
import {api} from '../services/api';

const TABS=['Overview','Registrations','WFH Requests','Team','Work Hours'] as const;
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
    {tab==='Team'&&<Team/>}
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
  function parseTimestamp(value: any) {
  if (!value) return null;

  const text = String(value);

  if (
    !text.endsWith('Z') &&
    !/[+-]\d{2}:\d{2}$/.test(text)
  ) {
    return new Date(text + 'Z');
  }

  return new Date(text);
}

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
                </td>

                <td>
                  {employee.adjusted_scheduled_end
                    ? new Date(
                        employee.adjusted_scheduled_end
                      ).toLocaleTimeString([], {
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
                </tr>
              </thead>

              <tbody>
                {teamAttendance.map((employee) => (
                  <tr
                    key={employee.employee_id}
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
                      {employee.worked_minutes || 0} min
                    </td>

                    <td>
                      {employee.office || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmOut && (
        <div
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
            className="card"
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