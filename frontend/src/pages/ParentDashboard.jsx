import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  GraduationCap,
  CalendarCheck,
  Award,
  CreditCard,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  PlusCircle,
  FileText,
  User,
  Phone,
  Mail,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  X,
  RefreshCw,
  Heart,
} from 'lucide-react';

export default function ParentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'exams' | 'fees' | 'leaves'

  // Modal states
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'SICK',
    startDate: '',
    endDate: '',
    reason: '',
    documentUrl: '',
  });
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState('');

  const fetchDashboard = async (studentId = null) => {
    try {
      setLoading(true);
      setError(null);
      const url = studentId
        ? `/parents/dashboard?studentId=${studentId}`
        : '/parents/dashboard';
      const res = await api.get(url);
      setDashboardData(res.data);
      if (res.data?.selectedStudent?.id) {
        setSelectedStudentId(res.data.selectedStudent.id);
      }
    } catch (err) {
      console.error('Failed to load parent dashboard:', err);
      setError(err.response?.data?.error || err.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleStudentSwitch = (studentId) => {
    setSelectedStudentId(studentId);
    fetchDashboard(studentId);
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      alert('Please fill in start date, end date, and reason.');
      return;
    }

    try {
      setLeaveSubmitting(true);
      await api.post('/parents/leaves', {
        studentId: selectedStudentId,
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason.trim(),
        documentUrl: leaveForm.documentUrl ? leaveForm.documentUrl.trim() : null,
      });

      setLeaveSuccessMsg('Leave application submitted successfully. Your child’s class teacher has been notified.');
      setLeaveForm({
        leaveType: 'SICK',
        startDate: '',
        endDate: '',
        reason: '',
        documentUrl: '',
      });
      setTimeout(() => {
        setLeaveSuccessMsg('');
        setLeaveModalOpen(false);
        fetchDashboard(selectedStudentId);
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit leave application.');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading Student Guardian Portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-800 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">Failed to Load Parent Portal</h3>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            <button
              onClick={() => fetchDashboard()}
              className="mt-3 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    parent,
    linkedChildren = [],
    selectedStudent,
    attendance,
    examinations,
    fees,
    leaves,
    announcements = [],
    unreadCounts = { messages: 0, notifications: 0 },
  } = dashboardData || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Welcome & Child Switcher Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-sky-200 text-xs font-medium uppercase tracking-wider mb-1">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>Parent & Guardian Portal</span>
              <span>•</span>
              <span>{parent?.relationship || 'Guardian'}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome, {parent?.guardianName || user?.name}
            </h1>
            <p className="text-sm text-sky-100/80 mt-0.5">
              Track attendance, grades, fee billing, and school announcements in real-time.
            </p>
          </div>

          {/* Child Switcher Pills */}
          {linkedChildren.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/30 p-2 rounded-xl border border-white/10">
              <span className="text-xs text-sky-200/80 font-medium px-2">Ward / Child:</span>
              {linkedChildren.map((child) => {
                const isSelected = child.studentId === selectedStudentId;
                return (
                  <button
                    key={child.studentId}
                    onClick={() => handleStudentSwitch(child.studentId)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-950/40'
                        : 'bg-white/10 text-sky-100 hover:bg-white/20'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{child.name}</span>
                    <span className="text-[10px] opacity-80">({child.className})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Child Details Strip */}
        {selectedStudent && (
          <div className="mt-6 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-sky-200/70 block text-[11px]">Class & Section</span>
              <span className="font-semibold text-white text-sm">{selectedStudent.className}</span>
            </div>
            <div>
              <span className="text-sky-200/70 block text-[11px]">Admission No.</span>
              <span className="font-semibold text-white text-sm">{selectedStudent.admissionNumber}</span>
            </div>
            <div>
              <span className="text-sky-200/70 block text-[11px]">Roll No.</span>
              <span className="font-semibold text-white text-sm">{selectedStudent.rollNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-sky-200/70 block text-[11px]">Class Teacher</span>
              <span className="font-semibold text-white text-sm">
                {selectedStudent.classTeacher?.name || 'Assigned Staff'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Attendance Rate</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-slate-800">
                {attendance?.attendanceRate ?? 100}%
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  attendance?.statusBadge === 'EXCELLENT'
                    ? 'bg-emerald-100 text-emerald-800'
                    : attendance?.statusBadge === 'GOOD'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {attendance?.statusBadge || 'GOOD'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {attendance?.presentCount || 0} Present • {attendance?.absentCount || 0} Absent
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Academic Performance */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Academic Average</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-slate-800">
                {examinations?.averagePercentage !== null ? `${examinations.averagePercentage}%` : 'N/A'}
              </span>
              {examinations?.recentCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  {examinations.recentCount} Exam{examinations.recentCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Term reports & assessment marks
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Fee Balance */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Pending Fee Balance</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-slate-800">
                ₹{fees?.balance ? fees.balance.toLocaleString('en-IN') : 0}
              </span>
              {fees?.hasOverdue && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                  DUE
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Paid: ₹{fees?.totalPaid ? fees.totalPaid.toLocaleString('en-IN') : 0}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        {/* Communication & Leaves */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Active Alerts</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-slate-800">
                {(unreadCounts.messages || 0) + (leaves?.pendingCount || 0)}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">Unread / Pending</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {unreadCounts.messages || 0} New Messages • {leaves?.pendingCount || 0} Leaves
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Shortcut Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setLeaveModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Apply for Student Leave</span>
          </button>
          <a
            href="/parent/communication"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          >
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <span>Open Communication Center</span>
          </a>
        </div>

        {/* Tab Navigation for Child Data */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'attendance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attendance History
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'exams'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Examinations & Marks
          </button>
          <button
            onClick={() => setActiveTab('fees')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'fees'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fee Statements
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'leaves'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave History
          </button>
        </div>
      </div>

      {/* Main Grid: Data Section + Side Announcement Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Selected Tab View */}
        <div className="lg:col-span-2 space-y-4">
          {/* TAB 1: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Recent Daily Attendance Records</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified attendance marked through QR scans and smart registers
                  </p>
                </div>
                <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
                  Last 20 Sessions
                </span>
              </div>

              {attendance?.recentRecords && attendance.recentRecords.length > 0 ? (
                <div className="divide-y divide-slate-100 mt-3">
                  {attendance.recentRecords.map((rec) => (
                    <div key={rec.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            rec.status === 'PRESENT'
                              ? 'bg-emerald-500'
                              : rec.status === 'LATE'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <div>
                          <span className="font-medium text-xs text-slate-800 block">
                            {new Date(rec.date).toLocaleDateString('en-IN', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Method: {rec.method} {rec.notes ? `• ${rec.notes}` : ''}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          rec.status === 'PRESENT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rec.status === 'LATE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No attendance records logged yet for this student.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXAMINATIONS */}
          {activeTab === 'exams' && (
            <div className="space-y-4">
              {examinations?.exams && examinations.exams.length > 0 ? (
                examinations.exams.map((ex) => (
                  <div key={ex.examId} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-slate-800 text-sm">{ex.name}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {ex.term || 'TERM'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 mt-0.5 block">
                          Academic Year: {ex.academicYear} • Total: {ex.obtainedMarks} / {ex.totalMarks}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-slate-800 block">
                          {ex.percentage}%
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ex.status === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Grade: {ex.overallGrade} ({ex.status})
                        </span>
                      </div>
                    </div>

                    {/* Subject Marks Table */}
                    <table className="w-full text-left text-xs mt-3">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-100">
                          <th className="py-1.5 font-medium">Subject</th>
                          <th className="py-1.5 font-medium">Marks Obtained</th>
                          <th className="py-1.5 font-medium">Max Marks</th>
                          <th className="py-1.5 font-medium">Grade</th>
                          <th className="py-1.5 font-medium text-right">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {ex.subjects.map((sub, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-50">
                            <td className="py-2 font-medium text-slate-700">{sub.subjectName}</td>
                            <td className="py-2 text-slate-900 font-semibold">{sub.marksObtained}</td>
                            <td className="py-2 text-slate-500">{sub.maxMarks}</td>
                            <td className="py-2 font-bold text-slate-700">{sub.grade || '—'}</td>
                            <td className="py-2 text-right">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  sub.isPassed
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {sub.isPassed ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
                  No examination results published yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FEES */}
          {activeTab === 'fees' && (
            <div className="space-y-4">
              {/* Installment Schedule */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Installment Payment Schedule</h3>
                {fees?.installments && fees.installments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400">
                          <th className="py-2 font-medium">Installment</th>
                          <th className="py-2 font-medium">Fee Title</th>
                          <th className="py-2 font-medium">Due Date</th>
                          <th className="py-2 font-medium">Amount</th>
                          <th className="py-2 font-medium">Paid</th>
                          <th className="py-2 font-medium">Balance</th>
                          <th className="py-2 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {fees.installments.map((inst) => (
                          <tr key={inst.id} className="hover:bg-slate-50">
                            <td className="py-2.5 font-semibold text-slate-700">#{inst.installmentNumber}</td>
                            <td className="py-2.5 text-slate-600">{inst.feeName}</td>
                            <td className="py-2.5 text-slate-600">
                              {new Date(inst.dueDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2.5 font-semibold text-slate-800">
                              ₹{inst.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 text-emerald-600">
                              ₹{inst.paidAmount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 font-semibold text-rose-600">
                              ₹{inst.balance.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 text-right">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  inst.status === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inst.status === 'OVERDUE'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {inst.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4">No active fee installments found.</p>
                )}
              </div>

              {/* Payment Receipts */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Official Payment Receipts</h3>
                {fees?.recentPayments && fees.recentPayments.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {fees.recentPayments.map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-slate-800 block">{p.receiptNumber}</span>
                          <span className="text-slate-400 text-[11px]">
                            {new Date(p.paymentDate).toLocaleDateString('en-IN')} • Method: {p.paymentMethod}
                            {p.transactionRef ? ` • Ref: ${p.transactionRef}` : ''}
                          </span>
                        </div>
                        <span className="font-bold text-emerald-600 text-sm">
                          +₹{p.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4">No payment history recorded.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LEAVES */}
          {activeTab === 'leaves' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Student Leave Applications</h3>
                  <p className="text-xs text-slate-500">History of leave requests and teacher approvals</p>
                </div>
                <button
                  onClick={() => setLeaveModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
                >
                  + Apply Leave
                </button>
              </div>

              {leaves?.leaves && leaves.leaves.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {leaves.leaves.map((l) => (
                    <div key={l.id} className="py-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {l.leaveType} Leave (
                          {new Date(l.startDate).toLocaleDateString('en-IN')} -{' '}
                          {new Date(l.endDate).toLocaleDateString('en-IN')})
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            l.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : l.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                      <p className="text-slate-600">{l.reason}</p>
                      {l.reviewRemarks && (
                        <p className="text-[11px] text-slate-500 italic">
                          Staff remarks: "{l.reviewRemarks}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No leave requests submitted yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1 Column: School Announcements Feed */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-sky-600" />
                <span>School Announcements</span>
              </h3>
              <a
                href="/parent/communication"
                className="text-xs text-sky-600 font-semibold hover:underline"
              >
                View All
              </a>
            </div>

            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition text-xs"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          a.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {a.category}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(a.publishedAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-800">{a.title}</h4>
                    <p className="text-slate-600 mt-1 line-clamp-3">{a.content}</p>
                    <div className="mt-2 text-[10px] text-slate-400">
                      By {a.authorName} ({a.authorRole})
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No announcements at this time.</p>
            )}
          </div>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setLeaveModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Apply for Student Leave</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit an official absence request for {selectedStudent?.name}.
            </p>

            {leaveSuccessMsg ? (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
                {leaveSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleLeaveSubmit} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Leave Category</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="SICK">Medical / Sick Leave</option>
                    <option value="FAMILY">Family Commitment</option>
                    <option value="PERSONAL">Personal Matter</option>
                    <option value="EMERGENCY">Emergency</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reason for Absence</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Briefly explain the reason for the absence..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Supporting Document URL <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={leaveForm.documentUrl}
                    onChange={(e) => setLeaveForm({ ...leaveForm, documentUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setLeaveModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={leaveSubmitting}
                    className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-50 transition"
                  >
                    {leaveSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
