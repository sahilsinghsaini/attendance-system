import { useState } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const x = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // Save BOTH tokens.
      localStorage.setItem('access_token', x.access_token);
      localStorage.setItem('refresh_token', x.refresh_token);

      const me = await api('/auth/me');

      localStorage.setItem('role', me.role);

      if (me.role === 'SUPER_ADMIN') {
        nav('/admin');
      } else if (me.role === 'MANAGER') {
        nav('/manager');
      } else {
        nav('/employee/dashboard');
      }
    } catch (e) {
      setError('Login failed');
    }
  }

  return (
    <div className="auth">
      <div className="poster">
        <p>SECURE ATTENDANCE</p>

        <h1>
          Know where work happens. Keep every event accountable.
        </h1>
      </div>

      <form onSubmit={submit}>
        <h2>Welcome back</h2>

        <label>
          Email

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p role="alert">
            {error}
          </p>
        )}

        <button>
          Sign in
        </button>

        <Link to="/register">
          Create employee account
        </Link>
      </form>
    </div>
  );
}