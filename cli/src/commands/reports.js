import client from '../client.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import { attendanceTodayCommand, attendanceReportCommand } from './attendance.js';

export const reportsDailyCommand = attendanceTodayCommand;
export const reportsMonthlyCommand = attendanceReportCommand;

export const reportsLowAttendanceCommand = async (options) => {
  const threshold = options.threshold ? parseInt(options.threshold, 10) : 75;

  try {
    console.log(chalk.blue(`\nFetching students with attendance below ${threshold}%...`));
    const res = await client.get('/reports/low-attendance', { params: { threshold } });
    const { count, threshold: appliedThreshold, students } = res.data;

    console.log(chalk.bold.red(`\n=== Low Attendance Alert Register (< ${appliedThreshold}%) ===`));
    console.log(chalk.yellow(`Total Students Requiring Guardian Outreach: ${count}\n`));

    if (students.length === 0) {
      console.log(chalk.green('✔ Great news! No students currently fall below this threshold.\n'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Roll'),
        chalk.cyan('Name'),
        chalk.cyan('Class'),
        chalk.cyan('Rate'),
        chalk.cyan('Present/Total'),
        chalk.cyan('Guardian Phone'),
      ],
    });

    students.forEach((s) => {
      table.push([
        s.rollNumber || '-',
        chalk.bold(s.name),
        s.className,
        chalk.red(`${s.attendanceRate}%`),
        `${s.presentCount}/${s.totalSessions}`,
        s.guardianPhone || chalk.gray('No phone'),
      ]);
    });

    console.log(table.toString());
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\nFailed to fetch low attendance report: ${err.message}\n`));
    process.exit(1);
  }
};

export const reportsMealSummaryCommand = async () => {
  try {
    console.log(chalk.blue("\nFetching today's Mid-Day Meal dispatch requirements..."));
    const res = await client.get('/reports/daily');
    const { date, summary, classReports } = res.data;

    console.log(chalk.bold.magenta(`\n=== Rural Mid-Day Meal (MDM) Dispatch Order ===`));
    console.log(`Date: ${date} | Total School MDM Headcount: ${chalk.bold.green(summary.midDayMealTotalHeadcount)} meals\n`);

    const table = new Table({
      head: [
        chalk.cyan('Class'),
        chalk.cyan('Eligible Meals (Present + Late)'),
        chalk.cyan('Absent (No Meal)'),
        chalk.cyan('Cook Dispatch Status'),
      ],
    });

    classReports.forEach((c) => {
      table.push([
        chalk.bold(c.className),
        chalk.bold.green(c.midDayMealCount),
        chalk.gray(c.absent),
        c.midDayMealCount > 0 ? chalk.green('READY TO SERVE') : chalk.gray('NO STUDENTS'),
      ]);
    });

    console.log(table.toString());
    console.log(chalk.gray(`Note: Headcount combines PRESENT and LATE students physically checked into school sessions.\n`));
  } catch (err) {
    console.log(chalk.red(`\nFailed to fetch meal summary: ${err.message}\n`));
    process.exit(1);
  }
};

