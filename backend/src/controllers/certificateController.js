import * as certificateService from '../services/certificateService.js';

/**
 * Retrieve certificate templates
 * GET /api/v1/certificates/templates
 */
export const getTemplates = async (req, res) => {
  try {
    const { type, activeOnly } = req.query;
    const templates = await certificateService.getCertificateTemplates({
      schoolId: req.user.schoolId,
      type,
      activeOnly: activeOnly === 'false' ? false : true,
    });

    return res.json({
      success: true,
      data: templates,
    });
  } catch (err) {
    console.error('Error in getTemplates:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve certificate templates.',
    });
  }
};

/**
 * Retrieve single certificate template
 * GET /api/v1/certificates/templates/:id
 */
export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await certificateService.getCertificateTemplateById({
      templateId: id,
      schoolId: req.user.schoolId,
    });

    return res.json({
      success: true,
      data: template,
    });
  } catch (err) {
    console.error('Error in getTemplateById:', err);
    return res.status(404).json({
      success: false,
      message: err.message || 'Certificate template not found.',
    });
  }
};

/**
 * Create custom certificate template
 * POST /api/v1/certificates/templates
 */
export const createTemplate = async (req, res) => {
  try {
    const {
      name,
      type,
      title,
      headerText,
      bodyTemplate,
      footerText,
      signatoryTitle,
      signatoryName,
      watermarkText,
      validityMonths,
    } = req.body;

    const template = await certificateService.createCertificateTemplate({
      schoolId: req.user.schoolId,
      createdById: req.user.id,
      name,
      type,
      title,
      headerText,
      bodyTemplate,
      footerText,
      signatoryTitle,
      signatoryName,
      watermarkText,
      validityMonths,
    });

    return res.status(201).json({
      success: true,
      message: 'Certificate template created successfully.',
      data: template,
    });
  } catch (err) {
    console.error('Error in createTemplate:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create certificate template.',
    });
  }
};

/**
 * Update certificate template
 * PUT /api/v1/certificates/templates/:id
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await certificateService.updateCertificateTemplate({
      templateId: id,
      schoolId: req.user.schoolId,
      updatedById: req.user.id,
      ...req.body,
    });

    return res.json({
      success: true,
      message: 'Certificate template updated successfully.',
      data: updated,
    });
  } catch (err) {
    console.error('Error in updateTemplate:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to update certificate template.',
    });
  }
};

/**
 * Delete / deactivate certificate template
 * DELETE /api/v1/certificates/templates/:id
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await certificateService.deleteCertificateTemplate({
      templateId: id,
      schoolId: req.user.schoolId,
      deletedById: req.user.id,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error in deleteTemplate:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to delete certificate template.',
    });
  }
};

/**
 * Issue a new certificate
 * POST /api/v1/certificates/issue
 */
export const issueCertificate = async (req, res) => {
  try {
    const {
      studentId,
      templateId,
      type,
      customTitle,
      customBody,
      signatoryTitle,
      signatoryName,
      validityMonths,
      remarks,
      certificateData,
    } = req.body;

    const certificate = await certificateService.issueCertificate({
      schoolId: req.user.schoolId,
      issuedById: req.user.id,
      studentId,
      templateId,
      type,
      customTitle,
      customBody,
      signatoryTitle,
      signatoryName,
      validityMonths,
      remarks,
      certificateData,
    });

    return res.status(201).json({
      success: true,
      message: `Certificate ${certificate.certificateNumber} issued successfully.`,
      data: certificate,
    });
  } catch (err) {
    console.error('Error in issueCertificate:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to issue certificate.',
    });
  }
};

/**
 * Retrieve paginated list of issued certificates
 * GET /api/v1/certificates
 */
export const getCertificates = async (req, res) => {
  try {
    const { studentId, classId, type, status, search, page, limit } = req.query;

    const result = await certificateService.getIssuedCertificates({
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      studentId,
      classId,
      type,
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
    console.error('Error in getCertificates:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve certificates.',
    });
  }
};

/**
 * Retrieve single issued certificate
 * GET /api/v1/certificates/:id
 */
export const getCertificateById = async (req, res) => {
  try {
    const { id } = req.params;
    const cert = await certificateService.getCertificateById({
      certificateId: id,
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
    });

    return res.json({
      success: true,
      data: cert,
    });
  } catch (err) {
    console.error('Error in getCertificateById:', err);
    return res.status(404).json({
      success: false,
      message: err.message || 'Certificate not found.',
    });
  }
};

/**
 * Download Printable PDF for an issued certificate
 * GET /api/v1/certificates/:id/pdf
 */
export const downloadCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const { buffer, fileName, mimeType } = await certificateService.generateCertificatePdfBuffer({
      certificateId: id,
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      baseUrl,
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('Error in downloadCertificatePdf:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to generate certificate PDF.',
    });
  }
};

/**
 * Revoke an issued certificate
 * POST /api/v1/certificates/:id/revoke
 */
export const revokeCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const revoked = await certificateService.revokeCertificate({
      certificateId: id,
      schoolId: req.user.schoolId,
      revokedById: req.user.id,
      revocationReason: reason,
    });

    return res.json({
      success: true,
      message: `Certificate ${revoked.certificateNumber} has been revoked.`,
      data: revoked,
    });
  } catch (err) {
    console.error('Error in revokeCertificate:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to revoke certificate.',
    });
  }
};

/**
 * Public certificate authenticity verification (No Auth Required)
 * GET /api/v1/certificates/verify/:tokenOrCertNo
 */
export const verifyPublicCertificate = async (req, res) => {
  try {
    const { tokenOrCertNo } = req.params;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await certificateService.verifyCertificatePublic({
      tokenOrCertNo,
      ipAddress,
      userAgent,
    });

    const statusCode = result.status === 'NOT_FOUND' ? 404 : 200;
    return res.status(statusCode).json({
      success: result.isValid,
      data: result,
    });
  } catch (err) {
    console.error('Error in verifyPublicCertificate:', err);
    return res.status(500).json({
      success: false,
      message: 'Certificate verification failed due to internal error.',
    });
  }
};

/**
 * Retrieve certificate statistical overview
 * GET /api/v1/certificates/stats
 */
export const getCertificateStats = async (req, res) => {
  try {
    const stats = await certificateService.getCertificateStats({
      schoolId: req.user.schoolId,
    });

    return res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('Error in getCertificateStats:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve certificate statistics.',
    });
  }
};
