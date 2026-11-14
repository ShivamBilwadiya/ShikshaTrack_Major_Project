import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Edit,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  UserCheck,
  X,
  AlertCircle,
} from 'lucide-react';

const EXAM_TYPES = [
  { key: 'MIDTERM', label: 'Midterm Assessment' },
  { key: 'FINAL', label: 'Final Annual Exam' },
  { key: 'UNIT_TEST', label: 'Unit Test' },
  { key: 'PRACTICAL', label: 'Practical Lab Assessment' },
  { key: 'ASSESSMENT', label: 'Continuous Evaluation' },
];

const GRADE_COLORS = {
  'A+': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'B+': 'bg-blue-100 text-blue-800 border-blue-300',
  B: 'bg-blue-50 text-blue-700 border-blue-200',
  C: 'bg-amber-50 text-amber-700 border-amber-200',
  D: 'bg-orange-50 text-orange-700 border-orange-200',
  F: 'bg-rose-100 text-rose-800 border-rose-300',
  'N/A': 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function ExaminationManagement() {
  const { isAdmin } = useAuth();

  // Data states
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'marksEntry'
  const [classResults, setClassResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Marks Entry state
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [marksSheet, setMarksSheet] = useState([]);
  const [savingMarks, setSavingMarks] = useState(false);

  // Exam Creation Modal State
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [examForm, setExamForm] = useState({
    name: 'Term 1 Midterm Assessment',
    examType: 'MIDTERM',
    academicYear: '2026-2027',
    classId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    subjects: [
      { subject: 'Mathematics', maxMarks: 100, passMarks: 33 },
      { subject: 'Science', maxMarks: 100, passMarks: 33 },
      { subject: 'English', maxMarks: 100, passMarks: 33 },
      { subject: 'Social Science', maxMarks: 100, passMarks: 33 },
    ],
  });

  // Fetch initial classes and exams
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [classRes, examRes] = await Promise.all([
        api.get('/classes'),
        api.get('/exams'),
      ]);

      const classList = classRes.data || [];
      const examList = examRes.data || [];

      setClasses(classList);
      setExams(examList);

      if (classList.length > 0) setSelectedClassId(classList[0].id);
      if (examList.length > 0) setSelectedExamId(examList[0].id);
    } catch (err) {
      setError(err.message || 'Failed to load examination data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch class results when selected exam or class changes
  const fetchResults = async () => {
    if (!selectedExamId || !selectedClassId) return;
    try {
      setResultsLoading(true);
      const res = await api.get(`/exams/${selectedExamId}/results`, {
        params: { classId: selectedClassId },
      });
      setClassResults(res.data);
      if (res.data.subjects?.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(res.data.subjects[0].id);
      }
      setError('');
    } catch (err) {
      setClassResults(null);
      setError(err.message || 'Failed to fetch examination results.');
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [selectedExamId, selectedClassId]);

  // Load subject marks into marksEntry sheet
  useEffect(() => {
    if (!classResults || !selectedSubjectId) return;
    const currentSub = classResults.subjects?.find((s) => s.id === selectedSubjectId);
    if (!currentSub) return;

    const sheet = classResults.results.map((student) => {
      const existing = student.subjectMarks[currentSub.subject];
      return {
        studentId: student.studentId,
        name: student.name,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        marksObtained: existing && existing.marksObtained !== null ? existing.marksObtained : '',
        remarks: '',
      };
    });
    setMarksSheet(sheet);
  }, [selectedSubjectId, classResults]);

  const handleMarkChange = (studentId, value) => {
    setMarksSheet((prev) =>
      prev.map((row) => (row.studentId === studentId ? { ...row, marksObtained: value } : row))
    );
  };

  const handleSaveMarks = async () => {
    if (!selectedSubjectId) return;
    try {
      setSavingMarks(true);
      const marksPayload = marksSheet
        .filter((r) => r.marksObtained !== '' && !isNaN(Number(r.marksObtained)))
        .map((r) => ({
          studentId: r.studentId,
          marksObtained: Number(r.marksObtained),
          remarks: r.remarks || null,
        }));

      await api.post(`/exams/subjects/${selectedSubjectId}/marks`, {
        marks: marksPayload,
      });

      setSuccess('Marks recorded successfully! Results updated.');
      setTimeout(() => setSuccess(''), 4000);
      fetchResults();
    } catch (err) {
      alert(`Failed to save marks: ${err.message}`);
    } finally {
      setSavingMarks(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedExamId || !selectedClassId) return;
    try {
      const response = await api.get(`/exams/${selectedExamId}/results/export`, {
        params: { classId: selectedClassId },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Examination_Results_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(`CSV Export failed: ${err.message}`);
    }
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    try {
      setExamSubmitting(true);
      await api.post('/exams', {
        ...examForm,
        classId: examForm.classId || undefined,
      });
      setSuccess(`Examination "${examForm.name}" created successfully.`);
      setIsExamModalOpen(false);
      setTimeout(() => setSuccess(''), 4000);
      fetchInitialData();
    } catch (err) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setExamSubmitting(false);
    }
  };

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId),
    [exams, selectedExamId]
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Examinations & Assessment Results
            </h1>
            <p className="text-sm text-slate-500">
              Administer school assessments, enter subject marks, compute grades, and generate report cards.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchResults}
            disabled={resultsLoading}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${resultsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsExamModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm shadow-purple-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Examination</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="flex items-center space-x-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selector Filters & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Examination Selector */}
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-slate-400" />
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="text-sm font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.academicYear})
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-sm font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.section})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Tabs & Export */}
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'results' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Results Overview
            </button>
            <button
              onClick={() => setActiveTab('marksEntry')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'marksEntry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Marks Entry Sheet
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      {classResults?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Assessed Students
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {classResults.summary.appearedCount} / {classResults.summary.totalStudents}
            </div>
            <span className="text-xs text-sky-600 font-medium">Class enrollment</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Class Pass Rate
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {classResults.summary.passPercentage}%
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {classResults.summary.passedCount} Passed, {classResults.summary.failedCount} Failed
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Class Average
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {classResults.summary.classAveragePercentage}%
            </div>
            <span className="text-xs text-purple-600 font-medium">Aggregate score</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Top Scorer Mark
            </span>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {classResults.summary.topScorePercentage}%
            </div>
            <span className="text-xs text-slate-500 font-medium">Highest percentage</span>
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      {resultsLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium mt-3">Loading examination results...</p>
        </div>
      ) : activeTab === 'results' ? (
        /* Results Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">Class Performance & Grade Sheet</h3>
            <span className="text-xs text-slate-500 font-medium">
              Academic Cycle: {classResults?.examination?.academicYear}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Roll</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Admission</th>
                  {classResults?.subjects?.map((s) => (
                    <th key={s.id} className="px-4 py-3 text-center">
                      {s.subject} ({s.maxMarks})
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Percentage</th>
                  <th className="px-4 py-3 text-center">Grade</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classResults?.results?.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No student records found in this class.
                    </td>
                  </tr>
                ) : (
                  classResults?.results?.map((res) => (
                    <tr key={res.studentId} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {res.rollNumber || '-'}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{res.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{res.admissionNumber}</td>
                      {classResults.subjects.map((sub) => {
                        const sm = res.subjectMarks[sub.subject];
                        const isMarked = sm && sm.marksObtained !== null;
                        return (
                          <td
                            key={sub.id}
                            className={`px-4 py-3 text-center font-medium ${
                              isMarked && !sm.isPassed ? 'text-rose-600 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {isMarked ? sm.marksObtained : <span className="text-slate-300">-</span>}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-bold text-slate-900">
                        {res.totalObtained} / {res.totalMaxMarks}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-purple-700">
                        {res.percentage}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded border ${
                            GRADE_COLORS[res.grade] || GRADE_COLORS['N/A']
                          }`}
                        >
                          {res.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            res.status === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : res.status === 'FAIL'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Marks Entry Tab */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-700 uppercase">Select Subject Paper:</span>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="text-sm font-bold border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {classResults?.subjects?.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.subject} (Max: {sub.maxMarks}, Pass: {sub.passMarks})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSaveMarks}
              disabled={savingMarks}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition"
            >
              {savingMarks ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Save Subject Marks</span>
            </button>
          </div>

          <div className="p-4">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Roll</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Admission Number</th>
                  <th className="px-4 py-3 w-40">Marks Obtained</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marksSheet.map((row) => (
                  <tr key={row.studentId} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.rollNumber || '-'}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.admissionNumber}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={row.marksObtained}
                        onChange={(e) => handleMarkChange(row.studentId, e.target.value)}
                        placeholder="Marks"
                        className="w-28 text-sm font-bold px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Examination Creation Modal */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Create New Examination</h3>
              <button
                onClick={() => setIsExamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Examination Name *
                </label>
                <input
                  type="text"
                  required
                  value={examForm.name}
                  onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                  placeholder="e.g. Annual Final Assessment 2026"
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Exam Type *
                  </label>
                  <select
                    value={examForm.examType}
                    onChange={(e) => setExamForm({ ...examForm, examType: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    required
                    value={examForm.academicYear}
                    onChange={(e) => setExamForm({ ...examForm, academicYear: e.target.value })}
                    placeholder="2026-2027"
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={examForm.startDate}
                    onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={examForm.endDate}
                    onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Class Scope (Optional, blank = School-Wide)
                </label>
                <select
                  value={examForm.classId}
                  onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">All Classes (School-Wide Exam)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.section})
                    </option>
                  ))}
                </select>
              </div>

              {/* Initial Subject Papers List */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Subject Papers ({examForm.subjects.length})
                </label>
                <div className="space-y-2">
                  {examForm.subjects.map((sub, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={sub.subject}
                        onChange={(e) => {
                          const newSubs = [...examForm.subjects];
                          newSubs[idx].subject = e.target.value;
                          setExamForm({ ...examForm, subjects: newSubs });
                        }}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg"
                      />
                      <span className="text-xs text-slate-500">Max:</span>
                      <input
                        type="number"
                        value={sub.maxMarks}
                        onChange={(e) => {
                          const newSubs = [...examForm.subjects];
                          newSubs[idx].maxMarks = e.target.value;
                          setExamForm({ ...examForm, subjects: newSubs });
                        }}
                        className="w-16 text-xs px-2 py-1.5 border border-slate-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExamModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={examSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition flex items-center space-x-1.5"
                >
                  {examSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Create Examination</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
