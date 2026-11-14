import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  RefreshCw,
  Users,
  GraduationCap,
  Calendar,
  Filter,
  RotateCcw,
  AlertCircle,
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangeError, setRangeError] = useState('');

  const fetchAnalytics = async (start = startDate, end = endDate) => {
    try {
      setLoading(true);
      const params = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;

      const res = await api.get('/analytics/admin', { params });
      setData(res.data);
      setError('');
      setRangeError('');
    } catch (err) {
      setError(err.message || 'Failed to load visual analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setRangeError('End date cannot be earlier than start date.');
      return;
    }
    setRangeError('');
    fetchAnalytics(startDate, endDate);
  };

  const handlePreset = (days) => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    if (days === 0) {
      setStartDate(endStr);
      setEndDate(endStr);
      setRangeError('');
      fetchAnalytics(endStr, endStr);
    } else {
      const past = new Date(today.getTime() - days * 86400000);
      const startStr = past.toISOString().split('T')[0];
      setStartDate(startStr);
      setEndDate(endStr);
      setRangeError('');
      fetchAnalytics(startStr, endStr);
    }
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setRangeError('');
    fetchAnalytics('', '');
  };

  if (loading && !data) {
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
  const isCustomRange = Boolean(overview?.dateRange?.isCustomRange);
  const totalSessionsInRange = overview?.dateRange?.totalSessions ?? classBreakdown.length;

  // Pie chart data
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
          onClick={() => fetchAnalytics(startDate, endDate)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Date Range Filter Bar */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
              <Calendar size={16} className="text-sky-600" />
              <span>Date Filter:</span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setRangeError('');
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Start Date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setRangeError('');
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="End Date"
              />
            </div>

            <button
              type="submit"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <Filter size={13} />
              <span>Apply</span>
            </button>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium transition"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="flex items-center space-x-1 text-xs">
            <button
              type="button"
              onClick={() => handlePreset(0)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset(7)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset(30)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Last 30 Days
            </button>
          </div>
        </form>

        {rangeError && (
          <div className="flex items-center space-x-2 text-rose-600 text-xs font-semibold pt-1">
            <AlertCircle size={14} />
            <span>{rangeError}</span>
          </div>
        )}

        {isCustomRange && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Filtering: <strong className="text-slate-800">{overview.dateRange.startDate}</strong> to{' '}
              <strong className="text-slate-800">{overview.dateRange.endDate}</strong>
            </span>
            <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
              {overview.dateRange.totalSessions} session(s) &bull; {overview.dateRange.totalMarked || 0} marks recorded
            </span>
          </div>
        )}
      </div>

      {totalSessionsInRange === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
          <Calendar className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="text-base font-bold text-slate-900">No Attendance Records in Selected Range</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No attendance sessions match the selected date window ({startDate || 'earliest'} to {endDate || 'latest'}).
            Try widening the date range or select "Last 30 Days".
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition"
          >
            Reset to Today
          </button>
        </div>
      ) : (
        <>
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
                  {isCustomRange ? 'Filtered Range' : "Today's Sessions"}
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
                <h2 className="text-base font-bold text-slate-900 mb-1">
                  {isCustomRange ? 'Period Headcount Ratio' : "Today's Headcount Ratio"}
                </h2>
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

          {/* Row 2: Trend Chart */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Attendance Performance Trend</h2>
                <p className="text-xs text-slate-500">
                  {isCustomRange
                    ? `Trend across ${overview.dateRange.startDate} to ${overview.dateRange.endDate}`
                    : 'Longitudinal attendance trend across all enrolled cohorts'}
                </p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(val) => [`${val}%`, 'Attendance Rate']} />
                  <Area type="monotone" dataKey="rate" stroke="#6366f1" fill="#e0e7ff" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

