import * as promotionService from '../services/promotionService.js';

/**
 * GET /api/v1/academic/promotion/classes
 */
export const getPromotionClasses = async (req, res) => {
  try {
    const result = await promotionService.getClassPromotionStructure(req.user.schoolId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in getPromotionClasses:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve classes for promotion.',
    });
  }
};

/**
 * POST /api/v1/academic/promotion/preview
 */
export const previewPromotion = async (req, res) => {
  try {
    const { sourceClassId, targetClassId } = req.body;
    const preview = await promotionService.previewPromotion({
      schoolId: req.user.schoolId,
      sourceClassId,
      targetClassId,
    });

    return res.json({
      success: true,
      data: preview,
    });
  } catch (err) {
    console.error('Error in previewPromotion:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to preview promotion.',
    });
  }
};

/**
 * POST /api/v1/academic/promotion/validate-mapping
 */
export const validateMapping = async (req, res) => {
  try {
    const { mappings } = req.body;
    const validation = await promotionService.validatePromotionMapping({
      schoolId: req.user.schoolId,
      mappings,
    });

    return res.json({
      success: true,
      data: validation,
    });
  } catch (err) {
    console.error('Error in validateMapping:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to validate promotion mappings.',
    });
  }
};

/**
 * POST /api/v1/academic/promotion/execute
 */
export const executePromotion = async (req, res) => {
  try {
    const { promotions, reason } = req.body;
    const summary = await promotionService.executeBulkPromotion({
      schoolId: req.user.schoolId,
      adminUserId: req.user.id,
      promotions,
      reason,
    });

    return res.json({
      success: true,
      message: `Successfully processed promotion for ${summary.totalProcessed} students.`,
      data: summary,
    });
  } catch (err) {
    console.error('Error in executePromotion:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to execute bulk promotion.',
    });
  }
};
