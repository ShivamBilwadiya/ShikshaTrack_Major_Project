import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

export const VALID_EXAM_TYPES = ['UNIT_TEST', 'MIDTERM', 'FINAL', 'PRACTICAL', 'ASSESSMENT'];

export const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
};

/**
 * List examinations for a school with optional class/year filters
 */
export const listExaminations = async ({ schoolId, classId, academicYear }) => {
  const where = { schoolId };
  if (classId) where.classId = classId;
  if (academicYear) where.academicYear = academicYear;

  const exams = await prisma.examination.findMany({
    where,
    include: {
      class: {
        select: { id: true, name: true, section: true, academicYear: true },
      },
      examSubjects: {
        select: {
          id: true,
          subject: true,
          maxMarks: true,
          passMarks: true,
          examDate: true,
          _count: { select: { marks: true } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  return exams;
};

/**
 * Get examination details by ID
 */
export const getExaminationById = async (id, schoolId) => {
  const exam = await prisma.examination.findFirst({
    where: { id, schoolId },
    include: {
      class: {
        select: { id: true, name: true, section: true, academicYear: true },
      },
      examSubjects: {
        include: {
          marks: {
            include: {
              student: {
                select: { id: true, name: true, admissionNumber: true, rollNumber: true },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    const err = new Error('Examination not found.');
    err.statusCode = 404;
    throw err;
  }

  return exam;
};

/**
 * Create a new examination with optional subjects
 */
export const createExamination = async ({
  schoolId,
  name,
  examType = 'MIDTERM',
  academicYear,
  classId = null,
  startDate,
  endDate,
  description = null,
  subjects = [],
  actorId,
}) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    const err = new Error('Examination name is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!academicYear || typeof academicYear !== 'string' || !academicYear.trim()) {
    const err = new Error('Academic year is required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedType = examType ? examType.toUpperCase() : 'MIDTERM';
  if (!VALID_EXAM_TYPES.includes(normalizedType)) {
    const err = new Error(`Invalid examType "${examType}". Allowed: ${VALID_EXAM_TYPES.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  if (!startDate || !endDate) {
    const err = new Error('Start date and end date are required.');
    err.statusCode = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error('Invalid date format for examination dates.');
    err.statusCode = 400;
    throw err;
  }

  if (start > end) {
    const err = new Error('Examination start date cannot be after end date.');
    err.statusCode = 400;
    throw err;
  }

  // Check duplicate exam name for the same class and year
  const existing = await prisma.examination.findFirst({
    where: {
      schoolId,
      name: name.trim(),
      academicYear: academicYear.trim(),
      classId: classId || undefined,
    },
  });

  if (existing) {
    const err = new Error(`An examination named "${name.trim()}" already exists for this academic cycle.`);
    err.statusCode = 409;
    throw err;
  }

  const exam = await prisma.examination.create({
    data: {
      schoolId,
      name: name.trim(),
      examType: normalizedType,
      academicYear: academicYear.trim(),
      classId: classId || null,
      startDate: start,
      endDate: end,
      description: description ? description.trim() : null,
      examSubjects: {
        create: (subjects || []).map((sub) => ({
          subject: sub.subject.trim(),
          maxMarks: sub.maxMarks ? parseFloat(sub.maxMarks) : 100,
          passMarks: sub.passMarks ? parseFloat(sub.passMarks) : 33,
          examDate: sub.examDate ? new Date(sub.examDate) : null,
        })),
      },
    },
    include: {
      class: true,
      examSubjects: true,
    },
  });

  await logAudit({
    actorId,
    action: 'EXAMINATION_CREATED',
    entityType: 'Examination',
    entityId: exam.id,
    newValue: {
      name: exam.name,
      type: exam.examType,
      academicYear: exam.academicYear,
    },
  });

  return exam;
};

/**
 * Update an examination
 */
export const updateExamination = async (id, schoolId, data, actorId) => {
  const existing = await getExaminationById(id, schoolId);

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const academicYear = data.academicYear !== undefined ? data.academicYear.trim() : existing.academicYear;
  const examType = data.examType !== undefined ? data.examType.toUpperCase() : existing.examType;
  const classId = data.classId !== undefined ? data.classId : existing.classId;
  const description = data.description !== undefined ? (data.description ? data.description.trim() : null) : existing.description;
  const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
  const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;

  if (startDate > endDate) {
    const err = new Error('Examination start date cannot be after end date.');
    err.statusCode = 400;
    throw err;
  }

  const updated = await prisma.examination.update({
    where: { id },
    data: {
      name,
      academicYear,
      examType,
      classId,
      startDate,
      endDate,
      description,
    },
    include: {
      class: true,
      examSubjects: true,
    },
  });

  await logAudit({
    actorId,
    action: 'EXAMINATION_UPDATED',
    entityType: 'Examination',
    entityId: id,
    previousValue: { name: existing.name },
    newValue: { name: updated.name },
  });

  return updated;
};

/**
 * Delete an examination
 */
export const deleteExamination = async (id, schoolId, actorId) => {
  const existing = await getExaminationById(id, schoolId);

  await prisma.examination.delete({
    where: { id },
  });

  await logAudit({
    actorId,
    action: 'EXAMINATION_DELETED',
    entityType: 'Examination',
    entityId: id,
    previousValue: { name: existing.name },
  });

  return { id, message: 'Examination deleted successfully.' };
};

/**
 * Add a subject paper to an examination
 */
export const addExamSubject = async (examinationId, schoolId, { subject, maxMarks = 100, passMarks = 33, examDate = null }, actorId) => {
  const exam = await getExaminationById(examinationId, schoolId);

  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    const err = new Error('Subject name is required.');
    err.statusCode = 400;
    throw err;
  }

  const numMax = parseFloat(maxMarks);
  const numPass = parseFloat(passMarks);

  if (isNaN(numMax) || numMax <= 0) {
    const err = new Error('Maximum marks must be a positive number.');
    err.statusCode = 400;
    throw err;
  }

  if (isNaN(numPass) || numPass < 0 || numPass > numMax) {
    const err = new Error('Pass marks must be between 0 and maximum marks.');
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await prisma.examSubject.findFirst({
    where: { examinationId, subject: subject.trim() },
  });

  if (duplicate) {
    const err = new Error(`Subject "${subject.trim()}" is already assigned to this examination.`);
    err.statusCode = 409;
    throw err;
  }

  const examSubject = await prisma.examSubject.create({
    data: {
      examinationId,
      subject: subject.trim(),
      maxMarks: numMax,
      passMarks: numPass,
      examDate: examDate ? new Date(examDate) : null,
    },
  });

  return examSubject;
};

/**
 * Record or update marks for a subject paper (bulk or single)
 */
export const recordSubjectMarks = async (examSubjectId, schoolId, marksList, actorId) => {
  if (!Array.isArray(marksList) || marksList.length === 0) {
    const err = new Error('Marks list cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  // Verify subject and examination exist for this school
  const examSubject = await prisma.examSubject.findUnique({
    where: { id: examSubjectId },
    include: { examination: true },
  });

  if (!examSubject || examSubject.examination.schoolId !== schoolId) {
    const err = new Error('Exam subject not found.');
    err.statusCode = 404;
    throw err;
  }

  const maxMarks = examSubject.maxMarks;
  const results = [];

  for (const item of marksList) {
    const { studentId, marksObtained, remarks } = item;

    if (!studentId) {
      const err = new Error('studentId is required for each mark entry.');
      err.statusCode = 400;
      throw err;
    }

    const marks = parseFloat(marksObtained);
    if (isNaN(marks) || marks < 0 || marks > maxMarks) {
      const err = new Error(
        `Invalid marks (${marksObtained}) for student ${studentId}. Must be between 0 and ${maxMarks}.`
      );
      err.statusCode = 400;
      throw err;
    }

    const saved = await prisma.examMark.upsert({
      where: {
        examSubjectId_studentId: {
          examSubjectId,
          studentId,
        },
      },
      create: {
        examSubjectId,
        studentId,
        marksObtained: marks,
        remarks: remarks ? remarks.trim() : null,
      },
      update: {
        marksObtained: marks,
        remarks: remarks ? remarks.trim() : null,
      },
      include: {
        student: {
          select: { id: true, name: true, admissionNumber: true, rollNumber: true },
        },
      },
    });

    results.push(saved);
  }

  await logAudit({
    actorId,
    action: 'EXAM_MARKS_RECORDED',
    entityType: 'ExamSubject',
    entityId: examSubjectId,
    newValue: {
      count: results.length,
      subject: examSubject.subject,
    },
  });

  return {
    examSubjectId,
    subject: examSubject.subject,
    maxMarks: examSubject.maxMarks,
    recordedCount: results.length,
    marks: results,
  };
};

/**
 * Get comprehensive class-wide examination results with calculations
 */
export const getClassExamResults = async (examinationId, classId, schoolId) => {
  const exam = await getExaminationById(examinationId, schoolId);

  // If exam has classId specified, ensure it matches
  const targetClassId = classId || exam.classId;
  if (!targetClassId) {
    const err = new Error('Class ID is required to calculate class exam results.');
    err.statusCode = 400;
    throw err;
  }

  const cls = await prisma.class.findFirst({
    where: { id: targetClassId, schoolId },
    include: {
      students: {
        where: { active: true },
        orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
      },
    },
  });

  if (!cls) {
    const err = new Error('Class not found.');
    err.statusCode = 404;
    throw err;
  }

  const subjects = exam.examSubjects;
  const totalMaxMarks = subjects.reduce((sum, s) => sum + s.maxMarks, 0);

  const studentResults = [];

  for (const student of cls.students) {
    const subjectMarks = {};
    let totalObtained = 0;
    let hasFailedAnySubject = false;
    let hasAppeared = false;

    for (const sub of subjects) {
      const markEntry = sub.marks.find((m) => m.studentId === student.id);
      if (markEntry) {
        hasAppeared = true;
        subjectMarks[sub.subject] = {
          marksObtained: markEntry.marksObtained,
          maxMarks: sub.maxMarks,
          passMarks: sub.passMarks,
          isPassed: markEntry.marksObtained >= sub.passMarks,
        };
        totalObtained += markEntry.marksObtained;
        if (markEntry.marksObtained < sub.passMarks) {
          hasFailedAnySubject = true;
        }
      } else {
        subjectMarks[sub.subject] = {
          marksObtained: null,
          maxMarks: sub.maxMarks,
          passMarks: sub.passMarks,
          isPassed: false,
          absent: true,
        };
        hasFailedAnySubject = true;
      }
    }

    const percentage =
      totalMaxMarks > 0 && hasAppeared
        ? Math.round((totalObtained / totalMaxMarks) * 1000) / 10
        : 0;

    const grade = hasAppeared ? calculateGrade(percentage) : 'N/A';
    const isPassed = hasAppeared && !hasFailedAnySubject && percentage >= 33;

    studentResults.push({
      studentId: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      hasAppeared,
      subjectMarks,
      totalObtained,
      totalMaxMarks,
      percentage,
      grade,
      status: isPassed ? 'PASS' : hasAppeared ? 'FAIL' : 'ABSENT',
    });
  }

  // Summary statistics
  const appearedList = studentResults.filter((s) => s.hasAppeared);
  const passedList = studentResults.filter((s) => s.status === 'PASS');
  const avgPercentage =
    appearedList.length > 0
      ? Math.round(
          (appearedList.reduce((sum, s) => sum + s.percentage, 0) / appearedList.length) * 10
        ) / 10
      : 0;

  const topPercentage =
    appearedList.length > 0 ? Math.max(...appearedList.map((s) => s.percentage)) : 0;

  return {
    examination: {
      id: exam.id,
      name: exam.name,
      academicYear: exam.academicYear,
      examType: exam.examType,
    },
    class: {
      id: cls.id,
      name: cls.name,
      section: cls.section,
    },
    subjects: subjects.map((s) => ({
      id: s.id,
      subject: s.subject,
      maxMarks: s.maxMarks,
      passMarks: s.passMarks,
    })),
    summary: {
      totalStudents: cls.students.length,
      appearedCount: appearedList.length,
      passedCount: passedList.length,
      failedCount: appearedList.length - passedList.length,
      passPercentage:
        appearedList.length > 0
          ? Math.round((passedList.length / appearedList.length) * 1000) / 10
          : 0,
      classAveragePercentage: avgPercentage,
      topScorePercentage: topPercentage,
    },
    results: studentResults,
  };
};

/**
 * Generate CSV export for class examination results
 */
export const generateClassResultCsv = async (examinationId, classId, schoolId) => {
  const data = await getClassExamResults(examinationId, classId, schoolId);

  const subjectNames = data.subjects.map((s) => s.subject);
  const headers = [
    'Roll Number',
    'Student Name',
    'Admission Number',
    ...subjectNames,
    'Total Obtained',
    'Total Max',
    'Percentage (%)',
    'Grade',
    'Result Status',
  ];

  const rows = data.results.map((r) => {
    const subValues = subjectNames.map((sName) => {
      const sm = r.subjectMarks[sName];
      return sm && sm.marksObtained !== null ? sm.marksObtained : 'AB';
    });

    return [
      `"${r.rollNumber || ''}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.admissionNumber}"`,
      ...subValues,
      r.totalObtained,
      r.totalMaxMarks,
      r.percentage,
      `"${r.grade}"`,
      `"${r.status}"`,
    ].join(',');
  });

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n');
  return {
    filename: `Result_${data.examination.name.replace(/[^a-zA-Z0-9]/g, '_')}_${data.class.name}_${data.class.section}.csv`,
    csvContent,
  };
};
