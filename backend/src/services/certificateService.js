import crypto from 'crypto';
import prisma from '../config/db.js';
import { logAudit } from './auditService.js';
import { generateCertificatePdf } from '../utils/certificatePdfGenerator.js';

/**
 * Replace placeholders in template text with actual student and school metadata
 */
export const interpolateCertificateText = (template, data) => {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : match;
  });
};

/**
 * Generate unique, tamper-evident certificate numbering sequence
 */
export const generateCertificateNumber = (type = 'BONAFIDE') => {
  const year = new Date().getFullYear();
  const typeCode = (type || 'GEN').substring(0, 3).toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const timestampSeq = Date.now().toString().slice(-4);
  return `ST-${year}-${typeCode}-${timestampSeq}${randomSuffix}`;
};

/**
 * Default templates to seed for schools that have not configured custom templates
 */
const DEFAULT_TEMPLATES = [
  {
    name: 'Standard Bonafide Certificate',
    type: 'BONAFIDE',
    title: 'BONAFIDE CERTIFICATE',
    bodyTemplate:
      'This is to certify that {{student_name}}, son/daughter of {{guardian_name}}, bearing Admission No: {{admission_no}} and Roll No: {{roll_no}}, is a bonafide student of this institution studying in {{class_name}} (Section {{section}}) during the academic year {{academic_year}}. To the best of our knowledge and school records, their conduct and character have been exemplary.',
    signatoryTitle: 'Principal / Head of Institution',
    watermarkText: 'BONAFIDE PUPIL',
    validityMonths: 12,
  },
  {
    name: 'Transfer & School Leaving Certificate',
    type: 'TRANSFER',
    title: 'TRANSFER CERTIFICATE',
    bodyTemplate:
      'This certifies that {{student_name}} (Admission No: {{admission_no}}, Date of Birth: {{dob}}) was a regular pupil in {{class_name}} (Section {{section}}) of this school. All school dues, library books, and institutional obligations have been cleared up to date. The student is granted this Transfer Certificate upon guardian request with good conduct.',
    signatoryTitle: 'Headmaster / Head of School',
    watermarkText: 'TRANSFER CERTIFIED',
    validityMonths: null,
  },
  {
    name: 'Conduct & Character Certificate',
    type: 'CHARACTER',
    title: 'CHARACTER & CONDUCT CERTIFICATE',
    bodyTemplate:
      'This is to certify that {{student_name}}, child of {{guardian_name}}, enrolled under Admission No: {{admission_no}} in {{class_name}}, bears an outstanding moral character. During their tenure at {{school_name}}, they demonstrated respectful discipline, punctual attendance, and active participation in school co-curricular activities.',
    signatoryTitle: 'Dean of Students & Principal',
    watermarkText: 'EXEMPLARY CHARACTER',
    validityMonths: 6,
  },
  {
    name: 'Study & Enrollment Verification Certificate',
    type: 'STUDY',
    title: 'STUDY CERTIFICATE',
    bodyTemplate:
      'It is verified from the school admission and attendance registers that {{student_name}} is currently enrolled and studying in {{class_name}} at {{school_name}} for the ongoing session {{academic_year}}. Their recorded date of birth in the official admission register is {{dob}}.',
    signatoryTitle: 'Registrar & Principal',
    watermarkText: 'STUDY ENROLLED',
    validityMonths: 6,
  },
  {
    name: 'Institutional Fee Clearance Certificate',
    type: 'FEE_CLEARANCE',
    title: 'FEE CLEARANCE CERTIFICATE',
    bodyTemplate:
      'This is to officially certify that {{student_name}} (Admission No: {{admission_no}}, Class: {{class_name}}) has cleared all prescribed tuition fees, examination fees, and institutional dues for the academic year {{academic_year}}. No financial liabilities remain outstanding against this student.',
    signatoryTitle: 'Bursar & Accounts Head',
    watermarkText: 'NO DUES CLEARED',
    validityMonths: 3,
  },
  {
    name: 'Academic & Co-Curricular Achievement Certificate',
    type: 'ACHIEVEMENT',
    title: 'CERTIFICATE OF EXCELLENCE',
    bodyTemplate:
      'This Certificate of Excellence is proudly awarded to {{student_name}} of {{class_name}} (Admission No: {{admission_no}}) in recognition of outstanding academic merit, scholastic diligence, and commendable dedication displayed during the academic term at {{school_name}}.',
    signatoryTitle: 'Academic Director & Principal',
    watermarkText: 'ACADEMIC MERIT',
    validityMonths: null,
  },
];

/**
 * Seed default certificate templates if none exist for this school
 */
export const seedDefaultTemplates = async ({ schoolId, userId }) => {
  const existingCount = await prisma.certificateTemplate.count({ where: { schoolId } });
  if (existingCount > 0) return existingCount;

  for (const t of DEFAULT_TEMPLATES) {
    await prisma.certificateTemplate.create({
      data: {
        schoolId,
        createdById: userId,
        name: t.name,
        type: t.type,
        title: t.title,
        bodyTemplate: t.bodyTemplate,
        signatoryTitle: t.signatoryTitle,
        watermarkText: t.watermarkText,
        validityMonths: t.validityMonths,
        active: true,
      },
    });
  }

  return DEFAULT_TEMPLATES.length;
};

/**
 * Create a new custom certificate template
 */
export const createCertificateTemplate = async ({
  schoolId,
  createdById,
  name,
  type = 'BONAFIDE',
  title,
  headerText = null,
  bodyTemplate,
  footerText = null,
  signatoryTitle = 'Principal / Head of Institution',
  signatoryName = null,
  watermarkText = 'OFFICIAL CERTIFICATE',
  validityMonths = null,
}) => {
  if (!name || !title || !bodyTemplate) {
    throw new Error('Template name, title, and body template text are required.');
  }

  const existing = await prisma.certificateTemplate.findFirst({
    where: { schoolId, name: name.trim() },
  });

  if (existing) {
    throw new Error(`A template named "${name.trim()}" already exists in this school.`);
  }

  const template = await prisma.certificateTemplate.create({
    data: {
      schoolId,
      createdById,
      name: name.trim(),
      type,
      title: title.trim(),
      headerText: headerText ? headerText.trim() : null,
      bodyTemplate: bodyTemplate.trim(),
      footerText: footerText ? footerText.trim() : null,
      signatoryTitle: signatoryTitle ? signatoryTitle.trim() : 'Principal / Head of Institution',
      signatoryName: signatoryName ? signatoryName.trim() : null,
      watermarkText: watermarkText ? watermarkText.trim() : null,
      validityMonths: validityMonths ? Number(validityMonths) : null,
      active: true,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  await logAudit({
    actorId: createdById,
    action: 'CERTIFICATE_TEMPLATE_CREATED',
    entityType: 'CertificateTemplate',
    entityId: template.id,
    newValue: { name: template.name, type: template.type },
    reason: `Created certificate template "${template.name}".`,
  });

  return template;
};

/**
 * Retrieve templates for school
 */
export const getCertificateTemplates = async ({ schoolId, type = null, activeOnly = true }) => {
  const where = { schoolId };
  if (activeOnly) where.active = true;
  if (type) where.type = type;

  let templates = await prisma.certificateTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { issuedCertificates: true } },
    },
  });

  // If no templates exist yet, seed defaults on-the-fly
  if (templates.length === 0) {
    const adminUser = await prisma.user.findFirst({ where: { schoolId, role: 'ADMIN' } });
    if (adminUser) {
      await seedDefaultTemplates({ schoolId, userId: adminUser.id });
      templates = await prisma.certificateTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { issuedCertificates: true } },
        },
      });
    }
  }

  return templates;
};

/**
 * Retrieve a single template by ID
 */
export const getCertificateTemplateById = async ({ templateId, schoolId }) => {
  const template = await prisma.certificateTemplate.findFirst({
    where: { id: templateId, schoolId },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  if (!template) {
    throw new Error('Certificate template not found.');
  }

  return template;
};

/**
 * Update certificate template
 */
export const updateCertificateTemplate = async ({ templateId, schoolId, updatedById, ...updates }) => {
  const existing = await getCertificateTemplateById({ templateId, schoolId });

  const data = {};
  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.type !== undefined) data.type = updates.type;
  if (updates.title !== undefined) data.title = updates.title.trim();
  if (updates.headerText !== undefined) data.headerText = updates.headerText?.trim() || null;
  if (updates.bodyTemplate !== undefined) data.bodyTemplate = updates.bodyTemplate.trim();
  if (updates.footerText !== undefined) data.footerText = updates.footerText?.trim() || null;
  if (updates.signatoryTitle !== undefined) data.signatoryTitle = updates.signatoryTitle.trim();
  if (updates.signatoryName !== undefined) data.signatoryName = updates.signatoryName?.trim() || null;
  if (updates.watermarkText !== undefined) data.watermarkText = updates.watermarkText?.trim() || null;
  if (updates.validityMonths !== undefined) data.validityMonths = updates.validityMonths ? Number(updates.validityMonths) : null;
  if (updates.active !== undefined) data.active = Boolean(updates.active);

  const updated = await prisma.certificateTemplate.update({
    where: { id: templateId },
    data,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  await logAudit({
    actorId: updatedById,
    action: 'CERTIFICATE_TEMPLATE_UPDATED',
    entityType: 'CertificateTemplate',
    entityId: templateId,
    previousValue: { name: existing.name, title: existing.title },
    newValue: data,
    reason: `Updated certificate template "${existing.name}".`,
  });

  return updated;
};

/**
 * Delete or deactivate certificate template
 */
export const deleteCertificateTemplate = async ({ templateId, schoolId, deletedById }) => {
  const template = await getCertificateTemplateById({ templateId, schoolId });

  const issuedCount = await prisma.issuedCertificate.count({ where: { templateId } });
  if (issuedCount > 0) {
    // Soft deactivate to protect issued certificates history
    await prisma.certificateTemplate.update({
      where: { id: templateId },
      data: { active: false },
    });
    return { success: true, message: `Template has ${issuedCount} issued certificates. It was archived/deactivated.` };
  }

  await prisma.certificateTemplate.delete({ where: { id: templateId } });

  await logAudit({
    actorId: deletedById,
    action: 'CERTIFICATE_TEMPLATE_DELETED',
    entityType: 'CertificateTemplate',
    entityId: templateId,
    previousValue: { name: template.name },
    reason: `Deleted certificate template "${template.name}".`,
  });

  return { success: true, message: 'Certificate template deleted successfully.' };
};

/**
 * Issue and register a new certificate for a student
 */
export const issueCertificate = async ({
  schoolId,
  issuedById,
  studentId,
  templateId = null,
  type = 'BONAFIDE',
  customTitle = null,
  customBody = null,
  signatoryTitle = null,
  signatoryName = null,
  validityMonths = null,
  remarks = null,
  certificateData = {},
}) => {
  if (!studentId) {
    throw new Error('Student ID is required to issue a certificate.');
  }

  // 1. Fetch Student with Class & School
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, active: true },
    include: {
      class: true,
      school: true,
    },
  });

  if (!student) {
    throw new Error('Student not found or inactive in this institution.');
  }

  // 2. Fetch Template if provided
  let template = null;
  if (templateId) {
    template = await prisma.certificateTemplate.findFirst({
      where: { id: templateId, schoolId, active: true },
    });
  }

  const certType = template ? template.type : type;
  const certTitle = customTitle || template?.title || `${certType} CERTIFICATE`;
  const baseSignTitle = signatoryTitle || template?.signatoryTitle || 'Principal / Head of Institution';
  const baseSignName = signatoryName || template?.signatoryName || 'Authorized Signatory';
  const effectiveValidity = validityMonths !== null && validityMonths !== undefined
    ? Number(validityMonths)
    : (template?.validityMonths || null);

  // 3. Construct Frozen Student Snapshot
  const studentSnapshot = {
    studentId: student.id,
    name: student.name,
    admissionNumber: student.admissionNumber,
    rollNumber: student.rollNumber || 'N/A',
    classId: student.classId,
    className: student.class ? `${student.class.name}-${student.class.section}` : 'N/A',
    section: student.class?.section || 'A',
    academicYear: student.class?.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    dateOfBirth: student.dateOfBirth
      ? new Date(student.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'As per school records',
    gender: student.gender || 'Not specified',
    guardianName: student.guardianName || 'Guardian',
    guardianPhone: student.guardianPhone || 'N/A',
    schoolId: student.school.id,
    schoolName: student.school.name,
    schoolCode: student.school.code,
    schoolAddress: student.school.address,
    contactEmail: student.school.contactEmail,
    contactPhone: student.school.contactPhone,
  };

  // 4. Interpolate Body Content
  const rawBody = customBody || template?.bodyTemplate || DEFAULT_TEMPLATES.find((t) => t.type === certType)?.bodyTemplate || 'This certifies that the student is enrolled in this institution.';
  const interpolatedBody = interpolateCertificateText(rawBody, {
    student_name: studentSnapshot.name,
    admission_no: studentSnapshot.admissionNumber,
    roll_no: studentSnapshot.rollNumber,
    class_name: studentSnapshot.className,
    section: studentSnapshot.section,
    academic_year: studentSnapshot.academicYear,
    guardian_name: studentSnapshot.guardianName,
    dob: studentSnapshot.dateOfBirth,
    gender: studentSnapshot.gender,
    school_name: studentSnapshot.schoolName,
    school_code: studentSnapshot.schoolCode,
    issue_date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
  });

  // 5. Expiry Date calculation
  let expiryDate = null;
  if (effectiveValidity && effectiveValidity > 0) {
    expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + effectiveValidity);
  }

  const certificateNumber = generateCertificateNumber(certType);
  const verificationToken = crypto.randomUUID();

  const finalCertData = {
    ...certificateData,
    bodyText: interpolatedBody,
    remarks: remarks || null,
    watermarkText: template?.watermarkText || 'SHIKSHATRACK OFFICIAL',
  };

  const certificate = await prisma.issuedCertificate.create({
    data: {
      schoolId,
      studentId,
      templateId: template?.id || null,
      certificateNumber,
      verificationToken,
      type: certType,
      title: certTitle,
      studentSnapshot,
      certificateData: finalCertData,
      signatoryTitle: baseSignTitle,
      signatoryName: baseSignName,
      issueDate: new Date(),
      expiryDate,
      status: 'ACTIVE',
      issuedById,
    },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true } },
      issuedBy: { select: { id: true, name: true, email: true, role: true } },
      template: { select: { id: true, name: true, type: true } },
    },
  });

  await logAudit({
    actorId: issuedById,
    action: 'CERTIFICATE_ISSUED',
    entityType: 'IssuedCertificate',
    entityId: certificate.id,
    newValue: {
      certificateNumber: certificate.certificateNumber,
      type: certificate.type,
      studentId: student.id,
      studentName: student.name,
    },
    reason: `Issued ${certType} certificate ${certificate.certificateNumber} for ${student.name}.`,
  });

  return certificate;
};

/**
 * Retrieve paginated list of issued certificates with RBAC
 */
export const getIssuedCertificates = async ({
  schoolId,
  userRole = 'ADMIN',
  userId = null,
  studentId = null,
  classId = null,
  type = null,
  status = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const where = { schoolId };

  // Parent isolation: only children linked to this parent
  if (userRole === 'PARENT') {
    const parentProfile = await prisma.parent.findUnique({
      where: { userId },
      include: { students: { select: { studentId: true } } },
    });

    if (!parentProfile || !parentProfile.students.length) {
      return { certificates: [], total: 0, page: Number(page), totalPages: 0 };
    }

    const linkedStudentIds = parentProfile.students.map((c) => c.studentId);
    if (studentId) {
      if (!linkedStudentIds.includes(studentId)) {
        throw new Error('Unauthorized: You can only view certificates for your registered children.');
      }
      where.studentId = studentId;
    } else {
      where.studentId = { in: linkedStudentIds };
    }
  } else if (studentId) {
    where.studentId = studentId;
  }

  if (type) where.type = type;
  if (status) where.status = status;
  if (classId) {
    where.student = { ...(where.student || {}), classId };
  }

  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { certificateNumber: { contains: query, mode: 'insensitive' } },
      { title: { contains: query, mode: 'insensitive' } },
      { student: { name: { contains: query, mode: 'insensitive' } } },
      { student: { admissionNumber: { contains: query, mode: 'insensitive' } } },
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
            class: { select: { id: true, name: true, section: true } },
          },
        },
        issuedBy: { select: { id: true, name: true, email: true, role: true } },
        revokedBy: { select: { id: true, name: true, email: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { verificationLogs: true } },
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
 * Retrieve single certificate by ID
 */
export const getCertificateById = async ({ certificateId, schoolId, userRole = 'ADMIN', userId = null }) => {
  const cert = await prisma.issuedCertificate.findFirst({
    where: { id: certificateId, schoolId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          admissionNumber: true,
          rollNumber: true,
          dateOfBirth: true,
          guardianName: true,
          class: { select: { id: true, name: true, section: true } },
        },
      },
      issuedBy: { select: { id: true, name: true, email: true, role: true } },
      revokedBy: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, name: true, type: true } },
      verificationLogs: {
        take: 10,
        orderBy: { verifiedAt: 'desc' },
      },
    },
  });

  if (!cert) {
    throw new Error('Certificate not found.');
  }

  // Parent isolation
  if (userRole === 'PARENT') {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { students: { select: { studentId: true } } },
    });
    const linkedIds = parent?.students?.map((c) => c.studentId) || [];
    if (!linkedIds.includes(cert.studentId)) {
      throw new Error('Unauthorized: You cannot view certificates of other students.');
    }
  }

  return cert;
};

/**
 * Generate Printable PDF Buffer for an issued certificate
 */
export const generateCertificatePdfBuffer = async ({
  certificateId,
  schoolId,
  userRole = 'ADMIN',
  userId = null,
  baseUrl = 'http://localhost:5173',
}) => {
  const cert = await getCertificateById({ certificateId, schoolId, userRole, userId });
  const snapshot = cert.studentSnapshot || {};
  const certData = cert.certificateData || {};

  const verificationUrl = `${baseUrl.replace(/\/$/, '')}/verify-certificate/${cert.verificationToken}`;

  const pdfBuffer = await generateCertificatePdf({
    schoolName: snapshot.schoolName || 'SHIKSHATRACK MODEL ACADEMY',
    schoolCode: snapshot.schoolCode || 'ST-IND-2026',
    schoolAddress: snapshot.schoolAddress || 'Rural Education Center, National Highway 8',
    contactEmail: snapshot.contactEmail || 'admin@shikshatrack.in',
    contactPhone: snapshot.contactPhone || '+91 98765 43210',
    title: cert.title,
    certificateNumber: cert.certificateNumber,
    issueDate: new Date(cert.issueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    signatoryTitle: cert.signatoryTitle,
    signatoryName: cert.signatoryName || 'Authorized Signatory',
    bodyText: certData.bodyText || 'This certifies that the student is a bonafide pupil of this institution.',
    studentInfo: {
      name: snapshot.name,
      admissionNumber: snapshot.admissionNumber,
      className: snapshot.className,
      rollNumber: snapshot.rollNumber,
      guardianName: snapshot.guardianName,
      dateOfBirth: snapshot.dateOfBirth,
    },
    verificationUrl,
    verificationToken: cert.verificationToken,
    watermarkText: cert.status === 'REVOKED' ? 'REVOKED / VOID' : (certData.watermarkText || 'OFFICIAL CERTIFICATE'),
  });

  return {
    buffer: pdfBuffer,
    fileName: `${cert.certificateNumber}.pdf`,
    mimeType: 'application/pdf',
  };
};

/**
 * Revoke an issued certificate with audit trail
 */
export const revokeCertificate = async ({ certificateId, schoolId, revokedById, revocationReason }) => {
  if (!revocationReason || !revocationReason.trim()) {
    throw new Error('A legitimate reason for certificate revocation is required.');
  }

  const existing = await prisma.issuedCertificate.findFirst({
    where: { id: certificateId, schoolId },
    include: { student: true },
  });

  if (!existing) {
    throw new Error('Certificate not found in this institution.');
  }

  if (existing.status === 'REVOKED') {
    throw new Error(`Certificate ${existing.certificateNumber} is already marked as REVOKED.`);
  }

  const revoked = await prisma.issuedCertificate.update({
    where: { id: certificateId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revokedById,
      revocationReason: revocationReason.trim(),
    },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true } },
      revokedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    actorId: revokedById,
    action: 'CERTIFICATE_REVOKED',
    entityType: 'IssuedCertificate',
    entityId: certificateId,
    previousValue: { status: existing.status },
    newValue: { status: 'REVOKED', reason: revocationReason.trim() },
    reason: `Certificate ${existing.certificateNumber} revoked for ${existing.student.name}: ${revocationReason}`,
  });

  return revoked;
};

/**
 * Public certificate authenticity verification endpoint (No Auth Required)
 */
export const verifyCertificatePublic = async ({ tokenOrCertNo, ipAddress = null, userAgent = null }) => {
  if (!tokenOrCertNo || !tokenOrCertNo.trim()) {
    return {
      isValid: false,
      status: 'NOT_FOUND',
      message: 'Certificate verification token or certificate number must be provided.',
    };
  }

  const query = tokenOrCertNo.trim();

  // Search by either verificationToken or certificateNumber
  const cert = await prisma.issuedCertificate.findFirst({
    where: {
      OR: [
        { verificationToken: query },
        { certificateNumber: { equals: query, mode: 'insensitive' } },
      ],
    },
    include: {
      school: { select: { name: true, code: true } },
    },
  });

  if (!cert) {
    return {
      isValid: false,
      status: 'NOT_FOUND',
      message: 'Certificate record not found in the ShikshaTrack National Educational Registry.',
      queryToken: query,
    };
  }

  // Check if expired
  const isExpired = cert.expiryDate ? new Date() > new Date(cert.expiryDate) : false;
  const effectiveStatus = cert.status === 'REVOKED' ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE';
  const isValid = effectiveStatus === 'ACTIVE';

  // Record verification log
  try {
    await prisma.certificateVerificationLog.create({
      data: {
        certificateId: cert.id,
        ipAddress,
        userAgent,
        queryToken: query,
        isValid,
      },
    });
  } catch (err) {
    console.error('Verification log creation failed:', err.message);
  }

  const snapshot = cert.studentSnapshot || {};

  return {
    isValid,
    status: effectiveStatus,
    certificateNumber: cert.certificateNumber,
    type: cert.type,
    title: cert.title,
    studentName: snapshot.name || 'Enrolled Student',
    admissionNumber: snapshot.admissionNumber || 'N/A',
    className: snapshot.className || 'N/A',
    schoolName: cert.school.name,
    schoolCode: cert.school.code,
    issueDate: cert.issueDate,
    expiryDate: cert.expiryDate,
    signatoryTitle: cert.signatoryTitle,
    revocation:
      cert.status === 'REVOKED'
        ? {
            revokedAt: cert.revokedAt,
            reason: cert.revocationReason || 'Revoked by school administration',
          }
        : null,
    verifiedAt: new Date().toISOString(),
  };
};

/**
 * Retrieve statistical summary of certificates
 */
export const getCertificateStats = async ({ schoolId }) => {
  const [total, active, revoked, types] = await Promise.all([
    prisma.issuedCertificate.count({ where: { schoolId } }),
    prisma.issuedCertificate.count({ where: { schoolId, status: 'ACTIVE' } }),
    prisma.issuedCertificate.count({ where: { schoolId, status: 'REVOKED' } }),
    prisma.issuedCertificate.groupBy({
      by: ['type'],
      where: { schoolId },
      _count: { type: true },
    }),
  ]);

  const typeBreakdown = types.reduce((acc, curr) => {
    acc[curr.type] = curr._count.type;
    return acc;
  }, {});

  return {
    totalIssued: total,
    activeCount: active,
    revokedCount: revoked,
    typeBreakdown,
  };
};
