import axios from 'axios';
import { config } from './config.js';
import { getSession } from './session.js';
import chalk from 'chalk';

const client = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((reqConfig) => {
  const session = getSession();
  if (session && session.token) {
    reqConfig.headers.Authorization = `Bearer ${session.token}`;
  }
  return reqConfig;
});

client.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const msg = error.response?.data?.message || error.message || 'Request failed';
    if (error.response?.status === 401) {
      console.log(chalk.red('\n[Authentication Error]: Session expired or invalid. Please run: shikshatrack login\n'));
      process.exit(1);
    }
    return Promise.reject(new Error(msg));
  }
);

export default client;

