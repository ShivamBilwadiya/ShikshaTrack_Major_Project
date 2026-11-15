import prisma from '../config/db.js';
import { generateCertificatePdf } from '../utils/certificatePdfGenerator.js';

/**
 * Check fee clearance status for a student
 */
export const checkStudentFeeClearance = async (schoolId, studentId) => {
  const fees = await prisma.studentFee.findMany({
    where: { studentId, schoolId },
    select: {
      id: true,
      academicYear: true,
      originalAmount: true,
      netAmount: true,
      paidAmount: true,
      balanceAmount: true,
      status: true,
      feeStructure: { select: { name: true } },
    },
  });

  const totalOriginal = fees.reduce((sum, f) => sum + (f.originalAmount || 0), 0);
  const totalNet = fees.reduce((sum, f) => sum + (f.netAmount || 0), 0);
  const totalPaid = fees.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
  const totalBalance = fees.reduce((sum, f) => sum + (f.balanceAmount > 0 ? f.balanceAmount : 0), 0);

  return {
    isCleared: totalBalance <= 0,
    totalBalance,
    totalNet,
    totalPaid,
    feeCount: fees.length,
    pendingFees: fees.filter((f) => f.balanceAmount > 0),
  };
};

/**
 * Preview student exit details and Transfer Certificate parameters
 */
export const getStudentExitPreview = async ({ schoolId, studentId }) => {
  if (!studentId) {
    throw new Error('Student ID is required.');
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      class: {
        select: { id: true, name: true, section: true, academicYear: true },
      },
    },
  });

  if (!student) {
    throw new Error('Student not found in this institution.');
  }

  // 1. Fee Clearance Validation
  const feeStatus = await checkStudentFeeClearance(schoolId, studentId);

  // 2. Check for duplicate existing active TC
  const existingTc = await prisma.issuedCertificate.findFirst({
    where: {
      schoolId,
      studentId,
      type: 'TRANSFER',
      status: 'ACTIVE',
    },
    include: {
      issuedBy: { select: { id: true, name: true } },
    },
  });

  return {
    student: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber || 'N/A',
      className: student.class ? `${student.class.name}-${student.class.section}` : 'N/A',
      academicYear: student.class?.academicYear || '2026-2027',
      gender: student.gender || 'Not specified',
      dateOfBirth: student.dateOfBirth,
      guardianName: student.guardianName || 'N/A',
      guardianPhone: student.guardianPhone || 'N/A',
      admissionDate: student.createdAt,
      active: student.active,
    },
    feeStatus,
    hasExistingTc: Boolean(existingTc),
    existingCertificate: existingTc,
  };
};

/**
 * Issue Transfer Certificate and execute student withdrawal/exit
 */
export const issueTransferCertificate = async ({
  schoolId,
  adminUserId,
  studentId,
  exitReason = 'Higher studies / School completion',
  leavingDate = new Date().toISOString(),
  conduct = 'Good',
  remarks = '',
  allowWithPendingFees = false,
}) => {
  if (!studentId) {
    throw new Error('Student ID is required.');
  }
  if (!exitReason || !exitReason.trim()) {
    throw new Error('Exit reason is required to issue a Transfer Certificate.');
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      class: true,
      school: true,
    },
  });

  if (!student) {
    throw new Error('Student not found in this institution.');
  }

  // 1. Prevent duplicate active TC
  const existingTc = await prisma.issuedCertificate.findFirst({
    where: {
      schoolId,
      studentId,
      type: 'TRANSFER',
      status: 'ACTIVE',
    },
  });

  if (existingTc) {
    throw new Error(
      `A Transfer Certificate has already been issued for this student (Certificate No: ${existingTc.certificateNumber}). Duplicate issuance is prohibited.`
    );
  }

  // 2. Fee Clearance Validation
  const feeStatus = await checkStudentFeeClearance(schoolId, studentId);
  if (!feeStatus.isCleared && !allowWithPendingFees) {
    throw new Error(
      `Cannot issue Transfer Certificate: Student has outstanding fee balance of ₹${feeStatus.totalBalance}. Please clear all pending dues or authorize an administrative fee waiver.`
    );
  }

  const certificateNumber = `TC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const leavingDateObj = new Date(leavingDate);

  const studentSnapshot = {
    name: student.name,
    admissionNumber: student.admissionNumber,
    rollNumber: student.rollNumber || 'N/A',
    className: student.class ? `${student.class.name}-${student.class.section}` : 'N/A',
    academicYear: student.class?.academicYear || '2026-2027',
    dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString().split('T')[0] : 'N/A',
    gender: student.gender || 'N/A',
    guardianName: student.guardianName || 'N/A',
    admissionDate: student.createdAt.toISOString().split('T')[0],
    leavingDate: leavingDateObj.toISOString().split('T')[0],
  };

  const certificateData = {
    exitReason: exitReason.trim(),
    conduct: conduct.trim(),
    remarks: remarks.trim(),
    feeClearanceStatus: feeStatus.isCleared ? 'CLEARED' : 'PENDING_DUES',
    pendingFeeBalance: feeStatus.totalBalance,
    feeWaiverAuthorized: !feeStatus.isCleared && allowWithPendingFees,
  };

  const issuedCertificate = await prisma.$transaction(async (tx) => {
    // 1. Finalize student active status upon school exit
    await tx.student.update({
      where: { id: student.id },
      data: { active: false },
    });

    // 2. Create the immutable IssuedCertificate record
    const cert = await tx.issuedCertificate.create({
      data: {
        schoolId,
        studentId: student.id,
        certificateNumber,
        type: 'TRANSFER',
        title: 'TRANSFER CERTIFICATE & SCHOOL LEAVING RECORD',
        studentSnapshot,
        certificateData,
        signatoryTitle: 'Principal / Headmaster',
        signatoryName: 'Authorized Institutional Signatory',
        issuedById: adminUserId,
        status: 'ACTIVE',
      },
    });

    // 3. Record in AuditLog
    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        action: 'STUDENT_EXIT_TC_ISSUED',
        entityType: 'Student',
        entityId: student.id,
        previousValue: JSON.stringify({ active: true, classId: student.classId }),
        newValue: JSON.stringify({ active: false, certificateNumber }),
        reason: `Student exit with Transfer Certificate (${certificateNumber}): ${exitReason.trim()}`,
      },
    });

    return cert;
  });

  return issuedCertificate;
};

/**
 * List historical Transfer Certificates issued by the institution
 */
export const getTransferCertificateHistory = async ({
  schoolId,
  search = '',
  page = 1,
  limit = 15,
}) => {
  const where = {
    schoolId,
    type: 'TRANSFER',
  };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { certificateNumber: { contains: q, mode: 'insensitive' } },
      { student: { name: { contains: q, mode: 'insensitive' } } },
      { student: { admissionNumber: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Math.min(100, Math.max(1, Number(limit)));

  const [total, certificates] = await Promise.all([
    prisma.issuedCertificate.count({ where }),
    prisma.issuedCertificate.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            admissionNumber: true,
            rollNumber: true,
            class: { select: { name: true, section: true, academicYear: true } },
          },
        },
        issuedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    }),
  ]);

  return {
    certificates,
    total,
    page: Number(page),
    limit: take,
    totalPages: Math.ceil(total / take),
  };
};

/**
 * Generate vector PDF for a Transfer Certificate
 */
export const generateTransferCertificatePdfBuffer = async (schoolId, certificateId) => {
  const cert = await prisma.issuedCertificate.findFirst({
    where: { id: certificateId, schoolId, type: 'TRANSFER' },
    include: {
      school: true,
      student: { include: { class: true } },
    },
  });

  if (!cert) {
    throw new Error('Transfer Certificate not found in this institution.');
  }

  const snap = cert.studentSnapshot || {};
  const cData = cert.certificateData || {};

  const bodyText = `This is to certify that ${snap.name || 'the student'}, son/daughter of ${
    snap.guardianName || 'Guardian'
  }, was admitted to this institution on ${snap.admissionDate || 'record date'} and left on ${
    snap.leavingDate || 'exit date'
  }. The student was studying in ${snap.className || 'Class'} (${snap.academicYear || 'Current Academic Year'}). Reason for leaving: ${
    cData.exitReason || 'School completion'
  }. Conduct: ${cData.conduct || 'Good'}. Fee status: ${
    cData.feeClearanceStatus === 'CLEARED' ? 'All institution dues cleared.' : `Pending dues ₹${cData.pendingFeeBalance || 0} waived.`
  }`;

  const pdfBuffer = await generateCertificatePdf({
    schoolName: cert.school.name,
    schoolCode: cert.school.code,
    schoolAddress: cert.school.address || 'National Highway 8, Educational Zone',
    contactEmail: cert.school.contactEmail || 'admin@shikshatrack.in',
    contactPhone: cert.school.contactPhone || '+91 98765 43210',
    title: 'TRANSFER CERTIFICATE & SCHOOL LEAVING RECORD',
    certificateNumber: cert.certificateNumber,
    issueDate: new Date(cert.issueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    signatoryTitle: cert.signatoryTitle,
    signatoryName: cert.signatoryName || 'Principal',
    bodyText,
    studentInfo: snap,
    verificationUrl: `https://shikshatrack.in/verify-certificate`,
    verificationToken: cert.verificationToken,
    watermarkText: 'TRANSFER CERTIFICATE',
  });

  return {
    pdfBuffer,
    fileName: `${cert.certificateNumber}-${snap.name?.replace(/\s+/g, '_') || 'Student'}.pdf`,
  };
};
