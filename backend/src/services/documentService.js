import prisma from '../config/db.js';
import { logAudit } from './auditService.js';
import {
  saveDocumentFile,
  readDocumentFile,
  deleteDocumentFile,
  getDocumentBase64,
  validateDocumentPayload,
} from '../utils/documentStorage.js';

/**
 * Upload student document and initialize version 1
 */
export const uploadStudentDocument = async ({
  schoolId,
  studentId,
  uploadedById,
  title,
  description = null,
  category = 'OTHER',
  issueDate = null,
  expiryDate = null,
  fileBuffer,
  originalName,
  mimeType,
}) => {
  if (!studentId || !title || !fileBuffer || !originalName) {
    throw new Error('Student ID, title, and file content are required.');
  }

  // Verify student exists and belongs to this school
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, active: true },
    include: { class: true },
  });

  if (!student) {
    throw new Error('Student not found or does not belong to this institution.');
  }

  // Save physical file
  const saved = await saveDocumentFile({ buffer: fileBuffer, originalName, mimeType });

  // Atomic database transaction
  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.studentDocument.create({
      data: {
        schoolId,
        studentId,
        uploadedById,
        title: title.trim(),
        description: description ? description.trim() : null,
        category,
        status: 'PENDING',
        currentVersion: 1,
        filePath: saved.filePath,
        fileName: saved.fileName,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        fileHash: saved.fileHash,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });

    await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        filePath: saved.filePath,
        fileName: saved.fileName,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        fileHash: saved.fileHash,
        changeReason: 'Initial document upload',
        uploadedById,
      },
    });

    return doc;
  });

  await logAudit({
    actorId: uploadedById,
    action: 'DOCUMENT_UPLOADED',
    entityType: 'StudentDocument',
    entityId: document.id,
    newValue: { title: document.title, category: document.category, studentId: student.id, studentName: student.name },
    reason: `Uploaded new document "${document.title}" for student ${student.name}.`,
  });

  return await getDocumentById({ documentId: document.id, schoolId });
};

/**
 * Replace student document with a new version
 */
export const replaceDocumentVersion = async ({
  documentId,
  schoolId,
  uploadedById,
  fileBuffer,
  originalName,
  mimeType,
  changeReason = 'Updated document version',
}) => {
  if (!documentId || !fileBuffer || !originalName) {
    throw new Error('Document ID and file content are required.');
  }

  const existingDoc = await prisma.studentDocument.findFirst({
    where: { id: documentId, schoolId },
    include: { student: true },
  });

  if (!existingDoc) {
    throw new Error('Document not found in this institution.');
  }

  const nextVersion = existingDoc.currentVersion + 1;
  const saved = await saveDocumentFile({ buffer: fileBuffer, originalName, mimeType });

  const updatedDoc = await prisma.$transaction(async (tx) => {
    const updated = await tx.studentDocument.update({
      where: { id: documentId },
      data: {
        currentVersion: nextVersion,
        filePath: saved.filePath,
        fileName: saved.fileName,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        fileHash: saved.fileHash,
        status: 'PENDING', // Reset verification for new version
        verifiedAt: null,
        verifiedById: null,
        verificationNotes: null,
      },
    });

    await tx.documentVersion.create({
      data: {
        documentId,
        versionNumber: nextVersion,
        filePath: saved.filePath,
        fileName: saved.fileName,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        fileHash: saved.fileHash,
        changeReason: changeReason ? changeReason.trim() : `Replaced with version ${nextVersion}`,
        uploadedById,
      },
    });

    return updated;
  });

  await logAudit({
    actorId: uploadedById,
    action: 'DOCUMENT_VERSION_ADDED',
    entityType: 'StudentDocument',
    entityId: updatedDoc.id,
    previousValue: { version: existingDoc.currentVersion, fileName: existingDoc.fileName },
    newValue: { version: nextVersion, fileName: saved.fileName, reason: changeReason },
    reason: `Uploaded version ${nextVersion} for document "${existingDoc.title}".`,
  });

  return await getDocumentById({ documentId, schoolId });
};

/**
 * Retrieve paginated documents with filtering and search
 */
export const getStudentDocuments = async ({
  schoolId,
  userRole = 'ADMIN',
  userId = null,
  studentId = null,
  classId = null,
  category = null,
  status = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const where = { schoolId };

  // Parent RBAC: Parent can only view documents of their linked children
  if (userRole === 'PARENT') {
    const parentProfile = await prisma.parent.findUnique({
      where: { userId },
      include: { students: { select: { studentId: true } } },
    });

    if (!parentProfile || !parentProfile.students.length) {
      return { documents: [], total: 0, page: Number(page), totalPages: 0 };
    }

    const linkedStudentIds = parentProfile.students.map((c) => c.studentId);
    if (studentId) {
      if (!linkedStudentIds.includes(studentId)) {
        throw new Error('Unauthorized: You can only view documents for your registered children.');
      }
      where.studentId = studentId;
    } else {
      where.studentId = { in: linkedStudentIds };
    }
  } else if (studentId) {
    where.studentId = studentId;
  }

  if (category) {
    where.category = category;
  }

  if (status) {
    where.status = status;
  }

  if (classId) {
    where.student = { ...(where.student || {}), classId };
  }

  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { fileName: { contains: query, mode: 'insensitive' } },
      { student: { name: { contains: query, mode: 'insensitive' } } },
      { student: { admissionNumber: { contains: query, mode: 'insensitive' } } },
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Math.min(100, Math.max(1, Number(limit)));

  const [total, documents] = await Promise.all([
    prisma.studentDocument.count({ where }),
    prisma.studentDocument.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
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
        uploadedBy: { select: { id: true, name: true, email: true, role: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { versions: true } },
      },
    }),
  ]);

  return {
    documents,
    total,
    page: Number(page),
    limit: take,
    totalPages: Math.ceil(total / take),
  };
};

/**
 * Retrieve document metadata and its version history
 */
export const getDocumentById = async ({ documentId, schoolId, userRole = 'ADMIN', userId = null }) => {
  const document = await prisma.studentDocument.findFirst({
    where: { id: documentId, schoolId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          admissionNumber: true,
          rollNumber: true,
          dateOfBirth: true,
          guardianName: true,
          guardianPhone: true,
          class: { select: { id: true, name: true, section: true } },
        },
      },
      uploadedBy: { select: { id: true, name: true, email: true, role: true } },
      verifiedBy: { select: { id: true, name: true, email: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!document) {
    throw new Error('Document not found.');
  }

  // Parent isolation
  if (userRole === 'PARENT') {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { students: { select: { studentId: true } } },
    });
    const linkedIds = parent?.students?.map((c) => c.studentId) || [];
    if (!linkedIds.includes(document.studentId)) {
      throw new Error('Unauthorized: You cannot access documents of unrelated students.');
    }
  }

  return document;
};

/**
 * Stream/download document file (current version or specific version number)
 */
export const downloadDocumentFile = async ({
  documentId,
  versionNumber = null,
  schoolId,
  userRole = 'ADMIN',
  userId = null,
}) => {
  const document = await getDocumentById({ documentId, schoolId, userRole, userId });

  let targetFilePath = document.filePath;
  let targetFileName = document.fileName;
  let targetMimeType = document.mimeType;
  let targetFileSize = document.fileSize;

  if (versionNumber) {
    const verNum = Number(versionNumber);
    const ver = document.versions.find((v) => v.versionNumber === verNum);
    if (!ver) {
      throw new Error(`Version ${verNum} does not exist for this document.`);
    }
    targetFilePath = ver.filePath;
    targetFileName = ver.fileName;
    targetMimeType = ver.mimeType;
    targetFileSize = ver.fileSize;
  }

  const buffer = await readDocumentFile(targetFilePath);

  return {
    buffer,
    fileName: targetFileName,
    mimeType: targetMimeType,
    fileSize: targetFileSize,
  };
};

/**
 * Review & update document verification status (ADMIN or TEACHER)
 */
export const verifyDocumentStatus = async ({
  documentId,
  schoolId,
  verifiedById,
  status,
  verificationNotes = null,
}) => {
  const validStatuses = ['VERIFIED', 'REJECTED', 'PENDING', 'EXPIRED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  const existingDoc = await prisma.studentDocument.findFirst({
    where: { id: documentId, schoolId },
    include: { student: true },
  });

  if (!existingDoc) {
    throw new Error('Document not found in this institution.');
  }

  const updated = await prisma.studentDocument.update({
    where: { id: documentId },
    data: {
      status,
      verifiedById: status === 'PENDING' ? null : verifiedById,
      verifiedAt: status === 'PENDING' ? null : new Date(),
      verificationNotes: verificationNotes ? verificationNotes.trim() : null,
    },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true } },
      verifiedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    actorId: verifiedById,
    action: 'DOCUMENT_STATUS_UPDATED',
    entityType: 'StudentDocument',
    entityId: updated.id,
    previousValue: { status: existingDoc.status },
    newValue: { status, notes: verificationNotes },
    reason: `Document "${existingDoc.title}" status changed to ${status}.`,
  });

  return updated;
};

/**
 * Delete student document and its physical version files
 */
export const deleteStudentDocument = async ({ documentId, schoolId, deletedById }) => {
  const doc = await prisma.studentDocument.findFirst({
    where: { id: documentId, schoolId },
    include: { versions: true, student: true },
  });

  if (!doc) {
    throw new Error('Document not found.');
  }

  // Delete all physical files from disk
  const filesToDelete = new Set([doc.filePath, ...doc.versions.map((v) => v.filePath)]);
  for (const filePath of filesToDelete) {
    await deleteDocumentFile(filePath);
  }

  await prisma.studentDocument.delete({ where: { id: documentId } });

  await logAudit({
    actorId: deletedById,
    action: 'DOCUMENT_DELETED',
    entityType: 'StudentDocument',
    entityId: documentId,
    previousValue: { title: doc.title, category: doc.category, studentId: doc.studentId, studentName: doc.student.name },
    reason: `Permanently deleted document "${doc.title}" and its ${doc.versions.length} versions.`,
  });

  return { success: true, message: `Document "${doc.title}" deleted successfully.` };
};

/**
 * Retrieve statistical summary of documents
 */
export const getDocumentStats = async ({ schoolId }) => {
  const [total, verified, pending, rejected, expired, categories] = await Promise.all([
    prisma.studentDocument.count({ where: { schoolId } }),
    prisma.studentDocument.count({ where: { schoolId, status: 'VERIFIED' } }),
    prisma.studentDocument.count({ where: { schoolId, status: 'PENDING' } }),
    prisma.studentDocument.count({ where: { schoolId, status: 'REJECTED' } }),
    prisma.studentDocument.count({ where: { schoolId, status: 'EXPIRED' } }),
    prisma.studentDocument.groupBy({
      by: ['category'],
      where: { schoolId },
      _count: { category: true },
    }),
  ]);

  const categoryBreakdown = categories.reduce((acc, curr) => {
    acc[curr.category] = curr._count.category;
    return acc;
  }, {});

  return {
    totalDocuments: total,
    verifiedCount: verified,
    pendingCount: pending,
    rejectedCount: rejected,
    expiredCount: expired,
    categoryBreakdown,
  };
};
