import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  CreditCard,
  Archive,
  Copy,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Users,
  ShieldCheck,
  Lock,
  Layers,
  History,
  AlertCircle,
  Clock,
} from 'lucide-react';

export default function AcademicFeeRollover() {
  // Navigation tabs: 'overview' | 'rollover' | 'archives'
  const [activeTab, setActiveTab] = useState('overview');

  // Academic Years
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('2026-2027');

  // Year Overview State
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Archive Form State
  const [archiveNotes, setArchiveNotes] = useState('');
  const [archiving, setArchiving] = useState(false);

  // Rollover Prep State
  const [targetYear, setTargetYear] = useState('2027-2028');
  const [rolloverPreview, setRolloverPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  // Archive History State
  const [archivesList, setArchivesList] = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);

  // Alerts & Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Fetch available years
  const fetchYears = useCallback(async () => {
    try {
      const res = await api.get('/fees/rollover/years');
      if (res.success && res.data) {
        setAvailableYears(res.data);
        if (res.data.length > 0 && !selectedYear) {
          setSelectedYear(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load years:', err);
    }
  }, [selectedYear]);

  // 2. Fetch financial overview for selected year
  const fetchOverview = useCallback(async (year) => {
    const yr = year || selectedYear;
    if (!yr) return;

    try {
      setOverviewLoading(true);
      setError('');
      const res = await api.get(`/fees/rollover/overview?academicYear=${encodeURIComponent(yr)}`);
      if (res.success) {
        setOverview(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve financial overview.');
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedYear]);

  // 3. Fetch archives history
  const fetchArchives = useCallback(async () => {
    try {
      setArchivesLoading(true);
      const res = await api.get('/fees/rollover/archives');
      if (res.success) {
        setArchivesList(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load archives list:', err);
    } finally {
      setArchivesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  useEffect(() => {
    if (selectedYear) {
      fetchOverview(selectedYear);
    }
  }, [selectedYear, fetchOverview]);

  useEffect(() => {
    if (activeTab === 'archives') {
      fetchArchives();
    }
  }, [activeTab, fetchArchives]);

  // Handle Archive Execution
  const handleArchiveYear = async () => {
    if (!overview) return;
    if (overview.isArchived) {
      setError(`Academic year ${selectedYear} is already archived.`);
      return;
    }

    const confirmMsg = `Confirm Financial Archival for ${selectedYear}?\n\nThis will record an immutable snapshot of all assessed fees (₹${overview.metrics.totalAssessed}), collections (₹${overview.metrics.totalCollected}), and outstanding balances (₹${overview.metrics.totalPending}).\n\nHistorical receipts and student ledger entries remain permanently intact.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setArchiving(true);
      setError('');
      setSuccessMsg('');

      const res = await api.post('/fees/rollover/archive', {
        academicYear: selectedYear,
        notes: archiveNotes,
      });

      if (res.success) {
        setSuccessMsg(`Academic year ${selectedYear} has been successfully sealed and archived.`);
        fetchOverview(selectedYear);
        fetchArchives();
        setArchiveNotes('');
      }
    } catch (err) {
      setError(err.message || 'Failed to archive financial year.');
    } finally {
      setArchiving(false);
    }
  };

  // Handle Rollover Preview
  const handlePreviewRollover = async () => {
    if (!selectedYear || !targetYear) {
      setError('Please select both source and target academic years.');
      return;
    }
    if (selectedYear === targetYear) {
      setError('Target academic year must be distinct from source year.');
      return;
    }

    try {
      setPreviewLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await api.post('/fees/rollover/preview', {
        sourceYear: selectedYear,
        targetYear,
      });

      if (res.success) {
        setRolloverPreview(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to preview rollover.');
      setRolloverPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Copy Fee Structures
  const handleExecuteCopyStructures = async () => {
    if (!rolloverPreview) return;

    const confirmMsg = `Copy ${rolloverPreview.proposedCopies.length} fee structures from ${selectedYear} to ${targetYear}?\n\nNote: This prepares fee definitions for the new session without automatically creating student invoices or charging accounts.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setCopying(true);
      setError('');
      setSuccessMsg('');

      const res = await api.post('/fees/rollover/copy-structures', {
        sourceYear: selectedYear,
        targetYear,
      });

      if (res.success) {
        setSuccessMsg(
          `Successfully cloned ${res.data.copiedCount} fee structures to academic year ${targetYear}.`
        );
        handlePreviewRollover();
        fetchYears();
      }
    } catch (err) {
      setError(err.message || 'Failed to copy fee structures.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-200">
            <Archive size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Financial Archiving & Year Rollover
            </h1>
            <p className="text-sm text-slate-500">
              Seal completed academic-year financial ledgers, preserve student payment histories, and configure next-year fee structures.
            </p>
          </div>
        </div>

        {/* Global Year Selector & Refresh */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg shadow-sm text-xs font-semibold">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-slate-600">Active Session:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              fetchOverview(selectedYear);
              if (activeTab === 'archives') fetchArchives();
            }}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
            title="Reload overview"
          >
            <RefreshCw size={14} className={overviewLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard size={16} />
          <span>Financial Year Overview</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('rollover');
            handlePreviewRollover();
          }}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'rollover'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Copy size={16} />
          <span>New Year Preparation & Rollover</span>
        </button>

        <button
          onClick={() => setActiveTab('archives')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'archives'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={16} />
          <span>Sealed Archive Registry</span>
        </button>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-3 text-sm animate-fade-in shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-3 text-sm">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: FINANCIAL OVERVIEW & ARCHIVAL */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {overviewLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-sm">Calculating financial ledger statistics for {selectedYear}...</p>
            </div>
          ) : !overview ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              No financial data found for {selectedYear}.
            </div>
          ) : (
            <>
              {/* Archive Status Pill */}
              <div className="flex items-center justify-between bg-white border border-slate-200 px-5 py-3 rounded-xl shadow-sm">
                <div className="flex items-center space-x-2.5">
                  {overview.isArchived ? (
                    <Lock size={18} className="text-purple-600" />
                  ) : (
                    <Clock size={18} className="text-emerald-600" />
                  )}
                  <span className="font-bold text-sm text-slate-900">
                    Session {selectedYear} Status:
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      overview.isArchived
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {overview.isArchived ? 'ARCHIVED & SEALED' : 'ACTIVE / OPEN FOR TRANSACTIONS'}
                  </span>
                </div>

                {overview.isArchived && overview.archiveDetails && (
                  <span className="text-xs text-slate-500">
                    Archived on{' '}
                    {new Date(overview.archiveDetails.createdAt).toLocaleDateString()} by{' '}
                    <strong className="text-slate-700">{overview.archiveDetails.archivedBy.name}</strong>
                  </span>
                )}
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Assessed Fees</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">₹{overview.metrics.totalAssessed}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{overview.metrics.feeStructureCount} fee structures</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <CreditCard size={22} />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Collected</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">₹{overview.metrics.totalCollected}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{overview.metrics.paymentTransactionsCount} payment receipts</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <TrendingUp size={22} />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding Dues</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">₹{overview.metrics.totalPending}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{overview.metrics.studentsWithDuesCount} students pending</p>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                    <AlertTriangle size={22} />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Collection Rate</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{overview.metrics.collectionRate}%</p>
                    <p className="text-xs text-slate-400 mt-0.5">{overview.metrics.totalStudentsEnrolled} enrolled students</p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Users size={22} />
                  </div>
                </div>
              </div>

              {/* Fee Structures in this year */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <Layers size={16} className="text-blue-600" />
                    <span>Configured Fee Structures ({overview.feeStructures.length})</span>
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Structure Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Assigned Class</th>
                        <th className="py-2.5 px-3">Frequency</th>
                        <th className="py-2.5 px-3 text-right">Base Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {overview.feeStructures.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{st.name}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                              {st.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {st.class ? `${st.class.name}-${st.class.section}` : 'Institution-wide'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{st.frequency}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{st.totalAmount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Archival Action Panel (if not archived) */}
              {!overview.isArchived && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <ShieldCheck className="text-blue-600" size={18} />
                    <h3 className="font-bold text-slate-900 text-sm">Seal & Archive Financial Year</h3>
                  </div>

                  <p className="text-xs text-slate-500">
                    Archiving preserves an official permanent ledger summary of all assessed fees, collections, and outstanding dues. Historical receipts and payment allocations remain completely accessible.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Administrative Notes / Audit Remarks
                    </label>
                    <input
                      type="text"
                      value={archiveNotes}
                      onChange={(e) => setArchiveNotes(e.target.value)}
                      placeholder="e.g. End of session financial audit completed. Approved by management."
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleArchiveYear}
                      disabled={archiving}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200 transition"
                    >
                      {archiving ? <RefreshCw size={16} className="animate-spin" /> : <Archive size={16} />}
                      <span>Archive & Seal Financial Year {selectedYear}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: NEW YEAR PREPARATION & ROLLOVER */}
      {activeTab === 'rollover' && (
        <div className="space-y-6">
          {/* Mapping Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-sm flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Copy size={16} className="text-blue-600" />
              <span>Clone Fee Structures to Next Academic Year</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Source Session (From)</label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setRolloverPreview(null);
                  }}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Session (To)</label>
                <input
                  type="text"
                  value={targetYear}
                  onChange={(e) => {
                    setTargetYear(e.target.value);
                    setRolloverPreview(null);
                  }}
                  placeholder="e.g. 2027-2028"
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handlePreviewRollover}
                disabled={previewLoading || !selectedYear || !targetYear}
                className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200 transition"
              >
                {previewLoading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                <span>Preview Rollover Definitions</span>
              </button>
            </div>
          </div>

          {/* Rollover Preview */}
          {rolloverPreview && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5 animate-fade-in">
              {/* Warnings */}
              {rolloverPreview.validationWarnings.map((warn, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2"
                >
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>{warn}</span>
                </div>
              ))}

              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Proposed Fee Structures for {rolloverPreview.targetYear} ({rolloverPreview.proposedCopies.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cloning will establish baseline fee templates without creating student balance charges.
                  </p>
                </div>

                <button
                  onClick={handleExecuteCopyStructures}
                  disabled={copying || rolloverPreview.proposedCopies.length === 0}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-200 transition"
                >
                  {copying ? <RefreshCw size={16} className="animate-spin" /> : <Copy size={16} />}
                  <span>Clone Fee Structures to {rolloverPreview.targetYear}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Proposed Structure Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Mapped Class</th>
                      <th className="py-2.5 px-3">Frequency</th>
                      <th className="py-2.5 px-3 text-right">Base Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {rolloverPreview.proposedCopies.map((cp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{cp.name}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            {cp.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{cp.className}</td>
                        <td className="py-2.5 px-3 text-slate-600">{cp.frequency}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{cp.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SEALED ARCHIVES REGISTRY */}
      {activeTab === 'archives' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <History size={16} className="text-blue-600" />
              <span>Sealed Financial Archives Registry</span>
            </h2>

            <button
              onClick={fetchArchives}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              <RefreshCw size={13} className={archivesLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Academic Year</th>
                  <th className="py-3 px-4">Total Assessed</th>
                  <th className="py-3 px-4">Total Collected</th>
                  <th className="py-3 px-4">Outstanding Dues</th>
                  <th className="py-3 px-4">Archived By</th>
                  <th className="py-3 px-4">Archived Date</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {archivesLoading && archivesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Loading sealed archive records...
                    </td>
                  </tr>
                ) : archivesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No academic financial years have been sealed yet.
                    </td>
                  </tr>
                ) : (
                  archivesList.map((arc) => (
                    <tr key={arc.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                          <Lock size={12} />
                          <span>{arc.academicYear}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">₹{arc.totalAssessed}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">₹{arc.totalCollected}</td>
                      <td className="py-3 px-4 font-bold text-rose-600">₹{arc.totalPending}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {arc.archivedBy ? arc.archivedBy.name : 'Administrator'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(arc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {arc.notes || 'End of session ledger seal'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
