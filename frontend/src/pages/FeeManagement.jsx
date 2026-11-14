import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  Receipt,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  Download,
  FileText,
  DollarSign,
  Printer,
  RotateCcw,
  Users,
  Building2,
  Calendar,
  X,
  RefreshCw,
  PhoneCall,
  Check,
  ChevronRight,
  ShieldCheck,
  Percent,
} from 'lucide-react';

export default function FeeManagement() {
  const { user, isAdmin } = useAuth();

  // Active Tab: 'overdue' | 'statements' | 'structures' | 'payments'
  const [activeTab, setActiveTab] = useState('overdue');

  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);

  // Data
  const [summary, setSummary] = useState(null);
  const [overdueList, setOverdueList] = useState([]);
  const [structures, setStructures] = useState([]);
  const [payments, setPayments] = useState([]);
  const [classReport, setClassReport] = useState([]);

  // Student statement state
  const [selectedStudentForStatement, setSelectedStudentForStatement] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Reversal Modal State
  const [reversalPayment, setReversalPayment] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [showReversalModal, setShowReversalModal] = useState(false);

  // Create Structure Modal State
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structureForm, setStructureForm] = useState({
    name: '',
    classId: '',
    academicYear: '2026-2027',
    category: 'TUITION',
    totalAmount: '',
    frequency: 'ANNUAL',
    description: '',
  });

  // Assign Fee Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    feeStructureId: '',
    classId: '',
    studentId: '',
    targetMode: 'CLASS', // 'CLASS' or 'STUDENT'
    installmentsCount: 3,
    firstDueDate: new Date().toISOString().split('T')[0],
  });

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    studentFeeId: '',
    studentName: '',
    maxBalance: 0,
    amountPaid: '',
    paymentMethod: 'CASH',
    transactionReference: '',
    remarks: '',
  });

  // Apply Discount Modal State
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    studentFeeId: '',
    discountType: 'FIXED_AMOUNT',
    value: '',
    reason: '',
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchTabData();
  }, [activeTab, selectedClass, academicYear]);

  useEffect(() => {
    if (assignForm.classId && assignForm.targetMode === 'STUDENT') {
      fetchClassStudents(assignForm.classId);
    }
  }, [assignForm.classId, assignForm.targetMode]);

  const fetchInitialData = async () => {
    try {
      const res = await api.get('/classes');
      if (res.data.success) setClasses(res.data.data);
    } catch (err) {
      console.error('Failed to load initial classes:', err);
    }
  };

  const fetchClassStudents = async (classId) => {
    try {
      const res = await api.get(`/students?classId=${classId}`);
      if (res.data.success) {
        setStudents(res.data.data.students || res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load class students:', err);
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Summary
      const sumRes = await api.get('/fees/summary', {
        params: { classId: selectedClass || undefined },
      });
      if (sumRes.data.success) setSummary(sumRes.data.data);

      // 2. Fetch specific tab dataset
      if (activeTab === 'overdue') {
        const res = await api.get('/fees/overdue', {
          params: { classId: selectedClass || undefined },
        });
        if (res.data.success) setOverdueList(res.data.data);
      } else if (activeTab === 'structures') {
        const res = await api.get('/fees/structures', {
          params: { classId: selectedClass || undefined, academicYear },
        });
        if (res.data.success) setStructures(res.data.data);
      } else if (activeTab === 'statements') {
        const res = await api.get('/fees/reports/classes', { params: { academicYear } });
        if (res.data.success) setClassReport(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching tab data:', err);
      setError(err.response?.data?.message || 'Failed to load financial data.');
    } finally {
      setLoading(false);
    }
  };

  // View Student Statement
  const handleOpenStudentStatement = async (studentId) => {
    setStatementLoading(true);
    try {
      const res = await api.get(`/fees/students/${studentId}/statement`);
      if (res.data.success) {
        setStatementData(res.data.data);
        setSelectedStudentForStatement(studentId);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load student fee statement.');
    } finally {
      setStatementLoading(false);
    }
  };

  // View Receipt
  const handleViewReceipt = async (receiptNumber) => {
    try {
      const res = await api.get(`/fees/receipts/${receiptNumber}`);
      if (res.data.success) {
        setActiveReceipt(res.data.data);
        setShowReceiptModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fetch receipt.');
    }
  };

  // Submit Structure Form
  const handleCreateStructure = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const res = await api.post('/fees/structures', {
        ...structureForm,
        classId: structureForm.classId || undefined,
      });
      if (res.data.success) {
        setSuccessMsg(`Fee structure "${res.data.data.name}" created.`);
        setShowStructureModal(false);
        setStructureForm({
          name: '',
          classId: '',
          academicYear: '2026-2027',
          category: 'TUITION',
          totalAmount: '',
          frequency: 'ANNUAL',
          description: '',
        });
        fetchTabData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create fee structure.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Assignment Form
  const handleAssignFee = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (assignForm.targetMode === 'CLASS') {
        const res = await api.post('/fees/assign/class', {
          schoolId: user.schoolId,
          classId: assignForm.classId,
          feeStructureId: assignForm.feeStructureId,
          academicYear,
          installmentsCount: assignForm.installmentsCount,
          firstDueDate: assignForm.firstDueDate,
        });
        if (res.data.success) {
          setSuccessMsg(
            `Assigned to ${res.data.data.successful.length} students in class (${res.data.data.skipped.length} skipped).`
          );
        }
      } else {
        const res = await api.post('/fees/assign/student', {
          studentId: assignForm.studentId,
          feeStructureId: assignForm.feeStructureId,
          academicYear,
          installmentsCount: assignForm.installmentsCount,
          firstDueDate: assignForm.firstDueDate,
        });
        if (res.data.success) {
          setSuccessMsg('Fee assigned to student with installments.');
        }
      }
      setShowAssignModal(false);
      fetchTabData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign fee.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Payment Recorder
  const handleOpenPaymentModal = (feeAccount, studentName) => {
    setPaymentForm({
      studentFeeId: feeAccount.id,
      studentName,
      maxBalance: feeAccount.balanceAmount,
      amountPaid: feeAccount.balanceAmount.toString(),
      paymentMethod: 'CASH',
      transactionReference: '',
      remarks: '',
    });
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const res = await api.post('/fees/payments', {
        studentFeeId: paymentForm.studentFeeId,
        amountPaid: parseFloat(paymentForm.amountPaid),
        paymentMethod: paymentForm.paymentMethod,
        transactionReference: paymentForm.transactionReference || undefined,
        remarks: paymentForm.remarks || undefined,
      });

      if (res.data.success) {
        setSuccessMsg(
          `Payment of ₹${paymentForm.amountPaid} recorded. Receipt #${res.data.data.payment.receiptNumber}`
        );
        setShowPaymentModal(false);
        // Refresh statement if open
        if (selectedStudentForStatement) {
          handleOpenStudentStatement(selectedStudentForStatement);
        }
        fetchTabData();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Payment recording failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Discount
  const handleApplyDiscount = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const res = await api.post(`/fees/accounts/${discountForm.studentFeeId}/discount`, {
        discountType: discountForm.discountType,
        value: parseFloat(discountForm.value),
        reason: discountForm.reason,
      });
      if (res.data.success) {
        setSuccessMsg('Discount applied and balances rebalanced.');
        setShowDiscountModal(false);
        if (selectedStudentForStatement) {
          handleOpenStudentStatement(selectedStudentForStatement);
        }
        fetchTabData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to apply discount.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Reverse Payment
  const handleConfirmReversal = async (e) => {
    e.preventDefault();
    if (!reversalPayment || !reversalReason.trim()) return;
    setFormSubmitting(true);
    try {
      const res = await api.post(`/fees/payments/${reversalPayment.id}/reverse`, {
        reason: reversalReason.trim(),
      });
      if (res.data.success) {
        setSuccessMsg('Payment successfully reversed and account balance restored.');
        setShowReversalModal(false);
        setReversalPayment(null);
        setReversalReason('');
        if (selectedStudentForStatement) {
          handleOpenStudentStatement(selectedStudentForStatement);
        }
        fetchTabData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reverse payment.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleExportCsv = (type) => {
    const params = new URLSearchParams();
    if (selectedClass) params.append('classId', selectedClass);
    params.append('type', type);
    const baseUrl = api.defaults.baseURL || '/api/v1';
    window.open(`${baseUrl}/fees/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <CreditCard className="w-7 h-7 mr-2 text-emerald-600" />
            School Fee & Billing Management System
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Fee structures, installment scheduling, atomic payment collection, and audit reporting.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTabData}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 mr-1 text-slate-500" /> Refresh
          </button>
          <button
            onClick={() => handleExportCsv(activeTab === 'overdue' ? 'overdue' : 'classes')}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500" /> Export CSV
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowStructureModal(true)}
                className="inline-flex items-center px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50"
              >
                <Plus className="w-4 h-4 mr-1 text-slate-500" /> Fee Structure
              </button>
              <button
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Assign Fee
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center font-medium">
            <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" /> {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center font-medium">
            <AlertTriangle className="w-5 h-5 mr-2 text-rose-600" /> {error}
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      )}

      {/* Financial KPI Dashboard */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Billed</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">₹{summary.totalBilled?.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-1">Net: ₹{summary.netPayable?.toLocaleString()}</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Collected</div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">₹{summary.totalCollected?.toLocaleString()}</div>
            <div className="text-xs text-emerald-700 mt-1">{summary.totalTransactions} transactions</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Outstanding Balance</div>
            <div className="mt-2 text-2xl font-bold text-amber-600">₹{summary.totalOutstanding?.toLocaleString()}</div>
            <div className="text-xs text-amber-700 mt-1">Pending student dues</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Overdue Dues</div>
            <div className="mt-2 text-2xl font-bold text-rose-600">₹{summary.totalOverdue?.toLocaleString()}</div>
            <div className="text-xs text-rose-700 mt-1">Past installment date</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-sky-600 uppercase tracking-wider">Collection Rate</div>
            <div className="mt-2 text-2xl font-bold text-sky-600">{summary.collectionRate}%</div>
            <div className="text-xs text-slate-500 mt-1">Of net receivables</div>
          </div>
        </div>
      )}

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('overdue')}
          className={`pb-3 flex items-center ${
            activeTab === 'overdue'
              ? 'border-b-2 border-rose-600 text-rose-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="w-4 h-4 mr-1.5" /> Overdue Queue ({overdueList.length})
        </button>
        <button
          onClick={() => setActiveTab('statements')}
          className={`pb-3 flex items-center ${
            activeTab === 'statements'
              ? 'border-b-2 border-emerald-600 text-emerald-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4 mr-1.5" /> Class Collection Reports
        </button>
        <button
          onClick={() => setActiveTab('structures')}
          className={`pb-3 flex items-center ${
            activeTab === 'structures'
              ? 'border-b-2 border-emerald-600 text-emerald-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4 mr-1.5" /> Fee Structures
        </button>
      </div>

      {/* TAB 1: Overdue Queue */}
      {activeTab === 'overdue' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-rose-600" />
              Overdue Installment Recovery Queue
            </h2>
            <div className="text-xs text-slate-500">Sorted by earliest unpaid due date</div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading overdue register...
            </div>
          ) : overdueList.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-1">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="font-semibold text-slate-800">No Overdue Fee Installments</div>
              <p className="text-xs text-slate-400">All student accounts are currently in good standing.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Fee Item</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Overdue Days</th>
                    <th className="p-3">Pending Amount</th>
                    <th className="p-3">Guardian Contact</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueList.map((item) => (
                    <tr key={item.installmentId} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">
                        {item.studentName}
                        <div className="text-xs text-slate-400 font-normal">Adm: {item.admissionNumber}</div>
                      </td>
                      <td className="p-3 font-medium">{item.className}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{item.feeName}</div>
                        <div className="text-xs text-slate-400">{item.installmentTitle}</div>
                      </td>
                      <td className="p-3 text-xs text-slate-600">{item.dueDate}</td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                          {item.daysOverdue} days late
                        </span>
                      </td>
                      <td className="p-3 font-bold text-rose-600">₹{item.overdueAmount.toLocaleString()}</td>
                      <td className="p-3 text-xs">
                        <div className="flex items-center text-slate-700">
                          <PhoneCall className="w-3 h-3 mr-1 text-slate-400" />
                          {item.guardianPhone || 'No phone'}
                        </div>
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenStudentStatement(item.studentId)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                        >
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Class Collection Reports */}
      {activeTab === 'statements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Class-wise Fee Collection Ledger ({academicYear})</h2>
            <button
              onClick={() => handleExportCsv('classes')}
              className="text-xs text-emerald-700 font-semibold hover:underline flex items-center"
            >
              <Download className="w-3 h-3 mr-1" /> Export Summary
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b">
                <tr>
                  <th className="p-3">Class</th>
                  <th className="p-3">Enrolled</th>
                  <th className="p-3">Total Billed</th>
                  <th className="p-3">Total Collected</th>
                  <th className="p-3">Outstanding Balance</th>
                  <th className="p-3">Recovery Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classReport.map((c) => (
                  <tr key={c.classId} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{c.className}</td>
                    <td className="p-3">{c.enrolledStudents} students</td>
                    <td className="p-3 font-semibold">₹{c.totalBilled.toLocaleString()}</td>
                    <td className="p-3 text-emerald-600 font-semibold">₹{c.totalCollected.toLocaleString()}</td>
                    <td className="p-3 text-rose-600 font-semibold">₹{c.totalBalance.toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, c.collectionRate)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-xs text-slate-800">{c.collectionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Fee Structures */}
      {activeTab === 'structures' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Standard Fee Structures & Billing Catalog</h2>
            <div className="text-xs text-slate-500">Configured fee rules for {academicYear}</div>
          </div>

          <div className="divide-y divide-slate-100">
            {structures.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No fee structures configured.</div>
            ) : (
              structures.map((st) => (
                <div key={st.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center">
                      {st.name}
                      <span className="ml-2 text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                        {st.category}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {st.class ? `${st.class.name}-${st.class.section}` : 'School-wide'} &bull; Frequency:{' '}
                      {st.frequency} &bull; {st._count?.studentFees || 0} students assigned
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">₹{st.totalAmount.toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Student Statement / Ledger Drawer Modal */}
      {statementData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center">
                  <Receipt className="w-5 h-5 mr-2 text-emerald-600" />
                  Official Student Fee Statement: {statementData.student.name}
                </h2>
                <div className="text-xs text-slate-500">
                  Class: {statementData.student.class} | Adm: {statementData.student.admissionNumber} | Guardian Phone:{' '}
                  {statementData.student.guardianPhone || 'N/A'}
                </div>
              </div>
              <button
                onClick={() => setStatementData(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Summary Ribbon */}
            <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border text-center text-xs">
              <div>
                <div className="text-slate-400 uppercase">Total Billed</div>
                <div className="text-base font-bold text-slate-900">₹{statementData.summary.totalBilled}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase">Concessions</div>
                <div className="text-base font-bold text-indigo-600">₹{statementData.summary.totalDiscounts}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase">Paid to Date</div>
                <div className="text-base font-bold text-emerald-600">₹{statementData.summary.totalPaid}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase">Current Due</div>
                <div className="text-base font-bold text-rose-600">₹{statementData.summary.totalOutstanding}</div>
              </div>
            </div>

            {/* Fee Accounts & Installment Schedule */}
            <div className="space-y-4">
              {statementData.accounts.map((acc) => (
                <div key={acc.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">{acc.feeStructure.name}</div>
                      <div className="text-xs text-slate-400">
                        Category: {acc.feeStructure.category} &bull; Net: ₹{acc.netAmount} &bull; Paid: ₹{acc.paidAmount} &bull; Balance: ₹{acc.balanceAmount}
                      </div>
                    </div>

                    <div className="space-x-2">
                      {acc.balanceAmount > 0 && (
                        <>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setDiscountForm({
                                  studentFeeId: acc.id,
                                  discountType: 'FIXED_AMOUNT',
                                  value: '',
                                  reason: '',
                                });
                                setShowDiscountModal(true);
                              }}
                              className="px-2 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                            >
                              <Percent className="w-3 h-3 inline mr-1" /> Concession
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenPaymentModal(acc, statementData.student.name)}
                            className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Collect Payment
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Installments Table */}
                  <table className="w-full text-left text-xs text-slate-600 border-t border-slate-100">
                    <thead className="text-slate-400 font-semibold uppercase">
                      <tr>
                        <th className="py-2">Installment</th>
                        <th className="py-2">Due Date</th>
                        <th className="py-2">Amount</th>
                        <th className="py-2">Paid</th>
                        <th className="py-2">Balance</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {acc.installments.map((inst) => (
                        <tr key={inst.id}>
                          <td className="py-2 font-medium">{inst.title}</td>
                          <td className="py-2">{new Date(inst.dueDate).toISOString().split('T')[0]}</td>
                          <td className="py-2">₹{inst.amount}</td>
                          <td className="py-2 text-emerald-600">₹{inst.paidAmount}</td>
                          <td className="py-2 font-bold text-slate-800">₹{inst.balanceAmount}</td>
                          <td className="py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                inst.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inst.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Payment Receipts History */}
                  {acc.payments.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 text-xs">
                      <div className="font-semibold text-slate-700 mb-1">Payment Receipts:</div>
                      <div className="flex flex-wrap gap-2">
                        {acc.payments.map((p) => (
                          <div
                            key={p.id}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-50 border text-slate-700"
                          >
                            <span className="font-semibold">{p.receiptNumber}</span>
                            <span>(₹{p.amountPaid})</span>
                            <button
                              onClick={() => handleViewReceipt(p.receiptNumber)}
                              className="text-sky-600 hover:underline text-[11px]"
                            >
                              View
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setReversalPayment(p);
                                  setShowReversalModal(true);
                                }}
                                className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold ml-1"
                              >
                                Reversal
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setStatementData(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Print Modal */}
      {showReceiptModal && activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 print:m-0 print:p-0">
            <div className="flex justify-between items-center border-b pb-3 print:hidden">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Receipt className="w-5 h-5 mr-1.5 text-emerald-600" /> Payment Receipt
              </h2>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-slate-300 rounded-lg p-4 space-y-3 text-xs">
              <div className="text-center pb-2 border-b">
                <h3 className="font-bold text-sm text-slate-900">RAJKIYA ADARSH VIDYALAYA</h3>
                <p className="text-[10px] text-slate-500">Official Fee Receipt &bull; ShikshaTrack Portal</p>
                <div className="mt-1 font-semibold text-slate-700">Receipt No: {activeReceipt.receiptNumber}</div>
                <div className="text-slate-400">{new Date(activeReceipt.paymentDate).toLocaleString()}</div>
              </div>

              <div className="space-y-1">
                <div>
                  <span className="font-semibold text-slate-600">Student: </span>
                  {activeReceipt.student?.name} (Adm: {activeReceipt.student?.admissionNumber})
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Fee Head: </span>
                  {activeReceipt.studentFee?.feeStructure?.name}
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Method: </span>
                  {activeReceipt.paymentMethod} {activeReceipt.transactionReference ? `(${activeReceipt.transactionReference})` : ''}
                </div>
              </div>

              <div className="pt-2 border-t flex justify-between items-center text-sm font-bold">
                <span>Amount Paid:</span>
                <span className="text-emerald-700">₹{activeReceipt.amountPaid.toLocaleString()}</span>
              </div>

              {activeReceipt.isReversed && (
                <div className="p-2 rounded bg-rose-50 text-rose-700 font-bold text-center border border-rose-200">
                  REVERSED ON {new Date(activeReceipt.reversedAt).toLocaleDateString()}
                  <div className="text-[10px] font-normal">{activeReceipt.reversalReason}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-900 flex items-center"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Print
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Record Fee Collection</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-sm">
              <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-0.5">
                <div>
                  <span className="text-slate-500">Student: </span>
                  <span className="font-semibold text-slate-800">{paymentForm.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Outstanding Balance: </span>
                  <span className="font-bold text-rose-600">₹{paymentForm.maxBalance}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount to Collect (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={paymentForm.maxBalance}
                  value={paymentForm.amountPaid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI (PhonePe, GPay, Paytm)</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="OTHER">Other Method</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Reference / UTR</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-12345678, Bank Ref"
                  value={paymentForm.transactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {formSubmitting ? 'Recording...' : 'Generate Receipt & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Reversal Modal */}
      {showReversalModal && reversalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 text-rose-600 flex items-center">
                <RotateCcw className="w-5 h-5 mr-1.5" /> Confirm Payment Reversal
              </h2>
              <button onClick={() => setShowReversalModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are reversing receipt <strong>{reversalPayment.receiptNumber}</strong> (₹{reversalPayment.amountPaid}).
              This will restore the student's outstanding balance. An audit entry is mandatory.
            </p>

            <form onSubmit={handleConfirmReversal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Reversal Justification *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Document reason (e.g. bounced cheque, bank chargeback, accidental entry)..."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowReversalModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !reversalReason.trim()}
                  className="px-3 py-1.5 text-xs font-bold rounded bg-rose-600 text-white hover:bg-rose-700"
                >
                  {formSubmitting ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Fee Structure Modal */}
      {showStructureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Define New Fee Structure</h2>
              <button onClick={() => setShowStructureModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStructure} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Term 1 Tuition & Computer Fee"
                  value={structureForm.name}
                  onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={structureForm.category}
                    onChange={(e) => setStructureForm({ ...structureForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="TUITION">Tuition</option>
                    <option value="TRANSPORT">Transport</option>
                    <option value="EXAMINATION">Examination</option>
                    <option value="LIBRARY">Library</option>
                    <option value="DEVELOPMENT">Development</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="12000"
                    value={structureForm.totalAmount}
                    onChange={(e) => setStructureForm({ ...structureForm, totalAmount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Applicable Class (Optional)</label>
                <select
                  value={structureForm.classId}
                  onChange={(e) => setStructureForm({ ...structureForm, classId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">School-wide (All Classes)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.section}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowStructureModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {formSubmitting ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Fee Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Assign Fee to Students</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignFee} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Structure *</label>
                <select
                  required
                  value={assignForm.feeStructureId}
                  onChange={(e) => setAssignForm({ ...assignForm, feeStructureId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Fee Structure</option>
                  {structures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (₹{s.totalAmount})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Scope *</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, targetMode: 'CLASS' })}
                    className={`py-2 rounded border font-semibold ${
                      assignForm.targetMode === 'CLASS'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Entire Class
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, targetMode: 'STUDENT' })}
                    className={`py-2 rounded border font-semibold ${
                      assignForm.targetMode === 'STUDENT'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Specific Student
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class *</label>
                <select
                  required
                  value={assignForm.classId}
                  onChange={(e) => setAssignForm({ ...assignForm, classId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.section}
                    </option>
                  ))}
                </select>
              </div>

              {assignForm.targetMode === 'STUDENT' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student *</label>
                  <select
                    required
                    value={assignForm.studentId}
                    onChange={(e) => setAssignForm({ ...assignForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Student</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.admissionNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Installment Count</label>
                  <select
                    value={assignForm.installmentsCount}
                    onChange={(e) => setAssignForm({ ...assignForm, installmentsCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="1">1 (Single Payment)</option>
                    <option value="2">2 Installments</option>
                    <option value="3">3 Installments</option>
                    <option value="4">4 Termly Installments</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Due Date</label>
                  <input
                    type="date"
                    required
                    value={assignForm.firstDueDate}
                    onChange={(e) => setAssignForm({ ...assignForm, firstDueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !assignForm.feeStructureId || !assignForm.classId}
                  className="px-4 py-2 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {formSubmitting ? 'Assigning...' : 'Assign Fee Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Apply Fee Concession</h2>
              <button onClick={() => setShowDiscountModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={discountForm.discountType}
                    onChange={(e) => setDiscountForm({ ...discountForm, discountType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="FIXED_AMOUNT">Fixed (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Value *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={discountForm.value}
                    onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Justification Reason *</label>
                <textarea
                  required
                  rows="2"
                  placeholder="e.g. Merit scholarship, sibling concession, financial hardship waiver..."
                  value={discountForm.reason}
                  onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !discountForm.value}
                  className="px-3 py-1.5 text-xs font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {formSubmitting ? 'Applying...' : 'Apply Concession'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
