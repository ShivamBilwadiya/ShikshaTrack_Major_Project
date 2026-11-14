import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  saveOfflineRoster,
  getOfflineRoster,
  listOfflineRosters,
  enqueueOfflineEvent,
  getUnsyncedEvents,
  getAllQueueEvents,
  updateOfflineEventStatus,
  markEventsSynced,
  saveConflictRecord,
} from '../services/db';

const OfflineContext = createContext(null);

const MAX_AUTO_RETRIES = 5;

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(() => {
    return localStorage.getItem('shiksha_last_sync') || null;
  });
  const [savedRosters, setSavedRosters] = useState([]);
  const [queueItems, setQueueItems] = useState([]);

  // Refresh status from IndexedDB
  const refreshStatus = useCallback(async () => {
    try {
      const allQueue = await getAllQueueEvents();
      setQueueItems(allQueue);

      const unsynced = allQueue.filter((item) => item.status === 'PENDING' || !item.synced);
      const failed = allQueue.filter((item) => item.status === 'FAILED');
      const conflicts = allQueue.filter((item) => item.status === 'CONFLICT');

      setPendingCount(unsynced.length);
      setFailedCount(failed.length);
      setConflictCount(conflicts.length);

      const rosters = await listOfflineRosters();
      setSavedRosters(rosters);
    } catch (err) {
      console.error('Failed to load offline status:', err);
    }
  }, []);

  // Sync batch with exponential backoff
  const syncPendingQueue = useCallback(async (isManualRetry = false) => {
    if (isSyncing || !navigator.onLine) return;

    try {
      setIsSyncing(true);
      const allQueue = await getAllQueueEvents();
      const eventsToSync = allQueue.filter(
        (item) => item.status === 'PENDING' || (isManualRetry && item.status === 'FAILED')
      );

      if (eventsToSync.length === 0) {
        setIsSyncing(false);
        return;
      }

      setSyncProgress({ current: 0, total: eventsToSync.length });

      // Mark items as SYNCING in IndexedDB
      await Promise.all(
        eventsToSync.map((e) =>
          updateOfflineEventStatus(e.eventId, { status: 'SYNCING' })
        )
      );

      // Transmit batch
      const res = await api.post('/sync/batch', {
        events: eventsToSync.map((e) => ({
          operationId: e.operationId || e.eventId,
          eventId: e.eventId,
          classId: e.classId,
          studentId: e.studentId,
          qrToken: e.qrToken,
          status: e.status || 'PRESENT',
          timestamp: e.timestamp,
          remarks: e.remarks,
          retryCount: e.retryCount || 0,
        })),
      });

      const data = res.data;
      const results = data.results || [];

      // Update per-operation states
      const syncedIds = [];
      for (const r of results) {
        const matchingEvent = eventsToSync.find(
          (e) => e.eventId === r.eventId || e.operationId === r.operationId
        );
        if (!matchingEvent) continue;

        if (r.success) {
          if (r.hasConflict && !r.conflictResolved) {
            await updateOfflineEventStatus(matchingEvent.eventId, {
              status: 'CONFLICT',
              conflictData: {
                currentStatus: r.currentStatus,
                requestedStatus: matchingEvent.status,
                recordId: r.recordId,
              },
            });
            await saveConflictRecord({
              id: r.conflictId || matchingEvent.eventId,
              eventId: matchingEvent.eventId,
              studentName: r.studentName,
              currentStatus: r.currentStatus,
              requestedStatus: matchingEvent.status,
              timestamp: new Date().toISOString(),
            });
          } else {
            syncedIds.push(matchingEvent.eventId);
          }
        } else {
          // Failure handling with retry count
          const nextRetry = (matchingEvent.retryCount || 0) + 1;
          await updateOfflineEventStatus(matchingEvent.eventId, {
            status: nextRetry >= MAX_AUTO_RETRIES ? 'FAILED' : 'PENDING',
            retryCount: nextRetry,
            lastError: r.error || 'Sync transmission failed',
          });
        }
      }

      if (syncedIds.length > 0) {
        await markEventsSynced(syncedIds);
      }

      const nowIso = new Date().toISOString();
      setLastSyncTimestamp(nowIso);
      localStorage.setItem('shiksha_last_sync', nowIso);

      setLastSyncResult({
        timestamp: new Date().toLocaleTimeString(),
        syncedCount: data.syncedCount,
        duplicatesCount: data.duplicatesCount,
        conflictsCount: data.conflictsCount,
        conflictsResolvedCount: data.conflictsResolvedCount,
        failedCount: data.failedCount,
      });

      await refreshStatus();
    } catch (err) {
      console.error('Offline synchronization failed:', err);
      // Revert SYNCING to FAILED/PENDING
      const allQueue = await getAllQueueEvents();
      await Promise.all(
        allQueue
          .filter((item) => item.status === 'SYNCING')
          .map((item) =>
            updateOfflineEventStatus(item.eventId, {
              status: (item.retryCount || 0) + 1 >= MAX_AUTO_RETRIES ? 'FAILED' : 'PENDING',
              retryCount: (item.retryCount || 0) + 1,
              lastError: err.message,
            })
          )
      );
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  }, [isSyncing, refreshStatus]);

  // Network connection listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when connectivity returns
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

  // Retry failed queue items manually
  const retryFailedQueue = async () => {
    return await syncPendingQueue(true);
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingCount,
        failedCount,
        conflictCount,
        isSyncing,
        syncProgress,
        lastSyncResult,
        lastSyncTimestamp,
        savedRosters,
        queueItems,
        syncPendingQueue,
        retryFailedQueue,
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
