import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import prisma from '../config/db.js';
import { sendError } from '../utils/response.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return sendError(res, 'Access denied. No authentication token provided.', 401);
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
              select: {
                studentId: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.active) {
      return sendError(res, 'User session invalid or user account deactivated.', 401);
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      school: user.school,
      assignedClasses: user.teacherAssignments ? user.teacherAssignments.map((ta) => ta.classId) : [],
      teacherAssignments: user.teacherAssignments || [],
      parentId: user.parentProfile?.id || null,
      linkedStudentIds: user.parentProfile?.students?.map((s) => s.studentId) || [],
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Authentication token expired. Please log in again.', 401);
    }
    return sendError(res, 'Invalid authentication token.', 403);
  }
};

