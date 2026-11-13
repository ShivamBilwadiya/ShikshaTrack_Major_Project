import { sendError } from '../utils/response.js';

export const notFoundHandler = (req, res, next) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

export const errorHandler = (err, req, res, next) => {
  console.error('[Error Details]:', err);

  // Prisma Known Request Errors
  if (err.code === 'P2002') {
    const target = err.meta?.target ? ` (${err.meta.target})` : '';
    return sendError(res, `Unique constraint violation. A record with this value already exists${target}.`, 409);
  }

  if (err.code === 'P2025') {
    return sendError(res, 'Record not found in database.', 404);
  }

  if (err.code === 'P2003') {
    return sendError(res, 'Foreign key constraint violated.', 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return sendError(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : null);
};

