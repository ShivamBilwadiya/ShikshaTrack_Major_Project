import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  Download,
  FileText,
  User,
  X,
  RefreshCw,
  AlertOctagon,
  ChevronRight,
  Shield,
  EyeOff,
  History,
} from 'lucide-react';

export default function StudentIncidentManagement() {
  const { user, isAdmin } = useAuth();

  // Data states
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Record Form
  const [recordForm, setRecordForm] = useState({
    classId: '',
    studentId: '',
    title: '',
    description: '',
    category: 'BEHAVIOUR',
    severity: 'MEDIUM',
    actionTaken: '',
    isPrivate: false,
  });

  // Action / Resolution Form
  const [statusForm, setStatusForm] = useState({
    status: '',
    actionTaken: '',
    resolutionNotes: '',
  });

  const [newActionNote, setNewActionNote] = useState('');

  useEffect(() => {
    fetchClasses();
    fetchIncidentData();
  }, [selectedClass, categoryFilter, severityFilter, statusFilter]);

  useEffect(() => {
    if (recordForm.classId) {
      fetchStudentsForClass(recordForm.classId);
    } else {
      setStudents([]);
    }
  }, [recordForm.classId]);

  const fetchClasses = async () => {
    try {
      const res = await api.get('/classes');
      if (res.data.success) {
        setClasses(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  };

  const fetchStudentsForClass = async (classId) => {
    try {
      const res = await api.get(`/students?classId=${classId}`);
      if (res.data.success) {
        setStudents(res.data.data.students || res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch class students:', err);
    }
  };

  const fetchIncidentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedClass) params.classId = selectedClass;
      if (categoryFilter) params.category = categoryFilter;
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;

      const [listRes, summaryRes] = await Promise.all([
        api.get('/incidents', { params }),
        api.get('/incidents/summary', { params: { classId: selectedClass || undefined } }),
      ]);

      if (listRes.data.success) {
        setIncidents(listRes.data.data.incidents || []);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load incidents:', err);
      setError(err.response?.data?.message || 'Failed to load incident records.');
    } finally {
      setLoading(false);
    }
  };

  const filteredIncidents = useMemo(() => {
    if (!searchQuery.trim()) return incidents;
    const q = searchQuery.toLowerCase();
    return incidents.filter(
      (i) =>
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.student?.name?.toLowerCase().includes(q) ||
        i.student?.admissionNumber?.toLowerCase().includes(q)
    );
  }, [incidents, searchQuery]);

  // Submit Incident Form
  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/incidents', {
        classId: recordForm.classId,
        studentId: recordForm.studentId,
        title: recordForm.title,
        description: recordForm.description,
        category: recordForm.category,
        severity: recordForm.severity,
        actionTaken: recordForm.actionTaken || undefined,
        isPrivate: recordForm.isPrivate,
      });

      if (res.data.success) {
        setSuccessMsg('Incident record logged successfully.');
        setShowRecordModal(false);
        setRecordForm({
          classId: '',
          studentId: '',
          title: '',
          description: '',
          category: 'BEHAVIOUR',
          severity: 'MEDIUM',
          actionTaken: '',
          isPrivate: false,
        });
        fetchIncidentData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record incident.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Action Modal
  const handleOpenActionModal = async (incident) => {
    try {
      const res = await api.get(`/incidents/${incident.id}`);
      if (res.data.success) {
        setActiveIncident(res.data.data);
        setStatusForm({
          status: res.data.data.status,
          actionTaken: res.data.data.actionTaken || '',
          resolutionNotes: res.data.data.resolutionNotes || '',
        });
        setNewActionNote('');
        setShowActionModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch incident details.');
    }
  };

  // Update Status & Resolution
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!activeIncident) return;

    setFormSubmitting(true);
    try {
      const res = await api.patch(`/incidents/${activeIncident.id}/status`, {
        status: statusForm.status,
        actionTaken: statusForm.actionTaken,
        resolutionNotes: statusForm.resolutionNotes,
      });

      if (res.data.success) {
        setSuccessMsg('Incident status and notes updated.');
        setShowActionModal(false);
        fetchIncidentData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update incident.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Add Action Note
  const handleAddActionNote = async () => {
    if (!newActionNote.trim() || !activeIncident) return;
    try {
      const res = await api.post(`/incidents/${activeIncident.id}/actions`, {
        action: 'NOTE_ADDED',
        notes: newActionNote.trim(),
      });
      if (res.data.success) {
        // Refresh active incident details
        const updated = await api.get(`/incidents/${activeIncident.id}`);
        if (updated.data.success) {
          setActiveIncident(updated.data.data);
        }
        setNewActionNote('');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add action note.');
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedClass) params.append('classId', selectedClass);
    if (categoryFilter) params.append('category', categoryFilter);
    if (severityFilter) params.append('severity', severityFilter);
    if (statusFilter) params.append('status', statusFilter);

    const exportUrl = `${api.defaults.baseURL || '/api/v1'}/incidents/export?${params.toString()}`;
    window.open(exportUrl, '_blank');
  };

  // Badges
  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertOctagon className="w-3 h-3 mr-1 text-rose-600" />
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
            <AlertTriangle className="w-3 h-3 mr-1 text-orange-600" />
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            {status}
          </span>
        );
      case 'UNDER_INVESTIGATION':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
            <Clock className="w-3 h-3 mr-1 text-sky-600" />
            Under Investigation
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
            Reported
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <ShieldAlert className="w-7 h-7 mr-2 text-rose-600" />
            Student Incident & Discipline Register
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track student disciplinary events, behavioural notes, safety logs, and resolution audits.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchIncidentData}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4 mr-1 text-slate-500" />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={() => setShowRecordModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Incident
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-rose-600" />
            {error}
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-rose-600 hover:text-rose-800" />
          </button>
        </div>
      )}

      {/* Analytics Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Incidents
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.totalIncidents}</div>
            <div className="text-xs text-slate-500 mt-1">Recorded this academic term</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Active / Open Cases
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{summary.activeIncidents}</div>
            <div className="text-xs text-amber-700 mt-1">Pending investigation or action</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              High / Critical Severity
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600">{summary.criticalIncidents}</div>
            <div className="text-xs text-rose-700 mt-1">Requires immediate intervention</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Resolution Rate
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{summary.resolutionRate}%</div>
            <div className="text-xs text-emerald-700 mt-1">{summary.resolvedIncidents} cases resolved</div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search incident, student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Class Filter */}
        <div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} - {c.section}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Categories</option>
            <option value="BEHAVIOUR">Behaviour</option>
            <option value="ATTENDANCE">Attendance Habit</option>
            <option value="ACADEMIC">Academic Disciplinary</option>
            <option value="SAFETY">Safety Hazard</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Severities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Main Incidents Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading incident records...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Shield className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="text-base font-semibold text-slate-800">No disciplinary incidents found</div>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              There are no incident records matching your selected filter options.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Title & Summary</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIncidents.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 whitespace-nowrap text-xs text-slate-500">
                      {new Date(i.incidentDate).toISOString().split('T')[0]}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 flex items-center">
                        {i.student?.name}
                        {i.isPrivate && (
                          <span
                            title="Confidential Administrative Record"
                            className="ml-1.5 inline-block text-amber-600"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Adm: {i.student?.admissionNumber} | Roll: {i.student?.rollNumber || 'N/A'}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-slate-800">
                        {i.class ? `${i.class.name}-${i.class.section}` : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {i.category}
                      </span>
                    </td>
                    <td className="p-3">{getSeverityBadge(i.severity)}</td>
                    <td className="p-3 max-w-xs">
                      <div className="font-semibold text-slate-900 truncate" title={i.title}>
                        {i.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate" title={i.description}>
                        {i.description}
                      </div>
                    </td>
                    <td className="p-3">{getStatusBadge(i.status)}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenActionModal(i)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
                      >
                        Manage & Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Incident Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-rose-600" />
                Record Student Disciplinary Incident
              </h2>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Class *
                  </label>
                  <select
                    required
                    value={recordForm.classId}
                    onChange={(e) => setRecordForm({ ...recordForm, classId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student *
                  </label>
                  <select
                    required
                    disabled={!recordForm.classId}
                    value={recordForm.studentId}
                    onChange={(e) => setRecordForm({ ...recordForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
                  >
                    <option value="">Select Student</option>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={recordForm.category}
                    onChange={(e) => setRecordForm({ ...recordForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="BEHAVIOUR">Behaviour Disruption</option>
                    <option value="ATTENDANCE">Attendance Habit / Bunking</option>
                    <option value="ACADEMIC">Academic Malpractice</option>
                    <option value="SAFETY">Safety Protocol Violation</option>
                    <option value="OTHER">Other Disciplinary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Severity *
                  </label>
                  <select
                    required
                    value={recordForm.severity}
                    onChange={(e) => setRecordForm({ ...recordForm, severity: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="LOW">Low (Minor Warning)</option>
                    <option value="MEDIUM">Medium (Moderate Action)</option>
                    <option value="HIGH">High (Parent Escorted)</option>
                    <option value="CRITICAL">Critical (Immediate Suspension/Hearing)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Insubordination in laboratory, persistent tardiness"
                  value={recordForm.title}
                  onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="Document specific details, witness accounts, and surrounding circumstances..."
                  value={recordForm.description}
                  onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Immediate Action Taken (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verbal reprimand, separated seating, sent to principal"
                  value={recordForm.actionTaken}
                  onChange={(e) => setRecordForm({ ...recordForm, actionTaken: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {isAdmin && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPrivateCheck"
                    checked={recordForm.isPrivate}
                    onChange={(e) => setRecordForm({ ...recordForm, isPrivate: e.target.checked })}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="isPrivateCheck" className="text-xs font-medium text-slate-700 flex items-center">
                    <EyeOff className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Mark as Confidential Administrative Incident (Hidden from general staff)
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                >
                  {formSubmitting ? 'Recording...' : 'Record Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action / Resolution / Timeline Modal */}
      {showActionModal && activeIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center">
                  <ShieldAlert className="w-5 h-5 mr-2 text-rose-600" />
                  Manage Incident #{activeIncident.id.slice(0, 8)}
                </h2>
                <div className="text-xs text-slate-500">
                  Student: {activeIncident.student?.name} (Adm: {activeIncident.student?.admissionNumber})
                </div>
              </div>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Incident Summary Card */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm border border-slate-200">
              <div className="flex justify-between">
                <span className="font-bold text-slate-900">{activeIncident.title}</span>
                <div className="space-x-1">
                  {getSeverityBadge(activeIncident.severity)}
                  {getStatusBadge(activeIncident.status)}
                </div>
              </div>
              <p className="text-slate-700 text-xs">{activeIncident.description}</p>
              <div className="text-[11px] text-slate-500 pt-1 flex justify-between border-t border-slate-200">
                <span>
                  Reported by: {activeIncident.reportedBy?.name || 'Staff'} on{' '}
                  {new Date(activeIncident.incidentDate).toISOString().split('T')[0]}
                </span>
                {activeIncident.resolvedBy && (
                  <span>Resolved by: {activeIncident.resolvedBy.name}</span>
                )}
              </div>
            </div>

            {/* Action History Timeline */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <History className="w-4 h-4 mr-1 text-slate-500" />
                Audit Trail & Action Timeline
              </h3>
              <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
                {activeIncident.history && activeIncident.history.length > 0 ? (
                  activeIncident.history.map((h) => (
                    <div key={h.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{h.action}</span>
                        <span className="text-slate-400 font-normal">
                          {new Date(h.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{h.notes}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-center py-2">No timeline notes yet.</div>
                )}
              </div>

              {/* Add Note Bar */}
              <div className="flex space-x-2 pt-1">
                <input
                  type="text"
                  placeholder="Log progressive action note, counselling summary, or parent interaction..."
                  value={newActionNote}
                  onChange={(e) => setNewActionNote(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={handleAddActionNote}
                  disabled={!newActionNote.trim()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  Add Note
                </button>
              </div>
            </div>

            {/* Status Update & Resolution Form */}
            <form onSubmit={handleStatusSubmit} className="space-y-3 pt-3 border-t">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Update Case Status & Resolution
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Incident Status
                  </label>
                  <select
                    value={statusForm.status}
                    onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="REPORTED">Reported</option>
                    <option value="UNDER_INVESTIGATION">Under Investigation</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Actions Taken
                  </label>
                  <input
                    type="text"
                    placeholder="Disciplinary measures or interventions"
                    value={statusForm.actionTaken}
                    onChange={(e) => setStatusForm({ ...statusForm, actionTaken: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Final Resolution Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Record summary of outcome, agreement, or student improvement commitments..."
                  value={statusForm.resolutionNotes}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, resolutionNotes: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                >
                  {formSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
