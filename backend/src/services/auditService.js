import prisma from '../config/db.js';

export const logAudit = async ({
  actorId,
  action,
  entityType,
  entityId,
  previousValue = null,
  newValue = null,
  reason = null,
}) => {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        previousValue: previousValue ? JSON.stringify(previousValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        reason,
      },
    });
  } catch (err) {
    console.error('[AuditLog Error]: Failed to create audit log:', err.message);
    // Non-blocking for primary operations
    return null;
  }
};

