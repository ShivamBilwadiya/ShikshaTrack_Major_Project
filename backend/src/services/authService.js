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
      parentProfile: {
        include: {
          students: {
            include: {
              student: {
                include: {
                  class: true,
                },
              },
            },
          },
        },
      },
      parentProfile: {
        include: {
          students: {
            include: {
              student: {
                include: {
                  class: true,
                },
              },
            },
          },
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
      assignedClasses: user.teacherAssignments ? user.teacherAssignments.map((ta) => ({
        assignmentId: ta.id,
        classId: ta.classId,
        className: `${ta.class.name}-${ta.class.section}`,
        isClassTeacher: ta.isClassTeacher,
      })) : [],
      parentProfile: user.parentProfile ? {
        id: user.parentProfile.id,
        guardianName: user.parentProfile.guardianName,
        relationship: user.parentProfile.relationship,
        phone: user.parentProfile.phone,
        status: user.parentProfile.status,
        children: user.parentProfile.students ? user.parentProfile.students.map((ps) => ({
          studentId: ps.student?.id || ps.studentId,
          name: ps.student?.name || '',
          admissionNumber: ps.student?.admissionNumber || '',
          rollNumber: ps.student?.rollNumber || null,
          className: ps.student?.class ? `${ps.student.class.name}-${ps.student.class.section}` : '',
          relationship: ps.relationship,
          isPrimaryContact: ps.isPrimaryContact,
        })) : [],
      } : null,
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
      parentProfile: {
        include: {
          students: {
            include: {
              student: {
                include: {
                  class: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  return user;
};

