import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * Generate a cryptographically secure random token for student QR IDs
 * Format: ST-XXXX-XXXX-XXXX (prefixed for ShikshaTrack)
 */
export const generateSecureQrToken = () => {
  const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `ST-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 12)}`;
};

/**
 * Generate a QR code base64 Data URL for a given token
 */
export const generateQrDataUrl = async (token) => {
  try {
    return await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 256,
      color: {
        dark: '#1e293b', // Navy slate
        light: '#ffffff',
      },
    });
  } catch (err) {
    throw new Error(`Failed to generate QR Code Data URL: ${err.message}`);
  }
};

