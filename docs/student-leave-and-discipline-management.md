# Student Leave, Attendance & Discipline Management System

This document outlines the architecture, data models, approval workflows, attendance integration, and discipline tracking subsystem in **ShikshaTrack**.

---

## 1. System Overview & Architecture

The **Student Leave & Discipline Management System** enables educational institutions to manage excused absences and monitor student conduct while integrating with the existing attendance engine and RBAC system.

```
┌────────────────────────────────────────────────────────┐
│                        School                          │
│     (Institutional root tenant isolation boundary)     │
└────────────────────────────────────────────────────────┘
          │
          ├─── 1:N ─── StudentLeave (student_leaves)
          │             ├── leaveType (SICK, FAMILY, PERSONAL, EMERGENCY, OTHER)
          │             ├── status (PENDING, APPROVED, REJECTED, CANCELLED)
          │             ├── startDate, endDate, totalDays, reason, documentUrl
          │             └── 1:N ─── StudentLeaveDecision (student_leave_decisions)
          │                          └── action, remarks, reviewerId, decidedAt
          │
          └─── 1:N ─── StudentIncident (student_incidents)
                        ├── category (BEHAVIOUR, ATTENDANCE, ACADEMIC, SAFETY, OTHER)
                        ├── severity (LOW, MEDIUM, HIGH, CRITICAL)
                        ├── status (REPORTED, UNDER_INVESTIGATION, RESOLVED, CLOSED)
                        ├── isPrivate (Confidential administrative record)
                        └── 1:N ─── IncidentActionHistory (incident_action_history)
                                     └── action, notes, actorId, timestamp
```

---

## 2. Leave Application & Approval Workflow

### Validation Rules
- **Date Boundary Enforcement**: `startDate <= endDate`. Inclusive calendar days calculation accounts for single-day and multi-day leaves.
- **Overlap Prevention**: Students cannot submit overlapping active (`PENDING` or `APPROVED`) leave requests. Rejections or cancellations free up the calendar window.
- **Mandatory Decision Remarks**: Reviewers (class teachers or administrators) must provide explanatory remarks for both approval and rejection to maintain transparency.
- **Atomic State Transitions**: Approved leaves cannot be re-approved without reopening; transitions update `StudentLeave` and record immutable `StudentLeaveDecision` and `AuditLog` records within a database transaction.
- **Bulk Decision Engine**: Supports batch approval or rejection of pending applications with per-item validation reporting.

---

## 3. Attendance Integration

When teachers open an attendance session for a class:
1. The attendance service queries all approved leaves active on `sessionDate`.
2. Any student with an `APPROVED` leave active on that date is marked with `isApprovedLeave: true` and their default status is set to `ON_LEAVE`.
3. The session roster displays the student's leave type and reason, preventing authorized absences from being treated as unexplained truant absences.
4. Existing QR attendance, offline syncing, and audit trails remain preserved and non-destructive.

---

## 4. Student Discipline & Incident Tracking

### Categories & Severities
- **Categories**: `BEHAVIOUR`, `ATTENDANCE`, `ACADEMIC`, `SAFETY`, `OTHER`.
- **Severities**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **Resolution States**: `REPORTED` → `UNDER_INVESTIGATION` → `RESOLVED` / `CLOSED`.

### Privacy Scoping
- **Confidential Incidents (`isPrivate: true`)**: Accessible only to users with the `ADMIN` role and the original reporter. General faculty cannot view confidential incident logs.
- **Action Timeline**: Every status update, counselling note, or parental communication is appended to `IncidentActionHistory` with actor ID and timestamp.

---

## 5. API Reference

### Student Leaves (`/api/v1/leaves`)
- `POST /api/v1/leaves`: Submit a new leave application.
- `GET /api/v1/leaves`: List applications with class, student, status, and type filters.
- `GET /api/v1/leaves/summary`: Aggregate analytics (total, pending, approved, rejected, rate).
- `GET /api/v1/leaves/attendance-check?classId=&date=`: Retrieve approved leaves for attendance marking.
- `GET /api/v1/leaves/export`: Download RFC-4180 CSV export.
- `GET /api/v1/leaves/:id`: Retrieve leave details with decision audit history.
- `POST /api/v1/leaves/:id/review`: Approve or reject leave with remarks.
- `POST /api/v1/leaves/bulk-review`: Batch review multiple leave applications.
- `POST /api/v1/leaves/:id/cancel`: Cancel an application.

### Student Incidents (`/api/v1/incidents`)
- `POST /api/v1/incidents`: Log a new disciplinary incident.
- `GET /api/v1/incidents`: Search and list incidents with filters.
- `GET /api/v1/incidents/summary`: Category, severity, and status distribution statistics.
- `GET /api/v1/incidents/export`: Download RFC-4180 CSV export.
- `GET /api/v1/incidents/:id`: Detailed view including timeline history.
- `PATCH /api/v1/incidents/:id/status`: Update status, resolution notes, and actions taken.
- `POST /api/v1/incidents/:id/actions`: Append standalone action note to incident timeline.
