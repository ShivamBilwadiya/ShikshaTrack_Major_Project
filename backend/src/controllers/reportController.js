import * as reportService from '../services/reportService.js';
import { sendSuccess } from '../utils/response.js';

export const getDailyReport = async (req, res, next) => {
  try {
    const { date } = req.query;
    const report = await reportService.getDailyReport({
      schoolId: req.user.schoolId,
      date,
    });
    return sendSuccess(res, 'Daily attendance report retrieved.', report);
  } catch (err) {
    next(err);
  }
};

export const getMonthlyReport = async (req, res, next) => {
  try {
    const { year, month, classId } = req.query;
    const report = await reportService.getMonthlyReport({
      schoolId: req.user.schoolId,
      year,
      month,
      classId,
    });
    return sendSuccess(res, 'Monthly attendance report retrieved.', report);
  } catch (err) {
    next(err);
  }
};

export const getLowAttendance = async (req, res, next) => {
  try {
    const { threshold, classId } = req.query;
    const report = await reportService.getLowAttendanceStudents({
      schoolId: req.user.schoolId,
      threshold: threshold ? parseInt(threshold, 10) : 75,
      classId,
    });
    return sendSuccess(res, 'Low attendance alert list retrieved.', report);
  } catch (err) {
    next(err);
  }
};

export const getMidDayMealReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await reportService.getMidDayMealReport({
      schoolId: req.user.schoolId,
      startDate,
      endDate,
    });
    return sendSuccess(res, 'Mid-Day Meal attendance headcount report retrieved.', report);
  } catch (err) {
    next(err);
  }
};

export const exportDailyCsv = async (req, res, next) => {
  try {
    const { date } = req.query;
    const report = await reportService.getDailyReport({
      schoolId: req.user.schoolId,
      date,
    });

    let csv = 'Class,Enrolled,Status,Teacher,Present,Late,Absent,Unmarked,Attendance Rate,Mid-Day Meals\n';
    report.classReports.forEach((c) => {
      csv += `"${c.className}",${c.enrolled},"${c.sessionStatus}","${c.teacherName || 'N/A'}",${c.present},${c.late},${c.absent},${c.unmarked},"${c.attendanceRate}%",${c.midDayMealCount}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`ShikshaTrack_Daily_Report_${report.date}.csv`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

