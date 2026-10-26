import { useEffect, useState, useMemo } from 'react';
import {
  CalendarCheck,
  Calendar,
  Clock,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  FileText,
  Filter,
  Check,
  Info
} from 'lucide-react';
import { api } from '../services/api';

export interface LeaveItem {
  id: string;
  employee_name?: string;
  target_role?: string;
  email?: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  days?: number;
  manager_comment?: string | null;
  created_at?: string;
}

interface LeaveTarget {
  user_id: string;
  full_name: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER';
}

export interface LeaveBalance {
  paid: { total: number; used: number; available: number };
  pending_count: number;
}

const DEFAULT_BALANCE: LeaveBalance = {
  paid: { total: 12, used: 0, available: 12 },
  pending_count: 0,
};

export default function Leave() {
  const role = localStorage.getItem('role');
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const [requests, setRequests] = useState<LeaveItem[]>([]);
  const [staff, setStaff] = useState<LeaveTarget[]>([]);
  const [balance, setBalance] = useState<LeaveBalance>(DEFAULT_BALANCE);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [form, setForm] = useState({
    target_user_id: '',
    start_date: '',
    end_date: '',
    leave_type: 'PAID',
    reason: '',
  });

  // Calculate duration between selected dates
  const calculatedDays = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [form.start_date, form.end_date]);

  // Load leave requests and balance
  async function loadData() {
    setLoading(true);
    let loadedFromApi = false;

    // 1. Try API
    try {
      if (isSuperAdmin) {
        const [teamData, staffData] = await Promise.all([
          api('/leave/team'),
          api('/leave/eligible-users'),
        ]);
        if (Array.isArray(teamData)) {
          setRequests(teamData);
          loadedFromApi = true;
        }
        if (Array.isArray(staffData)) setStaff(staffData);
      } else {
      const [reqData, balData] = await Promise.all([
        api('/leave/requests'),
        api('/leave/balance'),
      ]);

      if (Array.isArray(reqData)) {
        setRequests(reqData);
        loadedFromApi = true;
      }
      if (balData && typeof balData === 'object' && balData.paid) {
        setBalance(balData);
      }
      }
    } catch {
      // Fallback to local storage if API isn't deployed on remote host yet
    }

    if (!loadedFromApi && !isSuperAdmin) {
      try {
              const raw = localStorage.getItem('tobatax_employee_leaves');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRequests(parsed);
            // Recalculate local balance
            const approved = parsed.filter(p => p.status === 'APPROVED');
            const pending = parsed.filter(p => p.status === 'PENDING').length;

            let pUsed = 0;
            approved.forEach(item => {
              const days = item.days || 1;
              if (item.leave_type === 'PAID') pUsed += days;
            });

            setBalance({
              paid: { total: 12, used: pUsed, available: Math.max(0, 12 - pUsed) },
              pending_count: pending,
            });
          }
        }
      } catch {}
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Submit leave request
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!form.start_date || !form.end_date) {
      setMsg({ text: 'Please select both start and end dates.', type: 'error' });
      return;
    }

    if (form.end_date < form.start_date) {
      setMsg({ text: 'End date cannot be earlier than start date.', type: 'error' });
      return;
    }

    if (isSuperAdmin && !form.target_user_id) {
      setMsg({ text: 'Select an employee or manager first.', type: 'error' });
      return;
    }

    const duration = calculatedDays;
    const newReq: LeaveItem = {
      id: 'leave-' + Date.now(),
      start_date: form.start_date,
      end_date: form.end_date,
      leave_type: form.leave_type,
      reason: form.reason.trim(),
      status: 'PENDING',
      days: duration,
      created_at: new Date().toISOString(),
    };

    let saved = false;

    // Try API
    try {
      const resp = await api(isSuperAdmin ? '/leave/admin/requests' : '/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          ...(isSuperAdmin ? { target_user_id: form.target_user_id } : {}),
          start_date: form.start_date,
          end_date: form.end_date,
          leave_type: form.leave_type,
          reason: form.reason.trim(),
        }),
      });

      if (resp && resp.id) {
        newReq.id = resp.id;
        newReq.employee_name = resp.employee_name;
        newReq.target_role = resp.target_role;
        newReq.status = resp.status;
        saved = true;
      }
    } catch {
      if (isSuperAdmin) {
        setMsg({ text: 'Could not add leave. Check the server response and try again.', type: 'error' });
        setLoading(false);
        return;
      }
      // Employee fallback: save to local storage
    }

    // Always keep in local storage for instant responsiveness & sync
    try {
      if (isSuperAdmin) throw new Error('Admin leave is stored by the server');
      const raw = localStorage.getItem('tobatax_employee_leaves');
      const list: LeaveItem[] = raw ? JSON.parse(raw) : [];
      list.unshift(newReq);
      localStorage.setItem('tobatax_employee_leaves', JSON.stringify(list));
      saved = true;
    } catch {}

    if (saved) {
      setMsg({
        text: isSuperAdmin
          ? `Leave recorded for ${staff.find(person => person.user_id === form.target_user_id)?.full_name || 'staff member'}.`
          : `Leave request for ${duration} ${duration === 1 ? 'day' : 'days'} submitted successfully! Your manager will review it.`,
        type: 'success',
      });
      setForm({
        target_user_id: '',
        start_date: '',
        end_date: '',
        leave_type: 'PAID',
        reason: '',
      });
      setShowApplyModal(false);
      loadData();
    } else {
      setMsg({ text: 'Failed to submit leave request.', type: 'error' });
    }
  }

  async function handleAdminDecision(id: string, decision: 'approve' | 'reject') {
    try {
      await api(`/leave/requests/${id}/${decision}`, { method: 'POST', body: JSON.stringify({}) });
      await loadData();
      setMsg({ text: `Leave request ${decision === 'approve' ? 'approved' : 'rejected'}.`, type: 'success' });
    } catch {
      setMsg({ text: 'Could not update this leave request.', type: 'error' });
    }
  }

  // Cancel pending leave request
  async function handleCancel(id: string) {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) return;

    try {
      await api(`/leave/requests/${id}`, { method: 'DELETE' });
    } catch {}

    // Update in local storage
    try {
      const raw = localStorage.getItem('tobatax_employee_leaves');
      if (raw) {
        const list: LeaveItem[] = JSON.parse(raw);
        const updated = list.map(item => item.id === id ? { ...item, status: 'CANCELLED' as const } : item);
        localStorage.setItem('tobatax_employee_leaves', JSON.stringify(updated));
      }
    } catch {}

    loadData();
  }

  // Filter requests
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  function getStatusBadge(status: LeaveItem['status']) {
    switch (status) {
      case 'APPROVED':
        return <span className="leave-status-badge status-approved"><CheckCircle2 size={13} /> Approved</span>;
      case 'REJECTED':
        return <span className="leave-status-badge status-rejected"><XCircle size={13} /> Rejected</span>;
      case 'PENDING':
        return <span className="leave-status-badge status-pending"><Clock size={13} /> Pending Approval</span>;
      case 'CANCELLED':
        return <span className="leave-status-badge status-cancelled">Cancelled</span>;
      default:
        return <span className="leave-status-badge">{status}</span>;
    }
  }

  function getLeaveTypeName(type: string) {
    switch (type.toUpperCase()) {
      case 'CASUAL':
        return 'Casual Leave (CL)';
      case 'SICK':
        return 'Sick Leave (SL)';
      case 'PAID':
        return 'Paid Leave';
      case 'OPTIONAL':
      case 'FESTIVAL':
        return 'Festival Leave';
      case 'UNPAID':
        return 'Unpaid Leave';
      default:
        return type;
    }
  }

  return (
    <div className="leave-page-container">
      {/* Background illustration */}
      <div className="dashboard-bg-illustration leave-illustration">
        <img src="/assets/illustrations/accounting-work.png" alt="" />
      </div>

      {/* Header */}
      <header className="dashboard-header leave-page-header">
        <div>
          <p className="eyebrow">TOBATAX • {isSuperAdmin ? 'SUPER ADMIN' : role === 'MANAGER' ? 'MANAGER' : 'EMPLOYEE'}</p>
          <h2>{isSuperAdmin ? 'Universal Leave Management' : 'Leave Management'}</h2>
          <p className="dashboard-subtitle">
            {isSuperAdmin ? 'Record leave for any employee or manager and review organization-wide requests.' : 'Apply for leave, monitor your balance, and track manager approval statuses.'}
          </p>
        </div>

        <div className="leave-header-actions">
          <button
            type="button"
            className="cal-btn-primary"
            onClick={() => setShowApplyModal(true)}
          >
            <Plus size={16} /> {isSuperAdmin ? 'Add Leave for Staff' : 'Apply for Leave'}
          </button>
        </div>
      </header>

      {/* Alert Notification */}
      {msg && (
        <div className={`leave-alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
          <button type="button" className="leave-alert-close" onClick={() => setMsg(null)}>
            <X size={15} />
          </button>
        </div>
      )}

        {/* Leave Balance KPI Cards */}
      {!isSuperAdmin && <section className="leave-balance-grid leave-balance-grid-slim">
        <div className="card leave-bal-box">
          <div className="leave-bal-head">
            <span className="leave-type-pill pl">Paid Leave</span>
            <span className="leave-bal-ratio">{balance.paid.available} / {balance.paid.total} left</span>
          </div>
          <strong className="leave-bal-val">{balance.paid.available} <small>days</small></strong>
          <div className="leave-progress-bar">
            <div
              className="leave-progress-fill pl-fill"
              style={{ width: `${(balance.paid.available / balance.paid.total) * 100}%` }}
            />
          </div>
          <small className="leave-bal-sub">{balance.paid.used} days used this year • 12 days per annum</small>
        </div>

        <div className="card leave-bal-box pending-box">
          <div className="leave-bal-head">
            <span className="leave-type-pill pending">Pending Review</span>
            <Clock size={16} color="#d97706" />
          </div>
          <strong className="leave-bal-val">{balance.pending_count} <small>requests</small></strong>
          <p className="leave-bal-sub">Awaiting manager decision</p>
        </div>
      </section>}

      {/* Main Leave Content: History & Quick Apply */}
      <section className="card leave-history-section">
        <div className="leave-history-header">
          <div>
            <h3>{isSuperAdmin ? 'Organization Leave Records' : 'My Leave Requests'}</h3>
            <p className="dashboard-subtitle">{isSuperAdmin ? 'Leave for employees and managers across the organization.' : 'Review the status and history of all submitted leave requests.'}</p>
          </div>

          <div className="leave-filter-tabs">
            <button
              type="button"
              className={statusFilter === 'ALL' ? 'leave-tab active' : 'leave-tab'}
              onClick={() => setStatusFilter('ALL')}
            >
              All ({requests.length})
            </button>
            <button
              type="button"
              className={statusFilter === 'PENDING' ? 'leave-tab active' : 'leave-tab'}
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending ({requests.filter(r => r.status === 'PENDING').length})
            </button>
            <button
              type="button"
              className={statusFilter === 'APPROVED' ? 'leave-tab active' : 'leave-tab'}
              onClick={() => setStatusFilter('APPROVED')}
            >
              Approved ({requests.filter(r => r.status === 'APPROVED').length})
            </button>
            <button
              type="button"
              className={statusFilter === 'REJECTED' ? 'leave-tab active' : 'leave-tab'}
              onClick={() => setStatusFilter('REJECTED')}
            >
              Rejected ({requests.filter(r => r.status === 'REJECTED').length})
            </button>
          </div>
        </div>

        {/* Request List */}
        {filteredRequests.length === 0 ? (
          <div className="leave-empty-state">
            <CalendarCheck size={44} className="leave-empty-icon" />
            <h4>No leave requests found</h4>
            <p>You haven't submitted any leave requests matching the selected filter.</p>
            <button
              type="button"
              className="cal-btn-outline"
              style={{ marginTop: 12 }}
              onClick={() => setShowApplyModal(true)}
            >
              <Plus size={15} /> {isSuperAdmin ? 'Add Leave for Staff' : 'Apply for New Leave'}
            </button>
          </div>
        ) : (
          <div className="leave-requests-list">
            {filteredRequests.map(r => {
              const startObj = new Date(r.start_date);
              const endObj = new Date(r.end_date);
              const daysCount = r.days || (Math.ceil(Math.abs(endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);

              return (
                <div key={r.id} className={`leave-item-card status-${r.status.toLowerCase()}`}>
                  <div className="leave-item-left">
                    <div className="leave-item-dates">
                      <span className="leave-date-range">
                        📅 {r.start_date} → {r.end_date}
                      </span>
                      <span className="leave-duration-badge">
                        {daysCount} {daysCount === 1 ? 'day' : 'days'}
                      </span>
                    </div>

                    {isSuperAdmin && <div className="leave-target-meta"><strong>{r.employee_name || 'Staff member'}</strong><span>{r.target_role || 'EMPLOYEE'}{r.email ? ` · ${r.email}` : ''}</span></div>}
                    <div className="leave-item-meta">
                      <span className="leave-type-tag">
                        {getLeaveTypeName(r.leave_type)}
                      </span>
                      {getStatusBadge(r.status)}
                    </div>

                    <p className="leave-item-reason">
                      <strong>Reason:</strong> {r.reason || 'No reason provided.'}
                    </p>

                    {r.manager_comment && (
                      <div className="leave-manager-note">
                        <strong>Manager Remark:</strong> {r.manager_comment}
                      </div>
                    )}
                  </div>

                  <div className="leave-item-right">
                    {isSuperAdmin && r.status === 'PENDING' && <>
                      <button type="button" className="leave-admin-approve" onClick={() => handleAdminDecision(r.id, 'approve')}>Approve</button>
                      <button type="button" className="leave-cancel-btn" onClick={() => handleAdminDecision(r.id, 'reject')}>Reject</button>
                    </>}
                    {!isSuperAdmin && r.status === 'PENDING' && (
                      <button
                        type="button"
                        className="leave-cancel-btn"
                        onClick={() => handleCancel(r.id)}
                        title="Cancel this leave request"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="cal-modal-overlay">
          <div className="cal-modal-content">
            <div className="cal-modal-header">
              <h3>{isSuperAdmin ? 'Add Leave for Staff' : 'Apply for Leave'}</h3>
              <button
                type="button"
                className="cal-close-btn"
                onClick={() => setShowApplyModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="cal-modal-form">
              {isSuperAdmin && <label>
                Employee or Manager *
                <select required value={form.target_user_id} onChange={e => setForm({ ...form, target_user_id: e.target.value })}>
                  <option value="">Select a staff member</option>
                  {staff.map(person => <option key={person.user_id} value={person.user_id}>{person.full_name} · {person.role} · {person.email}</option>)}
                </select>
              </label>}
              <label>
                Leave Category *
                              <select
                  value={form.leave_type}
                  onChange={e => setForm({ ...form, leave_type: e.target.value })}
                >
                  <option value="PAID">Paid Leave</option>
                  <option value="FESTIVAL">Festival Leave</option>
                  <option value="UNPAID">Unpaid Leave</option>
                </select>
              </label>

              <div className="cal-form-row">
                <label>
                  Start Date *
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                  />
                </label>

                <label>
                  End Date *
                  <input
                    type="date"
                    required
                    min={form.start_date || undefined}
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                  />
                </label>
              </div>

              {calculatedDays > 0 && (
                <div className="leave-duration-preview">
                  <Info size={16} /> Total Duration: <strong>{calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}</strong>
                </div>
              )}

              <label>
                Reason for Leave *
                <textarea
                  rows={3}
                  required
                  placeholder={isSuperAdmin ? 'Add a note for this organization leave record...' : 'Please state the purpose of your leave for manager approval...'}
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </label>

              <div className="cal-modal-buttons">
                <button
                  type="button"
                  className="cal-btn-outline"
                  onClick={() => setShowApplyModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cal-btn-primary"
                >
                  {isSuperAdmin ? 'Add Leave' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
