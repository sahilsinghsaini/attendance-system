import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Clock3,
  LogOut,
  CalendarDays,
  CalendarCheck,
  LayoutDashboard,
  Laptop,
  User,
  Shield,
  Briefcase
} from 'lucide-react';

export default function AppLayout() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const role = localStorage.getItem('role');

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
          {role === 'SUPER_ADMIN' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
              <Shield size={18} />
              <span>Admin Console</span>
            </NavLink>
          )}
          {role === 'MANAGER' && (
            <NavLink to="/manager" className={({ isActive }) => isActive ? 'active' : ''}>
              <Briefcase size={18} />
              <span>Manager Console</span>
            </NavLink>
          )}
          <NavLink to="/employee/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/employee/attendance" className={({ isActive }) => isActive ? 'active' : ''}>
            <Clock3 size={18} />
            <span>Attendance</span>
          </NavLink>
          <NavLink to="/employee/wfh" className={({ isActive }) => isActive ? 'active' : ''}>
            <Laptop size={18} />
            <span>Work From Home</span>
          </NavLink>
          <NavLink to="/employee/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
            <CalendarDays size={18} />
            <span>Holidays & Calendar</span>
          </NavLink>
          <NavLink to="/employee/leave" className={({ isActive }) => isActive ? 'active' : ''}>
            <CalendarCheck size={18} />
            <span>Leave Requests</span>
          </NavLink>
          <NavLink to="/employee/profile" className={({ isActive }) => isActive ? 'active' : ''}>
            <User size={18} />
            <span>Profile</span>
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
        <Outlet />
      </main>

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
