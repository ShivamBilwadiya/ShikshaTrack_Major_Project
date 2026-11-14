import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Link as LinkIcon,
  Unlink,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Plus,
  Shield,
  Heart,
} from 'lucide-react';

export default function ParentManagement() {
  const { isAdmin } = useAuth();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });

  // Auxiliary data
  const [studentsList, setStudentsList] = useState([]);
  const [classesList, setClassesList] = useState([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    guardianName: '',
    email: '',
    password: '',
    phone: '',
    alternatePhone: '',
    relationship: 'GUARDIAN',
    address: '',
    occupation: '',
    idProofNumber: '',
    studentIds: [],
  });

  // Link/Unlink Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [newLinkStudentId, setNewLinkStudentId] = useState('');
  const [newLinkRelationship, setNewLinkRelationship] = useState('GUARDIAN');
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    guardianName: '',
    phone: '',
    alternatePhone: '',
    relationship: 'GUARDIAN',
    address: '',
    occupation: '',
    status: 'ACTIVE',
  });

  const fetchParents = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.limit };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get('/parents', { params });
      setParents(res.data?.parents || []);
      if (res.data?.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load parents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParents(1);
  }, [search, statusFilter]);

  // Load students & classes for selectors
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [stdRes, clsRes] = await Promise.all([
          api.get('/students?limit=200'),
          api.get('/classes'),
        ]);
        setStudentsList(stdRes.data?.students || stdRes.data || []);
        setClassesList(clsRes.data?.classes || clsRes.data || []);
      } catch (err) {
        // Non-fatal
      }
    };
    loadMetadata();
  }, []);

  const handleCreateParent = async (e) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password || !createForm.guardianName || !createForm.phone) {
      alert('Guardian name, email, password, and phone number are required.');
      return;
    }

    try {
      setCreateSubmitting(true);
      await api.post('/parents', {
        guardianName: createForm.guardianName.trim(),
        email: createForm.email.toLowerCase().trim(),
        password: createForm.password,
        phone: createForm.phone.trim(),
        alternatePhone: createForm.alternatePhone ? createForm.alternatePhone.trim() : null,
        relationship: createForm.relationship,
        address: createForm.address ? createForm.address.trim() : null,
        occupation: createForm.occupation ? createForm.occupation.trim() : null,
        idProofNumber: createForm.idProofNumber ? createForm.idProofNumber.trim() : null,
        studentIds: createForm.studentIds,
      });

      setCreateModalOpen(false);
      setCreateForm({
        guardianName: '',
        email: '',
        password: '',
        phone: '',
        alternatePhone: '',
        relationship: 'GUARDIAN',
        address: '',
        occupation: '',
        idProofNumber: '',
        studentIds: [],
      });
      fetchParents(1);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create parent account.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenLinkModal = (parent) => {
    setSelectedParent(parent);
    setNewLinkStudentId('');
    setNewLinkRelationship(parent.relationship || 'GUARDIAN');
    setLinkModalOpen(true);
  };

  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!newLinkStudentId || !selectedParent) return;

    try {
      setLinkSubmitting(true);
      await api.post(`/parents/${selectedParent.id}/link-student`, {
        studentId: newLinkStudentId,
        relationship: newLinkRelationship,
        isPrimaryContact: true,
        canPickup: true,
      });

      // Refresh parent details
      const updatedRes = await api.get(`/parents/${selectedParent.id}`);
      setSelectedParent(updatedRes.data);
      setNewLinkStudentId('');
      fetchParents(pagination.page);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to link student.');
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleUnlinkStudent = async (studentId) => {
    if (!confirm('Are you sure you want to unlink this student from the guardian?')) return;

    try {
      setLinkSubmitting(true);
      await api.delete(`/parents/${selectedParent.id}/unlink-student/${studentId}`);
      const updatedRes = await api.get(`/parents/${selectedParent.id}`);
      setSelectedParent(updatedRes.data);
      fetchParents(pagination.page);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unlink student.');
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleOpenEditModal = (parent) => {
    setSelectedParent(parent);
    setEditForm({
      guardianName: parent.guardianName,
      phone: parent.phone,
      alternatePhone: parent.alternatePhone || '',
      relationship: parent.relationship,
      address: parent.address || '',
      occupation: parent.occupation || '',
      status: parent.status,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParent) return;

    try {
      await api.put(`/parents/${selectedParent.id}`, editForm);
      setEditModalOpen(false);
      fetchParents(pagination.page);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update parent profile.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Guardian & Parent Directory</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Parent Accounts & Student Linking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage guardian accounts, authorize family pickups, and connect students to their parents.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Guardian</span>
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Total Registered Parents</span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block">
              {pagination.totalCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Active Parent Accounts</span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block">
              {parents.filter((p) => p.status === 'ACTIVE').length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Total Linked Student Wards</span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block">
              {parents.reduce((acc, p) => acc + (p.linkedStudents?.length || 0), 0)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          {['ALL', 'ACTIVE', 'INACTIVE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by guardian name, phone, or child..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Parents Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
            Loading parent records...
          </div>
        ) : parents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">Guardian Details</th>
                  <th className="py-3 px-4 font-semibold">Contact Info</th>
                  <th className="py-3 px-4 font-semibold">Linked Children (Wards)</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parents.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                          {p.guardianName ? p.guardianName.charAt(0).toUpperCase() : 'G'}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block">{p.guardianName}</span>
                          <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                            {p.relationship}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{p.phone}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>{p.email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {p.linkedStudents && p.linkedStudents.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.linkedStudents.map((child) => (
                            <span
                              key={child.studentId}
                              className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200"
                            >
                              <GraduationCap className="w-3 h-3 text-sky-600" />
                              <span>{child.name}</span>
                              <span className="text-slate-400 text-[10px]">({child.className})</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-600 text-[11px] font-medium italic">
                          No students linked
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenLinkModal(p)}
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition"
                          title="Manage Linked Children"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                          title="Edit Guardian Details"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            No guardian accounts found. Click "Register New Guardian" to add one.
          </div>
        )}
      </div>

      {/* Register Guardian Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Register Guardian Account</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Create portal credentials and link enrolled children to the guardian.
            </p>

            <form onSubmit={handleCreateParent} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Guardian Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Sunita Devi"
                    value={createForm.guardianName}
                    onChange={(e) => setCreateForm({ ...createForm, guardianName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Relationship</label>
                  <select
                    value={createForm.relationship}
                    onChange={(e) => setCreateForm({ ...createForm, relationship: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MOTHER">Mother</option>
                    <option value="FATHER">Father</option>
                    <option value="GUARDIAN">Legal Guardian</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Login Email</label>
                  <input
                    type="email"
                    required
                    placeholder="guardian@example.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alternate Phone <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="9123456789"
                    value={createForm.alternatePhone}
                    onChange={(e) => setCreateForm({ ...createForm, alternatePhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  placeholder="Village / Ward / Street address..."
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Initial Child to Link <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <select
                  onChange={(e) => {
                    const sid = e.target.value;
                    if (sid && !createForm.studentIds.includes(sid)) {
                      setCreateForm({ ...createForm, studentIds: [...createForm.studentIds, sid] });
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Search & Choose Student --</option>
                  {studentsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNumber}) - {s.class ? `${s.class.name}-${s.class.section}` : ''}
                    </option>
                  ))}
                </select>

                {createForm.studentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {createForm.studentIds.map((sid) => {
                      const st = studentsList.find((s) => s.id === sid);
                      return (
                        <span
                          key={sid}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-semibold"
                        >
                          <span>{st?.name || sid}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setCreateForm({
                                ...createForm,
                                studentIds: createForm.studentIds.filter((id) => id !== sid),
                              })
                            }
                            className="text-indigo-400 hover:text-indigo-900"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {createSubmitting ? 'Registering...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Linked Students Modal */}
      {linkModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setLinkModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Manage Linked Wards</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Guardian: <span className="font-semibold text-slate-800">{selectedParent.guardianName}</span>
            </p>

            {/* Currently Linked */}
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700">Currently Linked Students:</h4>
              {selectedParent.linkedStudents && selectedParent.linkedStudents.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto">
                  {selectedParent.linkedStudents.map((child) => (
                    <div key={child.studentId} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 block">{child.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {child.className} • Adm: {child.admissionNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkStudent(child.studentId)}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50"
                        title="Unlink student"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No students linked currently.</p>
              )}
            </div>

            {/* Link New Student Form */}
            <form onSubmit={handleLinkStudent} className="mt-5 pt-4 border-t border-slate-100 space-y-3 text-xs">
              <h4 className="text-xs font-semibold text-slate-700">Link Another Student:</h4>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Select Student</label>
                <select
                  required
                  value={newLinkStudentId}
                  onChange={(e) => setNewLinkStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Student --</option>
                  {studentsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNumber}) - {s.class ? `${s.class.name}-${s.class.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">Relationship</label>
                <select
                  value={newLinkRelationship}
                  onChange={(e) => setNewLinkRelationship(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="MOTHER">Mother</option>
                  <option value="FATHER">Father</option>
                  <option value="GUARDIAN">Legal Guardian</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={linkSubmitting || !newLinkStudentId}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {linkSubmitting ? 'Linking...' : 'Link Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Parent Modal */}
      {editModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Edit Guardian Profile</h3>
            <p className="text-xs text-slate-500 mt-0.5">{selectedParent.email}</p>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Guardian Name</label>
                <input
                  type="text"
                  required
                  value={editForm.guardianName}
                  onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
