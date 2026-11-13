import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  Users,
  GraduationCap,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  BrainCircuit,
  FileSpreadsheet,
  QrCode,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  Sparkles,
  Send,
  X,
  Bot,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Natural Language Search Assistant State
  const [nlQuery, setNlQuery] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState(null);
  const [nlError, setNlError] = useState('');

  const handleNlSearch = async (overrideQuery) => {
    const q = (typeof overrideQuery === 'string' ? overrideQuery : nlQuery).trim();
    if (!q) return;
    if (typeof overrideQuery === 'string') {
      setNlQuery(overrideQuery);
    }
    setNlLoading(true);
    setNlError('');
    try {
      const res = await api.post('/ai/ask', { query: q });
      setNlResult(res.data);
    } catch (err) {
      setNlError(err.message || 'Failed to process natural language query.');
    } finally {
      setNlLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/admin');
      setStats(res.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-sky-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">Loading real-time school statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
        <p className="font-semibold">Error loading dashboard:</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { overview, classBreakdown, trend, recentActivity } = stats;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Administrative Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time attendance intelligence and school operations overview
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            to="/ai-insights"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700 shadow-sm transition"
          >
            <BrainCircuit size={15} />
            <span>AI Insights & Anomalies</span>
          </Link>
          <Link
            to="/reports"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <FileSpreadsheet size={15} />
            <span>Daily Report</span>
          </Link>
          <button
            onClick={fetchStats}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 bg-white transition"
            title="Refresh statistics"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Natural Language Attendance Search Assistant */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white shadow-lg border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                <span>ShikshaTrack AI Attendance Assistant</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Natural Language Query
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Ask questions about attendance registers, trends, and meal headcounts in natural language
              </p>
            </div>
          </div>
        </div>

        {/* Query Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNlSearch();
          }}
          className="relative flex items-center"
        >
          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            placeholder="e.g. 'Attendance summary today', 'Which class had lowest attendance?', 'Mid-day meal count'..."
            className="w-full pl-10 pr-28 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-slate-800"
          />
          <button
            type="submit"
            disabled={nlLoading || !nlQuery.trim()}
            className="absolute right-2 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition disabled:opacity-40"
          >
            {nlLoading ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            <span>{nlLoading ? 'Querying...' : 'Ask'}</span>
          </button>
        </form>

        {/* Suggested Queries Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="text-slate-400 font-medium">Quick suggestions:</span>
          {[
            'Attendance summary today',
            'Which class had lowest attendance?',
            'Mid-day meal count today',
            'Students with low attendance',
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleNlSearch(suggestion)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {nlError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center justify-between">
            <span>{nlError}</span>
            <button onClick={() => setNlError('')} className="p-1 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Answer Result Card */}
        {nlResult && (
          <div className="p-4 rounded-xl bg-slate-800/90 border border-sky-500/30 text-white space-y-3 animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Bot size={18} className="text-sky-400 shrink-0" />
                <span className="text-xs font-bold text-sky-300">
                  Query Result: {nlResult.intent?.replace(/_/g, ' ') || 'ANALYSIS'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  Verified Database Query
                </span>
              </div>
              <button
                onClick={() => setNlResult(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md transition"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
              {nlResult.answer}
            </p>

            {nlResult.data && typeof nlResult.data === 'object' && (
              <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                {Object.entries(nlResult.data).slice(0, 4).map(([key, val]) => (
                  <div key={key} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                    <span className="text-sm font-bold text-sky-400 block mt-0.5">
                      {typeof val === 'number' && key.toLowerCase().includes('rate') ? `${val}%` : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Enrolled</span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{overview.totalStudents}</div>
            <span className="text-xs text-slate-400 mt-1 block">Active rural students</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <GraduationCap size={26} />
          </div>
        </div>

        {/* Present Today */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Present Today</span>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">{overview.todayPresent}</div>
            <span className="text-xs text-emerald-600 font-medium mt-1 block">
              + {overview.todayLate} late arrivals
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={26} />
          </div>
        </div>

        {/* Absent Today */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Absent Today</span>
            <div className="text-3xl font-extrabold text-rose-600 mt-1">{overview.todayAbsent}</div>
            <span className="text-xs text-slate-400 mt-1 block">Requires guardian notice</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle size={26} />
          </div>
        </div>

        {/* Overall Attendance Percentage */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
            <div className="text-3xl font-extrabold text-indigo-600 mt-1">{overview.todayAttendanceRate}%</div>
            <span className="text-xs text-slate-400 mt-1 block">Across {overview.totalClasses} classes</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp size={26} />
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart (2 columns) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">7-Day Attendance Trend</h2>
              <p className="text-xs text-slate-500">Daily present vs absent pattern</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-semibold text-slate-600">
              Last 7 School Days
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Attendance Rate']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#0284c7"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#presentGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Class Attendance Breakdown */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Today's Class Rates</h2>
            <Link to="/reports" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
              Details
            </Link>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {classBreakdown.map((c) => (
              <div key={c.classId} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-slate-900">{c.className}</span>
                  <span className={c.rate >= 80 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                    {c.rate}% ({c.present} / {c.present + c.absent + c.late})
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      c.rate >= 85 ? 'bg-emerald-500' : c.rate >= 70 ? 'bg-sky-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, c.rate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Operations Bar */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3">Quick Actions</h2>
            <div className="space-y-2.5">
              <Link
                to="/students/new"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-slate-700 text-xs font-semibold border border-slate-200/60 transition"
              >
                <div className="flex items-center space-x-2.5">
                  <GraduationCap size={16} className="text-sky-600" />
                  <span>Register New Student</span>
                </div>
                <ArrowRight size={14} />
              </Link>

              <Link
                to="/qr-cards"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-slate-700 text-xs font-semibold border border-slate-200/60 transition"
              >
                <div className="flex items-center space-x-2.5">
                  <QrCode size={16} className="text-indigo-600" />
                  <span>Generate Printable QR ID Cards</span>
                </div>
                <ArrowRight size={14} />
              </Link>

              <Link
                to="/classes"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-slate-700 text-xs font-semibold border border-slate-200/60 transition"
              >
                <div className="flex items-center space-x-2.5">
                  <Building2 size={16} className="text-emerald-600" />
                  <span>Manage Classes & Sections</span>
                </div>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 text-sky-900 text-xs">
            <p className="font-bold flex items-center space-x-1">
              <BrainCircuit size={14} className="text-sky-600" />
              <span>AI Anomaly Assistant Active</span>
            </p>
            <p className="text-[11px] text-sky-700 mt-1">
              Autonomous pattern matching monitors student weekday absence spikes and drops.
            </p>
          </div>
        </div>

        {/* Audit Log Activity Feed (2 columns) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-1">Administrative Audit Trail</h2>
          <p className="text-xs text-slate-500 mb-4">Latest confirmed modifications and attendance operations</p>
          <div className="space-y-3">
            {recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 mr-2">{log.action}</span>
                    <span className="text-slate-600">by {log.actor?.name || 'System'}</span>
                    {log.reason && <p className="text-[11px] text-slate-500 mt-0.5">Reason: {log.reason}</p>}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

