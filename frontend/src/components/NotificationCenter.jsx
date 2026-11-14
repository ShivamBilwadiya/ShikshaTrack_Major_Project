import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  X,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('UNREAD');
  const dropdownRef = useRef(null);

  // Fetch summary count on mount and interval
  const fetchSummary = async () => {
    try {
      const res = await api.get('/notifications/summary');
      setSummary(res.data);
    } catch {
      // Ignore background badge errors
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = {
        limit: 15,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      if (activeCategory !== 'ALL') params.category = activeCategory;
      if (filterStatus !== 'ALL') params.status = filterStatus;

      const res = await api.get('/notifications', { params });
      setNotifications(res.data.notifications || []);
      if (res.data.summary) {
        setSummary((prev) => ({ ...prev, ...res.data.summary }));
      }
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 60000); // 1 min poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, activeCategory, filterStatus]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      fetchSummary();
    } catch (err) {
      alert(err.message || 'Failed to mark as read.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all', { category: activeCategory });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      fetchSummary();
    } catch (err) {
      alert(err.message || 'Failed to mark all as read.');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchSummary();
    } catch (err) {
      alert(err.message || 'Failed to dismiss notification.');
    }
  };

  const handleGenerateAlerts = async () => {
    try {
      setGenerating(true);
      await api.post('/notifications/generate-alerts');
      await Promise.all([fetchSummary(), fetchNotifications()]);
    } catch (err) {
      alert(err.message || 'Failed to run alert scan.');
    } finally {
      setGenerating(false);
    }
  };

  const unreadCount = summary?.unreadCount || 0;
  const urgentCount = summary?.urgentCount || 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition ${
          isOpen
            ? 'bg-sky-100 text-sky-800'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title="School Notifications & Alerts"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full text-white shadow-xs ${
              urgentCount > 0 ? 'bg-rose-600 animate-pulse' : 'bg-sky-600'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell size={17} className="text-sky-400" />
              <h2 className="text-sm font-bold tracking-tight">Notifications & Alerts</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500 text-slate-950">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleGenerateAlerts}
                disabled={generating}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold transition disabled:opacity-50"
                title="Scan database for low attendance & unclosed sessions"
              >
                <Sparkles size={12} className={generating ? 'animate-spin' : ''} />
                <span>{generating ? 'Scanning...' : 'Scan Alerts'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs">
            {/* Category Pills */}
            <div className="flex items-center space-x-1">
              {['ALL', 'URGENT', 'WARNING', 'INFO'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                    activeCategory === cat
                      ? cat === 'URGENT'
                        ? 'bg-rose-100 text-rose-800'
                        : cat === 'WARNING'
                        ? 'bg-amber-100 text-amber-800'
                        : cat === 'INFO'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Status toggle & mark all */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilterStatus(filterStatus === 'UNREAD' ? 'ALL' : 'UNREAD')}
                className="text-[10px] font-semibold text-slate-600 hover:text-slate-900"
              >
                {filterStatus === 'UNREAD' ? 'Show All' : 'Only Unread'}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-0.5"
                  title="Mark all as read"
                >
                  <CheckCheck size={12} />
                  <span>Mark All Read</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[420px]">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw size={22} className="animate-spin text-sky-600 mb-2" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400 px-6">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-semibold text-slate-600">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No {activeCategory !== 'ALL' ? activeCategory.toLowerCase() : ''} notifications matching your current filters.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUrgent = notif.category === 'URGENT';
                const isWarning = notif.category === 'WARNING';
                const isSuccess = notif.category === 'SUCCESS';

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 transition flex items-start space-x-3 ${
                      !notif.isRead
                        ? isUrgent
                          ? 'bg-rose-50/70 hover:bg-rose-50'
                          : isWarning
                          ? 'bg-amber-50/60 hover:bg-amber-50'
                          : 'bg-sky-50/50 hover:bg-sky-50'
                        : 'hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    {/* Category Icon */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isUrgent
                          ? 'bg-rose-100 text-rose-700'
                          : isWarning
                          ? 'bg-amber-100 text-amber-700'
                          : isSuccess
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {isUrgent ? (
                        <AlertCircle size={15} />
                      ) : isWarning ? (
                        <AlertTriangle size={15} />
                      ) : isSuccess ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Info size={15} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4
                          className={`text-xs font-bold truncate ${
                            !notif.isRead ? 'text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(notif.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      {/* Metadata Pill */}
                      {notif.metadata?.className && (
                        <div className="mt-1 flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold">
                            {notif.metadata.className}
                          </span>
                          {notif.metadata?.attendanceRate !== undefined && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                notif.metadata.attendanceRate < 75
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {notif.metadata.attendanceRate}% Attendance
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-center space-y-1 shrink-0 pt-0.5">
                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-100/50 transition"
                          title="Mark as read"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(notif.id, e)}
                        className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Dismiss"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-400 font-medium">
              ShikshaTrack Realtime Alert & Early-Warning System
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
