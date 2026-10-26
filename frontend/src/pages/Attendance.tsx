import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Attendance() {
  const [s, setS] = useState<any>();
  const [offices, setOffices] = useState<any[]>([]);
  const [office, setOffice] = useState('');
  const [showPunchOutConfirm, setShowPunchOutConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workingOvernight, setWorkingOvernight] = useState<any>(null);
  const [wfh, setWfh] = useState<any>(null);

  async function loadAttendance() {
    try {
      const [today, history] = await Promise.all([
        api('/attendance/today'),
        api('/attendance/history')
      ]);

      setS(today || null);

      const todayDate =
        today?.work_date || new Date().toISOString().slice(0, 10);

      const overnight = Array.isArray(history)
        ? history.find(
            (item: any) =>
              item.state === 'WORKING' &&
              item.work_date &&
              item.work_date < todayDate
          )
        : null;

      setWorkingOvernight(overnight || null);
    } catch {}
  }

  useEffect(() => {
    loadAttendance();

    api('/offices/my-offices')
      .then(setOffices)
      .catch(() => {});

    api('/wfh/today')
      .then(setWfh)
      .catch(() => setWfh(null));
  }, []);

  async function action(path: string) {
    if (busy) return;

    setBusy(true);

    try {
      if (path === 'punch-in') {
        let data;

        if (wfh) {
          data = await api('/attendance/punch-in', {
            method: 'POST',
            body: JSON.stringify({
              mode: 'WFH',
              office_id: null,
              gps: null
            })
          });
        } else {
          const gps = await new Promise<any>((res, rej) =>
            navigator.geolocation.getCurrentPosition(
              p =>
                res({
                  latitude: p.coords.latitude,
                  longitude: p.coords.longitude,
                  accuracy_meters: p.coords.accuracy
                }),
              rej
            )
          );

          data = await api('/attendance/punch-in', {
            method: 'POST',
            body: JSON.stringify({
              mode: 'OFFICE',
              office_id: office,
              gps
            })
          });
        }

        setS(data);
      } else {
        await api('/attendance/' + path, { method: 'POST' });
        await loadAttendance();
      }
    } catch {
      alert('Action rejected by server.');
    } finally {
      setBusy(false);
    }
  }

  const state = s?.state || 'NOT_STARTED';

  const stateLabel =
    state === 'WORKING'
      ? 'Working'
      : state === 'ON_BREAK'
        ? 'On break'
        : state === 'COMPLETED'
          ? 'Completed'
          : 'Not started';

  const stateIcon =
    state === 'WORKING'
      ? '🟢'
      : state === 'ON_BREAK'
        ? '☕'
        : state === 'COMPLETED'
          ? '✓'
          : '🕘';

  const stateMessage =
    state === 'WORKING'
      ? 'You are currently clocked in.'
      : state === 'ON_BREAK'
        ? 'Your break is currently active.'
        : state === 'COMPLETED'
          ? 'Your attendance for today is complete.'
          : wfh
            ? 'Your work-from-home request is approved for today.'
            : 'Start your workday when you are ready.';

  return (
    <>
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">ATTENDANCE</p>
          <h2>Attendance</h2>
          <p className="dashboard-subtitle">
            Manage your workday, breaks and attendance.
          </p>
        </div>
      </div>

      <section className="card">
        <div
          className={
            'attendance-status ' +
            state.toLowerCase()
          }
        >
          <div className="attendance-status-icon">
            {stateIcon}
          </div>

          <div className="attendance-status-text">
            <span>Today's attendance</span>
            <strong>{stateLabel}</strong>
            <p>{stateMessage}</p>

            <div className="attendance-metrics">
              <div>
                <span>Mode</span>
                <strong>{wfh ? 'WFH' : s?.mode || '—'}</strong>
              </div>

              <div>
                <span>Work date</span>
                <strong>{s?.work_date || '—'}</strong>
              </div>
            </div>
          </div>
        </div>

        {(!s || state === 'NOT_STARTED') && !workingOvernight && (
          <>
            {wfh ? (
              <div className="stack">
                <div className="status-visual">
                  <div className="status-visual-content">
                    <div className="visual-icon">🏠</div>

                    <div>
                      <strong>WFH Approved</strong>
                      <p>
                        You are approved to work from home today.
                      </p>
                    </div>
                  </div>

                  <div className="visual-decoration">
                    🏠 💻 ☕
                  </div>
                </div>

                <button
                  onClick={() => action('punch-in')}
                  disabled={busy}
                >
                  {busy ? 'Punching in…' : 'Punch in from WFH'}
                </button>
              </div>
            ) : (
              <div className="stack">
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
                  onClick={() => action('punch-in')}
                  disabled={!office || busy}
                >
                  {busy ? 'Punching in…' : 'Punch in'}
                </button>
              </div>
            )}
          </>
        )}

        {workingOvernight && (
          <div className="stack">
            <p>Overnight shift in progress.</p>

            <button
              onClick={() => setShowPunchOutConfirm(true)}
            >
              Punch out
            </button>
          </div>
        )}

        {state === 'WORKING' && (
          <div className="stack">
            <button onClick={() => action('break/start')}>
              Start break
            </button>

            <button
              onClick={() => setShowPunchOutConfirm(true)}
            >
              Punch out
            </button>
          </div>
        )}

        {state === 'ON_BREAK' && (
          <div className="stack">
            <button onClick={() => action('break/end')}>
              End break
            </button>
          </div>
        )}
      </section>

      {showPunchOutConfirm && (
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
                onClick={() => {
                  setShowPunchOutConfirm(false);
                }}
                style={{
                  background: '#dc2626',
                  color: '#fff'
                }}
              >
                No
              </button>

              <button
                onClick={async () => {
                  setShowPunchOutConfirm(false);
                  await action('punch-out');
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
