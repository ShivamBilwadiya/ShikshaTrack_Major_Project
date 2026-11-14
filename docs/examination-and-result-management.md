# Examination, Assessment & Result Management System

This document provides the technical specification and architecture for the **Examination, Assessment & Result Management System** in **ShikshaTrack**. Built for schools to conduct unit tests, term midterms, and annual final assessments, this module automates subject marks entry, enforces boundary validation, calculates aggregated percentages and letter grades, and exports performance rosters.

---

## 1. System Architecture & Relational Model

The examination subsystem structures evaluations into school-wide or class-specific examinations containing individual subject papers and student marks.

```
┌────────────────────────────────────────────────────────┐
│                        School                          │
│     (schools table: institutional root boundary)       │
└────────────────────────────────────────────────────────┘
          │
          ▼ 1:N
┌────────────────────────────────────────────────────────┐
│                     Examination                        │
│  (examinations table: indexed on schoolId, academicYr) │
│  - name (e.g. Term 1 Midterm Assessment)               │
│  - examType (UNIT_TEST, MIDTERM, FINAL, PRACTICAL)     │
│  - academicYear (e.g. 2026-2027)                       │
│  - classId (optional: school-wide vs class specific)   │
│  - startDate / endDate                                 │
└────────────────────────────────────────────────────────┘
          │
          ▼ 1:N
┌────────────────────────────────────────────────────────┐
│                     ExamSubject                        │
│  (exam_subjects table: unique on examinationId, subject│
│  - subject (e.g. Mathematics, Science, English)        │
│  - maxMarks (default: 100)                             │
│  - passMarks (default: 33)                             │
│  - examDate                                            │
└────────────────────────────────────────────────────────┘
          │
          ▼ 1:N
┌────────────────────────────────────────────────────────┐
│                      ExamMark                          │
│  (exam_marks table: unique on examSubjectId, studentId)│
│  - marksObtained (0 <= marks <= maxMarks)              │
│  - remarks                                             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Grading & Result Calculation Logic

### 2.1 Grading Scale
Grading follows standard state education board criteria:
- **`A+`**: $\text{Percentage} \ge 90\%$
- **`A`**: $80\% \le \text{Percentage} < 90\%$
- **`B+`**: $70\% \le \text{Percentage} < 80\%$
- **`B`**: $60\% \le \text{Percentage} < 70\%$
- **`C`**: $50\% \le \text{Percentage} < 60\%$
- **`D`**: $33\% \le \text{Percentage} < 50\%$
- **`F`**: $\text{Percentage} < 33\%$

### 2.2 Pass / Fail Determination
A student is declared **`PASS`** if and only if:
1. The student appeared for the assessment.
2. The marks obtained in **every** evaluated subject paper equal or exceed the paper's `passMarks` (typically 33%).
3. The aggregate percentage across all papers is $\ge 33\%$.

If a student scores below `passMarks` in any single subject paper, the overall status is flagged as **`FAIL`**.

---

## 3. REST API Endpoint Reference

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/exams` | Authenticated | List school examinations filtered by class or academic year. |
| `GET` | `/api/v1/exams/:id` | Authenticated | Single examination details with assigned subjects. |
| `GET` | `/api/v1/exams/:id/results` | Authenticated | Class-wide calculated results, grade distribution, and summary stats. |
| `GET` | `/api/v1/exams/:id/results/export` | Authenticated | Downloadable standard CSV result sheet. |
| `POST`| `/api/v1/exams/subjects/:subjectId/marks` | Authenticated | Bulk marks entry for a subject paper with boundary checks. |
| `POST`| `/api/v1/exams` | **Admin Only** | Create examination with initial subject papers. |
| `PUT` | `/api/v1/exams/:id` | **Admin Only** | Update examination metadata. |
| `DELETE`| `/api/v1/exams/:id` | **Admin Only** | Delete examination and cascade subject marks. |
| `POST`| `/api/v1/exams/:id/subjects` | **Admin Only** | Add an additional subject paper to an examination. |

---

## 4. Automated Test Coverage

The examination subsystem is backed by 17 automated integration tests in `backend/tests/exams.test.js`:
- Role-based access control (Admin create/edit/delete, Teacher marks entry and read).
- Input boundary validation (rejecting negative marks and marks exceeding maximum).
- Duplicate subject paper and duplicate examination cycle prevention.
- Bulk marks upsert and score updates.
- Accurate percentage and grade calculations.
- Class result overview and CSV export formatting with proper escaping.
