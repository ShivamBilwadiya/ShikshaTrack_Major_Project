import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useOffline } from '../context/OfflineContext';
import {
  CloudOff,
  Cloud,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Clock,
  Building2,
} from 'lucide-react';
import { getUnsyncedEvents, clearOfflineDatabase } from '../services/db';

export default function OfflineSync() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    savedRosters,
    syncPendingQueue,
    downloadClassRoster,
    refreshStatus,
  } = useOffline();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [unsyncedEvents, setUnsyncedEvents] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch available classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/classes');
        setClasses(res.data);
        if (res.data.length > 0) setSelectedClassId(res.data[0].id);
      } catch (err) {}
    };
    if (isOnline) fetchClasses();
  }, [isOnline]);

  // Load unsynced events from IndexedDB
  const loadQueue = async () => {
    try {
      const items = await getUnsyncedEvents();
      setUnsyncedEvents(items);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  useEffect(() => {
    loadQueue();
    refreshStatus();
  }, [pendingCount]);

  const handleDownloadRoster = async () => {
    if (!selectedClassId) return;
    try {
      setDownloading(true);
      const data = await downloadClassRoster(selectedClassId);
      setSuccessMsg(`Class ${data.class.name}-${data.class.section} (${data.students.length} students) downloaded to IndexedDB for offline scanning.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      loadQueue();
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('Clear all local offline rosters and sync queue? Unsynced events will be lost.')) {
      return;
    }
    await clearOfflineDatabase();
    setSuccessMsg('IndexedDB offline storage cleared.');
    setTimeout(() => setSuccessMsg(''), 4000);
    loadQueue();
    refreshStatus();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <CloudOff size={22} className="text-amber-500" />
            <span>Offline Operations & Synchronization Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage local IndexedDB storage, pre-download student rosters, and flush offline scan queues
          </p>
        </div>

        {/* Live Connectivity Badge */}
        <div className="flex items-center space-x-3">
          <div
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {isOnline ? (
              <>
                <Cloud size={16} className="text-emerald-600" />
                <span>Internet Connected</span>
              </>
            ) : (
              <>
                <CloudOff size={16} className="text-amber-600" />
                <span>Operating Offline</span>
              </>
            )}
          </div>

          <button
            onClick={syncPendingQueue}
            disabled={!isOnline || isSyncing || pendingCount === 0}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs disabled:opacity-50 transition"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing Queue...' : `Sync Queue (${pendingCount})`}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Last Sync Result Summary */}
      {lastSyncResult && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-sky-600" />
            <span>
              Last sync completed at <strong>{lastSyncResult.timestamp}</strong>: Synced{' '}
              <strong>{lastSyncResult.syncedCount}</strong> records, skipped{' '}
              <strong>{lastSyncResult.duplicatesCount}</strong> duplicates.
            </span>
          </div>
        </div>
      )}

      {/* Row: Pre-download Roster & Saved Rosters in IndexedDB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pre-download Roster Box */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <HardDrive size={18} className="text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900">Download Class Roster for Offline Use</h2>
          </div>
          <p className="text-xs text-slate-500">
            Before entering rural areas with poor connectivity, cache your assigned class rosters in your browser's IndexedDB.
          </p>

          <div className="flex gap-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={!isOnline || classes.length === 0}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}-{cls.section} ({cls._count?.students || 0} students)
                </option>
              ))}
            </select>

            <button
              onClick={handleDownloadRoster}
              disabled={!isOnline || downloading}
              className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 transition"
            >
              <Download size={14} />
              <span>{downloading ? 'Downloading...' : 'Save Offline'}</span>
            </button>
          </div>
        </div>

        {/* Saved Offline Rosters List */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900">Cached Rosters in IndexedDB</h2>
              <span className="text-[10px] font-mono text-slate-400">
                {savedRosters.length} rosters stored
              </span>
            </div>

            {savedRosters.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No class rosters downloaded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {savedRosters.map((r) => (
                  <div
                    key={r.classId}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-slate-900 block">{r.className}</strong>
                      <span className="text-[10px] text-slate-500">
                        {r.students?.length || 0} students &bull; Cached{' '}
                        {new Date(r.downloadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Available Offline
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleClearDatabase}
              className="flex items-center space-x-1 text-[11px] text-red-600 hover:text-red-700 font-semibold"
            >
              <Trash2 size={13} />
              <span>Reset Offline Database</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pending Synchronization Event Queue */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Pending Synchronization Queue ({unsyncedEvents.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendance records stamped on this device while disconnected from the central server
            </p>
          </div>
          {unsyncedEvents.length > 0 && isOnline && (
            <button
              onClick={syncPendingQueue}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs"
            >
              {isSyncing ? 'Syncing...' : 'Sync All to Database'}
            </button>
          )}
        </div>

        {unsyncedEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No pending offline events. Central database is fully in sync!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Event ID</th>
                  <th className="py-2.5 px-4">QR / Student Token</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Local Recorded Time</th>
                  <th className="py-2.5 px-4 text-right">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {unsyncedEvents.map((e) => (
                  <tr key={e.eventId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500">{e.eventId}</td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-800">
                      {e.qrToken || e.studentId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Pending Sync
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

