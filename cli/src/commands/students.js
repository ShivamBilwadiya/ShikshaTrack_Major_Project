import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import client from '../client.js';
import { cliEvents } from '../events.js';
import chalk from 'chalk';
import Table from 'cli-table3';

export const listStudentsCommand = async (options) => {
  try {
    const res = await client.get('/students', {
      params: { limit: options.limit || 50 },
    });

    const students = res.data.students;

    console.log(chalk.bold.blue(`\n=== Student Directory (${students.length} Records) ===\n`));

    const table = new Table({
      head: [
        chalk.cyan('Roll'),
        chalk.cyan('Name'),
        chalk.cyan('Admission No'),
        chalk.cyan('Class'),
        chalk.cyan('Guardian'),
        chalk.cyan('QR Token ID'),
      ],
    });

    students.forEach((s) => {
      table.push([
        s.rollNumber || '-',
        chalk.bold(s.name),
        s.admissionNumber,
        `${s.class.name}-${s.class.section}`,
        s.guardianName || 'N/A',
        chalk.yellow(s.qrToken),
      ]);
    });

    console.log(table.toString());
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\nFailed to list students: ${err.message}\n`));
    process.exit(1);
  }
};

export const importStudentsCommand = async (filePath) => {
  const resolvedPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.log(chalk.red(`\nFile not found: ${resolvedPath}\n`));
    process.exit(1);
  }

  console.log(chalk.blue(`\nValidating and streaming CSV data from ${resolvedPath}...`));

  // 1. Fetch classes to resolve classId by name-section
  let classes = [];
  try {
    const classRes = await client.get('/classes');
    classes = classRes.data;
  } catch (err) {
    console.log(chalk.red(`Failed to fetch class mappings: ${err.message}`));
    process.exit(1);
  }

  const classMap = new Map();
  classes.forEach((c) => {
    classMap.set(`${c.name}-${c.section}`.toLowerCase(), c.id);
    classMap.set(c.name.toLowerCase(), c.id);
  });

  const rows = [];
  let headerValidated = false;

  // Use Node.js Readable Stream with CSV Parser
  fs.createReadStream(resolvedPath)
    .pipe(csvParser())
    .on('headers', (headers) => {
      const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
      const hasName = lowerHeaders.some((h) => h === 'name' || h === 'studentname');
      const hasAdm = lowerHeaders.some((h) => h === 'admissionnumber' || h === 'admission_number' || h === 'admno');

      if (!hasName || !hasAdm) {
        console.log(chalk.red('\n✖ Invalid CSV Format! Mandatory headers missing.'));
        console.log(chalk.yellow('Required headers: "Name" and "AdmissionNumber" (Optional: Class, Roll, Phone, Guardian)\n'));
        process.exit(1);
      }
      headerValidated = true;
    })
    .on('data', (data) => {
      // Filter out completely blank or whitespace-only rows
      const hasContent = Object.values(data).some((val) => val && String(val).trim() !== '');
      if (hasContent) {
        rows.push(data);
      }
    })
    .on('end', async () => {
      if (rows.length === 0) {
        console.log(chalk.yellow('\n⚠ Warning: CSV file contains no valid data rows.\n'));
        return;
      }

      console.log(chalk.yellow(`Parsed ${rows.length} valid rows from CSV. Processing registrations...\n`));

      let imported = 0;
      let failed = 0;
      const failureDetails = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const studentName = (row.Name || row.name || row.studentName || '').trim();
        const admNumber = (row.AdmissionNumber || row.admissionNumber || row.admission_number || row.admno || '').trim();

        if (!studentName || !admNumber) {
          failed++;
          failureDetails.push({ row: i + 2, reason: 'Missing name or admission number' });
          process.stdout.write(chalk.red('x'));
          continue;
        }

        try {
          const className = (row.Class || row.class || 'Class 8-A').trim().toLowerCase();
          const classId = classMap.get(className) || classes[0]?.id;

          await client.post('/students', {
            name: studentName,
            admissionNumber: admNumber,
            rollNumber: (row.Roll || row.roll || row.rollNumber || '').trim() || null,
            classId: classId,
            guardianName: (row.Guardian || row.guardian || '').trim() || null,
            guardianPhone: (row.Phone || row.phone || '').trim() || null,
          });

          imported++;
          process.stdout.write(chalk.green('.'));
        } catch (err) {
          failed++;
          failureDetails.push({ row: i + 2, reason: err.message || 'API error' });
          process.stdout.write(chalk.red('x'));
        }
      }

      console.log('\n');
      console.log(chalk.green(`✔ Stream Import Finished: ${imported} created successfully, ${failed} failed.`));

      if (failureDetails.length > 0) {
        console.log(chalk.yellow('\nFailed Rows Summary:'));
        failureDetails.slice(0, 5).forEach((f) => {
          console.log(chalk.red(`  - Row ${f.row}: ${f.reason}`));
        });
        if (failureDetails.length > 5) {
          console.log(chalk.gray(`  ... and ${failureDetails.length - 5} more errors.`));
        }
      }

      cliEvents.emit('import:complete', { count: imported, filename: filePath });
      console.log('');
    });
};

export const exportStudentsCommand = async () => {
  try {
    console.log(chalk.blue('\nFetching student records from ShikshaTrack API...'));
    const res = await client.get('/students', { params: { limit: 500 } });
    const students = res.data.students;

    const exportPath = path.resolve(process.cwd(), 'students_export.csv');
    const writeStream = fs.createWriteStream(exportPath, { encoding: 'utf-8' });

    // Header
    writeStream.write('AdmissionNumber,Name,Class,RollNumber,GuardianName,GuardianPhone,QrToken\n');

    students.forEach((s) => {
      const line = `"${s.admissionNumber}","${s.name}","${s.class.name}-${s.class.section}","${s.rollNumber || ''}","${s.guardianName || ''}","${s.guardianPhone || ''}","${s.qrToken}"\n`;
      writeStream.write(line);
    });

    writeStream.end();

    writeStream.on('finish', () => {
      console.log(chalk.green(`\n✔ Exported ${students.length} students to: ${exportPath}\n`));
      cliEvents.emit('export:complete', { count: students.length, filename: exportPath });
    });
  } catch (err) {
    console.log(chalk.red(`\nExport failed: ${err.message}\n`));
    process.exit(1);
  }
};

