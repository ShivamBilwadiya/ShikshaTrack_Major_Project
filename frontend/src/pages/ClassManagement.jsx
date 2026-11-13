import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Building2,
  Plus,
  Users,
  GraduationCap,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [formData, setFormData] = useState({
    name: 'Class 8',
    section: 'A',
    academicYear: '2026-2027',
  });

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/classes');
      setClasses(res.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch classes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleOpenAdd = () => {
    setEditingClass(null);
    setFormData({ name: 'Class 8', section: 'C', academicYear: '2026-2027' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cls) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      section: cls.section,
      academicYear: cls.academicYear,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClass) {
        await api.put(`/classes/${editingClass.id}`, formData);
        setSuccess(`Class ${formData.name}-${formData.section} updated!`);
      } else {
        await api.post('/classes', formData);
        setSuccess(`Class ${formData.name}-${formData.section} created!`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(''), 4000);
      fetchClasses();
    } catch (err) {
      alert(`Operation failed: ${err.message}`);
    }
  };

  const handleDelete = async (id, name, section, studentCount) => {
    if (studentCount > 0) {
      alert(`Cannot delete ${name}-${section}: Contains ${studentCount} active enrolled students. Reassign students first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${name}-${section}?`)) {
      return;
    }

    try {
      await api.delete(`/classes/${id}`);
      setSuccess(`Class deleted successfully.`);
      setTimeout(() => setSuccess(''), 4000);
      fetchClasses();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Class Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure grades, academic sections, and monitor student capacity
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 shadow-sm transition"
        >
          <Plus size={15} />
          <span>Add New Class</span>
        </button>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Classes Grid */}
      {loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading classes...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 text-xs">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => {
            const studentCount = cls._count.students;
            const teachers = cls.teacherAssignments.map((ta) => ta.teacher.name).join(', ') || 'Unassigned';

            return (
              <div
                key={cls.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                      {cls.academicYear}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEdit(cls)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title="Edit Class"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(cls.id, cls.name, cls.section, studentCount)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete Class"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h2 className="text-xl font-extrabold text-slate-900">
                    {cls.name} <span className="text-sky-600">({cls.section})</span>
                  </h2>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center space-x-1.5">
                        <GraduationCap size={14} className="text-slate-400" />
                        <span>Enrolled Students</span>
                      </span>
                      <strong className="text-slate-900 font-bold">{studentCount}</strong>
                    </div>

                    <div className="flex items-start justify-between text-slate-600">
                      <span className="flex items-center space-x-1.5 shrink-0">
                        <Users size={14} className="text-slate-400" />
                        <span>Faculty</span>
                      </span>
                      <span className="text-slate-900 font-medium text-right truncate max-w-[150px]">
                        {teachers}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Sessions: {cls._count.attendanceSessions}</span>
                  <span className="text-emerald-600 font-semibold">Active Grade</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingClass ? 'Edit Class' : 'Add New Class'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Grade / Class Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Class 8"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Section
                </label>
                <input
                  type="text"
                  required
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="e.g. A"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  required
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  placeholder="e.g. 2026-2027"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-xs"
                >
                  {editingClass ? 'Update Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

