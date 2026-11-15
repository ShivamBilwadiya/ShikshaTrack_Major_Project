import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  GraduationCap,
  ArrowRight,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  Users,
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export default function StudentPromotion() {
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedSourceYear, setSelectedSourceYear] = useState('');

  // Mapping Configuration
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [promotionAction, setPromotionAction] = useState('PROMOTE'); // 'PROMOTE' | 'GRADUATE'

  // Preview State
  const [previewData, setPreviewData] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Status & Feedback
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [validationWarning, setValidationWarning] = useState('');

  // Fetch Class Promotion Structure
  const fetchStructure = useCallback(async () => {
    try {
      const res = await api.get('/academic/promotion/classes');
      if (res.success) {
        setClasses(res.data.classes || []);
        setAcademicYears(res.data.academicYears || []);
        if (res.data.academicYears && res.data.academicYears.length > 0) {
          setSelectedSourceYear(res.data.academicYears[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load class promotion structures.');
    }
  }, []);

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  // Trigger Promotion Preview
  const handlePreview = async () => {
    if (!sourceClassId) {
      setError('Please select an origin class to promote from.');
      return;
    }
    if (promotionAction === 'PROMOTE' && !targetClassId) {
      setError('Please select a destination class to promote to.');
      return;
    }
    if (promotionAction === 'PROMOTE' && sourceClassId === targetClassId) {
      setError('Origin and destination classes cannot be identical.');
      return;
    }

    try {
      setPreviewLoading(true);
      setError('');
      setValidationWarning('');
      setSuccessResult(null);

      const res = await api.post('/academic/promotion/preview', {
        sourceClassId,
        targetClassId: promotionAction === 'GRADUATE' ? 'GRADUATE' : targetClassId,
      });

      if (res.success) {
        setPreviewData(res.data);
        // Default select all eligible students
        const allIds = new Set(res.data.students.map((s) => s.id));
        setSelectedStudentIds(allIds);

        if (res.data.isGraduation) {
          setValidationWarning(
            'Final-year exit / graduation detected. Selected students will have their active status finalized upon completion.'
          );
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to generate promotion preview.');
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Toggle Single Student
  const toggleStudent = (id) => {
    const updated = new Set(selectedStudentIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedStudentIds(updated);
  };

  // Toggle All
  const toggleSelectAll = () => {
    if (!previewData?.students) return;
    if (selectedStudentIds.size === previewData.students.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(previewData.students.map((s) => s.id)));
    }
  };

  // Execute Bulk Promotion
  const handleExecutePromotion = async () => {
    if (!previewData || selectedStudentIds.size === 0) {
      setError('Select at least one student to execute promotion.');
      return;
    }

    const actionText = promotionAction === 'GRADUATE' ? 'mark as graduated' : 'promote';
    const confirmMessage = `Confirm: You are about to ${actionText} ${selectedStudentIds.size} student(s) from ${previewData.sourceClass.displayName} to ${
      promotionAction === 'GRADUATE' ? 'Graduation Status' : previewData.targetClass?.displayName
    }. This action is permanent and transactionally audited. Proceed?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setExecuting(true);
      setError('');

      const res = await api.post('/academic/promotion/execute', {
        promotions: [
          {
            sourceClassId,
            targetClassId: promotionAction === 'GRADUATE' ? null : targetClassId,
            studentIds: Array.from(selectedStudentIds),
            action: promotionAction,
          },
        ],
        reason: `Annual Rollover Promotion: ${previewData.sourceClass.name} -> ${
          promotionAction === 'GRADUATE' ? 'Graduated' : previewData.targetClass?.name
        }`,
      });

      if (res.success) {
        setSuccessResult(res.data);
        setPreviewData(null);
        setSelectedStudentIds(new Set());
        fetchStructure();
      }
    } catch (err) {
      setError(err.message || 'Promotion execution failed.');
    } finally {
      setExecuting(false);
    }
  };

  const filteredSourceClasses = classes.filter(
    (c) => !selectedSourceYear || c.academicYear === selectedSourceYear
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-md shadow-emerald-200">
            <GraduationCap size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Academic Promotion & Rollover</h1>
            <p className="text-sm text-slate-500">
              Configure class advancement mappings, preview candidate cohorts, and execute transactional annual rollovers.
            </p>
          </div>
        </div>

        <button
          onClick={fetchStructure}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
        >
          <RefreshCw size={14} />
          <span>Reload Classes</span>
        </button>
      </div>

      {/* Success Summary Alert */}
      {successResult && (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-fade-in shadow-sm">
          <div className="flex items-center space-x-2.5 font-bold text-base text-emerald-800">
            <CheckCircle2 size={22} className="text-emerald-600" />
            <span>Academic Promotion Completed Successfully</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
              <span className="text-xs text-slate-500 block">Total Processed</span>
              <span className="text-lg font-bold text-slate-800">{successResult.totalProcessed}</span>
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
              <span className="text-xs text-slate-500 block">Promoted to Next Class</span>
              <span className="text-lg font-bold text-emerald-700">{successResult.totalPromoted}</span>
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
              <span className="text-xs text-slate-500 block">Marked as Graduated</span>
              <span className="text-lg font-bold text-purple-700">{successResult.totalGraduated}</span>
            </div>
          </div>
          <p className="text-xs text-emerald-700">
            All updates have been committed with individual student audit trails in the central institution registry.
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-3 text-sm">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Promotion Mapping Configuration Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="text-emerald-600" size={18} />
            <h2 className="font-bold text-slate-900 text-base">Class Advancement Configuration</h2>
          </div>

          {/* Academic Year Filter */}
          <div className="flex items-center space-x-2 text-xs">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Session Filter:</span>
            <select
              value={selectedSourceYear}
              onChange={(e) => setSelectedSourceYear(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Source Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              1. Current Class (From)
            </label>
            <select
              value={sourceClassId}
              onChange={(e) => {
                setSourceClassId(e.target.value);
                setPreviewData(null);
              }}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">Select origin class...</option>
              {filteredSourceClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} &bull; ({c.activeStudentsCount} students)
                </option>
              ))}
            </select>
          </div>

          {/* Promotion Action */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              2. Rollover Action
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPromotionAction('PROMOTE');
                  setPreviewData(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center space-x-1.5 transition ${
                  promotionAction === 'PROMOTE'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowRight size={14} />
                <span>Advance to Class</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPromotionAction('GRADUATE');
                  setTargetClassId('');
                  setPreviewData(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center space-x-1.5 transition ${
                  promotionAction === 'GRADUATE'
                    ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <GraduationCap size={14} />
                <span>Graduate Cohort</span>
              </button>
            </div>
          </div>

          {/* Destination Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              3. Next Destination Class (To)
            </label>
            {promotionAction === 'GRADUATE' ? (
              <div className="w-full border border-purple-200 rounded-lg text-sm px-3 py-2.5 bg-purple-50 text-purple-800 font-medium">
                Alumni / Final Graduation Exit
              </div>
            ) : (
              <select
                value={targetClassId}
                onChange={(e) => {
                  setTargetClassId(e.target.value);
                  setPreviewData(null);
                }}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Select destination class...</option>
                {classes
                  .filter((c) => c.id !== sourceClassId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handlePreview}
            disabled={previewLoading || !sourceClassId}
            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-200 transition"
          >
            {previewLoading ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>Preview Promotion Cohort</span>
          </button>
        </div>
      </div>

      {/* Validation Warning */}
      {validationWarning && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2.5">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>{validationWarning}</span>
        </div>
      )}

      {/* Preview Section */}
      {previewData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 animate-fade-in">
          {/* Preview Header Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900">
                <span>{previewData.sourceClass.displayName}</span>
                <ArrowRight size={16} className="text-slate-400" />
                <span className="text-emerald-700">
                  {previewData.targetClass
                    ? previewData.targetClass.displayName
                    : 'Graduation / Final Program Exit'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedStudentIds.size} of {previewData.students.length} students selected for advancement
              </p>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                {selectedStudentIds.size === previewData.students.length ? (
                  <CheckSquare size={14} className="text-emerald-600" />
                ) : (
                  <Square size={14} />
                )}
                <span>Select All ({previewData.students.length})</span>
              </button>

              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={executing || selectedStudentIds.size === 0}
                className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-200 transition"
              >
                {executing ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <ArrowUpRight size={15} />
                )}
                <span>Execute Promotion</span>
              </button>
            </div>
          </div>

          {/* Students Preview Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">
                    <button onClick={toggleSelectAll} className="focus:outline-none">
                      {selectedStudentIds.size === previewData.students.length ? (
                        <CheckSquare size={16} className="text-emerald-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Admission No.</th>
                  <th className="py-3 px-4">Roll No.</th>
                  <th className="py-3 px-4">Guardian</th>
                  <th className="py-3 px-4">Proposed Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No active students found in this class.
                    </td>
                  </tr>
                ) : (
                  previewData.students.map((st) => {
                    const isSelected = selectedStudentIds.has(st.id);
                    return (
                      <tr
                        key={st.id}
                        onClick={() => toggleStudent(st.id)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleStudent(st.id)}
                            className="text-slate-400 focus:outline-none"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-emerald-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{st.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">{st.admissionNumber}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{st.rollNumber || 'N/A'}</td>
                        <td className="py-3 px-4 text-xs text-slate-500">{st.guardianName || 'N/A'}</td>
                        <td className="py-3 px-4 text-xs">
                          {previewData.targetClass ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                              {previewData.targetClass.displayName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Graduation
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
