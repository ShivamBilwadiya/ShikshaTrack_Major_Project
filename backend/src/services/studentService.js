import prisma from '../config/db.js';
import { generateSecureQrToken, generateQrDataUrl } from '../utils/qr.js';
import { logAudit } from './auditService.js';

export const listStudents = async ({
  schoolId,
  classId,
  search,
  active = true,
  page = 1,
  limit = 50,
}) => {
  const where = {
    schoolId,
    active: active === 'all' ? undefined : Boolean(active),
  };

  if (classId) {
    where.classId = classId;
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { admissionNumber: { contains: term, mode: 'insensitive' } },
      { rollNumber: { contains: term, mode: 'insensitive' } },
      { guardianName: { contains: term, mode: 'insensitive' } },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      include: {
        class: {
          select: { id: true, name: true, section: true, academicYear: true },
        },
      },
      orderBy: [{ classId: 'asc' }, { rollNumber: 'asc' }, { name: 'asc' }],
      skip,
      take,
    }),
  ]);

  return {
    students,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

export const getStudentById = async (id, schoolId) => {
  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    include: {
      class: true,
      school: {
        select: { id: true, name: true, code: true, address: true },
      },
      attendanceRecords: {
        include: {
          session: true,
        },
        orderBy: { markedAt: 'desc' },
        take: 30,
      },
    },
  });

  if (!student) {
    throw new Error('Student not found.');
  }

  // Calculate attendance summary
  const totalRecords = student.attendanceRecords.length;
  const presentCount = student.attendanceRecords.filter((r) => r.status === 'PRESENT').length;
  const lateCount = student.attendanceRecords.filter((r) => r.status === 'LATE').length;
  const absentCount = student.attendanceRecords.filter((r) => r.status === 'ABSENT').length;
  const attendanceRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0;

  const qrDataUrl = await generateQrDataUrl(student.qrToken);

  return {
    ...student,
    qrDataUrl,
    stats: {
      totalRecords,
      presentCount,
      lateCount,
      absentCount,
      attendanceRate,
    },
  };
};

export const getStudentByQrToken = async (qrToken, schoolId) => {
  const student = await prisma.student.findFirst({
    where: { qrToken, schoolId, active: true },
    include: {
      class: true,
    },
  });

  if (!student) {
    throw new Error('Invalid or unrecognized Student QR Code.');
  }

  return student;
};

export const createStudent = async ({
  name,
  admissionNumber,
  rollNumber,
  classId,
  schoolId,
  dateOfBirth,
  gender,
  guardianName,
  guardianPhone,
  actorId,
}) => {
  // Check admission number uniqueness in school
  const existing = await prisma.student.findFirst({
    where: { schoolId, admissionNumber: admissionNumber.trim() },
  });

  if (existing) {
    throw new Error(`A student with Admission Number '${admissionNumber}' already exists in this school.`);
  }

  const qrToken = generateSecureQrToken();

  const student = await prisma.student.create({
    data: {
      name: name.trim(),
      admissionNumber: admissionNumber.trim(),
      rollNumber: rollNumber ? rollNumber.trim() : null,
      classId,
      schoolId,
      qrToken,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender || null,
      guardianName: guardianName ? guardianName.trim() : null,
      guardianPhone: guardianPhone ? guardianPhone.trim() : null,
      active: true,
    },
    include: {
      class: true,
    },
  });

  await logAudit({
    actorId,
    action: 'STUDENT_CREATED',
    entityType: 'Student',
    entityId: student.id,
    newValue: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      classId: student.classId,
    },
  });

  const qrDataUrl = await generateQrDataUrl(student.qrToken);
  return { ...student, qrDataUrl };
};

export const updateStudent = async (
  id,
  schoolId,
  { name, admissionNumber, rollNumber, classId, dateOfBirth, gender, guardianName, guardianPhone, active, actorId }
) => {
  const current = await getStudentById(id, schoolId);

  if (admissionNumber && admissionNumber !== current.admissionNumber) {
    const existing = await prisma.student.findFirst({
      where: { schoolId, admissionNumber: admissionNumber.trim(), id: { not: id } },
    });
    if (existing) {
      throw new Error(`Admission Number '${admissionNumber}' is already used by another student.`);
    }
  }

  const updated = await prisma.student.update({
    where: { id },
    data: {
      name: name ? name.trim() : current.name,
      admissionNumber: admissionNumber ? admissionNumber.trim() : current.admissionNumber,
      rollNumber: rollNumber !== undefined ? rollNumber : current.rollNumber,
      classId: classId || current.classId,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : current.dateOfBirth,
      gender: gender !== undefined ? gender : current.gender,
      guardianName: guardianName !== undefined ? guardianName : current.guardianName,
      guardianPhone: guardianPhone !== undefined ? guardianPhone : current.guardianPhone,
      active: active !== undefined ? Boolean(active) : current.active,
    },
    include: {
      class: true,
    },
  });

  await logAudit({
    actorId,
    action: 'STUDENT_UPDATED',
    entityType: 'Student',
    entityId: id,
    previousValue: current,
    newValue: updated,
  });

  return updated;
};

export const regenerateStudentQrToken = async (id, schoolId, actorId) => {
  const current = await getStudentById(id, schoolId);
  const newQrToken = generateSecureQrToken();

  const updated = await prisma.student.update({
    where: { id },
    data: { qrToken: newQrToken },
    include: { class: true },
  });

  await logAudit({
    actorId,
    action: 'STUDENT_QR_REGENERATED',
    entityType: 'Student',
    entityId: id,
    previousValue: { qrToken: current.qrToken },
    newValue: { qrToken: newQrToken },
    reason: 'Security token reset / replacement card requested.',
  });

  const qrDataUrl = await generateQrDataUrl(newQrToken);
  return { ...updated, qrDataUrl };
};

export const getPrintableCards = async (schoolId, classId = null) => {
  const where = { schoolId, active: true };
  if (classId) where.classId = classId;

  const students = await prisma.student.findMany({
    where,
    include: {
      class: true,
      school: true,
    },
    orderBy: [{ classId: 'asc' }, { rollNumber: 'asc' }, { name: 'asc' }],
  });

  const cards = await Promise.all(
    students.map(async (student) => {
      const qrDataUrl = await generateQrDataUrl(student.qrToken);
      return {
        id: student.id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        className: `${student.class.name}-${student.class.section}`,
        academicYear: student.class.academicYear,
        schoolName: student.school.name,
        schoolCode: student.school.code,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        qrToken: student.qrToken,
        qrDataUrl,
      };
    })
  );

  return cards;
};

