import readline from 'readline';
import client from '../client.js';
import { saveSession, clearSession, getSession } from '../session.js';
import { cliEvents } from '../events.js';
import chalk from 'chalk';

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
};

export const loginCommand = async () => {
  console.log(chalk.bold.blue('\n=== ShikshaTrack Terminal Login ===\n'));

  const email = await askQuestion(chalk.yellow('Official Email: '));
  const password = await askQuestion(chalk.yellow('Password: '));

  if (!email || !password) {
    console.log(chalk.red('\nEmail and password are required.'));
    process.exit(1);
  }

  try {
    const res = await client.post('/auth/login', { email, password });
    saveSession(res.data);
    cliEvents.emit('login', res.data.user);

    console.log(chalk.green(`\n✔ Login successful! Welcome, ${res.data.user.name}.`));
    console.log(chalk.slate ? chalk.slate(`Institution: ${res.data.user.school.name}`) : `Institution: ${res.data.user.school.name}`);
    console.log(chalk.blue(`Role: ${res.data.user.role}\n`));
  } catch (err) {
    console.log(chalk.red(`\n✖ Login failed: ${err.message}\n`));
    process.exit(1);
  }
};

export const logoutCommand = () => {
  clearSession();
  console.log(chalk.green('\n✔ Logged out successfully from ShikshaTrack CLI.\n'));
};

