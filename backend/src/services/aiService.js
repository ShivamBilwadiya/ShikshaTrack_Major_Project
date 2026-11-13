import { config } from '../config/env.js';
import prisma from '../config/db.js';
import { getLowAttendanceStudents, getDailyReport, getMonthlyReport } from './reportService.js';
import { getAdminDashboardStats, detectAttendanceAnomalies } from './analyticsService.js';

/**
 * FEATURE A: Generate AI Attendance Insights from aggregated statistics
 */
export const generateAttendanceInsights = async (schoolId) => {
  const stats = await getAdminDashboardStats(schoolId);
  const anomalies = await detectAttendanceAnomalies(schoolId);

  // Prepare safe, anonymized aggregate summary
  const summaryPayload = {
    totalStudents: stats.overview.totalStudents,
    todayAttendanceRate: stats.overview.todayAttendanceRate,
    classRates: stats.classBreakdown.map((c) => ({
      class: c.className,
      rate: `${c.rate}%`,
      present: c.present,
      absent: c.absent,
    })),
    trend: stats.trend.slice(-5).map((t) => ({ date: t.date, rate: `${t.rate}%` })),
    anomaliesCount: anomalies.length,
  };

  // If external AI provider configured and key provided
  if (config.aiProvider === 'gemini' && config.aiApiKey) {
    try {
      const response = await callGeminiApi({
        prompt: `You are an expert school administrative advisor in India. Analyze these aggregated school attendance metrics:
${JSON.stringify(summaryPayload, null, 2)}

Provide concise, highly actionable observations (bullet points) for rural school administrators.
Focus on attendance trends, vulnerable classes, and practical interventions.`,
      });
      return {
        provider: 'gemini',
        generatedAt: new Date(),
        insights: response,
      };
    } catch (err) {
      console.warn('[AI Service Warning]: External AI API failed, using intelligent heuristic engine:', err.message);
    }
  }

  // Graceful, intelligent rule-based fallback
  const insights = [];

  // Observation 1: Daily overall attendance
  if (stats.overview.todayAttendanceRate >= 85) {
    insights.push({
      category: 'POSITIVE_TREND',
      title: 'Strong Overall Attendance Today',
      description: `Today's attendance stands at a robust ${stats.overview.todayAttendanceRate}%, indicating good general participation across grades.`,
    });
  } else {
    insights.push({
      category: 'ATTENTION_NEEDED',
      title: 'Below-Average Daily Attendance',
      description: `Today's overall attendance is ${stats.overview.todayAttendanceRate}%. Consider reviewing transport or harvest-related seasonal factors affecting student transit.`,
    });
  }

  // Observation 2: Lowest performing class
  if (stats.classBreakdown.length > 0) {
    const sortedClasses = [...stats.classBreakdown].sort((a, b) => a.rate - b.rate);
    const lowestClass = sortedClasses[0];
    const highestClass = sortedClasses[sortedClasses.length - 1];

    if (lowestClass.rate < 80) {
      insights.push({
        category: 'CLASS_DECLINE',
        title: `Attendance Vulnerability in ${lowestClass.className}`,
        description: `${lowestClass.className} recorded only ${lowestClass.rate}% attendance (${lowestClass.absent} students absent). Needs class-teacher parent outreach.`,
      });
    }

    insights.push({
      category: 'TOP_PERFORMER',
      title: `Highest Attendance in ${highestClass.className}`,
      description: `${highestClass.className} leads the school today with ${highestClass.rate}% attendance. Good peer engagement observed.`,
    });
  }

  // Observation 3: Anomaly detection link
  if (anomalies.length > 0) {
    insights.push({
      category: 'STATISTICAL_ANOMALY',
      title: `${anomalies.length} Attendance Anomalies Flagged`,
      description: `Detected patterns including repeated weekday absences and sudden drops. Review the Anomaly Detection tab for individual student guardian follow-ups.`,
    });
  }

  return {
    provider: 'heuristic-engine (offline/fallback mode)',
    generatedAt: new Date(),
    insights,
    rawMetrics: summaryPayload,
  };
};

/**
 * FEATURE B: "Ask ShikshaTrack" - Safe Natural Language Interface
 * Maps query to safe, predefined, validated database queries.
 * Never executes raw SQL!
 */
export const askShikshaTrack = async ({ query, schoolId }) => {
  const q = query.toLowerCase().trim();

  // Intent 1: Low attendance / below 75%
  if (q.includes('below') || q.includes('under') || q.includes('low attendance') || q.includes('75')) {
    const lowStudents = await getLowAttendanceStudents({ schoolId, threshold: 75 });
    return {
      intent: 'LOW_ATTENDANCE_QUERY',
      query,
      answer: `Found ${lowStudents.count} student(s) with cumulative attendance below 75%. The lowest attendance is recorded for ${
        lowStudents.students[0] ? `${lowStudents.students[0].name} (${lowStudents.students[0].attendanceRate}%)` : 'none'
      }.`,
      data: lowStudents.students.slice(0, 10),
    };
  }

  // Intent 2: Highest attendance class
  if (q.includes('highest') || q.includes('best') || q.includes('top class')) {
    const stats = await getAdminDashboardStats(schoolId);
    if (stats.classBreakdown.length === 0) {
      return {
        intent: 'TOP_CLASS_QUERY',
        query,
        answer: 'No attendance records have been registered for today yet.',
        data: [],
      };
    }
    const topClass = [...stats.classBreakdown].sort((a, b) => b.rate - a.rate)[0];
    return {
      intent: 'TOP_CLASS_QUERY',
      query,
      answer: `${topClass.className} has the highest attendance today at ${topClass.rate}% (${topClass.present} present, ${topClass.absent} absent).`,
      data: topClass,
    };
  }

  // Intent 2b: Lowest attendance class / vulnerability
  if (q.includes('lowest') || q.includes('worst') || q.includes('vulnerable') || q.includes('minimum')) {
    const stats = await getAdminDashboardStats(schoolId);
    if (stats.classBreakdown.length === 0) {
      return {
        intent: 'LOWEST_CLASS_QUERY',
        query,
        answer: 'No attendance records have been registered for today yet.',
        data: [],
      };
    }
    const lowestClass = [...stats.classBreakdown].sort((a, b) => a.rate - b.rate)[0];
    return {
      intent: 'LOWEST_CLASS_QUERY',
      query,
      answer: `${lowestClass.className} recorded the lowest attendance today at ${lowestClass.rate}% (${lowestClass.present} present, ${lowestClass.absent} absent). Needs class-teacher parent outreach.`,
      data: lowestClass,
    };
  }

  // Intent 2c: Late arrivals / tardiness
  if (q.includes('late') || q.includes('tardy') || q.includes('delay')) {
    const stats = await getAdminDashboardStats(schoolId);
    return {
      intent: 'LATE_ARRIVALS_QUERY',
      query,
      answer: `There are ${stats.overview.todayLate} student(s) marked LATE today across the school.`,
      data: {
        todayLate: stats.overview.todayLate,
        todayPresent: stats.overview.todayPresent,
        todayAttendanceRate: stats.overview.todayAttendanceRate,
      },
    };
  }

  // Intent 3: Today's absent count
  if (q.includes('absent today') || q.includes('how many absent') || (q.includes('absent') && q.includes('today'))) {
    const stats = await getAdminDashboardStats(schoolId);
    return {
      intent: 'TODAY_ABSENT_QUERY',
      query,
      answer: `A total of ${stats.overview.todayAbsent} student(s) are recorded absent across all classes today.`,
      data: {
        totalAbsent: stats.overview.todayAbsent,
        totalPresent: stats.overview.todayPresent,
        totalEnrolled: stats.overview.totalStudents,
      },
    };
  }

  // Intent 4: Mid-day meal headcount
  if (q.includes('meal') || q.includes('mdm') || q.includes('food') || q.includes('lunch')) {
    const daily = await getDailyReport({ schoolId });
    return {
      intent: 'MID_DAY_MEAL_QUERY',
      query,
      answer: `Today's eligible Mid-Day Meal (MDM) headcount is ${daily.summary.midDayMealTotalHeadcount} students (combining present and late attendees physically at school).`,
      data: daily.summary,
    };
  }

  // Intent 5: Compare months
  if (q.includes('compare') || q.includes('month') || q.includes('previous')) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const thisMonth = await getMonthlyReport({ schoolId, year: currentYear, month: currentMonth });
    const lastMonth = await getMonthlyReport({ schoolId, year: currentYear, month: currentMonth - 1 });

    return {
      intent: 'MONTH_COMPARISON_QUERY',
      query,
      answer: `This month (${thisMonth.monthName}) has recorded ${thisMonth.totalSessions} class sessions over ${thisMonth.workingDaysRecorded} working days. Previous month had ${lastMonth.totalSessions} sessions over ${lastMonth.workingDaysRecorded} working days.`,
      data: { thisMonth, lastMonth },
    };
  }

  // Default Intent: General Overview Summary
  const stats = await getAdminDashboardStats(schoolId);
  return {
    intent: 'GENERAL_OVERVIEW',
    query,
    answer: `ShikshaTrack School Overview: ${stats.overview.totalStudents} enrolled students across ${stats.overview.totalClasses} classes. Today's overall attendance is ${stats.overview.todayAttendanceRate}% (${stats.overview.todayPresent} present, ${stats.overview.todayAbsent} absent, ${stats.overview.todayLate} late).`,
    data: stats.overview,
  };
};

/**
 * FEATURE C: Comprehensive AI Administrative Report Generator
 */
export const generateAdministrativeReport = async ({ schoolId, date }) => {
  const daily = await getDailyReport({ schoolId, date });
  const anomalies = await detectAttendanceAnomalies(schoolId);
  const lowAttendance = await getLowAttendanceStudents({ schoolId, threshold: 75 });

  const report = {
    title: 'ShikshaTrack Comprehensive School Attendance & Administrative Report',
    date: daily.date,
    generatedAt: new Date().toISOString(),
    executiveSummary: `For date ${daily.date}, the school registered an overall attendance rate of ${daily.summary.overallAttendanceRate}%. Out of ${daily.summary.totalEnrolled} enrolled students, ${daily.summary.totalPresent} were present, ${daily.summary.totalLate} were late, and ${daily.summary.totalAbsent} were absent. A total of ${daily.summary.midDayMealTotalHeadcount} meals were required for the Mid-Day Meal Scheme.`,
    classObservations: daily.classReports.map((c) => ({
      class: c.className,
      enrolled: c.enrolled,
      attendanceRate: `${c.attendanceRate}%`,
      status: c.sessionStatus,
      remark:
        c.attendanceRate >= 85
          ? 'Healthy attendance level.'
          : c.attendanceRate >= 70
          ? 'Moderate attendance; monitor closely.'
          : 'Low attendance; immediate guardian engagement advised.',
    })),
    riskAssessment: {
      criticalAttendanceStudents: lowAttendance.count,
      flaggedAnomalies: anomalies.length,
      sampleAnomalies: anomalies.slice(0, 3).map((a) => `${a.studentName} (${a.className}): ${a.description}`),
    },
    suggestedAdministrativeActions: [
      'Conduct automated SMS or personal telephone outreach to guardians of students absent for 3 consecutive days.',
      'Coordinate with Gram Panchayat education committee regarding harvest-related seasonal absenteeism.',
      'Ensure kitchen staff receives verified Mid-Day Meal attendance headcount by 10:30 AM daily.',
      'Acknowledge and commend the class teacher and students of the highest-attending grade.',
    ],
  };

  return report;
};

/**
 * Optional External Gemini API helper
 */
async function callGeminiApi({ prompt }) {
  const apiKey = config.aiApiKey;
  const model = config.aiModel || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API returned status ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text;
}

