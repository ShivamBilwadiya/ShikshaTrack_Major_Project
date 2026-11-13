import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  RefreshCw,
  Users,
  GraduationCap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const STATUS_COLORS = ['#10b981', '#f59e0b', '#f43f5e'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/admin');
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load visual analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin h-8 w-8 text-sky-600" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-center text-red-600 text-xs">{error}</div>;
  }

  const { overview, classBreakdown, trend } = data;

  // Pie chart data for today
  const pieData = [
    { name: 'Present', value: overview.todayPresent },
    { name: 'Late', value: overview.todayLate },
    { name: 'Absent', value: overview.todayAbsent },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <TrendingUp size={22} className="text-sky-600" />
            <span>Attendance Visual Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Comparative performance charts, trend line forecasts, and cohort participation
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw size={14} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Row 1: Bar Chart (Class Comparison) & Pie Chart (Today Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Comparison Bar Chart (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Grade-wise Headcount Distribution</h2>
              <p className="text-xs text-slate-500">Present vs Absent students across classes</p>
            </div>
            <span className="text-xs font-bold text-slate-600 px-2 py-0.5 rounded bg-slate-100">
              Today's Sessions
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classBreakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Today's Headcount Ratio</h2>
            <p className="text-xs text-slate-500 mb-4">Overall distribution of attendance statuses</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} students`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-emerald-700 font-bold block">Present</span>
              <strong className="text-sm font-black text-emerald-700">{overview.todayPresent}</strong>
            </div>
            <div>
              <span className="text-[10px] text-amber-700 font-bold block">Late</span>
              <strong className="text-sm font-black text-amber-700">{overview.todayLate}</strong>
            </div>
            <div>
              <span className="text-[10px] text-rose-700 font-bold block">Absent</span>
              <strong className="text-sm font-black text-rose-700">{overview.todayAbsent}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: 7-Day Trend Chart */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Multi-Day Attendance Performance</h2>
            <p className="text-xs text-slate-500">Longitudinal attendance trend across all enrolled cohorts</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" domain={[50, 100]} />
              <Tooltip formatter={(val) => [`${val}%`, 'Attendance Rate']} />
              <Area type="monotone" dataKey="rate" stroke="#6366f1" fill="#e0e7ff" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

