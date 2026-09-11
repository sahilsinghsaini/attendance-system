import {useEffect,useState} from 'react';
import Card from '../components/Card';
import {api} from '../services/api';

export default function Dashboard(){
  const [s,setS]=useState<any>();
  const [wh,setWh]=useState<any>();
  const [history,setHistory]=useState<any[]>([]);
  const [offices,setOffices]=useState<any[]>([]);
  const [,setTick]=useState(0);
  const now=new Date();

  function parseTimestamp(value:any){
    if(!value) return null;

    const text=String(value);

    if(
      !text.endsWith('Z') &&
      !/[+-]\d{2}:\d{2}$/.test(text)
    ){
      return new Date(text+'Z');
    }

    return new Date(text);
  }

  function activeBreakSeconds(session:any){
    if(!session?.active_break_start_at) return 0;

    const breakStart=parseTimestamp(session.active_break_start_at);
    if(!breakStart || Number.isNaN(breakStart.getTime())) return 0;

    const end=session.punch_out_at
      ? parseTimestamp(session.punch_out_at)
      : new Date();

    if(!end || Number.isNaN(end.getTime())) return 0;

    return Math.max(
      0,
      Math.floor((end.getTime()-breakStart.getTime())/1000)
    );
  }

  function totalBreakSeconds(session:any){
    if(!session) return 0;

    return (
      session.total_break_seconds||0
    )+activeBreakSeconds(session);
  }

  function workedTime(session:any){
    if(!session?.punch_in_at) return '0m';

    const start=parseTimestamp(session.punch_in_at);

    if(!start || Number.isNaN(start.getTime())) return '0m';

    const end=session.punch_out_at
      ? parseTimestamp(session.punch_out_at)
      : new Date();

    if(!end || Number.isNaN(end.getTime())) return '0m';

    const breakSeconds=totalBreakSeconds(session);

    const seconds=Math.max(
      0,
      Math.floor((end.getTime()-start.getTime())/1000)-breakSeconds
    );

    const hours=Math.floor(seconds/3600);
    const minutes=Math.floor((seconds%3600)/60);

    if(hours>0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function breakTime(session:any){
    const seconds=totalBreakSeconds(session);

    const hours=Math.floor(seconds/3600);
    const minutes=Math.floor((seconds%3600)/60);

    if(hours>0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  }

  function formatOfficeTime(value:any,officeId?:string){
    if(!value) return '—';

    const office=offices.find(o=>o.id===officeId);
    const timeZone=office?.timezone;

    const date=parseTimestamp(value);

    if(!date || Number.isNaN(date.getTime())) return '—';

    return date.toLocaleTimeString(undefined,{
      hour:'numeric',
      minute:'2-digit',
      timeZone
    });
  }

  function formatWorkDate(value:any){
    if(!value) return '—';

    const parts=String(value).split('-');

    if(parts.length!==3) return String(value);

    const year=Number(parts[0]);
    const month=Number(parts[1]);
    const day=Number(parts[2]);

    if(
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ){
      return String(value);
    }

    const date=new Date(year,month-1,day);

    return date.toLocaleDateString(undefined,{
      day:'2-digit',
      month:'short',
      year:'numeric'
    });
  }

  useEffect(()=>{
    api('/attendance/today').then(setS).catch(()=>{});
  },[]);

  useEffect(()=>{
    api('/attendance/history').then(setHistory).catch(()=>{});
  },[]);

  useEffect(()=>{
    api('/offices/my-offices').then(setOffices).catch(()=>{});
  },[]);

  useEffect(()=>{
    api(
      `/attendance/work-hours?year=${now.getFullYear()}&month=${now.getMonth()+1}`
    ).then(setWh).catch(()=>{});
  },[]);

  useEffect(()=>{
    const timer=setInterval(()=>{
      setTick(value=>value+1);
    },1000);

    return ()=>clearInterval(timer);
  },[]);

  return <>
<div
  className={
    s?.state === 'ON_BREAK'
      ? 'dashboard-bg-illustration break-illustration'
      : 'dashboard-bg-illustration'
  }
>
  <img
    src={
      s?.state === 'ON_BREAK'
        ? '/assets/illustrations/coffee-break.png'
        : '/assets/illustrations/accounting-work.png'
    }
    alt=""
  />
</div>
    <header className="dashboard-header">
  <div>
    <p className="eyebrow">TOBATAX • EMPLOYEE</p>
    <h2>Good day 👋</h2>
    <p className="dashboard-subtitle">
      Here’s your attendance overview for today.
    </p>
  </div>

  <img
    src="/assets/branding/tobatax-logo.png"
    alt="Tobatax"
    className="dashboard-logo"
  />
</header>

    <section className="card hero">
      <h3>This month's required hours</h3>

      {wh
        ?(
          wh.required_hours==null
            ?<p>
                No hours target has been set for you yet this month.
              </p>
            :<div className="grid">
                <Card
                  title="Required"
                  value={`${wh.required_hours}h`}
                />

                <Card
                  title="Completed"
                  value={`${wh.fulfilled_hours}h`}
                />

                <Card
                  title="Remaining"
                  value={`${wh.remaining_hours}h`}
                />

                <Card
                  title="On track"
                  value={wh.met_target?'Yes':'No'}
                />
              </div>
        )
        :<p>Loading…</p>
      }
    </section>

    <section className="card hero">
      <h3>Attendance History</h3>

          <section className="card hero">
  <h3>Today's Attendance</h3>

  <div className={`attendance-status ${s?.state?.toLowerCase() || 'not_started'}`}>
    <div className="attendance-status-icon">
      {s?.state === 'WORKING' && '🟢'}
      {s?.state === 'ON_BREAK' && '☕'}
      {s?.state === 'COMPLETED' && '🔵'}
      {(!s?.state || s?.state === 'NOT_STARTED') && '⚪'}
    </div>

    <div className="attendance-status-text">
      <span>Current status</span>

      <strong>
        {s?.state === 'WORKING' && 'Working'}
        {s?.state === 'ON_BREAK' && 'On Break'}
        {s?.state === 'COMPLETED' && 'Completed'}
        {(!s?.state || s?.state === 'NOT_STARTED') && 'Not Started'}
      </strong>

      <div className="attendance-metrics">
  <div>
    <span>Worked today</span>
    <strong>{s ? workedTime(s) : '0m'}</strong>
  </div>

  <div>
    <span>Break time</span>
    <strong>{s ? breakTime(s) : '0 min'}</strong>
  </div>
</div>

<p>
  {s?.state === 'WORKING' && 'You are currently working.'}
  {s?.state === 'ON_BREAK' && 'Enjoy your break.'}
  {s?.state === 'COMPLETED' && 'Your attendance for today is complete.'}
  {(!s?.state || s?.state === 'NOT_STARTED') &&
    'You have not punched in yet.'}
</p>
    </div>

    <button onClick={()=>{window.location.href='/employee/attendance';}}>
      Open Attendance
    </button>
  </div>
</section>
      <div style={{
        overflowX:'auto',
        marginTop:16
      }}>
        <table style={{
          width:'100%',
          borderCollapse:'collapse',
          minWidth:650
        }}>
          <thead>
            <tr>
              {[
                'Date',
                'Punch In',
                'Punch Out',
                'Break',
                'Worked',
                'Status'
              ].map(h=>(
                <th
                  key={h}
                  style={{
                    textAlign:'left',
                    padding:'12px',
                    borderBottom:'2px solid #e5e7eb',
                    fontSize:13
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {history.map(item=>{
              const historySession=
                s && s.id===item.id
                  ? {...item,...s}
                  : item;

              return (
                <tr key={item.id}>

                  <td style={{
                    padding:'12px',
                    borderBottom:'1px solid #eee'
                  }}>
                    {formatWorkDate(item.work_date)}
                  </td>

                  <td style={{
                    padding:'12px',
                    borderBottom:'1px solid #eee'
                  }}>
                    {formatOfficeTime(
                      item.punch_in_at,
                      item.office_id
                    )}
                  </td>

                  <td style={{
                    padding:'12px',
                    borderBottom:'1px solid #eee'
                  }}>
                    {formatOfficeTime(
                      item.punch_out_at,
                      item.office_id
                    )}
                  </td>

                  <td style={{
                    padding:'12px',
                    borderBottom:'1px solid #eee'
                  }}>
                    {breakTime(historySession)}
                  </td>

                  <td style={{
                    padding:'12px',
                    borderBottom:'1px solid #eee',
                    fontWeight:600
                  }}>
                    {workedTime(historySession)}
                  </td>

                  <td style={{
                    padding:'12px',
                    borderBottom:'1px solid #eee'
                  }}>
                    <span style={{
                      padding:'4px 9px',
                      borderRadius:12,
                      fontSize:12,
                      fontWeight:600,
                      background:
                        item.state==='COMPLETED'
                          ?'#dcfce7'
                          :'#fef3c7',
                      color:
                        item.state==='COMPLETED'
                          ?'#166534'
                          :'#92400e'
                    }}>
                      {item.state}
                    </span>
                  </td>

                </tr>
              );
            })}

            {!history.length&&(
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding:24,
                    textAlign:'center',
                    color:'#6b7280'
                  }}
                >
                  No attendance records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
