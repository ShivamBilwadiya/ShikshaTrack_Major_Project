# Parent Portal & School Communication Management Subsystem

This document provides the technical architecture, data models, authorization boundaries, and communication workflows for the **Parent Portal & School Communication Management Subsystem** in **ShikshaTrack**.

---

## 1. System Overview & Architecture

The Parent Portal provides a dedicated, secure interface for guardians to stay informed regarding their children's educational progress, attendance records, academic examinations, fee statements, and school announcements. It bridges teachers, administrators, and parents through authorized, audited communication channels.

```
┌────────────────────────────────────────────────────────┐
│                        School                          │
│     (Institutional root tenant isolation boundary)     │
└────────────────────────────────────────────────────────┘
          │
          ├─── 1:N ─── Parent (parents)
          │             ├── guardianName, phone, alternatePhone, address, status
          │             ├── userId (1:1 with User where role = PARENT)
          │             └── 1:N ─── ParentStudent (parent_students)
          │                          ├── studentId (N:M link to Student)
          │                          ├── relationship (FATHER, MOTHER, GUARDIAN, OTHER)
          │                          └── isPrimaryContact, canPickup
          │
          ├─── 1:N ─── SchoolAnnouncement (school_announcements)
          │             ├── title, content, category, priority, targetAudience
          │             ├── classId (optional: scoped to specific class)
          │             ├── authorId (User relation: ADMIN or TEACHER)
          │             ├── publishedAt, scheduledFor, attachmentUrl
          │             └── 1:N ─── AnnouncementRead (announcement_reads)
          │                          └── userId, readAt
          │
          └─── 1:N ─── CommunicationMessage (communication_messages)
                        ├── threadId, senderId, receiverId, studentId (context)
                        ├── subject, content, category, attachmentUrl
                        └── isRead, readAt, createdAt
```

---

## 2. Security & Confidentiality Isolation

### 1. Parent-to-Child Ownership Scoping
- **Scoped Record Retrieval:** Guardians are restricted strictly to querying students with active associations in `parent_students`.
- **403 Forbidden Enforcement:** Any API invocation requesting student attendance, academic marks, leaves, or fee ledgers for an unlinked student ID is rejected with HTTP `403 Forbidden`.
- **Administrative Privacy:** Internal faculty notes, teacher disciplinary logs, and administrative audit trails are never exposed to parent endpoints.

### 2. Audience-Aware Announcement Filtering
- Announcements with `targetAudience: ALL` are viewable across the institution.
- Announcements with `targetAudience: PARENTS` are filtered to authenticated guardian accounts.
- Announcements with `targetAudience: CLASS` are visible only to parents whose linked children belong to the target class.

---

## 3. Core Capabilities & Workflows

### 1. Guardian Account Onboarding & Student Linking
1. School administrators create parent records with contact details and temporary login credentials.
2. Wards are associated through `ParentStudent` records, supporting multiple children per guardian and multiple authorized guardians per child.
3. System logs `PARENT_ACCOUNT_CREATED` and `PARENT_STUDENT_LINKED` audit trails.

### 2. Parent Dashboard Aggregation
A consolidated API endpoint (`GET /api/v1/parents/dashboard?studentId=...`) aggregates:
- **Child Selector:** Multi-child switcher with active selection state.
- **Attendance Rate:** Verified attendance percentage, present/absent/late counts, and the 20 most recent register records.
- **Academic Progress:** Term exam results, total marks, percentage, overall grade, and subject-wise score breakdown.
- **Fee Ledger:** Net billed, total paid, pending balance, upcoming installment schedule, and official receipt history.
- **Leave History:** Absence applications and approval statuses.
- **Active Notices:** High-priority circulars and broadcasts.

### 3. Direct Staff-to-Guardian Messaging
- Threaded peer-to-peer communication between guardians and faculty members.
- Message categorization: `GENERAL`, `ACADEMIC`, `ATTENDANCE`, `FEES`, `URGENT`.
- Automatic notification creation for recipient upon message delivery.
- Contextual association with specific students for academic inquiries.

### 4. Guardian Leave Application
- Parents can submit student absence requests directly from the portal.
- Creates `StudentLeave` records in `PENDING` status.
- Automatically notifies the assigned class teacher.

---

## 4. REST API Endpoint Reference

| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/parents/dashboard` | `PARENT`, `ADMIN` | Retrieve aggregated dashboard for active child |
| `GET` | `/api/v1/parents/my-children` | `PARENT` | List all linked wards with summary metrics |
| `POST` | `/api/v1/parents/leaves` | `PARENT` | Submit student absence application |
| `GET` | `/api/v1/parents` | `ADMIN` | List all registered guardian accounts |
| `POST` | `/api/v1/parents` | `ADMIN` | Register guardian account and link student(s) |
| `GET` | `/api/v1/parents/:id` | `ADMIN`, `PARENT` | Fetch guardian profile details |
| `PUT` | `/api/v1/parents/:id` | `ADMIN`, `PARENT` | Update guardian contact information |
| `POST` | `/api/v1/parents/:id/link-student` | `ADMIN` | Associate additional ward to guardian |
| `DELETE` | `/api/v1/parents/:id/unlink-student/:studentId` | `ADMIN` | Remove ward association from guardian |
| `GET` | `/api/v1/communication/announcements` | All Authenticated | List announcements filtered by audience |
| `POST` | `/api/v1/communication/announcements` | `ADMIN`, `TEACHER` | Publish circular or broadcast |
| `GET` | `/api/v1/communication/announcements/:id` | All Authenticated | Get announcement details and mark read |
| `PUT` | `/api/v1/communication/announcements/:id` | `ADMIN`, Author | Update existing announcement |
| `DELETE` | `/api/v1/communication/announcements/:id` | `ADMIN`, Author | Delete announcement |
| `POST` | `/api/v1/communication/announcements/:id/read` | All Authenticated | Mark announcement read for viewer |
| `GET` | `/api/v1/communication/messages` | All Authenticated | List inbox or sent messages |
| `POST` | `/api/v1/communication/messages` | All Authenticated | Send direct message / initiate thread |
| `GET` | `/api/v1/communication/messages/threads/:threadId` | Participants | Get conversation history in thread |
| `POST` | `/api/v1/communication/messages/threads/:threadId/reply` | Participants | Post reply to conversation thread |
| `PATCH` | `/api/v1/communication/messages/:id/read` | Recipient | Mark direct message as read |
| `GET` | `/api/v1/communication/messages/unread-count` | All Authenticated | Get unread message count |
