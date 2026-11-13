import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Users,
  Plus,
  Building2,
  CheckCircle2,
  XCircle,
  Edit,
  RefreshCw,
  X,
  Mail,
  Shield,
} from 'lucide-react';

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Forms
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    assignedClassIds: [],
  });

  const [assignClassIds, setAssignClassIds] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [teachersRes, classesRes] = await Promise.all([
        api.get('/teachers'),
        api.get('/classes'),
      ]);
      setTeachers(teachersRes.data);
      setClasses(classesRes.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load faculty information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (teacherId) => {
    try {
      await api.patch(`/teachers/${teacherId}/toggle-status`);
      setSuccess('Teacher account status updated.');
      setTimeout(() => setSuccess(''), 4000);
      fetchData();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    try {
      await api.post('/teachers', addForm);
      setSuccess(`Account created for ${addForm.name}!`);
      setIsAddModalOpen(false);
      setAddForm({ name: '', email: '', password: '', assignedClassIds: [] });
      setTimeout(() => setSuccess(''), 4000);
      fetchData();
    } catch (err) {
      alert(`Error creating teacher: ${err.message}`);
    }
  };

  const handleOpenAssignModal = (teacher) => {
    setSelectedTeacher(teacher);
    setAssignClassIds(teacher.teacherAssignments.map((a) => a.classId));
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignments = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/teachers/${selectedTeacher.id}/assignments`, {
        classIds: assignClassIds,
      });
      setSuccess(`Class assignments updated for ${selectedTeacher.name}!`);
      setIsAssignModalOpen(false);
      setTimeout(() => setSuccess(''), 4000);
      fetchData();
    } catch (err) {
      alert(`Error updating assignments: ${err.message}`);
    }
  };

  const toggleClassSelect = (classId) => {
    setAssignClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Faculty Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage teacher profiles and grant class-level attendance authorizations
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 shadow-sm transition"
        >
          <Plus size={15} />
          <span>Add New Teacher</span>
        </button>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Teachers List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading faculty records...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-xs">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Teacher Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Assigned Classes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{teacher.name}</span>
                          <span className="text-[10px] text-slate-400">Class In-charge</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <Mail size={13} className="text-slate-400" />
                        <span>{teacher.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {teacher.teacherAssignments.length === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">No classes assigned</span>
                        ) : (
                          teacher.teacherAssignments.map((ta) => (
                            <span
                              key={ta.classId}
                              className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-100 text-[10px] font-bold"
                            >
                              {ta.class.name}-{ta.class.section}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          teacher.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {teacher.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenAssignModal(teacher)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 text-[11px] font-semibold transition"
                        >
                          Assign Classes
                        </button>
                        <button
                          onClick={() => handleToggleStatus(teacher.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition"
                          title="Toggle active status"
                        >
                          <Shield size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Teacher Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Register New Faculty Account</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Meera Bai"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="meera.teacher@shikshatrack.in"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                >
                  Create Teacher Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Classes Modal */}
      {isAssignModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Assign Classes</h3>
                <p className="text-xs text-slate-500 mt-0.5">Authorize {selectedTeacher.name}</p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAssignments} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Select the classes that this faculty member is permitted to take attendance for:
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {classes.map((cls) => {
                  const isChecked = assignClassIds.includes(cls.id);
                  return (
                    <label
                      key={cls.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        isChecked
                          ? 'bg-sky-50 border-sky-300 text-sky-950 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleClassSelect(cls.id)}
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span>
                          {cls.name}-{cls.section} ({cls.academicYear})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {cls._count.students} students
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                >
                  Save Class Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

