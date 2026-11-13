#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand, logoutCommand } from '../src/commands/auth.js';
import { schoolInfoCommand } from '../src/commands/school.js';
import {
  listStudentsCommand,
  importStudentsCommand,
  exportStudentsCommand,
} from '../src/commands/students.js';
import {
  attendanceTodayCommand,
  attendanceReportCommand,
  attendanceMarkCommand,
} from '../src/commands/attendance.js';
import {
  reportsDailyCommand,
  reportsMonthlyCommand,
  reportsLowAttendanceCommand,
  reportsMealSummaryCommand,
} from '../src/commands/reports.js';
import { statsCommand } from '../src/commands/stats.js';

const program = new Command();

program
  .name('shikshatrack')
  .description('ShikshaTrack Terminal CLI — Smart Attendance & Rural School Management')
  .version('1.0.0');

// Authentication Commands
program
  .command('login')
  .description('Interactively log in to ShikshaTrack REST API')
  .action(loginCommand);

program
  .command('logout')
  .description('Sign out and remove stored session token')
  .action(logoutCommand);

// School Commands
const school = program.command('school').description('School profile commands');
school
  .command('info')
  .description('Display registered school particulars and classes')
  .action(schoolInfoCommand);

// Student Commands
const students = program.command('students').description('Student management commands');
students
  .command('list')
  .description('List registered students with QR tokens')
  .option('-l, --limit <number>', 'Number of records to fetch', 50)
  .action(listStudentsCommand);

students
  .command('import <file>')
  .description('Import students from CSV file via Node.js Readable Stream')
  .action(importStudentsCommand);

students
  .command('export')
  .description('Export all student records to CSV stream')
  .action(exportStudentsCommand);

// Attendance Commands
const attendance = program.command('attendance').description('Attendance monitoring commands');
attendance
  .command('today')
  .description("Display today's attendance metrics and session statuses")
  .action(attendanceTodayCommand);

attendance
  .command('report')
  .description('Display monthly attendance roll report')
  .option('-m, --month <month>', 'Month number (1-12)')
  .action(attendanceReportCommand);

attendance
  .command('mark <token>')
  .description('Mark student attendance in active class session using QR token')
  .option('-s, --status <status>', 'Status: PRESENT, LATE, or ABSENT', 'PRESENT')
  .action(attendanceMarkCommand);

// Reports Commands
const reports = program.command('reports').description('Reporting commands');
reports
  .command('daily')
  .description('Generate daily attendance summary table')
  .action(reportsDailyCommand);

reports
  .command('monthly')
  .description('Generate monthly attendance overview')
  .option('-m, --month <month>', 'Month number (1-12)')
  .action(reportsMonthlyCommand);

reports
  .command('low-attendance')
  .description('List students with attendance below threshold')
  .option('-t, --threshold <percent>', 'Attendance threshold percentage', 75)
  .action(reportsLowAttendanceCommand);

reports
  .command('meals')
  .description('Generate rural Mid-Day Meal (MDM) kitchen headcount report')
  .action(reportsMealSummaryCommand);

// Stats Command
program
  .command('stats')
  .description('Show system KPIs, attendance rate, and anomaly summary')
  .action(statsCommand);

program.parse(process.argv);

