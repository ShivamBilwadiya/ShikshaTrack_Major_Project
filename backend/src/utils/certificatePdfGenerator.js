import QRCode from 'qrcode';

/**
 * Escape text for PDF literal strings (handling backslashes and parentheses)
 */
const escapePdfText = (text) => {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
};

/**
 * Word wrap helper for PDF text
 */
const wrapText = (text, maxCharsPerLine = 75) => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

/**
 * Generate a vector QR code PDF graphics stream
 */
const generateVectorQrCode = (qrData, x, y, size) => {
  const qr = QRCode.create(qrData, { errorCorrectionLevel: 'M' });
  const moduleCount = qr.modules.size;
  const cellSize = size / moduleCount;
  let stream = '';

  // Draw white background
  stream += `q 1 1 1 rg ${x} ${y} ${size} ${size} re f Q\n`;
  // Draw black modules
  stream += `q 0.05 0.1 0.25 rg\n`;
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.modules.get(r, c)) {
        const mx = x + c * cellSize;
        const my = y + (moduleCount - 1 - r) * cellSize;
        stream += `${mx.toFixed(2)} ${my.toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f\n`;
      }
    }
  }
  stream += `Q\n`;
  return stream;
};

/**
 * Build professional PDF certificate
 * @param {Object} options
 * @param {string} options.schoolName
 * @param {string} options.schoolCode
 * @param {string} options.schoolAddress
 * @param {string} options.contactEmail
 * @param {string} options.contactPhone
 * @param {string} options.title
 * @param {string} options.certificateNumber
 * @param {string} options.issueDate
 * @param {string} options.signatoryTitle
 * @param {string} options.signatoryName
 * @param {string} options.bodyText
 * @param {Object} options.studentInfo
 * @param {string} options.verificationUrl
 * @param {string} options.verificationToken
 * @param {string} options.watermarkText
 * @returns {Buffer} Standard PDF 1.4 binary buffer
 */
export const generateCertificatePdf = async ({
  schoolName = 'SHIKSHATRACK MODEL ACADEMY',
  schoolCode = 'ST-IND-2026',
  schoolAddress = 'Rural Education Development Center, National Highway 8',
  contactEmail = 'admin@shikshatrack.in',
  contactPhone = '+91 98765 43210',
  title = 'BONAFIDE CERTIFICATE',
  certificateNumber = 'CERT-2026-0001',
  issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
  signatoryTitle = 'Principal / Head of Institution',
  signatoryName = 'Authorized Signatory',
  bodyText = 'This is to certify that the student is a bonafide pupil of this institution.',
  studentInfo = {},
  verificationUrl = 'https://shikshatrack.in/verify-certificate',
  verificationToken = '',
  watermarkText = 'OFFICIAL CERTIFICATE',
}) => {
  // Page setup: Standard A4 Portrait (595.28 x 841.89 points)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;

  let stream = '';

  // 1. Decorative Borders
  // Outer Border (Navy)
  stream += `q 0.08 0.18 0.36 RG 3 w ${margin} ${margin} ${pageWidth - margin * 2} ${pageHeight - margin * 2} re S Q\n`;
  // Inner Border (Gold)
  const innerMargin = margin + 6;
  stream += `q 0.78 0.62 0.18 RG 1.5 w ${innerMargin} ${innerMargin} ${pageWidth - innerMargin * 2} ${pageHeight - innerMargin * 2} re S Q\n`;
  // Corner ornaments
  const cornerSize = 14;
  stream += `q 0.78 0.62 0.18 rg\n`;
  stream += `${innerMargin} ${innerMargin} ${cornerSize} ${cornerSize} re f\n`;
  stream += `${pageWidth - innerMargin - cornerSize} ${innerMargin} ${cornerSize} ${cornerSize} re f\n`;
  stream += `${innerMargin} ${pageHeight - innerMargin - cornerSize} ${cornerSize} ${cornerSize} re f\n`;
  stream += `${pageWidth - innerMargin - cornerSize} ${pageHeight - innerMargin - cornerSize} ${cornerSize} ${cornerSize} re f\n`;
  stream += `Q\n`;

  // 2. Watermark Text in center
  stream += `q 0.93 0.94 0.96 rg /F2 38 Tf\n`;
  stream += `1 0 0 1 ${pageWidth / 2 - 190} ${pageHeight / 2 - 10} Tm\n`;
  stream += `(${escapePdfText(watermarkText.toUpperCase())}) Tj Q\n`;

  // 3. Header Ribbon / Institution Emblem
  stream += `q 0.08 0.18 0.36 rg\n`;
  stream += `${pageWidth / 2 - 220} ${pageHeight - 90} 440 2 re f Q\n`;

  // School Name
  stream += `q 0.08 0.18 0.36 rg /F2 20 Tf\n`;
  const schoolNameX = Math.max(margin + 20, (pageWidth - schoolName.length * 11) / 2);
  stream += `1 0 0 1 ${schoolNameX.toFixed(2)} ${pageHeight - 75} Tm\n`;
  stream += `(${escapePdfText(schoolName.toUpperCase())}) Tj Q\n`;

  // School Subtitle / Code & Address
  stream += `q 0.35 0.40 0.48 rg /F1 9 Tf\n`;
  const codeLine = `Affiliation / School Code: ${schoolCode}  |  Email: ${contactEmail}  |  Phone: ${contactPhone}`;
  stream += `1 0 0 1 ${(pageWidth / 2 - 165).toFixed(2)} ${pageHeight - 105} Tm\n`;
  stream += `(${escapePdfText(codeLine)}) Tj Q\n`;

  stream += `q 0.45 0.50 0.55 rg /F1 8.5 Tf\n`;
  stream += `1 0 0 1 ${(pageWidth / 2 - 145).toFixed(2)} ${pageHeight - 118} Tm\n`;
  stream += `(${escapePdfText(schoolAddress)}) Tj Q\n`;

  // 4. Certificate Title Banner
  const titleBannerY = pageHeight - 165;
  stream += `q 0.96 0.97 0.99 rg 0.78 0.62 0.18 RG 1 w ${pageWidth / 2 - 150} ${titleBannerY} 300 32 re B Q\n`;
  stream += `q 0.08 0.18 0.36 rg /F2 15 Tf\n`;
  const titleX = pageWidth / 2 - (title.length * 8) / 2;
  stream += `1 0 0 1 ${titleX.toFixed(2)} ${titleBannerY + 10} Tm\n`;
  stream += `(${escapePdfText(title.toUpperCase())}) Tj Q\n`;

  // 5. Metadata Bar (Cert No, Date, Session)
  const metaY = titleBannerY - 32;
  stream += `q 0.2 0.25 0.35 rg /F2 9.5 Tf\n`;
  stream += `1 0 0 1 ${margin + 30} ${metaY} Tm (Certificate No: ) Tj\n`;
  stream += `/F1 9.5 Tf (${escapePdfText(certificateNumber)}) Tj\n`;

  stream += `/F2 9.5 Tf 1 0 0 1 ${pageWidth - margin - 180} ${metaY} Tm (Date of Issue: ) Tj\n`;
  stream += `/F1 9.5 Tf (${escapePdfText(issueDate)}) Tj Q\n`;

  // Horizontal divider
  stream += `q 0.85 0.88 0.92 RG 1 w ${margin + 25} ${metaY - 12} ${pageWidth - (margin + 25) * 2} 0 re S Q\n`;

  // 6. Student Particulars Card
  const tableY = metaY - 110;
  stream += `q 0.98 0.99 1.0 rg 0.85 0.88 0.92 RG 1 w ${margin + 25} ${tableY} ${pageWidth - (margin + 25) * 2} 88 re B Q\n`;

  // Table header line
  stream += `q 0.08 0.18 0.36 rg /F2 9.5 Tf\n`;
  stream += `1 0 0 1 ${margin + 40} ${tableY + 68} Tm (STUDENT DETAILS & OFFICIAL PROFILE) Tj Q\n`;
  stream += `q 0.85 0.88 0.92 RG 0.8 w ${margin + 35} ${tableY + 62} ${pageWidth - (margin + 35) * 2} 0 re S Q\n`;

  // Row 1: Student Name, Admission No
  stream += `q 0.25 0.30 0.38 rg /F2 9 Tf\n`;
  stream += `1 0 0 1 ${margin + 40} ${tableY + 44} Tm (Student Name: ) Tj /F1 9 Tf (${escapePdfText(studentInfo.name || 'N/A')}) Tj\n`;
  stream += `1 0 0 1 ${pageWidth / 2 + 10} ${tableY + 44} Tm /F2 9 Tf (Admission No: ) Tj /F1 9 Tf (${escapePdfText(studentInfo.admissionNumber || 'N/A')}) Tj\n`;

  // Row 2: Class & Section, Roll No
  stream += `1 0 0 1 ${margin + 40} ${tableY + 26} Tm /F2 9 Tf (Class & Section: ) Tj /F1 9 Tf (${escapePdfText(studentInfo.className || 'N/A')}) Tj\n`;
  stream += `1 0 0 1 ${pageWidth / 2 + 10} ${tableY + 26} Tm /F2 9 Tf (Roll Number: ) Tj /F1 9 Tf (${escapePdfText(studentInfo.rollNumber || 'N/A')}) Tj\n`;

  // Row 3: Guardian Name, DOB
  stream += `1 0 0 1 ${margin + 40} ${tableY + 8} Tm /F2 9 Tf (Guardian / Parent: ) Tj /F1 9 Tf (${escapePdfText(studentInfo.guardianName || 'N/A')}) Tj\n`;
  stream += `1 0 0 1 ${pageWidth / 2 + 10} ${tableY + 8} Tm /F2 9 Tf (Date of Birth: ) Tj /F1 9 Tf (${escapePdfText(studentInfo.dateOfBirth || 'N/A')}) Tj Q\n`;

  // 7. Certificate Body Content
  let bodyY = tableY - 35;
  const wrappedLines = wrapText(bodyText, 72);
  stream += `q 0.15 0.20 0.30 rg /F1 11 Tf\n`;
  for (const line of wrappedLines) {
    stream += `1 0 0 1 ${margin + 35} ${bodyY} Tm\n`;
    stream += `(${escapePdfText(line)}) Tj\n`;
    bodyY -= 18;
  }
  stream += `Q\n`;

  // 8. Official Statements & Seal Notice
  bodyY -= 15;
  stream += `q 0.40 0.45 0.55 rg /F1 8.5 Tf\n`;
  stream += `1 0 0 1 ${margin + 35} ${bodyY} Tm\n`;
  stream += `(This certificate is digitally generated and validated against ShikshaTrack Educational Central Registry.) Tj\n`;
  stream += `1 0 0 1 ${margin + 35} ${bodyY - 12} Tm\n`;
  stream += `(Any alteration, tampering, or unauthorized re-issuance renders this certificate null and void.) Tj Q\n`;

  // 9. QR Code Verification Box (Bottom Left)
  const qrBoxY = margin + 35;
  const qrSize = 75;
  const qrX = margin + 35;
  const fullVerifyUrl = verificationUrl.includes('?') || verificationUrl.includes('/verify-certificate/')
    ? verificationUrl
    : `${verificationUrl}/${verificationToken || certificateNumber}`;

  // Draw QR vector modules
  const qrStream = generateVectorQrCode(fullVerifyUrl, qrX, qrBoxY, qrSize);
  stream += qrStream;

  // QR label & Token
  stream += `q 0.20 0.25 0.35 rg /F2 8 Tf\n`;
  stream += `1 0 0 1 ${qrX + qrSize + 12} ${qrBoxY + 58} Tm (DIGITAL VERIFICATION) Tj\n`;
  stream += `/F1 7.5 Tf\n`;
  stream += `1 0 0 1 ${qrX + qrSize + 12} ${qrBoxY + 44} Tm (Scan QR or visit:) Tj\n`;
  stream += `1 0 0 1 ${qrX + qrSize + 12} ${qrBoxY + 32} Tm (${escapePdfText(verificationUrl.substring(0, 32))}) Tj\n`;
  stream += `1 0 0 1 ${qrX + qrSize + 12} ${qrBoxY + 18} Tm (Token: ${escapePdfText((verificationToken || certificateNumber).substring(0, 18))}...) Tj Q\n`;

  // 10. Institutional Signatory & Seal (Bottom Right)
  const signX = pageWidth - margin - 170;
  const signY = margin + 45;

  // Stamp circle outline
  stream += `q 0.78 0.62 0.18 RG 1 w ${signX - 45} ${signY + 15} 35 35 re S Q\n`;
  stream += `q 0.78 0.62 0.18 rg /F2 6.5 Tf\n`;
  stream += `1 0 0 1 ${signX - 42} ${signY + 32} Tm (INSTITUTION) Tj\n`;
  stream += `1 0 0 1 ${signX - 35} ${signY + 24} Tm (SEAL) Tj Q\n`;

  // Signature line
  stream += `q 0.25 0.30 0.40 RG 1 w ${signX} ${signY + 45} 140 0 re S Q\n`;
  stream += `q 0.10 0.15 0.25 rg /F2 9.5 Tf\n`;
  stream += `1 0 0 1 ${signX} ${signY + 30} Tm (${escapePdfText(signatoryName)}) Tj\n`;
  stream += `/F1 8.5 Tf 1 0 0 1 ${signX} ${signY + 18} Tm (${escapePdfText(signatoryTitle)}) Tj\n`;
  stream += `/F1 7.5 Tf 1 0 0 1 ${signX} ${signY + 6} Tm (${escapePdfText(schoolName)}) Tj Q\n`;

  // Footer bar
  stream += `q 0.5 0.55 0.65 rg /F1 7 Tf\n`;
  stream += `1 0 0 1 ${(pageWidth / 2 - 110).toFixed(2)} ${margin + 12} Tm\n`;
  stream += `(ShikshaTrack Secured Digital Document Network - System ID: ${escapePdfText(certificateNumber)}) Tj Q\n`;

  // 11. Compile Standard PDF 1.4 Object Graph
  const streamLength = Buffer.byteLength(stream, 'utf8');

  const pdfObjects = [];
  pdfObjects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  pdfObjects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  pdfObjects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`
  );
  pdfObjects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream\nendobj\n`);
  pdfObjects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  pdfObjects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  let pdfContent = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const xrefOffsets = [];

  for (let i = 0; i < pdfObjects.length; i++) {
    xrefOffsets.push(Buffer.byteLength(pdfContent, 'utf8'));
    pdfContent += pdfObjects[i];
  }

  const xrefOffset = Buffer.byteLength(pdfContent, 'utf8');
  pdfContent += `xref\n0 ${pdfObjects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of xrefOffsets) {
    pdfContent += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  pdfContent += `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfContent, 'utf8');
};
