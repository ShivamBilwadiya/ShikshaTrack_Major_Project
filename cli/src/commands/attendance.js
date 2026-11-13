import client from '../client.js';
import chalk from 'chalk';
import Table from 'cli-table3';

export const attendanceTodayCommand = async () => {
  try {
    const res = await client.get('/reports/daily');
    const { date, summary, classReports } = res.data;

    console.log(chalk.bold.blue(`\n=== Today's Attendance Overview (${date}) ===\n`));

    const sumTable = new Table();
    sumTable.push(
      [chalk.bold('Total Enrolled'), summary.totalEnrolled],
      [chalk.bold.green('Present'), summary.totalPresent],
      [chalk.bold.yellow('Late Arrivals'), summary.totalLate],
      [chalk.bold.red('Absent'), summary.totalAbsent],
      [chalk.bold.cyan('Overall Rate'), `${summary.overallAttendanceRate}%`],
      [chalk.bold.magenta('Mid-Day Meal Headcount'), summary.midDayMealTotalHeadcount]
    );
    console.log(sumTable.toString());

    console.log(chalk.bold('\nClass Breakdown:'));
    const classTable = new Table({
      head: [
        chalk.cyan('Class'),
        chalk.cyan('Session Status'),
        chalk.cyan('Present'),
        chalk.cyan('Late'),
        chalk.cyan('Absent'),
        chalk.cyan('Rate'),
        chalk.cyan('MDM Meals'),
      ],
    });

    classReports.forEach((c) => {
      classTable.push([
        chalk.bold(c.className),
        c.sessionStatus,
        chalk.green(c.present),
        chalk.yellow(c.late),
        chalk.red(c.absent),
        `${c.attendanceRate}%`,
        chalk.cyan(c.midDayMealCount),
      ]);
    });

    console.log(classTable.toString());
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\nFailed to fetch today's attendance: ${err.message}\n`));
    process.exit(1);
  }
};

export const attendanceReportCommand = async (options) => {
  try {
    const now = new Date();
    const month = options.month ? parseInt(options.month, 10) : now.getMonth() + 1;
    const year = now.getFullYear();

    const res = await client.get('/reports/monthly', { params: { year, month } });
    const { monthName, workingDaysRecorded, totalSessions, dailyTrend } = res.data;

    console.log(chalk.bold.blue(`\n=== Monthly Attendance Register: ${monthName} ${year} ===\n`));
    console.log(`Working Days Recorded: ${workingDaysRecorded} | Total Sessions: ${totalSessions}\n`);

    const table = new Table({
      head: [
        chalk.cyan('Date'),
        chalk.cyan('Present'),
        chalk.cyan('Late'),
        chalk.cyan('Absent'),
        chalk.cyan('Rate'),
      ],
    });

    dailyTrend.forEach((d) => {
      const total = d.present + d.late + d.absent;
      const rate = total > 0 ? Math.round(((d.present + d.late) / total) * 100) : 0;
      table.push([
        d.date,
        chalk.green(d.present),
        chalk.yellow(d.late),
        chalk.red(d.absent),
        `${rate}%`,
      ]);
    });

    console.log(table.toString());
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\nFailed to fetch attendance report: ${err.message}\n`));
    process.exit(1);
  }
};

export const attendanceMarkCommand = async (token, options) => {
  if (!token || !token.trim()) {
    console.log(chalk.red('\nError: Student QR token string is required.\nUsage: shikshatrack attendance mark <token>\n'));
    process.exit(1);
  }

  const status = (options.status || 'PRESENT').toUpperCase();
  if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
    console.log(chalk.red(`\nError: Invalid status '${status}'. Must be PRESENT, LATE, or ABSENT.\n`));
    process.exit(1);
  }

  try {
    console.log(chalk.blue(`\nVerifying QR token and marking attendance as ${status}...`));

    // First resolve student and active class session
    const studentRes = await client.get(`/students/qr/${token.trim()}`);
    const student = studentRes.data;

    // Start or fetch session for student's class
    const sessionRes = await client.post('/attendance/sessions/start', {
      classId: student.classId,
    });
    const session = sessionRes.data;

    // Scan record
    const scanRes = await client.post('/attendance/scan', {
      sessionId: session.id,
      qrToken: token.trim(),
      status,
    });

    console.log(chalk.green(`\n✔ Attendance Successfully Recorded!`));
    const card = new Table();
    card.push(
      [chalk.bold('Student Name'), chalk.bold.cyan(student.name)],
      [chalk.bold('Admission No'), student.admissionNumber],
      [chalk.bold('Class'), `${student.class.name}-${student.class.section}`],
      [chalk.bold('Status'), status === 'PRESENT' ? chalk.green('PRESENT') : chalk.yellow(status)],
      [chalk.bold('Marked At'), new Date(scanRes.data.markedAt).toLocaleTimeString()]
    );
    console.log(card.toString());
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\n✖ Attendance marking rejected: ${err.message}\n`));
    process.exit(1);
  }
};

