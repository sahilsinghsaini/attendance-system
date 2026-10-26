import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, Shield, CalendarDays, CalendarCheck } from 'lucide-react';

export default function AdminLayout() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="shell">
      <aside>
  <h1 className="brand">
    <img
      src="/assets/branding/tobatax-logo.png"
      alt="Tobatax"
    />
  </h1>

        <nav>
          <span
            style={{
              color: '#8b95a8',
              fontSize: 12,
              padding: '0 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Super Admin console
          </span>
          <NavLink to="/admin" end className={({ isActive }) => isActive ? 'active' : ''}>
            <Shield size={18} />
            <span>Console Overview</span>
          </NavLink>
          <NavLink to="/admin/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
            <CalendarDays size={18} />
            <span>Holidays &amp; Calendar</span>
          </NavLink>
          <NavLink to="/admin/leave" className={({ isActive }) => isActive ? 'active' : ''}>
            <CalendarCheck size={18} />
            <span>Leave Management</span>
          </NavLink>
        </nav>

        <button
          className="ghost"
          onClick={() => setShowLogoutModal(true)}
        >
          <LogOut /> Sign out
        </button>
      </aside>

   <main>
  <div className="dashboard-bg-illustration admin-illustration">
    <img
      src="/assets/illustrations/accounting-work.png"
      alt=""
    />
  </div>

  <Outlet />
</main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="logout-modal-overlay"
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
            className="logout-modal-panel"
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
