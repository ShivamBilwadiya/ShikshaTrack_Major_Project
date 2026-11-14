import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Filter,
  Download,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Users,
  Search,
  RefreshCw,
  PhoneCall,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart as PieIcon,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function AttendanceAnalytics() {
  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [interval, setInterval] = useState('daily');
  const [classes, setClasses] = useState([]);

  // Data states
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [classComparisons, setClassComparisons] = useState([]);
  const [atRiskData, setAtRiskData] = useState(null);
  const [riskThreshold, setRiskThreshold] = useState(75);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchAllAnalytics();
  }, [selectedClass, startDate, endDate, interval, riskThreshold]);

  const fetchClasses = async () => {
    try {
      const res = await api.get('/classes');
      if (res.data.success) {
        setClasses(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const fetchAllAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedClass) params.classId = selectedClass;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [ovRes, trRes, clRes, rkRes] = await Promise.all([
        api.get('/analytics/attendance/overview', { params }),
        api.get('/analytics/attendance/trends', { params: { ...params, interval } }),
        api.get('/analytics/attendance/classes', { params }),
        api.get('/analytics/attendance/at-risk', {
          params: { ...params, threshold: riskThreshold, minConsecutive: 3 },
        }),
      ]);

      if (ovRes.data.success) setOverview(ovRes.data.data);
      if (trRes.data.success) setTrends(trRes.data.data.trends || []);
      if (clRes.data.success) setClassComparisons(clRes.data.data || []);
      if (rkRes.data.success) setAtRiskData(rkRes.data.data);
    } catch (err) {
      console.error('Failed to load attendance analytics:', err);
      setError(err.response?.data?.message || 'Failed to load attendance analytics.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type) => {
    const params = new URLSearchParams();
    if (selectedClass) params.append('classId', selectedClass);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('type', type);

    const baseUrl = api.defaults.baseURL || '/api/v1';
    window.open(`${baseUrl}/analytics/attendance/export?${params.toString()}`, '_blank');
  };

  const metrics = overview?.metrics;
  const distribution = overview?.distribution || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <TrendingUp className="w-7 h-7 mr-2 text-sky-600" />
            Advanced Attendance Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Predictive attendance metrics, consecutive absence alerts, and multi-tier reporting.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchAllAnalytics}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4 mr-1 text-slate-500" />
            Refresh
          </button>
          <div className="relative inline-block text-left">
            <button
              onClick={() => handleExport('students')}
              className="inline-flex items-center px-3.5 py-2 border border-sky-600 text-sm font-semibold rounded-lg text-sky-600 bg-sky-50 hover:bg-sky-100 transition"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Class Filter</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Classes (School-wide)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} - {c.section}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Interval Grouping</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="daily">Daily Timeline</option>
            <option value="weekly">Weekly Rollup</option>
            <option value="monthly">Monthly Aggregate</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overall Rate
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {metrics.overallAttendanceRate}%
            </div>
            <div className="flex items-center text-xs mt-1">
              {metrics.trend === 'improvement' ? (
                <span className="text-emerald-600 flex items-center font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +{metrics.rateDelta}% vs prev
                </span>
              ) : metrics.trend === 'decline' ? (
                <span className="text-rose-600 flex items-center font-medium">
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> {metrics.rateDelta}% vs prev
                </span>
              ) : (
                <span className="text-slate-500 flex items-center font-medium">
                  <Minus className="w-3.5 h-3.5 mr-0.5" /> Steady vs prev
                </span>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Present Marks
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{metrics.presentCount}</div>
            <div className="text-xs text-slate-500 mt-1">{metrics.lateCount} marked late</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Absences Logged
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600">{metrics.absentCount}</div>
            <div className="text-xs text-rose-700 mt-1">Unexplained absences</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              Approved Leaves
            </div>
            <div className="mt-2 text-2xl font-bold text-indigo-600">
              {metrics.approvedLeaveDays}d
            </div>
            <div className="text-xs text-slate-500 mt-1">Authorized exemptions</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              At-Risk Students
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {atRiskData?.atRiskCount || 0}
            </div>
            <div className="text-xs text-amber-700 mt-1">
              {atRiskData?.criticalCount || 0} in critical tier
            </div>
          </div>
        </div>
      )}

      {/* Visual Analytics Grid: Trends & Class Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-sky-600" />
              Attendance Trend Curve ({interval})
            </h2>
            <span className="text-xs font-medium text-slate-500">Rate (%) over time</span>
          </div>

          <div className="h-64">
            {trends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No session records found for the selected interval.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                  <Tooltip
                    formatter={(val) => [`${val}%`, 'Attendance Rate']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="attendanceRate"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#rateGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Distribution Pie */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center">
            <PieIcon className="w-5 h-5 mr-2 text-indigo-600" />
            Attendance Composition
          </h2>

          <div className="h-64 flex flex-col justify-center">
            {distribution.every((d) => d.value === 0) ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No marked attendance records.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Class Comparison Bar Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center">
            <Users className="w-5 h-5 mr-2 text-sky-600" />
            Class-wise Attendance Benchmark
          </h2>
          <button
            onClick={() => handleExport('classes')}
            className="text-xs text-sky-600 font-semibold hover:underline flex items-center"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export Class Data
          </button>
        </div>

        <div className="h-60">
          {classComparisons.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              No class comparison data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classComparisons}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Attendance Rate']}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="attendanceRate" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* At-Risk Students Intelligence Register */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-amber-600" />
              At-Risk Student Register (Below {riskThreshold}% or $\ge$ 3 Consecutive Absences)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifies persistent truancy and chronic absenteeism for prompt guardian intervention.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-600">Threshold:</label>
            <select
              value={riskThreshold}
              onChange={(e) => setRiskThreshold(Number(e.target.value))}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-sky-500"
            >
              <option value="70">70% Attendance</option>
              <option value="75">75% Attendance (CBSE Standard)</option>
              <option value="80">80% Attendance</option>
              <option value="85">85% Attendance</option>
            </select>
            <button
              onClick={() => handleExport('at-risk')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Export Register
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <div className="w-7 h-7 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Analyzing risk patterns...
          </div>
        ) : !atRiskData || atRiskData.students.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 space-y-1">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="font-semibold text-slate-800">No At-Risk Students Detected</div>
            <p className="text-xs text-slate-400">All enrolled students maintain attendance above {riskThreshold}%.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Attendance Rate</th>
                  <th className="p-3">Consecutive Absences</th>
                  <th className="p-3">Exempt Leaves</th>
                  <th className="p-3">Risk Tier</th>
                  <th className="p-3">Guardian Contact</th>
                  <th className="p-3">Intervention Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {atRiskData.students.map((st) => (
                  <tr key={st.studentId} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{st.name}</div>
                      <div className="text-xs text-slate-400">Adm: {st.admissionNumber} | Roll: {st.rollNumber || 'N/A'}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-800">{st.class}</td>
                    <td className="p-3">
                      <span className={`font-bold ${st.attendanceRate < 60 ? 'text-rose-600' : 'text-amber-600'}`}>{st.attendanceRate}%</span>
                      <span className="text-xs text-slate-400 ml-1">({st.absentCount}/{st.totalSessions} absent)</span>
                    </td>
                    <td className="p-3">
                      {st.consecutiveAbsences >= 3 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                          <AlertOctagon className="w-3 h-3 mr-1 text-rose-600" />{st.consecutiveAbsences} days in a row
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">{st.consecutiveAbsences} days</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-700">{st.approvedLeaveDays} days</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${st.riskTier === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-200' : st.riskTier === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'}`}>
                        {st.riskTier}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="text-slate-800 font-medium">{st.guardianName || 'Guardian'}</div>
                      <div className="text-slate-400 flex items-center mt-0.5"><PhoneCall className="w-3 h-3 mr-1 text-slate-400" />{st.guardianPhone || 'No contact registered'}</div>
                    </td>
                    <td className="p-3 text-xs font-medium text-slate-700">{st.interventionRecommended}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
