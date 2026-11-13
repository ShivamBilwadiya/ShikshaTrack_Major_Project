import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  School,
  Building2,
  Database,
  BrainCircuit,
  Users,
  Code2,
  CheckCircle2,
  Shield,
  Laptop,
} from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Settings & Architecture</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review school registration particulars, AI integration status, and academic project specifications
        </p>
      </div>

      {/* School Information */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <School size={18} className="text-sky-600" />
          <h2 className="text-sm font-bold text-slate-900">Registered School Profile</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Institution Name</span>
            <span className="text-slate-900 font-bold text-sm mt-0.5 block">{user?.school?.name}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Government School Code</span>
            <span className="font-mono text-slate-800 font-bold text-sm mt-0.5 block">
              {user?.school?.code}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Postal Address & Tehsil</span>
            <span className="text-slate-800 font-medium mt-0.5 block">{user?.school?.address}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Academic Session</span>
            <span className="text-slate-800 font-medium mt-0.5 block">2026-2027</span>
          </div>
        </div>
      </div>

      {/* AI & Analytics Engine Configuration */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <BrainCircuit size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">AI Integration & Safety Subsystem</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">AI Provider</span>
            <span className="font-bold text-slate-900 mt-1 block">Configurable (Gemini / Heuristic Engine)</span>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
              ✓ Privacy-Preserving Aggregates Only
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Query Engine Safety</span>
            <span className="font-bold text-slate-900 mt-1 block">Predefined Intent Router</span>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
              ✓ Zero Raw SQL Execution
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Offline Fallback</span>
            <span className="font-bold text-slate-900 mt-1 block">Autonomous Heuristic Analysis</span>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
              ✓ 100% Functional Without API Key
            </span>
          </div>
        </div>
      </div>

      {/* Technology & Academic Syllabus Mapping */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Code2 size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Academic Subject & Team Matrix</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200">
            <span className="px-2 py-0.5 rounded bg-sky-200 text-sky-900 font-extrabold text-[10px]">
              SUBJECT 1: DE
            </span>
            <h3 className="font-bold text-slate-900 mt-2">Database Engineering</h3>
            <p className="text-[11px] text-slate-600 mt-1">
              PostgreSQL 18, 3NF Relational Schema, ACID Transactions, Window Functions, Grouping Sets, and Referential Integrity.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-extrabold text-[10px]">
              SUBJECT 2: ASD
            </span>
            <h3 className="font-bold text-slate-900 mt-2">Application Software Dev</h3>
            <p className="text-[11px] text-slate-600 mt-1">
              Node.js ES Modules, Express MVC APIs, Prisma ORM, CLI Terminal App (Commander.js), Streams, and EventEmitter.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <span className="px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 font-extrabold text-[10px]">
              SUBJECT 3: ISD
            </span>
            <h3 className="font-bold text-slate-900 mt-2">Information Systems Dev</h3>
            <p className="text-[11px] text-slate-600 mt-1">
              React + Vite, Tailwind CSS, PWA Service Worker, Offline IndexedDB Sync, Role-Based Access Control, and Recharts.
            </p>
          </div>
        </div>

        {/* Team Contribution Section */}
        <div className="pt-3 border-t border-slate-100 text-xs">
          <h4 className="font-bold text-slate-800 mb-2">Cross-Functional Team Responsibilities:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-slate-900 block font-bold">Team Member 1</strong>
              <span className="text-slate-500 block mt-0.5">
                Student Management, Profiles, QR Token Architecture & Card Printing.
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-slate-900 block font-bold">Team Member 2</strong>
              <span className="text-slate-500 block mt-0.5">
                Attendance Core, Real-time Camera Scanner, Session Workflows & Validation.
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-slate-900 block font-bold">Team Member 3</strong>
              <span className="text-slate-500 block mt-0.5">
                Reports & Analytics, Node.js CLI Tool, Offline IndexedDB Queue & Sync.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

