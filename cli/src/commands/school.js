import client from '../client.js';
import chalk from 'chalk';
import Table from 'cli-table3';

export const schoolInfoCommand = async () => {
  try {
    const [profileRes, classesRes] = await Promise.all([
      client.get('/auth/profile'),
      client.get('/classes'),
    ]);

    const school = profileRes.data.school;
    const classes = classesRes.data;

    console.log(chalk.bold.blue('\n=== ShikshaTrack Institution Profile ===\n'));

    const table = new Table({
      head: [chalk.cyan('Attribute'), chalk.cyan('Details')],
      colWidths: [22, 55],
    });

    table.push(
      ['School Name', chalk.bold(school.name)],
      ['School Code', chalk.yellow(school.code)],
      ['Address', school.address],
      ['Contact Email', school.contactEmail || 'N/A'],
      ['Contact Phone', school.contactPhone || 'N/A'],
      ['Affiliated Classes', `${classes.length} active grades configured`]
    );

    console.log(table.toString());

    // Print classes list
    console.log(chalk.bold('\nConfigured Grade Sections:'));
    classes.forEach((c) => {
      console.log(` • ${chalk.green(c.name + '-' + c.section)} (${c.academicYear}) — ${c._count.students} students enrolled`);
    });
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\nFailed to fetch school info: ${err.message}\n`));
    process.exit(1);
  }
};

