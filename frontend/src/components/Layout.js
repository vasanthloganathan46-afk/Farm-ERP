import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  LayoutDashboard, Users, Tractor, UserCircle, FileText,
  CreditCard, Wrench, DollarSign, BarChart3, LogOut, Menu, X, Shield, UserCog
} from 'lucide-react';
import { Button } from './ui/button';

const navigation = [
  { name: 'Super Admin Dashboard', href: '/admin/dashboard', icon: Shield, roles: ['super_admin'] },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['org_admin', 'owner'] },
  { name: 'My Dashboard', href: '/farmer/dashboard', icon: LayoutDashboard, roles: ['farmer'] },
  { name: 'Field Operations', href: '/field-operations', icon: LayoutDashboard, roles: ['operator'] },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench, roles: ['mechanic'] },
  { name: 'Browse Fleet', href: '/farmer/browse', icon: Tractor, roles: ['farmer'] },
  { name: 'My Bookings', href: '/farmer/bookings', icon: FileText, roles: ['farmer'] },
  { name: 'My Invoices', href: '/farmer/invoices', icon: CreditCard, roles: ['farmer'] },
  { name: 'Farmers', href: '/farmers', icon: Users, roles: ['org_admin', 'owner'] },
  { name: 'Machinery', href: '/machinery', icon: Tractor, roles: ['org_admin', 'owner'] },
  { name: 'Employees', href: '/employees', icon: UserCircle, roles: ['org_admin', 'owner'] },
  { name: 'Operators', href: '/operators', icon: UserCog, roles: ['org_admin'] },
  { name: 'Bookings', href: '/bookings', icon: FileText, roles: ['org_admin', 'owner'] },
  { name: 'Invoices', href: '/invoices', icon: CreditCard, roles: ['org_admin', 'owner'] },
  { name: 'Maintenance Log', href: '/maintenance', icon: Wrench, roles: ['org_admin', 'owner'] },
  { name: 'Wages', href: '/wages', icon: DollarSign, roles: ['org_admin', 'owner'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['org_admin', 'owner'] }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(user?.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await api.put('/users/change-password', { new_password: newPassword });
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to change password');
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex h-screen bg-muted">
      {/* Forced Password Reset Modal — un-closable */}
      {user?.must_change_password && (
        <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-96 max-w-[90vw]">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Security Requirement</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">Your account was created with a temporary password. Please set a new password to continue using AgriGear ERP.</p>
            <input
              type="password"
              placeholder="New Password (min. 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              autoFocus
            />
            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {changingPassword ? 'Updating...' : 'Update Password & Continue'}
            </button>
          </div>
        </div>
      )}
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex md:flex-col md:w-64 bg-primary text-primary-foreground">
        <div className="flex items-center justify-center h-16 border-b border-white/10">
          <h1 className="text-2xl font-bold font-heading tracking-tight">AgriGear ERP</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`sidebar-link flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive ? 'active' : 'hover:bg-white/10'
                    }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-sm mb-3">
            <div className="font-medium">{user?.full_name}</div>
            <div className="text-xs opacity-80 capitalize">{user?.role}</div>
            {user?.company_name && ['owner', 'org_admin', 'operator'].includes(user?.role?.toLowerCase()) && (
              <span className="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded border border-green-300">
                🏢 {user.company_name}
              </span>
            )}
          </div>
          <Button
            onClick={handleLogout}
            data-testid="logout-button"
            variant="secondary"
            className="w-full justify-start"
            size="sm"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-primary text-primary-foreground">
            <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
              <h1 className="text-xl font-bold font-heading">AgriGear ERP</h1>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="py-4 px-3">
              <div className="space-y-1">
                {filteredNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`sidebar-link flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive ? 'active' : 'hover:bg-white/10'
                        }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4 md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden"
            data-testid="mobile-menu-button"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground flex items-center">
            Welcome, <span className="font-medium text-foreground ml-1 mr-2">{user?.full_name}</span>
            {user?.company_name && ['owner', 'org_admin', 'operator'].includes(user?.role?.toLowerCase()) && (
              <span className="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded border border-green-300">
                🏢 {user.company_name}
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-muted p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
