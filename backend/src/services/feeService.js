import prisma from '../config/db.js';

export const FEE_CATEGORIES = ['TUITION', 'TRANSPORT', 'EXAMINATION', 'LIBRARY', 'DEVELOPMENT', 'OTHER'];
export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER'];
export const PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'];

/**
 * Audit log helper
 */
const logAudit = async ({ actorId, action, entityType, entityId, previousValue, newValue, reason }) => {
  try {
    await prisma.auditLog.create({
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
    console.error('Failed to log fee audit:', err.message);
  }
};

/**
 * 1. Fee Structure Management
 */
export const createFeeStructure = async ({
  schoolId,
  classId = null,
  name,
  academicYear,
  category = 'TUITION',
  totalAmount,
  isOptional = false,
  frequency = 'ANNUAL',
  description = null,
  userId = null,
}) => {
  if (!name || !name.trim()) throw new Error('Fee structure name is required.');
  if (!academicYear) throw new Error('Academic year is required.');
  const parsedAmount = parseFloat(totalAmount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Total amount must be a positive number greater than 0.');
  }
  if (!FEE_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category "${category}". Allowed: ${FEE_CATEGORIES.join(', ')}`);
  }

  const structure = await prisma.feeStructure.create({
    data: {
      schoolId,
      classId: classId || null,
      name: name.trim(),
      academicYear: academicYear.trim(),
      category,
      totalAmount: parsedAmount,
      isOptional: Boolean(isOptional),
      frequency,
      description: description ? description.trim() : null,
    },
    include: {
      class: { select: { id: true, name: true, section: true } },
    },
  });

  await logAudit({
    actorId: userId,
    action: 'FEE_STRUCTURE_CREATED',
    entityType: 'FeeStructure',
    entityId: structure.id,
    newValue: { name: structure.name, amount: structure.totalAmount },
    reason: `Fee structure ${structure.name} created`,
  });

  return structure;
};

export const listFeeStructures = async ({ schoolId, classId, academicYear, category }) => {
  const where = { schoolId };
  if (classId) where.classId = classId;
  if (academicYear) where.academicYear = academicYear;
  if (category) where.category = category;

  const structures = await prisma.feeStructure.findMany({
    where,
    orderBy: [{ academicYear: 'desc' }, { name: 'asc' }],
    include: {
      class: { select: { id: true, name: true, section: true } },
      _count: { select: { studentFees: true } },
    },
  });

  return structures;
};

export const updateFeeStructure = async (id, schoolId, data, userId = null) => {
  const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId } });
  if (!existing) throw new Error('Fee structure not found.');

  const updatePayload = {};
  if (data.name) updatePayload.name = data.name.trim();
  if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;
  if (data.category && FEE_CATEGORIES.includes(data.category)) updatePayload.category = data.category;
  if (data.isOptional !== undefined) updatePayload.isOptional = Boolean(data.isOptional);
  if (data.frequency) updatePayload.frequency = data.frequency;
  if (data.totalAmount !== undefined) {
    const amt = parseFloat(data.totalAmount);
    if (isNaN(amt) || amt <= 0) throw new Error('Amount must be positive.');
    updatePayload.totalAmount = amt;
  }

  const updated = await prisma.feeStructure.update({
    where: { id },
    data: updatePayload,
    include: { class: { select: { id: true, name: true, section: true } } },
  });

  await logAudit({
    actorId: userId,
    action: 'FEE_STRUCTURE_UPDATED',
    entityType: 'FeeStructure',
    entityId: id,
    previousValue: existing,
    newValue: updated,
    reason: 'Updated fee structure definition',
  });

  return updated;
};

export const deleteFeeStructure = async (id, schoolId, userId = null) => {
  const existing = await prisma.feeStructure.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { studentFees: true } } },
  });
  if (!existing) throw new Error('Fee structure not found.');
  if (existing._count.studentFees > 0) {
    throw new Error('Cannot delete fee structure that has already been assigned to students.');
  }

  await prisma.feeStructure.delete({ where: { id } });
  await logAudit({
    actorId: userId,
    action: 'FEE_STRUCTURE_DELETED',
    entityType: 'FeeStructure',
    entityId: id,
    previousValue: existing,
    reason: 'Deleted unassigned fee structure',
  });
  return { id };
};

/**
 * 2. Student Fee Assignment with Installments
 */
export const assignFeeToStudent = async ({
  schoolId,
  studentId,
  feeStructureId,
  academicYear,
  installmentsCount = 1,
  firstDueDate = null,
  remarks = null,
  userId = null,
}) => {
  const [student, structure] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, schoolId }, include: { class: true } }),
    prisma.feeStructure.findFirst({ where: { id: feeStructureId, schoolId } }),
  ]);

  if (!student) throw new Error('Student not found in this school.');
  if (!structure) throw new Error('Fee structure not found.');

  // Prevent duplicate assignment of the same structure
  const existingAssignment = await prisma.studentFee.findUnique({
    where: { studentId_feeStructureId: { studentId, feeStructureId } },
  });
  if (existingAssignment) {
    throw new Error(`Fee "${structure.name}" has already been assigned to ${student.name}.`);
  }

  const total = structure.totalAmount;
  const numInstallments = Math.max(1, Math.min(12, parseInt(installmentsCount, 10) || 1));
  const baseInstallment = Math.floor((total / numInstallments) * 100) / 100;
  const remainder = Math.round((total - baseInstallment * numInstallments) * 100) / 100;

  const baseDate = firstDueDate ? new Date(firstDueDate) : new Date();

  // Create StudentFee and Installments in transaction
  const result = await prisma.$transaction(async (tx) => {
    const studentFee = await tx.studentFee.create({
      data: {
        schoolId,
        studentId,
        feeStructureId,
        academicYear: academicYear || structure.academicYear,
        originalAmount: total,
        netAmount: total,
        paidAmount: 0,
        balanceAmount: total,
        status: 'PENDING',
        remarks: remarks ? remarks.trim() : null,
      },
    });

    const installmentPromises = [];
    for (let i = 1; i <= numInstallments; i++) {
      const instAmount = i === 1 ? Math.round((baseInstallment + remainder) * 100) / 100 : baseInstallment;
      const dueDate = new Date(baseDate);
      dueDate.setMonth(baseDate.getMonth() + (i - 1));

      installmentPromises.push(
        tx.feeInstallment.create({
          data: {
            studentFeeId: studentFee.id,
            installmentNumber: i,
            title: `Installment ${i} of ${numInstallments}`,
            amount: instAmount,
            dueDate,
            paidAmount: 0,
            balanceAmount: instAmount,
            status: 'PENDING',
          },
        })
      );
    }

    await Promise.all(installmentPromises);

    return tx.studentFee.findUnique({
      where: { id: studentFee.id },
      include: {
        student: { select: { id: true, name: true, admissionNumber: true, rollNumber: true } },
        feeStructure: true,
        installments: { orderBy: { installmentNumber: 'asc' } },
      },
    });
  });

  await logAudit({
    actorId: userId,
    action: 'STUDENT_FEE_ASSIGNED',
    entityType: 'StudentFee',
    entityId: result.id,
    newValue: { studentId, structureId: feeStructureId, amount: total, installments: numInstallments },
    reason: `Assigned ${structure.name} to student ${student.name}`,
  });

  return result;
};

export const assignFeeToClass = async ({
  schoolId,
  classId,
  feeStructureId,
  academicYear,
  installmentsCount = 1,
  firstDueDate = null,
  userId = null,
}) => {
  const students = await prisma.student.findMany({
    where: { schoolId, classId, active: true },
    select: { id: true, name: true },
  });

  if (students.length === 0) {
    throw new Error('No active students found in the selected class.');
  }

  const results = { successful: [], skipped: [] };

  for (const st of students) {
    try {
      const assigned = await assignFeeToStudent({
        schoolId,
        studentId: st.id,
        feeStructureId,
        academicYear,
        installmentsCount,
        firstDueDate,
        userId,
      });
      results.successful.push({ studentId: st.id, name: st.name, feeId: assigned.id });
    } catch (err) {
      results.skipped.push({ studentId: st.id, name: st.name, reason: err.message });
    }
  }

  return results;
};

/**
 * 3. Discounts and Concessions
 */
export const applyDiscount = async ({
  studentFeeId,
  schoolId,
  discountType = 'FIXED_AMOUNT',
  value,
  reason,
  approvedById = null,
}) => {
  const fee = await prisma.studentFee.findFirst({
    where: { id: studentFeeId, schoolId },
    include: { installments: { orderBy: { installmentNumber: 'asc' } }, student: true },
  });

  if (!fee) throw new Error('Student fee record not found.');
  if (fee.status === 'PAID') throw new Error('Cannot apply discount to a fee that is already fully paid.');
  if (!reason || !reason.trim()) throw new Error('Discount justification reason is required.');

  const numVal = parseFloat(value);
  if (isNaN(numVal) || numVal <= 0) throw new Error('Discount value must be a positive number.');

  let discountAmount = 0;
  if (discountType === 'PERCENTAGE') {
    if (numVal > 100) throw new Error('Percentage discount cannot exceed 100%.');
    discountAmount = Math.round(((fee.originalAmount * numVal) / 100) * 100) / 100;
  } else {
    discountAmount = numVal;
  }

  const maxAllowedDiscount = fee.originalAmount - fee.paidAmount;
  if (discountAmount > maxAllowedDiscount) {
    throw new Error(`Discount (₹${discountAmount}) cannot exceed outstanding unpaid amount (₹${maxAllowedDiscount}).`);
  }

  const newDiscountTotal = fee.discountAmount + discountAmount;
  const newNetAmount = Math.round((fee.originalAmount - newDiscountTotal - fee.scholarshipAmount) * 100) / 100;
  const newBalanceAmount = Math.round((newNetAmount - fee.paidAmount) * 100) / 100;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Record Discount
    const discount = await tx.feeDiscount.create({
      data: {
        studentFeeId,
        discountType,
        value: numVal,
        amount: discountAmount,
        reason: reason.trim(),
        approvedById,
      },
    });

    // 2. Update StudentFee
    const updatedFee = await tx.studentFee.update({
      where: { id: studentFeeId },
      data: {
        discountAmount: newDiscountTotal,
        netAmount: newNetAmount,
        balanceAmount: newBalanceAmount,
        status: newBalanceAmount <= 0 ? 'PAID' : fee.paidAmount > 0 ? 'PARTIAL' : 'PENDING',
      },
    });

    // 3. Rebalance unpaid installments
    let remainingReduction = discountAmount;
    for (const inst of fee.installments) {
      if (remainingReduction <= 0) break;
      if (inst.status === 'PAID') continue;

      const reducible = inst.balanceAmount;
      const deduction = Math.min(reducible, remainingReduction);
      const newInstAmount = Math.round((inst.amount - deduction) * 100) / 100;
      const newInstBal = Math.round((inst.balanceAmount - deduction) * 100) / 100;

      await tx.feeInstallment.update({
        where: { id: inst.id },
        data: {
          amount: newInstAmount,
          balanceAmount: newInstBal,
          status: newInstBal <= 0 ? 'PAID' : inst.paidAmount > 0 ? 'PARTIAL' : 'PENDING',
        },
      });

      remainingReduction -= deduction;
    }

    return { updatedFee, discount };
  });

  await logAudit({
    actorId: approvedById,
    action: 'FEE_DISCOUNT_APPLIED',
    entityType: 'StudentFee',
    entityId: studentFeeId,
    newValue: { discountAmount, netAmount: newNetAmount, reason },
    reason: `Discount of ₹${discountAmount} applied to student fee`,
  });

  return result;
};

/**
 * 4. Payment Processing and Receipting
 */
export const recordPayment = async ({
  schoolId,
  studentFeeId,
  amountPaid,
  paymentMethod = 'CASH',
  transactionReference = null,
  remarks = null,
  paymentDate = new Date(),
  recordedById = null,
}) => {
  const fee = await prisma.studentFee.findFirst({
    where: { id: studentFeeId, schoolId },
    include: {
      installments: { orderBy: { installmentNumber: 'asc' } },
      student: { select: { id: true, name: true, admissionNumber: true, rollNumber: true } },
      feeStructure: true,
    },
  });

  if (!fee) throw new Error('Student fee account not found.');
  const paymentAmount = Math.round(parseFloat(amountPaid) * 100) / 100;
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  if (paymentAmount > fee.balanceAmount) {
    throw new Error(
      `Overpayment not permitted: Entered amount (₹${paymentAmount}) exceeds total balance due (₹${fee.balanceAmount}).`
    );
  }

  // Check unique transaction reference if provided (prevent double submission)
  if (transactionReference && transactionReference.trim()) {
    const existingRef = await prisma.feePayment.findFirst({
      where: {
        schoolId,
        transactionReference: transactionReference.trim(),
        isReversed: false,
      },
    });
    if (existingRef) {
      throw new Error(`Transaction reference "${transactionReference.trim()}" has already been processed under receipt ${existingRef.receiptNumber}.`);
    }
  }

  const receiptNumber = `REC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const pDate = paymentDate ? new Date(paymentDate) : new Date();

  const paymentResult = await prisma.$transaction(async (tx) => {
    // 1. Create Payment Record
    const payment = await tx.feePayment.create({
      data: {
        schoolId,
        studentFeeId,
        studentId: fee.studentId,
        receiptNumber,
        amountPaid: paymentAmount,
        paymentMethod,
        transactionReference: transactionReference ? transactionReference.trim() : null,
        remarks: remarks ? remarks.trim() : null,
        paymentDate: pDate,
        recordedById,
      },
    });

    // 2. Allocate payment to installments sequentially
    let unallocated = paymentAmount;
    const allocations = [];

    for (const inst of fee.installments) {
      if (unallocated <= 0) break;
      if (inst.balanceAmount <= 0) continue;

      const allocation = Math.min(unallocated, inst.balanceAmount);
      const newInstPaid = Math.round((inst.paidAmount + allocation) * 100) / 100;
      const newInstBal = Math.round((inst.balanceAmount - allocation) * 100) / 100;

      await tx.feeInstallment.update({
        where: { id: inst.id },
        data: {
          paidAmount: newInstPaid,
          balanceAmount: newInstBal,
          status: newInstBal <= 0 ? 'PAID' : 'PARTIAL',
          paidAt: newInstBal <= 0 ? pDate : inst.paidAt,
        },
      });

      const alloc = await tx.paymentAllocation.create({
        data: {
          feePaymentId: payment.id,
          feeInstallmentId: inst.id,
          allocatedAmount: allocation,
        },
      });
      allocations.push(alloc);

      unallocated = Math.round((unallocated - allocation) * 100) / 100;
    }

    // 3. Update StudentFee Account Balances
    const newFeePaid = Math.round((fee.paidAmount + paymentAmount) * 100) / 100;
    const newFeeBal = Math.round((fee.balanceAmount - paymentAmount) * 100) / 100;

    const updatedStudentFee = await tx.studentFee.update({
      where: { id: studentFeeId },
      data: {
        paidAmount: newFeePaid,
        balanceAmount: newFeeBal,
        status: newFeeBal <= 0 ? 'PAID' : 'PARTIAL',
      },
    });

    return {
      payment,
      allocations,
      updatedStudentFee,
      student: fee.student,
      feeStructure: fee.feeStructure,
    };
  });

  await logAudit({
    actorId: recordedById,
    action: 'FEE_PAYMENT_RECORDED',
    entityType: 'FeePayment',
    entityId: paymentResult.payment.id,
    newValue: { receiptNumber, amount: paymentAmount, method: paymentMethod },
    reason: `Payment receipt ${receiptNumber} recorded for ${fee.student.name}`,
  });

  return paymentResult;
};

/**
 * 5. Payment Reversal with Balance Restoration
 */
export const reversePayment = async ({ feePaymentId, schoolId, approvedById = null, reason }) => {
  if (!reason || !reason.trim()) {
    throw new Error('Mandatory audit justification is required to reverse a payment.');
  }

  const payment = await prisma.feePayment.findFirst({
    where: { id: feePaymentId, schoolId },
    include: {
      allocations: true,
      studentFee: true,
      student: true,
    },
  });

  if (!payment) throw new Error('Payment record not found.');
  if (payment.isReversed) throw new Error('This payment has already been reversed.');

  const reversalTimestamp = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Rollback Installment Allocations
    for (const alloc of payment.allocations) {
      const inst = await tx.feeInstallment.findUnique({ where: { id: alloc.feeInstallmentId } });
      if (inst) {
        const restoredPaid = Math.max(0, Math.round((inst.paidAmount - alloc.allocatedAmount) * 100) / 100);
        const restoredBal = Math.round((inst.balanceAmount + alloc.allocatedAmount) * 100) / 100;

        await tx.feeInstallment.update({
          where: { id: inst.id },
          data: {
            paidAmount: restoredPaid,
            balanceAmount: restoredBal,
            status: restoredPaid === 0 ? 'PENDING' : 'PARTIAL',
          },
        });
      }
    }

    // 2. Rollback StudentFee
    const fee = payment.studentFee;
    const restoredFeePaid = Math.max(0, Math.round((fee.paidAmount - payment.amountPaid) * 100) / 100);
    const restoredFeeBal = Math.round((fee.balanceAmount + payment.amountPaid) * 100) / 100;

    await tx.studentFee.update({
      where: { id: fee.id },
      data: {
        paidAmount: restoredFeePaid,
        balanceAmount: restoredFeeBal,
        status: restoredFeePaid === 0 ? 'PENDING' : 'PARTIAL',
      },
    });

    // 3. Mark Payment Reversed
    const updatedPayment = await tx.feePayment.update({
      where: { id: feePaymentId },
      data: {
        isReversed: true,
        reversedAt: reversalTimestamp,
        reversedById: approvedById,
        reversalReason: reason.trim(),
      },
    });

    // 4. Create Reversal Audit Record
    const reversalRecord = await tx.paymentReversal.create({
      data: {
        feePaymentId,
        approvedById,
        reason: reason.trim(),
        reversedAt: reversalTimestamp,
      },
    });

    return { updatedPayment, reversalRecord };
  });

  await logAudit({
    actorId: approvedById,
    action: 'FEE_PAYMENT_REVERSED',
    entityType: 'FeePayment',
    entityId: feePaymentId,
    previousValue: { isReversed: false, amount: payment.amountPaid },
    newValue: { isReversed: true, reason: reason.trim() },
    reason: `Payment reversal executed: ${reason.trim()}`,
  });

  return result;
};

/**
 * 6. Student Fee Statements and Receipts
 */
export const getStudentFeeStatement = async (studentId, schoolId) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { class: true },
  });
  if (!student) throw new Error('Student not found.');

  const fees = await prisma.studentFee.findMany({
    where: { studentId, schoolId },
    include: {
      feeStructure: true,
      installments: { orderBy: { installmentNumber: 'asc' } },
      payments: {
        where: { isReversed: false },
        orderBy: { paymentDate: 'desc' },
        include: { recordedBy: { select: { id: true, name: true } } },
      },
      discounts: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalBilled = 0;
  let totalDiscounts = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;

  fees.forEach((f) => {
    totalBilled += f.originalAmount;
    totalDiscounts += f.discountAmount + f.scholarshipAmount;
    totalPaid += f.paidAmount;
    totalOutstanding += f.balanceAmount;
  });

  return {
    student: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      class: `${student.class.name}-${student.class.section}`,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
    },
    summary: {
      totalBilled,
      totalDiscounts,
      netPayable: totalBilled - totalDiscounts,
      totalPaid,
      totalOutstanding,
      isClear: totalOutstanding === 0,
    },
    accounts: fees,
  };
};

export const getReceiptDetails = async (receiptNumber, schoolId) => {
  const payment = await prisma.feePayment.findFirst({
    where: { receiptNumber, schoolId },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true, rollNumber: true, class: true } },
      studentFee: { include: { feeStructure: true } },
      recordedBy: { select: { id: true, name: true } },
      allocations: { include: { feeInstallment: true } },
      reversals: { include: { approvedBy: { select: { name: true } } } },
    },
  });

  if (!payment) throw new Error('Payment receipt not found.');
  return payment;
};

/**
 * 7. Overdue Fees and Accounts
 */
export const getOverdueFees = async ({ schoolId, classId, asOfDate = new Date() }) => {
  const targetDate = asOfDate ? new Date(asOfDate) : new Date();

  const overdueInstallments = await prisma.feeInstallment.findMany({
    where: {
      studentFee: {
        schoolId,
        ...(classId ? { student: { classId } } : {}),
      },
      dueDate: { lt: targetDate },
      balanceAmount: { gt: 0 },
      status: { not: 'PAID' },
    },
    include: {
      studentFee: {
        include: {
          student: { select: { id: true, name: true, admissionNumber: true, rollNumber: true, guardianPhone: true, class: true } },
          feeStructure: { select: { name: true, category: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  return overdueInstallments.map((inst) => {
    const diffDays = Math.ceil((targetDate.getTime() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      installmentId: inst.id,
      studentId: inst.studentFee.student.id,
      studentName: inst.studentFee.student.name,
      admissionNumber: inst.studentFee.student.admissionNumber,
      rollNumber: inst.studentFee.student.rollNumber,
      guardianPhone: inst.studentFee.student.guardianPhone,
      className: `${inst.studentFee.student.class.name}-${inst.studentFee.student.class.section}`,
      feeName: inst.studentFee.feeStructure.name,
      installmentTitle: inst.title,
      dueDate: inst.dueDate.toISOString().split('T')[0],
      daysOverdue: Math.max(1, diffDays),
      overdueAmount: inst.balanceAmount,
      totalAmount: inst.amount,
      paidAmount: inst.paidAmount,
    };
  });
};

/**
 * 8. Financial Summaries and Reporting Intelligence
 */
export const getFeeCollectionSummary = async ({ schoolId, classId, startDate, endDate }) => {
  const whereStudentFee = { schoolId };
  if (classId) whereStudentFee.student = { classId };

  const [studentFees, payments, overdueInstallments] = await Promise.all([
    prisma.studentFee.findMany({
      where: whereStudentFee,
      select: { originalAmount: true, discountAmount: true, scholarshipAmount: true, netAmount: true, paidAmount: true, balanceAmount: true },
    }),
    prisma.feePayment.findMany({
      where: {
        schoolId,
        isReversed: false,
        ...(startDate || endDate ? { paymentDate: { gte: startDate ? new Date(startDate) : undefined, lte: endDate ? new Date(endDate) : undefined } } : {}),
      },
      select: { amountPaid: true, paymentMethod: true, paymentDate: true },
    }),
    prisma.feeInstallment.findMany({
      where: {
        studentFee: { schoolId, ...(classId ? { student: { classId } } : {}) },
        dueDate: { lt: new Date() },
        balanceAmount: { gt: 0 },
      },
      select: { balanceAmount: true },
    }),
  ]);

  let totalBilled = 0;
  let totalDiscounts = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;

  studentFees.forEach((f) => {
    totalBilled += f.originalAmount;
    totalDiscounts += f.discountAmount + f.scholarshipAmount;
    totalCollected += f.paidAmount;
    totalOutstanding += f.balanceAmount;
  });

  const totalOverdue = overdueInstallments.reduce((acc, i) => acc + i.balanceAmount, 0);

  const byPaymentMethod = { CASH: 0, UPI: 0, BANK_TRANSFER: 0, CHEQUE: 0, OTHER: 0 };
  payments.forEach((p) => {
    if (byPaymentMethod[p.paymentMethod] !== undefined) {
      byPaymentMethod[p.paymentMethod] += p.amountPaid;
    }
  });

  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / (totalBilled - totalDiscounts)) * 1000) / 10 : 0;

  return {
    totalBilled,
    totalDiscounts,
    netPayable: totalBilled - totalDiscounts,
    totalCollected,
    totalOutstanding,
    totalOverdue,
    collectionRate,
    byPaymentMethod,
    totalTransactions: payments.length,
  };
};

export const getClassFeeCollectionReport = async ({ schoolId, academicYear }) => {
  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
      students: {
        where: { active: true },
        include: {
          studentFees: {
            where: academicYear ? { academicYear } : {},
            select: { netAmount: true, paidAmount: true, balanceAmount: true },
          },
        },
      },
    },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
  });

  return classes.map((c) => {
    let billed = 0;
    let collected = 0;
    let balance = 0;

    c.students.forEach((st) => {
      st.studentFees.forEach((f) => {
        billed += f.netAmount;
        collected += f.paidAmount;
        balance += f.balanceAmount;
      });
    });

    const rate = billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0;

    return {
      classId: c.id,
      className: `${c.name}-${c.section}`,
      enrolledStudents: c.students.length,
      totalBilled: billed,
      totalCollected: collected,
      totalBalance: balance,
      collectionRate: rate,
    };
  });
};

/**
 * RFC 4180 CSV Export Generator
 */
const escapeCsv = (field) => {
  if (field === null || field === undefined) return '';
  const str = String(field);
  return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const generateFeeCsv = async ({ schoolId, classId, type = 'overdue' }) => {
  if (type === 'overdue') {
    const list = await getOverdueFees({ schoolId, classId });
    const headers = ['Admission No', 'Student Name', 'Class', 'Guardian Phone', 'Fee Item', 'Installment', 'Due Date', 'Days Overdue', 'Overdue Amount'];
    const rows = list.map((o) => [
      escapeCsv(o.admissionNumber), escapeCsv(o.studentName), escapeCsv(o.className),
      escapeCsv(o.guardianPhone || 'N/A'), escapeCsv(o.feeName), escapeCsv(o.installmentTitle),
      escapeCsv(o.dueDate), escapeCsv(o.daysOverdue), escapeCsv(o.overdueAmount),
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  if (type === 'payments') {
    const payments = await prisma.feePayment.findMany({
      where: { schoolId },
      orderBy: { paymentDate: 'desc' },
      include: {
        student: { select: { name: true, admissionNumber: true, class: true } },
        recordedBy: { select: { name: true } },
      },
    });
    const headers = ['Receipt No', 'Date', 'Student Name', 'Admission No', 'Class', 'Amount Paid', 'Method', 'Transaction Ref', 'Status', 'Recorded By'];
    const rows = payments.map((p) => [
      escapeCsv(p.receiptNumber), escapeCsv(p.paymentDate.toISOString().split('T')[0]),
      escapeCsv(p.student.name), escapeCsv(p.student.admissionNumber),
      escapeCsv(`${p.student.class.name}-${p.student.class.section}`),
      escapeCsv(p.amountPaid), escapeCsv(p.paymentMethod), escapeCsv(p.transactionReference || 'N/A'),
      escapeCsv(p.isReversed ? 'REVERSED' : 'COMPLETED'), escapeCsv(p.recordedBy?.name || 'Staff'),
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // Default: Class-wise summary
  const classSummary = await getClassFeeCollectionReport({ schoolId });
  const headers = ['Class Name', 'Enrolled Students', 'Total Billed', 'Total Collected', 'Total Balance', 'Collection Rate (%)'];
  const rows = classSummary.map((c) => [
    escapeCsv(c.className), escapeCsv(c.enrolledStudents), escapeCsv(c.totalBilled),
    escapeCsv(c.totalCollected), escapeCsv(c.totalBalance), escapeCsv(c.collectionRate),
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};
