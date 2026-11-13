import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store session file in CLI directory
const SESSION_FILE = path.resolve(__dirname, '../.cli_session.json');

export const saveSession = (sessionData) => {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save CLI session:', err.message);
  }
};

export const getSession = () => {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const content = fs.readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
};

export const clearSession = () => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch (err) {}
};

