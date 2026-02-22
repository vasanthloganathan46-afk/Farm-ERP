import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Tractor, Clock, CheckCircle } from 'lucide-react';
import SuspensionAppealChat from '../components/SuspensionAppealChat';
import api from '../api/axios';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // null | { type: 'suspended'|'pending'|'generic', message, suspendedUsername }
  const [authError, setAuthError] = useState(null);
  // null | { has_open_ticket: bool, message_count: int }
  const [appealStatus, setAppealStatus] = useState(null);
  const [appealLoading, setAppealLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // When a suspension error arrives, immediately check if an appeal already exists
  useEffect(() => {
    if (authError?.type === 'suspended' && authError.suspendedUsername) {
      setAppealLoading(true);
      api.get(`/support/tickets/status/${authError.suspendedUsername}`)
        .then(res => {
          console.log('[LoginPage] Appeal status for', authError.suspendedUsername, ':', res.data);
          setAppealStatus(res.data);
        })
        .catch(err => {
          console.error('[LoginPage] Could not fetch appeal status:', err?.response?.data || err.message);
          setAppealStatus({ has_open_ticket: false, message_count: 0 });
        })
        .finally(() => setAppealLoading(false));
    } else {
      setAppealStatus(null);
    }
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      await login(username, password);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      const httpStatus = error.response?.status;
      const detail = error.response?.data?.detail || '';
      if (httpStatus === 403 && detail.startsWith('SUSPENDED:')) {
        const parts = detail.split(':');
        const suspendedUsername = parts[1];
        const reason = parts.slice(2).join(':') || 'No reason provided.';
        setAuthError({ type: 'suspended', message: reason, suspendedUsername });
      } else if (httpStatus === 403) {
        setAuthError({ type: 'generic', message: detail || 'Access denied.' });
      } else {
        toast.error(detail || 'Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  // Called by SuspensionAppealChat after a successful send so we update status inline
  const handleAppealSent = () => {
    setAppealStatus(prev => ({
      has_open_ticket: true,
      message_count: (prev?.message_count || 0) + 1,
    }));
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero */}
      <div
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1758608951432-773ae6a33f56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0cmFjdG9yJTIwaW4lMjBmaWVsZHxlbnwwfHx8fDE3NjgxMzY0NDh8MA&ixlib=rb-4.1.0&q=85')"
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70" />
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <Tractor className="h-24 w-24 mb-6" />
          <h1 className="text-5xl font-bold font-heading mb-4">AgriGear ERP</h1>
          <p className="text-xl text-center opacity-90">Farm Machinery Management System</p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4 lg:hidden">
              <Tractor className="h-16 w-16 text-primary" />
            </div>
            <h2 className="text-3xl font-bold font-heading text-foreground">Welcome Back</h2>
            <p className="mt-2 text-muted-foreground">Sign in to your account</p>
          </div>

          {/* ── Generic / Pending error (stays OUTSIDE the form) ── */}
          {authError && authError.type !== 'suspended' && (
            <div
              className="flex items-start gap-3 p-4 rounded-lg border text-sm font-medium bg-orange-50 border-orange-300 text-orange-800"
              role="alert"
              data-testid="auth-error-alert"
            >
              <span className="text-lg leading-none">⚠️</span>
              <span>{authError.message}</span>
            </div>
          )}

          {/* ── LOGIN FORM — contains NO nested forms ── */}
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="username-input"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setAuthError(null); }}
                required
                className="mt-1"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline" tabIndex={-1}>
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                required
                className="mt-1"
                placeholder="Enter your password"
              />
            </div>

            <Button
              type="submit"
              data-testid="login-button"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* ── SUSPENSION BLOCK — outside the form, has its own nested form safely ── */}
          {authError?.type === 'suspended' && authError.suspendedUsername && (
            <div className="space-y-3">
              {/* Suspension reason banner */}
              <div
                className="flex items-start gap-3 p-4 rounded-lg border text-sm font-medium bg-red-50 border-red-300 text-red-800"
                role="alert"
                data-testid="auth-error-alert"
              >
                <span className="text-lg leading-none">🚫</span>
                <div>
                  <p className="font-bold mb-1">Account Suspended</p>
                  <span>{authError.message}</span>
                </div>
              </div>

              {/* Appeal section — rendered OUTSIDE the login <form> */}
              {appealLoading ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-sm text-muted-foreground">
                  Checking appeal status…
                </div>
              ) : appealStatus?.has_open_ticket ? (
                /* Appeal already submitted → show banner + chat thread */
                <div className="border border-green-200 rounded-xl overflow-hidden bg-green-50" data-testid="appeal-submitted-banner">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-green-200 bg-green-100">
                    <CheckCircle className="h-5 w-5 text-green-700 shrink-0" />
                    <p className="text-sm font-semibold text-green-800">Appeal Submitted</p>
                  </div>
                  <div className="px-4 py-3 space-y-1">
                    <p className="text-sm text-green-800">
                      Your appeal has been submitted ({appealStatus.message_count} message{appealStatus.message_count !== 1 ? 's' : ''}).
                      The admin will review it and reply here.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <Clock className="h-3 w-3" />
                      <span>Replies appear below automatically every 10 seconds.</span>
                    </div>
                  </div>
                  {/* Chat still visible so they can read admin replies */}
                  <div className="border-t border-green-200">
                    <SuspensionAppealChat
                      username={authError.suspendedUsername}
                      onMessageSent={handleAppealSent}
                    />
                  </div>
                </div>
              ) : (
                /* No appeal yet → show the chat input form */
                <SuspensionAppealChat
                  username={authError.suspendedUsername}
                  onMessageSent={handleAppealSent}
                />
              )}
            </div>
          )}

          <div className="text-center text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">New farmer? </span>
              <Link to="/farmer-register" className="text-primary font-medium hover:underline">Register here</Link>
            </div>
            <div>
              <span className="text-muted-foreground">Freelance mechanic? </span>
              <Link to="/mechanic-register" className="text-primary font-medium hover:underline">Register as Mechanic</Link>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm font-semibold text-foreground mb-3">Demo Credentials</p>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {[
                ['admin', 'Super Admin (admin123)'],
                ['manager', 'Org Admin (manager123)'],
                ['owner', 'Owner / Read-Only (owner123)'],
                ['operator1', 'Operator (op123)'],
                ['mechanic1', 'Mechanic (mech123)'],
                ['farmer1', 'Farmer (farmer123)'],
              ].map(([uname, label]) => (
                <div key={uname} className="flex justify-between items-center p-2 bg-background rounded border border-border">
                  <span className="font-mono font-medium">{uname}</span>
                  <span className="text-muted-foreground text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
