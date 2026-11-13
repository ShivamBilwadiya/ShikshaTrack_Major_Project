import { EventEmitter } from 'events';
import chalk from 'chalk';

class ShikshaCliEmitter extends EventEmitter {}

export const cliEvents = new ShikshaCliEmitter();

// Register listeners for CLI operations
cliEvents.on('login', (user) => {
  console.log(chalk.green(`[Event]: User authenticated as ${user.name} (${user.role})`));
});

cliEvents.on('import:complete', ({ count, filename }) => {
  console.log(chalk.cyan(`[Event]: Stream imported ${count} student records from ${filename}`));
});

cliEvents.on('export:complete', ({ count, filename }) => {
  console.log(chalk.cyan(`[Event]: Stream exported ${count} student records to ${filename}`));
});

