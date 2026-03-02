import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Wrench, DollarSign, Fuel, TrendingDown, Download, Calendar, Search, Users, UserCircle, AlertCircle, FileText, Tractor, Star } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#0F3D3E', '#F97316', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];

export default function ReportsPage() {
  // ── Existing report state ────────────────────────────────────────
  const [revenueReport, setRevenueReport] = useState(null);
  const [utilization, setUtilization] = useState([]);
  const [maintenanceReport, setMaintenanceReport] = useState(null);
  const [wagesReport, setWagesReport] = useState(null);
  const [roiReport, setRoiReport] = useState(null);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── NEW: Date-filtered BI state ──────────────────────────────────
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [financialData, setFinancialData] = useState(null);
  const [utilizationData, setUtilizationData] = useState([]);
  const [biLoading, setBiLoading] = useState(false);

  // ── Detail report state ──────────────────────────────────────────
  const [selectedDetailType, setSelectedDetailType] = useState('revenue');
  const [detailData, setDetailData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Dashboard KPI stats state ────────────────────────────────────
  const [dashStats, setDashStats] = useState(null);

  // ── Load existing reports on mount ───────────────────────────────
  useEffect(() => {
    fetchReports();
    fetchDashStats();
  }, []);

  const fetchDashStats = async () => {
    try {
      const res = await api.get('/dashboard');
      setDashStats(res.data);
    } catch { /* silently fail — KPIs are optional */ }
  };

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

  // ── NEW: Fetch date-filtered BI reports ──────────────────────────
  const fetchBIReports = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both a start and end date');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setBiLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      const [financialRes, utilDetailRes] = await Promise.all([
        api.get('/reports/financial', { params }),
        api.get('/reports/utilization-detail', { params }),
      ]);
      setFinancialData(financialRes.data);
      setUtilizationData(utilDetailRes.data);
      toast.success('Report generated successfully');
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      const safeMsg = typeof errDetail === 'string' ? errDetail : Array.isArray(errDetail) ? errDetail[0]?.msg : error.message || 'Failed to generate report';
      toast.error(safeMsg);
    } finally {
      setBiLoading(false);
    }
  };

  // ── NEW: Export to CSV ───────────────────────────────────────────
  const exportToCSV = () => {
    if (!financialData && utilizationData.length === 0) {
      toast.error('Generate a report first before exporting');
      return;
    }

    console.log('CSV RAW DATA:', utilizationData);

    const rows = [];

    // Financial summary header
    rows.push(['=== FINANCIAL SUMMARY ===']);
    rows.push(['Metric', 'Amount (INR)']);
    if (financialData) {
      rows.push(['Total Revenue', financialData.total_revenue ?? 0]);
      rows.push(['Labor Costs', financialData.total_labor_cost ?? 0]);
      rows.push(['Spare Parts Cost', financialData.total_spare_parts_cost ?? 0]);
      rows.push(['Wages Paid', financialData.total_wages_paid ?? 0]);
      rows.push(['Diesel Costs', financialData.total_diesel ?? 0]);
      rows.push(['Net Profit', financialData.net_profit ?? 0]);
    }
    rows.push([]);

    // Fleet utilization header
    rows.push(['=== FLEET UTILIZATION ===']);
    rows.push(['Machine Name', 'Machine ID', 'Total Jobs', 'Revenue (INR)']);
    utilizationData.forEach(item => {
      rows.push([
        item.machine_name || 'Unknown',
        item.machinery_id || 'N/A',
        item.total_jobs ?? 0,
        item.total_revenue ?? 0
      ]);
    });

    // Build CSV string
    const csvContent = rows.map(row => row.map(cell => `"${cell ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `agrigear_report_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('CSV exported successfully');
  };

  // ── Fetch detail report data ──────────────────────────────────────
  const fetchDetailReport = async (type) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/dashboard/reports/${type}`);
      setDetailData(res.data);
    } catch {
      setDetailData([]);
      toast.error('Failed to load detail report');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetailTypeChange = (type) => {
    setSelectedDetailType(type);
    fetchDetailReport(type);
  };

  // ── Detail CSV Export ─────────────────────────────────────────────
  // Aggregation helpers
  const isNumericColumn = (key) => {
    const k = key.toLowerCase();
    return ['cost', 'amount', 'liters', 'wage', 'price', 'total', 'charge', 'parts', 'hours', 'quantity'].some(keyword => k.includes(keyword));
  };

  const calculateFooterValue = (key) => {
    if (!detailData || detailData.length === 0) return 0;
    const k = key.toLowerCase();
    // Rate columns (e.g. "cost per liter") → calculate average
    if (k.includes('per')) {
      const validRows = detailData.filter(row => Number(row[key]) > 0);
      if (validRows.length === 0) return 0;
      const sum = validRows.reduce((acc, row) => acc + Number(row[key]), 0);
      return (sum / validRows.length).toFixed(2);
    }
    // Everything else → sum
    return detailData.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  };

  const exportDetailCSV = () => {
    if (!detailData || detailData.length === 0) return;
    const keys = Object.keys(detailData[0]).filter(k => k !== '_id' && k !== 'tenant_id');

    // Header + data rows
    const csvRows = [
      keys.join(','),
      ...detailData.map(row => keys.map(k => {
        let val = row[k];
        if (k.includes('date') && val) {
          try { val = new Date(val).toLocaleDateString('en-IN'); } catch { }
        }
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      }).join(','))
    ];

    // Totals row
    const totalsRow = keys.map((k, index) => {
      if (index === 0) return '"TOTALS"';
      if (isNumericColumn(k)) {
        const val = calculateFooterValue(k);
        const label = k.toLowerCase().includes('per') ? `${val} (Avg)` : val;
        return `"${label}"`;
      }
      return '"-"';
    }).join(',');

    csvRows.push(keys.map(() => '').join(','));  // blank row
    csvRows.push(totalsRow);
    csvRows.push(keys.map(() => '').join(','));  // blank row
    csvRows.push(`"STATISTICS","Total Records: ${detailData.length}"`);

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedDetailType}_report_with_totals.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSV exported with totals!');
  };

  // ── Loading state ───────────────────────────────────────────────
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
        <p className="mt-1 text-muted-foreground">View business insights, performance metrics, and generate custom reports</p>
      </div>

      {/* ══════════ KPI Summary Grid ══════════ */}
      {dashStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Total Revenue', value: `₹${(dashStats.total_revenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { title: 'Total Bookings', value: dashStats.total_bookings || 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
            { title: 'Active Machinery', value: dashStats.active_machinery || 0, icon: Tractor, color: 'text-primary', bg: 'bg-primary/10' },
            { title: 'Pending Payments', value: `₹${(dashStats.pending_payments || 0).toLocaleString()}`, icon: AlertCircle, color: 'text-accent', bg: 'bg-accent/10' },
            { title: 'Total Farmers', value: dashStats.total_farmers || 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { title: 'Total Employees', value: dashStats.total_employees || 0, icon: UserCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { title: 'Total Spare Parts', value: `₹${(dashStats.total_spare_parts_cost || 0).toLocaleString()}`, icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
            { title: 'Company Rating', value: `⭐ ${dashStats.average_rating?.toFixed(1) || '0.0'} / 5.0 (${dashStats.total_reviews || 0})`, icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map((card, i) => (
            <div key={i} className="bg-card border border-border p-5 rounded-xl shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                <p className="text-2xl font-bold font-heading mt-1">{card.value}</p>
              </div>
              <div className={`${card.bg} ${card.color} p-3 rounded-lg`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════ NEW: Date Controls & Generate ══════════ */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Custom Report Generator
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={fetchBIReports}
            disabled={biLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {biLoading ? 'Generating…' : 'Generate Report'}
          </button>
          <button
            onClick={exportToCSV}
            disabled={!financialData && utilizationData.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted/50 transition-colors disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            📥 Export to CSV
          </button>
        </div>
      </div>



      {/* ══════════ NEW: Fleet Utilization Table ══════════ */}
      {utilizationData.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Fleet Utilization
            <span className="ml-2 text-xs font-normal text-muted-foreground">({startDate} → {endDate})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Machine Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Machine ID</th>
                  <th className="px-4 py-3 text-right font-semibold text-blue-700">Total Jobs</th>
                  <th className="px-4 py-3 text-right font-semibold text-green-700">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {utilizationData.map((item, idx) => (
                  <tr key={item.machinery_id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">{item.machine_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.machinery_id}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{item.total_jobs}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">₹{item.total_revenue?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ DETAIL REPORT SECTION ══════════ */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold font-heading flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Detail Reports
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={selectedDetailType}
              onChange={(e) => handleDetailTypeChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="revenue">Revenue (Completed Bookings)</option>
              <option value="diesel">Diesel / Fuel Logs</option>
              <option value="wages">Wage Payouts</option>
              <option value="maintenance">Maintenance & Repairs</option>
              <option value="spare_parts">Approved Spare Parts</option>
            </select>
            <button
              onClick={exportDetailCSV}
              disabled={detailData.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted/50 transition-colors disabled:opacity-40 text-sm"
            >
              <Download className="h-4 w-4" />
              📥 Export CSV
            </button>
          </div>
        </div>

        {detailLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading report data...</p>
        ) : detailData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Select a report type and data will load automatically. No data found for this category.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {Object.keys(detailData[0]).filter(k => k !== '_id' && k !== 'tenant_id').map(key => (
                    <th key={key} className="px-4 py-3 text-left font-semibold capitalize">{key.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detailData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/10 transition-colors">
                    {Object.keys(row).filter(k => k !== '_id' && k !== 'tenant_id').map(key => {
                      let val = row[key];
                      if (key.includes('date') && val) {
                        try { val = new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { }
                      } else if (typeof val === 'number') {
                        val = val.toLocaleString();
                      }
                      return <td key={key} className="px-4 py-3 text-muted-foreground">{String(val ?? '')}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/20 border-t-2 border-border">
                <tr className="font-bold text-foreground">
                  {Object.keys(detailData[0]).filter(k => k !== '_id' && k !== 'tenant_id').map((key, index) => (
                    <td key={`footer-${key}`} className="px-4 py-3">
                      {index === 0 ? (
                        <span className="uppercase text-xs tracking-wider text-muted-foreground">Report Totals</span>
                      ) : isNumericColumn(key) ? (
                        <span className="font-mono">
                          {key.toLowerCase().includes('liters') || key.toLowerCase().includes('hours') || key.toLowerCase().includes('quantity') ? '' : '₹'}
                          {Number(calculateFooterValue(key)).toLocaleString('en-IN')}
                          {key.toLowerCase().includes('per') && ' (Avg)'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={Object.keys(detailData[0]).filter(k => k !== '_id' && k !== 'tenant_id').length} className="px-4 py-2 text-xs text-muted-foreground">
                    📊 {detailData.length} records · Report generated {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
