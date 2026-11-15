import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  GraduationCap,
  HelpCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  X,
  XCircle,
  BarChart3,
  Calendar,
  ChevronRight,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'Critical Risk', bg: 'bg-red-50 text-red-700 border-red-200' },
  HIGH: { label: 'High Risk', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  MEDIUM: { label: 'Moderate Risk', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  LOW: { label: 'Low Risk', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const STATUS_CONFIG = {
  OPEN: { label: 'Open Case', bg: 'bg-red-100 text-red-800' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-100 text-amber-800' },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-100 text-emerald-800' },
  ESCALATED: { label: 'Escalated', bg: 'bg-purple-100 text-purple-800' },
};

export default function StudentPerformanceAnalytics() {
  const { user, isAdmin } = useAuth();
  const isTeacherOrAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  // Navigation tab
  const [activeTab, setActiveTab] = useState('atRisk'); // 'atRisk' | 'subjects' | 'correlation' | 'classes'

  // Data states
  const [overview, setOverview] = useState(null);
  const [subjectData, setSubjectData] = useState([]);
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [correlationData, setCorrelationData] = useState(null);
  const [classComparisons, setClassComparisons] = useState([]);
  const [trends, setTrends] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [search, setSearch] = useState('');
  const [thresholdPercentage, setThresholdPercentage] = useState(40);
  const [attendanceThreshold, setAttendanceThreshold] = useState(75);

  // Student Drilldown Modal
  const [showDrilldownModal, setShowDrilldownModal] = useState(false);
  const [drilldownData, setDrilldownData] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Intervention Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    studentId: '',
    type: 'ACADEMIC_DEFICIT',
    severity: 'MEDIUM',
    title: '',
    description: '',
    subject: '',
    actionPlan: '',
    baselinePercentage: '',
    targetPercentage: '60',
    followUpDate: '',
  });

  // Intervention Resolve Modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [activeIntervention, setActiveIntervention] = useState(null);
  const [resolveForm, setResolveForm] = useState({
    resolutionNotes: '',
    currentPercentage: '',
  });

  // Note Modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({ note: '', progressMetric: '' });

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Initial Load
  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchAllAnalytics();
  }, [selectedClassId, thresholdPercentage, attendanceThreshold, search]);

  const fetchMetadata = async () => {
    try {
      const res = await api.get('/classes');
      setClasses(res?.data?.classes || res?.data || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const fetchAllAnalytics = async () => {
    try {
      setLoading(true);
      const classParam = selectedClassId ? `&classId=${selectedClassId}` : '';

      const [overviewRes, subjectsRes, atRiskRes, correlationRes, classCompRes, intervRes, trendsRes] =
        await Promise.all([
          api.get(`/performance/overview?${classParam.replace('&', '')}`),
          api.get(`/performance/subjects?${classParam.replace('&', '')}`),
          api.get(
            `/performance/at-risk?thresholdPercentage=${thresholdPercentage}&attendanceThreshold=${attendanceThreshold}${search ? `&search=${encodeURIComponent(search)}` : ''}${classParam}`
          ),
          api.get(`/performance/correlation?${classParam.replace('&', '')}`),
          api.get('/performance/classes'),
          api.get(`/performance/interventions?${classParam.replace('&', '')}`),
          api.get(`/performance/trends?${classParam.replace('&', '')}`),
        ]);

      if (overviewRes?.data) setOverview(overviewRes.data);
      if (subjectsRes?.data) setSubjectData(subjectsRes.data);
      if (atRiskRes?.data) setAtRiskStudents(atRiskRes.data.students || []);
      if (correlationRes?.data) setCorrelationData(correlationRes.data);
      if (classCompRes?.data) setClassComparisons(classCompRes.data);
      if (intervRes?.data) setInterventions(intervRes.data.interventions || []);
      if (trendsRes?.data) setTrends(trendsRes.data);
    } catch (err) {
      console.error('Failed to fetch performance analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const openStudentDrilldown = async (studentId) => {
    try {
      setDrilldownLoading(true);
      setShowDrilldownModal(true);
      const res = await api.get(`/performance/students/${studentId}`);
      setDrilldownData(res.data);
    } catch (err) {
      alert(`Failed to load student drilldown: ${err.message}`);
      setShowDrilldownModal(false);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem('shiksha_token');
      const url = `/api/v1/performance/export${selectedClassId ? `?classId=${selectedClassId}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('CSV export failed.');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `performance_report_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleCreateInterventionSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.studentId || !createForm.title || !createForm.description) {
      alert('Please fill out student, title, and description.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/performance/interventions', {
        ...createForm,
        baselinePercentage: createForm.baselinePercentage ? Number(createForm.baselinePercentage) : null,
        targetPercentage: createForm.targetPercentage ? Number(createForm.targetPercentage) : null,
      });

      setSuccessMsg('Academic intervention initiated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowCreateModal(false);
      setCreateForm({
        studentId: '',
        type: 'ACADEMIC_DEFICIT',
        severity: 'MEDIUM',
        title: '',
        description: '',
        subject: '',
        actionPlan: '',
        baselinePercentage: '',
        targetPercentage: '60',
        followUpDate: '',
      });
      fetchAllAnalytics();
    } catch (err) {
      alert(`Failed to create intervention: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!activeIntervention) return;

    try {
      setSubmitting(true);
      await api.post(`/performance/interventions/${activeIntervention.id}/resolve`, resolveForm);
      setSuccessMsg('Intervention marked as RESOLVED.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowResolveModal(false);
      fetchAllAnalytics();
    } catch (err) {
      alert(`Failed to resolve intervention: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNoteSubmit = async (e) => {
    e.preventDefault();
    if (!activeIntervention || !noteForm.note.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/performance/interventions/${activeIntervention.id}/notes`, noteForm);
      setSuccessMsg('Progress note recorded.');
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowNoteModal(false);
      setNoteForm({ note: '', progressMetric: '' });
      fetchAllAnalytics();
    } catch (err) {
      alert(`Failed to add note: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClassSelectForIntervention = async (clsId) => {
    if (!clsId) {
      setStudents([]);
      return;
    }
    try {
      const res = await api.get(`/students?classId=${clsId}&limit=100`);
      setStudents(res?.data?.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  const initiateInterventionForStudent = (student) => {
    setCreateForm({
      studentId: student.studentId,
      type: student.scoreDrop >= 10 ? 'EXAM_DECLINE' : 'ACADEMIC_DEFICIT',
      severity: student.riskLevel || 'MEDIUM',
      title: `Remedial Plan for ${student.name}`,
      description: `Student current score is ${student.currentPercentage}%. Identified deficiencies in: ${student.failedSubjects.join(', ') || 'Overall coursework'}.`,
      subject: student.failedSubjects[0] || '',
      actionPlan: 'Provide focused remedial coaching, weekly practice exercises, and periodic check-ins.',
      baselinePercentage: String(student.currentPercentage),
      targetPercentage: '55',
      followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Activity size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Student Academic Performance & Early Intervention Intelligence
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Scholastic KPI benchmarks, at-risk student detection, attendance correlation, and remedial workflow.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {isTeacherOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus size={15} />
              <span>Create Intervention</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Average Score</span>
            <Award size={17} className="text-indigo-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-slate-900">{overview?.averagePercentage || 0}%</p>
            <span className="text-xs font-bold text-indigo-600">Grade {overview ? (overview.averagePercentage >= 80 ? 'A' : overview.averagePercentage >= 60 ? 'B' : 'C') : 'N/A'}</span>
          </div>
          <span className="text-[11px] text-slate-400">Evaluated students</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Overall Pass Rate</span>
            <CheckCircle2 size={17} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{overview?.overallPassRate || 0}%</p>
          <span className="text-[11px] text-emerald-700">Satisfactory standing</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">At-Risk Students</span>
            <ShieldAlert size={17} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{overview?.atRiskCount || atRiskStudents.length || 0}</p>
          <span className="text-[11px] text-red-700">Score &lt; 40% or drops</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">High Achievers</span>
            <GraduationCap size={17} className="text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-sky-600">{overview?.highAchieversCount || 0}</p>
          <span className="text-[11px] text-sky-700">Scoring ≥ 80%</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Interventions</span>
            <Clock size={17} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{overview?.activeInterventionsCount || interventions.length || 0}</p>
          <span className="text-[11px] text-amber-700">Remedial cases active</span>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('atRisk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'atRisk' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              At-Risk & Interventions ({atRiskStudents.length})
            </button>

            <button
              onClick={() => setActiveTab('subjects')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'subjects' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Subject Analysis
            </button>

            <button
              onClick={() => setActiveTab('correlation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'correlation' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Attendance Correlation
            </button>

            <button
              onClick={() => setActiveTab('classes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'classes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Class Benchmarks
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
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
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AT-RISK STUDENTS & REMEDIAL INTERVENTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'atRisk' && (
        <div className="space-y-6">
          {/* At-Risk Students Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">At-Risk Student Register</h2>
                <p className="text-[11px] text-slate-500">
                  Identified via academic deficit (&lt; {thresholdPercentage}%), score drops, or chronic absenteeism (&lt; {attendanceThreshold}%).
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
                {atRiskStudents.length} Students Flagged
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-xs">Scanning student academic performance...</p>
              </div>
            ) : atRiskStudents.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No At-Risk Students Detected</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  All active students in this cohort currently exceed academic and attendance risk thresholds.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Student & Class</th>
                      <th className="py-3 px-4">Risk Level</th>
                      <th className="py-3 px-4">Current Score</th>
                      <th className="py-3 px-4">Score Trend</th>
                      <th className="py-3 px-4">Attendance Rate</th>
                      <th className="py-3 px-4">Deficiencies</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {atRiskStudents.map((st) => {
                      const sev = SEVERITY_CONFIG[st.riskLevel] || SEVERITY_CONFIG.MEDIUM;

                      return (
                        <tr key={st.studentId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <button
                              onClick={() => openStudentDrilldown(st.studentId)}
                              className="font-bold text-indigo-600 hover:text-indigo-800 text-left block"
                            >
                              {st.name}
                            </button>
                            <span className="text-[10px] text-slate-400">
                              {st.className} &bull; Adm: {st.admissionNumber}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${sev.bg}`}>
                              {sev.label}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{st.currentPercentage}%</div>
                            <span className="text-[10px] text-slate-400 font-semibold">Grade {st.grade}</span>
                          </td>

                          <td className="py-3 px-4">
                            {st.scoreDrop > 0 ? (
                              <span className="inline-flex items-center text-red-600 font-bold text-[11px]">
                                <TrendingDown size={13} className="mr-0.5" />
                                <span>-{st.scoreDrop}% drop</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Stable</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className={`font-bold ${st.attendanceRate < 75 ? 'text-red-600' : 'text-slate-700'}`}>
                              {st.attendanceRate}%
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {st.attendanceRate < 75 ? 'Chronic absence' : 'Regular'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {st.failedSubjects.length > 0 ? (
                              <span className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-semibold">
                                Failed: {st.failedSubjects.join(', ')}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">Low Aggregate Average</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center space-x-1">
                              <button
                                onClick={() => openStudentDrilldown(st.studentId)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                              >
                                Drill Down
                              </button>

                              {isTeacherOrAdmin && (
                                <button
                                  onClick={() => initiateInterventionForStudent(st)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[11px] font-semibold transition"
                                >
                                  Intervene
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Interventions Station */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Remedial Academic Interventions Register</h2>
                <p className="text-[11px] text-slate-500">
                  Track ongoing remedial coaching, targeted assignments, and guardian consultations.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                {interventions.length} Case Records
              </span>
            </div>

            {interventions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active intervention cases logged yet. Click "Create Intervention" to record a case.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Student & Case Title</th>
                      <th className="py-3 px-4">Severity & Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Baseline vs Target</th>
                      <th className="py-3 px-4">Follow-Up Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {interventions.map((it) => {
                      const sev = SEVERITY_CONFIG[it.severity] || SEVERITY_CONFIG.MEDIUM;
                      const stat = STATUS_CONFIG[it.status] || STATUS_CONFIG.OPEN;

                      return (
                        <tr key={it.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{it.title}</span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {it.student?.name} &bull; {it.student?.class ? `${it.student.class.name}-${it.student.class.section}` : 'N/A'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${sev.bg}`}>
                                {sev.label}
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono">{it.type}</div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stat.bg}`}>
                              {stat.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-[11px]">
                            <div>
                              Base: <strong>{it.baselinePercentage || 0}%</strong> &rarr; Target: <strong className="text-emerald-600">{it.targetPercentage || 0}%</strong>
                            </div>
                            {it.currentPercentage && (
                              <span className="text-[10px] text-slate-400">Current: {it.currentPercentage}%</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-slate-500">
                            {it.followUpDate ? (
                              new Date(it.followUpDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            ) : (
                              <span className="text-slate-400">Not scheduled</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  setActiveIntervention(it);
                                  setShowNoteModal(true);
                                }}
                                title="Add Progress Note"
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                              >
                                Note
                              </button>

                              {isTeacherOrAdmin && it.status !== 'RESOLVED' && (
                                <button
                                  onClick={() => {
                                    setActiveIntervention(it);
                                    setResolveForm({
                                      resolutionNotes: '',
                                      currentPercentage: it.currentPercentage ? String(it.currentPercentage) : '',
                                    });
                                    setShowResolveModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-[11px] font-semibold transition"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUBJECT-WISE PERFORMANCE ANALYSIS */}
      {/* ========================================================================= */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          {/* Subject Average Score Chart */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Subject Average Score & Pass Rate Benchmark</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(val) => [`${val}%`, 'Average Score']}
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: 8, color: '#fff', fontSize: 11 }}
                  />
                  <Bar dataKey="averagePercentage" radius={[6, 6, 0, 0]}>
                    {subjectData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.averagePercentage >= 60 ? '#4F46E5' : entry.averagePercentage >= 40 ? '#F59E0B' : '#EF4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Subject Metrics Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Subject Performance Directory</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Evaluated</th>
                    <th className="py-3 px-4">Average Score</th>
                    <th className="py-3 px-4">Pass Rate</th>
                    <th className="py-3 px-4">Score Range</th>
                    <th className="py-3 px-4">Standard Deviation</th>
                    <th className="py-3 px-4 text-right">At-Risk Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {subjectData.map((s) => (
                    <tr key={s.subject} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.subject}</td>
                      <td className="py-3 px-4 text-slate-500">{s.totalEvaluated} students</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{s.averagePercentage}%</span>
                        <span className="text-[10px] text-indigo-600 font-semibold ml-1">({s.averageGrade})</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${s.passRate >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {s.passRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {s.lowestMarks} to {s.highestMarks} marks
                      </td>
                      <td className="py-3 px-4 text-slate-500">&plusmn;{s.standardDeviation}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${s.atRiskCount > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.atRiskCount} failing
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ATTENDANCE VS ACADEMIC CORRELATION */}
      {/* ========================================================================= */}
      {activeTab === 'correlation' && (
        <div className="space-y-6">
          {/* Pearson Correlation Metric Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                Statistical Correlation Engine
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">Pearson Correlation Coefficient (r)</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {correlationData?.relationshipDescription || 'Measuring relationship between attendance rates and test marks.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-center shrink-0">
              <span className="text-[10px] text-indigo-700 font-semibold block uppercase">Pearson (r)</span>
              <p className="text-3xl font-extrabold text-indigo-700">{correlationData?.pearsonCorrelation ?? 0}</p>
              <span className="text-[10px] text-indigo-600 font-medium">Range: -1.0 to +1.0</span>
            </div>
          </div>

          {/* Quartile Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {correlationData?.quartileBreakdown?.map((q) => (
              <div key={q.range} className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <span className="text-xs font-semibold text-slate-500 block">{q.range}</span>
                <p className="text-2xl font-bold text-slate-900">{q.averageAcademicScore}%</p>
                <div className="text-[11px] text-slate-400">
                  {q.studentsCount} students in bracket
                </div>
              </div>
            ))}
          </div>

          {/* Scatter Plot Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Attendance vs Test Score Matrix</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Class</th>
                    <th className="py-2.5 px-4">Attendance Rate</th>
                    <th className="py-2.5 px-4">Academic Score</th>
                    <th className="py-2.5 px-4 text-right">Scholastic Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {correlationData?.scatterPlot?.map((row) => (
                    <tr key={row.studentId} className="hover:bg-slate-50/70 transition">
                      <td className="py-2 px-4 font-semibold text-slate-900">{row.name}</td>
                      <td className="py-2 px-4 text-slate-500">{row.className}</td>
                      <td className="py-2 px-4">
                        <span className={`font-semibold ${row.attendance < 75 ? 'text-red-600' : 'text-slate-700'}`}>
                          {row.attendance}%
                        </span>
                      </td>
                      <td className="py-2 px-4 font-bold text-slate-900">{row.academic}%</td>
                      <td className="py-2 px-4 text-right font-bold text-indigo-600">{row.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CLASS BENCHMARKS */}
      {/* ========================================================================= */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Class & Grade Performance Comparison</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Class & Section</th>
                    <th className="py-3 px-4">Enrolled Students</th>
                    <th className="py-3 px-4">Average Score</th>
                    <th className="py-3 px-4">Overall Grade</th>
                    <th className="py-3 px-4">Pass Rate</th>
                    <th className="py-3 px-4 text-right">At-Risk Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {classComparisons.map((c) => (
                    <tr key={c.classId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.className}</td>
                      <td className="py-3 px-4 text-slate-500">{c.totalStudents} enrolled</td>
                      <td className="py-3 px-4 font-bold text-indigo-600">{c.averagePercentage}%</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                          {c.overallGrade}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-600">{c.passRate}%</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${c.atRiskCount > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {c.atRiskCount} flagged
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Student Performance Drilldown */}
      {/* ========================================================================= */}
      {showDrilldownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Student Performance Diagnostic</h3>
                <p className="text-xs text-slate-500">
                  {drilldownData?.student?.name} &bull; {drilldownData?.student?.className} &bull; Adm: {drilldownData?.student?.admissionNumber}
                </p>
              </div>
              <button onClick={() => setShowDrilldownModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            {drilldownLoading ? (
              <div className="p-12 text-center text-slate-400">Loading drilldown report...</div>
            ) : drilldownData ? (
              <div className="space-y-4 text-xs">
                {/* Metric Strip */}
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Cumulative Score:</span>
                    <strong className="text-base text-indigo-700">{drilldownData.performance.cumulativePercentage}%</strong>
                    <span className="text-[10px] text-slate-500 ml-1">({drilldownData.performance.cumulativeGrade})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Attendance Rate:</span>
                    <strong className={`text-base ${drilldownData.attendance.attendanceRate < 75 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {drilldownData.attendance.attendanceRate}%
                    </strong>
                    <span className="text-[10px] text-slate-500 ml-1">({drilldownData.attendance.presentCount}/{drilldownData.attendance.totalSessions})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Active Interventions:</span>
                    <strong className="text-base text-slate-900">{drilldownData.interventions.length}</strong>
                  </div>
                </div>

                {/* Examination History Breakdown */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs">Examination History & Subject Marks</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {drilldownData.performance.examinationHistory.map((ex) => (
                      <div key={ex.examinationId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{ex.examinationName}</span>
                          <span className="font-bold text-indigo-600">{ex.percentage}% (Grade {ex.grade})</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          {ex.subjects.map((sub) => (
                            <div key={sub.subject} className="p-1.5 bg-white rounded border border-slate-200">
                              <span className="text-slate-500 block truncate">{sub.subject}</span>
                              <strong className={sub.passed ? 'text-slate-800' : 'text-red-600'}>
                                {sub.marksObtained} / {sub.maxMarks}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Create Intervention */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Initiate Academic Remedial Intervention</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateInterventionSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Filter Class</label>
                  <select
                    onChange={(e) => handleClassSelectForIntervention(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}-{c.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Student *</label>
                  <select
                    value={createForm.studentId}
                    onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.admissionNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Intervention Type</label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACADEMIC_DEFICIT">Academic Deficit (Score &lt; 40%)</option>
                    <option value="EXAM_DECLINE">Grade Drop / Consecutive Decline</option>
                    <option value="ATTENDANCE_CORRELATION">Attendance & Absence Impact</option>
                    <option value="BEHAVIORAL">Classroom Engagement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Severity *</label>
                  <select
                    value={createForm.severity}
                    onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="CRITICAL">CRITICAL (Imminent Failure / Truancy)</option>
                    <option value="HIGH">HIGH (Noticeable Decline)</option>
                    <option value="MEDIUM">MEDIUM (Moderate Lag)</option>
                    <option value="LOW">LOW (Proactive Support)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Intervention Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Remedial Mathematics Mentoring"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Diagnosis & Description *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Specific academic challenges and root cause notes..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Action Plan & Tasks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 2 weekly tutoring sessions, extra homework review, guardian biweekly check-in..."
                  value={createForm.actionPlan}
                  onChange={(e) => setCreateForm({ ...createForm, actionPlan: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Score (%)</label>
                  <input
                    type="number"
                    value={createForm.targetPercentage}
                    onChange={(e) => setCreateForm({ ...createForm, targetPercentage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Follow-Up Date</label>
                  <input
                    type="date"
                    value={createForm.followUpDate}
                    onChange={(e) => setCreateForm({ ...createForm, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {submitting ? 'Creating...' : 'Initiate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Resolve Intervention */}
      {/* ========================================================================= */}
      {showResolveModal && activeIntervention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Resolve Academic Intervention</h3>
              <button onClick={() => setShowResolveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Close this remedial intervention case for <strong>{activeIntervention.student?.name}</strong>.
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Resolution Notes & Outcomes *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Student achieved 62% on re-examination. Satisfactory comprehension established."
                  value={resolveForm.resolutionNotes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Final Score Achieved (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 62"
                  value={resolveForm.currentPercentage}
                  onChange={(e) => setResolveForm({ ...resolveForm, currentPercentage: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {submitting ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Add Progress Note */}
      {/* ========================================================================= */}
      {showNoteModal && activeIntervention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Add Progress Note</h3>
              <button onClick={() => setShowNoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNoteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Progress Observation *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe progress during tutoring, homework submission, or guardian interaction..."
                  value={noteForm.note}
                  onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Updated Metric / Score (%)</label>
                <input
                  type="number"
                  placeholder="Optional score improvement metric..."
                  value={noteForm.progressMetric}
                  onChange={(e) => setNoteForm({ ...noteForm, progressMetric: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {submitting ? 'Saving...' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
