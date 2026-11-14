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
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
  CheckCircle2,
  ChevronDown,
  Info,
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
  const [activeTab, setActiveTab] = useState('insights'); // 'overview' | 'insights'

  // Overview states
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangeError, setRangeError] = useState('');

  // Student Insights states
  const [studentInsights, setStudentInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch overview analytics
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

  // Fetch student performance insights
  const fetchStudentInsights = async () => {
    try {
      setInsightsLoading(true);
      const params = {
        threshold,
        status: statusFilter,
      };
      if (selectedClassId) params.classId = selectedClassId;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/analytics/students', { params });
      setStudentInsights(res.data);
      setInsightsError('');
    } catch (err) {
      setInsightsError(err.message || 'Failed to load student performance insights.');
    } finally {
      setInsightsLoading(false);
    }
  };

  // Fetch classes for dropdown
  const fetchClasses = async () => {
    try {
      const res = await api.get('/classes');
      setClasses(res.data || []);
    } catch {
      // Ignore class fetch error in analytics
    }
  };

  // Fetch individual student details
  const fetchStudentDetail = async (studentId) => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/analytics/students/${studentId}`, {
        params: { threshold },
      });
      setSelectedStudentDetail(res.data);
    } catch (err) {
      alert(err.message || 'Failed to load student detail breakdown.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (activeTab === 'insights') {
      fetchStudentInsights();
    }
  }, [activeTab, threshold, statusFilter, selectedClassId]);

  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setRangeError('End date cannot be earlier than start date.');
      return;
    }
    setRangeError('');
    fetchAnalytics(startDate, endDate);
    if (activeTab === 'insights') {
      fetchStudentInsights();
    }
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

  return (
    <div className="space-y-6">
      {/* Header & Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <TrendingUp size={22} className="text-sky-600" />
            <span>Attendance Visual Analytics & Insights</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cohort comparisons, longitudinal trends, and student attendance early-warning insights
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'insights'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Student Performance Insights
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'overview'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview & Cohort Trends
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
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
      </div>

      {/* TAB 1: Student Performance Insights */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Controls Bar: Threshold, Class, Category, Search */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Threshold selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-700">RTE Threshold:</span>
                  <select
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={60}>60% (Lenient)</option>
                    <option value={70}>70% (Warning)</option>
                    <option value={75}>75% (RTE Mandatory)</option>
                    <option value={80}>80% (Strict)</option>
                    <option value={85}>85% (Distinction)</option>
                  </select>
                </div>

                {/* Class filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-700">Class:</span>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">All Classes</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}-{cls.section}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchStudentInsights()}
                    placeholder="Search student..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 w-48 sm:w-64"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchStudentInsights}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
              {[
                { id: 'ALL', label: 'All Students' },
                { id: 'CHRONIC_LOW', label: `Below ${threshold}% (At-Risk)` },
                { id: 'CONSISTENTLY_ABSENT', label: 'Consistently Absent (3+ streak)' },
                { id: 'IRREGULAR', label: 'Irregular Attendance' },
                { id: 'IMPROVING', label: 'Improving Trajectory' },
                { id: 'DECLINING', label: 'Declining Trajectory' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setStatusFilter(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    statusFilter === cat.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Overview Cards */}
          {studentInsights?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Analyzed
                </span>
                <strong className="text-xl font-black text-slate-900 block mt-1">
                  {studentInsights.summary.totalAnalyzed}
                </strong>
                <span className="text-[10px] text-slate-400">Enrolled Students</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Average Rate
                </span>
                <strong className="text-xl font-black text-indigo-600 block mt-1">
                  {studentInsights.summary.averageAttendance}%
                </strong>
                <span className="text-[10px] text-slate-400">Cohort Average</span>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 block">
                  Below {threshold}%
                </span>
                <strong className="text-xl font-black text-rose-700 block mt-1">
                  {studentInsights.summary.belowThresholdCount}
                </strong>
                <span className="text-[10px] text-rose-600">RTE Non-compliant</span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block">
                  Consistent Absent
                </span>
                <strong className="text-xl font-black text-amber-700 block mt-1">
                  {studentInsights.summary.consistentlyAbsentCount}
                </strong>
                <span className="text-[10px] text-amber-600">3+ Streak Absences</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">
                  Improving
                </span>
                <strong className="text-xl font-black text-emerald-700 block mt-1 flex items-center">
                  <span>{studentInsights.summary.improvingCount}</span>
                  <ArrowUpRight size={16} className="ml-1 text-emerald-600" />
                </strong>
                <span className="text-[10px] text-emerald-600">+8% Recent Gain</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block">
                  Declining
                </span>
                <strong className="text-xl font-black text-slate-700 block mt-1 flex items-center">
                  <span>{studentInsights.summary.decliningCount}</span>
                  <ArrowDownRight size={16} className="ml-1 text-rose-500" />
                </strong>
                <span className="text-[10px] text-slate-500">Needs Attention</span>
              </div>
            </div>
          )}

          {/* Student Table */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Student Attendance Intelligence</h2>
                <p className="text-xs text-slate-500">
                  Individual percentages, longitudinal trajectory indicators, and attendance recommendations
                </p>
              </div>
              <button
                onClick={fetchStudentInsights}
                className="flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <RefreshCw size={12} className={insightsLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {insightsLoading ? (
              <div className="py-16 text-center">
                <RefreshCw className="animate-spin h-7 w-7 text-sky-600 mx-auto" />
                <span className="text-xs text-slate-500 mt-2 block">Analyzing attendance patterns...</span>
              </div>
            ) : insightsError ? (
              <div className="py-8 text-center text-xs text-rose-600 font-semibold">{insightsError}</div>
            ) : studentInsights?.students?.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Info size={28} className="mx-auto text-slate-400" />
                <p className="text-sm font-bold text-slate-700">No students match the current filters</p>
                <p className="text-xs text-slate-400">Try adjusting the threshold, class, or search query.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-700 font-bold">
                      <th className="py-3 px-3">Student Name</th>
                      <th className="py-3 px-3">Class</th>
                      <th className="py-3 px-3">Attendance Rate</th>
                      <th className="py-3 px-3">Sessions (P / L / A)</th>
                      <th className="py-3 px-3">Trajectory</th>
                      <th className="py-3 px-3">Status Category</th>
                      <th className="py-3 px-3">Key Insight</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {studentInsights.students.map((s) => (
                      <tr key={s.studentId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{s.name}</span>
                          <span className="text-[10px] text-slate-400">
                            Adm: {s.admissionNumber} {s.rollNumber ? `• Roll: ${s.rollNumber}` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {s.class?.name}-{s.class?.section}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`font-black text-xs px-2 py-0.5 rounded-full ${
                                s.attendanceRate >= 85
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.attendanceRate >= threshold
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {s.attendanceRate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600">
                          <span className="text-emerald-700 font-semibold">{s.presentCount}P</span> /{' '}
                          <span className="text-amber-700 font-semibold">{s.lateCount}L</span> /{' '}
                          <span className="text-rose-700 font-semibold">{s.absentCount}A</span>
                          <span className="text-slate-400 block text-[10px]">Total: {s.totalSessions}</span>
                        </td>
                        <td className="py-3 px-3">
                          {s.trend.direction === 'IMPROVING' ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 text-[11px] font-bold">
                              <ArrowUpRight size={14} />
                              <span>+{s.trend.changePercent}%</span>
                            </span>
                          ) : s.trend.direction === 'DECLINING' ? (
                            <span className="inline-flex items-center space-x-1 text-rose-700 text-[11px] font-bold">
                              <ArrowDownRight size={14} />
                              <span>{s.trend.changePercent}%</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-slate-500 text-[11px] font-semibold">
                              <Minus size={14} />
                              <span>Stable</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              s.statusCategory === 'CONSISTENTLY_ABSENT'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : s.statusCategory === 'CHRONIC_LOW'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : s.statusCategory === 'IRREGULAR'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : s.statusCategory === 'DECLINING'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {s.statusCategory.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs text-[11px] text-slate-600">
                          {s.insights[0] || 'Regular attendance observed.'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => fetchStudentDetail(s.studentId)}
                            className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-lg text-[11px] transition"
                          >
                            View Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Student Detail Modal */}
          {selectedStudentDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedStudentDetail.student.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Class {selectedStudentDetail.student.class.name}-{selectedStudentDetail.student.class.section} &bull; Adm: {selectedStudentDetail.student.admissionNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentDetail(null)}
                    className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Day of Week Attendance Profile */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Day-of-Week Attendance Profile</h4>
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    {selectedStudentDetail.dayOfWeekAnalytics.map((d) => (
                      <div key={d.dayOfWeek} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">{d.dayName.slice(0, 3)}</span>
                        <strong className="text-sm font-black text-slate-800 block mt-1">{d.attendanceRate}%</strong>
                        <span className="text-[10px] text-slate-500">{d.presentCount}/{d.totalSessions} days</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Academic & Welfare Action Items</h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {selectedStudentDetail.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start space-x-2 bg-sky-50/60 p-2.5 rounded-xl border border-sky-100">
                        <CheckCircle2 size={14} className="text-sky-600 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentDetail(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Overview & Cohort Trends */}
      {activeTab === 'overview' && data && (
        <>
          {/* Row 1: Bar Chart (Class Comparison) & Pie Chart (Headcount Distribution) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Grade-wise Headcount Distribution</h2>
                  <p className="text-xs text-slate-500">Present vs Absent students across classes</p>
                </div>
                <span className="text-xs font-bold text-slate-600 px-2 py-0.5 rounded bg-slate-100">
                  {data.overview?.dateRange?.isCustomRange ? 'Filtered Range' : "Today's Sessions"}
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.classBreakdown}>
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

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-1">
                  {data.overview?.dateRange?.isCustomRange ? 'Period Headcount Ratio' : "Today's Headcount Ratio"}
                </h2>
                <p className="text-xs text-slate-500 mb-4">Overall distribution of attendance statuses</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: data.overview.todayPresent },
                          { name: 'Late', value: data.overview.todayLate },
                          { name: 'Absent', value: data.overview.todayAbsent },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {[0, 1, 2].map((idx) => (
                          <Cell key={`cell-${idx}`} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
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
                  <strong className="text-sm font-black text-emerald-700">{data.overview.todayPresent}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-700 font-bold block">Late</span>
                  <strong className="text-sm font-black text-amber-700">{data.overview.todayLate}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-rose-700 font-bold block">Absent</span>
                  <strong className="text-sm font-black text-rose-700">{data.overview.todayAbsent}</strong>
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
                  {data.overview?.dateRange?.isCustomRange
                    ? `Trend across ${data.overview.dateRange.startDate} to ${data.overview.dateRange.endDate}`
                    : 'Longitudinal attendance trend across all enrolled cohorts'}
                </p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend}>
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
