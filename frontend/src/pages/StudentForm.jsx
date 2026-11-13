import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import {
  GraduationCap,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Printer,
  Sparkles,
} from 'lucide-react';

export default function StudentForm() {
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    admissionNumber: '',
    rollNumber: '',
    classId: '',
    dateOfBirth: '',
    gender: 'Male',
    guardianName: '',
    guardianPhone: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredStudent, setRegisteredStudent] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/classes');
        setClasses(res.data);
        if (res.data.length > 0) {
          setFormData((prev) => ({ ...prev, classId: res.data[0].id }));
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        if (!value || !value.trim()) return 'Student full name is required.';
        if (value.trim().length < 2) return 'Name must be at least 2 characters.';
        return '';
      case 'admissionNumber':
        if (!value || !value.trim()) return 'Admission number is required.';
        if (!/^[A-Za-z0-9_-]{3,30}$/.test(value.trim())) {
          return 'Admission number should be 3-30 letters, numbers, or dashes.';
        }
        return '';
      case 'classId':
        if (!value) return 'Please select a valid class.';
        return '';
      case 'rollNumber':
        if (value && (!/^\d+$/.test(value) || parseInt(value, 10) <= 0)) {
          return 'Roll number must be a positive integer.';
        }
        return '';
      case 'guardianPhone':
        if (value) {
          const cleanPhone = value.replace(/[\s+-]/g, '');
          if (!/^\d{10,12}$/.test(cleanPhone)) {
            return 'Please enter a valid 10-digit mobile number.';
          }
        }
        return '';
      case 'dateOfBirth':
        if (value && new Date(value) > new Date()) {
          return 'Date of birth cannot be in the future.';
        }
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-level error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const err = validateField(name, value);
    setFieldErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleGenerateAdmissionNo = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const newAdm = `ADM-2026-${random}`;
    setFormData((prev) => ({ ...prev, admissionNumber: newAdm }));
    setFieldErrors((prev) => ({ ...prev, admissionNumber: '' }));
  };

  const validateForm = () => {
    const errors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) errors[key] = err;
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      setError('Please resolve all validation errors before submitting.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/students', formData);
      setRegisteredStudent(res.data);
    } catch (err) {
      setError(err.message || 'Failed to register student.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate('/students')}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Enrollment Form</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Register a student and automatically issue a cryptographic QR Identity Token
          </p>
        </div>
      </div>

      {registeredStudent ? (
        /* Success Screen with Printable QR Preview */
        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-md text-center space-y-6 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Student Registered Successfully!</h2>
            <p className="text-xs text-slate-500 mt-1">
              Encrypted QR Code has been securely generated and assigned to {registeredStudent.name}.
            </p>
          </div>

          {/* ID Preview Card */}
          <div className="max-w-sm mx-auto p-5 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-800 text-left">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3">
              <div>
                <span className="text-[10px] tracking-wider text-sky-400 font-bold uppercase block">
                  ShikshaTrack Student ID
                </span>
                <h3 className="font-bold text-base text-white">{registeredStudent.name}</h3>
                <p className="text-xs text-slate-300">
                  {registeredStudent.class?.name}-{registeredStudent.class?.section} (Roll: {registeredStudent.rollNumber || 'N/A'})
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-xs">
                ST
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Admission No</span>
                  <span className="font-mono font-bold text-white">{registeredStudent.admissionNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Token</span>
                  <span className="font-mono text-[10px] text-sky-300">{registeredStudent.qrToken}</span>
                </div>
              </div>
              <div className="bg-white p-2 rounded-xl shadow-inner">
                <img
                  src={registeredStudent.qrDataUrl}
                  alt="QR Code"
                  className="w-24 h-24 object-contain"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-3 pt-4">
            <Link
              to="/qr-cards"
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-xs transition"
            >
              <Printer size={15} />
              <span>Go to Bulk ID Print Sheet</span>
            </Link>
            <button
              onClick={() => {
                setRegisteredStudent(null);
                setFormData({
                  name: '',
                  admissionNumber: '',
                  rollNumber: '',
                  classId: classes[0]?.id || '',
                  dateOfBirth: '',
                  gender: 'Male',
                  guardianName: '',
                  guardianPhone: '',
                });
              }}
              className="px-4 py-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 text-xs font-semibold shadow-xs transition"
            >
              Enroll Another Student
            </button>
          </div>
        </div>
      ) : (
        /* Enrollment Form */
        <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Student Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. Ramesh Chandra"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.name
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-slate-300 focus:ring-sky-500'
                }`}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center space-x-1">
                  <span>{fieldErrors.name}</span>
                </p>
              )}
            </div>

            {/* Admission Number */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Admission Number *
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAdmissionNo}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center space-x-1"
                >
                  <Sparkles size={12} />
                  <span>Auto-generate</span>
                </button>
              </div>
              <input
                type="text"
                name="admissionNumber"
                value={formData.admissionNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. ADM-2026-0042"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.admissionNumber
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-slate-300 focus:ring-sky-500'
                }`}
              />
              {fieldErrors.admissionNumber && (
                <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center space-x-1">
                  <span>{fieldErrors.admissionNumber}</span>
                </p>
              )}
            </div>

            {/* Class Assignment */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Class / Grade *
              </label>
              <select
                name="classId"
                value={formData.classId}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.classId
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-slate-300 focus:ring-sky-500'
                }`}
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}-{cls.section} ({cls.academicYear})
                  </option>
                ))}
              </select>
              {fieldErrors.classId && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {fieldErrors.classId}
                </p>
              )}
            </div>

            {/* Roll Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Class Roll Number
              </label>
              <input
                type="text"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. 14"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.rollNumber
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-slate-300 focus:ring-sky-500'
                }`}
              />
              {fieldErrors.rollNumber && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {fieldErrors.rollNumber}
                </p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.dateOfBirth
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-slate-300 focus:ring-sky-500'
                }`}
              />
              {fieldErrors.dateOfBirth && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {fieldErrors.dateOfBirth}
                </p>
              )}
            </div>

            {/* Guardian Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Guardian / Parent Name
              </label>
              <input
                type="text"
                name="guardianName"
                value={formData.guardianName}
                onChange={handleChange}
                placeholder="e.g. Mohan Ram"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Guardian Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Guardian Contact Phone
              </label>
              <input
                type="text"
                name="guardianPhone"
                value={formData.guardianPhone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. 9829012345"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.guardianPhone
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                    : 'border-slate-300 focus:ring-sky-500'
                }`}
              />
              {fieldErrors.guardianPhone && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {fieldErrors.guardianPhone}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/students')}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
            >
              {loading ? 'Creating Record...' : 'Enroll & Generate QR Token'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

