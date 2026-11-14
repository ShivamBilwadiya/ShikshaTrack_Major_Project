import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BarChart3,
  Calendar,
  Download,
  AlertTriangle,
  Utensils,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Printer,
  ChevronRight,
} from 'lucide-react';

export default function AttendanceReports() {
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'monthly' | 'low' | 'meal'
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [lowAttendance, setLowAttendance] = useState(null);
  const [mealReport, setMealReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch Daily Report
  const fetchDaily = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/daily', { params: { date: reportDate } });
      setDailyReport(res.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load daily report.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Monthly Report
  const fetchMonthly = async () => {
    try {
      setLoading(true);
      const now = new Date(reportDate);
      const res = await api.get('/reports/monthly', {
        params: { year: now.getFullYear(), month: now.getMonth() + 1 },
      });
      setMonthlyReport(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load monthly report.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Low Attendance
  const fetchLow = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/low-attendance', { params: { threshold: 75 } });
      setLowAttendance(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load low attendance alert list.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Mid-Day Meal Report
  const fetchMeal = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/mid-day-meal');
      setMealReport(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load mid-day meal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') fetchDaily();
    else if (activeTab === 'monthly') fetchMonthly();
    else if (activeTab === 'low') fetchLow();
    else if (activeTab === 'meal') fetchMeal();
  }, [activeTab, reportDate]);

  const handleExportCsv = (view = 'detailed') => {
    const params = new URLSearchParams({ date: reportDate });
    if (view === 'summary') {
      params.append('view', 'summary');
    }
    window.open(`/api/v1/reports/daily/csv?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header and Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <BarChart3 size={22} className="text-sky-600" />
            <span>Attendance & Governance Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official registers, low-attendance alerts, and Mid-Day Meal (MDM) headcounts
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'daily' && (
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
            />
          )}

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleExportCsv('detailed')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition"
              title="Export detailed student-level attendance register CSV"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExportCsv('summary')}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
              title="Export class summary totals CSV"
            >
              <FileSpreadsheet size={13} />
              <span>Summary</span>
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('daily')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'daily'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Daily Register
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'monthly'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Monthly Summary
        </button>
        <button
          onClick={() => setActiveTab('low')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'low'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Low Attendance (&lt; 75%)
        </button>
        <button
          onClick={() => setActiveTab('meal')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'meal'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Mid-Day Meal (MDM) Log
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Generating report tables...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 text-xs bg-white rounded-2xl border border-red-200">
          {error}
        </div>
      ) : activeTab === 'daily' && dailyReport ? (
        /* DAILY REPORT TAB */
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Enrolled</span>
              <strong className="text-2xl font-black text-slate-900 block mt-1">
                {dailyReport.summary.totalEnrolled}
              </strong>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[10px] text-emerald-700 font-bold uppercase">Present Total</span>
              <strong className="text-2xl font-black text-emerald-700 block mt-1">
                {dailyReport.summary.totalPresent}
              </strong>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <span className="text-[10px] text-rose-700 font-bold uppercase">Absent Total</span>
              <strong className="text-2xl font-black text-rose-700 block mt-1">
                {dailyReport.summary.totalAbsent}
              </strong>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
              <span className="text-[10px] text-indigo-700 font-bold uppercase">MDM Eligible Meals</span>
              <strong className="text-2xl font-black text-indigo-700 block mt-1">
                {dailyReport.summary.midDayMealTotalHeadcount}
              </strong>
            </div>
          </div>

          {/* Class Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Grade-wise Register for {dailyReport.date}
              </h2>
              <span className="text-xs font-bold text-indigo-600">
                Overall Rate: {dailyReport.summary.overallAttendanceRate}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Class</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Teacher</th>
                    <th className="py-2.5 px-4">Enrolled</th>
                    <th className="py-2.5 px-4 text-emerald-600">Present</th>
                    <th className="py-2.5 px-4 text-amber-600">Late</th>
                    <th className="py-2.5 px-4 text-rose-600">Absent</th>
                    <th className="py-2.5 px-4">Rate</th>
                    <th className="py-2.5 px-4 text-right">MDM Meals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {dailyReport.classReports.map((c) => (
                    <tr key={c.classId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.className}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.sessionStatus === 'CLOSED'
                              ? 'bg-slate-100 text-slate-600'
                              : c.sessionStatus === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.sessionStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.teacherName || 'N/A'}</td>
                      <td className="py-3 px-4">{c.enrolled}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{c.present}</td>
                      <td className="py-3 px-4 text-amber-600">{c.late}</td>
                      <td className="py-3 px-4 text-rose-600">{c.absent}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{c.attendanceRate}%</td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-700">
                        {c.midDayMealCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'monthly' && monthlyReport ? (
        /* MONTHLY REPORT TAB */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Monthly Attendance Register: {monthlyReport.monthName} {monthlyReport.year}
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Working Days Recorded: {monthlyReport.workingDaysRecorded} &bull; Total Sessions: {monthlyReport.totalSessions}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Sessions Held</th>
                  <th className="py-2.5 px-4 text-emerald-600">Present</th>
                  <th className="py-2.5 px-4 text-amber-600">Late</th>
                  <th className="py-2.5 px-4 text-rose-600">Absent</th>
                  <th className="py-2.5 px-4 text-right">Daily Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {monthlyReport.dailyTrend.map((d) => {
                  const total = d.present + d.late + d.absent;
                  const rate = total > 0 ? Math.round(((d.present + d.late) / total) * 100) : 0;
                  return (
                    <tr key={d.date} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{d.date}</td>
                      <td className="py-3 px-4">{d.sessionsCount} classes</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{d.present}</td>
                      <td className="py-3 px-4 text-amber-600">{d.late}</td>
                      <td className="py-3 px-4 text-rose-600">{d.absent}</td>
                      <td className="py-3 px-4 text-right font-black text-indigo-600">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'low' && lowAttendance ? (
        /* LOW ATTENDANCE TAB */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
            <div>
              <h2 className="text-sm font-bold text-amber-900 flex items-center space-x-1.5">
                <AlertTriangle size={16} className="text-amber-600" />
                <span>Low Attendance Action List (&lt; {lowAttendance.threshold}%)</span>
              </h2>
              <p className="text-[11px] text-amber-700 mt-0.5">
                RTE Compliance notice: {lowAttendance.count} student(s) identified for guardian outreach.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Class</th>
                  <th className="py-2.5 px-4">Admission No</th>
                  <th className="py-2.5 px-4">Guardian Contact</th>
                  <th className="py-2.5 px-4">Recorded Sessions</th>
                  <th className="py-2.5 px-4">Rate</th>
                  <th className="py-2.5 px-4 text-right">Deficit Sessions to 75%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {lowAttendance.students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{st.name}</td>
                    <td className="py-3 px-4">{st.className}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{st.admissionNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{st.guardianName || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400">{st.guardianPhone || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      {st.presentCount} P / {st.absentCount} A ({st.totalSessions} total)
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold text-[11px]">
                        {st.attendanceRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-700">
                      +{st.deficitSessions} attendances needed
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'meal' && mealReport ? (
        /* MID-DAY MEAL TAB */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-sky-50/50">
            <div>
              <h2 className="text-sm font-bold text-sky-950 flex items-center space-x-1.5">
                <Utensils size={16} className="text-sky-600" />
                <span>Mid-Day Meal (MDM) Scheme Headcount Log</span>
              </h2>
              <p className="text-[11px] text-sky-700 mt-0.5">
                Verified physical attendees for grain allocation and kitchen billing
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Total Meals Prepared</th>
                  <th className="py-2.5 px-4">Class-wise Consumption Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {mealReport.report.map((item) => (
                  <tr key={item.date} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.date}</td>
                    <td className="py-3 px-4 font-black text-indigo-700 text-sm">
                      {item.totalMealCount} meals
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(item.classBreakdown).map(([cls, count]) => (
                          <span
                            key={cls}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                          >
                            {cls}: <strong className="text-slate-900">{count}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

