import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  saveOfflineRoster,
  getOfflineRoster,
  listOfflineRosters,
  enqueueOfflineEvent,
  getUnsyncedEvents,
  markEventsSynced,
} from '../services/db';

const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [savedRosters, setSavedRosters] = useState([]);

  // Refresh pending count and saved rosters
  const refreshStatus = useCallback(async () => {
    try {
      const unsynced = await getUnsyncedEvents();
      setPendingCount(unsynced.length);
      const rosters = await listOfflineRosters();
      setSavedRosters(rosters);
    } catch (err) {
      console.error('Failed to load offline status:', err);
    }
  }, []);

  // Sync pending offline events with server
  const syncPendingQueue = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    try {
      setIsSyncing(true);
      const unsynced = await getUnsyncedEvents();

      if (unsynced.length === 0) {
        setIsSyncing(false);
        return;
      }

      const res = await api.post('/sync/batch', { events: unsynced });
      const syncedEventIds = unsynced.map((e) => e.eventId);
      await markEventsSynced(syncedEventIds);

      setLastSyncResult({
        timestamp: new Date().toLocaleTimeString(),
        syncedCount: res.data.syncedCount,
        duplicatesCount: res.data.duplicatesCount,
        failedCount: res.data.failedCount,
      });

      await refreshStatus();
    } catch (err) {
      console.error('Offline synchronization failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshStatus]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when network reconnects
      syncPendingQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingQueue, refreshStatus]);

  // Download class roster into IndexedDB
  const downloadClassRoster = async (classId) => {
    const res = await api.get(`/sync/roster/${classId}`);
    await saveOfflineRoster(res.data);
    await refreshStatus();
    return res.data;
  };

  // Record attendance offline
  const recordOfflineAttendance = async (attendanceEvent) => {
    const item = await enqueueOfflineEvent(attendanceEvent);
    await refreshStatus();
    return item;
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        lastSyncResult,
        savedRosters,
        syncPendingQueue,
        downloadClassRoster,
        recordOfflineAttendance,
        getOfflineRoster,
        refreshStatus,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

