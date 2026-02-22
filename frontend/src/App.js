import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import FarmerRegisterPage from './pages/FarmerRegisterPage';
import DashboardPage from './pages/DashboardPage';
import FarmerDashboardPage from './pages/FarmerDashboardPage';
import FarmerBrowsePage from './pages/FarmerBrowsePage';
import FarmerBookingsPage from './pages/FarmerBookingsPage';
import FarmerInvoicesPage from './pages/FarmerInvoicesPage';
import FarmersPage from './pages/FarmersPage';
import MachineryPage from './pages/MachineryPage';
import EmployeesPage from './pages/EmployeesPage';
import BookingsPage from './pages/BookingsPage';
import FieldOperationsPage from './pages/FieldOperationsPage';
import InvoicesPage from './pages/InvoicesPage';
import MaintenancePage from './pages/MaintenancePage';
import WagesPage from './pages/WagesPage';
import ReportsPage from './pages/ReportsPage';
import OperatorsPage from './pages/OperatorsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MechanicRegisterPage from './pages/MechanicRegisterPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/farmer-register" element={<FarmerRegisterPage />} />
          <Route path="/mechanic-register" element={<MechanicRegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleBasedRedirect />} />
            <Route path="dashboard" element={<DashboardPage />} />
            {/* Farmer Routes */}
            <Route path="farmer/dashboard" element={<FarmerDashboardPage />} />
            <Route path="farmer/browse" element={<FarmerBrowsePage />} />
            <Route path="farmer/bookings" element={<FarmerBookingsPage />} />
            <Route path="farmer/invoices" element={<FarmerInvoicesPage />} />
            {/* Admin/Staff Routes */}
            <Route path="farmers" element={<FarmersPage />} />
            <Route path="machinery" element={<MachineryPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="operators" element={<OperatorsPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="field-operations" element={<FieldOperationsPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="wages" element={<WagesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            {/* Super Admin Route */}
            <Route path="admin/dashboard" element={<SuperAdminDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function RoleBasedRedirect() {
  const { user, loading } = useAuth(); // Assuming useAuth provides loading state

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'farmer') return <Navigate to="/farmer/dashboard" replace />;
  if (user.role === 'operator') return <Navigate to="/field-operations" replace />;
  if (user.role === 'mechanic') return <Navigate to="/maintenance" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin/dashboard" replace />;

  return <Navigate to="/dashboard" replace />;
}

export default App;
