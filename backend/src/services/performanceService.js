import prisma from '../config/db.js';
import { logAudit } from './auditService.js';
import { calculateGrade } from './examService.js';

/**
 * Calculate Pearson correlation coefficient between attendance rate and academic score
 */
export const calculatePearsonCorrelation = (pairs) => {
  if (!pairs || pairs.length < 2) return 0;

  const n = pairs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of pairs) {
    const x = p.attendance;
    const y = p.academic;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(3));
};

/**
 * Calculate attendance rate for a student or list of students
 */
export const getStudentAttendanceRate = async (studentId, schoolId) => {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      session: { class: { schoolId } },
    },
    select: { status: true },
  });

  if (!records.length) return { totalSessions: 0, presentCount: 0, attendanceRate: 100 };

  const presentCount = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const attendanceRate = Number(((presentCount / records.length) * 100).toFixed(1));

  return {
    totalSessions: records.length,
    presentCount,
    attendanceRate,
  };
};

/**
 * Academic overview and KPI statistics for school/class
 */
export const getAcademicOverview = async ({ schoolId, classId = null, academicYear = null }) => {
  const whereExam = { schoolId };
  if (classId) whereExam.classId = classId;
  if (academicYear) whereExam.academicYear = academicYear;

  // 1. Fetch relevant exams with subjects and marks
  const exams = await prisma.examination.findMany({
    where: whereExam,
    include: {
      examSubjects: {
        include: {
          marks: {
            include: {
              student: {
                select: { id: true, name: true, admissionNumber: true, classId: true, active: true },
              },
            },
          },
        },
      },
    },
  });

  // Aggregate student total marks and percentages
  const studentMetrics = new Map();
  let totalEvaluations = 0;
  let passedEvaluations = 0;
  const gradeDistribution = { 'A+': 0, A: 0, 'B+': 0, B: 0, C: 0, D: 0, F: 0 };

  for (const exam of exams) {
    for (const sub of exam.examSubjects) {
      for (const m of sub.marks) {
        if (!m.student || !m.student.active) continue;

        const percentage = (m.marksObtained / sub.maxMarks) * 100;
        const grade = calculateGrade(percentage);
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;

        totalEvaluations++;
        if (m.marksObtained >= sub.passMarks) {
          passedEvaluations++;
        }

        const sid = m.student.id;
        if (!studentMetrics.has(sid)) {
          studentMetrics.set(sid, {
            studentId: sid,
            name: m.student.name,
            admissionNumber: m.student.admissionNumber,
            classId: m.student.classId,
            totalMarks: 0,
            totalMax: 0,
            markCount: 0,
            failedSubjects: 0,
          });
        }

        const sm = studentMetrics.get(sid);
        sm.totalMarks += m.marksObtained;
        sm.totalMax += sub.maxMarks;
        sm.markCount++;
        if (m.marksObtained < sub.passMarks) {
          sm.failedSubjects++;
        }
      }
    }
  }

  const studentSummaries = Array.from(studentMetrics.values()).map((s) => {
    const avgPercentage = s.totalMax > 0 ? Number(((s.totalMarks / s.totalMax) * 100).toFixed(1)) : 0;
    return {
      ...s,
      averagePercentage: avgPercentage,
      overallGrade: calculateGrade(avgPercentage),
      isAtRisk: avgPercentage < 40 || s.failedSubjects > 0,
    };
  });

  const totalStudentsEvaluated = studentSummaries.length;
  const totalAvgScore = totalStudentsEvaluated > 0
    ? Number((studentSummaries.reduce((acc, s) => acc + s.averagePercentage, 0) / totalStudentsEvaluated).toFixed(1))
    : 0;

  const atRiskCount = studentSummaries.filter((s) => s.isAtRisk).length;
  const highAchieversCount = studentSummaries.filter((s) => s.averagePercentage >= 80).length;
  const overallPassRate = totalEvaluations > 0 ? Number(((passedEvaluations / totalEvaluations) * 100).toFixed(1)) : 0;

  // Active Interventions
  const activeInterventionsCount = await prisma.academicIntervention.count({
    where: {
      schoolId,
      status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] },
      ...(classId ? { student: { classId } } : {}),
    },
  });

  return {
    totalStudentsEvaluated,
    totalEvaluations,
    averagePercentage: totalAvgScore,
    overallPassRate,
    atRiskCount,
    highAchieversCount,
    activeInterventionsCount,
    gradeDistribution,
  };
};

/**
 * Subject-wise performance metrics and difficulty analysis
 */
export const getSubjectWisePerformance = async ({ schoolId, classId = null, examinationId = null }) => {
  const whereSubject = {
    examination: { schoolId },
  };

  if (classId) whereSubject.examination.classId = classId;
  if (examinationId) whereSubject.examinationId = examinationId;

  const subjects = await prisma.examSubject.findMany({
    where: whereSubject,
    include: {
      examination: {
        select: { id: true, name: true, examType: true, academicYear: true, class: true },
      },
      marks: {
        include: {
          student: { select: { id: true, name: true, active: true } },
        },
      },
    },
  });

  // Group by Subject Name across exams
  const subjectMap = new Map();

  for (const s of subjects) {
    const subName = s.subject.trim();
    if (!subjectMap.has(subName)) {
      subjectMap.set(subName, {
        subject: subName,
        totalEvaluated: 0,
        totalMarks: 0,
        totalMaxMarks: 0,
        passCount: 0,
        failCount: 0,
        highestMarks: 0,
        lowestMarks: Infinity,
        marksList: [],
      });
    }

    const data = subjectMap.get(subName);

    for (const m of s.marks) {
      if (!m.student?.active) continue;

      const marks = m.marksObtained;
      data.totalEvaluated++;
      data.totalMarks += marks;
      data.totalMaxMarks += s.maxMarks;
      data.marksList.push((marks / s.maxMarks) * 100);

      if (marks >= s.passMarks) {
        data.passCount++;
      } else {
        data.failCount++;
      }

      if (marks > data.highestMarks) data.highestMarks = marks;
      if (marks < data.lowestMarks) data.lowestMarks = marks;
    }
  }

  const results = Array.from(subjectMap.values()).map((s) => {
    if (s.lowestMarks === Infinity) s.lowestMarks = 0;
    const avgScore = s.totalEvaluated > 0 ? Number((s.totalMarks / s.totalEvaluated).toFixed(1)) : 0;
    const avgPercentage = s.totalMaxMarks > 0 ? Number(((s.totalMarks / s.totalMaxMarks) * 100).toFixed(1)) : 0;
    const passRate = s.totalEvaluated > 0 ? Number(((s.passCount / s.totalEvaluated) * 100).toFixed(1)) : 0;

    // Standard deviation
    let stdDev = 0;
    if (s.marksList.length > 1) {
      const variance = s.marksList.reduce((acc, val) => acc + Math.pow(val - avgPercentage, 2), 0) / s.marksList.length;
      stdDev = Number(Math.sqrt(variance).toFixed(1));
    }

    return {
      subject: s.subject,
      totalEvaluated: s.totalEvaluated,
      averageMarks: avgScore,
      averagePercentage: avgPercentage,
      averageGrade: calculateGrade(avgPercentage),
      passRate,
      highestMarks: s.highestMarks,
      lowestMarks: s.lowestMarks,
      standardDeviation: stdDev,
      atRiskCount: s.failCount,
    };
  });

  results.sort((a, b) => b.averagePercentage - a.averagePercentage);
  return results;
};

/**
 * Examination-to-examination performance trends and progression trajectory
 */
export const getStudentPerformanceTrends = async ({ schoolId, studentId = null, classId = null }) => {
  const where = { schoolId };
  if (classId) where.classId = classId;

  // Retrieve chronological examinations
  const examinations = await prisma.examination.findMany({
    where,
    orderBy: { startDate: 'asc' },
    include: {
      examSubjects: {
        include: {
          marks: {
            where: studentId ? { studentId } : undefined,
            include: {
              student: { select: { id: true, name: true, admissionNumber: true } },
            },
          },
        },
      },
    },
  });

  const trendPoints = [];
  let previousAvg = null;

  for (const exam of examinations) {
    let examMarksTotal = 0;
    let examMaxTotal = 0;
    let studentCount = 0;
    const marksByStudent = new Map();

    for (const sub of exam.examSubjects) {
      for (const m of sub.marks) {
        examMarksTotal += m.marksObtained;
        examMaxTotal += sub.maxMarks;

        const sid = m.studentId;
        if (!marksByStudent.has(sid)) {
          marksByStudent.set(sid, { obtained: 0, max: 0 });
        }
        const sEntry = marksByStudent.get(sid);
        sEntry.obtained += m.marksObtained;
        sEntry.max += sub.maxMarks;
      }
    }

    studentCount = marksByStudent.size;
    if (studentCount === 0 || examMaxTotal === 0) continue;

    const currentAvg = Number(((examMarksTotal / examMaxTotal) * 100).toFixed(1));
    let changeFromPrevious = 0;
    let trajectory = 'STABLE';

    if (previousAvg !== null) {
      changeFromPrevious = Number((currentAvg - previousAvg).toFixed(1));
      if (changeFromPrevious >= 2) trajectory = 'IMPROVING';
      else if (changeFromPrevious <= -2) trajectory = 'DECLINING';
    }

    trendPoints.push({
      examinationId: exam.id,
      examinationName: exam.name,
      examType: exam.examType,
      date: exam.startDate,
      averagePercentage: currentAvg,
      grade: calculateGrade(currentAvg),
      changeFromPrevious,
      trajectory,
      evaluatedStudents: studentCount,
    });

    previousAvg = currentAvg;
  }

  return trendPoints;
};

/**
 * Class-wise academic comparisons across the school
 */
export const getClassComparisons = async ({ schoolId, academicYear = null }) => {
  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
      _count: { select: { students: { where: { active: true } } } },
      students: {
        where: { active: true },
        select: { id: true },
      },
    },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
  });

  const comparisons = [];

  for (const cls of classes) {
    const studentIds = cls.students.map((s) => s.id);
    if (!studentIds.length) {
      comparisons.push({
        classId: cls.id,
        className: `${cls.name}-${cls.section}`,
        totalStudents: 0,
        averagePercentage: 0,
        overallGrade: 'N/A',
        passRate: 0,
        atRiskCount: 0,
      });
      continue;
    }

    const marks = await prisma.examMark.findMany({
      where: {
        studentId: { in: studentIds },
        examSubject: { examination: { schoolId } },
      },
      include: {
        examSubject: { select: { maxMarks: true, passMarks: true, subject: true } },
      },
    });

    let totalMarks = 0;
    let totalMax = 0;
    let passCount = 0;
    const studentPerformanceMap = new Map();

    for (const m of marks) {
      totalMarks += m.marksObtained;
      totalMax += m.examSubject.maxMarks;
      if (m.marksObtained >= m.examSubject.passMarks) passCount++;

      const sid = m.studentId;
      if (!studentPerformanceMap.has(sid)) {
        studentPerformanceMap.set(sid, { marks: 0, max: 0, fails: 0 });
      }
      const sp = studentPerformanceMap.get(sid);
      sp.marks += m.marksObtained;
      sp.max += m.examSubject.maxMarks;
      if (m.marksObtained < m.examSubject.passMarks) sp.fails++;
    }

    const avgPercentage = totalMax > 0 ? Number(((totalMarks / totalMax) * 100).toFixed(1)) : 0;
    const passRate = marks.length > 0 ? Number(((passCount / marks.length) * 100).toFixed(1)) : 0;

    let atRisk = 0;
    for (const sp of studentPerformanceMap.values()) {
      const pct = sp.max > 0 ? (sp.marks / sp.max) * 100 : 0;
      if (pct < 40 || sp.fails > 0) atRisk++;
    }

    comparisons.push({
      classId: cls.id,
      className: `${cls.name}-${cls.section}`,
      totalStudents: cls._count.students,
      averagePercentage: avgPercentage,
      overallGrade: calculateGrade(avgPercentage),
      passRate,
      atRiskCount: atRisk,
    });
  }

  return comparisons;
};

/**
 * Identify students at-risk of academic failure or exhibiting declining trends
 */
export const getAtRiskStudents = async ({
  schoolId,
  classId = null,
  thresholdPercentage = 40,
  attendanceThreshold = 75,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const whereStudent = {
    schoolId,
    active: true,
  };

  if (classId) whereStudent.classId = classId;
  if (search && search.trim()) {
    const q = search.trim();
    whereStudent.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { admissionNumber: { contains: q, mode: 'insensitive' } },
      { rollNumber: { contains: q, mode: 'insensitive' } },
    ];
  }

  const students = await prisma.student.findMany({
    where: whereStudent,
    include: {
      class: { select: { id: true, name: true, section: true } },
      examMarks: {
        include: {
          examSubject: {
            include: { examination: { select: { id: true, name: true, startDate: true } } },
          },
        },
      },
      academicInterventions: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
        select: { id: true, type: true, severity: true, status: true, title: true, followUpDate: true },
      },
    },
  });

  const atRiskList = [];

  for (const st of students) {
    if (!st.examMarks.length) continue;

    // Calculate overall academic percentage
    let totalMarks = 0;
    let totalMax = 0;
    const failedSubjects = new Set();
    const examMap = new Map();

    for (const m of st.examMarks) {
      totalMarks += m.marksObtained;
      totalMax += m.examSubject.maxMarks;
      if (m.marksObtained < m.examSubject.passMarks) {
        failedSubjects.add(m.examSubject.subject);
      }

      const examId = m.examSubject.examination.id;
      if (!examMap.has(examId)) {
        examMap.set(examId, {
          date: m.examSubject.examination.startDate,
          obtained: 0,
          max: 0,
        });
      }
      const eEntry = examMap.get(examId);
      eEntry.obtained += m.marksObtained;
      eEntry.max += m.examSubject.maxMarks;
    }

    const currentPercentage = totalMax > 0 ? Number(((totalMarks / totalMax) * 100).toFixed(1)) : 0;

    // Calculate progression drop across exams
    const sortedExams = Array.from(examMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    let scoreDrop = 0;
    if (sortedExams.length >= 2) {
      const prev = sortedExams[sortedExams.length - 2];
      const curr = sortedExams[sortedExams.length - 1];
      const prevPct = (prev.obtained / prev.max) * 100;
      const currPct = (curr.obtained / curr.max) * 100;
      if (prevPct - currPct > 0) {
        scoreDrop = Number((prevPct - currPct).toFixed(1));
      }
    }

    // Attendance calculation
    const { attendanceRate } = await getStudentAttendanceRate(st.id, schoolId);

    // Evaluate Risk Flags
    const hasDeficit = currentPercentage < thresholdPercentage;
    const hasFailedSubjects = failedSubjects.size > 0;
    const hasScoreDrop = scoreDrop >= 10;
    const hasChronicAbsence = attendanceRate < attendanceThreshold;

    if (hasDeficit || hasFailedSubjects || hasScoreDrop || hasChronicAbsence) {
      let riskLevel = 'MEDIUM';
      if (currentPercentage < 33 || scoreDrop >= 20 || attendanceRate < 60) {
        riskLevel = 'CRITICAL';
      } else if (hasDeficit || scoreDrop >= 10 || attendanceRate < 70) {
        riskLevel = 'HIGH';
      }

      atRiskList.push({
        studentId: st.id,
        name: st.name,
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber || 'N/A',
        classId: st.classId,
        className: st.class ? `${st.class.name}-${st.class.section}` : 'N/A',
        currentPercentage,
        grade: calculateGrade(currentPercentage),
        scoreDrop,
        attendanceRate,
        failedSubjects: Array.from(failedSubjects),
        riskLevel,
        activeInterventions: st.academicInterventions,
        suggestedIntervention:
          hasChronicAbsence && hasDeficit
            ? 'Parent consultation for combined chronic absence and academic deficit.'
            : hasScoreDrop
            ? 'Remedial coaching to recover consecutive grade decline.'
            : hasFailedSubjects
            ? `Special tutoring in: ${Array.from(failedSubjects).join(', ')}.`
            : 'Academic mentoring and monitored assignments.',
      });
    }
  }

  // Sort by severity (CRITICAL -> HIGH -> MEDIUM), then lowest percentage
  const severityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3 };
  atRiskList.sort((a, b) => {
    const sDiff = severityOrder[a.riskLevel] - severityOrder[b.riskLevel];
    if (sDiff !== 0) return sDiff;
    return a.currentPercentage - b.currentPercentage;
  });

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Math.min(100, Math.max(1, Number(limit)));
  const paginated = atRiskList.slice(skip, skip + take);

  return {
    students: paginated,
    total: atRiskList.length,
    page: Number(page),
    limit: take,
    totalPages: Math.ceil(atRiskList.length / take),
  };
};

/**
 * Attendance vs Academic Performance Correlation Analytics
 */
export const getAttendancePerformanceCorrelation = async ({ schoolId, classId = null }) => {
  const where = { schoolId, active: true };
  if (classId) where.classId = classId;

  const students = await prisma.student.findMany({
    where,
    include: {
      class: { select: { name: true, section: true } },
      examMarks: {
        include: { examSubject: { select: { maxMarks: true } } },
      },
    },
  });

  const scatterData = [];
  const quartiles = {
    below60: { count: 0, totalMarksPct: 0 },
    from60to74: { count: 0, totalMarksPct: 0 },
    from75to89: { count: 0, totalMarksPct: 0 },
    above90: { count: 0, totalMarksPct: 0 },
  };

  for (const st of students) {
    if (!st.examMarks.length) continue;

    let marksTotal = 0;
    let maxTotal = 0;
    for (const m of st.examMarks) {
      marksTotal += m.marksObtained;
      maxTotal += m.examSubject.maxMarks;
    }
    const examPct = maxTotal > 0 ? Number(((marksTotal / maxTotal) * 100).toFixed(1)) : 0;
    const { attendanceRate } = await getStudentAttendanceRate(st.id, schoolId);

    scatterData.push({
      studentId: st.id,
      name: st.name,
      className: st.class ? `${st.class.name}-${st.class.section}` : 'N/A',
      attendance: attendanceRate,
      academic: examPct,
      grade: calculateGrade(examPct),
    });

    if (attendanceRate < 60) {
      quartiles.below60.count++;
      quartiles.below60.totalMarksPct += examPct;
    } else if (attendanceRate < 75) {
      quartiles.from60to74.count++;
      quartiles.from60to74.totalMarksPct += examPct;
    } else if (attendanceRate < 90) {
      quartiles.from75to89.count++;
      quartiles.from75to89.totalMarksPct += examPct;
    } else {
      quartiles.above90.count++;
      quartiles.above90.totalMarksPct += examPct;
    }
  }

  const correlation = calculatePearsonCorrelation(scatterData);

  const quartileBreakdown = [
    {
      range: '< 60% Attendance',
      studentsCount: quartiles.below60.count,
      averageAcademicScore:
        quartiles.below60.count > 0
          ? Number((quartiles.below60.totalMarksPct / quartiles.below60.count).toFixed(1))
          : 0,
    },
    {
      range: '60%–74% Attendance',
      studentsCount: quartiles.from60to74.count,
      averageAcademicScore:
        quartiles.from60to74.count > 0
          ? Number((quartiles.from60to74.totalMarksPct / quartiles.from60to74.count).toFixed(1))
          : 0,
    },
    {
      range: '75%–89% Attendance',
      studentsCount: quartiles.from75to89.count,
      averageAcademicScore:
        quartiles.from75to89.count > 0
          ? Number((quartiles.from75to89.totalMarksPct / quartiles.from75to89.count).toFixed(1))
          : 0,
    },
    {
      range: '≥ 90% Attendance',
      studentsCount: quartiles.above90.count,
      averageAcademicScore:
        quartiles.above90.count > 0
          ? Number((quartiles.above90.totalMarksPct / quartiles.above90.count).toFixed(1))
          : 0,
    },
  ];

  return {
    pearsonCorrelation: correlation,
    relationshipDescription:
      correlation > 0.6
        ? 'Strong positive correlation: Regular attendance directly drives high exam scores.'
        : correlation > 0.3
        ? 'Moderate positive correlation: Attendance is a notable predictor of test performance.'
        : 'Weak correlation: Other factors (tutoring, homework) influence performance in this group.',
    totalSamples: scatterData.length,
    quartileBreakdown,
    scatterPlot: scatterData.slice(0, 150),
  };
};

/**
 * Individual student performance drill-down with historical marks and interventions
 */
export const getStudentPerformanceDrilldown = async ({
  schoolId,
  studentId,
  userRole = 'ADMIN',
  userId = null,
}) => {
  // Parent isolation
  if (userRole === 'PARENT') {
    const parentProfile = await prisma.parent.findUnique({
      where: { userId },
      include: { students: { select: { studentId: true } } },
    });
    const linked = parentProfile?.students?.map((s) => s.studentId) || [];
    if (!linked.includes(studentId)) {
      throw new Error('Unauthorized: You can only view performance data for your linked children.');
    }
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      class: true,
      examMarks: {
        include: {
          examSubject: {
            include: { examination: true },
          },
        },
      },
      academicInterventions: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          notes: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!student) {
    throw new Error('Student not found.');
  }

  const { attendanceRate, totalSessions, presentCount } = await getStudentAttendanceRate(student.id, schoolId);

  // Group marks by examination
  const examMap = new Map();
  let grandTotal = 0;
  let grandMax = 0;

  for (const m of student.examMarks) {
    const exam = m.examSubject.examination;
    if (!examMap.has(exam.id)) {
      examMap.set(exam.id, {
        examinationId: exam.id,
        examinationName: exam.name,
        examType: exam.examType,
        date: exam.startDate,
        subjects: [],
        totalMarks: 0,
        totalMax: 0,
      });
    }

    const exEntry = examMap.get(exam.id);
    const subPercentage = Number(((m.marksObtained / m.examSubject.maxMarks) * 100).toFixed(1));
    const passed = m.marksObtained >= m.examSubject.passMarks;

    exEntry.subjects.push({
      subject: m.examSubject.subject,
      marksObtained: m.marksObtained,
      maxMarks: m.examSubject.maxMarks,
      passMarks: m.examSubject.passMarks,
      percentage: subPercentage,
      grade: calculateGrade(subPercentage),
      passed,
      remarks: m.remarks,
    });

    exEntry.totalMarks += m.marksObtained;
    exEntry.totalMax += m.examSubject.maxMarks;
    grandTotal += m.marksObtained;
    grandMax += m.examSubject.maxMarks;
  }

  const examinationHistory = Array.from(examMap.values()).map((ex) => {
    const examPct = ex.totalMax > 0 ? Number(((ex.totalMarks / ex.totalMax) * 100).toFixed(1)) : 0;
    return {
      ...ex,
      percentage: examPct,
      grade: calculateGrade(examPct),
    };
  });

  examinationHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

  const cumulativePercentage = grandMax > 0 ? Number(((grandTotal / grandMax) * 100).toFixed(1)) : 0;

  return {
    student: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber || 'N/A',
      className: student.class ? `${student.class.name}-${student.class.section}` : 'N/A',
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
    },
    attendance: {
      attendanceRate,
      totalSessions,
      presentCount,
    },
    performance: {
      cumulativePercentage,
      cumulativeGrade: calculateGrade(cumulativePercentage),
      examinationHistory,
    },
    interventions: student.academicInterventions,
  };
};

/**
 * Create Academic Intervention Record
 */
export const createIntervention = async ({
  schoolId,
  teacherId,
  studentId,
  assignedToId = null,
  type = 'ACADEMIC_DEFICIT',
  severity = 'MEDIUM',
  title,
  description,
  subject = null,
  actionPlan = null,
  baselinePercentage = null,
  targetPercentage = null,
  baselineAttendance = null,
  followUpDate = null,
}) => {
  if (!studentId || !title || !description) {
    throw new Error('Student ID, intervention title, and description are required.');
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, active: true },
  });

  if (!student) {
    throw new Error('Student not found in this school.');
  }

  const intervention = await prisma.academicIntervention.create({
    data: {
      schoolId,
      studentId,
      teacherId,
      assignedToId: assignedToId || teacherId,
      type,
      severity,
      status: 'OPEN',
      title: title.trim(),
      description: description.trim(),
      subject: subject ? subject.trim() : null,
      actionPlan: actionPlan ? actionPlan.trim() : null,
      baselinePercentage: baselinePercentage ? Number(baselinePercentage) : null,
      currentPercentage: baselinePercentage ? Number(baselinePercentage) : null,
      targetPercentage: targetPercentage ? Number(targetPercentage) : null,
      baselineAttendance: baselineAttendance ? Number(baselineAttendance) : null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true } },
      teacher: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    actorId: teacherId,
    action: 'ACADEMIC_INTERVENTION_CREATED',
    entityType: 'AcademicIntervention',
    entityId: intervention.id,
    newValue: { title: intervention.title, studentName: student.name, severity },
    reason: `Initiated academic intervention for ${student.name}: ${intervention.title}`,
  });

  return intervention;
};

/**
 * Retrieve paginated academic interventions
 */
export const getInterventions = async ({
  schoolId,
  studentId = null,
  classId = null,
  status = null,
  severity = null,
  page = 1,
  limit = 20,
}) => {
  const where = { schoolId };
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (classId) {
    where.student = { ...(where.student || {}), classId };
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Math.min(100, Math.max(1, Number(limit)));

  const [total, interventions] = await Promise.all([
    prisma.academicIntervention.count({ where }),
    prisma.academicIntervention.findMany({
      where,
      skip,
      take,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: {
        student: {
          select: {
            id: true,
            name: true,
            admissionNumber: true,
            class: { select: { id: true, name: true, section: true } },
          },
        },
        teacher: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { notes: true } },
      },
    }),
  ]);

  return {
    interventions,
    total,
    page: Number(page),
    limit: take,
    totalPages: Math.ceil(total / take),
  };
};

/**
 * Update intervention details, status, or progress
 */
export const updateIntervention = async ({
  interventionId,
  schoolId,
  userId,
  ...updates
}) => {
  const existing = await prisma.academicIntervention.findFirst({
    where: { id: interventionId, schoolId },
  });

  if (!existing) {
    throw new Error('Intervention not found.');
  }

  const data = {};
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.severity !== undefined) data.severity = updates.severity;
  if (updates.actionPlan !== undefined) data.actionPlan = updates.actionPlan;
  if (updates.currentPercentage !== undefined) data.currentPercentage = Number(updates.currentPercentage);
  if (updates.followUpDate !== undefined) data.followUpDate = updates.followUpDate ? new Date(updates.followUpDate) : null;
  if (updates.assignedToId !== undefined) data.assignedToId = updates.assignedToId;

  const updated = await prisma.academicIntervention.update({
    where: { id: interventionId },
    data,
    include: {
      student: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: userId,
    action: 'ACADEMIC_INTERVENTION_UPDATED',
    entityType: 'AcademicIntervention',
    entityId: interventionId,
    previousValue: { status: existing.status, severity: existing.severity },
    newValue: data,
    reason: `Updated intervention "${existing.title}".`,
  });

  return updated;
};

/**
 * Resolve an intervention with final notes
 */
export const resolveIntervention = async ({
  interventionId,
  schoolId,
  resolvedById,
  resolutionNotes,
  currentPercentage = null,
}) => {
  if (!resolutionNotes || !resolutionNotes.trim()) {
    throw new Error('Resolution notes describing outcomes and progress are required.');
  }

  const existing = await prisma.academicIntervention.findFirst({
    where: { id: interventionId, schoolId },
  });

  if (!existing) {
    throw new Error('Intervention not found.');
  }

  const resolved = await prisma.academicIntervention.update({
    where: { id: interventionId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedById,
      resolutionNotes: resolutionNotes.trim(),
      currentPercentage: currentPercentage ? Number(currentPercentage) : existing.currentPercentage,
    },
    include: {
      student: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    actorId: resolvedById,
    action: 'ACADEMIC_INTERVENTION_RESOLVED',
    entityType: 'AcademicIntervention',
    entityId: interventionId,
    newValue: { status: 'RESOLVED', resolutionNotes },
    reason: `Resolved academic intervention for ${resolved.student.name}: ${resolutionNotes}`,
  });

  return resolved;
};

/**
 * Add progress note to an intervention
 */
export const addInterventionNote = async ({
  interventionId,
  schoolId,
  authorId,
  note,
  progressMetric = null,
}) => {
  if (!note || !note.trim()) {
    throw new Error('Note content is required.');
  }

  const existing = await prisma.academicIntervention.findFirst({
    where: { id: interventionId, schoolId },
  });

  if (!existing) {
    throw new Error('Intervention not found.');
  }

  const createdNote = await prisma.academicInterventionNote.create({
    data: {
      interventionId,
      authorId,
      note: note.trim(),
      progressMetric: progressMetric ? Number(progressMetric) : null,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });

  if (progressMetric) {
    await prisma.academicIntervention.update({
      where: { id: interventionId },
      data: { currentPercentage: Number(progressMetric) },
    });
  }

  return createdNote;
};

/**
 * Generate CSV export of student performance intelligence report
 */
export const exportPerformanceReportCsv = async ({ schoolId, classId = null, examinationId = null }) => {
  const whereExam = { schoolId };
  if (classId) whereExam.classId = classId;
  if (examinationId) whereExam.id = examinationId;

  const exams = await prisma.examination.findMany({
    where: whereExam,
    include: {
      class: true,
      examSubjects: {
        include: {
          marks: {
            include: {
              student: {
                include: { class: true },
              },
            },
          },
        },
      },
    },
  });

  const studentMap = new Map();

  for (const exam of exams) {
    for (const sub of exam.examSubjects) {
      for (const m of sub.marks) {
        if (!m.student?.active) continue;

        const sid = m.student.id;
        if (!studentMap.has(sid)) {
          studentMap.set(sid, {
            name: m.student.name,
            admissionNumber: m.student.admissionNumber,
            rollNumber: m.student.rollNumber || 'N/A',
            className: m.student.class ? `${m.student.class.name}-${m.student.class.section}` : 'N/A',
            totalMarks: 0,
            totalMax: 0,
            subjects: {},
            failedSubjects: [],
          });
        }

        const sData = studentMap.get(sid);
        sData.totalMarks += m.marksObtained;
        sData.totalMax += sub.maxMarks;
        sData.subjects[sub.subject] = m.marksObtained;
        if (m.marksObtained < sub.passMarks) {
          sData.failedSubjects.push(sub.subject);
        }
      }
    }
  }

  const rows = [];
  rows.push([
    'Admission Number',
    'Student Name',
    'Roll Number',
    'Class',
    'Total Marks Obtained',
    'Total Max Marks',
    'Academic Percentage (%)',
    'Grade',
    'Attendance Rate (%)',
    'Academic Status',
    'Failed Subjects',
  ].join(','));

  for (const [sid, data] of studentMap.entries()) {
    const { attendanceRate } = await getStudentAttendanceRate(sid, schoolId);
    const percentage = data.totalMax > 0 ? Number(((data.totalMarks / data.totalMax) * 100).toFixed(1)) : 0;
    const grade = calculateGrade(percentage);
    const status = percentage < 40 || data.failedSubjects.length > 0 ? 'AT_RISK' : 'SATISFACTORY';

    rows.push([
      `"${data.admissionNumber}"`,
      `"${data.name}"`,
      `"${data.rollNumber}"`,
      `"${data.className}"`,
      data.totalMarks,
      data.totalMax,
      percentage,
      `"${grade}"`,
      attendanceRate,
      `"${status}"`,
      `"${data.failedSubjects.join('; ') || 'None'}"`,
    ].join(','));
  }

  return rows.join('\n');
};
