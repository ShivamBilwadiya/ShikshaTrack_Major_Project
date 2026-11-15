import prisma from '../config/db.js';

/**
 * List institutional users with pagination and filtering
 */
export const listUsers = async ({
  schoolId,
  search = '',
  role = null,
  active = null,
  page = 1,
  limit = 15,
}) => {
  const where = { schoolId };

  if (role) where.role = role;
  if (active !== null && active !== undefined && active !== '') {
    where.active = active === 'true' || active === true;
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Math.min(100, Math.max(1, Number(limit)));

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            auditLogs: true,
            attendanceSessions: true,
          },
        },
      },
    }),
  ]);

  return {
    users,
    total,
    page: Number(page),
    limit: take,
    totalPages: Math.ceil(total / take),
  };
};

/**
 * Toggle user account active status with safety checks
 */
export const updateUserStatus = async ({
  schoolId,
  adminUserId,
  targetUserId,
  active,
  reason = 'Administrative status update',
}) => {
  if (targetUserId === adminUserId) {
    throw new Error('Self-deactivation is prohibited. You cannot deactivate your own account.');
  }

  const user = await prisma.user.findFirst({
    where: { id: targetUserId, schoolId },
  });

  if (!user) {
    throw new Error('Target user not found in this institution.');
  }

  // If deactivating an ADMIN, verify there's at least one other active admin
  if (!active && user.role === 'ADMIN') {
    const activeAdminCount = await prisma.user.count({
      where: {
        schoolId,
        role: 'ADMIN',
        active: true,
      },
    });

    if (activeAdminCount <= 1) {
      throw new Error('Operation blocked: Cannot deactivate the school’s sole active administrator.');
    }
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { active },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: targetUserId,
        previousValue: JSON.stringify({ active: user.active }),
        newValue: JSON.stringify({ active }),
        reason: reason.trim(),
      },
    });

    return updated;
  });

  return updatedUser;
};

/**
 * Retrieve paginated audit logs with search, actor, and date filters
 */
export const getAuditLogs = async ({
  schoolId,
  search = '',
  action = null,
  entityType = null,
  actorId = null,
  startDate = null,
  endDate = null,
  page = 1,
  limit = 20,
}) => {
  const where = {
    actor: { schoolId },
  };

  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (actorId) where.actorId = actorId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = eDate;
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { action: { contains: q, mode: 'insensitive' } },
      { entityType: { contains: q, mode: 'insensitive' } },
      { reason: { contains: q, mode: 'insensitive' } },
      { actor: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Math.min(100, Math.max(1, Number(limit)));

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    logs,
    total,
    page: Number(page),
    limit: take,
    totalPages: Math.ceil(total / take),
  };
};

/**
 * Administrative activity summary metrics
 */
export const getActivitySummary = async (schoolId) => {
  const [totalUsers, activeUsers, inactiveUsers, recentLogsCount, recentLogs] = await Promise.all([
    prisma.user.count({ where: { schoolId } }),
    prisma.user.count({ where: { schoolId, active: true } }),
    prisma.user.count({ where: { schoolId, active: false } }),
    prisma.auditLog.count({
      where: {
        actor: { schoolId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.auditLog.findMany({
      where: { actor: { schoolId } },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, role: true } },
      },
    }),
  ]);

  // Aggregate action counts
  const actionCounts = {};
  for (const log of recentLogs) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  }

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    recentAuditLogs7Days: recentLogsCount,
    actionCounts,
    recentActivities: recentLogs,
  };
};

/**
 * System health check verifying database ping and latency
 */
export const checkSystemHealth = async () => {
  const startTime = Date.now();
  let dbStatus = 'CONNECTED';
  let dbLatencyMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startTime;
  } catch (err) {
    dbStatus = 'DISCONNECTED';
    dbLatencyMs = Date.now() - startTime;
  }

  return {
    status: dbStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };
};
