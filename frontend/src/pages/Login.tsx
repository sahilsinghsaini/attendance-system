import { useState } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const x = await api('/auth/login', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          email,
          password,
        }),
      });

      localStorage.setItem('access_token', x.access_token);
      localStorage.setItem('refresh_token', x.refresh_token);

      const me = await api('/auth/me', { signal: controller.signal });

      localStorage.setItem('role', me.role);

      if (me.role === 'SUPER_ADMIN') {
        nav('/admin');
      } else if (me.role === 'MANAGER') {
        nav('/manager');
      } else {
        nav('/employee/dashboard');
      }
    } catch (e: any) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('role');
      if (e?.name === 'AbortError') {
        setError('Sign-in timed out. Check that the backend can connect to its database, then try again.');
      } else try {
        const parsed = JSON.parse(e.message);

        if (parsed.detail === 'Account is not active') {
          setError(
            'Your account is registered but pending approval by a manager or administrator.'
          );
        } else if (parsed.detail === 'Invalid credentials') {
          setError('Invalid email or password.');
        } else if (Array.isArray(parsed.detail)) {
          setError(parsed.detail.map((item: any) => item.msg).filter(Boolean).join(' '));
        } else {
          setError(typeof parsed.detail === 'string' ? parsed.detail : 'Login failed.');
        }
      } catch {
        setError(/failed to fetch|networkerror|load failed/i.test(e?.message || '')
          ? 'Cannot reach the attendance server. Make sure the backend is running at 127.0.0.1:8080, then try again.'
          : e?.message || 'Login failed.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">

      <section className="login-visual">

        <div className="login-brand">
          <div className="brand-mark">T</div>
          <span className="brand-name">
            Toba<span>Central</span>
          </span>
        </div>

        <div className="brand-tagline">
          SECURE&nbsp;&nbsp;•&nbsp;&nbsp;ATTENDANCE&nbsp;&nbsp;•&nbsp;&nbsp;PRODUCTIVITY
        </div>

        <div className="login-copy">
          <p className="login-eyebrow">SMART WORKFORCE MANAGEMENT</p>

          <h1>
            Track Today,
            <br />
            Build a Stronger
            <br />
            <span>Tomorrow</span>
          </h1>

          <p>
            Better attendance. Greater transparency.
            <br />
            A more productive team.
          </p>
        </div>

        <div className="finance-scene">

          <div className="finance-chart">
            <div className="chart-title">Cash Flow</div>

            <div className="chart-area">
              <div className="chart-bar bar-1"></div>
              <div className="chart-bar bar-2"></div>
              <div className="chart-bar bar-3"></div>
              <div className="chart-bar bar-4"></div>
              <div className="chart-bar bar-5"></div>

              <div className="chart-arrow">↗</div>
            </div>

            <div className="chart-stats">
              <div>
                <small>Income</small>
                <strong>$125,000</strong>
              </div>

              <div>
                <small>Net Flow</small>
                <strong>$56,600</strong>
              </div>
            </div>
          </div>

          <div className="coin coin-1">₹</div>
          <div className="coin coin-2">₹</div>
          <div className="coin coin-3">₹</div>

          <div className="coin-stack">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>

          <div className="growth-ring"></div>

          <div className="finance-pie">
            <div></div>
          </div>

        </div>

        <div className="login-features">
          <div>
            <b>▥</b>
            <span>
              <strong>Real-time</strong>
              Attendance
            </span>
          </div>

          <div>
            <b>✓</b>
            <span>
              <strong>Secure & Reliable</strong>
              Workforce
            </span>
          </div>

          <div>
            <b>↗</b>
            <span>
              <strong>Smarter</strong>
              Productivity
            </span>
          </div>
        </div>

      </section>

      <section className="login-panel">

        <div className="login-card">

          <div className="login-card-brand">
            <div className="brand-mark">T</div>
            <span className="brand-name">
              Toba<span>Central</span>
            </span>
          </div>

          <h2>Welcome Back</h2>

          <p className="login-subtitle">
            Sign in to your account to continue
          </p>

          <form onSubmit={submit}>

            <label>
              Email

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </label>

            <label>
              Password

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
              <span>→</span>
            </button>

            <Link to="/register">
              Create employee account
            </Link>

          </form>

          <div className="login-footer">
            Your Work&nbsp;&nbsp;•&nbsp;&nbsp;Our Progress
          </div>

        </div>

      </section>

    </div>
  );
}

