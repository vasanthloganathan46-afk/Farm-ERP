import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign, FileText, Tractor, AlertCircle,
  Users, UserCircle, TrendingUp, Clock, BarChart3, PieChart, Trash2, Star, Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [revenueData, setRevenueData] = useState(null);
  const [utilizationData, setUtilizationData] = useState([]);
  const [roiData, setRoiData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Owner Manager Creation Form
  const [managerForm, setManagerForm] = useState({ name: '', email: '', monthly_salary: '' });
  const [creatingManager, setCreatingManager] = useState(false);
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    if (user?.role === 'owner') fetchManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, bookingsRes, maintenanceRes, revenueRes, utilRes, roiRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/bookings'),
        api.get('/maintenance'),
        api.get('/reports/revenue'),
        api.get('/reports/utilization'),
        api.get('/reports/roi')
      ]);
      setStats(statsRes.data);
      setBookings(bookingsRes.data.slice(0, 5));
      setMaintenance(maintenanceRes.data.filter(m => !m.completed_at).slice(0, 5));
      setRevenueData(revenueRes.data);
      setUtilizationData(utilRes.data.machinery_utilization);
      setRoiData(roiRes.data.roi_analysis);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    setCreatingManager(true);
    try {
      const res = await api.post('/owner/managers', { full_name: managerForm.name, email: managerForm.email, monthly_salary: parseFloat(managerForm.monthly_salary) || 0 });
      const data = res.data;
      if (data.temp_password) {
        toast.success(`Manager created! Email failed — Please share these credentials manually:\nUsername: ${data.username || data.email}\nPassword: ${data.temp_password}`, { duration: 20000 });
      } else {
        toast.success(`Manager created! Login credentials emailed to ${data.email}`);
      }
      setManagerForm({ name: '', email: '', monthly_salary: '' });
      fetchManagers();
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      const safeMsg = typeof errDetail === 'string' ? errDetail : Array.isArray(errDetail) ? errDetail[0]?.msg : error.message || 'Failed to create manager';
      toast.error(safeMsg);
    } finally {
      setCreatingManager(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await api.get('/admin/users');
      const orgManagers = res.data.filter(u => u.role === 'org_admin' && u.organization_id === user?.organization_id);
      setManagers(orgManagers);
    } catch { /* silently fail */ }
  };

  const handleDeleteManager = async (username, fullName) => {
    if (!window.confirm(`Are you sure you want to delete manager "${fullName}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/owner/managers/${username}`);
      toast.success(`Manager '${fullName}' deleted successfully`);
      setManagers(prev => prev.filter(m => m.username !== username));
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      const safeMsg = typeof errDetail === 'string' ? errDetail : Array.isArray(errDetail) ? errDetail[0]?.msg : error.message || 'Failed to delete manager';
      toast.error(safeMsg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg font-medium text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${stats?.total_revenue?.toLocaleString() || 0}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Bookings',
      value: stats?.total_bookings || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Active Machinery',
      value: stats?.active_machinery || 0,
      icon: Tractor,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'Pending Payments',
      value: `₹${stats?.pending_payments?.toLocaleString() || 0}`,
      icon: AlertCircle,
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      title: 'Total Farmers',
      value: stats?.total_farmers || 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Total Employees',
      value: stats?.total_employees || 0,
      icon: UserCircle,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Total Spare Parts',
      value: `₹${stats?.total_spare_parts_cost?.toLocaleString() || 0}`,
      icon: Wrench,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Company Rating',
      value: `⭐️ ${stats?.average_rating?.toFixed(1) || '0.0'} / 5.0 (${stats?.total_reviews || 0} Reviews)`,
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    }
  ];

  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">Overview of your farm machinery operations</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          stat.title === 'Company Rating' ? (
            <div key={index} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <h3 className="text-gray-500 text-sm font-medium mb-3">Company Rating</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 bg-yellow-50 text-yellow-500 rounded-full text-2xl">
                  ★
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800">
                    {stats?.average_rating ? Number(stats.average_rating).toFixed(1) : "0.0"} <span className="text-lg text-gray-500 font-medium">/ 5.0</span>
                  </div>
                  <div className="text-sm text-gray-400 font-medium mt-0.5">
                    {stats?.total_reviews || 0} Reviews
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={index}
              data-testid={`stat-card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
              className="stat-card bg-card border border-border p-6 rounded-xl shadow-sm flex items-start justify-between"
            >
              <div>
                <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                <p className="text-3xl font-bold font-heading mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          )
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & ROI Chart */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-primary" />
            Machine ROI Analysis
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="machine_type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#16a34a" />
                <Bar dataKey="maintenance_cost" name="Maint. Cost" fill="#dc2626" />
                <Bar dataKey="roi" name="Net ROI" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utilization Chart */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2 text-indigo-600" />
            Fleet Utilization (Hours)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" />
                <YAxis dataKey="machine_type" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_usage_hours" name="Usage Hours" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold font-heading flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              Recent Bookings
            </h3>
          </div>
          <div className="p-6">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent bookings</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.booking_id} className="flex items-start justify-between pb-4 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{booking.farmer_name || 'Unknown Farmer'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{booking.machine_type || 'Machine'}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">{new Date(booking.booking_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${booking.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      booking.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Maintenance */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold font-heading flex items-center">
              <Clock className="h-5 w-5 mr-2 text-accent" />
              Pending Maintenance
            </h3>
          </div>
          <div className="p-6">
            {maintenance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending maintenance</p>
            ) : (
              <div className="space-y-4">
                {maintenance.map((record) => (
                  <div key={record.maintenance_id} className="flex items-start justify-between pb-4 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{record.machine_type || 'Machine'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{record.service_type}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">Started: {new Date(record.started_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-orange-100 text-orange-700">
                      In Progress
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Owner-Only Manager Creation Section */}
      {user?.role === 'owner' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="p-6 border-b border-border bg-indigo-50/50">
            <h3 className="text-lg font-semibold font-heading flex items-center text-indigo-900">
              <Users className="h-5 w-5 mr-2 text-indigo-600" />
              Managers
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Create new Manager (Org Admin) accounts to help run your tenant operations.</p>
          </div>
          <div className="p-6">
            <form onSubmit={handleCreateManager} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" required value={managerForm.name} onChange={e => setManagerForm({ ...managerForm, name: e.target.value })} className="w-full p-2 border rounded-md text-sm" placeholder="Alice Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" required value={managerForm.email} onChange={e => setManagerForm({ ...managerForm, email: e.target.value })} className="w-full p-2 border rounded-md text-sm" placeholder="alice@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Monthly Salary (₹)</label>
                <input type="number" step="0.01" min="0" value={managerForm.monthly_salary} onChange={e => setManagerForm({ ...managerForm, monthly_salary: e.target.value })} className="w-full p-2 border rounded-md text-sm" placeholder="25000" />
              </div>
              <div>
                <button type="submit" disabled={creatingManager} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm">
                  {creatingManager ? 'Creating...' : 'Create Manager'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Managers List */}
          {managers.length > 0 && (
            <div className="border-t border-border">
              <div className="p-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current Managers</h4>
                <div className="space-y-2">
                  {managers.map(m => (
                    <div key={m.username} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.email} · @{m.username}</p>
                        {m.monthly_salary > 0 && (
                          <p className="text-xs font-semibold text-blue-700 mt-0.5">₹{m.monthly_salary.toLocaleString()} / mo</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteManager(m.username, m.full_name)}
                        title="Delete Manager"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
