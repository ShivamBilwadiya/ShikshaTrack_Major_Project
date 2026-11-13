import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { config } from '../config/env.js';

export const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      school: true,
      teacherAssignments: {
        include: {
          class: true,
        },
      },
    },
  });

  if (!user || !user.active) {
    throw new Error('Invalid email or password.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password.');
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      school: {
        id: user.school.id,
        name: user.school.name,
        code: user.school.code,
        address: user.school.address,
      },
      assignedClasses: user.teacherAssignments.map((ta) => ({
        assignmentId: ta.id,
        classId: ta.classId,
        className: `${ta.class.name}-${ta.class.section}`,
        isClassTeacher: ta.isClassTeacher,
      })),
    },
  };
};

export const getCurrentUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      schoolId: true,
      active: true,
      createdAt: true,
      school: {
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
      teacherAssignments: {
        include: {
          class: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  return user;
};

