import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Download,
  FileText,
  Calendar,
  User,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export default function LeaveManagement() {
  const { user, isAdmin } = useAuth();

  // Data states
  const [leaves, setLeaves] = useState([]);
  const [summary, setSummary] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filter states
  const [selectedClass, setSelectedClass] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection
  const [selectedLeaveIds, setSelectedLeaveIds] = useState([]);

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedLeaveForReview, setSelectedLeaveForReview] = useState(null);
  const [reviewAction, setReviewAction] = useState('APPROVED');
  const [reviewRemarks, setReviewRemarks] = useState('');

  // Bulk review modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState('APPROVED');
  const [bulkRemarks, setBulkRemarks] = useState('');

  // Details Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeDetailLeave, setActiveDetailLeave] = useState(null);

  // New Leave Form State
  const [applyForm, setApplyForm] = useState({
    classId: '',
    studentId: '',
    leaveType: 'SICK',
    startDate: '',
    endDate: '',
    reason: '',
    documentUrl: '',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch initial classes and data
  useEffect(() => {
    fetchClasses();
    fetchLeaveData();
  }, [selectedClass, statusFilter, typeFilter]);

  // Load students when class selected in form
  useEffect(() => {
    if (applyForm.classId) {
      fetchStudentsForClass(applyForm.classId);
    } else {
      setStudents([]);
    }
  }, [applyForm.classId]);

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

  const fetchLeaveData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedClass) params.classId = selectedClass;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.leaveType = typeFilter;

      const [listRes, summaryRes] = await Promise.all([
        api.get('/leaves', { params }),
        api.get('/leaves/summary', { params: { classId: selectedClass || undefined } }),
      ]);

      if (listRes.data.success) {
        setLeaves(listRes.data.data.leaves || []);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
      setError(err.response?.data?.message || 'Failed to load leave applications.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered leaves by search query
  const filteredLeaves = useMemo(() => {
    if (!searchQuery.trim()) return leaves;
    const q = searchQuery.toLowerCase();
    return leaves.filter(
      (l) =>
        l.student?.name?.toLowerCase().includes(q) ||
        l.student?.admissionNumber?.toLowerCase().includes(q) ||
        l.reason?.toLowerCase().includes(q)
    );
  }, [leaves, searchQuery]);

  // Bulk selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pendingIds = filteredLeaves.filter((l) => l.status === 'PENDING').map((l) => l.id);
      setSelectedLeaveIds(pendingIds);
    } else {
      setSelectedLeaveIds([]);
    }
  };

  const toggleSelectLeave = (id) => {
    setSelectedLeaveIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Submit Application
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/leaves', {
        classId: applyForm.classId,
        studentId: applyForm.studentId,
        leaveType: applyForm.leaveType,
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        reason: applyForm.reason,
        documentUrl: applyForm.documentUrl || undefined,
      });

      if (res.data.success) {
        setSuccessMsg('Leave application recorded successfully.');
        setShowApplyModal(false);
        setApplyForm({
          classId: '',
          studentId: '',
          leaveType: 'SICK',
          startDate: '',
          endDate: '',
          reason: '',
          documentUrl: '',
        });
        fetchLeaveData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit leave application.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Single Review Submit
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeaveForReview || !reviewRemarks.trim()) return;

    setFormSubmitting(true);
    try {
      const res = await api.post(`/leaves/${selectedLeaveForReview.id}/review`, {
        action: reviewAction,
        remarks: reviewRemarks.trim(),
      });

      if (res.data.success) {
        setSuccessMsg(`Leave successfully ${reviewAction.toLowerCase()}.`);
        setShowReviewModal(false);
        setSelectedLeaveForReview(null);
        setReviewRemarks('');
        fetchLeaveData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to review leave.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Bulk Review Submit
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (selectedLeaveIds.length === 0 || !bulkRemarks.trim()) return;

    setFormSubmitting(true);
    try {
      const res = await api.post('/leaves/bulk-review', {
        leaveIds: selectedLeaveIds,
        action: bulkAction,
        remarks: bulkRemarks.trim(),
      });

      if (res.data.success) {
        setSuccessMsg(
          `Bulk processed: ${res.data.data.successful.length} successful, ${res.data.data.failed.length} failed.`
        );
        setShowBulkModal(false);
        setSelectedLeaveIds([]);
        setBulkRemarks('');
        fetchLeaveData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process bulk review.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Cancel Leave
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave application?')) return;
    try {
      const res = await api.post(`/leaves/${leaveId}/cancel`, {
        reason: 'Cancelled by user.',
      });
      if (res.data.success) {
        setSuccessMsg('Leave application cancelled.');
        fetchLeaveData();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel leave.');
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedClass) params.append('classId', selectedClass);
    if (statusFilter) params.append('status', statusFilter);
    if (typeFilter) params.append('leaveType', typeFilter);

    const exportUrl = `${api.defaults.baseURL || '/api/v1'}/leaves/export?${params.toString()}`;
    window.open(exportUrl, '_blank');
  };

  // Type & Status styling helpers
  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" />
            Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            Pending Review
          </span>
        );
    }
  };

  const getTypeBadge = (type) => {
    const colors = {
      SICK: 'bg-blue-50 text-blue-700 border-blue-200',
      FAMILY: 'bg-purple-50 text-purple-700 border-purple-200',
      PERSONAL: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      EMERGENCY: 'bg-red-50 text-red-700 border-red-200',
      OTHER: 'bg-slate-50 text-slate-700 border-slate-200',
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${
          colors[type] || colors.OTHER
        }`}
      >
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <CalendarCheck className="w-7 h-7 mr-2 text-sky-600" />
            Student Leave & Attendance Workflow
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage student absence approvals, attendance exemptions, and review audit trail.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchLeaveData}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
            title="Refresh records"
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
            onClick={() => setShowApplyModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Apply Leave
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
            <AlertCircle className="w-5 h-5 mr-2 text-rose-600" />
            {error}
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-rose-600 hover:text-rose-800" />
          </button>
        </div>
      )}

      {/* Analytics Summary Metric Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Applications
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.totalApplications}</div>
            <div className="text-xs text-slate-500 mt-1">Recorded this term</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Pending Review
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{summary.pendingCount}</div>
            <div className="text-xs text-amber-700 mt-1">Awaiting decision</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Approved Leaves
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{summary.approvedCount}</div>
            <div className="text-xs text-emerald-700 mt-1">{summary.totalApprovedDays} days approved</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Rejected Leaves
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600">{summary.rejectedCount}</div>
            <div className="text-xs text-slate-500 mt-1">{summary.cancelledCount} cancelled</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-sky-600 uppercase tracking-wider">
              Approval Rate
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-600">{summary.approvalRate}%</div>
            <div className="text-xs text-slate-500 mt-1">Legitimate absences</div>
          </div>
        </div>
      )}

      {/* Filter and Bulk Action Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search student or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Leave Types</option>
              <option value="SICK">Sick Leave</option>
              <option value="FAMILY">Family Function</option>
              <option value="PERSONAL">Personal Reason</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar (Visible when items selected) */}
        {selectedLeaveIds.length > 0 && (
          <div className="flex items-center justify-between bg-sky-50 border border-sky-200 px-4 py-2.5 rounded-lg">
            <span className="text-sm font-medium text-sky-900">
              {selectedLeaveIds.length} application(s) selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setBulkAction('APPROVED');
                  setShowBulkModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Bulk Approve
              </button>
              <button
                onClick={() => {
                  setBulkAction('REJECTED');
                  setShowBulkModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-700"
              >
                Bulk Reject
              </button>
              <button
                onClick={() => setSelectedLeaveIds([])}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading leave applications...
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="text-base font-semibold text-slate-800">No leave applications found</div>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              There are no student leave applications matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedLeaveIds.length > 0 &&
                        selectedLeaveIds.length ===
                          filteredLeaves.filter((l) => l.status === 'PENDING').length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Days</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-center">
                      {l.status === 'PENDING' ? (
                        <input
                          type="checkbox"
                          checked={selectedLeaveIds.includes(l.id)}
                          onChange={() => toggleSelectLeave(l.id)}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{l.student?.name}</div>
                      <div className="text-xs text-slate-400">
                        Adm: {l.student?.admissionNumber} | Roll: {l.student?.rollNumber || 'N/A'}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-slate-800">
                        {l.class ? `${l.class.name}-${l.class.section}` : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3">{getTypeBadge(l.leaveType)}</td>
                    <td className="p-3 text-xs text-slate-600">
                      <div>{new Date(l.startDate).toISOString().split('T')[0]}</div>
                      <div className="text-slate-400">to {new Date(l.endDate).toISOString().split('T')[0]}</div>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{l.totalDays}d</td>
                    <td className="p-3 max-w-xs">
                      <div className="truncate text-slate-800" title={l.reason}>
                        {l.reason}
                      </div>
                      {l.documentUrl && (
                        <a
                          href={l.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs text-sky-600 hover:underline mt-0.5"
                        >
                          <ExternalLink className="w-3 h-3 mr-0.5" />
                          View Document
                        </a>
                      )}
                    </td>
                    <td className="p-3">{getStatusBadge(l.status)}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      {l.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedLeaveForReview(l);
                              setReviewAction('APPROVED');
                              setReviewRemarks('');
                              setShowReviewModal(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleCancelLeave(l.id)}
                            className="px-2 py-1 text-xs text-slate-500 hover:text-rose-600 transition"
                            title="Cancel Leave"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveDetailLeave(l);
                            setShowDetailModal(true);
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
                        >
                          Audit Log
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <CalendarCheck className="w-5 h-5 mr-2 text-sky-600" />
                Submit Student Leave Application
              </h2>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Class *
                  </label>
                  <select
                    required
                    value={applyForm.classId}
                    onChange={(e) => setApplyForm({ ...applyForm, classId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
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
                    disabled={!applyForm.classId}
                    value={applyForm.studentId}
                    onChange={(e) => setApplyForm({ ...applyForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Leave Category *
                </label>
                <select
                  required
                  value={applyForm.leaveType}
                  onChange={(e) => setApplyForm({ ...applyForm, leaveType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="SICK">Sick Leave</option>
                  <option value="FAMILY">Family Occasion</option>
                  <option value="PERSONAL">Personal Absence</option>
                  <option value="EMERGENCY">Emergency / Urgent Matter</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={applyForm.startDate}
                    onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={applyForm.endDate}
                    onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Absence *
                </label>
                <textarea
                  required
                  rows="3"
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  placeholder="Detail the circumstances justifying absence..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supporting Document URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://cloud-storage.com/medical_slip.pdf"
                  value={applyForm.documentUrl}
                  onChange={(e) => setApplyForm({ ...applyForm, documentUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50"
                >
                  {formSubmitting ? 'Submitting...' : 'Submit Leave Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Leave Modal */}
      {showReviewModal && selectedLeaveForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Review Leave Application</h2>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
              <div>
                <span className="font-semibold text-slate-700">Student: </span>
                {selectedLeaveForReview.student?.name} (Adm:{' '}
                {selectedLeaveForReview.student?.admissionNumber})
              </div>
              <div>
                <span className="font-semibold text-slate-700">Duration: </span>
                {new Date(selectedLeaveForReview.startDate).toISOString().split('T')[0]} to{' '}
                {new Date(selectedLeaveForReview.endDate).toISOString().split('T')[0]} (
                {selectedLeaveForReview.totalDays} days)
              </div>
              <div>
                <span className="font-semibold text-slate-700">Reason: </span>
                {selectedLeaveForReview.reason}
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewAction('APPROVED')}
                    className={`py-2 px-3 text-sm font-semibold rounded-lg border flex items-center justify-center ${
                      reviewAction === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('REJECTED')}
                    className={`py-2 px-3 text-sm font-semibold rounded-lg border flex items-center justify-center ${
                      reviewAction === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Remarks / Justification *
                </label>
                <textarea
                  required
                  rows="3"
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Mandatory notes for the decision audit trail..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !reviewRemarks.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Review Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Bulk {bulkAction === 'APPROVED' ? 'Approve' : 'Reject'} Applications
              </h2>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              You are about to <strong>{bulkAction.toLowerCase()}</strong> {selectedLeaveIds.length}{' '}
              selected applications. This action is recorded in the audit trail.
            </p>

            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bulk Review Remarks *
                </label>
                <textarea
                  required
                  rows="3"
                  value={bulkRemarks}
                  onChange={(e) => setBulkRemarks(e.target.value)}
                  placeholder="Provide remark for bulk decision..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !bulkRemarks.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50"
                >
                  {formSubmitting ? 'Processing...' : 'Apply Bulk Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit & Decision Details Modal */}
      {showDetailModal && activeDetailLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Leave Decision Audit History</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Student:</span>
                <span className="font-semibold text-slate-800">
                  {activeDetailLeave.student?.name} ({activeDetailLeave.student?.admissionNumber})
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Current Status:</span>
                <div>{getStatusBadge(activeDetailLeave.status)}</div>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Remarks:</span>
                <span className="text-slate-800 font-medium text-right max-w-xs">
                  {activeDetailLeave.reviewRemarks || 'No remarks recorded.'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Reviewed By:</span>
                <span className="text-slate-800">
                  {activeDetailLeave.reviewedBy?.name || 'Staff Administrator'}
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-500">Decided Timestamp:</span>
                <span className="text-slate-800">
                  {activeDetailLeave.reviewedAt
                    ? new Date(activeDetailLeave.reviewedAt).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
