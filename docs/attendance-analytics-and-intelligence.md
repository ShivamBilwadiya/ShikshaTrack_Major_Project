# Advanced Attendance Analytics & Reporting Intelligence

This document details the architecture, mathematical formulations, and predictive algorithms powering the **Advanced Attendance Analytics & Reporting Intelligence** subsystem in **ShikshaTrack**.

---

## 1. Overview & Architecture

The attendance intelligence subsystem aggregates raw session marks and approved leave exemptions into real-time metrics, risk models, and comparative visual benchmarks.

```
┌────────────────────────────────────────────────────────┐
│              Raw Attendance & Leave Sources            │
│  - attendance_sessions                                 │
│  - attendance_records (PRESENT, LATE, ABSENT)          │
│  - student_leaves (APPROVED status, date bounds)       │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│           Attendance Intelligence Engine               │
│  - Date range normalization & comparison interval      │
│  - Multi-tier rate calculation (Present + Late)        │
│  - Consecutive absence tracking (Truancy detection)    │
│  - At-risk categorization (CRITICAL, HIGH, MODERATE)   │
└────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌───────────────────────┐         ┌───────────────────────┐
│     REST APIs         │         │   Visual Dashboards   │
│ - /analytics/overview │         │ - KPI Cards & Trends  │
│ - /analytics/trends   │         │ - Class Benchmarks    │
│ - /analytics/classes  │         │ - At-Risk Register    │
│ - /analytics/students │         │ - CSV Exports         │
│ - /analytics/at-risk  │         └───────────────────────┘
│ - /analytics/export   │
└───────────────────────┘
```

---

## 2. Core Metrics & Algorithmic Formulations

### 1. Effective Attendance Rate ($\mathcal{A}$)
$$\mathcal{A} = \frac{N_{\text{present}} + N_{\text{late}}}{N_{\text{total marked}}} \times 100$$
- Approved student leaves are excluded from being counted as unexcused absences and tracked as authorized exemptions ($N_{\text{leave}}$).

### 2. Period-over-Period Trend ($\Delta\mathcal{A}$)
$$\Delta\mathcal{A} = \mathcal{A}_{\text{current}} - \mathcal{A}_{\text{previous}}$$
- **Improvement**: $\Delta\mathcal{A} > +0.5\%$
- **Decline**: $\Delta\mathcal{A} < -0.5\%$
- **Steady**: $-0.5\% \le \Delta\mathcal{A} \le +0.5\%$

### 3. Consecutive Absence & Truancy Detection
The engine performs a reverse chronological walk across marked records for each student:
- **Consecutive Absences ($C_a$)**: Count of contiguous `ABSENT` records prior to the most recent `PRESENT` or `LATE` mark.
- If $C_a \ge 3$, the student is automatically flagged in the At-Risk Register regardless of aggregate percentage.

### 4. At-Risk Severity Tiers
- **CRITICAL**: Attendance rate $< 60\%$ OR Consecutive Absences $\ge 5$. Recommended: Immediate formal guardian conference.
- **HIGH**: Attendance rate $< 75\%$ OR Consecutive Absences $\ge 3$. Recommended: Faculty counselling and phone communication.
- **MODERATE**: Attendance rate $75\% - 80\%$. Recommended: Routine advisory check-in.

---

## 3. Endpoints Reference (`/api/v1/analytics/attendance`)

- `GET /overview`: School-wide or class-scoped KPI rates, category distribution, and trend indicator.
- `GET /trends?interval=daily|weekly|monthly`: Timeline rollup of attendance volumes and rates.
- `GET /classes`: Comparative benchmark ranking of all classes in the institution.
- `GET /students`: Paginated individual attendance rates, absences, and leave exemptions.
- `GET /at-risk?threshold=75&minConsecutive=3`: Filtered register of at-risk students with guardian contact details.
- `GET /export?type=students|classes|at-risk`: RFC 4180 CSV export with proper quotation escaping.
