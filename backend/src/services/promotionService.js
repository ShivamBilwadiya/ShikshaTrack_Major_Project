import prisma from '../config/db.js';

/**
 * Get available classes and academic years for promotion mapping
 */
export const getClassPromotionStructure = async (schoolId) => {
  const classes = await prisma.class.findMany({
    where: { schoolId },
    orderBy: [{ academicYear: 'desc' }, { name: 'asc' }, { section: 'asc' }],
    include: {
      _count: {
        select: {
          students: { where: { active: true } },
        },
      },
    },
  });

  const academicYears = Array.from(new Set(classes.map((c) => c.academicYear))).filter(Boolean);

  return {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      academicYear: c.academicYear,
      displayName: `${c.name} - ${c.section} (${c.academicYear})`,
      activeStudentsCount: c._count.students,
    })),
    academicYears,
  };
};

/**
 * Preview students eligible for promotion between classes
 */
export const previewPromotion = async ({ schoolId, sourceClassId, targetClassId = null }) => {
  if (!sourceClassId) {
    throw new Error('Source class ID is required for promotion preview.');
  }

  const sourceClass = await prisma.class.findFirst({
    where: { id: sourceClassId, schoolId },
  });

  if (!sourceClass) {
    throw new Error('Source class not found in this institution.');
  }

  let targetClass = null;
  if (targetClassId && targetClassId !== 'GRADUATE') {
    if (targetClassId === sourceClassId) {
      throw new Error('Destination class cannot be identical to source class.');
    }

    targetClass = await prisma.class.findFirst({
      where: { id: targetClassId, schoolId },
    });

    if (!targetClass) {
      throw new Error('Destination class not found in this institution.');
    }
  }

  // Active students in source class
  const students = await prisma.student.findMany({
    where: { classId: sourceClassId, schoolId, active: true },
    orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      admissionNumber: true,
      rollNumber: true,
      gender: true,
      guardianName: true,
      active: true,
    },
  });

  const isFinalYearClass =
    /class\s*(10|12|x|xii)/i.test(sourceClass.name) ||
    !targetClassId ||
    targetClassId === 'GRADUATE';

  return {
    sourceClass: {
      id: sourceClass.id,
      name: sourceClass.name,
      section: sourceClass.section,
      academicYear: sourceClass.academicYear,
      displayName: `${sourceClass.name}-${sourceClass.section} (${sourceClass.academicYear})`,
    },
    targetClass: targetClass
      ? {
          id: targetClass.id,
          name: targetClass.name,
          section: targetClass.section,
          academicYear: targetClass.academicYear,
          displayName: `${targetClass.name}-${targetClass.section} (${targetClass.academicYear})`,
        }
      : null,
    isGraduation: targetClassId === 'GRADUATE' || (!targetClass && isFinalYearClass),
    eligibleCount: students.length,
    students,
  };
};

/**
 * Validate promotion mappings before batch execution
 */
export const validatePromotionMapping = async ({ schoolId, mappings = [] }) => {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('At least one promotion mapping must be supplied.');
  }

  const errors = [];
  const validated = [];

  for (let i = 0; i < mappings.length; i++) {
    const { sourceClassId, targetClassId, action = 'PROMOTE' } = mappings[i];

    if (!sourceClassId) {
      errors.push(`Mapping #${i + 1}: Source class ID is missing.`);
      continue;
    }

    if (action === 'PROMOTE') {
      if (!targetClassId) {
        errors.push(`Mapping #${i + 1}: Destination class ID is required for promotion.`);
        continue;
      }

      if (sourceClassId === targetClassId) {
        errors.push(`Mapping #${i + 1}: Source and destination classes cannot be the same.`);
        continue;
      }
    }

    const sourceClass = await prisma.class.findFirst({
      where: { id: sourceClassId, schoolId },
    });

    if (!sourceClass) {
      errors.push(`Mapping #${i + 1}: Source class not found.`);
      continue;
    }

    let targetClass = null;
    if (action === 'PROMOTE' && targetClassId) {
      targetClass = await prisma.class.findFirst({
        where: { id: targetClassId, schoolId },
      });
      if (!targetClass) {
        errors.push(`Mapping #${i + 1}: Destination class not found.`);
        continue;
      }
    }

    validated.push({
      sourceClassId,
      sourceClassName: `${sourceClass.name}-${sourceClass.section} (${sourceClass.academicYear})`,
      targetClassId: targetClass ? targetClass.id : null,
      targetClassName: targetClass
        ? `${targetClass.name}-${targetClass.section} (${targetClass.academicYear})`
        : 'Graduated / Final Year Exit',
      action,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedMappings: validated,
  };
};

/**
 * Execute transactional student promotion and academic year rollover
 */
export const executeBulkPromotion = async ({
  schoolId,
  adminUserId,
  promotions = [],
  reason = 'Annual Academic Rollover',
}) => {
  if (!Array.isArray(promotions) || promotions.length === 0) {
    throw new Error('At least one promotion instruction must be provided.');
  }

  let totalPromoted = 0;
  let totalGraduated = 0;
  const processedStudentIds = new Set();
  const summaryDetails = [];

  await prisma.$transaction(async (tx) => {
    for (const batch of promotions) {
      const { sourceClassId, targetClassId, studentIds = [], action = 'PROMOTE' } = batch;

      if (!sourceClassId) {
        throw new Error('Invalid instruction: sourceClassId is required.');
      }

      if (action === 'PROMOTE') {
        if (!targetClassId || targetClassId === sourceClassId) {
          throw new Error('Promotion requires a valid, distinct destination class.');
        }

        const targetClass = await tx.class.findFirst({
          where: { id: targetClassId, schoolId },
        });

        if (!targetClass) {
          throw new Error('Destination class does not exist in this institution.');
        }
      }

      // Verify source class
      const sourceClass = await tx.class.findFirst({
        where: { id: sourceClassId, schoolId },
      });

      if (!sourceClass) {
        throw new Error('Source class does not exist in this institution.');
      }

      // If studentIds is empty, default to all active students in source class
      let studentsToProcess = [];
      if (Array.isArray(studentIds) && studentIds.length > 0) {
        studentsToProcess = await tx.student.findMany({
          where: {
            id: { in: studentIds },
            classId: sourceClassId,
            schoolId,
          },
          select: { id: true, name: true, admissionNumber: true, classId: true, active: true },
        });
      } else {
        studentsToProcess = await tx.student.findMany({
          where: {
            classId: sourceClassId,
            schoolId,
            active: true,
          },
          select: { id: true, name: true, admissionNumber: true, classId: true, active: true },
        });
      }

      for (const st of studentsToProcess) {
        // Prevent duplicate promotion within the same execution batch
        if (processedStudentIds.has(st.id)) {
          continue;
        }
        processedStudentIds.add(st.id);

        if (action === 'PROMOTE') {
          // Guard against redundant promotion
          if (st.classId === targetClassId) {
            continue;
          }

          await tx.student.update({
            where: { id: st.id },
            data: { classId: targetClassId },
          });

          await tx.auditLog.create({
            data: {
              actorId: adminUserId,
              action: 'STUDENT_PROMOTED',
              entityType: 'Student',
              entityId: st.id,
              previousValue: JSON.stringify({ classId: sourceClassId }),
              newValue: JSON.stringify({ classId: targetClassId }),
              reason: `${reason} - Promoted to class ${targetClassId}`,
            },
          });

          totalPromoted++;
          summaryDetails.push({
            studentId: st.id,
            name: st.name,
            admissionNumber: st.admissionNumber,
            fromClassId: sourceClassId,
            toClassId: targetClassId,
            status: 'PROMOTED',
          });
        } else if (action === 'GRADUATE') {
          // Deactivate student record to mark academic program completion
          await tx.student.update({
            where: { id: st.id },
            data: { active: false },
          });

          await tx.auditLog.create({
            data: {
              actorId: adminUserId,
              action: 'STUDENT_GRADUATED',
              entityType: 'Student',
              entityId: st.id,
              previousValue: JSON.stringify({ active: true, classId: sourceClassId }),
              newValue: JSON.stringify({ active: false, classId: sourceClassId }),
              reason: `${reason} - Academic Graduation`,
            },
          });

          totalGraduated++;
          summaryDetails.push({
            studentId: st.id,
            name: st.name,
            admissionNumber: st.admissionNumber,
            fromClassId: sourceClassId,
            toClassId: null,
            status: 'GRADUATED',
          });
        }
      }
    }
  });

  return {
    success: true,
    totalProcessed: totalPromoted + totalGraduated,
    totalPromoted,
    totalGraduated,
    details: summaryDetails,
  };
};
