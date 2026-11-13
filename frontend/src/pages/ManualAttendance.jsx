import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  CheckCheck,
  AlertCircle,
  Lock,
  RefreshCw,
  Search,
} from 'lucide-react';

export default function ManualAttendance() {
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get('classId') || '';

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [sessionData, setSessionData] = useState(null);
  const [roster, setRoster] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
        const res = await api.get('/classes');
        setClasses(res.data);
        if (!selectedClassId && res.data.length > 0) {
          setSelectedClassId(res.data[0].id);
        }
      } catch (err) {
        setError('Failed to load classes.');
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  // Fetch session details and roster
  const fetchSessionRoster = async () => {
    if (!selectedClassId) return;

    try {
      setLoading(true);
      setError('');
      // 1. Start or get session
      const startRes = await api.post('/attendance/sessions/start', {
        classId: selectedClassId,
      });

      // 2. Get full roster details
      const res = await api.get(`/attendance/sessions/${startRes.data.id}`);
      setSessionData(res.data.session);
      setRoster(res.data.roster);
    } catch (err) {
      setError(err.message || 'Failed to load attendance session.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionRoster();
  }, [selectedClassId]);

  // Handle single status change
  const handleStatusChange = async (studentId, newStatus) => {
    if (sessionData?.status === 'CLOSED') {
      alert('This session has already been closed and finalized.');
      return;
    }

    // Optimistic UI update
    setRoster((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status: newStatus, marked: true } : r))
    );

    try {
      await api.post('/attendance/manual', {
        sessionId: sessionData.id,
        studentId,
        status: newStatus,
      });
    } catch (err) {
      alert(`Failed to save attendance: ${err.message}`);
      fetchSessionRoster();
    }
  };

  // Bulk mark all unmarked students as Present
  const handleMarkAllPresent = async () => {
    if (sessionData?.status === 'CLOSED') return;

    const unmarked = roster.filter((r) => r.status === 'UNMARKED');
    if (unmarked.length === 0) return;

    const updates = unmarked.map((u) => ({
      studentId: u.studentId,
      status: 'PRESENT',
    }));

    try {
      setSaving(true);
      await api.post('/attendance/manual/bulk', {
        sessionId: sessionData.id,
        records: updates,
      });
      setMessage(`Marked ${updates.length} students as PRESENT!`);
      setTimeout(() => setMessage(''), 4000);
      fetchSessionRoster();
    } catch (err) {
      alert(`Bulk update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Close & Finalize Session
  const handleCloseSession = async () => {
    const unmarkedCount = roster.filter((r) => r.status === 'UNMARKED').length;

    let finalizeUnmarkedStatus = null;
    if (unmarkedCount > 0) {
      const markAbsent = window.confirm(
        `There are ${unmarkedCount} unmarked students remaining.\n\nClick OK to mark them as ABSENT and close the session, or Cancel to review them first.`
      );
      if (!markAbsent) return;
      finalizeUnmarkedStatus = 'ABSENT';
    } else {
      if (!window.confirm('Finalize and close this attendance session?')) return;
    }

    try {
      setSaving(true);
      await api.post(`/attendance/sessions/${sessionData.id}/close`, {
        finalizeUnmarkedStatus,
      });
      setMessage('Attendance session finalized and closed.');
      setTimeout(() => setMessage(''), 4000);
      fetchSessionRoster();
    } catch (err) {
      alert(`Failed to close session: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredRoster = roster.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.admissionNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.rollNumber && r.rollNumber.includes(search))
  );

  const presentTotal = roster.filter((r) => r.status === 'PRESENT').length;
  const lateTotal = roster.filter((r) => r.status === 'LATE').length;
  const absentTotal = roster.filter((r) => r.status === 'ABSENT').length;
  const unmarkedTotal = roster.filter((r) => r.status === 'UNMARKED').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <ClipboardCheck size={22} className="text-sky-600" />
            <span>Manual Attendance Sheet</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Conduct official manual roll-call or review and finalize scanned sessions
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}-{cls.section}
              </option>
            ))}
          </select>

          {sessionData?.status === 'OPEN' && (
            <button
              onClick={handleCloseSession}
              disabled={saving}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50 transition"
            >
              <Lock size={14} />
              <span>Finalize & Close Session</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Session Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">Enrolled</span>
          <span className="text-xl font-black text-slate-900 block mt-0.5">{roster.length}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
          <span className="text-[10px] uppercase font-bold text-emerald-700">Present</span>
          <span className="text-xl font-black text-emerald-700 block mt-0.5">{presentTotal}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
          <span className="text-[10px] uppercase font-bold text-amber-700">Late</span>
          <span className="text-xl font-black text-amber-700 block mt-0.5">{lateTotal}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-center">
          <span className="text-[10px] uppercase font-bold text-rose-700">Absent</span>
          <span className="text-xl font-black text-rose-700 block mt-0.5">{absentTotal}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-600">Unmarked</span>
          <span className="text-xl font-black text-slate-800 block mt-0.5">{unmarkedTotal}</span>
        </div>
      </div>

      {/* Roster Controls: Search & Bulk Action */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter students by name, roll, or admission..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {sessionData?.status === 'OPEN' && unmarkedTotal > 0 && (
          <button
            onClick={handleMarkAllPresent}
            disabled={saving}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shrink-0 transition"
          >
            <CheckCheck size={14} />
            <span>Mark Unmarked as Present ({unmarkedTotal})</span>
          </button>
        )}
      </div>

      {/* Attendance Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading roster...</p>
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No students found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Roll</th>
                  <th className="py-2.5 px-4">Student Name</th>
                  <th className="py-2.5 px-4">Admission No</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4 text-center">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredRoster.map((item) => (
                  <tr key={item.studentId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.rollNumber || '-'}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{item.admissionNumber}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.method || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 space-x-1">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.studentId, 'PRESENT')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            item.status === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-emerald-700'
                          }`}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.studentId, 'LATE')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            item.status === 'LATE'
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'text-slate-600 hover:text-amber-700'
                          }`}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.studentId, 'ABSENT')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            item.status === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-rose-700'
                          }`}
                        >
                          A
                        </button>
                      </div>
                    </td>
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

