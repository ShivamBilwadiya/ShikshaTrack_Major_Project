import * as rolloverService from '../services/financialRolloverService.js';

/**
 * GET /api/v1/fees/rollover/years
 */
export const getAvailableYears = async (req, res) => {
  try {
    const years = await rolloverService.getAvailableFinancialYears(req.user.schoolId);
    return res.json({
      success: true,
      data: years,
    });
  } catch (err) {
    console.error('Error in getAvailableYears:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve available financial years.',
    });
  }
};

/**
 * GET /api/v1/fees/rollover/overview
 */
export const getYearOverview = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const overview = await rolloverService.getFinancialYearOverview({
      schoolId: req.user.schoolId,
      academicYear,
    });

    return res.json({
      success: true,
      data: overview,
    });
  } catch (err) {
    console.error('Error in getYearOverview:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve financial overview.',
    });
  }
};

/**
 * POST /api/v1/fees/rollover/preview
 */
export const previewRollover = async (req, res) => {
  try {
    const { sourceYear, targetYear } = req.body;
    const preview = await rolloverService.previewRollover({
      schoolId: req.user.schoolId,
      sourceYear,
      targetYear,
    });

    return res.json({
      success: true,
      data: preview,
    });
  } catch (err) {
    console.error('Error in previewRollover:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to preview financial rollover.',
    });
  }
};

/**
 * POST /api/v1/fees/rollover/archive
 */
export const archiveYear = async (req, res) => {
  try {
    const { academicYear, notes } = req.body;
    const archive = await rolloverService.archiveFinancialYear({
      schoolId: req.user.schoolId,
      adminUserId: req.user.id,
      academicYear,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: `Academic year ${academicYear} financial records archived successfully.`,
      data: archive,
    });
  } catch (err) {
    console.error('Error in archiveYear:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to archive financial year.',
    });
  }
};

/**
 * POST /api/v1/fees/rollover/copy-structures
 */
export const copyStructures = async (req, res) => {
  try {
    const { sourceYear, targetYear, structureIds } = req.body;
    const result = await rolloverService.copyFeeStructuresToNewYear({
      schoolId: req.user.schoolId,
      adminUserId: req.user.id,
      sourceYear,
      targetYear,
      structureIds,
    });

    return res.json({
      success: true,
      message: `Successfully cloned ${result.copiedCount} fee structures to academic year ${targetYear}.`,
      data: result,
    });
  } catch (err) {
    console.error('Error in copyStructures:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to copy fee structures.',
    });
  }
};

/**
 * GET /api/v1/fees/rollover/archives
 */
export const getArchives = async (req, res) => {
  try {
    const archives = await rolloverService.listFinancialArchives(req.user.schoolId);
    return res.json({
      success: true,
      data: archives,
    });
  } catch (err) {
    console.error('Error in getArchives:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve archives list.',
    });
  }
};
