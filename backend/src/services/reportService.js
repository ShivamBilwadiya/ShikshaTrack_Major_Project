import prisma from '../config/db.js';

/**
 * Daily Attendance Report
 */
export const getDailyReport = async ({ schoolId, date }) => {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get all active classes
  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
      students: { where: { active: true } },
      attendanceSessions: {
        where: {
          sessionDate: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          teacher: { select: { name: true } },
          attendanceRecords: {
            include: { student: true },
          },
        },
      },
    },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
  });

  let totalEnrolled = 0;
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalUnmarked = 0;

  const classReports = classes.map((cls) => {
    const enrolled = cls.students.length;
    totalEnrolled += enrolled;

    const session = cls.attendanceSessions[0] || null;

    if (!session) {
      totalUnmarked += enrolled;
      return {
        classId: cls.id,
        className: `${cls.name}-${cls.section}`,
        enrolled,
        sessionStatus: 'NOT_STARTED',
        teacherName: null,
        present: 0,
        late: 0,
        absent: 0,
        unmarked: enrolled,
        attendanceRate: 0,
        midDayMealCount: 0,
      };
    }

    const present = session.attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const late = session.attendanceRecords.filter((r) => r.status === 'LATE').length;
    const absent = session.attendanceRecords.filter((r) => r.status === 'ABSENT').length;
    const markedTotal = session.attendanceRecords.length;
    const unmarked = Math.max(0, enrolled - markedTotal);

    totalPresent += present;
    totalLate += late;
    totalAbsent += absent;
    totalUnmarked += unmarked;

    const midDayMealCount = present + late; // Present and late students are physically at school
    const attendanceRate = enrolled > 0 ? Math.round(((present + late) / enrolled) * 100) : 0;

    return {
      classId: cls.id,
      className: `${cls.name}-${cls.section}`,
      enrolled,
      sessionId: session.id,
      sessionStatus: session.status,
      teacherName: session.teacher.name,
      present,
      late,
      absent,
      unmarked,
      attendanceRate,
      midDayMealCount,
    };
  });

  const overallRate = totalEnrolled > 0 ? Math.round(((totalPresent + totalLate) / totalEnrolled) * 100) : 0;

  return {
    date: startOfDay.toISOString().split('T')[0],
    summary: {
      totalClasses: classes.length,
      totalEnrolled,
      totalPresent,
      totalLate,
      totalAbsent,
      totalUnmarked,
      overallAttendanceRate: overallRate,
      midDayMealTotalHeadcount: totalPresent + totalLate,
    },
    classReports,
  };
};

/**
 * Monthly Attendance Report
 */
export const getMonthlyReport = async ({ schoolId, year, month, classId = null }) => {
  const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
  const currentMonth = month ? parseInt(month, 10) - 1 : new Date().getMonth();

  const startDate = new Date(currentYear, currentMonth, 1);
  const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

  // Get sessions in this month
  const sessionWhere = {
    class: { schoolId },
    sessionDate: { gte: startDate, lte: endDate },
  };

  if (classId) {
    sessionWhere.classId = classId;
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: sessionWhere,
    include: {
      class: true,
      attendanceRecords: true,
    },
    orderBy: { sessionDate: 'asc' },
  });

  const totalSessions = sessions.length;

  // Aggregate day-by-day stats
  const dailyMap = {};
  sessions.forEach((sess) => {
    const dayKey = sess.sessionDate.toISOString().split('T')[0];
    if (!dailyMap[dayKey]) {
      dailyMap[dayKey] = {
        date: dayKey,
        sessionsCount: 0,
        present: 0,
        late: 0,
        absent: 0,
      };
    }
    dailyMap[dayKey].sessionsCount++;
    sess.attendanceRecords.forEach((rec) => {
      if (rec.status === 'PRESENT') dailyMap[dayKey].present++;
      else if (rec.status === 'LATE') dailyMap[dayKey].late++;
      else if (rec.status === 'ABSENT') dailyMap[dayKey].absent++;
    });
  });

  const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    year: currentYear,
    month: currentMonth + 1,
    monthName: startDate.toLocaleString('default', { month: 'long' }),
    totalSessions,
    workingDaysRecorded: dailyTrend.length,
    dailyTrend,
  };
};

/**
 * Low Attendance Students Alert List (Default threshold < 75%)
 */
export const getLowAttendanceStudents = async ({ schoolId, threshold = 75, classId = null }) => {
  const studentWhere = {
    schoolId,
    active: true,
  };

  if (classId) {
    studentWhere.classId = classId;
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    include: {
      class: true,
      attendanceRecords: {
        select: { status: true },
      },
    },
  });

  const lowAttendanceList = [];

  for (const s of students) {
    const total = s.attendanceRecords.length;
    if (total === 0) continue; // Don't flag new students with 0 records yet

    const present = s.attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const late = s.attendanceRecords.filter((r) => r.status === 'LATE').length;
    const absent = s.attendanceRecords.filter((r) => r.status === 'ABSENT').length;

    const rate = Math.round(((present + late) / total) * 100);

    if (rate < threshold) {
      lowAttendanceList.push({
        id: s.id,
        name: s.name,
        admissionNumber: s.admissionNumber,
        rollNumber: s.rollNumber,
        className: `${s.class.name}-${s.class.section}`,
        guardianName: s.guardianName,
        guardianPhone: s.guardianPhone,
        totalSessions: total,
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        attendanceRate: rate,
        deficitSessions: Math.ceil((threshold * total - 100 * (present + late)) / (100 - threshold)),
      });
    }
  }

  // Sort by lowest attendance rate first
  lowAttendanceList.sort((a, b) => a.attendanceRate - b.attendanceRate);

  return {
    threshold,
    count: lowAttendanceList.length,
    students: lowAttendanceList,
  };
};

/**
 * Mid-Day Meal (MDM) Headcount Report for Rural Schools
 */
export const getMidDayMealReport = async ({ schoolId, startDate, endDate }) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 86400000);
  start.setHours(0, 0, 0, 0);

  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      class: { schoolId },
      sessionDate: { gte: start, lte: end },
    },
    include: {
      class: true,
      attendanceRecords: {
        where: { status: { in: ['PRESENT', 'LATE'] } },
      },
    },
    orderBy: { sessionDate: 'asc' },
  });

  const dateMap = {};

  sessions.forEach((sess) => {
    const dayKey = sess.sessionDate.toISOString().split('T')[0];
    if (!dateMap[dayKey]) {
      dateMap[dayKey] = {
        date: dayKey,
        totalMealCount: 0,
        classBreakdown: {},
      };
    }
    const count = sess.attendanceRecords.length;
    dateMap[dayKey].totalMealCount += count;
    dateMap[dayKey].classBreakdown[`${sess.class.name}-${sess.class.section}`] = count;
  });

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    report: Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
  };
};

/**
 * Detailed Attendance Export Data (Student-level attendance records)
 */
export const getDetailedAttendanceReport = async ({
  schoolId,
  date,
  startDate,
  endDate,
  classId = null,
  status = null,
}) => {
  let rangeStart;
  let rangeEnd;

  if (startDate || endDate) {
    rangeStart = startDate ? new Date(startDate) : new Date('2000-01-01');
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = endDate ? new Date(endDate) : new Date();
    rangeEnd.setHours(23, 59, 59, 999);
  } else {
    const targetDate = date ? new Date(date) : new Date();
    rangeStart = new Date(targetDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(targetDate);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const sessionWhere = {
    class: { schoolId },
    sessionDate: { gte: rangeStart, lte: rangeEnd },
  };

  if (classId) {
    sessionWhere.classId = classId;
  }

  const recordWhere = {};
  if (status) {
    recordWhere.status = status.toUpperCase();
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: sessionWhere,
    include: {
      class: true,
      teacher: { select: { name: true } },
      attendanceRecords: {
        where: Object.keys(recordWhere).length > 0 ? recordWhere : undefined,
        include: {
          student: true,
        },
        orderBy: [{ student: { rollNumber: 'asc' } }, { student: { name: 'asc' } }],
      },
    },
    orderBy: [{ sessionDate: 'asc' }, { class: { name: 'asc' } }],
  });

  const records = [];
  sessions.forEach((sess) => {
    const dateStr = sess.sessionDate.toISOString().split('T')[0];
    const className = `${sess.class.name}-${sess.class.section}`;

    sess.attendanceRecords.forEach((rec) => {
      records.push({
        studentName: rec.student.name,
        admissionNumber: rec.student.admissionNumber,
        className,
        rollNumber: rec.student.rollNumber || 'N/A',
        attendanceDate: dateStr,
        status: rec.status,
        method: rec.method,
        remarks: rec.remarks || '',
        teacherName: sess.teacher.name,
      });
    });
  });

  return {
    date: rangeStart.toISOString().split('T')[0],
    startDate: rangeStart.toISOString().split('T')[0],
    endDate: rangeEnd.toISOString().split('T')[0],
    classId,
    status,
    totalRecords: records.length,
    records,
  };
};

