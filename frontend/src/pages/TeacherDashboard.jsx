import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useOffline } from '../context/OfflineContext';
import {
  ScanLine,
  ClipboardCheck,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  CloudDownload,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export default function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState('');
  const { downloadClassRoster, isOnline } = useOffline();

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/teacher');
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load teacher dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const handleDownloadRoster = async (classId, className) => {
    try {
      setDownloadSuccess('');
      await downloadClassRoster(classId);
      setDownloadSuccess(`Roster for ${className} saved to your device for offline scanning!`);
      setTimeout(() => setDownloadSuccess(''), 5000);
    } catch (err) {
      alert(`Could not download roster: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin h-8 w-8 text-sky-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
        <p className="font-semibold">Error:</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchTeacherData}
          className="mt-3 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { assignedClasses, todaySessions, recentRecords } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-900 to-slate-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Attendance Console</h1>
          <p className="text-xs text-sky-200 mt-1">
            Conduct QR camera scanning or offline-backed manual roll calls for your assigned classes.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            to="/attendance/scan"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition"
          >
            <ScanLine size={16} />
            <span>Launch QR Scanner</span>
          </Link>
          <Link
            to="/attendance/manual"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition"
          >
            <ClipboardCheck size={16} />
            <span>Manual Sheet</span>
          </Link>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Assigned Classes Grid */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3">Today's Class Sessions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {todaySessions.map((item) => (
            <div
              key={item.classId}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                      {item.className}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{item.className}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'CLOSED'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.status === 'OPEN'
                      ? 'IN PROGRESS'
                      : item.status === 'CLOSED'
                      ? 'COMPLETED'
                      : 'NOT STARTED'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Enrolled</span>
                    <span className="font-extrabold text-slate-800 text-base">{item.studentCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block font-medium">Present</span>
                    <span className="font-extrabold text-emerald-600 text-base">{item.presentCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Rate</span>
                    <span className="font-extrabold text-indigo-600 text-base">{item.attendanceRate}%</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 flex items-center justify-between gap-2">
                <Link
                  to={`/attendance/scan?classId=${item.classId}`}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  <ScanLine size={14} />
                  <span>Scan QR</span>
                </Link>
                <Link
                  to={`/attendance/manual?classId=${item.classId}`}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  <ClipboardCheck size={14} />
                  <span>Manual</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDownloadRoster(item.classId, item.className)}
                  disabled={!isOnline}
                  className="p-2 rounded-xl text-slate-500 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 disabled:opacity-40 transition"
                  title="Download roster to device for offline attendance"
                >
                  <CloudDownload size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Records Marked */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-1">Your Recent Attendance Markings</h2>
        <p className="text-xs text-slate-500 mb-4">Confirmed student attendance scans and manual updates</p>

        {recentRecords.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No attendance recorded yet today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Admission No</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {recentRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{r.studentName}</td>
                    <td className="py-2.5 px-3">{r.admissionNumber}</td>
                    <td className="py-2.5 px-3">{r.className}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'LATE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                        {r.method}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                      {new Date(r.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

