import React, { useState, useEffect } from 'react';
import {
  Award,
  FileCheck,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  QrCode as QrCodeIcon,
  RefreshCw,
  ExternalLink,
  Copy,
  Calendar,
  User,
  GraduationCap,
  ShieldCheck,
  FileText,
  X,
  FileBadge,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import QRCode from 'qrcode';

const CERT_TYPES = [
  { value: 'BONAFIDE', label: 'Bonafide Certificate' },
  { value: 'TRANSFER', label: 'Transfer & School Leaving Certificate' },
  { value: 'CHARACTER', label: 'Conduct & Character Certificate' },
  { value: 'STUDY', label: 'Study & Enrollment Verification' },
  { value: 'FEE_CLEARANCE', label: 'Institutional Fee Clearance' },
  { value: 'ACHIEVEMENT', label: 'Academic Merit & Achievement' },
  { value: 'OTHER', label: 'Custom Certificate' },
];

export default function CertificateManagement() {
  const { user, isAdmin } = useAuth();
  const isTeacherOrAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  // Navigation tab
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'issue' | 'templates'

  // Data states
  const [certificates, setCertificates] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClassId, setFilterClassId] = useState('');

  // Issuance form
  const [issueForm, setIssueForm] = useState({
    classId: '',
    studentId: '',
    templateId: '',
    type: 'BONAFIDE',
    customTitle: '',
    customBody: '',
    signatoryTitle: 'Principal / Head of Institution',
    signatoryName: 'Authorized Signatory',
    validityMonths: '12',
    remarks: '',
  });

  const [selectedStudentMeta, setSelectedStudentMeta] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeQrCert, setActiveQrCert] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeCertId, setRevokeCertId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    id: null,
    name: '',
    type: 'BONAFIDE',
    title: '',
    bodyTemplate: '',
    signatoryTitle: 'Principal / Head of Institution',
    watermarkText: 'OFFICIAL CERTIFICATE',
    validityMonths: 12,
  });

  // Initial loading
  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchCertificates();
    } else if (activeTab === 'templates') {
      fetchTemplates();
    }
  }, [activeTab, page, search, filterType, filterStatus, filterClassId]);

  const fetchMetadata = async () => {
    try {
      const [classRes, statsRes, templateRes] = await Promise.all([
        api.get('/classes'),
        api.get('/certificates/stats').catch(() => ({ data: null })),
        api.get('/certificates/templates').catch(() => ({ data: [] })),
      ]);
      setClasses(classRes?.data?.classes || classRes?.data || []);
      if (statsRes?.data) setStats(statsRes.data);
      if (templateRes?.data) setTemplates(templateRes.data);
    } catch (err) {
      console.error('Failed to load classes/stats:', err);
    }
  };

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 12 });
      if (search.trim()) params.append('search', search.trim());
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (filterClassId) params.append('classId', filterClassId);

      const res = await api.get(`/certificates?${params.toString()}`);
      if (res?.data) {
        setCertificates(res.data.certificates || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/certificates/templates');
      setTemplates(res?.data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  // When class changes in issue form, load students
  const handleClassChangeInIssue = async (classId) => {
    setIssueForm((prev) => ({ ...prev, classId, studentId: '' }));
    setSelectedStudentMeta(null);
    if (!classId) {
      setStudents([]);
      return;
    }
    try {
      const res = await api.get(`/students?classId=${classId}&limit=100`);
      setStudents(res?.data?.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  const handleStudentSelect = (studentId) => {
    const student = students.find((s) => s.id === studentId);
    setSelectedStudentMeta(student || null);
    setIssueForm((prev) => ({ ...prev, studentId }));
  };

  // When template changes in issue form, load defaults
  const handleTemplateSelect = (templateId) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setIssueForm((prev) => ({
        ...prev,
        templateId,
        type: tmpl.type,
        customTitle: tmpl.title,
        customBody: tmpl.bodyTemplate,
        signatoryTitle: tmpl.signatoryTitle,
        signatoryName: tmpl.signatoryName || 'Authorized Signatory',
        validityMonths: tmpl.validityMonths ? String(tmpl.validityMonths) : '',
      }));
    } else {
      setIssueForm((prev) => ({ ...prev, templateId: '' }));
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueForm.studentId) {
      alert('Please select a student.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/certificates/issue', {
        studentId: issueForm.studentId,
        templateId: issueForm.templateId || null,
        type: issueForm.type,
        customTitle: issueForm.customTitle || null,
        customBody: issueForm.customBody || null,
        signatoryTitle: issueForm.signatoryTitle || null,
        signatoryName: issueForm.signatoryName || null,
        validityMonths: issueForm.validityMonths ? Number(issueForm.validityMonths) : null,
        remarks: issueForm.remarks,
      });

      const newCert = res?.data;
      setSuccessMsg(`Certificate ${newCert.certificateNumber} generated and issued!`);
      setTimeout(() => setSuccessMsg(''), 5000);

      // Offer immediate download
      handleDownloadPdf(newCert);

      // Reset form & navigate to register
      setActiveTab('register');
      fetchCertificates();
      fetchMetadata();
    } catch (err) {
      alert(`Certificate issuance failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async (cert) => {
    try {
      const token = localStorage.getItem('shiksha_token');
      const url = `/api/v1/certificates/${cert.id}/pdf`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to generate PDF from server.');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${cert.certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(`PDF download failed: ${err.message}`);
    }
  };

  const openQrModal = async (cert) => {
    setActiveQrCert(cert);
    const verifyUrl = `${window.location.origin}/verify-certificate/${cert.verificationToken}`;
    try {
      const dataUrl = await QRCode.toDataURL(verifyUrl, { width: 220, margin: 1 });
      setQrCodeDataUrl(dataUrl);
      setShowQrModal(true);
      setCopiedLink(false);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  const handleCopyVerificationLink = () => {
    if (!activeQrCert) return;
    const verifyUrl = `${window.location.origin}/verify-certificate/${activeQrCert.verificationToken}`;
    navigator.clipboard.writeText(verifyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleRevokeSubmit = async (e) => {
    e.preventDefault();
    if (!revokeReason.trim()) {
      alert('Please provide a legitimate revocation reason.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/certificates/${revokeCertId}/revoke`, {
        reason: revokeReason.trim(),
      });
      setSuccessMsg('Certificate has been revoked successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowRevokeModal(false);
      setRevokeReason('');
      fetchCertificates();
      fetchMetadata();
    } catch (err) {
      alert(`Revocation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemplateFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (templateForm.id) {
        await api.put(`/certificates/templates/${templateForm.id}`, templateForm);
        setSuccessMsg(`Template "${templateForm.name}" updated successfully.`);
      } else {
        await api.post('/certificates/templates', templateForm);
        setSuccessMsg(`Template "${templateForm.name}" created successfully.`);
      }
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowTemplateModal(false);
      fetchTemplates();
    } catch (err) {
      alert(`Template action failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditTemplate = (tmpl) => {
    setTemplateForm({
      id: tmpl.id,
      name: tmpl.name,
      type: tmpl.type,
      title: tmpl.title,
      bodyTemplate: tmpl.bodyTemplate,
      signatoryTitle: tmpl.signatoryTitle || 'Principal / Head of Institution',
      watermarkText: tmpl.watermarkText || 'OFFICIAL CERTIFICATE',
      validityMonths: tmpl.validityMonths || 12,
    });
    setShowTemplateModal(true);
  };

  const openNewTemplate = () => {
    setTemplateForm({
      id: null,
      name: '',
      type: 'BONAFIDE',
      title: 'BONAFIDE CERTIFICATE',
      bodyTemplate:
        'This is to certify that {{student_name}}, son/daughter of {{guardian_name}}, bearing Admission No: {{admission_no}}, is a bonafide pupil of {{class_name}}.',
      signatoryTitle: 'Principal / Head of Institution',
      watermarkText: 'OFFICIAL CERTIFICATE',
      validityMonths: 12,
    });
    setShowTemplateModal(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <Award size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Student Certificate Registry & Engine</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Issue printable digital certificates, tamper-evident QR verification, Bonafide & Transfer documents.
            </p>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Certificates Register
          </button>

          {isTeacherOrAdmin && (
            <button
              onClick={() => setActiveTab('issue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'issue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Issue Certificate
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'templates' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Templates
            </button>
          )}
        </div>
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Issued</span>
            <Award size={17} className="text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.totalIssued || totalCount || 0}</p>
          <span className="text-[11px] text-slate-400">Institutional certifications</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Valid</span>
            <CheckCircle2 size={17} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats?.activeCount || 0}</p>
          <span className="text-[11px] text-emerald-700">QR verifiable credentials</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Revoked / Void</span>
            <XCircle size={17} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{stats?.revokedCount || 0}</p>
          <span className="text-[11px] text-red-700">Cancelled credentials</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Templates Ready</span>
            <FileText size={17} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{templates.length || 6}</p>
          <span className="text-[11px] text-indigo-700">Bonafide, Transfer, Conduct...</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CERTIFICATES REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search cert no, student, title..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Certificate Types</option>
                {CERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active (Valid)</option>
                <option value="REVOKED">Revoked / Void</option>
              </select>

              <select
                value={filterClassId}
                onChange={(e) => {
                  setFilterClassId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}-{cls.section}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Certificates Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-sky-500" />
                <p className="text-xs">Loading certificate register...</p>
              </div>
            ) : certificates.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Award size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-700">No certificates found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No certificate records matched your query. Click "Issue Certificate" above to generate a new certificate.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4">Certificate Identifier & Title</th>
                      <th className="py-3.5 px-4">Student & Class</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Issue Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {certificates.map((cert) => {
                      const isActive = cert.status === 'ACTIVE';

                      return (
                        <tr key={cert.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 block">{cert.certificateNumber}</span>
                            <span className="text-[11px] text-slate-500 font-medium">{cert.title}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{cert.student?.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {cert.student?.class ? `${cert.student.class.name}-${cert.student.class.section}` : 'N/A'} &bull; Adm: {cert.student?.admissionNumber}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                              {cert.type}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[11px] text-slate-500">
                            {new Date(cert.issueDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="py-3.5 px-4">
                            {isActive ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <CheckCircle2 size={11} />
                                <span>VALID ACTIVE</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                                <XCircle size={11} />
                                <span>REVOKED</span>
                              </span>
                            )}
                            {cert.revocationReason && (
                              <div className="text-[10px] text-red-600 line-clamp-1 italic mt-0.5">
                                Reason: {cert.revocationReason}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center space-x-1">
                              {/* Download Printable PDF */}
                              <button
                                onClick={() => handleDownloadPdf(cert)}
                                title="Download Printable PDF Certificate"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition"
                              >
                                <Download size={14} />
                              </button>

                              {/* View QR & Verification Link */}
                              <button
                                onClick={() => openQrModal(cert)}
                                title="Digital Verification QR Code"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              >
                                <QrCodeIcon size={14} />
                              </button>

                              {/* Revoke Certificate (Admin only) */}
                              {isAdmin && isActive && (
                                <button
                                  onClick={() => {
                                    setRevokeCertId(cert.id);
                                    setShowRevokeModal(true);
                                  }}
                                  title="Revoke / Cancel Certificate"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                >
                                  <AlertTriangle size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing Page {page} of {totalPages} ({totalCount} certificates)
                </span>
                <div className="flex space-x-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ISSUE CERTIFICATE FORM */}
      {/* ========================================================================= */}
      {activeTab === 'issue' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Certificate Generation & Issuance Engine</h2>
            <p className="text-xs text-slate-500">
              Select a student, configure template body parameters, and generate an authenticated PDF certificate.
            </p>
          </div>

          <form onSubmit={handleIssueSubmit} className="space-y-5 text-xs">
            {/* Step 1: Select Student */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                <User size={15} className="text-sky-600" />
                <span>Step 1: Select Recipient Student</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Class Filter *</label>
                  <select
                    value={issueForm.classId}
                    onChange={(e) => handleClassChangeInIssue(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}-{cls.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student *</label>
                  <select
                    value={issueForm.studentId}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    required
                    disabled={!issueForm.classId}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium disabled:opacity-50"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} (Adm: {st.admissionNumber}, Roll: {st.rollNumber || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Student Profile Snapshot */}
              {selectedStudentMeta && (
                <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Name:</span>
                    <strong className="text-slate-800">{selectedStudentMeta.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Admission No:</span>
                    <strong className="text-slate-800">{selectedStudentMeta.admissionNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Guardian:</span>
                    <strong className="text-slate-800">{selectedStudentMeta.guardianName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Date of Birth:</span>
                    <strong className="text-slate-800">
                      {selectedStudentMeta.dateOfBirth
                        ? new Date(selectedStudentMeta.dateOfBirth).toLocaleDateString('en-IN')
                        : 'On Record'}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Choose Template & Configuration */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                <FileBadge size={15} className="text-amber-600" />
                <span>Step 2: Certificate Template & Particulars</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pre-built Template</label>
                  <select
                    value={issueForm.templateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Custom / Direct Configuration --</option>
                    {templates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name} ({tmpl.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Certificate Type *</label>
                  <select
                    value={issueForm.type}
                    onChange={(e) => setIssueForm({ ...issueForm, type: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {CERT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Certificate Header Title</label>
                  <input
                    type="text"
                    placeholder="e.g. BONAFIDE CERTIFICATE"
                    value={issueForm.customTitle}
                    onChange={(e) => setIssueForm({ ...issueForm, customTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Body Text */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Certificate Body Statement (Supports tokens: {'{{student_name}}'}, {'{{admission_no}}'}, {'{{class_name}}'}, {'{{guardian_name}}'})
                </label>
                <textarea
                  rows={4}
                  value={issueForm.customBody}
                  onChange={(e) => setIssueForm({ ...issueForm, customBody: e.target.value })}
                  placeholder="This is to certify that {{student_name}} is a bonafide student..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-[11px]"
                />
              </div>

              {/* Signatory & Validity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Authorized Signatory Designation</label>
                  <input
                    type="text"
                    value={issueForm.signatoryTitle}
                    onChange={(e) => setIssueForm({ ...issueForm, signatoryTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Signatory Name</label>
                  <input
                    type="text"
                    value={issueForm.signatoryName}
                    onChange={(e) => setIssueForm({ ...issueForm, signatoryName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Validity (Months)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    placeholder="e.g. 12 (blank for indefinite)"
                    value={issueForm.validityMonths}
                    onChange={(e) => setIssueForm({ ...issueForm, validityMonths: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-1.5 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 transition"
              >
                <Sparkles size={16} />
                <span>{submitting ? 'Generating...' : 'Issue & Generate PDF Certificate'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TEMPLATES MANAGER */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Institutional certificate formats and standard boilerplate statements.
            </p>
            {isAdmin && (
              <button
                onClick={openNewTemplate}
                className="flex items-center space-x-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
              >
                <Plus size={14} />
                <span>Create Custom Template</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {tmpl.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {tmpl._count?.issuedCertificates || 0} issued
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{tmpl.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-3 italic">
                    "{tmpl.bodyTemplate}"
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{tmpl.signatoryTitle}</span>
                  {isAdmin && (
                    <button
                      onClick={() => openEditTemplate(tmpl)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold transition"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QR Code Verification Station */}
      {/* ========================================================================= */}
      {showQrModal && activeQrCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-900">Certificate Digital Verification</span>
              <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl inline-block mx-auto border border-slate-200">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Certificate Verification QR" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400">Loading QR...</div>
              )}
            </div>

            <div>
              <p className="font-bold text-slate-900 text-xs">{activeQrCert.certificateNumber}</p>
              <p className="text-[11px] text-slate-500">
                {activeQrCert.student?.name} &bull; {activeQrCert.title}
              </p>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl text-[10px] text-slate-500 break-all font-mono">
              Token: {activeQrCert.verificationToken}
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                onClick={handleCopyVerificationLink}
                className="flex-1 flex items-center justify-center space-x-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                <Copy size={13} />
                <span>{copiedLink ? 'Link Copied!' : 'Copy Verification URL'}</span>
              </button>

              <a
                href={`/verify-certificate/${activeQrCert.verificationToken}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center space-x-1 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl transition"
              >
                <ExternalLink size={13} />
                <span>Verify Live</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Revocation Reason */}
      {/* ========================================================================= */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle size={20} />
                <h3 className="font-bold text-slate-900 text-sm">Revoke Issued Certificate</h3>
              </div>
              <button onClick={() => setShowRevokeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Revoking this certificate permanently marks it as VOID on public verification queries. An immutable audit trail is recorded.
            </p>

            <form onSubmit={handleRevokeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Official Revocation Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Student transferred to another institution, administrative cancellation..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {submitting ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Template Form */}
      {/* ========================================================================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {templateForm.id ? 'Edit Certificate Template' : 'New Certificate Template'}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTemplateFormSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Bonafide 2026"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Type *</label>
                  <select
                    value={templateForm.type}
                    onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {CERT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Header Title *</label>
                  <input
                    type="text"
                    required
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Body Template Text *</label>
                <textarea
                  rows={4}
                  required
                  value={templateForm.bodyTemplate}
                  onChange={(e) => setTemplateForm({ ...templateForm, bodyTemplate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Signatory Title</label>
                  <input
                    type="text"
                    value={templateForm.signatoryTitle}
                    onChange={(e) => setTemplateForm({ ...templateForm, signatoryTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Validity (Months)</label>
                  <input
                    type="number"
                    value={templateForm.validityMonths || ''}
                    onChange={(e) => setTemplateForm({ ...templateForm, validityMonths: e.target.value })}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {submitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
