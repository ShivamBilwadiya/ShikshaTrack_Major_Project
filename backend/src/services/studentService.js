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
  const cleanAdmission =
    typeof admissionNumber === 'string' ? admissionNumber.trim().toUpperCase() : admissionNumber;

  // Check admission number uniqueness in school
  const existing = await prisma.student.findFirst({
    where: { schoolId, admissionNumber: cleanAdmission },
  });

  if (existing) {
    throw new Error(`A student with Admission Number '${cleanAdmission}' already exists in this school.`);
  }

  const qrToken = generateSecureQrToken();

  const student = await prisma.student.create({
    data: {
      name: name.trim().replace(/\s+/g, ' '),
      admissionNumber: cleanAdmission,
      rollNumber: rollNumber ? rollNumber.trim() : null,
      classId,
      schoolId,
      qrToken,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender || null,
      guardianName: guardianName ? guardianName.trim().replace(/\s+/g, ' ') : null,
      guardianPhone: guardianPhone ? guardianPhone.trim().replace(/[\s\-()]/g, '') : null,
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

  const cleanAdmission =
    admissionNumber !== undefined && admissionNumber !== null && typeof admissionNumber === 'string'
      ? admissionNumber.trim().toUpperCase()
      : undefined;

  if (cleanAdmission && cleanAdmission !== current.admissionNumber) {
    const existing = await prisma.student.findFirst({
      where: { schoolId, admissionNumber: cleanAdmission, id: { not: id } },
    });
    if (existing) {
      throw new Error(`Admission Number '${cleanAdmission}' is already used by another student.`);
    }
  }

  const updated = await prisma.student.update({
    where: { id },
    data: {
      name: name ? name.trim().replace(/\s+/g, ' ') : current.name,
      admissionNumber: cleanAdmission !== undefined ? cleanAdmission : current.admissionNumber,
      rollNumber: rollNumber !== undefined ? rollNumber : current.rollNumber,
      classId: classId || current.classId,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : current.dateOfBirth,
      gender: gender !== undefined ? gender : current.gender,
      guardianName: guardianName !== undefined ? (guardianName ? guardianName.trim().replace(/\s+/g, ' ') : null) : current.guardianName,
      guardianPhone: guardianPhone !== undefined ? (guardianPhone ? guardianPhone.trim().replace(/[\s\-()]/g, '') : null) : current.guardianPhone,
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

/**
 * Robust CSV line and field parser handling quotes, escaped quotes, and commas
 */
export const parseCsvContent = (csvString) => {
  if (!csvString || typeof csvString !== 'string' || !csvString.trim()) {
    const err = new Error('CSV content is empty or contains no valid data rows.');
    err.statusCode = 400;
    throw err;
  }

  const lines = csvString
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    const err = new Error('CSV file must contain a header row and at least one data row.');
    err.statusCode = 400;
    throw err;
  }

  const parseRow = (line) => {
    const row = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    return row;
  };

  const rawHeaders = parseRow(lines[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));

  // Validate required headers
  const hasName = headers.includes('name') || headers.includes('studentname');
  const hasAdmission =
    headers.includes('admissionnumber') ||
    headers.includes('admno') ||
    headers.includes('admissionno');

  if (!hasName || !hasAdmission) {
    const err = new Error(
      'CSV header validation failed: "name" and "admissionNumber" are mandatory columns.'
    );
    err.statusCode = 400;
    throw err;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] || '';
    });
    rows.push({ rowNumber: i + 1, data: rowObj });
  }

  return { headers, rows };
};

/**
 * Bulk import students from validated CSV data
 */
export const bulkImportStudents = async ({
  schoolId,
  csvContent,
  defaultClassId,
  actorId,
}) => {
  const { rows } = parseCsvContent(csvContent);

  const imported = [];
  const errors = [];
  let skippedCount = 0;

  // Pre-fetch all school classes for mapping and validation
  const schoolClasses = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true, section: true },
  });
  const classIdSet = new Set(schoolClasses.map((c) => c.id));
  const classNameMap = new Map();
  schoolClasses.forEach((c) => {
    classNameMap.set(`${c.name.toLowerCase().trim()}-${c.section.toLowerCase().trim()}`, c.id);
    classNameMap.set(`${c.name.toLowerCase().trim()} ${c.section.toLowerCase().trim()}`, c.id);
  });

  // Track admission numbers within batch to detect duplicates in CSV
  const seenBatchAdmissions = new Set();

  // Fetch existing admission numbers in school to detect DB duplicates
  const existingStudents = await prisma.student.findMany({
    where: { schoolId },
    select: { admissionNumber: true },
  });
  const existingAdmissionSet = new Set(
    existingStudents.map((s) => s.admissionNumber.toUpperCase())
  );

  for (const { rowNumber, data } of rows) {
    const rawName = data.name || data.studentname || '';
    const rawAdmission = data.admissionnumber || data.admno || data.admissionno || '';
    const rawRoll = data.rollnumber || data.rollno || '';
    const rawGender = data.gender || '';
    const rawClassId = data.classid || defaultClassId || '';
    const rawClassName = data.classname || data.class || '';
    const rawSection = data.section || '';
    const rawGuardianName = data.guardianname || data.guardian || data.fathername || '';
    const rawGuardianPhone = data.guardianphone || data.phone || data.mobile || '';
    const rawDob = data.dateofbirth || data.dob || '';

    // Validate Name
    if (!rawName || rawName.trim().length < 2) {
      errors.push({
        row: rowNumber,
        admissionNumber: rawAdmission || 'N/A',
        error: 'Student full name is required and must be at least 2 characters.',
      });
      continue;
    }

    // Validate Admission Number format
    const trimmedAdm = rawAdmission.trim();
    if (!trimmedAdm) {
      errors.push({
        row: rowNumber,
        admissionNumber: 'N/A',
        error: 'Admission number cannot be empty.',
      });
      continue;
    }

    if (!/^[A-Za-z0-9-]+$/.test(trimmedAdm)) {
      errors.push({
        row: rowNumber,
        admissionNumber: trimmedAdm,
        error: 'Admission number must contain only letters, numbers, and hyphens.',
      });
      continue;
    }

    if (trimmedAdm.length < 3 || trimmedAdm.length > 30) {
      errors.push({
        row: rowNumber,
        admissionNumber: trimmedAdm,
        error: 'Admission number must be between 3 and 30 characters.',
      });
      continue;
    }

    const cleanAdmission = trimmedAdm.toUpperCase();

    // Check duplicate within incoming CSV batch
    if (seenBatchAdmissions.has(cleanAdmission)) {
      skippedCount++;
      errors.push({
        row: rowNumber,
        admissionNumber: cleanAdmission,
        error: `Duplicate admission number in CSV file: "${cleanAdmission}" appears multiple times.`,
      });
      continue;
    }
    seenBatchAdmissions.add(cleanAdmission);

    // Check duplicate against existing records in school database
    if (existingAdmissionSet.has(cleanAdmission)) {
      skippedCount++;
      errors.push({
        row: rowNumber,
        admissionNumber: cleanAdmission,
        error: `Admission number "${cleanAdmission}" already exists in this school.`,
      });
      continue;
    }

    // Resolve Class ID
    let targetClassId = rawClassId;
    if (!targetClassId && rawClassName) {
      const lookupKey = rawSection
        ? `${rawClassName.toLowerCase().trim()}-${rawSection.toLowerCase().trim()}`
        : rawClassName.toLowerCase().trim();
      targetClassId = classNameMap.get(lookupKey) || null;
    }

    if (!targetClassId || !classIdSet.has(targetClassId)) {
      errors.push({
        row: rowNumber,
        admissionNumber: cleanAdmission,
        error: 'A valid class assignment belonging to this school is required.',
      });
      continue;
    }

    // Generate secure QR token
    const qrToken = generateSecureQrToken();

    try {
      const created = await prisma.student.create({
        data: {
          name: rawName.trim(),
          admissionNumber: cleanAdmission,
          rollNumber: rawRoll ? rawRoll.trim() : null,
          gender: rawGender ? rawGender.trim().toUpperCase() : null,
          classId: targetClassId,
          schoolId,
          qrToken,
          guardianName: rawGuardianName ? rawGuardianName.trim() : null,
          guardianPhone: rawGuardianPhone ? rawGuardianPhone.trim() : null,
          dateOfBirth:
            rawDob && !isNaN(new Date(rawDob).getTime()) ? new Date(rawDob) : null,
          active: true,
        },
        include: {
          class: { select: { id: true, name: true, section: true } },
        },
      });

      existingAdmissionSet.add(cleanAdmission);
      imported.push({
        id: created.id,
        name: created.name,
        admissionNumber: created.admissionNumber,
        rollNumber: created.rollNumber,
        class: `${created.class.name}-${created.class.section}`,
      });
    } catch (err) {
      errors.push({
        row: rowNumber,
        admissionNumber: cleanAdmission,
        error: err.message,
      });
    }
  }

  if (imported.length > 0) {
    await logAudit({
      actorId,
      action: 'STUDENTS_BULK_IMPORTED',
      entityType: 'Student',
      entityId: schoolId,
      newValue: {
        totalRows: rows.length,
        importedCount: imported.length,
        skippedCount,
        failedCount: errors.length - skippedCount,
      },
      reason: 'Bulk student roster imported via CSV.',
    });
  }

  const failedCount = errors.length;

  return {
    summary: {
      totalRows: rows.length,
      importedCount: imported.length,
      skippedCount,
      failedCount,
    },
    importedStudents: imported,
    errors,
  };
};


