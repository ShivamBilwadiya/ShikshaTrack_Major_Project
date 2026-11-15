import * as tcService from '../services/transferCertificateService.js';

/**
 * GET /api/v1/students/tc/preview/:studentId
 */
export const getStudentExitPreview = async (req, res) => {
  try {
    const { studentId } = req.params;
    const preview = await tcService.getStudentExitPreview({
      schoolId: req.user.schoolId,
      studentId,
    });

    return res.json({
      success: true,
      data: preview,
    });
  } catch (err) {
    console.error('Error in getStudentExitPreview:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to generate student exit preview.',
    });
  }
};

/**
 * POST /api/v1/students/tc/issue
 */
export const issueTransferCertificate = async (req, res) => {
  try {
    const {
      studentId,
      exitReason,
      leavingDate,
      conduct,
      remarks,
      allowWithPendingFees,
    } = req.body;

    const certificate = await tcService.issueTransferCertificate({
      schoolId: req.user.schoolId,
      adminUserId: req.user.id,
      studentId,
      exitReason,
      leavingDate,
      conduct,
      remarks,
      allowWithPendingFees: Boolean(allowWithPendingFees),
    });

    return res.status(201).json({
      success: true,
      message: `Transfer Certificate ${certificate.certificateNumber} issued successfully.`,
      data: certificate,
    });
  } catch (err) {
    console.error('Error in issueTransferCertificate:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to issue Transfer Certificate.',
    });
  }
};

/**
 * GET /api/v1/students/tc/history
 */
export const getTransferCertificateHistory = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const history = await tcService.getTransferCertificateHistory({
      schoolId: req.user.schoolId,
      search,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error('Error in getTransferCertificateHistory:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to retrieve Transfer Certificate history.',
    });
  }
};

/**
 * GET /api/v1/students/tc/download/:id
 */
export const downloadTransferCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfBuffer, fileName } = await tcService.generateTransferCertificatePdfBuffer(
      req.user.schoolId,
      id
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error in downloadTransferCertificatePdf:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to download Transfer Certificate PDF.',
    });
  }
};
