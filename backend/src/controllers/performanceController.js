import * as performanceService from '../services/performanceService.js';

/**
 * Retrieve academic overview and KPI summary
 * GET /api/v1/performance/overview
 */
export const getOverview = async (req, res) => {
  try {
    const { classId, academicYear } = req.query;
    const overview = await performanceService.getAcademicOverview({
      schoolId: req.user.schoolId,
      classId,
      academicYear,
    });

    return res.json({
      success: true,
      data: overview,
    });
  } catch (err) {
    console.error('Error in getOverview:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve academic overview.',
    });
  }
};

/**
 * Retrieve subject-wise performance analysis
 * GET /api/v1/performance/subjects
 */
export const getSubjects = async (req, res) => {
  try {
    const { classId, examinationId } = req.query;
    const subjects = await performanceService.getSubjectWisePerformance({
      schoolId: req.user.schoolId,
      classId,
      examinationId,
    });

    return res.json({
      success: true,
      data: subjects,
    });
  } catch (err) {
    console.error('Error in getSubjects:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve subject-wise performance.',
    });
  }
};

/**
 * Retrieve examination-to-examination performance trends
 * GET /api/v1/performance/trends
 */
export const getTrends = async (req, res) => {
  try {
    const { studentId, classId } = req.query;
    const trends = await performanceService.getStudentPerformanceTrends({
      schoolId: req.user.schoolId,
      studentId,
      classId,
    });

    return res.json({
      success: true,
      data: trends,
    });
  } catch (err) {
    console.error('Error in getTrends:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve performance trends.',
    });
  }
};

/**
 * Retrieve class-wise academic benchmark comparisons
 * GET /api/v1/performance/classes
 */
export const getClassComparisons = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const comparisons = await performanceService.getClassComparisons({
      schoolId: req.user.schoolId,
      academicYear,
    });

    return res.json({
      success: true,
      data: comparisons,
    });
  } catch (err) {
    console.error('Error in getClassComparisons:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve class comparisons.',
    });
  }
};

/**
 * Identify students at-risk of academic failure or exhibiting declining trends
 * GET /api/v1/performance/at-risk
 */
export const getAtRisk = async (req, res) => {
  try {
    const { classId, thresholdPercentage, attendanceThreshold, search, page, limit } = req.query;
    const atRisk = await performanceService.getAtRiskStudents({
      schoolId: req.user.schoolId,
      classId,
      thresholdPercentage: thresholdPercentage ? Number(thresholdPercentage) : 40,
      attendanceThreshold: attendanceThreshold ? Number(attendanceThreshold) : 75,
      search,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: atRisk,
    });
  } catch (err) {
    console.error('Error in getAtRisk:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve at-risk students.',
    });
  }
};

/**
 * Retrieve attendance vs academic score correlation metrics
 * GET /api/v1/performance/correlation
 */
export const getCorrelation = async (req, res) => {
  try {
    const { classId } = req.query;
    const correlation = await performanceService.getAttendancePerformanceCorrelation({
      schoolId: req.user.schoolId,
      classId,
    });

    return res.json({
      success: true,
      data: correlation,
    });
  } catch (err) {
    console.error('Error in getCorrelation:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve correlation metrics.',
    });
  }
};

/**
 * Retrieve individual student performance drilldown
 * GET /api/v1/performance/students/:id
 */
export const getStudentDrilldown = async (req, res) => {
  try {
    const { id } = req.params;
    const drilldown = await performanceService.getStudentPerformanceDrilldown({
      schoolId: req.user.schoolId,
      studentId: id,
      userRole: req.user.role,
      userId: req.user.id,
    });

    return res.json({
      success: true,
      data: drilldown,
    });
  } catch (err) {
    console.error('Error in getStudentDrilldown:', err);
    return res.status(err.message.includes('Unauthorized') ? 403 : 404).json({
      success: false,
      message: err.message || 'Failed to retrieve student performance drilldown.',
    });
  }
};

/**
 * Create a new academic intervention record
 * POST /api/v1/performance/interventions
 */
export const createIntervention = async (req, res) => {
  try {
    const {
      studentId,
      assignedToId,
      type,
      severity,
      title,
      description,
      subject,
      actionPlan,
      baselinePercentage,
      targetPercentage,
      baselineAttendance,
      followUpDate,
    } = req.body;

    const intervention = await performanceService.createIntervention({
      schoolId: req.user.schoolId,
      teacherId: req.user.id,
      studentId,
      assignedToId,
      type,
      severity,
      title,
      description,
      subject,
      actionPlan,
      baselinePercentage,
      targetPercentage,
      baselineAttendance,
      followUpDate,
    });

    return res.status(201).json({
      success: true,
      message: 'Academic intervention created successfully.',
      data: intervention,
    });
  } catch (err) {
    console.error('Error in createIntervention:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create intervention.',
    });
  }
};

/**
 * Retrieve paginated interventions list
 * GET /api/v1/performance/interventions
 */
export const getInterventions = async (req, res) => {
  try {
    const { studentId, classId, status, severity, page, limit } = req.query;
    const result = await performanceService.getInterventions({
      schoolId: req.user.schoolId,
      studentId,
      classId,
      status,
      severity,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in getInterventions:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve interventions.',
    });
  }
};

/**
 * Update intervention details or progress
 * PUT /api/v1/performance/interventions/:id
 */
export const updateIntervention = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await performanceService.updateIntervention({
      interventionId: id,
      schoolId: req.user.schoolId,
      userId: req.user.id,
      ...req.body,
    });

    return res.json({
      success: true,
      message: 'Intervention updated successfully.',
      data: updated,
    });
  } catch (err) {
    console.error('Error in updateIntervention:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to update intervention.',
    });
  }
};

/**
 * Resolve an academic intervention
 * POST /api/v1/performance/interventions/:id/resolve
 */
export const resolveIntervention = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, currentPercentage } = req.body;

    const resolved = await performanceService.resolveIntervention({
      interventionId: id,
      schoolId: req.user.schoolId,
      resolvedById: req.user.id,
      resolutionNotes,
      currentPercentage,
    });

    return res.json({
      success: true,
      message: 'Intervention marked as resolved.',
      data: resolved,
    });
  } catch (err) {
    console.error('Error in resolveIntervention:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to resolve intervention.',
    });
  }
};

/**
 * Add progress note to intervention
 * POST /api/v1/performance/interventions/:id/notes
 */
export const addInterventionNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, progressMetric } = req.body;

    const createdNote = await performanceService.addInterventionNote({
      interventionId: id,
      schoolId: req.user.schoolId,
      authorId: req.user.id,
      note,
      progressMetric,
    });

    return res.status(201).json({
      success: true,
      message: 'Intervention progress note added.',
      data: createdNote,
    });
  } catch (err) {
    console.error('Error in addInterventionNote:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to add intervention note.',
    });
  }
};

/**
 * Export CSV report of student academic performance
 * GET /api/v1/performance/export
 */
export const exportReportCsv = async (req, res) => {
  try {
    const { classId, examinationId } = req.query;
    const csvData = await performanceService.exportPerformanceReportCsv({
      schoolId: req.user.schoolId,
      classId,
      examinationId,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="student_performance_report_${Date.now()}.csv"`
    );
    return res.send(csvData);
  } catch (err) {
    console.error('Error in exportReportCsv:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to export CSV report.',
    });
  }
};
