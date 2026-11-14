import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Base directory for secure student document storage
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

// Ensure directory exists with restricted permissions
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o700 });
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];

/**
 * Validate incoming file payload for type and size constraints
 */
export const validateDocumentPayload = ({ mimeType, fileSize, originalName }) => {
  const errors = [];

  if (!fileSize || fileSize <= 0) {
    errors.push('File content is empty or missing.');
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    errors.push(`File exceeds maximum permitted size of 10 MB (received ${(fileSize / (1024 * 1024)).toFixed(2)} MB).`);
  }

  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    errors.push(`Unsupported MIME type "${mimeType}". Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX.`);
  }

  if (originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push(`File extension "${ext}" is not permitted.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Compute SHA-256 integrity hash for document buffer
 */
export const computeBufferHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Sanitize filename to prevent directory traversal and dangerous characters
 */
export const sanitizeFileName = (fileName) => {
  if (!fileName) return 'unnamed_document';
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 100);
};

/**
 * Save binary buffer to secure storage
 */
export const saveDocumentFile = async ({ buffer, originalName, mimeType }) => {
  const validation = validateDocumentPayload({ mimeType, fileSize: buffer.length, originalName });
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const fileHash = computeBufferHash(buffer);
  const sanitized = sanitizeFileName(originalName);
  const ext = path.extname(sanitized) || '.bin';
  const uniqueKey = `doc_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const relativeFilePath = path.join('uploads', 'documents', uniqueKey);
  const absolutePath = path.resolve(process.cwd(), relativeFilePath);

  await fs.promises.writeFile(absolutePath, buffer, { mode: 0o600 });

  return {
    filePath: relativeFilePath,
    fileName: sanitized,
    fileSize: buffer.length,
    mimeType: mimeType || 'application/octet-stream',
    fileHash,
  };
};

/**
 * Read document binary buffer from storage
 */
export const readDocumentFile = async (filePath) => {
  if (!filePath) {
    throw new Error('File path must be provided.');
  }

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  // Security check: ensure path is within uploads directory
  const normalizedUploads = path.normalize(UPLOADS_DIR);
  const normalizedTarget = path.normalize(absolutePath);
  if (!normalizedTarget.startsWith(normalizedUploads)) {
    throw new Error('Security violation: Attempted unauthorized directory access.');
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error('Document file not found on storage server.');
  }

  return await fs.promises.readFile(absolutePath);
};

/**
 * Safely delete document file from storage
 */
export const deleteDocumentFile = async (filePath) => {
  if (!filePath) return false;

  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    const normalizedUploads = path.normalize(UPLOADS_DIR);
    const normalizedTarget = path.normalize(absolutePath);
    if (!normalizedTarget.startsWith(normalizedUploads)) {
      return false;
    }

    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
      return true;
    }
  } catch (err) {
    console.error(`Failed to delete document file at ${filePath}:`, err.message);
  }
  return false;
};

/**
 * Encode document as Base64 data URL for web previews
 */
export const getDocumentBase64 = async (filePath, mimeType = 'application/pdf') => {
  const buffer = await readDocumentFile(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};
