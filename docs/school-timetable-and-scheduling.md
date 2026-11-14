# School Timetable & Class Scheduling Management System

This document provides the technical specification and architecture for the **School Timetable & Class Scheduling Management System** in **ShikshaTrack**. Built for primary and secondary educational institutions, this system digitizes weekly period allocations, guarantees teacher availability, prevents room double-booking, and enforces schedule conflict detection.

---

## 1. System Architecture & Relational Model

The timetable subsystem organizes institutional instructional schedules into weekly grids (Monday through Saturday) linked to schools, classes, teachers, and physical classrooms.

```
┌────────────────────────────────────────────────────────┐
│                        School                          │
│     (schools table: institution root boundary)         │
└────────────────────────────────────────────────────────┘
          │                                  │
          ▼ 1:N                              ▼ 1:N
┌───────────────────────┐          ┌─────────────────────┐
│        Class          │          │    User (Faculty)   │
│  (classes table:      │          │ (users table:       │
│   e.g. Class 8-A)     │          │  role = 'TEACHER')  │
└───────────────────────┘          └─────────────────────┘
          │                                  │
          └─────────────────┬────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                     TimetableEntry                     │
│  (timetable_entries table: indexed on dayOfWeek, class)│
│  - subject (e.g. Mathematics, Science, English)        │
│  - dayOfWeek (MONDAY through SATURDAY)                 │
│  - startTime / endTime (24-hour HH:mm format)          │
│  - roomNumber (e.g. Room 101, Science Lab)             │
│  - academicYear (e.g. 2026-2027)                       │
│  - notes (syllabus unit or instructional guide)        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Relational Schema & Indexes

### 2.1 Prisma Schema Definition
```prisma
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
}

model TimetableEntry {
  id           String    @id @default(uuid())
  schoolId     String
  school       School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  classId      String
  class        Class     @relation(fields: [classId], references: [id], onDelete: Cascade)
  teacherId    String
  teacher      User      @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  subject      String
  dayOfWeek    DayOfWeek
  startTime    String    // format "HH:mm" e.g. "09:00"
  endTime      String    // format "HH:mm" e.g. "09:45"
  roomNumber   String?   // optional room e.g. "Room 101"
  academicYear String?   // optional e.g. "2026-2027"
  notes        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([schoolId, classId, dayOfWeek])
  @@index([schoolId, teacherId, dayOfWeek])
  @@index([schoolId, dayOfWeek])
  @@map("timetable_entries")
}
```

### 2.2 Performance Indexes
- `@@index([schoolId, classId, dayOfWeek])`: High-speed weekly grid generation for specific classes.
- `@@index([schoolId, teacherId, dayOfWeek])`: Instant retrieval of personal faculty schedules and rapid teacher conflict checking.
- `@@index([schoolId, dayOfWeek])`: School-wide period aggregation and room allocation lookups.

---

## 3. Conflict Detection Algorithm

Conflict detection is enforced during both new period creation and updates. The conflict detection engine checks three distinct dimensions:

### 3.1 Interval Overlap Rule
Two periods $[startA, endA)$ and $[startB, endB)$ overlap if and only if:
$$\text{startA} < \text{endB} \quad \land \quad \text{endA} > \text{startB}$$

Adjacent periods (e.g. $09:00 - 10:00$ and $10:00 - 11:00$) do **not** overlap.

### 3.2 Dimensions of Conflict
1. **Teacher Conflict (`TEACHER_CONFLICT`):**
   A teacher cannot be scheduled to teach two different classes at overlapping times on the same day.
2. **Class Conflict (`CLASS_CONFLICT`):**
   A class section cannot be scheduled for two simultaneous lessons on the same day.
3. **Room Conflict (`ROOM_CONFLICT`):**
   A physical classroom or lab cannot be assigned to more than one class period at overlapping times on the same day.

### 3.3 Conflict Response Specification
When a conflict is detected, the API rejects the request with HTTP **409 Conflict** and returns a structured payload:

```json
{
  "success": false,
  "message": "Teacher Ramesh Sharma is already scheduled for Mathematics in Class 8 (A) from 09:00 to 10:00.",
  "conflicts": [
    {
      "type": "TEACHER_CONFLICT",
      "message": "Teacher Ramesh Sharma is already scheduled for Mathematics in Class 8 (A) from 09:00 to 10:00.",
      "conflictingEntry": {
        "id": "e89b4f2c-...",
        "subject": "Mathematics",
        "dayOfWeek": "MONDAY",
        "startTime": "09:00",
        "endTime": "10:00",
        "teacherName": "Ramesh Sharma",
        "className": "Class 8 (A)"
      }
    }
  ]
}
```

---

## 4. REST API Endpoint Reference

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/timetable/weekly` | Authenticated | Weekly timetable grid grouped Monday–Saturday with summary metrics. |
| `GET` | `/api/v1/timetable/my-schedule` | Authenticated | Current logged-in teacher's personal teaching schedule. |
| `POST` | `/api/v1/timetable/validate-slot`| Authenticated | Live pre-flight conflict validation endpoint. |
| `GET` | `/api/v1/timetable` | Authenticated | Filtered list of timetable entries with search. |
| `GET` | `/api/v1/timetable/:id` | Authenticated | Single timetable entry details. |
| `POST` | `/api/v1/timetable` | **Admin Only** | Schedule new period slot with conflict verification. |
| `PUT` | `/api/v1/timetable/:id` | **Admin Only** | Update period slot with conflict verification. |
| `DELETE` | `/api/v1/timetable/:id` | **Admin Only** | Delete timetable period slot. |

---

## 5. Frontend User Interface Features

The `TimetableManagement` component provides:
1. **Interactive Weekly Grid:** Full Monday through Saturday view displaying all scheduled classes, time ranges, teachers, and room numbers.
2. **Class & Faculty Filters:** Filter the timetable by class or teacher with one click.
3. **Live Conflict Checking:** As the administrator selects day, time, teacher, and room in the scheduling modal, pre-flight conflict checks highlight any overlapping schedules in real time before submission.
4. **Color-Coded Subject Pills:** Visual differentiation across Mathematics, Science, English, Hindi, Social Science, and Computer Science.
5. **Role-Adaptive Interface:** Administrators have full add/edit/delete capabilities, while teachers view their own schedule and class allocations.

---

## 6. Automated Test Coverage

The timetable subsystem is backed by 25 focused automated integration tests in `backend/tests/timetable.test.js`:
- Authentication and RBAC controls (Admin write, Teacher read).
- Input validation (day of week, time formats, slot duration $> 15$ mins).
- Overlapping teacher conflict detection (409 Conflict).
- Overlapping class conflict detection (409 Conflict).
- Classroom double-booking conflict detection (409 Conflict).
- Adjacent time slots and multi-day scheduling.
- Pre-flight conflict check endpoint verification.
- Search, class filter, and teacher filter queries.
- Update conflict handling and deletion lifecycle.
