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

