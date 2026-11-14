# School Notification and Alert Management System Specification

This document provides the technical specification for the **School Notification and Alert Management System** in **ShikshaTrack**. Designed for rural primary and secondary education environments, this proactive notification engine bridges daily roll call execution with administrative oversight, ensuring immediate visibility into chronic student absenteeism, incomplete attendance sessions, and statutory compliance with the **Right to Education (RTE) Act**.

---

## 1. Subsystem Architecture & Objectives

The Notification and Alert Management subsystem combines an event-driven broadcast model with a rule-based proactive analytical scanner. It continuously monitors student attendance thresholds and instructional session completeness to generate targeted alerts for teachers and school administrators.

```
┌────────────────────────────────────────────────────────────┐
│         Attendance Sessions & Student Roster State         │
│     (attendance_sessions, attendance_records, students)    │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│               Proactive Alert Scanner Engine               │
│  - Evaluates Student Attendance Rates against 75% benchmark│
│  - Flags Consecutive Absences (>= 3 instructional days)    │
│  - Detects Incomplete Roll Calls & Open Sessions           │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    Notification Storage                    │
│    (Database Table: notifications, Indexed on schoolId)    │
│    - Categories: URGENT, WARNING, INFO, SUCCESS            │
│    - Scopes: Targeted (userId) or Broadcast (userId: null) │
└────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│   Admin Notification Hub    │ │  Teacher Notification Bell  │
│  - School-wide alert audits │ │  - Assigned class alerts    │
│  - Broadcast announcements  │ │  - Unclosed session notices │
│  - Proactive alert triggers │ │  - Individual read/dismiss  │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Notification Categories & Alert Heuristics

### 2.1 Alert Categories
- **`URGENT`**: Requires immediate pedagogical or administrative intervention.
  - Chronic student absenteeism ($\ge 3$ consecutive absences).
  - Critical low attendance ($< 60\%$).
- **`WARNING`**: Early warning indicators.
  - Attendance rate below statutory threshold ($60\% \le \text{Rate} < 75\%$).
  - Unclosed or incomplete attendance sessions.
- **`INFO`**: Institutional advisories and administrative updates.
  - Midday meal inspections, syllabus circulars, or general school broadcasts.
- **`SUCCESS`**: Operational milestones.
  - 100% complete roster submissions or sync queue resolutions.

### 2.2 Proactive Heuristics & Rules

#### Rule 1: Low Attendance Early Warning
When an active student's cumulative attendance rate drops below $75\%$, the scanner creates a `WARNING` or `URGENT` notification directed to the assigned class teacher and administrators:
$$\text{Attendance Rate} = \frac{\text{Present} + \text{Late}}{\text{Total Sessions}} \times 100 < 75\%$$

#### Rule 2: Chronic Consecutive Absence
If a student records $\ge 3$ consecutive unexcused absences without leave justification:
$$\text{Consecutive Absences} \ge 3 \implies \text{Category: URGENT}$$
Directs faculty to initiate home visits or welfare contact under Section 24 of the RTE Act.

#### Rule 3: Incomplete Session Audit
Attendance sessions initialized in the last 7 days that remain `OPEN` or have fewer records than active enrolled students are flagged:
$$N_{\text{marked}} < N_{\text{enrolled}} \lor \text{Status} = \text{OPEN} \implies \text{Category: WARNING}$$

---

## 3. Database Schema & Indexing

The subsystem utilizes the dedicated `notifications` table in PostgreSQL:

```prisma
enum NotificationCategory {
  INFO
  WARNING
  URGENT
  SUCCESS
}

model Notification {
  id         String               @id @default(uuid())
  schoolId   String
  school     School               @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  userId     String?              // Null = School-wide broadcast
  user       User?                @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String
  message    String
  category   NotificationCategory @default(INFO)
  type       String               // "LOW_ATTENDANCE", "INCOMPLETE_SESSION", "STUDENT_ABSENCE", etc.
  entityType String?              // "STUDENT", "CLASS", "SESSION", "TEACHER"
  entityId   String?
  isRead     Boolean              @default(false)
  readAt     DateTime?
  metadata   Json?                // Contextual details (rate, studentName, className, etc.)
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt

  @@index([schoolId, userId, isRead])
  @@index([schoolId, category])
  @@index([schoolId, createdAt])
  @@map("notifications")
}
```

---

## 4. REST API Endpoint Specifications

All endpoints require JWT authentication via `Authorization: Bearer <token>`.

### 4.1 List Notifications
```http
GET /api/v1/notifications
```
**Query Parameters:**
- `category` (Optional): `'ALL'`, `'URGENT'`, `'WARNING'`, `'INFO'`, `'SUCCESS'`.
- `status` (Optional): `'ALL'`, `'UNREAD'`, `'READ'`.
- `startDate` (Optional): `YYYY-MM-DD`.
- `endDate` (Optional): `YYYY-MM-DD`.
- `search` (Optional): Search term matched against `title` and `message`.
- `page` (Optional, Default: 1): Page number.
- `limit` (Optional, Default: 20): Records per page.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "title": "Low Attendance Warning: Aarav Patel (68.5%)",
        "message": "Aarav Patel in Class 8-A has an attendance rate of 68.5%...",
        "category": "WARNING",
        "type": "LOW_ATTENDANCE",
        "isRead": false,
        "metadata": { "studentId": "uuid", "attendanceRate": 68.5 }
      }
    ],
    "pagination": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 },
    "summary": { "totalCount": 12, "unreadCount": 5, "urgentCount": 2, "warningCount": 3 }
  }
}
```

### 4.2 Get Notification Center Summary
```http
GET /api/v1/notifications/summary
```
Returns badge counters (`unreadCount`, `urgentCount`, `warningCount`, `infoCount`, `successCount`) and a preview of the 5 most recent notifications.

### 4.3 Create Notification (Admin Only)
```http
POST /api/v1/notifications
```
Allows school administrators to dispatch broadcast or teacher-targeted alerts.

### 4.4 Trigger Proactive Alert Scan
```http
POST /api/v1/notifications/generate-alerts
```
Scans student records and session logs to synthesize automated low-attendance, incomplete-session, and absence notifications.

### 4.5 Mark Notification as Read
```http
PATCH /api/v1/notifications/:id/read
```
Marks single notification as read. Enforces RBAC so teachers cannot mark other faculty members' notifications.

### 4.6 Mark All Notifications as Read
```http
PATCH /api/v1/notifications/read-all
```
Bulk-marks matching unread notifications as read.

### 4.7 Dismiss / Delete Notification
```http
DELETE /api/v1/notifications/:id
```
Dismisses and permanently removes the notification record.

---

## 5. Verification & Test Suite

The notification subsystem is verified via automated integration tests in `backend/tests/notifications.test.js`:
- Admin broadcast creation and targeted teacher alerts.
- Unauthorized non-admin creation rejection (`403 Forbidden`).
- Input validation (missing fields, invalid category values, inverted date ranges).
- Role-based scoping (teachers only receive permitted alerts).
- Category, status, and substring search filtering.
- Unread count badge accuracy and summary stats.
- Read state updates (individual and bulk).
- Automated proactive alert generation from live attendance data.
- Deletion lifecycle and 404/403 boundary handling.
