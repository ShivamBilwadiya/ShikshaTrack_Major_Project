import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  Plus,
  History,
  ShieldCheck,
  User,
  GraduationCap,
  Calendar,
  FileCheck,
  X,
  ChevronRight,
  FileBadge,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { value: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate' },
  { value: 'IDENTITY_PROOF', label: 'Identity Proof (Aadhaar / Passport)' },
  { value: 'ADDRESS_PROOF', label: 'Address Proof' },
  { value: 'ACADEMIC_RECORD', label: 'Academic Record / Report Card' },
  { value: 'MEDICAL_RECORD', label: 'Medical & Health Record' },
  { value: 'OTHER', label: 'Other Authorized Document' },
];

const STATUS_CONFIG = {
  VERIFIED: { label: 'Verified', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  PENDING: { label: 'Pending Review', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  REJECTED: { label: 'Rejected', bg: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  EXPIRED: { label: 'Expired', bg: 'bg-slate-100 text-slate-700 border-slate-300', icon: AlertCircle },
};

export default function DocumentManagement() {
  const { user, isAdmin } = useAuth();
  const isTeacherOrAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  // Data states
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);

  // Form states
  const [uploadForm, setUploadForm] = useState({
    studentId: '',
    title: '',
    category: 'BIRTH_CERTIFICATE',
    description: '',
    issueDate: '',
    expiryDate: '',
    file: null,
    fileName: '',
    mimeType: '',
    fileBase64: '',
  });

  const [replaceForm, setReplaceForm] = useState({
    file: null,
    fileName: '',
    mimeType: '',
    fileBase64: '',
    changeReason: '',
  });

  const [reviewForm, setReviewForm] = useState({
    status: 'VERIFIED',
    verificationNotes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load initial meta (classes, stats)
  useEffect(() => {
    fetchMetadata();
  }, []);

  // Fetch documents on filter change
  useEffect(() => {
    fetchDocuments();
  }, [page, search, selectedCategory, selectedStatus, selectedClassId]);

  const fetchMetadata = async () => {
    try {
      const [classRes, statsRes] = await Promise.all([
        api.get('/classes'),
        api.get('/documents/stats').catch(() => ({ data: null })),
      ]);
      setClasses(classRes?.data?.classes || classRes?.data || []);
      if (statsRes?.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load classes or document statistics:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 12,
      });
      if (search.trim()) params.append('search', search.trim());
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedClassId) params.append('classId', selectedClassId);

      const res = await api.get(`/documents?${params.toString()}`);
      if (res?.data) {
        setDocuments(res.data.documents || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  };

  const handleClassSelectForUpload = async (clsId) => {
    try {
      if (!clsId) {
        setStudents([]);
        return;
      }
      const res = await api.get(`/students?classId=${clsId}&limit=100`);
      setStudents(res?.data?.students || []);
    } catch (err) {
      console.error('Failed to load students for class:', err);
    }
  };

  // Convert File to Base64
  const handleFileSelect = (e, targetForm = 'upload') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the maximum allowed limit of 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (targetForm === 'upload') {
        setUploadForm((prev) => ({
          ...prev,
          file,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileBase64: base64,
          title: prev.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        }));
      } else {
        setReplaceForm((prev) => ({
          ...prev,
          file,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileBase64: base64,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.studentId || !uploadForm.title || !uploadForm.fileBase64) {
      alert('Please select student, document title, and choose a valid file.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/documents', {
        studentId: uploadForm.studentId,
        title: uploadForm.title,
        category: uploadForm.category,
        description: uploadForm.description,
        issueDate: uploadForm.issueDate || null,
        expiryDate: uploadForm.expiryDate || null,
        originalName: uploadForm.fileName,
        mimeType: uploadForm.mimeType,
        fileBase64: uploadForm.fileBase64,
      });

      setSuccessMsg(`Document "${uploadForm.title}" uploaded successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowUploadModal(false);
      setUploadForm({
        studentId: '',
        title: '',
        category: 'BIRTH_CERTIFICATE',
        description: '',
        issueDate: '',
        expiryDate: '',
        file: null,
        fileName: '',
        mimeType: '',
        fileBase64: '',
      });
      fetchDocuments();
      fetchMetadata();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaceVersionSubmit = async (e) => {
    e.preventDefault();
    if (!replaceForm.fileBase64 || !activeDoc) {
      alert('Please choose a replacement file.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/documents/${activeDoc.id}/replace`, {
        originalName: replaceForm.fileName,
        mimeType: replaceForm.mimeType,
        fileBase64: replaceForm.fileBase64,
        changeReason: replaceForm.changeReason,
      });

      setSuccessMsg(`New version uploaded for "${activeDoc.title}".`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowVersionModal(false);
      setReplaceForm({ file: null, fileName: '', mimeType: '', fileBase64: '', changeReason: '' });
      fetchDocuments();
    } catch (err) {
      alert(`Version update failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!activeDoc) return;

    try {
      setSubmitting(true);
      await api.post(`/documents/${activeDoc.id}/verify`, {
        status: reviewForm.status,
        verificationNotes: reviewForm.verificationNotes,
      });

      setSuccessMsg(`Document marked as ${reviewForm.status}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowReviewModal(false);
      fetchDocuments();
      fetchMetadata();
    } catch (err) {
      alert(`Verification review failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Are you sure you want to delete document "${doc.title}"? All versions will be deleted permanently.`)) {
      return;
    }

    try {
      await api.delete(`/documents/${doc.id}`);
      setSuccessMsg(`Document "${doc.title}" deleted.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDocuments();
      fetchMetadata();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDownload = async (doc, versionNumber = null) => {
    try {
      const token = localStorage.getItem('shiksha_token');
      const url = `/api/v1/documents/${doc.id}/download${versionNumber ? `?version=${versionNumber}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Download failed from server.');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.fileName || `${doc.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(`Failed to download: ${err.message}`);
    }
  };

  const openVersionModal = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}`);
      setActiveDoc(res.data);
      setShowVersionModal(true);
    } catch (err) {
      alert(`Failed to load versions: ${err.message}`);
    }
  };

  const openReviewModal = (doc) => {
    setActiveDoc(doc);
    setReviewForm({
      status: doc.status === 'VERIFIED' ? 'VERIFIED' : 'VERIFIED',
      verificationNotes: doc.verificationNotes || '',
    });
    setShowReviewModal(true);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
            <FileBadge size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Student Digital Document Repository</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure institutional repository, verified identity proofs, academic records, and version history.
            </p>
          </div>
        </div>

        {isTeacherOrAdmin && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus size={16} />
            <span>Upload Student Document</span>
          </button>
        )}
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Documents</span>
            <FileText size={17} className="text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.totalDocuments || totalCount || 0}</p>
          <span className="text-[11px] text-slate-400">Institutional records</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Verified Valid</span>
            <CheckCircle2 size={17} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats?.verifiedCount || 0}</p>
          <span className="text-[11px] text-emerald-700">Official authentication</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pending Review</span>
            <Clock size={17} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats?.pendingCount || 0}</p>
          <span className="text-[11px] text-amber-700">Awaiting faculty audit</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Rejected / Expired</span>
            <XCircle size={17} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">
            {(stats?.rejectedCount || 0) + (stats?.expiredCount || 0)}
          </p>
          <span className="text-[11px] text-red-700">Action required</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, student, admission..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Document Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Verification Status */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Verification Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="VERIFIED">Verified Official</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Class Filter */}
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
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

      {/* Document List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-sky-500" />
            <p className="text-xs">Loading institutional documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileText size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-700">No documents found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No student records matched your current query criteria. Try adjusting your filters or upload a document.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Document Title & Category</th>
                  <th className="py-3.5 px-4">Student & Class</th>
                  <th className="py-3.5 px-4">Version</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">File Details</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {documents.map((doc) => {
                  const statusMeta = STATUS_CONFIG[doc.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = statusMeta.icon;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                      {/* Document Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{doc.title}</div>
                        <span className="inline-block mt-0.5 text-[10px] text-slate-500 font-medium">
                          {CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}
                        </span>
                        {doc.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{doc.description}</p>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{doc.student?.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {doc.student?.class ? `${doc.student.class.name}-${doc.student.class.section}` : 'N/A'} &bull; Adm: {doc.student?.admissionNumber}
                        </div>
                      </td>

                      {/* Version Pill */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => openVersionModal(doc)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-semibold text-[11px] transition"
                        >
                          <History size={12} />
                          <span>v{doc.currentVersion}</span>
                          <span className="text-[10px] text-sky-500 font-normal">({doc._count?.versions || 1})</span>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusMeta.bg}`}
                        >
                          <StatusIcon size={12} />
                          <span>{statusMeta.label}</span>
                        </span>
                        {doc.verificationNotes && (
                          <div className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">
                            Note: {doc.verificationNotes}
                          </div>
                        )}
                      </td>

                      {/* File Details */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        <div>{formatFileSize(doc.fileSize)}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(doc.updatedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Download */}
                          <button
                            onClick={() => handleDownload(doc)}
                            title="Download document file"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition"
                          >
                            <Download size={14} />
                          </button>

                          {/* Faculty Verification Action */}
                          {isTeacherOrAdmin && (
                            <button
                              onClick={() => openReviewModal(doc)}
                              title="Audit & Verify Status"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            >
                              <ShieldCheck size={14} />
                            </button>
                          )}

                          {/* Version Replacement */}
                          {isTeacherOrAdmin && (
                            <button
                              onClick={() => openVersionModal(doc)}
                              title="Upload Replacement Version"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}

                          {/* Delete (Admin only) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(doc)}
                              title="Delete Document"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 size={14} />
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

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {page} of {totalPages} ({totalCount} total documents)
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

      {/* ========================================================================= */}
      {/* Upload Document Modal */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileBadge size={20} className="text-sky-600" />
                <h3 className="font-bold text-slate-900 text-sm">Upload Student Document</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              {/* Class & Student Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Class</label>
                  <select
                    onChange={(e) => handleClassSelectForUpload(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Student *</label>
                  <select
                    value={uploadForm.studentId}
                    onChange={(e) => setUploadForm({ ...uploadForm, studentId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.admissionNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Document Category & Title */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Document Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Birth Certificate"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or document reference identifier..."
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date of Issue</label>
                  <input
                    type="date"
                    value={uploadForm.issueDate}
                    onChange={(e) => setUploadForm({ ...uploadForm, issueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Expiry Date (if applicable)</label>
                  <input
                    type="date"
                    value={uploadForm.expiryDate}
                    onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* File Upload Dropzone */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Document File * (Max 10 MB)</label>
                <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 text-center transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={(e) => handleFileSelect(e, 'upload')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload size={22} className="mx-auto text-slate-400 mb-1" />
                  <p className="text-xs font-semibold text-slate-700">
                    {uploadForm.fileName ? uploadForm.fileName : 'Click or drag file to upload'}
                  </p>
                  <span className="text-[10px] text-slate-400">Supported: PDF, JPG, PNG, WEBP, DOCX</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {submitting ? 'Uploading...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Version History & Replacement Modal */}
      {/* ========================================================================= */}
      {showVersionModal && activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Version History: {activeDoc.title}</h3>
                <p className="text-[11px] text-slate-500">Student: {activeDoc.student?.name}</p>
              </div>
              <button
                onClick={() => setShowVersionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Existing Versions List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activeDoc.versions?.map((ver) => (
                <div
                  key={ver.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">v{ver.versionNumber}</span>
                      <span className="text-[10px] text-slate-400">&bull; {formatFileSize(ver.fileSize)}</span>
                      {ver.versionNumber === activeDoc.currentVersion && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                          ACTIVE CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{ver.changeReason || 'Uploaded'}</p>
                    <span className="text-[10px] text-slate-400">
                      Uploaded by {ver.uploadedBy?.name || 'Staff'} on{' '}
                      {new Date(ver.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDownload(activeDoc, ver.versionNumber)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-sky-50 hover:text-sky-600 rounded-lg text-[11px] font-semibold transition"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Upload New Version Section */}
            {isTeacherOrAdmin && (
              <form onSubmit={handleReplaceVersionSubmit} className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 text-[11px]">Upload Replacement Version</h4>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reason for Change *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Updated renewal copy, corrected name spelling..."
                    value={replaceForm.changeReason}
                    onChange={(e) => setReplaceForm({ ...replaceForm, changeReason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Replacement File *</label>
                  <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center relative cursor-pointer">
                    <input
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      onChange={(e) => handleFileSelect(e, 'replace')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <p className="text-[11px] font-semibold text-slate-700">
                      {replaceForm.fileName ? replaceForm.fileName : 'Select new replacement file'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                  >
                    {submitting ? 'Uploading...' : 'Publish Replacement Version'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Admin / Teacher Review Verification Modal */}
      {/* ========================================================================= */}
      {showReviewModal && activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck size={20} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Document Verification Review</h3>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p>
                <strong className="text-slate-800">Document:</strong> {activeDoc.title}
              </p>
              <p>
                <strong className="text-slate-800">Student:</strong> {activeDoc.student?.name}
              </p>
              <p>
                <strong className="text-slate-800">Current Status:</strong> {activeDoc.status}
              </p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Set Status</label>
                <select
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                >
                  <option value="VERIFIED">VERIFIED (Authenticate Official Document)</option>
                  <option value="REJECTED">REJECTED (Document Incomplete or Invalid)</option>
                  <option value="PENDING">PENDING (Keep in review queue)</option>
                  <option value="EXPIRED">EXPIRED (Document past validity date)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Verification Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Notes explaining approval reason or rejection deficiencies..."
                  value={reviewForm.verificationNotes}
                  onChange={(e) => setReviewForm({ ...reviewForm, verificationNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {submitting ? 'Saving...' : 'Apply Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
