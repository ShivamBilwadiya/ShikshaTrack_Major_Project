import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  History,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Edit,
  Eye,
  RefreshCw,
  X,
  ShieldAlert,
} from 'lucide-react';

export default function AttendanceHistory() {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected session for drawer/modal
  const [activeSession, setActiveSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Correction Modal
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({
    status: 'PRESENT',
    remarks: '',
    reason: '',
  });

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/classes');
        setClasses(res.data);
      } catch (err) {}
    };
    fetchClasses();
  }, []);

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedClass) params.classId = selectedClass;
      if (selectedDate) params.date = selectedDate;

      const res = await api.get('/attendance/sessions', { params });
      setSessions(res.data.sessions);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [selectedClass, selectedDate]);

  // View Session Details
  const handleViewSession = async (sess) => {
    setActiveSession(sess);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/attendance/sessions/${sess.id}`);
      setSessionDetail(res.data);
    } catch (err) {
      alert(`Failed to load session details: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Correction Modal
  const handleOpenCorrection = (studentItem) => {
    if (!studentItem.recordId) {
      alert('This student was not marked in this session.');
      return;
    }
    setCorrectionTarget(studentItem);
    setCorrectionForm({
      status: studentItem.status === 'ABSENT' ? 'PRESENT' : 'ABSENT',
      remarks: studentItem.remarks || '',
      reason: 'Parent confirmed student was present for practical class',
    });
  };

  // Submit Correction
  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctionForm.reason.trim()) {
      alert('A valid reason is required for administrative audit logging.');
      return;
    }

    try {
      await api.patch(`/attendance/records/${correctionTarget.recordId}/correct`, {
        status: correctionForm.status,
        remarks: correctionForm.remarks,
        reason: correctionForm.reason,
      });

      alert('Attendance record corrected and audit log recorded.');
      setCorrectionTarget(null);

      // Refresh session detail
      const res = await api.get(`/attendance/sessions/${activeSession.id}`);
      setSessionDetail(res.data);
    } catch (err) {
      alert(`Correction failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <History size={22} className="text-sky-600" />
            <span>Attendance History & Session Logs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review past attendance sessions, attendance audits, and record manual corrections
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}-{cls.section}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          />

          {(selectedClass || selectedDate) && (
            <button
              onClick={() => {
                setSelectedClass('');
                setSelectedDate('');
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading session archives...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-xs">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No attendance sessions recorded for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Faculty In-charge</th>
                  <th className="py-3 px-4">Marked Count</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {new Date(sess.sessionDate).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-800">
                        {sess.class.name}-{sess.class.section}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{sess.teacher.name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-700">
                      {sess._count.attendanceRecords} marked
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sess.status === 'CLOSED'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleViewSession(sess)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 font-semibold text-xs transition"
                      >
                        View Roster & Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {activeSession.class.name}-{activeSession.class.section} Attendance Session
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Date: {new Date(activeSession.sessionDate).toLocaleDateString()} &bull; Faculty:{' '}
                  {activeSession.teacher.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveSession(null);
                  setSessionDetail(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingDetail || !sessionDetail ? (
                <div className="p-8 text-center">
                  <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading student attendance log...</p>
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-100">
                      <span className="text-[10px] text-slate-500 block">Total</span>
                      <strong className="text-sm font-black">{sessionDetail.stats.totalStudents}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800">
                      <span className="text-[10px] block">Present</span>
                      <strong className="text-sm font-black">{sessionDetail.stats.presentCount}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800">
                      <span className="text-[10px] block">Late</span>
                      <strong className="text-sm font-black">{sessionDetail.stats.lateCount}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800">
                      <span className="text-[10px] block">Absent</span>
                      <strong className="text-sm font-black">{sessionDetail.stats.absentCount}</strong>
                    </div>
                  </div>

                  {/* Student Roll Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Roll</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3 text-right">Correct</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sessionDetail.roster.map((st) => (
                          <tr key={st.studentId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-700">{st.rollNumber || '-'}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{st.name}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                  st.status === 'PRESENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : st.status === 'LATE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : st.status === 'ABSENT'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {st.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                              {st.method || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {st.recordId && (
                                <button
                                  onClick={() => handleOpenCorrection(st)}
                                  className="p-1 text-slate-400 hover:text-sky-600 transition"
                                  title="Correct Attendance Record"
                                >
                                  <Edit size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Correction Modal */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Attendance Audit Correction</h3>
                <p className="text-xs text-slate-500">Student: {correctionTarget.name}</p>
              </div>
              <button onClick={() => setCorrectionTarget(null)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  New Status
                </label>
                <select
                  value={correctionForm.status}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Modification (Mandatory for Audit Log) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  placeholder="e.g. Student was attending morning sports event or medical leave certificate produced..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                >
                  Commit Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

