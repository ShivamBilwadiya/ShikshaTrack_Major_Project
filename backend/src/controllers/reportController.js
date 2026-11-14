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

export const escapeCsvField = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

export const exportDailyCsv = async (req, res, next) => {
  try {
    const { date, startDate, endDate, classId, status, view } = req.query;

    if (view === 'summary') {
      const report = await reportService.getDailyReport({
        schoolId: req.user.schoolId,
        date,
      });

      let csv = 'Class,Enrolled,Status,Teacher,Present,Late,Absent,Unmarked,Attendance Rate,Mid-Day Meals\n';
      report.classReports.forEach((c) => {
        csv += `${escapeCsvField(c.className)},${c.enrolled},${escapeCsvField(c.sessionStatus)},${escapeCsvField(
          c.teacherName || 'N/A'
        )},${c.present},${c.late},${c.absent},${c.unmarked},${escapeCsvField(`${c.attendanceRate}%`)},${c.midDayMealCount}\n`;
      });

      res.header('Content-Type', 'text/csv');
      res.attachment(`ShikshaTrack_Daily_Summary_${report.date}.csv`);
      return res.send(csv);
    }

    // Default: Detailed Student Attendance CSV Export
    const detailedReport = await reportService.getDetailedAttendanceReport({
      schoolId: req.user.schoolId,
      date,
      startDate,
      endDate,
      classId,
      status,
    });

    let csv = '"Student Name","Admission Number","Class","Roll Number","Attendance Date","Attendance Status","Method","Remarks"\n';
    detailedReport.records.forEach((r) => {
      csv += `${escapeCsvField(r.studentName)},${escapeCsvField(r.admissionNumber)},${escapeCsvField(
        r.className
      )},${escapeCsvField(r.rollNumber)},${escapeCsvField(r.attendanceDate)},${escapeCsvField(
        r.status
      )},${escapeCsvField(r.method)},${escapeCsvField(r.remarks)}\n`;
    });

    const fileDate = detailedReport.date || 'Export';
    const filename = `ShikshaTrack_Attendance_${fileDate}${classId ? `_class_${classId}` : ''}${
      status ? `_${status}` : ''
    }.csv`;

    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

export const exportAttendanceCsv = exportDailyCsv;

