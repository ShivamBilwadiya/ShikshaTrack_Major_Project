import * as studentService from '../services/studentService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getStudents = async (req, res, next) => {
  try {
    const { classId, search, active, page, limit } = req.query;
    const result = await studentService.listStudents({
      schoolId: req.user.schoolId,
      classId,
      search,
      active,
      page,
      limit,
    });
    return sendSuccess(res, 'Students retrieved successfully.', result);
  } catch (err) {
    next(err);
  }
};

export const getStudent = async (req, res, next) => {
  try {
    const student = await studentService.getStudentById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Student retrieved successfully.', student);
  } catch (err) {
    next(err);
  }
};

export const getStudentByQr = async (req, res, next) => {
  try {
    const { token } = req.params;
    const student = await studentService.getStudentByQrToken(token, req.user.schoolId);
    return sendSuccess(res, 'Student resolved from QR token.', student);
  } catch (err) {
    return sendError(res, err.message, 404);
  }
};

export const validateAdmissionNumber = (admissionNumber, isRequired = true) => {
  if (admissionNumber === undefined || admissionNumber === null) {
    return isRequired ? 'Admission number is required and cannot be empty.' : null;
  }

  if (typeof admissionNumber !== 'string') {
    return 'Admission number must be a valid string.';
  }

  const trimmed = admissionNumber.trim();
  if (trimmed.length === 0) {
    return 'Admission number cannot be empty.';
  }

  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
    return 'Admission number must contain only letters, numbers, and hyphens.';
  }

  if (trimmed.length < 3 || trimmed.length > 30) {
    return 'Admission number must be between 3 and 30 characters.';
  }

  return null;
};

export const normalizeAdmissionNumber = (admissionNumber) => {
  if (!admissionNumber || typeof admissionNumber !== 'string') return admissionNumber;
  return admissionNumber.trim().toUpperCase();
};

const validateStudentPayload = (body, isUpdate = false) => {
  const { name, admissionNumber, rollNumber, classId, dateOfBirth, gender, guardianPhone } = body;

  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return 'Student full name is required and must be at least 2 characters.';
    }
  }

  if (!isUpdate || admissionNumber !== undefined) {
    const admissionError = validateAdmissionNumber(admissionNumber, !isUpdate);
    if (admissionError) {
      return admissionError;
    }
  }

  if (!isUpdate || classId !== undefined) {
    if (!classId || typeof classId !== 'string') {
      return 'A valid class assignment is required.';
    }
  }

  if (rollNumber !== undefined && rollNumber !== null && rollNumber !== '') {
    const parsedRoll = parseInt(rollNumber, 10);
    if (isNaN(parsedRoll) || parsedRoll <= 0) {
      return 'Roll number must be a positive integer.';
    }
  }

  if (guardianPhone !== undefined && guardianPhone !== null && guardianPhone !== '') {
    const cleanPhone = String(guardianPhone).replace(/[\s+-]/g, '');
    if (!/^\d{10,12}$/.test(cleanPhone)) {
      return 'Guardian contact phone must be a valid 10-digit number.';
    }
  }

  if (gender !== undefined && gender !== null && gender !== '') {
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return 'Gender must be one of: Male, Female, Other.';
    }
  }

  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '') {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()) || dob > new Date()) {
      return 'Date of birth must be a valid past date.';
    }
  }

  return null;
};

export const createStudent = async (req, res, next) => {
  try {
    const validationError = validateStudentPayload(req.body, false);
    if (validationError) {
      return sendError(res, validationError, 400);
    }

    const { name, admissionNumber, rollNumber, classId, dateOfBirth, gender, guardianName, guardianPhone } = req.body;

    const student = await studentService.createStudent({
      name,
      admissionNumber: normalizeAdmissionNumber(admissionNumber),
      rollNumber,
      classId,
      schoolId: req.user.schoolId,
      dateOfBirth,
      gender,
      guardianName,
      guardianPhone,
      actorId: req.user.id,
    });

    return sendSuccess(res, 'Student registered successfully.', student, 201);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
};

export const updateStudent = async (req, res, next) => {
  try {
    const validationError = validateStudentPayload(req.body, true);
    if (validationError) {
      return sendError(res, validationError, 400);
    }

    const updatePayload = {
      ...req.body,
      actorId: req.user.id,
    };

    if (req.body.admissionNumber !== undefined) {
      updatePayload.admissionNumber = normalizeAdmissionNumber(req.body.admissionNumber);
    }

    const updated = await studentService.updateStudent(req.params.id, req.user.schoolId, updatePayload);
    return sendSuccess(res, 'Student updated successfully.', updated);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
};

export const regenerateQr = async (req, res, next) => {
  try {
    const result = await studentService.regenerateStudentQrToken(req.params.id, req.user.schoolId, req.user.id);
    return sendSuccess(res, 'New QR Token generated successfully.', result);
  } catch (err) {
    next(err);
  }
};

export const getPrintableCards = async (req, res, next) => {
  try {
    const { classId } = req.query;
    const cards = await studentService.getPrintableCards(req.user.schoolId, classId);
    return sendSuccess(res, 'Printable QR ID cards generated successfully.', cards);
  } catch (err) {
    next(err);
  }
};

export const importStudentsCsv = async (req, res, next) => {
  try {
    const { csvContent, defaultClassId } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return sendError(res, 'CSV content string is required in request body (csvContent).', 400);
    }

    const result = await studentService.bulkImportStudents({
      schoolId: req.user.schoolId,
      csvContent,
      defaultClassId,
      actorId: req.user.id,
    });

    return sendSuccess(
      res,
      `CSV import completed: ${result.summary.importedCount} imported, ${result.summary.skippedCount} skipped, ${result.summary.failedCount} errors.`,
      result,
      result.summary.importedCount > 0 ? 201 : 200
    );
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }
};
