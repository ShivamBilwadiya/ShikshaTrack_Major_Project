import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Users,
  Activity,
  Database,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Server,
  UserCheck,
  UserX,
  History,
  HardDrive,
  Cpu,
} from 'lucide-react';

export default function SystemAdministration() {
  const { user: currentUser } = useAuth();

  // Active sub-tab: 'users' | 'audit' | 'health'
  const [activeTab, setActiveTab] = useState('users');

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Summary Metrics State
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    recentAuditLogs7Days: 0,
    actionCounts: {},
    recentActivities: [],
  });

  // Health State
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Users Tab State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [togglingUserId, setTogglingUserId] = useState(null);

  // Audit Logs Tab State
  const [logs, setLogs] = useState([]);
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  // Fetch Summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/admin/activity-summary');
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load activity summary:', err);
    }
  }, []);

  // Fetch Health
  const fetchHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const res = await api.get('/admin/health');
      if (res.success) {
        setHealth(res.data);
      }
    } catch (err) {
      console.error('Failed to inspect health:', err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: userPage,
        limit: 10,
        ...(userSearch && { search: userSearch }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { active: statusFilter }),
      });
      const res = await api.get(`/admin/users?${params.toString()}`);
      if (res.success) {
        setUsers(res.data.users);
        setUserTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load system users.');
    } finally {
      setLoading(false);
    }
  }, [userPage, userSearch, roleFilter, statusFilter]);

  // Fetch Audit Logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: logPage,
        limit: 15,
        ...(logSearch && { search: logSearch }),
        ...(actionFilter && { action: actionFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });
      const res = await api.get(`/admin/audit-logs?${params.toString()}`);
      if (res.success) {
        setLogs(res.data.logs);
        setLogTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [logPage, logSearch, actionFilter, startDate, endDate]);

  useEffect(() => {
    fetchSummary();
    fetchHealth();
  }, [fetchSummary, fetchHealth]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'audit') {
      fetchLogs();
    } else if (activeTab === 'health') {
      fetchHealth();
    }
  }, [activeTab, fetchUsers, fetchLogs, fetchHealth]);

  // Handle User Status Toggle
  const handleToggleStatus = async (targetUser) => {
    const nextStatus = !targetUser.active;
    const confirmMsg = nextStatus
      ? `Are you sure you want to reactivate ${targetUser.name}'s account?`
      : `Are you sure you want to deactivate ${targetUser.name}'s account? They will no longer be able to log in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setTogglingUserId(targetUser.id);
      setError('');
      setActionSuccess('');

      const res = await api.patch(`/admin/users/${targetUser.id}/status`, {
        active: nextStatus,
        reason: nextStatus ? 'Reactivated by administrator' : 'Suspended by administrator',
      });

      if (res.success) {
        setActionSuccess(`User ${targetUser.name} has been ${nextStatus ? 'activated' : 'deactivated'}.`);
        fetchUsers();
        fetchSummary();
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to update user status.');
    } finally {
      setTogglingUserId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Administration & Audit</h1>
              <p className="text-sm text-slate-500">
                Institutional account access control, security audit logging, and runtime diagnostics.
              </p>
            </div>
          </div>
        </div>

        {/* Global Health Status Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border bg-white shadow-sm text-xs font-semibold">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                health?.status === 'HEALTHY' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-slate-700">Database: {health?.database?.status || 'CHECKING'}</span>
            {health?.database?.latencyMs !== undefined && (
              <span className="text-slate-400">({health.database.latencyMs}ms)</span>
            )}
          </div>

          <button
            onClick={() => {
              fetchSummary();
              if (activeTab === 'users') fetchUsers();
              if (activeTab === 'audit') fetchLogs();
              if (activeTab === 'health') fetchHealth();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
          >
            <RefreshCw size={14} className={loading || healthLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Users</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalUsers}</p>
            <p className="text-xs text-slate-400 mt-0.5">Accounts registered</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Accounts</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.activeUsers}</p>
            <p className="text-xs text-slate-400 mt-0.5">Eligible to authenticate</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Suspended Accounts</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{summary.inactiveUsers}</p>
            <p className="text-xs text-slate-400 mt-0.5">Deactivated access</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <UserX size={22} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Audit Trail (7 Days)</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{summary.recentAuditLogs7Days}</p>
            <p className="text-xs text-slate-400 mt-0.5">Tracked admin actions</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Activity size={22} />
          </div>
        </div>
      </div>

      {/* Action / Error Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-3 text-sm animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-3 text-sm">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={16} />
          <span>User Directory & Status</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={16} />
          <span>Audit Trail & Activity Log</span>
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'health'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server size={16} />
          <span>System Diagnostics & Health</span>
        </button>
      </div>

      {/* Tab 1: User Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                placeholder="Search name or email..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setUserPage(1);
                }}
                className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="TEACHER">TEACHER</option>
                <option value="PARENT">PARENT</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setUserPage(1);
                }}
                className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="true">Active</option>
                <option value="false">Deactivated</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Audit Logs</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Loading users directory...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No institutional accounts match criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : u.role === 'TEACHER'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {u.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            <span>{u.active ? 'Active' : 'Deactivated'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs">
                          {u._count?.auditLogs || 0} recorded
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isSelf ? (
                            <span className="text-xs text-slate-400 italic">Current Session</span>
                          ) : (
                            <button
                              disabled={togglingUserId === u.id}
                              onClick={() => handleToggleStatus(u)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition ${
                                u.active
                                  ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              } disabled:opacity-50`}
                            >
                              {togglingUserId === u.id
                                ? 'Updating...'
                                : u.active
                                ? 'Deactivate'
                                : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* User Pagination */}
          {userTotalPages > 1 && (
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Page {userPage} of {userTotalPages}
              </span>
              <div className="space-x-2">
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={userPage >= userTotalPages}
                  onClick={() => setUserPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Audit Trail Log */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => {
                  setLogSearch(e.target.value);
                  setLogPage(1);
                }}
                placeholder="Search action, reason, actor..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setLogPage(1);
                }}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setLogPage(1);
                }}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setLogPage(1);
                }}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="USER_ACTIVATED">USER_ACTIVATED</option>
                <option value="USER_DEACTIVATED">USER_DEACTIVATED</option>
                <option value="RECORD_UPDATED">RECORD_UPDATED</option>
                <option value="SESSION_CLOSED">SESSION_CLOSED</option>
                <option value="STUDENT_CREATED">STUDENT_CREATED</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      Loading audit history...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No audit events found for selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-medium text-slate-700">{log.entityType}</span>
                        <span className="text-slate-400 block text-[11px] truncate max-w-xs">{log.entityId}</span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {log.actor ? (
                          <div>
                            <span className="font-medium text-slate-900">{log.actor.name}</span>
                            <span className="text-slate-400 block text-[11px]">{log.actor.role}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">System Agent</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-md">
                        {log.reason || 'No justification specified'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Log Pagination */}
          {logTotalPages > 1 && (
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Page {logPage} of {logTotalPages}
              </span>
              <div className="space-x-2">
                <button
                  disabled={logPage <= 1}
                  onClick={() => setLogPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={logPage >= logTotalPages}
                  onClick={() => setLogPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: System Health Diagnostics */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <Database className="text-indigo-600" size={22} />
              <h2 className="font-bold text-slate-900 text-base">Relational Database Diagnostics</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-500">Connection State</span>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 size={12} />
                  <span>{health?.database?.status || 'CONNECTED'}</span>
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-500">Ping Query Latency</span>
                <span className="font-mono font-semibold text-slate-900">
                  {health?.database?.latencyMs ?? 0} ms
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-500">Backend System Uptime</span>
                <span className="font-mono text-slate-900">
                  {health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)} minutes` : '0 min'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-500">Node.js Engine</span>
                <span className="font-mono text-slate-900">{health?.nodeVersion || 'v20+'}</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">Heap Memory Allocation</span>
                <span className="font-mono text-slate-900">{health?.memoryUsageMB || 0} MB</span>
              </div>
            </div>
          </div>

          {/* Recent Administrative Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <Activity className="text-indigo-600" size={22} />
              <h2 className="font-bold text-slate-900 text-base">Recent Institutional Activity Stream</h2>
            </div>

            <div className="space-y-3">
              {summary.recentActivities.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No recent activities recorded.</p>
              ) : (
                summary.recentActivities.slice(0, 5).map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start space-x-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <Clock size={15} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-900 truncate">{act.action}</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-500 truncate mt-0.5">
                        {act.reason || `Target: ${act.entityType} (${act.entityId.slice(0, 8)})`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
