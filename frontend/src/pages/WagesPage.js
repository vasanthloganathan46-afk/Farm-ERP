import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { DollarSign, CheckCircle, Clock, Users, Wrench } from 'lucide-react';
import { toast } from 'sonner';

export default function WagesPage() {
  const [wages, setWages] = useState([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingWages, setPayingWages] = useState(new Set());   // tracks in-flight by wage_id
  const [payingMechanic, setPayingMechanic] = useState(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [wagesRes, maintenanceRes] = await Promise.all([
        api.get('/wages'),
        api.get('/maintenance')
      ]);
      setWages(wagesRes.data);
      setMaintenanceJobs(maintenanceRes.data);
    } catch (error) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePayOperator = async (wageId) => {
    if (payingWages.has(wageId)) return;                         // prevent double-click
    setPayingWages(prev => new Set(prev).add(wageId));
    try {
      await api.put(`/org/pay-operator/${wageId}`);
      toast.success('Operator wage marked as paid!');
      // Optimistic: remove from pending list immediately
      setWages(prev => prev.map(w =>
        w.wage_id === wageId ? { ...w, payment_status: 'paid', paid_at: new Date().toISOString() } : w
      ));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process payment');
    } finally {
      setPayingWages(prev => { const s = new Set(prev); s.delete(wageId); return s; });
    }
  };

  const handlePayMechanic = async (maintenanceId) => {
    if (payingMechanic.has(maintenanceId)) return;
    setPayingMechanic(prev => new Set(prev).add(maintenanceId));
    try {
      await api.put(`/org/pay-mechanic/${maintenanceId}`);
      toast.success('Mechanic payment recorded!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process payment');
    } finally {
      setPayingMechanic(prev => { const s = new Set(prev); s.delete(maintenanceId); return s; });
    }
  };

  // Derived data
  const pendingOperatorWages = wages.filter(w => w.payment_status === 'pending' || !w.payment_status);
  const pendingMechanicJobs = maintenanceJobs.filter(
    j => j.status === 'completed' && j.labor_cost > 0 && j.payment_status !== 'paid'
  );
  const totalPendingOperator = pendingOperatorWages.reduce((s, w) => s + (w.wage_amount || 0), 0);
  const totalPendingMechanic = pendingMechanicJobs.reduce((s, j) => s + (j.labor_cost || 0), 0);
  const totalWagesPaid = wages.filter(w => w.payment_status === 'paid').reduce((s, w) => s + (w.wage_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading payroll data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <DollarSign className="h-10 w-10 mr-3 text-primary" />
          Payroll & Wages
        </h1>
        <p className="mt-1 text-muted-foreground">Manage operator and mechanic payouts</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 text-yellow-600 p-2.5 rounded-lg">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Operator</p>
              <p className="text-2xl font-bold font-mono text-foreground">₹{totalPendingOperator.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{pendingOperatorWages.length} record(s)</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 text-orange-600 p-2.5 rounded-lg">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Mechanic</p>
              <p className="text-2xl font-bold font-mono text-foreground">₹{totalPendingMechanic.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{pendingMechanicJobs.length} job(s)</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 text-green-600 p-2.5 rounded-lg">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Paid (Operators)</p>
              <p className="text-2xl font-bold font-mono text-foreground">₹{totalWagesPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Operator Payouts */}
      {pendingOperatorWages.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-yellow-200 flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <h2 className="text-base font-semibold text-yellow-900">Pending Operator Payouts</h2>
            <span className="ml-auto bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingOperatorWages.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-yellow-100/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-yellow-900 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-yellow-900 uppercase tracking-wider">Booking ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-yellow-900 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-yellow-900 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-100">
                {pendingOperatorWages.map((wage) => (
                  <tr key={wage.wage_id} className="bg-white hover:bg-yellow-50/50 transition-colors" data-testid={`pending-operator-${wage.wage_id}`}>
                    <td className="px-6 py-4 text-sm font-medium text-foreground flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {wage.employee_name || wage.employee_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wage.booking_id}</td>
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-yellow-700">₹{(wage.wage_amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={payingWages.has(wage.wage_id)}
                        onClick={() => handlePayOperator(wage.wage_id)}
                        data-testid={`pay-operator-${wage.wage_id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {payingWages.has(wage.wage_id) ? 'Paying...' : 'Mark as Paid'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Mechanic Payouts */}
      {pendingMechanicJobs.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-orange-200 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <h2 className="text-base font-semibold text-orange-900">Pending Mechanic Payouts</h2>
            <span className="ml-auto bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingMechanicJobs.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-orange-100/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Mechanic</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Maintenance ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Machine</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Labor Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-orange-900 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {pendingMechanicJobs.map((job) => (
                  <tr key={job.maintenance_id} className="bg-white hover:bg-orange-50/50 transition-colors" data-testid={`pending-mechanic-${job.maintenance_id}`}>
                    <td className="px-6 py-4 text-sm font-medium text-foreground flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      {job.mechanic_name || job.mechanic_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{job.maintenance_id}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{job.machine_type || job.machinery_id}</td>
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-orange-700">₹{(job.labor_cost || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={payingMechanic.has(job.maintenance_id)}
                        onClick={() => handlePayMechanic(job.maintenance_id)}
                        data-testid={`pay-mechanic-${job.maintenance_id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {payingMechanic.has(job.maintenance_id) ? 'Paying...' : 'Mark as Paid'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Operator Wage Records */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">All Operator Wage Records</h2>
        </div>
        {wages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No wage records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Wage ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Booking ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wages.map((wage) => (
                  <tr key={wage.wage_id} className="table-row" data-testid={`wage-row-${wage.wage_id}`}>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wage.wage_id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{wage.employee_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wage.booking_id}</td>
                    <td className="px-6 py-4 text-sm font-mono text-foreground">₹{wage.wage_amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${wage.payment_status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {wage.payment_status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {wage.paid_at ? new Date(wage.paid_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
