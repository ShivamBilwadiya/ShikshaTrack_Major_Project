import prisma from '../config/db.js';

export const getAdminDashboardStats = async (schoolId) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Overall Counts
  const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
    prisma.student.count({ where: { schoolId, active: true } }),
    prisma.user.count({ where: { schoolId, role: 'TEACHER', active: true } }),
    prisma.class.count({ where: { schoolId } }),
  ]);

  // 2. Today's Sessions & Attendance
  const todaySessions = await prisma.attendanceSession.findMany({
    where: {
      class: { schoolId },
      sessionDate: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      class: true,
      attendanceRecords: true,
    },
  });

  let todayPresent = 0;
  let todayLate = 0;
  let todayAbsent = 0;

  todaySessions.forEach((sess) => {
    sess.attendanceRecords.forEach((rec) => {
      if (rec.status === 'PRESENT') todayPresent++;
      else if (rec.status === 'LATE') todayLate++;
      else if (rec.status === 'ABSENT') todayAbsent++;
    });
  });

  const totalMarked = todayPresent + todayLate + todayAbsent;
  const todayUnmarked = Math.max(0, totalStudents - totalMarked);
  const todayAttendanceRate = totalStudents > 0 ? Math.round(((todayPresent + todayLate) / totalStudents) * 100) : 0;

  // 3. Class-wise attendance comparison for today
  const classBreakdown = todaySessions.map((s) => {
    const p = s.attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const l = s.attendanceRecords.filter((r) => r.status === 'LATE').length;
    const a = s.attendanceRecords.filter((r) => r.status === 'ABSENT').length;
    return {
      classId: s.classId,
      className: `${s.class.name}-${s.class.section}`,
      present: p,
      late: l,
      absent: a,
      status: s.status,
      rate: p + l + a > 0 ? Math.round(((p + l) / (p + l + a)) * 100) : 0,
    };
  });

  // 4. Last 7 school days trend
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const pastSessions = await prisma.attendanceSession.findMany({
    where: {
      class: { schoolId },
      sessionDate: { gte: sevenDaysAgo, lte: endOfDay },
    },
    include: {
      attendanceRecords: true,
    },
    orderBy: { sessionDate: 'asc' },
  });

  const trendMap = {};
  pastSessions.forEach((s) => {
    const dStr = s.sessionDate.toISOString().split('T')[0];
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
      todayPresent,
      todayLate,
      todayAbsent,
      todayUnmarked,
      todayAttendanceRate,
    },
    classBreakdown,
    trend,
    recentActivity,
  };
};

export const getTeacherDashboardStats = async (teacherId, schoolId) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

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

  // 2. Today's sessions for this teacher's assigned classes
  const todaySessions = await prisma.attendanceSession.findMany({
    where: {
      classId: { in: classIds },
      sessionDate: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      class: true,
      attendanceRecords: true,
    },
  });

  const sessionStatusList = assignedClasses.map((ac) => {
    const session = todaySessions.find((s) => s.classId === ac.classId);
    if (!session) {
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

    const present = session.attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const late = session.attendanceRecords.filter((r) => r.status === 'LATE').length;
    const absent = session.attendanceRecords.filter((r) => r.status === 'ABSENT').length;

    return {
      classId: ac.classId,
      className: ac.className,
      studentCount: ac.studentCount,
      hasSession: true,
      sessionId: session.id,
      status: session.status,
      markedCount: session.attendanceRecords.length,
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      attendanceRate: ac.studentCount > 0 ? Math.round(((present + late) / ac.studentCount) * 100) : 0,
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

