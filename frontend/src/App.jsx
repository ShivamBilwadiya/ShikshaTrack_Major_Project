import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './context/OfflineContext';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentList from './pages/StudentList';
import StudentForm from './pages/StudentForm';
import StudentProfile from './pages/StudentProfile';
import ClassManagement from './pages/ClassManagement';
import TeacherManagement from './pages/TeacherManagement';
import TimetableManagement from './pages/TimetableManagement';
import AcademicCalendar from './pages/AcademicCalendar';
import ExaminationManagement from './pages/ExaminationManagement';
import LeaveManagement from './pages/LeaveManagement';
import StudentIncidentManagement from './pages/StudentIncidentManagement';
import QrIdCards from './pages/QrIdCards';
import QrAttendanceScanner from './pages/QrAttendanceScanner';
import ManualAttendance from './pages/ManualAttendance';
import AttendanceHistory from './pages/AttendanceHistory';
import AttendanceReports from './pages/AttendanceReports';
import AttendanceAnalytics from './pages/AttendanceAnalytics';
import Analytics from './pages/Analytics';
import AiInsights from './pages/AiInsights';
import AiReportGenerator from './pages/AiReportGenerator';
import OfflineSync from './pages/OfflineSync';
import Settings from './pages/Settings';

// Route Guards
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading ShikshaTrack Portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'ADMIN' ? '/admin/dashboard' : '/teacher/dashboard'} replace />;
  }

  return children;
};

// Default Landing Redirection
const HomeRedirect = () => {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'ADMIN' ? '/admin/dashboard' : '/teacher/dashboard'} replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Authenticated Dashboard Shell */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeRedirect />} />

              {/* Admin Dashboard */}
              <Route
                path="admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Teacher Dashboard */}
              <Route
                path="teacher/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER']}>
                    <TeacherDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Student Management */}
              <Route path="students" element={<StudentList />} />
              <Route
                path="students/new"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <StudentForm />
                  </ProtectedRoute>
                }
              />
              <Route path="students/:id" element={<StudentProfile />} />

              {/* Class & Faculty Management */}
              <Route
                path="classes"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <ClassManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="teachers"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <TeacherManagement />
                  </ProtectedRoute>
                }
              />
              <Route path="timetable" element={<TimetableManagement />} />
              <Route path="calendar" element={<AcademicCalendar />} />
              <Route path="exams" element={<ExaminationManagement />} />
              <Route path="leaves" element={<LeaveManagement />} />
              <Route path="incidents" element={<StudentIncidentManagement />} />

              {/* QR ID Cards Print Sheet */}
              <Route path="qr-cards" element={<QrIdCards />} />

              {/* Attendance Operations */}
              <Route path="attendance/scan" element={<QrAttendanceScanner />} />
              <Route path="attendance/manual" element={<ManualAttendance />} />
              <Route path="attendance/history" element={<AttendanceHistory />} />

              {/* Reports & Visual Analytics */}
              <Route path="reports" element={<AttendanceReports />} />
              <Route path="attendance/analytics" element={<AttendanceAnalytics />} />
              <Route path="analytics" element={<Analytics />} />

              {/* AI Features */}
              <Route
                path="ai-insights"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AiInsights />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai-reports"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AiReportGenerator />
                  </ProtectedRoute>
                }
              />

              {/* Offline Sync Center */}
              <Route path="sync" element={<OfflineSync />} />

              {/* Settings & Info */}
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </OfflineProvider>
    </AuthProvider>
  );
}

