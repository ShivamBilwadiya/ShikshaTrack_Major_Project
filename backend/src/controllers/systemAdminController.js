import * as systemAdminService from '../services/systemAdminService.js';

/**
 * GET /api/v1/admin/users
 */
export const getUsers = async (req, res) => {
  try {
    const { search, role, active, page, limit } = req.query;
    const result = await systemAdminService.listUsers({
      schoolId: req.user.schoolId,
      search,
      role,
      active,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in getUsers:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to list users.',
    });
  }
};

/**
 * PATCH /api/v1/admin/users/:id/status
 */
export const setUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active, reason } = req.body;

    if (active === undefined || active === null) {
      return res.status(400).json({
        success: false,
        message: 'Active status (boolean) is required.',
      });
    }

    const updatedUser = await systemAdminService.updateUserStatus({
      schoolId: req.user.schoolId,
      adminUserId: req.user.id,
      targetUserId: id,
      active: Boolean(active),
      reason,
    });

    return res.json({
      success: true,
      message: `User account ${active ? 'activated' : 'deactivated'} successfully.`,
      data: updatedUser,
    });
  } catch (err) {
    console.error('Error in setUserStatus:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to update user status.',
    });
  }
};

/**
 * GET /api/v1/admin/audit-logs
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { search, action, entityType, actorId, startDate, endDate, page, limit } = req.query;
    const result = await systemAdminService.getAuditLogs({
      schoolId: req.user.schoolId,
      search,
      action,
      entityType,
      actorId,
      startDate,
      endDate,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in getAuditLogs:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve audit logs.',
    });
  }
};

/**
 * GET /api/v1/admin/activity-summary
 */
export const getActivitySummary = async (req, res) => {
  try {
    const summary = await systemAdminService.getActivitySummary(req.user.schoolId);
    return res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error('Error in getActivitySummary:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve activity summary.',
    });
  }
};

/**
 * GET /api/v1/admin/health
 */
export const getSystemHealth = async (req, res) => {
  try {
    const health = await systemAdminService.checkSystemHealth();
    return res.json({
      success: true,
      data: health,
    });
  } catch (err) {
    console.error('Error in getSystemHealth:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to inspect system health.',
    });
  }
};
