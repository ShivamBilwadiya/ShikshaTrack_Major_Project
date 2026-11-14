import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';

const VALID_RELATIONSHIPS = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];
const VALID_STATUSES = ['ACTIVE', 'INVITED', 'INACTIVE'];

/**
 * Create a new parent account and link student(s)
 */
export const createParentAccount = async ({
  schoolId,
  email,
  password,
  guardianName,
  relationship = 'GUARDIAN',
  phone,
  alternatePhone = null,
  address = null,
  occupation = null,
  idProofNumber = null,
  studentIds = [],
  admissionNumbers = [],
  creatorUserId = null,
}) => {
  if (!schoolId) {
    const err = new Error('School ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!email || !password || !guardianName || !phone) {
    const err = new Error('Email, password, guardian name, and phone number are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedRel = String(relationship).toUpperCase();
  if (!VALID_RELATIONSHIPS.includes(normalizedRel)) {
    const err = new Error(`Invalid guardian relationship. Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Check if user email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    const err = new Error(`A user account with email "${normalizedEmail}" already exists.`);
    err.statusCode = 409;
    throw err;
  }

  // Find target students
  let targetStudents = [];
  if (studentIds.length > 0) {
    targetStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId,
      },
      include: { class: true },
    });
  } else if (admissionNumbers.length > 0) {
    targetStudents = await prisma.student.findMany({
      where: {
        admissionNumber: { in: admissionNumbers.map((a) => String(a).trim()) },
        schoolId,
      },
      include: { class: true },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        schoolId,
        email: normalizedEmail,
        passwordHash,
        name: guardianName.trim(),
        role: 'PARENT',
        active: true,
      },
    });

    // 2. Create Parent Profile
    const parent = await tx.parent.create({
      data: {
        schoolId,
        userId: user.id,
        guardianName: guardianName.trim(),
        relationship: normalizedRel,
        phone: phone.trim(),
        alternatePhone: alternatePhone ? alternatePhone.trim() : null,
        address: address ? address.trim() : null,
        occupation: occupation ? occupation.trim() : null,
        idProofNumber: idProofNumber ? idProofNumber.trim() : null,
        status: 'ACTIVE',
      },
    });

    // 3. Link Students
    if (targetStudents.length > 0) {
      await tx.parentStudent.createMany({
        data: targetStudents.map((student, idx) => ({
          parentId: parent.id,
          studentId: student.id,
          relationship: normalizedRel,
          isPrimaryContact: idx === 0,
          canPickup: true,
        })),
        skipDuplicates: true,
      });
    }

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: creatorUserId || user.id,
        action: 'PARENT_ACCOUNT_CREATED',
        entityType: 'Parent',
        entityId: parent.id,
        newValue: JSON.stringify({
          email: normalizedEmail,
          guardianName,
          relationship: normalizedRel,
          linkedStudentsCount: targetStudents.length,
          linkedStudentIds: targetStudents.map((s) => s.id),
        }),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      parent,
      linkedStudents: targetStudents.map((s) => ({
        id: s.id,
        name: s.name,
        admissionNumber: s.admissionNumber,
        className: `${s.class.name}-${s.class.section}`,
      })),
    };
  });

  // Welcome notification
  try {
    await createNotification({
      schoolId,
      userId: result.user.id,
      title: 'Welcome to ShikshaTrack Parent Portal',
      message: `Dear ${guardianName}, your guardian portal account is now active. You can track academic records, attendance, and fee statements for your linked children.`,
      category: 'SUCCESS',
      type: 'GENERAL_ANNOUNCEMENT',
    });
  } catch (notifErr) {
    // Non-fatal notification failure
  }

  return result;
};

/**
 * List parents with search, filter, and pagination
 */
export const listParents = async ({
  schoolId,
  search = '',
  status = null,
  classId = null,
  page = 1,
  limit = 20,
}) => {
  if (!schoolId) {
    const err = new Error('School ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const take = Math.max(1, parseInt(limit, 10));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = { schoolId };

  if (status && VALID_STATUSES.includes(String(status).toUpperCase())) {
    where.status = String(status).toUpperCase();
  }

  if (classId) {
    where.students = {
      some: {
        student: {
          classId,
        },
      },
    };
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { guardianName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
      { user: { email: { contains: term, mode: 'insensitive' } } },
      {
        students: {
          some: {
            student: {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { admissionNumber: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        },
      },
    ];
  }

  const [totalCount, parents] = await Promise.all([
    prisma.parent.count({ where }),
    prisma.parent.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            active: true,
            createdAt: true,
          },
        },
        students: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                admissionNumber: true,
                rollNumber: true,
                classId: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                    section: true,
                    academicYear: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    parents: parents.map((p) => ({
      id: p.id,
      userId: p.userId,
      email: p.user?.email || '',
      guardianName: p.guardianName,
      relationship: p.relationship,
      phone: p.phone,
      alternatePhone: p.alternatePhone,
      address: p.address,
      occupation: p.occupation,
      idProofNumber: p.idProofNumber,
      status: p.status,
      active: p.user?.active ?? true,
      createdAt: p.createdAt,
      linkedStudents: p.students.map((ps) => ({
        linkId: ps.id,
        studentId: ps.student.id,
        name: ps.student.name,
        admissionNumber: ps.student.admissionNumber,
        rollNumber: ps.student.rollNumber,
        className: `${ps.student.class.name}-${ps.student.class.section}`,
        relationship: ps.relationship,
        isPrimaryContact: ps.isPrimaryContact,
        canPickup: ps.canPickup,
      })),
    })),
    pagination: {
      page: Math.max(1, parseInt(page, 10)),
      limit: take,
      totalCount,
      totalPages: Math.ceil(totalCount / take) || 1,
    },
  };
};

/**
 * Get parent by ID
 */
export const getParentById = async ({ schoolId, parentId }) => {
  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          createdAt: true,
        },
      },
      students: {
        include: {
          student: {
            include: {
              class: true,
            },
          },
        },
      },
    },
  });

  if (!parent) {
    const err = new Error('Parent record not found.');
    err.statusCode = 404;
    throw err;
  }

  return {
    id: parent.id,
    userId: parent.userId,
    email: parent.user?.email || '',
    guardianName: parent.guardianName,
    relationship: parent.relationship,
    phone: parent.phone,
    alternatePhone: parent.alternatePhone,
    address: parent.address,
    occupation: parent.occupation,
    idProofNumber: parent.idProofNumber,
    status: parent.status,
    active: parent.user?.active ?? true,
    createdAt: parent.createdAt,
    linkedStudents: parent.students.map((ps) => ({
      linkId: ps.id,
      studentId: ps.student.id,
      name: ps.student.name,
      admissionNumber: ps.student.admissionNumber,
      rollNumber: ps.student.rollNumber,
      gender: ps.student.gender,
      dateOfBirth: ps.student.dateOfBirth,
      className: `${ps.student.class.name}-${ps.student.class.section}`,
      classId: ps.student.classId,
      relationship: ps.relationship,
      isPrimaryContact: ps.isPrimaryContact,
      canPickup: ps.canPickup,
    })),
  };
};

/**
 * Update parent profile
 */
export const updateParentProfile = async ({
  schoolId,
  parentId,
  data,
  updatedByUserId = null,
}) => {
  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId },
    include: { user: true },
  });

  if (!parent) {
    const err = new Error('Parent record not found.');
    err.statusCode = 404;
    throw err;
  }

  const updateFields = {};
  if (data.guardianName) updateFields.guardianName = data.guardianName.trim();
  if (data.phone) updateFields.phone = data.phone.trim();
  if (data.alternatePhone !== undefined) updateFields.alternatePhone = data.alternatePhone ? data.alternatePhone.trim() : null;
  if (data.address !== undefined) updateFields.address = data.address ? data.address.trim() : null;
  if (data.occupation !== undefined) updateFields.occupation = data.occupation ? data.occupation.trim() : null;
  if (data.idProofNumber !== undefined) updateFields.idProofNumber = data.idProofNumber ? data.idProofNumber.trim() : null;
  if (data.relationship) {
    const rel = String(data.relationship).toUpperCase();
    if (VALID_RELATIONSHIPS.includes(rel)) {
      updateFields.relationship = rel;
    }
  }
  if (data.status) {
    const st = String(data.status).toUpperCase();
    if (VALID_STATUSES.includes(st)) {
      updateFields.status = st;
    }
  }

  const updatedParent = await prisma.$transaction(async (tx) => {
    const updated = await tx.parent.update({
      where: { id: parentId },
      data: updateFields,
    });

    if (updateFields.guardianName) {
      await tx.user.update({
        where: { id: parent.userId },
        data: { name: updateFields.guardianName },
      });
    }

    if (data.status && data.status === 'INACTIVE') {
      await tx.user.update({
        where: { id: parent.userId },
        data: { active: false },
      });
    } else if (data.status && data.status === 'ACTIVE') {
      await tx.user.update({
        where: { id: parent.userId },
        data: { active: true },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: updatedByUserId || parent.userId,
        action: 'PARENT_PROFILE_UPDATED',
        entityType: 'Parent',
        entityId: parentId,
        newValue: JSON.stringify(updateFields),
      },
    });

    return updated;
  });

  return updatedParent;
};

/**
 * Link a student to a parent
 */
export const linkStudentToParent = async ({
  schoolId,
  parentId,
  studentId,
  relationship = 'GUARDIAN',
  isPrimaryContact = true,
  canPickup = true,
  linkedByUserId = null,
}) => {
  const [parent, student] = await Promise.all([
    prisma.parent.findFirst({ where: { id: parentId, schoolId } }),
    prisma.student.findFirst({ where: { id: studentId, schoolId }, include: { class: true } }),
  ]);

  if (!parent) {
    const err = new Error('Parent record not found.');
    err.statusCode = 404;
    throw err;
  }
  if (!student) {
    const err = new Error('Student record not found.');
    err.statusCode = 404;
    throw err;
  }

  const normalizedRel = String(relationship).toUpperCase();
  const rel = VALID_RELATIONSHIPS.includes(normalizedRel) ? normalizedRel : parent.relationship;

  const link = await prisma.parentStudent.upsert({
    where: {
      parentId_studentId: {
        parentId,
        studentId,
      },
    },
    update: {
      relationship: rel,
      isPrimaryContact: Boolean(isPrimaryContact),
      canPickup: Boolean(canPickup),
    },
    create: {
      parentId,
      studentId,
      relationship: rel,
      isPrimaryContact: Boolean(isPrimaryContact),
      canPickup: Boolean(canPickup),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: linkedByUserId || parent.userId,
      action: 'PARENT_STUDENT_LINKED',
      entityType: 'ParentStudent',
      entityId: link.id,
      newValue: JSON.stringify({
        parentId,
        studentId,
        studentName: student.name,
        admissionNumber: student.admissionNumber,
      }),
    },
  });

  return {
    success: true,
    message: `Student ${student.name} linked to parent successfully.`,
    link,
    student: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      className: `${student.class.name}-${student.class.section}`,
    },
  };
};

/**
 * Unlink a student from a parent
 */
export const unlinkStudentFromParent = async ({
  schoolId,
  parentId,
  studentId,
  unlinkedByUserId = null,
}) => {
  const link = await prisma.parentStudent.findFirst({
    where: {
      parentId,
      studentId,
      parent: { schoolId },
    },
    include: { student: true },
  });

  if (!link) {
    const err = new Error('Link between specified parent and student does not exist.');
    err.statusCode = 404;
    throw err;
  }

  await prisma.parentStudent.delete({
    where: { id: link.id },
  });

  await prisma.auditLog.create({
    data: {
      actorId: unlinkedByUserId || link.parentId,
      action: 'PARENT_STUDENT_UNLINKED',
      entityType: 'ParentStudent',
      entityId: link.id,
      newValue: JSON.stringify({
        parentId,
        studentId,
        studentName: link.student?.name,
      }),
    },
  });

  return {
    success: true,
    message: 'Student unlinked from parent successfully.',
  };
};

/**
 * Validate that a parent user has access to a specific student
 */
export const validateParentChildAccess = async ({ parentUserId, studentId, schoolId }) => {
  const link = await prisma.parentStudent.findFirst({
    where: {
      studentId,
      parent: {
        userId: parentUserId,
        schoolId,
      },
    },
  });

  if (!link) {
    const err = new Error('Forbidden: You do not have authorized guardian access to this student.');
    err.statusCode = 403;
    throw err;
  }

  return link;
};

/**
 * Get all linked children for the authenticated parent
 */
export const getParentLinkedStudents = async ({ parentUserId, schoolId }) => {
  const parent = await prisma.parent.findFirst({
    where: { userId: parentUserId, schoolId },
    include: {
      students: {
        include: {
          student: {
            include: {
              class: true,
              attendanceRecords: {
                take: 30,
                orderBy: { markedAt: 'desc' },
              },
              studentFees: {
                include: {
                  installments: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parent) {
    const err = new Error('Parent profile not found.');
    err.statusCode = 404;
    throw err;
  }

  return parent.students.map((ps) => {
    const s = ps.student;
    const totalRecords = s.attendanceRecords.length;
    const presentRecords = s.attendanceRecords.filter(
      (r) => r.status === 'PRESENT' || r.status === 'LATE'
    ).length;
    const attendancePercentage = totalRecords > 0
      ? Math.round((presentRecords / totalRecords) * 100)
      : 100;

    // Fees calculation
    let totalBilled = 0;
    let totalPaid = 0;
    let balance = 0;
    let overdueCount = 0;

    s.studentFees.forEach((sf) => {
      totalBilled += sf.netAmount;
      totalPaid += sf.paidAmount;
      balance += sf.balance;
      sf.installments.forEach((inst) => {
        if (inst.status === 'OVERDUE') overdueCount += 1;
      });
    });

    return {
      studentId: s.id,
      name: s.name,
      admissionNumber: s.admissionNumber,
      rollNumber: s.rollNumber,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth,
      classId: s.classId,
      className: `${s.class.name}-${s.class.section}`,
      academicYear: s.class.academicYear,
      relationship: ps.relationship,
      isPrimaryContact: ps.isPrimaryContact,
      canPickup: ps.canPickup,
      attendancePercentage,
      totalSessionsRecorded: totalRecords,
      feeSummary: {
        totalBilled,
        totalPaid,
        balance,
        hasOverdue: overdueCount > 0,
        overdueCount,
      },
    };
  });
};

/**
 * Aggregate comprehensive data for the Parent Dashboard
 */
export const getParentDashboardData = async ({ parentUserId, schoolId, studentId = null }) => {
  const parent = await prisma.parent.findFirst({
    where: { userId: parentUserId, schoolId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      students: {
        include: {
          student: {
            include: {
              class: {
                include: {
                  teacherAssignments: {
                    where: { isClassTeacher: true },
                    include: {
                      teacher: {
                        select: { id: true, name: true, email: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parent) {
    const err = new Error('Parent profile not found.');
    err.statusCode = 404;
    throw err;
  }

  if (parent.students.length === 0) {
    return {
      parent: {
        id: parent.id,
        guardianName: parent.guardianName,
        email: parent.user?.email || '',
        phone: parent.phone,
        relationship: parent.relationship,
      },
      linkedChildren: [],
      selectedStudent: null,
      attendance: null,
      examinations: null,
      fees: null,
      leaves: null,
      announcements: [],
      unreadCounts: { messages: 0, notifications: 0 },
    };
  }

  // Determine active student
  let activeStudentId = studentId;
  if (!activeStudentId) {
    activeStudentId = parent.students[0].student.id;
  } else {
    const hasAccess = parent.students.some((ps) => ps.student.id === activeStudentId);
    if (!hasAccess) {
      const err = new Error('Forbidden: You do not have authorized guardian access to the requested student.');
      err.statusCode = 403;
      throw err;
    }
  }

  const selectedPs = parent.students.find((ps) => ps.student.id === activeStudentId);
  const selectedStudent = selectedPs.student;
  const classTeacher = selectedStudent.class.teacherAssignments[0]?.teacher || null;

  // Run parallel queries for child details
  const [
    attendanceRecords,
    examMarks,
    studentFees,
    studentLeaves,
    announcements,
    unreadMessagesCount,
    unreadNotificationsCount,
  ] = await Promise.all([
    // Attendance records
    prisma.attendanceRecord.findMany({
      where: { studentId: activeStudentId },
      orderBy: { markedAt: 'desc' },
      take: 20,
      include: {
        session: {
          select: {
            sessionDate: true,
            status: true,
            notes: true,
          },
        },
      },
    }),

    // Examination marks
    prisma.examMark.findMany({
      where: { studentId: activeStudentId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        examSubject: {
          include: {
            examination: {
              select: {
                id: true,
                name: true,
                examType: true,
                academicYear: true,
                startDate: true,
              },
            },
          },
        },
      },
    }),

    // Fees
    prisma.studentFee.findMany({
      where: { studentId: activeStudentId },
      include: {
        feeStructure: {
          select: {
            id: true,
            name: true,
            category: true,
            academicYear: true,
          },
        },
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 5,
        },
      },
    }),

    // Leaves
    prisma.studentLeave.findMany({
      where: { studentId: activeStudentId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        reason: true,
        status: true,
        reviewRemarks: true,
        createdAt: true,
      },
    }),

    // Announcements
    prisma.schoolAnnouncement.findMany({
      where: {
        schoolId,
        isPublished: true,
        OR: [
          { targetAudience: 'ALL' },
          { targetAudience: 'PARENTS' },
          { targetAudience: 'CLASS', classId: selectedStudent.classId },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      include: {
        author: { select: { id: true, name: true, role: true } },
        reads: {
          where: { userId: parentUserId },
          select: { readAt: true },
        },
      },
    }),

    // Unread messages
    prisma.communicationMessage.count({
      where: {
        schoolId,
        receiverId: parentUserId,
        isRead: false,
      },
    }),

    // Unread notifications
    prisma.notification.count({
      where: {
        schoolId,
        isRead: false,
        OR: [
          { userId: parentUserId },
          { userId: null },
        ],
      },
    }),
  ]);

  // Aggregate Attendance
  const totalAttSessions = attendanceRecords.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  attendanceRecords.forEach((r) => {
    if (r.status === 'PRESENT') presentCount += 1;
    else if (r.status === 'ABSENT') absentCount += 1;
    else if (r.status === 'LATE') lateCount += 1;
  });

  const attendanceScore = totalAttSessions > 0
    ? ((presentCount + lateCount * 0.5) / totalAttSessions) * 100
    : 100;
  const attendanceRate = Math.round(attendanceScore);

  let attendanceBadge = 'EXCELLENT';
  if (attendanceRate < 75) attendanceBadge = 'ATTENTION_NEEDED';
  else if (attendanceRate < 85) attendanceBadge = 'GOOD';

  // Aggregate Examinations
  const examsGrouped = {};
  examMarks.forEach((mark) => {
    const exam = mark.examSubject?.examination;
    if (!exam) return;
    const examId = exam.id;
    if (!examsGrouped[examId]) {
      examsGrouped[examId] = {
        examId: exam.id,
        name: exam.name,
        term: exam.academicYear,
        type: exam.examType,
        academicYear: exam.academicYear,
        date: exam.startDate,
        subjects: [],
        totalMarks: 0,
        obtainedMarks: 0,
      };
    }
    const maxMarks = mark.examSubject?.maxMarks || 100;
    const passMarks = mark.examSubject?.passMarks || 40;
    examsGrouped[examId].totalMarks += maxMarks;
    examsGrouped[examId].obtainedMarks += mark.marksObtained;
    const isPassed = mark.marksObtained >= passMarks;
    examsGrouped[examId].subjects.push({
      subjectName: mark.examSubject?.subjectName || 'Subject',
      marksObtained: mark.marksObtained,
      maxMarks,
      grade: mark.marksObtained >= 80 ? 'A' : mark.marksObtained >= 60 ? 'B' : mark.marksObtained >= 40 ? 'C' : 'F',
      isPassed,
    });
  });

  const examList = Object.values(examsGrouped).map((ex) => {
    const pct = ex.totalMarks > 0 ? Math.round((ex.obtainedMarks / ex.totalMarks) * 100) : 0;
    let grade = 'F';
    if (pct >= 90) grade = 'A+';
    else if (pct >= 80) grade = 'A';
    else if (pct >= 70) grade = 'B';
    else if (pct >= 60) grade = 'C';
    else if (pct >= 50) grade = 'D';

    const allPassed = ex.subjects.every((s) => s.isPassed);
    return {
      ...ex,
      percentage: pct,
      overallGrade: grade,
      status: allPassed ? 'PASS' : 'NEEDS_IMPROVEMENT',
    };
  });

  // Aggregate Fees
  let totalBilled = 0;
  let totalPaid = 0;
  let feeBalance = 0;
  const installmentsList = [];
  const recentPaymentsList = [];

  studentFees.forEach((sf) => {
    totalBilled += sf.netAmount;
    totalPaid += sf.paidAmount;
    feeBalance += sf.balance;

    sf.installments.forEach((inst) => {
      installmentsList.push({
        id: inst.id,
        feeName: sf.feeStructure.name,
        category: sf.feeStructure.category,
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate,
        amount: inst.amount,
        paidAmount: inst.paidAmount,
        balance: inst.balance,
        status: inst.status,
      });
    });

    sf.payments.forEach((pay) => {
      recentPaymentsList.push({
        id: pay.id,
        receiptNumber: pay.receiptNumber,
        amount: pay.amount,
        paymentDate: pay.paymentDate,
        paymentMethod: pay.paymentMethod,
        transactionRef: pay.transactionRef,
      });
    });
  });

  return {
    parent: {
      id: parent.id,
      guardianName: parent.guardianName,
      email: parent.user?.email || '',
      phone: parent.phone,
      relationship: parent.relationship,
      status: parent.status,
    },
    linkedChildren: parent.students.map((ps) => ({
      studentId: ps.student.id,
      name: ps.student.name,
      admissionNumber: ps.student.admissionNumber,
      rollNumber: ps.student.rollNumber,
      className: `${ps.student.class.name}-${ps.student.class.section}`,
      relationship: ps.relationship,
      isSelected: ps.student.id === activeStudentId,
    })),
    selectedStudent: {
      id: selectedStudent.id,
      name: selectedStudent.name,
      admissionNumber: selectedStudent.admissionNumber,
      rollNumber: selectedStudent.rollNumber,
      dateOfBirth: selectedStudent.dateOfBirth,
      gender: selectedStudent.gender,
      classId: selectedStudent.classId,
      className: `${selectedStudent.class.name}-${selectedStudent.class.section}`,
      academicYear: selectedStudent.class.academicYear,
      classTeacher: classTeacher
        ? { id: classTeacher.id, name: classTeacher.name, email: classTeacher.email }
        : null,
    },
    attendance: {
      attendanceRate,
      statusBadge: attendanceBadge,
      presentCount,
      absentCount,
      lateCount,
      totalSessions: totalAttSessions,
      recentRecords: attendanceRecords.map((r) => ({
        id: r.id,
        date: r.session.sessionDate,
        status: r.status,
        method: r.method,
        notes: r.session.notes,
      })),
    },
    examinations: {
      exams: examList,
      recentCount: examList.length,
      averagePercentage: examList.length > 0
        ? Math.round(examList.reduce((acc, e) => acc + e.percentage, 0) / examList.length)
        : null,
    },
    fees: {
      totalBilled,
      totalPaid,
      balance: feeBalance,
      hasOverdue: installmentsList.some((i) => i.status === 'OVERDUE'),
      installments: installmentsList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
      recentPayments: recentPaymentsList.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)),
    },
    leaves: {
      leaves: studentLeaves,
      pendingCount: studentLeaves.filter((l) => l.status === 'PENDING').length,
      approvedCount: studentLeaves.filter((l) => l.status === 'APPROVED').length,
    },
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category,
      priority: a.priority,
      targetAudience: a.targetAudience,
      publishedAt: a.publishedAt,
      attachmentUrl: a.attachmentUrl,
      authorName: a.author.name,
      authorRole: a.author.role,
      isRead: a.reads.length > 0,
    })),
    unreadCounts: {
      messages: unreadMessagesCount,
      notifications: unreadNotificationsCount,
    },
  };
};

/**
 * Submit student leave application from Parent Portal
 */
export const submitParentLeaveApplication = async ({
  parentUserId,
  schoolId,
  studentId,
  leaveType,
  startDate,
  endDate,
  reason,
  documentUrl = null,
}) => {
  await validateParentChildAccess({ parentUserId, studentId, schoolId });

  if (!leaveType || !startDate || !endDate || !reason) {
    const err = new Error('Leave type, start date, end date, and reason are required.');
    err.statusCode = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error('Invalid date format.');
    err.statusCode = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error('Start date cannot be after end date.');
    err.statusCode = 400;
    throw err;
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: {
        include: {
          teacherAssignments: {
            where: { isClassTeacher: true },
          },
        },
      },
    },
  });

  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

  const leave = await prisma.studentLeave.create({
    data: {
      schoolId,
      studentId,
      classId: student.classId,
      appliedById: parentUserId,
      leaveType: String(leaveType).toUpperCase(),
      startDate: start,
      endDate: end,
      totalDays,
      reason: reason.trim(),
      documentUrl,
      status: 'PENDING',
    },
  });

  // Notify class teacher if available
  const classTeacherId = student.class.teacherAssignments[0]?.teacherId;
  if (classTeacherId) {
    try {
      await createNotification({
        schoolId,
        userId: classTeacherId,
        title: `Leave Application for ${student.name}`,
        message: `Guardian submitted a ${leaveType} leave request for ${student.name} from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
        category: 'INFO',
        type: 'LEAVE_APPLICATION',
        entityType: 'STUDENT',
        entityId: student.id,
      });
    } catch (e) {
      // Non-fatal
    }
  }

  return leave;
};
