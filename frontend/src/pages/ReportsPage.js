import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Wrench, DollarSign, Fuel, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#0F3D3E', '#F97316', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];

export default function ReportsPage() {
  const [revenueReport, setRevenueReport] = useState(null);
  const [utilization, setUtilization] = useState([]);
  const [maintenanceReport, setMaintenanceReport] = useState(null);
  const [wagesReport, setWagesReport] = useState(null);
  const [roiReport, setRoiReport] = useState(null);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const [revenueRes, utilizationRes, maintenanceRes, wagesRes, invoicesRes, roiRes] = await Promise.all([
        api.get('/reports/revenue'),
        api.get('/reports/utilization'),
        api.get('/reports/maintenance'),
        api.get('/reports/wages'),
        api.get('/invoices'),
        api.get('/reports/roi')
      ]);
      setRevenueReport(revenueRes.data);
      setUtilization(utilizationRes.data.machinery_utilization);
      setMaintenanceReport(maintenanceRes.data);
      setWagesReport(wagesRes.data);
      setRoiReport(roiRes.data);

      // Process Daily Revenue
      const revenueByDate = {};
      invoicesRes.data.forEach(inv => {
        const date = new Date(inv.generated_at).toLocaleDateString();
        revenueByDate[date] = (revenueByDate[date] || 0) + inv.amount;
      });
      const revenueData = Object.keys(revenueByDate).map(date => ({
        date,
        revenue: revenueByDate[date]
      }));
      setDailyRevenue(revenueData);

    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading reports...</div></div>;
  }

  const statusData = [
    { name: 'Available', value: utilization.filter(m => m.status === 'Available').length },
    { name: 'Booked', value: utilization.filter(m => m.status === 'Booked').length },
    { name: 'Under Maintenance', value: utilization.filter(m => m.status === 'Under Maintenance').length }
  ];

  const maintenanceData = [
    { name: 'Completed', value: maintenanceReport?.completed_maintenance || 0 },
    { name: 'Ongoing', value: maintenanceReport?.ongoing_maintenance || 0 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <BarChart3 className="h-10 w-10 mr-3 text-primary" />
          Reports & Analytics
        </h1>
        <p className="mt-1 text-muted-foreground">View business insights and performance metrics</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
              <p className="text-3xl font-bold font-mono text-foreground mt-2">₹{revenueReport?.total_revenue?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Pending Revenue</p>
              <p className="text-3xl font-bold font-mono text-foreground mt-2">₹{revenueReport?.pending_revenue?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-orange-100 text-accent p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Maintenance</p>
              <p className="text-3xl font-bold font-heading text-foreground mt-2">{maintenanceReport?.total_maintenance || 0}</p>
            </div>
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Wrench className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Wages Paid</p>
              <p className="text-3xl font-bold font-mono text-foreground mt-2">₹{wagesReport?.total_wages_paid?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Diesel Cost card */}
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Diesel Cost</p>
              <p className="text-3xl font-bold font-mono text-foreground mt-2">₹{roiReport?.org_totals?.total_diesel_cost?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-amber-100 text-amber-600 p-3 rounded-lg">
              <Fuel className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Net ROI Summary */}
      {roiReport?.org_totals && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Overall ROI Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Revenue</p>
              <p className="text-lg font-bold font-mono text-green-700">₹{roiReport.org_totals.total_revenue?.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Maintenance</p>
              <p className="text-lg font-bold font-mono text-red-600">−₹{roiReport.org_totals.total_maintenance_cost?.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Diesel</p>
              <p className="text-lg font-bold font-mono text-amber-600">−₹{roiReport.org_totals.total_diesel_cost?.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Wages</p>
              <p className="text-lg font-bold font-mono text-purple-600">−₹{roiReport.org_totals.total_operator_wages?.toLocaleString()}</p>
            </div>
            <div className={`text-center p-4 rounded-lg ${roiReport.org_totals.net_roi >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <p className="text-xs text-muted-foreground mb-1">Net ROI</p>
              <p className={`text-lg font-bold font-mono ${roiReport.org_totals.net_roi >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {roiReport.org_totals.net_roi >= 0 ? '+' : ''}₹{roiReport.org_totals.net_roi?.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Per-machine ROI table */}
          {roiReport.roi_analysis?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Machine</th>
                    <th className="px-4 py-2 text-right font-semibold text-green-700">Revenue</th>
                    <th className="px-4 py-2 text-right font-semibold text-red-600">Maintenance</th>
                    <th className="px-4 py-2 text-right font-semibold text-amber-600">Diesel</th>
                    <th className="px-4 py-2 text-right font-semibold text-purple-600">Wages</th>
                    <th className="px-4 py-2 text-right font-semibold">Net ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {roiReport.roi_analysis.map(row => (
                    <tr key={row.machinery_id} className="hover:bg-muted/10">
                      <td className="px-4 py-2 font-medium">{row.machine_type} <span className="text-xs font-mono text-muted-foreground">({row.machinery_id})</span></td>
                      <td className="px-4 py-2 text-right font-mono text-green-700">₹{row.revenue?.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">₹{row.maintenance_cost?.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-amber-600">₹{row.diesel_cost?.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-purple-600">₹{row.operator_wages?.toLocaleString()}</td>
                      <td className={`px-4 py-2 text-right font-mono font-semibold ${row.net_roi >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {row.net_roi >= 0 ? '+' : ''}₹{row.net_roi?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Daily Revenue Chart */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold font-heading mb-4">Daily Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Daily Revenue (₹)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Machinery Utilization */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4">Machinery Utilization (Hours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={utilization}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="machine_type" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_usage_hours" fill="#0F3D3E" name="Usage Hours" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Machinery Status Distribution */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4">Machinery Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Maintenance Status */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4">Maintenance Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={maintenanceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {maintenanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#F97316'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Summary */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4">Revenue Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Total Invoices</span>
              <span className="text-lg font-semibold font-heading">{revenueReport?.total_invoices || 0}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Paid Invoices</span>
              <span className="text-lg font-semibold font-heading">{revenueReport?.paid_invoices || 0}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <span className="text-lg font-semibold font-mono text-green-600">₹{revenueReport?.total_revenue?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending Revenue</span>
              <span className="text-lg font-semibold font-mono text-orange-600">₹{revenueReport?.pending_revenue?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
