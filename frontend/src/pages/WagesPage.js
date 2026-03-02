import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { DollarSign, CheckCircle, Clock, Users, Wrench, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

export default function WagesPage() {
  const [wages, setWages] = useState([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingWages, setPayingWages] = useState(new Set());   // tracks in-flight by wage_id
  const [payingMechanic, setPayingMechanic] = useState(new Set());
  const [generatingPayroll, setGeneratingPayroll] = useState(false);

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

  const handlePayMechanic = async (wageId) => {
    if (payingMechanic.has(wageId)) return;
    setPayingMechanic(prev => new Set(prev).add(wageId));
    try {
      await api.put(`/org/pay-mechanic/${wageId}`);
      toast.success('Mechanic payment recorded!');
      // Optimistic: Update wages state so pending filters catch it immediately
      setWages(prev => prev.map(w =>
        w.wage_id === wageId ? { ...w, payment_status: 'paid', paid_at: new Date().toISOString() } : w
      ));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process payment');
    } finally {
      setPayingMechanic(prev => { const s = new Set(prev); s.delete(wageId); return s; });
    }
  };

  // FIX: STRICT React Table Segregation
  // Enforce explicit checks for role, including nested properties, defaulting to operator
  const pendingOperatorWages = wages.filter(w => {
    const isPending = w.payment_status === 'pending' || !w.payment_status;
    const role = w.employee_role || w.employee?.role || w.role;
    const isOperator = role === 'operator' || !role; // Default legacy to operator
    return isPending && isOperator;
  });

  const pendingMechanicWages = wages.filter(w => {
    const isPending = w.payment_status === 'pending' || !w.payment_status;
    const role = w.employee_role || w.employee?.role || w.role;
    return isPending && role === 'mechanic';
  });

  const totalPendingOperator = pendingOperatorWages.reduce((s, w) => s + (w.wage_amount || 0), 0);
  const totalPendingMechanic = pendingMechanicWages.reduce((s, w) => s + (w.wage_amount || 0), 0);
  const { user } = useAuth(); // ADDED RBAC CHECK

  const totalWagesPaid = wages.filter(w => w.payment_status === 'paid').reduce((s, w) => s + (w.wage_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading payroll data...</div>
      </div>
    );
  }

  // Debugging log for Wage Data structure
  console.log("WAGE DATA FOR MATH:", wages);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <DollarSign className="h-10 w-10 mr-3 text-primary" />
          Payroll & Wages
        </h1>
        <p className="mt-1 text-muted-foreground">Manage operator and mechanic payouts</p>
      </div>

      {/* Run Manager Payroll Button */}
      {(user?.role === 'owner' || user?.role === 'org_admin') && (
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              setGeneratingPayroll(true);
              try {
                const res = await api.post('/wages/generate-managers');
                toast.success(res.data.message, { duration: 8000 });
                fetchData();
              } catch (error) {
                toast.error(error.response?.data?.detail || 'Failed to generate payroll');
              } finally {
                setGeneratingPayroll(false);
              }
            }}
            disabled={generatingPayroll}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            {generatingPayroll ? 'Generating...' : 'Run Manager Payroll (Monthly)'}
          </Button>
        </div>
      )}

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
              <p className="text-xs text-muted-foreground">{pendingMechanicWages.length} job(s)</p>
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
                      {user?.role === 'org_admin' && (
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Mechanic Payouts */}
      {pendingMechanicWages.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-orange-200 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <h2 className="text-base font-semibold text-orange-900">Pending Mechanic Payouts</h2>
            <span className="ml-auto bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingMechanicWages.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-orange-100/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Wage ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Mechanic</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Maintenance ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-orange-900 uppercase tracking-wider">Labor Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-orange-900 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {pendingMechanicWages.map((wage) => (
                  <tr key={wage.wage_id} className="bg-white hover:bg-orange-50/50 transition-colors" data-testid={`pending-mechanic-${wage.wage_id}`}>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wage.wage_id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      {wage.employee_name || wage.employee_id || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wage.booking_id}</td>
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-orange-700">₹{(wage.wage_amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      {user?.role === 'org_admin' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={payingMechanic.has(wage.wage_id)}
                          onClick={() => handlePayMechanic(wage.wage_id)}
                          data-testid={`pay-mechanic-${wage.wage_id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {payingMechanic.has(wage.wage_id) ? 'Paying...' : 'Mark as Paid'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Wage History */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">All Wage History (Paid)</h2>
        </div>
        {wages.filter(w => w.payment_status === 'paid').length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No paid wage records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Wage ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Booking / Maintenance ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wages.filter(w => w.payment_status === 'paid').map((wage) => (
                  <tr key={wage.wage_id} className="table-row" data-testid={`wage-row-${wage.wage_id}`}>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wage.wage_id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground capitalize">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${wage.employee_role === 'mechanic' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                        {wage.employee_role || 'operator'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{wage.employee_name || wage.employee_id || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wage.booking_id}</td>
                    <td className="px-6 py-4 text-sm font-mono text-foreground">₹{(wage.wage_amount || 0).toLocaleString()}</td>
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
