import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  X,
  BookOpen,
  MapPin,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: 'Monday', short: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { key: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { key: 'SATURDAY', label: 'Saturday', short: 'Sat' },
];

const COMMON_SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Hindi',
  'Social Science',
  'Computer Science',
  'Environmental Studies',
  'Physical Education',
  'Art & Craft',
  'Sanskrit',
];

const SUBJECT_COLORS = {
  Mathematics: 'bg-blue-50 text-blue-700 border-blue-200',
  Science: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  English: 'bg-purple-50 text-purple-700 border-purple-200',
  Hindi: 'bg-amber-50 text-amber-700 border-amber-200',
  'Social Science': 'bg-rose-50 text-rose-700 border-rose-200',
  'Computer Science': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Physical Education': 'bg-orange-50 text-orange-700 border-orange-200',
};

const getSubjectStyle = (subject) => {
  return SUBJECT_COLORS[subject] || 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function TimetableManagement() {
  const { user, isAdmin } = useAuth();

  // Data states
  const [gridData, setGridData] = useState({
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
  });
  const [summary, setSummary] = useState(null);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [activeDayFilter, setActiveDayFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [formData, setFormData] = useState({
    classId: '',
    teacherId: '',
    subject: 'Mathematics',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '09:45',
    roomNumber: 'Room 101',
    academicYear: '2026-2027',
    notes: '',
  });

  // Pre-flight Conflict State
  const [slotConflict, setSlotConflict] = useState(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  // Fetch initial classes and teachers
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [classesRes, teachersRes] = await Promise.all([
          api.get('/classes'),
          api.get('/teachers'),
        ]);
        setClasses(classesRes.data || []);
        setTeachers(teachersRes.data || []);
      } catch (err) {
        console.error('Failed to load classes/teachers metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch timetable grid based on filters
  const fetchTimetableGrid = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedClassId) params.classId = selectedClassId;
      if (selectedTeacherId) params.teacherId = selectedTeacherId;

      const res = await api.get('/timetable/weekly', { params });
      setGridData(res.data.grid || {});
      setSummary(res.data.summary || null);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetableGrid();
  }, [selectedClassId, selectedTeacherId]);

  // Live conflict pre-flight check when form fields change
  useEffect(() => {
    if (!isModalOpen) return;
    if (!formData.classId || !formData.teacherId || !formData.startTime || !formData.endTime) {
      setSlotConflict(null);
      return;
    }

    const checkTimer = setTimeout(async () => {
      try {
        setIsCheckingConflict(true);
        const res = await api.post('/timetable/validate-slot', {
          classId: formData.classId,
          teacherId: formData.teacherId,
          dayOfWeek: formData.dayOfWeek,
          startTime: formData.startTime,
          endTime: formData.endTime,
          roomNumber: formData.roomNumber || undefined,
          excludeEntryId: editingEntry ? editingEntry.id : undefined,
        });

        if (res.data.conflicts && res.data.conflicts.length > 0) {
          setSlotConflict(res.data.conflicts[0]);
        } else if (res.data.validationError) {
          setSlotConflict({ message: res.data.validationError, isValidationErr: true });
        } else {
          setSlotConflict(null);
        }
      } catch (err) {
        console.error('Pre-flight conflict check failed:', err);
      } finally {
        setIsCheckingConflict(false);
      }
    }, 300);

    return () => clearTimeout(checkTimer);
  }, [
    isModalOpen,
    formData.classId,
    formData.teacherId,
    formData.dayOfWeek,
    formData.startTime,
    formData.endTime,
    formData.roomNumber,
    editingEntry,
  ]);

  const handleOpenAdd = (day = 'MONDAY', defaultClassId = '') => {
    setEditingEntry(null);
    setSlotConflict(null);
    setFormData({
      classId: defaultClassId || selectedClassId || (classes[0] ? classes[0].id : ''),
      teacherId: selectedTeacherId || (teachers[0] ? teachers[0].id : ''),
      subject: 'Mathematics',
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '09:45',
      roomNumber: 'Room 101',
      academicYear: '2026-2027',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry) => {
    setEditingEntry(entry);
    setSlotConflict(null);
    setFormData({
      classId: entry.classId,
      teacherId: entry.teacherId,
      subject: entry.subject,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      roomNumber: entry.roomNumber || '',
      academicYear: entry.academicYear || '2026-2027',
      notes: entry.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      if (editingEntry) {
        await api.put(`/timetable/${editingEntry.id}`, formData);
        setSuccess(`Timetable entry for "${formData.subject}" updated successfully.`);
      } else {
        await api.post('/timetable', formData);
        setSuccess(`New timetable slot for "${formData.subject}" scheduled.`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(''), 4000);
      fetchTimetableGrid();
    } catch (err) {
      alert(`Scheduling failed: ${err.message}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/timetable/${id}`);
      setSuccess('Timetable entry removed.');
      setTimeout(() => setSuccess(''), 4000);
      setDeleteConfirmId(null);
      fetchTimetableGrid();
    } catch (err) {
      alert(`Failed to delete entry: ${err.message}`);
    }
  };

  // Filter entries based on search query
  const filteredGrid = useMemo(() => {
    if (!searchQuery.trim()) return gridData;
    const query = searchQuery.toLowerCase();
    const result = {};

    DAYS_OF_WEEK.forEach(({ key }) => {
      result[key] = (gridData[key] || []).filter(
        (entry) =>
          entry.subject.toLowerCase().includes(query) ||
          entry.teacher?.name.toLowerCase().includes(query) ||
          `${entry.class?.name}-${entry.class?.section}`.toLowerCase().includes(query) ||
          (entry.roomNumber && entry.roomNumber.toLowerCase().includes(query))
      );
    });

    return result;
  }, [gridData, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                School Timetable & Scheduling
              </h1>
              <p className="text-sm text-slate-500">
                Weekly class schedules, period allocation, and automated faculty conflict detection.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchTimetableGrid}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => handleOpenAdd()}
              className="flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm shadow-sky-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Class Slot</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications Alert */}
      {success && (
        <div className="flex items-center space-x-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Metrics Bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Weekly Periods
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.totalEntries}</div>
            <span className="text-xs text-sky-600 font-medium">Scheduled slots</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Subjects
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.subjectCount}</div>
            <span className="text-xs text-emerald-600 font-medium">Academic disciplines</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Faculty Deployed
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.teacherCount}</div>
            <span className="text-xs text-purple-600 font-medium">Assigned teachers</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              School Hours Span
            </span>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {summary.earliestTime} – {summary.latestTime}
            </div>
            <span className="text-xs text-amber-600 font-medium">Operating window</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Filter */}
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.section})
                </option>
              ))}
            </select>
          </div>

          {/* Teacher Filter */}
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
            >
              <option value="">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Clear */}
          {(selectedClassId || selectedTeacherId) && (
            <button
              onClick={() => {
                setSelectedClassId('');
                setSelectedTeacherId('');
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search subject, room, teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Day Selector Pills for Mobile/Tablet */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveDayFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
            activeDayFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Days
        </button>
        {DAYS_OF_WEEK.map((d) => (
          <button
            key={d.key}
            onClick={() => setActiveDayFilter(d.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeDayFilter === d.key
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {d.label} ({(filteredGrid[d.key] || []).length})
          </button>
        ))}
      </div>

      {/* Weekly Timetable Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium mt-3">Loading weekly timetable grid...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {DAYS_OF_WEEK.filter((d) => activeDayFilter === 'ALL' || activeDayFilter === d.key).map(
            ({ key: dayKey, label: dayLabel }) => {
              const entries = filteredGrid[dayKey] || [];
              return (
                <div
                  key={dayKey}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{dayLabel}</h3>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {entries.length} {entries.length === 1 ? 'Period' : 'Periods'}
                      </span>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleOpenAdd(dayKey)}
                        title={`Add period for ${dayLabel}`}
                        className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Slot Cards List */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[700px]">
                    {entries.length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl text-center p-3">
                        <Clock className="w-5 h-5 text-slate-300 mb-1" />
                        <span className="text-xs text-slate-400 font-medium">No classes scheduled</span>
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenAdd(dayKey)}
                            className="text-xs text-sky-600 hover:underline mt-2 font-semibold"
                          >
                            + Schedule Slot
                          </button>
                        )}
                      </div>
                    ) : (
                      entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="group relative bg-white border border-slate-200 hover:border-sky-300 hover:shadow-md rounded-xl p-3.5 transition flex flex-col justify-between"
                        >
                          <div>
                            {/* Subject Pill & Time */}
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getSubjectStyle(
                                  entry.subject
                                )}`}
                              >
                                {entry.subject}
                              </span>

                              {isAdmin && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                                  <button
                                    onClick={() => handleOpenEdit(entry)}
                                    title="Edit slot"
                                    className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-slate-100"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(entry.id)}
                                    title="Delete slot"
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Class and Section */}
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                              <Building2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                              <span>
                                {entry.class?.name} ({entry.class?.section})
                              </span>
                            </div>

                            {/* Teacher Name */}
                            <div className="flex items-center space-x-1.5 text-xs text-slate-600 mt-1">
                              <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{entry.teacher?.name}</span>
                            </div>

                            {/* Room Allocation */}
                            {entry.roomNumber && (
                              <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1">
                                <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span>{entry.roomNumber}</span>
                              </div>
                            )}
                          </div>

                          {/* Time Slot Footer */}
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>
                                {entry.startTime} – {entry.endTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Add / Edit Timetable Slot Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingEntry ? 'Edit Timetable Slot' : 'Schedule New Class Period'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Conflict Preview Banner */}
              {slotConflict && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
                    slotConflict.isValidationErr
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {slotConflict.isValidationErr ? 'Validation Notice' : 'Scheduling Conflict Detected'}
                    </span>
                    <p className="mt-0.5 leading-relaxed">{slotConflict.message}</p>
                  </div>
                </div>
              )}

              {/* Subject Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  list="subjects-list"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Mathematics"
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <datalist id="subjects-list">
                  {COMMON_SUBJECTS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Class & Teacher Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Class & Section *
                  </label>
                  <select
                    required
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Faculty / Teacher *
                  </label>
                  <select
                    required
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Day & Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Day of the Week *
                  </label>
                  <select
                    required
                    value={formData.dayOfWeek}
                    onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Classroom / Lab
                  </label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    placeholder="e.g. Room 101, Lab 2"
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Timings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Start Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    End Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Notes / Syllabus Unit (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Bring geometry box, Chapter 4 continuation"
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || (slotConflict && !slotConflict.isValidationErr)}
                  className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition flex items-center space-x-1.5"
                >
                  {formSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingEntry ? 'Save Changes' : 'Confirm & Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-center text-slate-900">Remove Period Slot?</h4>
            <p className="text-sm text-center text-slate-500 mt-1 mb-6">
              This timetable slot will be deleted and the time window will be marked as available for scheduling.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Keep Slot
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
