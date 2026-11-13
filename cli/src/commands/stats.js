import client from '../client.js';
import chalk from 'chalk';
import Table from 'cli-table3';

export const statsCommand = async () => {
  try {
    const [statsRes, anomalyRes] = await Promise.all([
      client.get('/analytics/admin'),
      client.get('/analytics/anomalies'),
    ]);

    const { overview } = statsRes.data;
    const anomalies = anomalyRes.data;

    console.log(chalk.bold.blue('\n=== ShikshaTrack System Statistics ===\n'));

    const table = new Table();
    table.push(
      [chalk.bold('Total Students'), overview.totalStudents],
      [chalk.bold('Total Faculty Members'), overview.totalTeachers],
      [chalk.bold('Total Configured Classes'), overview.totalClasses],
      [chalk.bold.green('Today Present'), overview.todayPresent],
      [chalk.bold.yellow('Today Late'), overview.todayLate],
      [chalk.bold.red('Today Absent'), overview.todayAbsent],
      [chalk.bold.cyan('Today Attendance Rate'), `${overview.todayAttendanceRate}%`],
      [chalk.bold.magenta('Anomalies Flagged'), `${anomalies.length} student patterns detected`]
    );

    console.log(table.toString());

    if (anomalies.length > 0) {
      console.log(chalk.bold.yellow('\nTop Flagged Attendance Anomalies:'));
      anomalies.slice(0, 3).forEach((a) => {
        console.log(` • ${chalk.bold(a.studentName)} (${a.className}): ${a.description}`);
      });
    }

    console.log('');
  } catch (err) {
    console.log(chalk.red(`\nFailed to fetch statistics: ${err.message}\n`));
    process.exit(1);
  }
};

