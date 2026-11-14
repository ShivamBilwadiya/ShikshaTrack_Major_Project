# Offline Attendance Sync Reliability & Recovery Engine

This document provides the technical architecture, offline state management, idempotency guarantees, conflict resolution rules, and crash recovery procedures for the **Offline Synchronization Engine** in **ShikshaTrack**.

---

## 1. System Overview & Offline-First Architecture

In rural and remote educational environments, internet access is intermittent, high-latency, or absent for extended hours. ShikshaTrack employs an **Offline-First Architectural Pattern** allowing faculty to download class rosters, record QR attendance, and queue operations locally in browser-backed **IndexedDB** storage.

```
┌────────────────────────────────────────────────────────┐
│                   Mobile / Browser PWA                 │
│              (Operating in Disconnected Mode)          │
└────────────────────────────────────────────────────────┘
         │
         ├─── 1. Cache Roster ───► IndexedDB 'rosters'
         ├─── 2. Offline Scan ───► IndexedDB 'syncQueue' (Operation IDs)
         │                          └── Status: PENDING / SYNCING / FAILED
         │
         ▼ (Connectivity Restored)
┌────────────────────────────────────────────────────────┐
│               Exponential Backoff Dispatch             │
│            Delay = min(1000 * 2^retry, 15000) ms       │
└────────────────────────────────────────────────────────┘
         │
         ├─── 3. Batch Transmission (POST /api/v1/sync/batch)
         ▼
┌────────────────────────────────────────────────────────┐
│             Backend Synchronization Engine             │
│     (Prisma DB: sync_operations & attendance_records)  │
└────────────────────────────────────────────────────────┘
         │
         ├─── 4. Idempotency Check (Duplicate Operation ID Protection)
         ├─── 5. Conflict Arbitration (Server vs Offline Timestamp)
         └─── 6. Audit Trail Logging (OFFLINE_BATCH_SYNC)
```

---

## 2. Persistent Operation Lifecycle & States

Every offline attendance event receives an immutable `operationId` (UUID) upon creation. The operation advances through predictable lifecycle states:

```
  [ PENDING ] ──────► [ SYNCING ] ──────► [ SYNCED ] (Success / Idempotent)
       ▲                     │
       │                     ├──────────► [ CONFLICT ] (Discrepancy flagged for review)
       │                     │
       └─ Backoff Retry ◄────┴──────────► [ FAILED ] (Exhausted MAX_RETRIES = 5)
```

- **`PENDING`**: Operation recorded locally in IndexedDB, awaiting network transmission.
- **`SYNCING`**: Payload packaged into active batch request; locked against concurrent transmission.
- **`SYNCED`**: Successfully validated and committed to PostgreSQL; pruned from local device queue.
- **`CONFLICT`**: Discrepancy detected between existing database attendance record and incoming offline payload. Stored on server for administrator review.
- **`FAILED`**: Operation experienced persistent validation errors or exceeded maximum automatic retry attempts ($N=5$).

---

## 3. Conflict Resolution & Arbitration Rules

### 1. Zero Silent Overwrite Guarantee
Under no circumstances does the synchronization engine silently overwrite an existing verified attendance record.
- If an attendance record for the same `(sessionId, studentId)` already exists with the **identical status**, it is classified as a duplicate and confirmed as `SYNCED` without error.
- If the incoming event contains a **different status** (e.g. Server has `PRESENT` marked via QR scanner, but offline payload specifies `ABSENT`):
  - If the payload specifies explicit authorization (`resolveConflict: true` or `forceUpdate: true`), the record is updated and audited.
  - Otherwise, a **`CONFLICT`** record is generated preserving both the server record snapshot and the offline payload for administrative review.

### 2. Administrative Arbitration Workflow
Administrators and class teachers review conflicts via `GET /api/v1/sync/conflicts` and resolve discrepancies:
- **`KEEP_SERVER`**: Retains existing database status. SyncOperation marked `SYNCED` with resolution notes.
- **`ACCEPT_OFFLINE`**: Updates `AttendanceRecord` with offline status and timestamp. Dispatches audit event.

---

## 4. REST API Endpoint Specifications

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `GET` | `/api/v1/sync/roster/:classId` | `TEACHER`, `ADMIN` | Pre-download class roster and student QR tokens for offline use |
| `POST` | `/api/v1/sync/batch` | All Authenticated | Ingest batch of offline attendance operations idempotently |
| `GET` | `/api/v1/sync/status` | `TEACHER`, `ADMIN` | Retrieve synchronization engine health, pending counters, and metrics |
| `GET` | `/api/v1/sync/conflicts` | `TEACHER`, `ADMIN` | List outstanding attendance conflicts awaiting review |
| `POST` | `/api/v1/sync/conflicts/:id/resolve` | `TEACHER`, `ADMIN` | Arbitrate conflict with `KEEP_SERVER` or `ACCEPT_OFFLINE` |
| `POST` | `/api/v1/sync/retry-failed` | `TEACHER`, `ADMIN` | Trigger batch retry for failed operations with backoff reset |
