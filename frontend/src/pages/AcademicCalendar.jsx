import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  X,
  Flag,
  GraduationCap,
  BookOpen,
  CalendarDays,
} from 'lucide-react';

const EVENT_TYPES = [
  { key: 'HOLIDAY', label: 'Holiday', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  { key: 'EXAM', label: 'Examination', color: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
  { key: 'EVENT', label: 'School Event', color: 'bg-sky-100 text-sky-800 border-sky-300', dot: 'bg-sky-500' },
  { key: 'ACADEMIC', label: 'Academic Term', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
];

const getTypeBadge = (type) => {
  const match = EVENT_TYPES.find((t) => t.key === type);
  return match || { label: type, color: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-500' };
};

export default function AcademicCalendar() {
  const { isAdmin } = useAuth();

  // Navigation State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'HOLIDAY',
    startDate: '',
    endDate: '',
    isHoliday: true,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch events for current month span
  const fetchMonthEvents = async () => {
    try {
      setLoading(true);
      const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const res = await api.get('/calendar', {
        params: { startDate: firstDay, endDate: lastDay },
      });
      setEvents(res.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load academic events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthEvents();
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleOpenAdd = (dateStr = '') => {
    const defaultDate = dateStr || new Date().toISOString().split('T')[0];
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      type: 'HOLIDAY',
      startDate: defaultDate,
      endDate: defaultDate,
      isHoliday: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (evt) => {
    setEditingEvent(evt);
    setFormData({
      title: evt.title,
      description: evt.description || '',
      type: evt.type,
      startDate: evt.startDate.split('T')[0],
      endDate: evt.endDate.split('T')[0],
      isHoliday: evt.isHoliday,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingEvent) {
        await api.put(`/calendar/${editingEvent.id}`, formData);
        setSuccess(`Academic event "${formData.title}" updated.`);
      } else {
        await api.post('/calendar', formData);
        setSuccess(`Event "${formData.title}" added to academic calendar.`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(''), 4000);
      fetchMonthEvents();
    } catch (err) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/calendar/${id}`);
      setSuccess('Event removed from academic calendar.');
      setTimeout(() => setSuccess(''), 4000);
      setDeleteConfirmId(null);
      fetchMonthEvents();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Calendar Days Computation
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map events by day
  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((evt) => {
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) {
          const dayNum = d.getDate();
          if (!map[dayNum]) map[dayNum] = [];
          // Avoid duplicate event tags on multi-day
          if (!map[dayNum].some((e) => e.id === evt.id)) {
            map[dayNum].push(evt);
          }
        }
      }
    });
    return map;
  }, [events, month, year]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Calendar</h1>
            <p className="text-sm text-slate-500">
              Manage school terms, statutory holidays, board exams, and cultural assemblies.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchMonthEvents}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => handleOpenAdd()}
              className="flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event / Holiday</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="flex items-center space-x-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Month Navigator & Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-bold text-slate-900 min-w-44 text-center">{monthName}</span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Today
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {EVENT_TYPES.map((t) => (
            <div key={t.key} className="flex items-center space-x-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
              <span className="text-slate-600 font-medium">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Day Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-600 uppercase py-2.5">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
          {/* Empty prefix cells */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-28 bg-slate-50/50 p-2" />
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayEvents = eventsByDay[dayNum] || [];
            const isToday =
              new Date().getDate() === dayNum &&
              new Date().getMonth() === month &&
              new Date().getFullYear() === year;

            return (
              <div
                key={dayNum}
                className={`min-h-28 p-2 flex flex-col justify-between hover:bg-slate-50/80 transition ${
                  isToday ? 'bg-sky-50/40 ring-1 ring-inset ring-sky-300' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                      isToday ? 'bg-sky-600 text-white' : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() =>
                        handleOpenAdd(
                          `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                        )
                      }
                      title="Add event on this date"
                      className="text-slate-300 hover:text-emerald-600 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Day's Event Badges */}
                <div className="mt-1 space-y-1 flex-1 overflow-y-auto max-h-20">
                  {dayEvents.map((evt) => {
                    const badge = getTypeBadge(evt.type);
                    return (
                      <div
                        key={evt.id}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex items-center justify-between group cursor-pointer ${badge.color}`}
                        onClick={() => isAdmin && handleOpenEdit(evt)}
                        title={evt.description || evt.title}
                      >
                        <span className="truncate">{evt.title}</span>
                        {isAdmin && (
                          <div className="opacity-0 group-hover:opacity-100 ml-1 flex items-center space-x-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(evt.id);
                              }}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingEvent ? 'Edit Academic Event' : 'Add Academic Event / Holiday'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day Holiday"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Event Category *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value,
                      isHoliday: e.target.value === 'HOLIDAY',
                    })
                  }
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Description / Circular Note
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details or administrative advisory"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isHoliday"
                  checked={formData.isHoliday}
                  onChange={(e) => setFormData({ ...formData, isHoliday: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isHoliday" className="text-xs font-medium text-slate-700">
                  School closed for students & teachers (Non-instructional holiday)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingEvent ? 'Save Changes' : 'Add Event'}</span>
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
            <h4 className="text-lg font-bold text-slate-900 text-center">Remove Academic Event?</h4>
            <p className="text-sm text-slate-500 text-center mt-1 mb-6">
              This event will be deleted from the school calendar.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
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
