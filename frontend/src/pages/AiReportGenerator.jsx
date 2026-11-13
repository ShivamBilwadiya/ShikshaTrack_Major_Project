import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';

export default function AiReportGenerator() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReport = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.post('/ai/generate-report', { date });
      setReport(res.data);
    } catch (err) {
      setError(err.message || 'Failed to generate administrative memo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [date]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Controls Bar (Non-Printable) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileSpreadsheet size={22} className="text-sky-600" />
            <span>AI Administrative Report Generator</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Synthesize formal school attendance memos with compliance and mid-day meal reviews
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
          />

          <button
            onClick={() => window.print()}
            disabled={!report || loading}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs disabled:opacity-50 transition"
          >
            <Printer size={15} />
            <span>Print Official Memo</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 no-print">
          <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Synthesizing comprehensive school report...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 text-xs bg-white rounded-2xl border border-red-200 no-print">
          {error}
        </div>
      ) : report ? (
        /* Printable Formal Memo Container */
        <div
          id="printable-area"
          className="p-8 md:p-10 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-6 text-slate-800"
        >
          {/* Memo Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block">
                Official Administrative Memo &bull; ShikshaTrack
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">{report.title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Target Date: <strong>{report.date}</strong> &bull; Generated:{' '}
                {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-800">
                MEMO-ST-2026
              </span>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-sky-800">
              1. Executive Summary
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 font-medium">
              {report.executiveSummary}
            </p>
          </div>

          {/* Section 2: Class Observations */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-sky-800">
              2. Grade-by-Grade Attendance Breakdown
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 uppercase text-[10px] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3">Enrolled</th>
                    <th className="py-2.5 px-3">Attendance Rate</th>
                    <th className="py-2.5 px-3">Observation & Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {report.classObservations.map((c) => (
                    <tr key={c.class} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{c.class}</td>
                      <td className="py-2.5 px-3 text-slate-600">{c.enrolled}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900">{c.attendanceRate}</td>
                      <td className="py-2.5 px-3 text-slate-600">{c.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Risk Assessment */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-sky-800">
              3. Attendance Risk Assessment
            </h3>
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex justify-between font-bold">
                <span>Students Below 75% RTE Threshold:</span>
                <span className="text-rose-700">{report.riskAssessment.criticalAttendanceStudents}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Statistical Absence Anomalies Flagged:</span>
                <span>{report.riskAssessment.flaggedAnomalies}</span>
              </div>
              {report.riskAssessment.sampleAnomalies.length > 0 && (
                <div className="pt-2 border-t border-amber-200/60 text-[11px] space-y-1">
                  <span className="font-semibold block text-amber-800">Key Patterns:</span>
                  {report.riskAssessment.sampleAnomalies.map((a, i) => (
                    <li key={i} className="list-disc ml-4">
                      {a}
                    </li>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Recommended Administrative Actions */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-sky-800">
              4. Recommended Administrative Actions
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {report.suggestedAdministrativeActions.map((action, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="font-bold text-sky-600 mt-0.5">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Signatures */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 text-xs">
            <div>
              <p className="text-slate-400 text-[10px]">Prepared By</p>
              <p className="font-bold text-slate-800 mt-4">Administrative In-Charge / System Lead</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[10px]">Verified & Endorsed</p>
              <p className="font-bold text-slate-800 mt-4">Headmaster / Principal</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

