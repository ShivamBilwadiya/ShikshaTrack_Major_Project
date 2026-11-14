import * as feeService from '../services/feeService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const createStructure = async (req, res, next) => {
  try {
    const structure = await feeService.createFeeStructure({
      ...req.body,
      schoolId: req.user.schoolId,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Fee structure created successfully.', structure, 201);
  } catch (err) {
    next(err);
  }
};

export const listStructures = async (req, res, next) => {
  try {
    const structures = await feeService.listFeeStructures({
      ...req.query,
      schoolId: req.user.schoolId,
    });
    return sendSuccess(res, 'Fee structures retrieved.', structures);
  } catch (err) {
    next(err);
  }
};

export const updateStructure = async (req, res, next) => {
  try {
    const updated = await feeService.updateFeeStructure(
      req.params.id,
      req.user.schoolId,
      req.body,
      req.user.id
    );
    return sendSuccess(res, 'Fee structure updated.', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteStructure = async (req, res, next) => {
  try {
    const deleted = await feeService.deleteFeeStructure(
      req.params.id,
      req.user.schoolId,
      req.user.id
    );
    return sendSuccess(res, 'Fee structure deleted.', deleted);
  } catch (err) {
    next(err);
  }
};

export const assignStudentFee = async (req, res, next) => {
  try {
    const assigned = await feeService.assignFeeToStudent({
      ...req.body,
      schoolId: req.user.schoolId,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Fee assigned to student successfully.', assigned, 201);
  } catch (err) {
    next(err);
  }
};

export const assignClassFee = async (req, res, next) => {
  try {
    const result = await feeService.assignFeeToClass({
      ...req.body,
      schoolId: req.user.schoolId,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Fee assigned to class roster.', result, 201);
  } catch (err) {
    next(err);
  }
};

export const applyDiscount = async (req, res, next) => {
  try {
    const result = await feeService.applyDiscount({
      studentFeeId: req.params.id,
      schoolId: req.user.schoolId,
      approvedById: req.user.id,
      ...req.body,
    });
    return sendSuccess(res, 'Discount applied successfully.', result);
  } catch (err) {
    next(err);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const payment = await feeService.recordPayment({
      ...req.body,
      schoolId: req.user.schoolId,
      recordedById: req.user.id,
    });
    return sendSuccess(res, 'Fee payment recorded successfully.', payment, 201);
  } catch (err) {
    next(err);
  }
};

export const reversePayment = async (req, res, next) => {
  try {
    const reversed = await feeService.reversePayment({
      feePaymentId: req.params.id,
      schoolId: req.user.schoolId,
      approvedById: req.user.id,
      reason: req.body.reason,
    });
    return sendSuccess(res, 'Payment reversed and balance restored.', reversed);
  } catch (err) {
    next(err);
  }
};

export const getStudentStatement = async (req, res, next) => {
  try {
    const statement = await feeService.getStudentFeeStatement(
      req.params.studentId,
      req.user.schoolId
    );
    return sendSuccess(res, 'Student fee statement retrieved.', statement);
  } catch (err) {
    next(err);
  }
};

export const getReceipt = async (req, res, next) => {
  try {
    const receipt = await feeService.getReceiptDetails(
      req.params.receiptNumber,
      req.user.schoolId
    );
    return sendSuccess(res, 'Payment receipt retrieved.', receipt);
  } catch (err) {
    next(err);
  }
};

export const getOverdueFees = async (req, res, next) => {
  try {
    const overdue = await feeService.getOverdueFees({
      schoolId: req.user.schoolId,
      classId: req.query.classId,
      asOfDate: req.query.asOfDate,
    });
    return sendSuccess(res, 'Overdue fees retrieved.', overdue);
  } catch (err) {
    next(err);
  }
};

export const getCollectionSummary = async (req, res, next) => {
  try {
    const summary = await feeService.getFeeCollectionSummary({
      schoolId: req.user.schoolId,
      classId: req.query.classId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    return sendSuccess(res, 'Fee collection summary retrieved.', summary);
  } catch (err) {
    next(err);
  }
};

export const getClassCollectionReport = async (req, res, next) => {
  try {
    const report = await feeService.getClassFeeCollectionReport({
      schoolId: req.user.schoolId,
      academicYear: req.query.academicYear,
    });
    return sendSuccess(res, 'Class fee collection report retrieved.', report);
  } catch (err) {
    next(err);
  }
};

export const exportCsv = async (req, res, next) => {
  try {
    const { classId, type } = req.query;
    const csv = await feeService.generateFeeCsv({
      schoolId: req.user.schoolId,
      classId,
      type: type || 'overdue',
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fee_${type || 'report'}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
