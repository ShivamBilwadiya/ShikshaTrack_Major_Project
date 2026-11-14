# Faculty and Class Assignment Management Specification

This specification documents the **Faculty and Class Assignment Management** subsystem in **ShikshaTrack**. It outlines the architectural design, database relationships, business validation rules, security constraints, and full REST API endpoint specifications.

---

## 1. Architectural Overview

In rural primary and upper-primary schools, faculty members often manage multiple classrooms and grades simultaneously. To support this while preserving referential integrity, ShikshaTrack uses a normalized relational model in **Third Normal Form (3NF)**:

```
┌─────────────────────────┐          1:M          ┌───────────────────────────┐
│         School          │──────────────────────▶│           User            │
│  (Institution Profile)  │                       │      (Role = TEACHER)     │
└─────────────────────────┘                       └───────────────────────────┘
             │                                                  │
             │ 1:M                                              │ 1:M
             ▼                                                  ▼
┌─────────────────────────┐          M:N          ┌───────────────────────────┐
│          Class          │◀──────────────────────│     TeacherAssignment     │
│ (Grade, Section, Year)  │  (Class In-charge)    │ (teacherId, classId, etc) │
└─────────────────────────┘                       └───────────────────────────┘
```

### Relational Entities:
1. **`users`**: Base entity for administrative and teaching personnel (`role = 'TEACHER'`), secured with salted bcrypt hashes and tied to a single `schoolId`.
2. **`classes`**: Grade level and section within a school academic year (e.g., *Class 8-A, 2026-2027*).
3. **`teacher_assignments`**: Associative junction table resolving the many-to-many relationship between faculty and classes. Includes composite unique constraint `@@unique([teacherId, classId])` and boolean flag `isClassTeacher` indicating primary class in-charge status.

---

## 2. Business Validation & Security Constraints

The subsystem enforces strict business logic across all operations:

1. **Role-Based Access Control (RBAC):**
   - All teacher management endpoints are strictly restricted to authenticated users with the `ADMIN` role.
   - Non-admin callers (such as teachers) receive `403 Forbidden`. Requests lacking valid JWT tokens receive `401 Unauthorized`.

2. **Name & Identity Sanitization:**
   - Teacher names are trimmed of extraneous whitespace.
   - Names must be between 2 and 100 characters in length.

3. **Email Validation & Normalization:**
   - Emails are converted to lowercase and trimmed.
   - Emails must match RFC standard format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
   - Duplicate email registration across active and inactive accounts is rejected with `409 Conflict`.

4. **Multi-Tenant School Boundary Protection:**
   - When assigning teachers to classes, the system verifies that each `classId` belongs to the administrator's `schoolId`.
   - Any attempt to assign a class ID from another school or a non-existent class is rejected with `400 Bad Request`.

5. **Designated Class Teacher Uniqueness:**
   - A single class can have at most one active `isClassTeacher: true` assigned at any time.
   - Attempting to designate a second teacher as class in-charge without unassigning the incumbent returns `409 Conflict`.

6. **Safe Deactivation vs. Permanent Deletion:**
   - When deleting a teacher who has conducted attendance sessions, the record is **not** hard-deleted to preserve historical audit logs and attendance registers.
   - Instead, the account is marked `active: false`, current class assignments are unlinked, and a `TEACHER_DEACTIVATED` audit log is recorded.
   - Teachers with zero attendance sessions can be safely permanently removed from the database (`TEACHER_DELETED`).

7. **Audit Logging:**
   - Every mutation records an immutable entry in the `audit_logs` table capturing `actorId`, `action`, `entityType`, `entityId`, `previousValue`, `newValue`, and `reason`.

---

## 3. REST API Endpoint Reference

Base Route: `/api/v1/teachers`  
Header: `Authorization: Bearer <ADMIN_JWT_TOKEN>`

### 3.1 List Teachers
- **Method:** `GET /api/v1/teachers`
- **Query Parameters:**
  - `search` *(optional, string)*: Filter by case-insensitive name or email substring.
  - `status` *(optional, string)*: Filter by `'active'`, `'inactive'`, or `'all'`. Default `'all'`.
  - `classId` *(optional, string)*: Filter teachers assigned to a specific class.
  - `page` *(optional, integer)*: Page number (1-based).
  - `limit` *(optional, integer)*: Records per page (default: 20, max: 100).
  - `sortBy` *(optional, string)*: Field to order by (`'name'`, `'email'`, `'createdAt'`). Default `'name'`.
  - `sortOrder` *(optional, string)*: Direction (`'asc'` or `'desc'`). Default `'asc'`.
- **Response (Unpaginated - Default Backward Compatibility):**
  ```json
  {
    "success": true,
    "message": "Teachers retrieved successfully.",
    "data": [
      {
        "id": "6704d80a-9d33-4f52-8d7b-9994c65e23da",
        "name": "Ramesh Sharma",
        "email": "ramesh.teacher@shikshatrack.in",
        "active": true,
        "createdAt": "2026-11-14T02:29:00.000Z",
        "updatedAt": "2026-11-14T02:29:00.000Z",
        "teacherAssignments": [
          {
            "id": "assignment-uuid-1",
            "classId": "class-8a-uuid",
            "isClassTeacher": true,
            "assignedAt": "2026-11-14T02:29:00.000Z",
            "class": {
              "id": "class-8a-uuid",
              "name": "Class 8",
              "section": "A",
              "academicYear": "2026-2027"
            }
          }
        ],
        "_count": {
          "attendanceSessions": 12
        }
      }
    ]
  }
  ```
- **Response (Paginated when `page` or `limit` is provided):**
  ```json
  {
    "success": true,
    "message": "Teachers retrieved successfully.",
    "data": {
      "teachers": [...],
      "pagination": {
        "total": 15,
        "page": 1,
        "limit": 10,
        "totalPages": 2,
        "hasNextPage": true,
        "hasPrevPage": false
      }
    }
  }
  ```

---

### 3.2 Create Teacher
- **Method:** `POST /api/v1/teachers`
- **Request Body:**
  ```json
  {
    "name": "Vikram Aditya",
    "email": "vikram.aditya@shikshatrack.in",
    "password": "securePassword123",
    "assignedClassIds": ["class-8b-uuid"],
    "assignments": [
      { "classId": "class-8b-uuid", "isClassTeacher": false }
    ]
  }
  ```
- **Response Status:** `201 Created`
- **Error Codes:**
  - `400 Bad Request`: Missing name/email, name length invalid, invalid email format, short password, or foreign class ID.
  - `409 Conflict`: Duplicate email or class teacher designation conflict.

---

### 3.3 Get Teacher Details
- **Method:** `GET /api/v1/teachers/:id`
- **Response Status:** `200 OK`
- **Error Codes:** `404 Not Found` if teacher does not exist in school.

---

### 3.4 Update Teacher Profile
- **Method:** `PUT /api/v1/teachers/:id` (or `PATCH /api/v1/teachers/:id`)
- **Request Body:**
  ```json
  {
    "name": "Dr. Vikram Aditya",
    "email": "dr.vikram@shikshatrack.in",
    "active": true
  }
  ```
- **Response Status:** `200 OK`
- **Error Codes:**
  - `400 Bad Request`: Validation failure.
  - `404 Not Found`: Teacher not found.
  - `409 Conflict`: Email already in use by another account.

---

### 3.5 Delete or Safely Deactivate Teacher
- **Method:** `DELETE /api/v1/teachers/:id`
- **Behavior:**
  - If teacher has prior attendance records: Safely deactivates account (`active: false`) and removes current class assignments.
  - If teacher has no prior records: Hard-deletes record and assignments.
- **Response Status:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Teacher \"Vikram Aditya\" deleted successfully.",
    "data": {
      "success": true,
      "deleted": true
    }
  }
  ```

---

### 3.6 Get Teacher Assigned Classes & Workload
- **Method:** `GET /api/v1/teachers/:id/classes`
- **Response Status:** `200 OK`
- **Sample Response:**
  ```json
  {
    "success": true,
    "message": "Teacher classes and workload retrieved successfully.",
    "data": {
      "teacherId": "6704d80a-9d33-4f52-8d7b-9994c65e23da",
      "teacherName": "Ramesh Sharma",
      "teacherEmail": "ramesh.teacher@shikshatrack.in",
      "active": true,
      "totalAssignedClasses": 1,
      "classes": [
        {
          "classId": "class-8a-uuid",
          "name": "Class 8",
          "section": "A",
          "academicYear": "2026-2027",
          "isClassTeacher": true,
          "totalStudents": 42,
          "assignedAt": "2026-11-14T02:29:00.000Z",
          "todaysSession": {
            "sessionId": "session-uuid",
            "status": "OPEN",
            "openedBySelf": true
          }
        }
      ]
    }
  }
  ```

---

### 3.7 Bulk Replace Teacher Class Assignments
- **Method:** `PUT /api/v1/teachers/:id/assignments`
- **Request Body:** Accepts either an array of class ID strings or structured assignment objects:
  ```json
  {
    "assignments": [
      { "classId": "class-8a-uuid", "isClassTeacher": true },
      { "classId": "class-9a-uuid", "isClassTeacher": false }
    ]
  }
  ```
- **Response Status:** `200 OK`
- **Error Codes:**
  - `400 Bad Request`: Class ID does not belong to school.
  - `409 Conflict`: Another teacher is already designated as Class Teacher for one of the classes.

---

### 3.8 Add Single Class Assignment
- **Method:** `POST /api/v1/teachers/:id/assignments`
- **Request Body:**
  ```json
  {
    "classId": "class-8b-uuid",
    "isClassTeacher": false
  }
  ```
- **Response Status:** `201 Created`
- **Error Codes:**
  - `400 Bad Request`: Missing classId or teacher already assigned to this class.
  - `404 Not Found`: Teacher or Class does not exist in school.
  - `409 Conflict`: Target class already has a designated Class Teacher.

---

### 3.9 Remove Single Class Assignment
- **Method:** `DELETE /api/v1/teachers/:id/assignments/:classId`
- **Response Status:** `200 OK`
- **Error Codes:** `404 Not Found` if assignment does not exist.

---

### 3.10 Toggle Teacher Active Status
- **Method:** `PATCH /api/v1/teachers/:id/toggle-status`
- **Response Status:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Teacher status updated to inactive.",
    "data": {
      "id": "teacher-uuid",
      "name": "Ramesh Sharma",
      "active": false
    }
  }
  ```

---

## 4. Verification and Test Suite Coverage

The feature is validated by automated integration tests in `backend/tests/teachers.test.js`:
- RBAC validation (token presence and `ADMIN` role enforcement).
- Search by name/email substring and active status filtering.
- Pagination calculation (limits, pages, total counts, offset skip).
- Input trimming, email validation regex, and minimum password enforcement.
- Duplicate email prevention (`409 Conflict`).
- Multi-tenant foreign class isolation and validation.
- Designated Class Teacher conflict detection.
- Bulk and granular assignment management.
- Duplicate assignment rejection.
- Safe historical deactivation vs permanent deletion.
- Active state toggling.
