# Teacher Workload and Performance Analytics Specification

This document provides a comprehensive technical specification for the **Teacher Workload and Performance Analytics** analytical subsystem in **ShikshaTrack**. It details the architectural design, Role-Based Access Control (RBAC), statistical formulas, API specifications, and operational heuristics used to track instructional session consistency, class assignments, and attendance record completion rates.

---

## 1. Subsystem Architecture & Objectives

The primary goal of the Teacher Workload and Performance Analytics subsystem is to provide transparent accountability, workload balancing, and roll call auditing for school administrators and teachers.

In rural educational facilities, timely and complete roll call marking is directly correlated with student retention, midday meal entitlement distribution, and institutional compliance with the **Right to Education (RTE) Act**.

```
┌────────────────────────────────────────────────────────────┐
│                    Teacher Assignments                     │
│         (teacher_assignments: teacherId ↔ classId)         │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│               Attendance Sessions & Records                │
│    (attendance_sessions: teacherId, classId, sessionDate)  │
│    (attendance_records: sessionId, studentId, status)      │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│             Teacher Analytics & Workload Engine            │
│  - Roster Completion Rate (% of enrolled students marked)  │
│  - Session Closure Audit (OPEN vs CLOSED sessions)         │
│  - Teacher Workload Tier (HEAVY, MODERATE, LIGHT)          │
│  - Longitudinal Activity Trends (Weekly & Monthly)         │
│  - Incomplete Session & Missing Record Flagging            │
└────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│    Admin Analytical View    │ │   Teacher Restricted View   │
│  - School-wide audit table  │ │  - Self-performance audit  │
│  - Cross-teacher benchmarks │ │  - Assigned classes metrics │
│  - Faculty workload tiers   │ │  - Unclosed session alerts  │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Statistical Metrics & Operational Definitions

### 2.1 Attendance Session Completion Rate ($\text{CR}_{\text{session}}$)
For a given attendance session $S$ held for class $C$ with $N_{\text{enrolled}}$ active students:

$$\text{CR}_{\text{session}} = \begin{cases} 
\min\left(100, \frac{N_{\text{marked}}}{N_{\text{enrolled}}} \times 100\right), & \text{if } N_{\text{enrolled}} > 0 \\
100\%, & \text{if } N_{\text{enrolled}} = 0 
\end{cases}$$

Where $N_{\text{marked}} = N_{\text{present}} + N_{\text{late}} + N_{\text{absent}}$.

### 2.2 Teacher Overall Completion Rate ($\text{CR}_{\text{teacher}}$)
Across all sessions conducted by teacher $T$ within the selected date window:

$$\text{CR}_{\text{teacher}} = \frac{\sum_{S} N_{\text{marked}}(S)}{\sum_{S} N_{\text{enrolled}}(S)} \times 100$$

### 2.3 Incomplete Attendance Session Criteria
An attendance session is classified as **`INCOMPLETE`** if either of the following conditions is met:
1. **Unclosed Status**: The session status is still `OPEN` (roll call was initialized but never formally finalized/closed by the teacher).
2. **Missing Student Records**: $N_{\text{marked}} < N_{\text{enrolled}}$ (one or more active students in the class roster do not have an attendance entry).

### 2.4 Faculty Workload Tiers
Workload is classified based on instructional responsibility:
- **`HEAVY`**: Teacher is assigned to $\ge 3$ classes OR $\ge 60$ distinct active students.
- **`MODERATE`**: Teacher is assigned to $2$ classes OR $30 - 59$ distinct active students.
- **`LIGHT`**: Teacher is assigned to $\le 1$ class AND $< 30$ active students.

### 2.5 Completion Performance Tiers
- **`EXCELLENT`**: Overall completion rate $\ge 90\%$.
- **`SATISFACTORY`**: Overall completion rate between $75\%$ and $89.9\%$.
- **`ATTENTION_NEEDED`**: Overall completion rate $< 75\%$ with active sessions.
- **`NO_SESSIONS`**: Zero sessions conducted during the selected window.

---

## 3. Role-Based Access Control (RBAC)

The analytics engine enforces strict role separation between school administrators and teachers:

| Endpoint | Role: `ADMIN` | Role: `TEACHER` |
| :--- | :--- | :--- |
| `GET /api/v1/analytics/teachers` | Can view all teachers across the school, filter by class, search, and paginate. | Restricted strictly to their own workload and statistics (`req.user.id`). Querying another `teacherId` returns `HTTP 403 Forbidden`. |
| `GET /api/v1/analytics/teachers/:id` | Can access full drilldown analytics for any teacher in the school. | Permitted only for their own ID (`req.user.id === id`). Accessing another teacher's profile returns `HTTP 403 Forbidden`. |
| `GET /api/v1/analytics/teachers/activity/trends` | Can query school-wide activity trends or specific teacher trends. | Automatically scoped to their own teaching session trends. |

---

## 4. REST API Endpoints Specification

### 4.1 Get Teacher Workload and Performance Analytics
```http
GET /api/v1/analytics/teachers
```
**Headers:**
`Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `teacherId` | UUID | No | Filter by specific teacher (ADMIN only). |
| `classId` | UUID | No | Filter by assigned class ID. |
| `status` | String | No | `'ALL'`, `'active'`, or `'inactive'`. |
| `startDate` | Date | No | Filter sessions starting from `YYYY-MM-DD`. |
| `endDate` | Date | No | Filter sessions ending at `YYYY-MM-DD`. |
| `search` | String | No | Case-insensitive substring match on teacher name or email. |
| `sortBy` | String | No | `'completionRate'`, `'sessions'`, `'incompleteSessions'`, `'assignedClasses'`, `'name'`. |
| `sortOrder` | String | No | `'asc'` or `'desc'` (default: `'desc'`). |
| `page` | Integer | No | Page number for pagination ($1$-based). |
| `limit` | Integer | No | Records per page. |

**Example Response:**
```json
{
  "success": true,
  "message": "Teacher workload and performance analytics retrieved.",
  "data": {
    "summary": {
      "totalTeachers": 4,
      "activeTeachers": 4,
      "totalSessionsConducted": 52,
      "totalOpenSessions": 2,
      "totalClosedSessions": 50,
      "totalRecordsMarked": 1820,
      "totalIncompleteSessions": 3,
      "teachersWithIncompleteSessions": 1,
      "averageCompletionRate": 96.4,
      "dateRange": {
        "startDate": "2026-11-01",
        "endDate": "2026-11-30"
      }
    },
    "teachers": [
      {
        "teacherId": "f7d3a2b1-1234-4a5b-9c8d-e1f2a3b4c5d6",
        "name": "Ramesh Sharma",
        "email": "ramesh.teacher@shikshatrack.in",
        "active": true,
        "assignedClassesCount": 2,
        "assignedClasses": [
          {
            "assignmentId": "a1...",
            "classId": "c1...",
            "className": "Class 8-A",
            "academicYear": "2026-2027",
            "isClassTeacher": true,
            "studentCount": 35
          }
        ],
        "totalAssignedStudents": 35,
        "sessions": {
          "total": 24,
          "open": 1,
          "closed": 23,
          "incomplete": 1
        },
        "records": {
          "totalMarked": 838,
          "present": 790,
          "late": 30,
          "absent": 18
        },
        "completionRate": 97.2,
        "attendanceRate": 97.9,
        "workloadTier": "MODERATE",
        "completionStatus": "EXCELLENT",
        "incompleteSessions": [
          {
            "sessionId": "s1...",
            "classId": "c1...",
            "className": "Class 8-A",
            "sessionDate": "2026-11-14",
            "status": "OPEN",
            "enrolledCount": 35,
            "markedCount": 33,
            "unmarkedCount": 2,
            "completionRate": 94.3,
            "notes": "Morning period"
          }
        ]
      }
    ]
  }
}
```

---

### 4.2 Get Detailed Teacher Performance Breakdown
```http
GET /api/v1/analytics/teachers/:id
```
**Headers:**
`Authorization: Bearer <token>`

**Path Parameters:**
- `id` (UUID): ID of the teacher.

**Response Structure:**
- `teacher`: ID, name, email, active status, creation date.
- `workload`: Assigned classes count, total unique students, workload tier.
- `metrics`: Total sessions, open sessions, closed sessions, incomplete sessions count, present/late/absent counts, completion rate %, attendance rate %.
- `assignedClasses`: Array of class-level metrics (enrolled students, sessions conducted, marked count, completion rate, incomplete count).
- `incompleteSessions`: Detailed list of sessions flagged for missing records or pending closure.
- `weeklyTrends`: Time-series array grouped by week with session count and completion rate.
- `monthlyTrends`: Time-series array grouped by month with session count and completion rate.
- `recommendations`: Actionable feedback messages with severity levels (`SUCCESS`, `INFO`, `WARNING`, `URGENT`).

---

### 4.3 Get Teaching Activity Trends
```http
GET /api/v1/analytics/teachers/activity/trends
```
**Headers:**
`Authorization: Bearer <token>`

**Query Parameters:**
- `teacherId` (Optional UUID): Filter to a single teacher.
- `startDate` (Optional `YYYY-MM-DD`): Start date.
- `endDate` (Optional `YYYY-MM-DD`): End date.

**Response Data:**
- `summary`: Total sessions held, open/closed counts, total records marked, average completion rate.
- `weeklyTrends`: Array of `{ period, sessionsCount, openSessions, closedSessions, markedRecords, completionRate }`.
- `monthlyTrends`: Array of `{ month, label, sessionsCount, openSessions, closedSessions, markedRecords, completionRate }`.
- `teacherRankings`: Array of teachers sorted by sessions conducted and completion percentage.

---

## 5. Automated Verification & Test Coverage

The subsystem is thoroughly tested in `backend/tests/analytics.test.js`:
1. **School-wide Admin View**: Verifies retrieval of aggregated summary metrics and teacher workload array.
2. **RBAC Isolation**: Verifies that a teacher querying `/analytics/teachers` receives only their own workload profile.
3. **RBAC Forbidden Access (403)**: Verifies that a teacher querying another teacher's profile receives `HTTP 403 Forbidden`.
4. **Parameter Validation (400)**: Verifies rejection of inverted date ranges (`startDate > endDate`) and malformed date strings.
5. **Search & Pagination**: Verifies filtering by teacher name/email and metadata pagination.
6. **Detailed Teacher Breakdown**: Verifies class-level metrics, incomplete session lists, weekly/monthly trends, and actionable recommendations.
7. **Activity Trends API**: Verifies weekly time-series aggregations and rankings.
