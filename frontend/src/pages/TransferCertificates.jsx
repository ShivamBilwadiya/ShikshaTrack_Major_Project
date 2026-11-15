import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  FileText,
  Search,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Download,
  Printer,
  History,
  CreditCard,
  RefreshCw,
  LogOut,
  Calendar,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export default function TransferCertificates() {
  // Tab state: 'issue' | 'history'
  const [activeTab, setActiveTab] = useState('issue');

  // Student search state
  const [studentQuery, setStudentQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Student exit preview state
  const [exitPreview, setExitPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Exit Form state
  const [exitReason, setExitReason] = useState('Higher Studies / Relocation');
  const [leavingDate, setLeavingDate] = useState(new Date().toISOString().split('T')[0]);
  const [conduct, setConduct] = useState('Good');
  const [remarks, setRemarks] = useState('');
  const [allowWithPendingFees, setAllowWithPendingFees] = useState(false);
  const [issuing, setIssuing] = useState(false);

  // TC History State
  const [historyList, setHistoryList] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Feedback State
  const [error, setError] = useState('');
  const [successCert, setSuccessCert] = useState(null);

  // Search Students
  const handleSearchStudents = async (e) => {
    e?.preventDefault();
    if (!studentQuery.trim()) return;

    try {
      setSearching(true);
      setError('');
      const res = await api.get(`/students?search=${encodeURIComponent(studentQuery)}&limit=8`);
      if (res.success) {
        setSearchResults(res.data.students || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to search students.');
    } finally {
      setSearching(false);
    }
  };

  // Select a Student & Load Exit Preview
  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setSuccessCert(null);
    setError('');

    try {
      setPreviewLoading(true);
      const res = await api.get(`/students/tc/preview/${student.id}`);
      if (res.success) {
        setExitPreview(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load exit details for selected student.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Fetch History
  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: historyPage,
        limit: 12,
        ...(historySearch && { search: historySearch }),
      });
      const res = await api.get(`/students/tc/history?${params.toString()}`);
      if (res.success) {
        setHistoryList(res.data.certificates || []);
        setHistoryTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load Transfer Certificate history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historySearch]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Issue Transfer Certificate
  const handleIssueTc = async () => {
    if (!selectedStudent || !exitPreview) {
      setError('Please select a student first.');
      return;
    }

    if (exitPreview.hasExistingTc) {
      setError(
        `This student already has an active Transfer Certificate (${exitPreview.existingCertificate?.certificateNumber}). Duplicate issuance is prohibited.`
      );
      return;
    }

    if (!exitPreview.feeStatus.isCleared && !allowWithPendingFees) {
      setError(
        `Outstanding fee balance of ₹${exitPreview.feeStatus.totalBalance} detected. Clear dues or authorize an administrative fee waiver to proceed.`
      );
      return;
    }

    const confirmMsg = `Confirm Transfer Certificate issuance for ${selectedStudent.name} (${selectedStudent.admissionNumber})? This will mark the student as exited/inactive in the institution registry.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIssuing(true);
      setError('');

      const res = await api.post('/students/tc/issue', {
        studentId: selectedStudent.id,
        exitReason,
        leavingDate,
        conduct,
        remarks,
        allowWithPendingFees,
      });

      if (res.success) {
        setSuccessCert(res.data);
        setExitPreview(null);
        setSelectedStudent(null);
        setSearchResults([]);
        setStudentQuery('');
      }
    } catch (err) {
      setError(err.message || 'Failed to issue Transfer Certificate.');
    } finally {
      setIssuing(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async (certificateId, certNum) => {
    try {
      const response = await fetch(`/api/v1/students/tc/download/${certificateId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('shiksha_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('PDF generation failed on server.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download certificate PDF.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-600 rounded-xl text-white shadow-md shadow-amber-200">
            <FileText size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Transfer Certificate & Student Exit Management
            </h1>
            <p className="text-sm text-slate-500">
              Process student withdrawals, validate institutional fee clearance, and issue verifiable digital Transfer Certificates.
            </p>
          </div>
        </div>

        {/* Tabs switcher */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('issue')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'issue'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Issue New Certificate
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Issuance Registry
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successCert && (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-fade-in shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 font-bold text-base text-emerald-800">
              <CheckCircle2 size={22} className="text-emerald-600" />
              <span>Transfer Certificate Issued Successfully</span>
            </div>
            <button
              onClick={() => handleDownloadPdf(successCert.id, successCert.certificateNumber)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition"
            >
              <Download size={14} />
              <span>Download Printable PDF</span>
            </button>
          </div>
          <div className="text-xs text-emerald-800 space-y-1">
            <p>
              <strong>Certificate Number:</strong>{' '}
              <span className="font-mono font-semibold">{successCert.certificateNumber}</span>
            </p>
            <p>
              <strong>Status:</strong> Student record has been finalized as exited/inactive with an immutable audit log entry.
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-3 text-sm">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: ISSUE TRANSFER CERTIFICATE */}
      {activeTab === 'issue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Student Lookup */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Search size={16} className="text-amber-600" />
              <span>1. Find Student</span>
            </h2>

            <form onSubmit={handleSearchStudents} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Enter name or admission no..."
                  className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={searching || !studentQuery.trim()}
                  className="absolute right-2 top-2 text-slate-400 hover:text-amber-600"
                >
                  <Search size={16} />
                </button>
              </div>
            </form>

            {/* Results List */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searching ? (
                <p className="text-xs text-slate-400 text-center py-4">Searching student directory...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Search by student legal name or admission number to begin.
                </p>
              ) : (
                searchResults.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => handleSelectStudent(st)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                      selectedStudent?.id === st.id
                        ? 'bg-amber-50 border-amber-300 shadow-sm'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">{st.name}</div>
                    <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
                      <span className="font-mono">{st.admissionNumber}</span>
                      <span>{st.class ? `${st.class.name}-${st.class.section}` : 'No Class'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2 & 3: Exit Form & Fee Clearance Validation */}
          <div className="lg:col-span-2 space-y-6">
            {previewLoading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-600" />
                <p className="text-sm">Loading student exit data & fee clearance verification...</p>
              </div>
            ) : !exitPreview ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <FileCheck size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No Student Selected</p>
                <p className="text-xs text-slate-400 mt-1">
                  Select a student from the directory on the left to review fee status and generate a Transfer Certificate.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6 animate-fade-in">
                {/* Student Particulars Banner */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{exitPreview.student.name}</h3>
                    <p className="text-slate-500 mt-0.5">
                      Admission No: <span className="font-mono font-semibold">{exitPreview.student.admissionNumber}</span> &bull;{' '}
                      Class: <span className="font-semibold">{exitPreview.student.className}</span> ({exitPreview.student.academicYear})
                    </p>
                  </div>
                  <div className="text-slate-600 sm:text-right">
                    <div>Guardian: {exitPreview.student.guardianName}</div>
                    <div>Admission Date: {new Date(exitPreview.student.admissionDate).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Duplicate Certificate Warning */}
                {exitPreview.hasExistingTc && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2.5">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                    <span>
                      An active Transfer Certificate ({exitPreview.existingCertificate?.certificateNumber}) has already been issued for this student on{' '}
                      {new Date(exitPreview.existingCertificate?.issueDate).toLocaleDateString()}. Re-issuance is blocked to protect record integrity.
                    </span>
                  </div>
                )}

                {/* Fee Clearance Verification Card */}
                <div
                  className={`p-4 rounded-xl border ${
                    exitPreview.feeStatus.isCleared
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CreditCard
                        size={18}
                        className={exitPreview.feeStatus.isCleared ? 'text-emerald-600' : 'text-amber-600'}
                      />
                      <span className="font-bold text-sm text-slate-900">Institutional Fee Clearance Status</span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        exitPreview.feeStatus.isCleared
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {exitPreview.feeStatus.isCleared ? 'ALL DUES CLEARED' : 'PENDING BALANCE'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Total Invoiced</span>
                      <span className="font-bold text-slate-800">₹{exitPreview.feeStatus.totalNet}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Paid to Date</span>
                      <span className="font-bold text-emerald-700">₹{exitPreview.feeStatus.totalPaid}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Outstanding Balance</span>
                      <span
                        className={`font-bold ${
                          exitPreview.feeStatus.isCleared ? 'text-slate-800' : 'text-rose-600'
                        }`}
                      >
                        ₹{exitPreview.feeStatus.totalBalance}
                      </span>
                    </div>
                  </div>

                  {!exitPreview.feeStatus.isCleared && (
                    <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center space-x-2 text-xs text-amber-900">
                      <input
                        type="checkbox"
                        id="allowWithPendingFees"
                        checked={allowWithPendingFees}
                        onChange={(e) => setAllowWithPendingFees(e.target.checked)}
                        className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor="allowWithPendingFees" className="cursor-pointer font-medium">
                        Authorize Administrative Fee Waiver / Issue with Pending Dues
                      </label>
                    </div>
                  )}
                </div>

                {/* Exit Details Form */}
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm">2. Exit Certificate Particulars</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Leaving</label>
                      <input
                        type="date"
                        value={leavingDate}
                        onChange={(e) => setLeavingDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Student Conduct</label>
                      <select
                        value={conduct}
                        onChange={(e) => setConduct(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        <option value="Exemplary">Exemplary</option>
                        <option value="Very Good">Very Good</option>
                        <option value="Good">Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Leaving</label>
                    <input
                      type="text"
                      value={exitReason}
                      onChange={(e) => setExitReason(e.target.value)}
                      placeholder="e.g. Completed secondary school education, Parent transfer, etc."
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      General Remarks & Academic Observations
                    </label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional additional observations for next receiving school..."
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    onClick={handleIssueTc}
                    disabled={
                      issuing ||
                      exitPreview.hasExistingTc ||
                      (!exitPreview.feeStatus.isCleared && !allowWithPendingFees)
                    }
                    className="flex items-center space-x-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 shadow-md shadow-amber-200 transition"
                  >
                    {issuing ? <RefreshCw size={16} className="animate-spin" /> : <LogOut size={16} />}
                    <span>Issue Transfer Certificate & Finalize Exit</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ISSUANCE HISTORY REGISTRY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search certificate or student..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <button
              onClick={fetchHistory}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
              <span>Refresh Registry</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Certificate No.</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Exit Reason</th>
                  <th className="py-3 px-4">Fee Clearance</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyLoading && historyList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Loading certificate registry...
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No Transfer Certificates recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyList.map((cert) => {
                    const snap = cert.studentSnapshot || {};
                    const cData = cert.certificateData || {};
                    return (
                      <tr key={cert.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 text-xs">
                          {cert.certificateNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {snap.name || cert.student?.name}
                          <span className="block text-[11px] font-mono text-slate-400">
                            {snap.admissionNumber || cert.student?.admissionNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {snap.className || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                          {cData.exitReason || 'School completion'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              cData.feeClearanceStatus === 'CLEARED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {cData.feeClearanceStatus === 'CLEARED' ? 'CLEARED' : 'PENDING WAIVED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(cert.issueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDownloadPdf(cert.id, cert.certificateNumber)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Page {historyPage} of {historyTotalPages}
              </span>
              <div className="space-x-2">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
