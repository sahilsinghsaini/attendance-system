import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Clock3, LogOut } from 'lucide-react';

export default function AppLayout() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="shell">
      <aside>
    <h1 className="brand">
       <img src="/assets/branding/tobatax-logo.png" alt="Tobatax" />
    </h1>

        <nav>
          <Link to="/employee/dashboard">Dashboard</Link>
          <Link to="/employee/attendance">Attendance</Link>
          <Link to="/employee/wfh">Work From Home</Link>
          <Link to="/employee/profile">Profile</Link>
        </nav>

        <button
          className="ghost"
          onClick={() => setShowLogoutModal(true)}
        >
          <LogOut /> Sign out
        </button>
      </aside>

      <main>
        <Outlet />
      </main>

      {showLogoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 360,
              maxWidth: '90%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 8,
              }}
            >
              Sign out
            </h2>

            <p
              style={{
                color: '#666',
                marginBottom: 24,
              }}
            >
              Are you sure you want to sign out?
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              {/* No = RED */}
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                No
              </button>

              {/* Yes = BLUE */}
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}