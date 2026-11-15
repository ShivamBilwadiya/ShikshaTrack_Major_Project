import prisma from '../config/db.js';

/**
 * Retrieve all academic years present in fee records and archives
 */
export const getAvailableFinancialYears = async (schoolId) => {
  const [structures, fees, archives, classes] = await Promise.all([
    prisma.feeStructure.findMany({
      where: { schoolId },
      select: { academicYear: true },
      distinct: ['academicYear'],
    }),
    prisma.studentFee.findMany({
      where: { schoolId },
      select: { academicYear: true },
      distinct: ['academicYear'],
    }),
    prisma.financialYearArchive.findMany({
      where: { schoolId },
      select: { academicYear: true },
    }),
    prisma.class.findMany({
      where: { schoolId },
      select: { academicYear: true },
      distinct: ['academicYear'],
    }),
  ]);

  const allYears = Array.from(
    new Set([
      ...structures.map((s) => s.academicYear),
      ...fees.map((f) => f.academicYear),
      ...archives.map((a) => a.academicYear),
      ...classes.map((c) => c.academicYear),
      '2026-2027',
      '2027-2028',
    ])
  ).filter(Boolean);

  allYears.sort().reverse();
  return allYears;
};

/**
 * Detailed financial summary for an academic year
 */
export const getFinancialYearOverview = async ({ schoolId, academicYear }) => {
  if (!academicYear) {
    throw new Error('Academic year is required.');
  }

  // 1. Fee structures
  const feeStructures = await prisma.feeStructure.findMany({
    where: { schoolId, academicYear },
    include: {
      class: { select: { id: true, name: true, section: true } },
      _count: { select: { studentFees: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 2. Student fees
  const studentFees = await prisma.studentFee.findMany({
    where: { schoolId, academicYear },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          admissionNumber: true,
          rollNumber: true,
          class: { select: { name: true, section: true } },
        },
      },
      feeStructure: { select: { name: true, category: true } },
    },
  });

  // 3. Payment transactions
  const payments = await prisma.feePayment.findMany({
    where: {
      schoolId,
      studentFee: { academicYear },
      isReversed: false,
    },
    select: {
      id: true,
      amountPaid: true,
      paymentMethod: true,
      paymentDate: true,
    },
  });

  // 4. Archive record check
  const archive = await prisma.financialYearArchive.findUnique({
    where: {
      schoolId_academicYear: { schoolId, academicYear },
    },
    include: {
      archivedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Calculations
  const totalAssessed = Number(studentFees.reduce((acc, f) => acc + (f.netAmount || 0), 0).toFixed(2));
  const totalOriginal = Number(studentFees.reduce((acc, f) => acc + (f.originalAmount || 0), 0).toFixed(2));
  const totalDiscounts = Number(studentFees.reduce((acc, f) => acc + (f.discountAmount || 0), 0).toFixed(2));
  const totalScholarships = Number(studentFees.reduce((acc, f) => acc + (f.scholarshipAmount || 0), 0).toFixed(2));
  const totalCollected = Number(studentFees.reduce((acc, f) => acc + (f.paidAmount || 0), 0).toFixed(2));
  const totalPending = Number(studentFees.reduce((acc, f) => acc + (f.balanceAmount > 0 ? f.balanceAmount : 0), 0).toFixed(2));
  const collectionRate = totalAssessed > 0 ? Number(((totalCollected / totalAssessed) * 100).toFixed(1)) : 0;

  // Students with dues
  const studentsWithDues = studentFees
    .filter((f) => f.balanceAmount > 0)
    .map((f) => ({
      studentFeeId: f.id,
      studentId: f.student.id,
      studentName: f.student.name,
      admissionNumber: f.student.admissionNumber,
      className: f.student.class ? `${f.student.class.name}-${f.student.class.section}` : 'N/A',
      feeStructureName: f.feeStructure.name,
      netAmount: f.netAmount,
      paidAmount: f.paidAmount,
      balanceAmount: f.balanceAmount,
      status: f.status,
    }));

  // Group by category
  const categoryTotals = {};
  for (const st of feeStructures) {
    if (!categoryTotals[st.category]) {
      categoryTotals[st.category] = { count: 0, baseAmount: 0 };
    }
    categoryTotals[st.category].count++;
    categoryTotals[st.category].baseAmount += st.totalAmount;
  }

  return {
    academicYear,
    isArchived: Boolean(archive),
    archiveDetails: archive,
    metrics: {
      totalAssessed,
      totalOriginal,
      totalDiscounts,
      totalScholarships,
      totalCollected,
      totalPending,
      collectionRate,
      totalStudentsEnrolled: new Set(studentFees.map((f) => f.studentId)).size,
      feeStructureCount: feeStructures.length,
      paymentTransactionsCount: payments.length,
      studentsWithDuesCount: studentsWithDues.length,
    },
    categoryTotals,
    feeStructures,
    studentsWithDues: studentsWithDues.slice(0, 100), // top 100 with dues
  };
};

/**
 * Preview academic year rollover and fee structure cloning
 */
export const previewRollover = async ({ schoolId, sourceYear, targetYear }) => {
  if (!sourceYear || !targetYear) {
    throw new Error('Both source and target academic years are required.');
  }

  if (sourceYear === targetYear) {
    throw new Error('Target academic year must be distinct from source year.');
  }

  // 1. Source year financial overview
  const sourceOverview = await getFinancialYearOverview({ schoolId, academicYear: sourceYear });

  // 2. Existing fee structures in target year
  const existingTargetStructures = await prisma.feeStructure.findMany({
    where: { schoolId, academicYear: targetYear },
    include: {
      class: { select: { name: true, section: true } },
    },
  });

  // 3. Propose copied structures
  const proposedCopies = sourceOverview.feeStructures.map((st) => {
    // Replace year in name if present
    const updatedName = st.name.includes(sourceYear)
      ? st.name.replace(sourceYear, targetYear)
      : `${st.name} (${targetYear})`;

    return {
      sourceId: st.id,
      name: updatedName,
      category: st.category,
      totalAmount: st.totalAmount,
      frequency: st.frequency,
      isOptional: st.isOptional,
      description: st.description,
      classId: st.classId,
      className: st.class ? `${st.class.name}-${st.class.section}` : 'Institution-wide',
    };
  });

  return {
    sourceYear,
    targetYear,
    sourceOverview: {
      isArchived: sourceOverview.isArchived,
      totalAssessed: sourceOverview.metrics.totalAssessed,
      totalCollected: sourceOverview.metrics.totalCollected,
      totalPending: sourceOverview.metrics.totalPending,
      collectionRate: sourceOverview.metrics.collectionRate,
      studentsWithDuesCount: sourceOverview.metrics.studentsWithDuesCount,
    },
    targetYearStatus: {
      alreadyConfiguredCount: existingTargetStructures.length,
      existingStructures: existingTargetStructures,
    },
    proposedCopies,
    validationWarnings: [
      ...(sourceOverview.metrics.totalPending > 0
        ? [
            `Notice: ${sourceOverview.metrics.studentsWithDuesCount} students have outstanding fee dues (₹${sourceOverview.metrics.totalPending}) in ${sourceYear}. Historical payment and ledger records will be strictly preserved.`,
          ]
        : []),
      ...(existingTargetStructures.length > 0
        ? [
            `Target year ${targetYear} already has ${existingTargetStructures.length} fee structures configured. Rollover will append new structures without altering existing ones.`,
          ]
        : []),
    ],
  };
};

/**
 * Archive completed academic financial year and seal summary snapshot
 */
export const archiveFinancialYear = async ({ schoolId, adminUserId, academicYear, notes = '' }) => {
  if (!academicYear) {
    throw new Error('Academic year is required.');
  }

  // 1. Check if already archived
  const existingArchive = await prisma.financialYearArchive.findUnique({
    where: {
      schoolId_academicYear: { schoolId, academicYear },
    },
  });

  if (existingArchive) {
    throw new Error(
      `Academic year ${academicYear} has already been archived on ${new Date(
        existingArchive.createdAt
      ).toLocaleDateString()}. Duplicate archival is prohibited.`
    );
  }

  // 2. Gather full financial snapshot
  const overview = await getFinancialYearOverview({ schoolId, academicYear });

  const summarySnapshot = {
    academicYear,
    archivedAt: new Date().toISOString(),
    metrics: overview.metrics,
    categoryTotals: overview.categoryTotals,
    feeStructures: overview.feeStructures.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      totalAmount: s.totalAmount,
      frequency: s.frequency,
      className: s.class ? `${s.class.name}-${s.class.section}` : null,
    })),
    unpaidStudentCount: overview.metrics.studentsWithDuesCount,
    outstandingDuesAmount: overview.metrics.totalPending,
  };

  const archive = await prisma.$transaction(async (tx) => {
    const created = await tx.financialYearArchive.create({
      data: {
        schoolId,
        academicYear,
        archivedById: adminUserId,
        totalAssessed: overview.metrics.totalAssessed,
        totalCollected: overview.metrics.totalCollected,
        totalPending: overview.metrics.totalPending,
        totalStudents: overview.metrics.totalStudentsEnrolled,
        feeStructureCount: overview.metrics.feeStructureCount,
        paymentCount: overview.metrics.paymentTransactionsCount,
        summarySnapshot,
        notes: notes ? notes.trim() : `Sealed annual financial archive for ${academicYear}`,
      },
      include: {
        archivedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // AuditLog entry
    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        action: 'FINANCIAL_YEAR_ARCHIVED',
        entityType: 'FinancialYearArchive',
        entityId: created.id,
        previousValue: null,
        newValue: JSON.stringify({
          academicYear,
          totalAssessed: overview.metrics.totalAssessed,
          totalCollected: overview.metrics.totalCollected,
          totalPending: overview.metrics.totalPending,
        }),
        reason: `Archived financial records for academic year ${academicYear}`,
      },
    });

    return created;
  });

  return archive;
};

/**
 * Copy fee structures from source academic year to target academic year
 */
export const copyFeeStructuresToNewYear = async ({
  schoolId,
  adminUserId,
  sourceYear,
  targetYear,
  structureIds = null,
}) => {
  if (!sourceYear || !targetYear) {
    throw new Error('Source and target academic years are required.');
  }

  if (sourceYear === targetYear) {
    throw new Error('Destination academic year must be distinct from source year.');
  }

  const where = { schoolId, academicYear: sourceYear };
  if (Array.isArray(structureIds) && structureIds.length > 0) {
    where.id = { in: structureIds };
  }

  const sourceStructures = await prisma.feeStructure.findMany({
    where,
    include: {
      class: true,
    },
  });

  if (sourceStructures.length === 0) {
    throw new Error(`No fee structures found in source academic year ${sourceYear}.`);
  }

  // Pre-load classes in target year to match by name/section
  const targetClasses = await prisma.class.findMany({
    where: { schoolId, academicYear: targetYear },
  });
  const classMap = new Map();
  for (const tc of targetClasses) {
    classMap.set(`${tc.name}_${tc.section}`, tc.id);
  }

  const createdStructures = [];

  await prisma.$transaction(async (tx) => {
    for (const src of sourceStructures) {
      // Find matching class in target year if class-specific
      let mappedClassId = null;
      if (src.class) {
        mappedClassId = classMap.get(`${src.class.name}_${src.class.section}`) || null;
      }

      const updatedName = src.name.includes(sourceYear)
        ? src.name.replace(sourceYear, targetYear)
        : `${src.name} (${targetYear})`;

      // Create new fee structure in target year WITHOUT creating student charges
      const newStructure = await tx.feeStructure.create({
        data: {
          schoolId,
          name: updatedName,
          academicYear: targetYear,
          category: src.category,
          totalAmount: src.totalAmount,
          isOptional: src.isOptional,
          frequency: src.frequency,
          description: src.description,
          classId: mappedClassId,
        },
      });

      createdStructures.push(newStructure);
    }

    // AuditLog entry
    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        action: 'FEE_STRUCTURES_ROLLED_OVER',
        entityType: 'FeeStructure',
        entityId: targetYear,
        previousValue: JSON.stringify({ sourceYear, copiedCount: sourceStructures.length }),
        newValue: JSON.stringify({ targetYear, createdCount: createdStructures.length }),
        reason: `Copied ${createdStructures.length} fee structures from ${sourceYear} to ${targetYear}`,
      },
    });
  });

  return {
    success: true,
    sourceYear,
    targetYear,
    copiedCount: createdStructures.length,
    createdStructures,
  };
};

/**
 * List all archived financial years
 */
export const listFinancialArchives = async (schoolId) => {
  const archives = await prisma.financialYearArchive.findMany({
    where: { schoolId },
    orderBy: { academicYear: 'desc' },
    include: {
      archivedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return archives;
};
