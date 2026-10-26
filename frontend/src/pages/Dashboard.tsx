import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Coffee, Timer, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

type Session = {
  id: string;
  state?: string;
  work_date?: string;
  punch_in_at?: string;
  punch_out_at?: string;
  office_id?: string;
  active_break_start_at?: string;
  total_break_seconds?: number;
};

export default function Dashboard() {
  const [session, setSession] = useState<Session>();
  const [hours, setHours] = useState<any>();
  const [history, setHistory] = useState<Session[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [, setTick] = useState(0);
  const now = new Date();

  const parseTimestamp = (value?: string) => {
    if (!value) return null;
    const text = String(value);
    const date = new Date(!text.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(text) ? `${text}Z` : text);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const breakSeconds = (item?: Session) => {
    if (!item) return 0;
    const start = parseTimestamp(item.active_break_start_at);
    const end = item.punch_out_at ? parseTimestamp(item.punch_out_at) : new Date();
    const active = start && end ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)) : 0;
    return (item.total_break_seconds || 0) + active;
  };

  const workedSeconds = (item?: Session) => {
    const start = parseTimestamp(item?.punch_in_at);
    const end = item?.punch_out_at ? parseTimestamp(item.punch_out_at) : new Date();
    return start && end ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000) - breakSeconds(item)) : 0;
  };

  const duration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTime = (value?: string, officeId?: string) => {
    const date = parseTimestamp(value);
    if (!date) return '—';
    const timezone = offices.find((office) => office.id === officeId)?.timezone;
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  };

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  };

  useEffect(() => {
    api('/attendance/today').then(setSession).catch(() => {});
    api('/attendance/history').then(setHistory).catch(() => {});
    api('/offices/my-offices').then(setOffices).catch(() => {});
    api(`/attendance/work-hours?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then(setHours).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const state = session?.state || 'NOT_STARTED';
  const statusLabel: Record<string, string> = {
    WORKING: 'You’re on the clock', ON_BREAK: 'Taking a break', COMPLETED: 'Shift complete', NOT_STARTED: 'Ready when you are',
  };
  const progress = hours?.required_hours ? Math.min(100, Math.round((hours.fulfilled_hours / hours.required_hours) * 100)) : 0;
  const records = history.slice(0, 5);

  return <div className="employee-dashboard">
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">TOBATAX <span>•</span> EMPLOYEE WORKSPACE</p>
        <h2>Good day <span aria-hidden="true">✦</span></h2>
        <p className="dashboard-subtitle">Here’s your attendance and work-hour progress at a glance.</p>
      </div>
      <div className="dashboard-date"><CalendarDays size={17} />{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </header>

    <section className={`attendance-hero attendance-hero-${state.toLowerCase()}`}>
      <div className="attendance-hero-copy">
        <span className="hero-kicker"><span className="live-dot" /> TODAY’S ATTENDANCE</span>
        <h3>{statusLabel[state] || state.replace(/_/g, ' ')}</h3>
        <p>{state === 'WORKING' ? 'Your time is being tracked. Keep up the good work.' : state === 'ON_BREAK' ? 'Your break is in progress. Take the time you need.' : state === 'COMPLETED' ? 'Your attendance for today is complete. Have a great rest of your day.' : 'Start your shift to begin tracking your work hours.'}</p>
        <div className="hero-actions">
          <Link className="primary-action" to="/employee/attendance"><Clock3 size={17} /> Open attendance <ArrowUpRight size={16} /></Link>
          <Link className="secondary-action" to="/employee/attendance">View history</Link>
        </div>
      </div>
      <div className="hero-today-metrics">
        <div className="today-metric"><span><Timer size={15} /> Worked today</span><strong>{duration(workedSeconds(session))}</strong></div>
        <div className="today-metric"><span><Coffee size={15} /> Break time</span><strong>{duration(breakSeconds(session))}</strong></div>
      </div>
      <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
    </section>

    <section className="dashboard-stat-grid" aria-label="Monthly work summary">
      <article className="dashboard-stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon-green"><Clock3 size={18} /></span><span className="stat-label">Hours completed</span></div><strong>{hours ? `${hours.fulfilled_hours}h` : '—'}</strong><span className="stat-foot"><TrendingUp size={14} /> {hours?.required_hours ? `${progress}% of monthly target` : 'This month'}</span></article>
      <article className="dashboard-stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon-blue"><Timer size={18} /></span><span className="stat-label">Hours remaining</span></div><strong>{hours?.remaining_hours != null ? `${hours.remaining_hours}h` : '—'}</strong><span className="stat-foot">{hours?.required_hours ? `of ${hours.required_hours}h required` : 'Monthly target'}</span></article>
      <article className="dashboard-stat-card progress-stat"><div className="stat-card-top"><span className="stat-icon stat-icon-violet"><CheckCircle2 size={18} /></span><span className="stat-label">Monthly progress</span></div><strong>{hours?.required_hours ? `${progress}%` : '—'}</strong><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span className="stat-foot">{hours?.met_target ? 'Monthly target met' : 'Keep your pace steady'}</span></article>
    </section>

    <section className="dashboard-lower-grid">
      <article className="dashboard-panel history-panel">
        <div className="panel-heading"><div><h3>Recent attendance</h3><p>Your latest recorded work days</p></div><Link to="/employee/attendance">See all <ArrowUpRight size={15} /></Link></div>
        <div className="attendance-table-wrap"><table className="dashboard-table"><thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Break</th><th>Worked</th><th>Status</th></tr></thead><tbody>
        {records.map((item) => { const combined = session?.id === item.id ? { ...item, ...session } : item; return <tr key={item.id}><td>{formatDate(item.work_date)}</td><td>{formatTime(item.punch_in_at, item.office_id)}</td><td>{formatTime(item.punch_out_at, item.office_id)}</td><td>{duration(breakSeconds(combined))}</td><td className="worked-cell">{duration(workedSeconds(combined))}</td><td><span className={`table-status status-${item.state?.toLowerCase()}`}>{item.state?.replace(/_/g, ' ') || '—'}</span></td></tr>; })}
          {!records.length && <tr><td className="table-empty" colSpan={6}>Your attendance records will appear here.</td></tr>}
        </tbody></table></div>
      </article>
      <article className="dashboard-panel target-panel">
        <div className="panel-heading"><div><h3>This month</h3><p>Your required hours progress</p></div><span className="target-icon"><TrendingUp size={18} /></span></div>
        {hours?.required_hours ? <><div className="target-value">{hours.fulfilled_hours}<span> / {hours.required_hours}h</span></div><div className="large-progress-track"><span style={{ width: `${progress}%` }} /></div><div className="target-legend"><span><i /> Completed</span><strong>{progress}%</strong></div><p className="target-note">{hours.met_target ? 'You’ve reached your monthly target.' : `${hours.remaining_hours} hours to go. You’ve got this.`}</p></> : <div className="target-empty">{hours ? 'No monthly target has been set for you yet.' : 'Loading your monthly summary…'}</div>}
        <Link className="panel-link" to="/employee/attendance">Explore attendance <ArrowUpRight size={15} /></Link>
      </article>
    </section>
  </div>;
}
