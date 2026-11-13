import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

export const listClasses = async (schoolId) => {
  return await prisma.class.findMany({
    where: { schoolId },
    include: {
      _count: {
        select: {
          students: { where: { active: true } },
          attendanceSessions: true,
        },
      },
      teacherAssignments: {
        include: {
          teacher: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
  });
};

export const getClassById = async (id, schoolId) => {
  const cls = await prisma.class.findFirst({
    where: { id, schoolId },
    include: {
      students: {
        where: { active: true },
        orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
      },
      teacherAssignments: {
        include: {
          teacher: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: { students: true, attendanceSessions: true },
      },
    },
  });

  if (!cls) {
    throw new Error('Class not found.');
  }

  return cls;
};

export const createClass = async ({ name, section, academicYear, schoolId, actorId }) => {
  const existing = await prisma.class.findFirst({
    where: { schoolId, name, section, academicYear },
  });

  if (existing) {
    throw new Error(`Class ${name}-${section} for academic year ${academicYear} already exists.`);
  }

  const cls = await prisma.class.create({
    data: { name, section, academicYear, schoolId },
  });

  await logAudit({
    actorId,
    action: 'CLASS_CREATED',
    entityType: 'Class',
    entityId: cls.id,
    newValue: cls,
  });

  return cls;
};

export const updateClass = async (id, schoolId, { name, section, academicYear, actorId }) => {
  const current = await getClassById(id, schoolId);

  const updated = await prisma.class.update({
    where: { id },
    data: { name, section, academicYear },
  });

  await logAudit({
    actorId,
    action: 'CLASS_UPDATED',
    entityType: 'Class',
    entityId: id,
    previousValue: current,
    newValue: updated,
  });

  return updated;
};

export const deleteClass = async (id, schoolId, actorId) => {
  const current = await getClassById(id, schoolId);

  if (current._count.students > 0) {
    throw new Error('Cannot delete class that contains registered students. Reassign or remove students first.');
  }

  await prisma.class.delete({ where: { id } });

  await logAudit({
    actorId,
    action: 'CLASS_DELETED',
    entityType: 'Class',
    entityId: id,
    previousValue: current,
  });

  return { message: 'Class deleted successfully.' };
};

