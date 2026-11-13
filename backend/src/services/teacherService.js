import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

export const listTeachers = async (schoolId) => {
  return await prisma.user.findMany({
    where: { schoolId, role: 'TEACHER' },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
      teacherAssignments: {
        include: {
          class: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
};

export const getTeacherById = async (id, schoolId) => {
  const teacher = await prisma.user.findFirst({
    where: { id, schoolId, role: 'TEACHER' },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
      teacherAssignments: {
        include: {
          class: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new Error('Teacher not found.');
  }

  return teacher;
};

export const createTeacher = async ({ name, email, password, schoolId, assignedClassIds = [], actorId }) => {
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existing) {
    throw new Error('A user with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(password || 'teacher123', 10);

  const teacher = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'TEACHER',
      schoolId,
      active: true,
      teacherAssignments: {
        create: assignedClassIds.map((classId) => ({
          classId,
        })),
      },
    },
    include: {
      teacherAssignments: {
        include: {
          class: true,
        },
      },
    },
  });

  await logAudit({
    actorId,
    action: 'TEACHER_CREATED',
    entityType: 'User',
    entityId: teacher.id,
    newValue: { id: teacher.id, name: teacher.name, email: teacher.email },
  });

  return teacher;
};

export const updateTeacherAssignments = async (teacherId, schoolId, classIds = [], actorId) => {
  const teacher = await getTeacherById(teacherId, schoolId);

  // Run in transaction: remove old assignments, insert new
  await prisma.$transaction(async (tx) => {
    await tx.teacherAssignment.deleteMany({
      where: { teacherId },
    });

    if (classIds.length > 0) {
      await tx.teacherAssignment.createMany({
        data: classIds.map((classId) => ({
          teacherId,
          classId,
        })),
      });
    }
  });

  await logAudit({
    actorId,
    action: 'TEACHER_ASSIGNMENTS_UPDATED',
    entityType: 'User',
    entityId: teacherId,
    previousValue: teacher.teacherAssignments.map((a) => a.classId),
    newValue: classIds,
  });

  return await getTeacherById(teacherId, schoolId);
};

export const toggleTeacherStatus = async (id, schoolId, actorId) => {
  const teacher = await getTeacherById(id, schoolId);
  const updated = await prisma.user.update({
    where: { id },
    data: { active: !teacher.active },
  });

  await logAudit({
    actorId,
    action: 'TEACHER_STATUS_TOGGLED',
    entityType: 'User',
    entityId: id,
    previousValue: { active: teacher.active },
    newValue: { active: updated.active },
  });

  return updated;
};

