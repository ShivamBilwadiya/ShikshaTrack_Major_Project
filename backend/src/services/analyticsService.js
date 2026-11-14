import prisma from '../config/db.js';

const formatLocalDate = (d) => {
  const dateObj = d instanceof Date ? d : new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getAdminDashboardStats = async (schoolIdOrOptions, maybeOptions = {}) => {
  let schoolId;
  let startDate;
  let endDate;

  if (typeof schoolIdOrOptions === 'object' && schoolIdOrOptions !== null) {
    schoolId = schoolIdOrOptions.schoolId;
    startDate = schoolIdOrOptions.startDate;
    endDate = schoolIdOrOptions.endDate;
  } else {
    schoolId = schoolIdOrOptions;
    startDate = maybeOptions.startDate;
    endDate = maybeOptions.endDate;
  }

  const isCustomRange = Boolean(startDate || endDate);

  let rangeStart;
  let rangeEnd;

  if (isCustomRange) {
    rangeStart = startDate ? new Date(startDate) : new Date('2000-01-01');
    rangeStart.setHours(0, 0, 0, 0);

    rangeEnd = endDate ? new Date(endDate) : new Date();
    rangeEnd.setHours(23, 59, 59, 999);
  } else {
    const today = new Date();
    rangeStart = new Date(today);
    rangeStart.setHours(0, 0, 0, 0);

    rangeEnd = new Date(today);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  // 1. Overall Counts
  const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
    prisma.student.count({ where: { schoolId, active: true } }),
    prisma.user.count({ where: { schoolId, role: 'TEACHER', active: true } }),
    prisma.class.count({ where: { schoolId } }),
  ]);

  // 2. Sessions & Attendance within selected range
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      class: { schoolId },
      sessionDate: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      class: true,
      attendanceRecords: true,
    },
    orderBy: { sessionDate: 'asc' },
  });

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  sessions.forEach((sess) => {
    sess.attendanceRecords.forEach((rec) => {
      if (rec.status === 'PRESENT') presentCount++;
      else if (rec.status === 'LATE') lateCount++;
      else if (rec.status === 'ABSENT') absentCount++;
    });
  });

  const totalMarked = presentCount + lateCount + absentCount;
  const unmarkedCount = isCustomRange
    ? Math.max(0, (totalStudents * Math.max(1, sessions.length)) - totalMarked)
    : Math.max(0, totalStudents - totalMarked);
  const attendanceRate = totalMarked > 0 ? Math.round(((presentCount + lateCount) / totalMarked) * 100) : 0;

  // 3. Class-wise attendance comparison across selected range
  const classMap = new Map();
  sessions.forEach((s) => {
    const existing = classMap.get(s.classId) || {
      classId: s.classId,
      className: `${s.class.name}-${s.class.section}`,
      present: 0,
      late: 0,
      absent: 0,
      status: s.status,
      sessionCount: 0,
    };
    existing.sessionCount++;
    s.attendanceRecords.forEach((r) => {
      if (r.status === 'PRESENT') existing.present++;
      else if (r.status === 'LATE') existing.late++;
      else if (r.status === 'ABSENT') existing.absent++;
    });
    classMap.set(s.classId, existing);
  });

  const classBreakdown = Array.from(classMap.values()).map((c) => {
    const total = c.present + c.late + c.absent;
    return {
      ...c,
      rate: total > 0 ? Math.round(((c.present + c.late) / total) * 100) : 0,
    };
  });

  // 4. Trend across selected range or last 7 days
  let trendSessions = sessions;
  if (!isCustomRange) {
    const sevenDaysAgo = new Date(rangeEnd.getTime() - 7 * 86400000);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    trendSessions = await prisma.attendanceSession.findMany({
      where: {
        class: { schoolId },
        sessionDate: { gte: sevenDaysAgo, lte: rangeEnd },
      },
      include: {
        attendanceRecords: true,
      },
      orderBy: { sessionDate: 'asc' },
    });
  }

  const trendMap = {};
  trendSessions.forEach((s) => {
    const dStr = formatLocalDate(s.sessionDate);
    if (!trendMap[dStr]) {
      trendMap[dStr] = { date: dStr, present: 0, late: 0, absent: 0, total: 0 };
    }
    s.attendanceRecords.forEach((r) => {
      if (r.status === 'PRESENT') trendMap[dStr].present++;
      else if (r.status === 'LATE') trendMap[dStr].late++;
      else if (r.status === 'ABSENT') trendMap[dStr].absent++;
      trendMap[dStr].total++;
    });
  });

  const trend = Object.values(trendMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      rate: item.total > 0 ? Math.round(((item.present + item.late) / item.total) * 100) : 0,
    }));

  // 5. Recent Activity Feed (Audit logs)
  const recentActivity = await prisma.auditLog.findMany({
    where: {
      actor: { schoolId },
    },
    include: {
      actor: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  return {
    overview: {
      totalStudents,
      totalTeachers,
      totalClasses,
      todayPresent: presentCount,
      todayLate: lateCount,
      todayAbsent: absentCount,
      todayUnmarked: unmarkedCount,
      todayAttendanceRate: attendanceRate,
      dateRange: {
        startDate: startDate ? startDate.split('T')[0] : formatLocalDate(rangeStart),
        endDate: endDate ? endDate.split('T')[0] : formatLocalDate(rangeEnd),
        isCustomRange,
        totalSessions: sessions.length,
        totalMarked,
      },
    },
    classBreakdown,
    trend,
    recentActivity,
  };
};

export const getTeacherDashboardStats = async (teacherId, schoolId, options = {}) => {
  const { startDate, endDate } = options;
  const isCustomRange = Boolean(startDate || endDate);

  let rangeStart;
  let rangeEnd;

  if (isCustomRange) {
    rangeStart = startDate ? new Date(startDate) : new Date('2000-01-01');
    rangeStart.setHours(0, 0, 0, 0);

    rangeEnd = endDate ? new Date(endDate) : new Date();
    rangeEnd.setHours(23, 59, 59, 999);
  } else {
    const today = new Date();
    rangeStart = new Date(today);
    rangeStart.setHours(0, 0, 0, 0);

    rangeEnd = new Date(today);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  // 1. Get assigned classes
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId },
    include: {
      class: {
        include: {
          students: { where: { active: true } },
        },
      },
    },
  });

  const assignedClasses = assignments.map((a) => ({
    assignmentId: a.id,
    classId: a.classId,
    className: `${a.class.name}-${a.class.section}`,
    academicYear: a.class.academicYear,
    isClassTeacher: a.isClassTeacher,
    studentCount: a.class.students.length,
  }));

  const classIds = assignedClasses.map((c) => c.classId);

  // 2. Sessions for this teacher's assigned classes in range
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      classId: { in: classIds },
      sessionDate: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      class: true,
      attendanceRecords: true,
    },
  });

  const sessionStatusList = assignedClasses.map((ac) => {
    const matchedSessions = sessions.filter((s) => s.classId === ac.classId);
    if (matchedSessions.length === 0) {
      return {
        classId: ac.classId,
        className: ac.className,
        studentCount: ac.studentCount,
        hasSession: false,
        sessionId: null,
        status: 'NOT_STARTED',
        markedCount: 0,
        presentCount: 0,
      };
    }

    const latestSession = matchedSessions[matchedSessions.length - 1];
    let present = 0;
    let late = 0;
    let absent = 0;
    let totalRecords = 0;

    matchedSessions.forEach((sess) => {
      sess.attendanceRecords.forEach((r) => {
        if (r.status === 'PRESENT') present++;
        else if (r.status === 'LATE') late++;
        else if (r.status === 'ABSENT') absent++;
        totalRecords++;
      });
    });

    const expectedMarked = ac.studentCount * matchedSessions.length;
    return {
      classId: ac.classId,
      className: ac.className,
      studentCount: ac.studentCount,
      hasSession: true,
      sessionId: latestSession.id,
      status: latestSession.status,
      sessionCount: matchedSessions.length,
      markedCount: totalRecords,
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      attendanceRate: expectedMarked > 0 ? Math.round(((present + late) / expectedMarked) * 100) : 0,
    };
  });

  // 3. Recent records marked by this teacher
  const recentRecords = await prisma.attendanceRecord.findMany({
    where: {
      session: { teacherId },
    },
    include: {
      student: true,
      session: { include: { class: true } },
    },
    orderBy: { markedAt: 'desc' },
    take: 10,
  });

  return {
    assignedClasses,
    todaySessions: sessionStatusList,
    recentRecords: recentRecords.map((r) => ({
      id: r.id,
      studentName: r.student.name,
      admissionNumber: r.student.admissionNumber,
      className: `${r.session.class.name}-${r.session.class.section}`,
      status: r.status,
      method: r.method,
      markedAt: r.markedAt,
    })),
  };
};

/**
 * Attendance Anomaly Detection (Statistical Rules)
 */
export const detectAttendanceAnomalies = async (schoolId) => {
  const anomalies = [];

  // Anomaly Rule 1: Weekly pattern (e.g. repeatedly absent on Mondays or Fridays)
  const students = await prisma.student.findMany({
    where: { schoolId, active: true },
    include: {
      class: true,
      attendanceRecords: {
        include: { session: true },
        orderBy: { markedAt: 'desc' },
        take: 30,
      },
    },
  });

  students.forEach((student) => {
    const mondayAbsences = student.attendanceRecords.filter(
      (r) => r.status === 'ABSENT' && new Date(r.session.sessionDate).getDay() === 1
    ).length;

    const fridayAbsences = student.attendanceRecords.filter(
      (r) => r.status === 'ABSENT' && new Date(r.session.sessionDate).getDay() === 5
    ).length;

    if (mondayAbsences >= 2) {
      anomalies.push({
        type: 'WEEKDAY_ABSENCE_PATTERN',
        severity: 'MEDIUM',
        studentId: student.id,
        studentName: student.name,
        className: `${student.class.name}-${student.class.section}`,
        description: `Student has been absent on ${mondayAbsences} Mondays in recent sessions.`,
        suggestedAction: 'Inquire with guardian regarding weekly household or agricultural commute constraints.',
      });
    }

    if (fridayAbsences >= 2) {
      anomalies.push({
        type: 'WEEKDAY_ABSENCE_PATTERN',
        severity: 'MEDIUM',
        studentId: student.id,
        studentName: student.name,
        className: `${student.class.name}-${student.class.section}`,
        description: `Student has been absent on ${fridayAbsences} Fridays in recent sessions.`,
        suggestedAction: 'Inquire with guardian regarding weekly market or family obligations.',
      });
    }

    // Anomaly Rule 2: Sudden drop in attendance (>20% drop in last 5 sessions vs prior 10)
    if (student.attendanceRecords.length >= 10) {
      const recent5 = student.attendanceRecords.slice(0, 5);
      const prior = student.attendanceRecords.slice(5, 15);

      const recentPresent = recent5.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const priorPresent = prior.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;

      const recentRate = (recentPresent / recent5.length) * 100;
      const priorRate = (priorPresent / prior.length) * 100;

      if (priorRate - recentRate >= 25) {
        anomalies.push({
          type: 'SUDDEN_ATTENDANCE_DROP',
          severity: 'HIGH',
          studentId: student.id,
          studentName: student.name,
          className: `${student.class.name}-${student.class.section}`,
          description: `Attendance dropped sharply from ${Math.round(priorRate)}% to ${Math.round(
            recentRate
          )}% in recent sessions.`,
          suggestedAction: 'Immediate follow-up call with student guardian to identify health or family emergencies.',
        });
      }
    }
  });

  return anomalies;
};

/**
 * Helper to compute trend and streak metrics from an ordered array of records (newest first)
 */
const computeStudentAttendanceMetrics = (records, threshold = 75) => {
  const total = records.length;
  if (total === 0) {
    return {
      totalSessions: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      attendanceRate: 0,
      consecutiveAbsences: 0,
      maxConsecutiveAbsences: 0,
      statusCategory: 'GOOD',
      trend: {
        direction: 'STABLE',
        recentRate: 0,
        priorRate: 0,
        changePercent: 0,
      },
      insights: ['No attendance sessions recorded yet for this student.'],
    };
  }

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  // Streak tracking
  let consecutiveAbsences = 0;
  let streakActive = true;
  let maxConsecutiveAbsences = 0;
  let tempConsecutive = 0;

  for (let i = 0; i < records.length; i++) {
    const status = records[i].status;
    if (status === 'PRESENT') {
      presentCount++;
      streakActive = false;
      tempConsecutive = 0;
    } else if (status === 'LATE') {
      lateCount++;
      streakActive = false;
      tempConsecutive = 0;
    } else if (status === 'ABSENT') {
      absentCount++;
      if (streakActive) consecutiveAbsences++;
      tempConsecutive++;
      if (tempConsecutive > maxConsecutiveAbsences) {
        maxConsecutiveAbsences = tempConsecutive;
      }
    }
  }

  const effectivePresent = presentCount + lateCount;
  const attendanceRate = Math.round((effectivePresent / total) * 1000) / 10;

  // Trend analysis: compare recent 5 sessions with prior up to 10
  const recentWindow = records.slice(0, 5);
  const priorWindow = records.slice(5, 15);

  const recentPresent = recentWindow.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const recentRate = recentWindow.length > 0 ? Math.round((recentPresent / recentWindow.length) * 1000) / 10 : attendanceRate;

  let priorRate = attendanceRate;
  if (priorWindow.length > 0) {
    const priorPresent = priorWindow.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    priorRate = Math.round((priorPresent / priorWindow.length) * 1000) / 10;
  }

  const changePercent = Math.round((recentRate - priorRate) * 10) / 10;
  let direction = 'STABLE';
  if (changePercent >= 8) direction = 'IMPROVING';
  else if (changePercent <= -8) direction = 'DECLINING';

  // Pattern categorization
  let statusCategory = 'GOOD';
  if (consecutiveAbsences >= 3 || (records.length >= 5 && recentWindow.filter((r) => r.status === 'ABSENT').length >= 4)) {
    statusCategory = 'CONSISTENTLY_ABSENT';
  } else if (attendanceRate < threshold) {
    statusCategory = 'CHRONIC_LOW';
  } else if (direction === 'DECLINING' && attendanceRate < 85) {
    statusCategory = 'DECLINING';
  } else if (direction === 'IMPROVING') {
    statusCategory = 'IMPROVING';
  } else if (absentCount >= 3 && Math.abs(changePercent) >= 15) {
    statusCategory = 'IRREGULAR';
  }

  // Generate plain English insights
  const insights = [];
  if (consecutiveAbsences >= 3) {
    insights.push(`Urgent: Student has been absent for ${consecutiveAbsences} consecutive sessions.`);
  }

  if (attendanceRate < threshold) {
    insights.push(
      `Attendance (${attendanceRate}%) is below the statutory ${threshold}% threshold required under the RTE Act.`
    );
  } else if (attendanceRate >= 90) {
    insights.push(`Exemplary attendance: ${attendanceRate}% presence rate.`);
  }

  if (direction === 'IMPROVING') {
    insights.push(`Positive trajectory: Attendance improved by +${changePercent}% over recent sessions.`);
  } else if (direction === 'DECLINING') {
    insights.push(`Noticeable decline: Attendance dropped by ${changePercent}% compared to previous weeks.`);
  }

  if (statusCategory === 'IRREGULAR') {
    insights.push('Attendance shows irregular, sporadic attendance without long continuous presence.');
  }

  return {
    totalSessions: total,
    presentCount,
    lateCount,
    absentCount,
    attendanceRate,
    consecutiveAbsences,
    maxConsecutiveAbsences,
    statusCategory,
    trend: {
      direction,
      recentRate,
      priorRate,
      changePercent,
    },
    insights,
  };
};

/**
 * Comprehensive Student Attendance Insights with Filtering, Search, and Pagination
 */
export const getStudentAttendanceInsights = async ({
  schoolId,
  classId,
  threshold = 75,
  status = 'ALL',
  search,
  startDate,
  endDate,
  page,
  limit,
  sortBy = 'attendanceRate',
  sortOrder = 'asc',
}) => {
  const where = {
    schoolId,
    active: true,
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
    ];
  }

  // Date filters on sessions
  const sessionDateFilter = {};
  if (startDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    sessionDateFilter.gte = s;
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    sessionDateFilter.lte = e;
  }

  const recordWhere = Object.keys(sessionDateFilter).length > 0
    ? { session: { sessionDate: sessionDateFilter } }
    : undefined;

  // Retrieve students with attendance records
  const students = await prisma.student.findMany({
    where,
    select: {
      id: true,
      name: true,
      admissionNumber: true,
      rollNumber: true,
      gender: true,
      classId: true,
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          academicYear: true,
        },
      },
      attendanceRecords: {
        where: recordWhere,
        select: {
          id: true,
          status: true,
          markedAt: true,
          method: true,
          session: {
            select: {
              id: true,
              sessionDate: true,
            },
          },
        },
        orderBy: { markedAt: 'desc' },
      },
    },
    orderBy: [{ classId: 'asc' }, { rollNumber: 'asc' }, { name: 'asc' }],
  });

  // Compute metrics for every student
  let analyzed = students.map((s) => {
    const metrics = computeStudentAttendanceMetrics(s.attendanceRecords, threshold);
    return {
      studentId: s.id,
      name: s.name,
      admissionNumber: s.admissionNumber,
      rollNumber: s.rollNumber,
      gender: s.gender,
      class: s.class,
      ...metrics,
    };
  });

  // Filter by status category if requested
  if (status && status !== 'ALL') {
    const targetStatus = status.toUpperCase();
    if (targetStatus === 'BELOW_THRESHOLD' || targetStatus === 'CHRONIC_LOW') {
      analyzed = analyzed.filter((s) => s.attendanceRate < threshold);
    } else {
      analyzed = analyzed.filter((s) => s.statusCategory === targetStatus);
    }
  }

  // Summary counts
  const totalAnalyzed = analyzed.length;
  let totalRateSum = 0;
  let belowThresholdCount = 0;
  let consistentlyAbsentCount = 0;
  let irregularCount = 0;
  let improvingCount = 0;
  let decliningCount = 0;

  analyzed.forEach((s) => {
    totalRateSum += s.attendanceRate;
    if (s.attendanceRate < threshold) belowThresholdCount++;
    if (s.statusCategory === 'CONSISTENTLY_ABSENT') consistentlyAbsentCount++;
    if (s.statusCategory === 'IRREGULAR') irregularCount++;
    if (s.trend.direction === 'IMPROVING') improvingCount++;
    if (s.trend.direction === 'DECLINING') decliningCount++;
  });

  const averageAttendance = totalAnalyzed > 0 ? Math.round((totalRateSum / totalAnalyzed) * 10) / 10 : 0;

  // Sorting
  const isDesc = sortOrder && sortOrder.toLowerCase() === 'desc';
  analyzed.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === 'absentCount') {
      cmp = a.absentCount - b.absentCount;
    } else if (sortBy === 'changePercent') {
      cmp = a.trend.changePercent - b.trend.changePercent;
    } else {
      // Default: attendanceRate
      cmp = a.attendanceRate - b.attendanceRate;
    }
    return isDesc ? -cmp : cmp;
  });

  const summary = {
    totalAnalyzed,
    averageAttendance,
    threshold,
    belowThresholdCount,
    consistentlyAbsentCount,
    irregularCount,
    improvingCount,
    decliningCount,
  };

  // Pagination if requested
  if (page !== undefined || limit !== undefined) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    const paginatedStudents = analyzed.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(totalAnalyzed / limitNum);

    return {
      summary,
      students: paginatedStudents,
      pagination: {
        total: totalAnalyzed,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  return {
    summary,
    students: analyzed,
  };
};

/**
 * Get in-depth historical attendance and day-of-week analytics for single student
 */
export const getStudentDetailInsights = async ({ schoolId, studentId, threshold = 75 }) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      class: true,
      attendanceRecords: {
        include: {
          session: true,
        },
        orderBy: { markedAt: 'desc' },
      },
    },
  });

  if (!student) {
    const err = new Error('Student not found in this school.');
    err.statusCode = 404;
    throw err;
  }

  const records = student.attendanceRecords;
  const overallMetrics = computeStudentAttendanceMetrics(records, threshold);

  // 1. Day of Week Breakdown (Monday = 1 through Friday = 5)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayBuckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  records.forEach((r) => {
    const day = new Date(r.session.sessionDate).getDay();
    if (dayBuckets[day]) {
      dayBuckets[day].push(r);
    }
  });

  const dayOfWeekAnalytics = [1, 2, 3, 4, 5].map((d) => {
    const recs = dayBuckets[d] || [];
    const total = recs.length;
    const present = recs.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const absent = recs.filter((r) => r.status === 'ABSENT').length;
    const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    return {
      dayOfWeek: d,
      dayName: dayNames[d],
      totalSessions: total,
      presentCount: present,
      absentCount: absent,
      attendanceRate: rate,
    };
  });

  // 2. Monthly Trends (YYYY-MM)
  const monthMap = new Map();
  records.forEach((r) => {
    const d = new Date(r.session.sessionDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = monthMap.get(key) || { month: key, total: 0, present: 0, absent: 0 };
    cur.total++;
    if (r.status === 'PRESENT' || r.status === 'LATE') cur.present++;
    else if (r.status === 'ABSENT') cur.absent++;
    monthMap.set(key, cur);
  });

  const monthlyTrends = Array.from(monthMap.values())
    .map((m) => ({
      ...m,
      rate: m.total > 0 ? Math.round((m.present / m.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 3. Weekly Trends (Last 8 weeks)
  const weekMap = new Map();
  records.slice(0, 40).forEach((r) => {
    const d = new Date(r.session.sessionDate);
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    const cur = weekMap.get(weekKey) || { week: weekKey, total: 0, present: 0, absent: 0 };
    cur.total++;
    if (r.status === 'PRESENT' || r.status === 'LATE') cur.present++;
    else if (r.status === 'ABSENT') cur.absent++;
    weekMap.set(weekKey, cur);
  });

  const weeklyTrends = Array.from(weekMap.values())
    .map((w) => ({
      ...w,
      rate: w.total > 0 ? Math.round((w.present / w.total) * 1000) / 10 : 0,
    }))
    .slice(-8);

  // 4. Actionable recommendations
  const recommendations = [];
  if (overallMetrics.consecutiveAbsences >= 3) {
    recommendations.push('Immediate home visit or telephone contact required by Class In-charge.');
  }
  if (overallMetrics.attendanceRate < threshold) {
    recommendations.push(
      `Issue standard low-attendance notice to guardian regarding ${threshold}% statutory compliance.`
    );
  }
  const lowDay = dayOfWeekAnalytics.find((d) => d.totalSessions >= 3 && d.attendanceRate < 50);
  if (lowDay) {
    recommendations.push(
      `Inquire regarding repeated absences on ${lowDay.dayName}s (attendance is ${lowDay.attendanceRate}%).`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('Maintain regular encouragement; student has good attendance standing.');
  }

  return {
    student: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      gender: student.gender,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      class: {
        id: student.class.id,
        name: student.class.name,
        section: student.class.section,
        academicYear: student.class.academicYear,
      },
    },
    metrics: overallMetrics,
    dayOfWeekAnalytics,
    monthlyTrends,
    weeklyTrends,
    recommendations,
  };
};

/**
 * Cohort and class-wise attendance comparison summaries
 */
export const getCohortSummaries = async ({ schoolId, startDate, endDate, threshold = 75 }) => {
  const sessionDateFilter = {};
  if (startDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    sessionDateFilter.gte = s;
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    sessionDateFilter.lte = e;
  }

  const recordWhere = Object.keys(sessionDateFilter).length > 0
    ? { sessionDate: sessionDateFilter }
    : undefined;

  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
      students: {
        where: { active: true },
        select: { id: true },
      },
      attendanceSessions: {
        where: recordWhere,
        include: {
          attendanceRecords: {
            select: { status: true, studentId: true },
          },
        },
      },
    },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
  });

  const classComparisons = classes.map((cls) => {
    let present = 0;
    let late = 0;
    let absent = 0;
    const studentRecordMap = new Map();

    cls.attendanceSessions.forEach((sess) => {
      sess.attendanceRecords.forEach((rec) => {
        if (rec.status === 'PRESENT') present++;
        else if (rec.status === 'LATE') late++;
        else if (rec.status === 'ABSENT') absent++;

        const studentRecs = studentRecordMap.get(rec.studentId) || [];
        studentRecs.push(rec.status);
        studentRecordMap.set(rec.studentId, studentRecs);
      });
    });

    const totalMarked = present + late + absent;
    const rate = totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 1000) / 10 : 0;

    // Count students below threshold in this class
    let belowThresholdCount = 0;
    cls.students.forEach((s) => {
      const recs = studentRecordMap.get(s.id) || [];
      if (recs.length > 0) {
        const studentPresent = recs.filter((st) => st === 'PRESENT' || st === 'LATE').length;
        const studentRate = (studentPresent / recs.length) * 100;
        if (studentRate < threshold) belowThresholdCount++;
      }
    });

    let performanceTier = 'MODERATE';
    if (rate >= 85) performanceTier = 'HIGH';
    else if (rate < threshold) performanceTier = 'LOW';

    return {
      classId: cls.id,
      className: `${cls.name}-${cls.section}`,
      totalEnrolled: cls.students.length,
      totalSessions: cls.attendanceSessions.length,
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      attendanceRate: rate,
      belowThresholdCount,
      performanceTier,
    };
  });

  // Sort by attendance rate descending
  classComparisons.sort((a, b) => b.attendanceRate - a.attendanceRate);

  return {
    totalClasses: classes.length,
    threshold,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    classComparisons,
  };
};


