import React, { type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import AdminLayout from './layouts/AdminLayout';
import ManagerLayout from './layouts/ManagerLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Wfh from './pages/Wfh';
import Profile from './pages/Profile';
import Calendar from './pages/Calendar';
import Leave from './pages/Leave';
import Admin from './pages/Admin';
import Manager from './pages/Manager';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Support from './pages/Support';
import './styles.css';

function Guard({ children, role }: { children: ReactNode; role?: string }) {
  if (!localStorage.getItem('access_token')) return <Navigate to="/login" />;
  if (role && localStorage.getItem('role') !== role) return <Navigate to="/login" />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />

        <Route element={<Guard role="SUPER_ADMIN"><AdminLayout /></Guard>}>
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/calendar" element={<Calendar />} />
          <Route path="/admin/leave" element={<Leave />} />
        </Route>

        <Route element={<Guard role="MANAGER"><ManagerLayout /></Guard>}>
          <Route path="/manager" element={<Manager />} />
          <Route path="/manager/calendar" element={<Calendar />} />
          <Route path="/manager/leave" element={<Leave />} />
        </Route>

        <Route element={<Guard><AppLayout /></Guard>}>
          <Route path="/employee/dashboard" element={<Dashboard />} />
          <Route path="/employee/attendance" element={<Attendance />} />
          <Route path="/employee/wfh" element={<Wfh />} />
          <Route path="/employee/calendar" element={<Calendar />} />
          <Route path="/employee/leave" element={<Leave />} />
          <Route path="/employee/profile" element={<Profile />} />
        </Route>

        <Route path="/calendar" element={<Navigate to="/employee/calendar" />} />
        <Route path="/leave" element={<Navigate to="/employee/leave" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
