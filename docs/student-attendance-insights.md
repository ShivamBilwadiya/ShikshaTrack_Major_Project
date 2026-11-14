# Student Attendance and Performance Insights Specification

This document specifies the **Student Attendance and Performance Insights** analytical subsystem in **ShikshaTrack**. Designed for rural primary and secondary education environments, this engine provides early-warning signals, statistical pattern classification, and longitudinal trend indicators to combat chronic absenteeism and ensure compliance with the **Right to Education (RTE) Act**.

---

## 1. Subsystem Architecture & Objectives

The insights engine analyzes historical daily attendance sessions across multiple time horizons to identify vulnerable students before chronic absenteeism leads to grade repetition or school dropout.

```
┌──────────────────────────────────────────────────────────┐
│             Attendance Records & Sessions                │
│    (Database Junction @@unique([sessionId, studentId])   │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│              Analytics & Heuristic Engine                │
│  - Longitudinal rate calculations (Attendance Rate %)    │
│  - Trajectory direction (Recent 5 vs Prior 10 sessions)  │
│  - Consecutive unexcused absence streak counter          │
│  - Day-of-Week pattern detection (Mon-Fri)               │
└──────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Category Flagging     │ │  Actionable Guidance API  │
│  - CONSISTENTLY_ABSENT    │ │  - Statutory RTE notices  │
│  - CHRONIC_LOW (< 75%)    │ │  - Guardian phone visits  │
│  - IRREGULAR ATTENDANCE   │ │  - Welfare/MDM follow-ups │
│  - IMPROVING / DECLINING  │ │                           │
└───────────────────────────┘ └───────────────────────────┘
```

---

## 2. Statistical Definitions & Heuristics

### 2.1 Attendance Rate ($\text{AR}$)
The proportion of active instructional sessions where the student was marked either `PRESENT` or `LATE`:

$$\text{AR} = \frac{\text{Present Count} + \text{Late Count}}{\text{Total Sessions}} \times 100$$

### 2.2 Configurable Statutory Threshold ($\tau$)
Under Section 24 of the Right of Children to Free and Compulsory Education (RTE) Act in India, students must maintain a minimum attendance threshold (default: $75\%$) to qualify for academic promotion and midday meal (MDM) scheme benefits. The threshold is configurable via the `threshold` parameter ($0 \le \tau \le 100$).

### 2.3 Longitudinal Trajectory ($\Delta \text{Rate}$)
To determine whether a student's attendance is improving or declining, the engine compares the attendance rate of the **recent window** ($W_{\text{recent}}$, the last 5 recorded sessions) against the **prior window** ($W_{\text{prior}}$, the preceding up to 10 sessions):

$$\Delta \text{Rate} = \text{Rate}(W_{\text{recent}}) - \text{Rate}(W_{\text{prior}})$$

- **`IMPROVING`**: $\Delta \text{Rate} \ge +8\%$
- **`DECLINING`**: $\Delta \text{Rate} \le -8\%$
- **`STABLE`**: $-8\% < \Delta \text{Rate} < +8\%$

### 2.4 Pattern Categories
1. **`CONSISTENTLY_ABSENT`**: Current consecutive unexcused absences $\ge 3$, or $\ge 4$ absences in the last 5 sessions.
2. **`CHRONIC_LOW`**: Overall attendance rate is strictly below the configured threshold $\tau$ ($\text{AR} < \tau$).
3. **`IRREGULAR`**: Volatile attendance pattern where student oscillates frequently between attendance and absence ($\ge 3$ absences with high session variance $|\Delta \text{Rate}| \ge 15\%$).
4. **`IMPROVING`**: Positive momentum ($\Delta \text{Rate} \ge +8\%$).
5. **`DECLINING`**: Negative momentum with attendance dropping under $85\%$.
6. **`GOOD`**: Regular attendance meeting or exceeding statutory requirements ($\text{AR} \ge \tau$ and stable/improving).

---

## 3. REST API Reference

Base Endpoint: `/api/v1/analytics`  
Authentication: Bearer JWT Token (`ADMIN` or `TEACHER`)

### 3.1 Student Attendance Insights
- **Method:** `GET /api/v1/analytics/students`
- **Query Parameters:**
  - `threshold` *(number, optional)*: Cutoff percentage ($0$ to $100$, default: $75$).
  - `classId` *(UUID, optional)*: Filter by assigned class.
  - `status` *(string, optional)*: Filter by category (`ALL`, `CHRONIC_LOW`, `CONSISTENTLY_ABSENT`, `IRREGULAR`, `IMPROVING`, `DECLINING`).
  - `search` *(string, optional)*: Search student name, admission number, or roll number.
  - `startDate` / `endDate` *(YYYY-MM-DD, optional)*: Filter sessions by date range.
  - `page` / `limit` *(integer, optional)*: Pagination parameters.
  - `sortBy` *(string, optional)*: `'attendanceRate'`, `'name'`, `'absentCount'`, `'changePercent'`.
  - `sortOrder` *(string, optional)*: `'asc'` or `'desc'`.
- **Response Structure:**
  ```json
  {
    "success": true,
    "message": "Student attendance insights retrieved successfully.",
    "data": {
      "summary": {
        "totalAnalyzed": 42,
        "averageAttendance": 81.4,
        "threshold": 75,
        "belowThresholdCount": 4,
        "consistentlyAbsentCount": 2,
        "irregularCount": 3,
        "improvingCount": 5,
        "decliningCount": 2
      },
      "students": [
        {
          "studentId": "uuid-1",
          "name": "Aarav Sharma",
          "admissionNumber": "ADM-001",
          "rollNumber": "1",
          "class": { "id": "cls-uuid", "name": "Class 8", "section": "A" },
          "totalSessions": 20,
          "presentCount": 13,
          "lateCount": 1,
          "absentCount": 6,
          "attendanceRate": 70.0,
          "consecutiveAbsences": 3,
          "statusCategory": "CONSISTENTLY_ABSENT",
          "trend": {
            "direction": "DECLINING",
            "recentRate": 40.0,
            "priorRate": 80.0,
            "changePercent": -40.0
          },
          "insights": [
            "Urgent: Student has been absent for 3 consecutive sessions.",
            "Attendance (70%) is below the statutory 75% threshold required under the RTE Act."
          ]
        }
      ]
    }
  }
  ```

---

### 3.2 Individual Student Deep Analysis
- **Method:** `GET /api/v1/analytics/students/:id`
- **Response Attributes:**
  - `student`: Profile particulars and guardian contact information.
  - `metrics`: Overall sessions, counts, rates, and consecutive streaks.
  - `dayOfWeekAnalytics`: Monday through Friday presence percentages (detecting market days or harvest-related absences).
  - `monthlyTrends`: Longitudinal month-by-month attendance history.
  - `weeklyTrends`: Rolling weekly percentage graph.
  - `recommendations`: Actionable administrative and pedagogical interventions.

---

### 3.3 Class Cohort Summaries
- **Method:** `GET /api/v1/analytics/cohorts`
- **Output:** Class-by-class ranking, total enrolled headcount, attendance rate percentage, non-compliant student headcount, and performance tier categorization (`HIGH` $\ge 85\%$, `MODERATE` $75-84.9\%$, `LOW` $< 75\%$).

---

## 4. UI Dashboard Implementation

The visual dashboard in `frontend/src/pages/Analytics.jsx` includes:
- **Stat Summary Cards**: Real-time KPI counters highlighting analyzed students, average cohort rate, students below threshold, and trend distribution.
- **Dynamic Threshold Dropdown**: Configurable on-the-fly between 60%, 70%, 75% (RTE Default), 80%, and 85%.
- **Pattern Filter Pills**: One-click filtering for at-risk cohorts (e.g. 3+ consecutive absence streak).
- **Interactive Student Table**: Color-coded badges for compliance and trajectory arrows.
- **Deep-Dive Breakdown Modal**: Visual day-of-week attendance profile and concrete recommendations.
