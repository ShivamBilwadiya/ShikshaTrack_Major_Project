import * as documentService from '../services/documentService.js';

/**
 * Upload student document (Base64 payload or raw buffer)
 * POST /api/v1/documents
 */
export const uploadDocument = async (req, res) => {
  try {
    const {
      studentId,
      title,
      description,
      category,
      issueDate,
      expiryDate,
      originalName,
      mimeType,
      fileBase64,
    } = req.body;

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        message: 'File payload is required (fileBase64).',
      });
    }

    // Clean base64 string if it contains data URI prefix
    const base64Data = fileBase64.includes(';base64,')
      ? fileBase64.split(';base64,')[1]
      : fileBase64;
    const fileBuffer = Buffer.from(base64Data, 'base64');

    const document = await documentService.uploadStudentDocument({
      schoolId: req.user.schoolId,
      studentId,
      uploadedById: req.user.id,
      title,
      description,
      category,
      issueDate,
      expiryDate,
      fileBuffer,
      originalName: originalName || 'document.pdf',
      mimeType: mimeType || 'application/pdf',
    });

    return res.status(201).json({
      success: true,
      message: 'Student document uploaded successfully.',
      data: document,
    });
  } catch (err) {
    console.error('Error in uploadDocument:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to upload document.',
    });
  }
};

/**
 * Upload replacement version for an existing document
 * POST /api/v1/documents/:id/replace
 */
export const replaceDocumentVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileBase64, originalName, mimeType, changeReason } = req.body;

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        message: 'Replacement file payload is required (fileBase64).',
      });
    }

    const base64Data = fileBase64.includes(';base64,')
      ? fileBase64.split(';base64,')[1]
      : fileBase64;
    const fileBuffer = Buffer.from(base64Data, 'base64');

    const updated = await documentService.replaceDocumentVersion({
      documentId: id,
      schoolId: req.user.schoolId,
      uploadedById: req.user.id,
      fileBuffer,
      originalName: originalName || 'document.pdf',
      mimeType: mimeType || 'application/pdf',
      changeReason,
    });

    return res.json({
      success: true,
      message: 'New document version uploaded successfully.',
      data: updated,
    });
  } catch (err) {
    console.error('Error in replaceDocumentVersion:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to upload replacement version.',
    });
  }
};

/**
 * Retrieve paginated documents with filtering
 * GET /api/v1/documents
 */
export const getDocuments = async (req, res) => {
  try {
    const { studentId, classId, category, status, search, page, limit } = req.query;

    const result = await documentService.getStudentDocuments({
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      studentId,
      classId,
      category,
      status,
      search,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in getDocuments:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve documents.',
    });
  }
};

/**
 * Retrieve document details by ID
 * GET /api/v1/documents/:id
 */
export const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentService.getDocumentById({
      documentId: id,
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
    });

    return res.json({
      success: true,
      data: document,
    });
  } catch (err) {
    console.error('Error in getDocumentById:', err);
    return res.status(404).json({
      success: false,
      message: err.message || 'Document not found.',
    });
  }
};

/**
 * Download / stream document binary file
 * GET /api/v1/documents/:id/download
 */
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.query;

    const { buffer, fileName, mimeType } = await documentService.downloadDocumentFile({
      documentId: id,
      versionNumber: version,
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('Error in downloadDocument:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to download document.',
    });
  }
};

/**
 * Verify document status (Admin or Teacher)
 * POST /api/v1/documents/:id/verify
 */
export const verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verificationNotes } = req.body;

    const updated = await documentService.verifyDocumentStatus({
      documentId: id,
      schoolId: req.user.schoolId,
      verifiedById: req.user.id,
      status,
      verificationNotes,
    });

    return res.json({
      success: true,
      message: `Document status updated to ${status}.`,
      data: updated,
    });
  } catch (err) {
    console.error('Error in verifyDocument:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to update document verification status.',
    });
  }
};

/**
 * Delete document and all versions
 * DELETE /api/v1/documents/:id
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await documentService.deleteStudentDocument({
      documentId: id,
      schoolId: req.user.schoolId,
      deletedById: req.user.id,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in deleteDocument:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to delete document.',
    });
  }
};

/**
 * Retrieve document statistical overview
 * GET /api/v1/documents/stats
 */
export const getDocumentStats = async (req, res) => {
  try {
    const stats = await documentService.getDocumentStats({
      schoolId: req.user.schoolId,
    });

    return res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('Error in getDocumentStats:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve document statistics.',
    });
  }
};
