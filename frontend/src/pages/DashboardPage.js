import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign, FileText, Tractor, AlertCircle,
  Users, UserCircle, TrendingUp, Clock, BarChart3, PieChart
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
    }
  ];

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Welcome back, {user?.full_name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
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
    </div>
  );
}
