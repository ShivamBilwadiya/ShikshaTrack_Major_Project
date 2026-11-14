import * as examService from '../services/examService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getExams = async (req, res, next) => {
  try {
    const { classId, academicYear } = req.query;
    const exams = await examService.listExaminations({
      schoolId: req.user.schoolId,
      classId,
      academicYear,
    });
    return sendSuccess(res, 'Examinations retrieved successfully.', exams);
  } catch (err) {
    next(err);
  }
};

export const getExam = async (req, res, next) => {
  try {
    const exam = await examService.getExaminationById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Examination details retrieved.', exam);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const createExam = async (req, res, next) => {
  try {
    const { name, examType, academicYear, classId, startDate, endDate, description, subjects } = req.body;
    const exam = await examService.createExamination({
      schoolId: req.user.schoolId,
      name,
      examType,
      academicYear,
      classId,
      startDate,
      endDate,
      description,
      subjects,
      actorId: req.user.id,
    });
    return sendSuccess(res, 'Examination created successfully.', exam, 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const updateExam = async (req, res, next) => {
  try {
    const updated = await examService.updateExamination(req.params.id, req.user.schoolId, req.body, req.user.id);
    return sendSuccess(res, 'Examination updated successfully.', updated);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const deleteExam = async (req, res, next) => {
  try {
    const result = await examService.deleteExamination(req.params.id, req.user.schoolId, req.user.id);
    return sendSuccess(res, result.message, { id: result.id });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const addSubject = async (req, res, next) => {
  try {
    const { subject, maxMarks, passMarks, examDate } = req.body;
    const examSubject = await examService.addExamSubject(
      req.params.id,
      req.user.schoolId,
      { subject, maxMarks, passMarks, examDate },
      req.user.id
    );
    return sendSuccess(res, 'Subject added to examination.', examSubject, 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const recordMarks = async (req, res, next) => {
  try {
    const { marks } = req.body;
    const result = await examService.recordSubjectMarks(
      req.params.subjectId,
      req.user.schoolId,
      marks,
      req.user.id
    );
    return sendSuccess(res, 'Subject marks recorded successfully.', result);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getClassResults = async (req, res, next) => {
  try {
    const { classId } = req.query;
    const results = await examService.getClassExamResults(
      req.params.id,
      classId,
      req.user.schoolId
    );
    return sendSuccess(res, 'Class examination results calculated.', results);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const exportClassResultsCsv = async (req, res, next) => {
  try {
    const { classId } = req.query;
    const { filename, csvContent } = await examService.generateClassResultCsv(
      req.params.id,
      classId,
      req.user.schoolId
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};
