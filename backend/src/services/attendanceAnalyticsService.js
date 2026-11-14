import prisma from '../config/db.js';

export const normalizeDateRange = (startDate, endDate) => {
  const end = endDate ? new Date(endDate) : new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = startDate ? new Date(startDate) : new Date(end);
  if (!startDate) start.setDate(end.getDate() - 30);
  start.setUTCHours(0, 0, 0, 0);
  if (start > end) throw new Error('Start date cannot be after end date.');
  return { start, end };
};

/**
 * 1. Overall School Attendance Overview & KPI Metrics
 */
export const getAttendanceOverview = async ({ schoolId, classId, startDate, endDate }) => {
  const { start, end } = normalizeDateRange(startDate, endDate);
  const sessionWhere = { class: { schoolId }, sessionDate: { gte: start, lte: end } };
  if (classId) sessionWhere.classId = classId;

  const [sessions, approvedLeaves, totalActiveStudents] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        sessionDate: true,
        attendanceRecords: { select: { status: true, studentId: true } },
      },
    }),
    prisma.studentLeave.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : {}),
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { totalDays: true },
    }),
    prisma.student.count({
      where: { schoolId, ...(classId ? { classId } : {}), active: true },
    }),
  ]);

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  sessions.forEach((s) => {
    s.attendanceRecords.forEach((r) => {
      if (r.status === 'PRESENT') presentCount++;
      else if (r.status === 'LATE') lateCount++;
      else if (r.status === 'ABSENT') absentCount++;
    });
  });

  const totalMarkedRecords = presentCount + lateCount + absentCount;
  const approvedLeaveDays = approvedLeaves.reduce((acc, l) => acc + (l.totalDays || 1), 0);
  const overallRate =
    totalMarkedRecords > 0
      ? Math.round(((presentCount + lateCount) / totalMarkedRecords) * 1000) / 10
      : 0;

  // Previous comparative interval for trend indicator
  const rangeDuration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - rangeDuration);
  const prevEnd = new Date(start.getTime() - 1);

  const prevSessions = await prisma.attendanceSession.findMany({
    where: {
      class: { schoolId },
      ...(classId ? { classId } : {}),
      sessionDate: { gte: prevStart, lte: prevEnd },
    },
    select: { attendanceRecords: { select: { status: true } } },
  });

  let prevPresent = 0;
  let prevTotal = 0;
  prevSessions.forEach((s) => {
    s.attendanceRecords.forEach((r) => {
      prevTotal++;
      if (r.status === 'PRESENT' || r.status === 'LATE') prevPresent++;
    });
  });

  const prevRate = prevTotal > 0 ? Math.round((prevPresent / prevTotal) * 1000) / 10 : overallRate;
  const delta = Math.round((overallRate - prevRate) * 10) / 10;
  const trend = delta > 0.5 ? 'improvement' : delta < -0.5 ? 'decline' : 'steady';

  return {
    metrics: {
      overallAttendanceRate: overallRate,
      previousPeriodRate: prevRate,
      rateDelta: delta,
      trend,
      totalSessions: sessions.length,
      totalStudents: totalActiveStudents,
      totalRecords: totalMarkedRecords,
      presentCount,
      lateCount,
      absentCount,
      approvedLeaveDays,
    },
    distribution: [
      { name: 'Present', value: presentCount, color: '#10b981' },
      { name: 'Late', value: lateCount, color: '#f59e0b' },
      { name: 'Absent', value: absentCount, color: '#f43f5e' },
      { name: 'Approved Leave', value: approvedLeaveDays, color: '#6366f1' },
    ],
    interval: {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    },
  };
};

/**
 * 2. Attendance Trends by Time Grouping (daily, weekly, monthly)
 */
export const getAttendanceTrends = async ({ schoolId, classId, startDate, endDate, interval = 'daily' }) => {
  const { start, end } = normalizeDateRange(startDate, endDate);
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      class: { schoolId },
      ...(classId ? { classId } : {}),
      sessionDate: { gte: start, lte: end },
    },
    orderBy: { sessionDate: 'asc' },
    include: { attendanceRecords: { select: { status: true } } },
  });

  const trendMap = new Map();
  sessions.forEach((s) => {
    const d = new Date(s.sessionDate);
    let key;
    if (interval === 'monthly') {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    } else if (interval === 'weekly') {
      const oneJan = new Date(d.getUTCFullYear(), 0, 1);
      const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
      key = `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    } else {
      key = d.toISOString().split('T')[0];
    }

    if (!trendMap.has(key)) trendMap.set(key, { date: key, present: 0, late: 0, absent: 0, total: 0 });
    const b = trendMap.get(key);
    s.attendanceRecords.forEach((r) => {
      b.total++;
      if (r.status === 'PRESENT') b.present++;
      else if (r.status === 'LATE') b.late++;
      else if (r.status === 'ABSENT') b.absent++;
    });
  });

  const trends = Array.from(trendMap.values()).map((b) => ({
    ...b,
    attendanceRate: b.total > 0 ? Math.round(((b.present + b.late) / b.total) * 1000) / 10 : 0,
  }));
  return { interval, trends };
};

/**
 * 3. Class-wise Comparative Analytics
 */
export const getClassAttendanceComparison = async ({ schoolId, startDate, endDate }) => {
  const { start, end } = normalizeDateRange(startDate, endDate);
  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
      students: { where: { active: true }, select: { id: true } },
      attendanceSessions: {
        where: { sessionDate: { gte: start, lte: end } },
        include: { attendanceRecords: { select: { status: true } } },
      },
    },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
  });

  return classes.map((c) => {
    let present = 0, late = 0, absent = 0;
    c.attendanceSessions.forEach((s) => {
      s.attendanceRecords.forEach((r) => {
        if (r.status === 'PRESENT') present++;
        else if (r.status === 'LATE') late++;
        else if (r.status === 'ABSENT') absent++;
      });
    });
    const total = present + late + absent;
    const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;
    return {
      classId: c.id,
      className: `${c.name}-${c.section}`,
      enrolledStudents: c.students.length,
      sessionsCount: c.attendanceSessions.length,
      totalMarked: total,
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      attendanceRate: rate,
      status: rate >= 85 ? 'EXCELLENT' : rate >= 75 ? 'SATISFACTORY' : 'NEEDS_ATTENTION',
    };
  });
};

const calculateConsecutiveAbsences = (records) => {
  let count = 0;
  for (const r of records) {
    if (r.status === 'ABSENT') count++;
    else break;
  }
  return count;
};

/**
 * 4. Student Attendance Summaries with Consecutive Absences
 */
export const getStudentAttendanceSummaries = async ({
  schoolId,
  classId,
  startDate,
  endDate,
  search,
  page = 1,
  limit = 25,
}) => {
  const { start, end } = normalizeDateRange(startDate, endDate);
  const studentWhere = { schoolId, active: true };
  if (classId) studentWhere.classId = classId;
  if (search?.trim()) {
    const q = search.trim();
    studentWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { admissionNumber: { contains: q, mode: 'insensitive' } },
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (p - 1) * l;

  const [totalStudents, students] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.student.findMany({
      where: studentWhere,
      skip,
      take: l,
      include: {
        class: { select: { id: true, name: true, section: true } },
        attendanceRecords: {
          where: { markedAt: { gte: start, lte: end } },
          orderBy: { markedAt: 'desc' },
          select: { status: true },
        },
        studentLeaves: {
          where: { status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } },
          select: { totalDays: true },
        },
      },
      orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
    }),
  ]);

  const summaries = students.map((st) => {
    let present = 0, late = 0, absent = 0;
    st.attendanceRecords.forEach((r) => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'ABSENT') absent++;
    });
    const total = present + late + absent;
    const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;
    const approvedLeaveDays = st.studentLeaves.reduce((sum, lv) => sum + lv.totalDays, 0);
    const consecutiveAbsences = calculateConsecutiveAbsences(st.attendanceRecords);
    return {
      studentId: st.id,
      name: st.name,
      admissionNumber: st.admissionNumber,
      rollNumber: st.rollNumber,
      class: `${st.class.name}-${st.class.section}`,
      totalSessions: total,
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      approvedLeaveDays,
      consecutiveAbsences,
      attendanceRate: rate,
      isAtRisk: rate < 75 || consecutiveAbsences >= 3,
    };
  });

  return {
    students: summaries,
    pagination: { total: totalStudents, page: p, limit: l, totalPages: Math.ceil(totalStudents / l) || 1 },
  };
};

/**
 * 5. At-Risk Students Intelligence
 */
export const getAtRiskStudents = async ({
  schoolId,
  classId,
  threshold = 75,
  minConsecutive = 3,
  startDate,
  endDate,
}) => {
  const { start, end } = normalizeDateRange(startDate, endDate);
  const threshNum = parseFloat(threshold) || 75;
  const consecNum = parseInt(minConsecutive, 10) || 3;

  const students = await prisma.student.findMany({
    where: { schoolId, ...(classId ? { classId } : {}), active: true },
    include: {
      class: { select: { id: true, name: true, section: true } },
      attendanceRecords: {
        where: { markedAt: { gte: start, lte: end } },
        orderBy: { markedAt: 'desc' },
        select: { status: true },
      },
      studentLeaves: {
        where: { status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } },
        select: { totalDays: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const atRiskList = [];
  students.forEach((st) => {
    let present = 0, late = 0, absent = 0;
    st.attendanceRecords.forEach((r) => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'ABSENT') absent++;
    });
    const total = present + late + absent;
    if (total === 0) return;

    const rate = Math.round(((present + late) / total) * 1000) / 10;
    const consecutive = calculateConsecutiveAbsences(st.attendanceRecords);
    const approvedLeaveDays = st.studentLeaves.reduce((sum, lv) => sum + lv.totalDays, 0);

    if (rate < threshNum || consecutive >= consecNum) {
      const riskTier = (rate < 60 || consecutive >= 5) ? 'CRITICAL' : (rate < 75 || consecutive >= 3) ? 'HIGH' : 'MODERATE';
      atRiskList.push({
        studentId: st.id,
        name: st.name,
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber,
        guardianName: st.guardianName,
        guardianPhone: st.guardianPhone,
        class: `${st.class.name}-${st.class.section}`,
        totalSessions: total,
        absentCount: absent,
        approvedLeaveDays,
        consecutiveAbsences: consecutive,
        attendanceRate: rate,
        riskTier,
        interventionRecommended:
          riskTier === 'CRITICAL' ? 'Parent meeting & formal notification' : 'Faculty counselling & call home',
      });
    }
  });

  atRiskList.sort((a, b) => {
    const tierWeight = { CRITICAL: 3, HIGH: 2, MODERATE: 1 };
    return tierWeight[b.riskTier] - tierWeight[a.riskTier] || a.attendanceRate - b.attendanceRate;
  });

  return {
    threshold: threshNum,
    atRiskCount: atRiskList.length,
    criticalCount: atRiskList.filter((s) => s.riskTier === 'CRITICAL').length,
    students: atRiskList,
  };
};

const escapeCsv = (field) => {
  if (field === null || field === undefined) return '';
  const str = String(field);
  return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
};

/**
 * 6. Attendance CSV Exporter
 */
export const generateAttendanceCsv = async ({ schoolId, classId, type = 'students', startDate, endDate }) => {
  if (type === 'classes') {
    const classes = await getClassAttendanceComparison({ schoolId, startDate, endDate });
    const headers = ['Class Name', 'Enrolled Students', 'Sessions Held', 'Total Marked', 'Present', 'Late', 'Absent', 'Attendance Rate (%)', 'Status'];
    const rows = classes.map((c) => [
      escapeCsv(c.className), escapeCsv(c.enrolledStudents), escapeCsv(c.sessionsCount),
      escapeCsv(c.totalMarked), escapeCsv(c.presentCount), escapeCsv(c.lateCount),
      escapeCsv(c.absentCount), escapeCsv(c.attendanceRate), escapeCsv(c.status),
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  if (type === 'at-risk') {
    const risk = await getAtRiskStudents({ schoolId, classId, startDate, endDate });
    const headers = ['Admission No', 'Student Name', 'Class', 'Attendance Rate (%)', 'Consecutive Absences', 'Total Sessions', 'Absent', 'Leaves', 'Risk Tier', 'Guardian Phone', 'Action'];
    const rows = risk.students.map((s) => [
      escapeCsv(s.admissionNumber), escapeCsv(s.name), escapeCsv(s.class), escapeCsv(s.attendanceRate),
      escapeCsv(s.consecutiveAbsences), escapeCsv(s.totalSessions), escapeCsv(s.absentCount),
      escapeCsv(s.approvedLeaveDays), escapeCsv(s.riskTier), escapeCsv(s.guardianPhone || 'N/A'),
      escapeCsv(s.interventionRecommended),
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  const summary = await getStudentAttendanceSummaries({ schoolId, classId, startDate, endDate, limit: 1000 });
  const headers = ['Admission No', 'Student Name', 'Roll No', 'Class', 'Sessions', 'Present', 'Late', 'Absent', 'Leaves', 'Consecutive Absences', 'Rate (%)', 'At Risk'];
  const rows = summary.students.map((s) => [
    escapeCsv(s.admissionNumber), escapeCsv(s.name), escapeCsv(s.rollNumber || 'N/A'),
    escapeCsv(s.class), escapeCsv(s.totalSessions), escapeCsv(s.presentCount),
    escapeCsv(s.lateCount), escapeCsv(s.absentCount), escapeCsv(s.approvedLeaveDays),
    escapeCsv(s.consecutiveAbsences), escapeCsv(s.attendanceRate), escapeCsv(s.isAtRisk ? 'YES' : 'NO'),
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};
