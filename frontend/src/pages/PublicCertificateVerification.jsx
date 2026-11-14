import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Search,
  CheckCircle2,
  Building2,
  Calendar,
  User,
  GraduationCap,
  Award,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';

export default function PublicCertificateVerification() {
  const { tokenOrCertNo } = useParams();
  const [queryInput, setQueryInput] = useState(tokenOrCertNo || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tokenOrCertNo) {
      setQueryInput(tokenOrCertNo);
      performVerification(tokenOrCertNo);
    }
  }, [tokenOrCertNo]);

  const performVerification = async (token) => {
    if (!token || !token.trim()) return;

    try {
      setLoading(true);
      setError('');
      setSearched(true);

      const response = await fetch(`/api/v1/certificates/verify/${encodeURIComponent(token.trim())}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data.data);
      } else {
        setResult(data.data || { isValid: false, status: 'NOT_FOUND', message: data.message });
      }
    } catch (err) {
      setError('Unable to connect to verification registry. Please check network connectivity.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (queryInput.trim()) {
      performVerification(queryInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center font-bold text-white shadow-lg">
            ST
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-white tracking-tight">ShikshaTrack National Portal</h1>
            <p className="text-xs text-sky-400">Institutional Certificate Verification Registry</p>
          </div>
        </div>

        <Link
          to="/login"
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 transition"
        >
          <ArrowLeft size={13} />
          <span>Staff Login</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl w-full mx-auto my-8 space-y-6">
        {/* Verification Query Box */}
        <div className="p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-white">Authenticate Digital Certificate</h2>
            <p className="text-xs text-slate-400">
              Enter the unique certificate number or scan token to verify academic authenticity.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Enter Certificate No (e.g. ST-2026-BON-XXXX) or Token..."
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !queryInput.trim()}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow transition shrink-0"
            >
              {loading ? 'Checking...' : 'Verify'}
            </button>
          </form>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Verification Result Card */}
        {loading && (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw size={28} className="animate-spin mx-auto text-sky-400" />
            <p className="text-xs">Querying ShikshaTrack Central Registry...</p>
          </div>
        )}

        {!loading && searched && result && (
          <div className="p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl space-y-5 animate-in fade-in duration-300">
            {/* Status Header */}
            {result.isValid ? (
              <div className="flex items-center space-x-3.5 p-4 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300">
                <ShieldCheck size={32} className="text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-emerald-200">OFFICIALLY AUTHENTIC & VALID</h3>
                  <p className="text-xs text-emerald-400/90 mt-0.5">
                    This certificate is recorded as authentic in the ShikshaTrack institutional database.
                  </p>
                </div>
              </div>
            ) : result.status === 'REVOKED' ? (
              <div className="flex items-center space-x-3.5 p-4 rounded-xl bg-red-950/60 border border-red-700/60 text-red-300">
                <AlertTriangle size={32} className="text-red-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-red-200">CERTIFICATE REVOKED / CANCELLED</h3>
                  <p className="text-xs text-red-400/90 mt-0.5">
                    This certificate has been cancelled by institutional authorities and is no longer valid.
                  </p>
                  {result.revocation && (
                    <p className="text-xs text-red-300 font-semibold mt-1">
                      Reason: {result.revocation.reason} (Revoked on {new Date(result.revocation.revokedAt).toLocaleDateString()})
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3.5 p-4 rounded-xl bg-amber-950/60 border border-amber-700/60 text-amber-300">
                <XCircle size={32} className="text-amber-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-amber-200">RECORD NOT FOUND</h3>
                  <p className="text-xs text-amber-400/90 mt-0.5">
                    {result.message || 'The requested certificate identifier could not be verified in our records.'}
                  </p>
                </div>
              </div>
            )}

            {/* Certificate Details Table */}
            {result.certificateNumber && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                  Institutional Record Summary
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/70 p-4 rounded-xl border border-slate-700/60">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Certificate No:</span>
                    <strong className="font-mono text-white text-xs">{result.certificateNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Certificate Title:</span>
                    <strong className="text-white text-xs">{result.title}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Student Name:</span>
                    <strong className="text-white text-xs">{result.studentName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Admission No:</span>
                    <strong className="text-white text-xs">{result.admissionNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Class & Section:</span>
                    <strong className="text-white text-xs">{result.className}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Issuing Institution:</span>
                    <strong className="text-white text-xs">{result.schoolName} ({result.schoolCode})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Date of Issue:</span>
                    <strong className="text-white text-xs">
                      {new Date(result.issueDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Signatory:</span>
                    <strong className="text-white text-xs">{result.signatoryTitle}</strong>
                  </div>
                </div>

                <div className="text-right text-[10px] text-slate-500">
                  Verified timestamp: {new Date(result.verifiedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 border-t border-slate-800 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} ShikshaTrack Smart Education Platform. All rights reserved.</p>
        <p className="text-[10px] text-slate-600 mt-1">
          Secured Digital Document Verification Architecture. Designed for rural and standardized education institutions.
        </p>
      </footer>
    </div>
  );
}
