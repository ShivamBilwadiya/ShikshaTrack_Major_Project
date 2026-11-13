import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  GraduationCap,
  ArrowLeft,
  QrCode,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  RefreshCw,
  Phone,
  User,
  ShieldAlert,
} from 'lucide-react';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/students/${id}`);
      setStudent(res.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load student profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const handleDownloadQr = () => {
    if (!student?.qrDataUrl) return;
    const a = document.createElement('a');
    a.href = student.qrDataUrl;
    a.download = `QR_${student.admissionNumber}_${student.name.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const handleRegenerateQr = async () => {
    if (!window.confirm('Regenerate QR token for this student? Previous cards will be revoked.')) {
      return;
    }
    try {
      await api.post(`/students/${id}/regenerate-qr`);
      setSuccessMsg('QR token regenerated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchProfile();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin h-8 w-8 text-sky-600" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-center">
        <p className="font-bold text-sm">Failed to load student:</p>
        <p className="text-xs mt-1">{error || 'Student not found.'}</p>
        <button
          onClick={() => navigate('/students')}
          className="mt-3 px-3.5 py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold"
        >
          Back to Students
        </button>
      </div>
    );
  }

  const { stats } = student;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/students')}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{student.name}</h1>
            <p className="text-xs text-slate-500">
              Admission: <strong className="font-mono text-slate-700">{student.admissionNumber}</strong> &bull; Class:{' '}
              <strong className="text-slate-700">
                {student.class.name}-{student.class.section}
              </strong>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownloadQr}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <Download size={14} />
            <span>Download QR PNG</span>
          </button>
          <button
            onClick={handleRegenerateQr}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition"
          >
            <RefreshCw size={14} />
            <span>Reset QR Token</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: QR Card + Attendance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Printable QR ID Card Box */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-xl border border-slate-800 flex flex-col items-center justify-between text-center">
          <div className="w-full pb-3 border-b border-slate-800">
            <span className="text-[10px] font-bold tracking-wider text-sky-400 uppercase">
              Student Smart ID
            </span>
            <h2 className="text-lg font-bold text-white mt-1">{student.name}</h2>
            <p className="text-xs text-slate-400">
              {student.class.name}-{student.class.section} &bull; Roll: {student.rollNumber || '-'}
            </p>
          </div>

          <div className="my-4 p-3 bg-white rounded-2xl shadow-inner">
            <img src={student.qrDataUrl} alt="Student QR Code" className="w-40 h-40 object-contain" />
          </div>

          <div className="w-full pt-3 border-t border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Admission No:</span>
              <span className="font-mono font-bold text-white">{student.admissionNumber}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Token ID:</span>
              <span className="font-mono text-[10px] text-sky-300">{student.qrToken}</span>
            </div>
          </div>
        </div>

        {/* Attendance Stats & Profile Information (2 Columns) */}
        <div className="md:col-span-2 space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs text-center">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Sessions
              </span>
              <span className="text-2xl font-extrabold text-slate-800 mt-1 block">
                {stats.totalRecords}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Present
              </span>
              <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
                {stats.presentCount}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider block">
                Late
              </span>
              <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
                {stats.lateCount}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider block">
                Absent
              </span>
              <span className="text-2xl font-extrabold text-rose-700 mt-1 block">
                {stats.absentCount}
              </span>
            </div>
          </div>

          {/* Attendance Rate Progress Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Cumulative Attendance Rate</span>
              <span
                className={`text-sm font-extrabold ${
                  stats.attendanceRate >= 75 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {stats.attendanceRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  stats.attendanceRate >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, stats.attendanceRate)}%` }}
              />
            </div>
            {stats.attendanceRate < 75 && (
              <p className="text-[11px] text-rose-600 mt-2 font-medium flex items-center space-x-1">
                <ShieldAlert size={14} className="shrink-0" />
                <span>
                  Attendance is below the mandatory 75% threshold under Right to Education (RTE) guidelines.
                </span>
              </p>
            )}
          </div>

          {/* Demographic & Guardian Information */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Student & Guardian Particulars
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Guardian Name</span>
                <span className="font-semibold text-slate-800">{student.guardianName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Guardian Contact</span>
                <span className="font-semibold text-slate-800">{student.guardianPhone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Gender</span>
                <span className="font-semibold text-slate-800">{student.gender || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">School</span>
                <span className="font-semibold text-slate-800">{student.school.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attendance Session History */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-1">Recent Attendance Log</h2>
        <p className="text-xs text-slate-500 mb-4">Past 30 session recordings for {student.name}</p>

        {student.attendanceRecords.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No attendance sessions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Session Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Marked Timestamp</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {student.attendanceRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {new Date(r.session.sessionDate).toLocaleDateString()}
                    </td>
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
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {r.method}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {new Date(r.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 italic text-[11px]">
                      {r.remarks || '-'}
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

