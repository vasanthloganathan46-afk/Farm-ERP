import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, CreditCard, DollarSign, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Invoice Status Section ────────────────────────────────────────────────
function InvoiceSection({ title, icon: Icon, invoices, colorClass, bgClass, borderClass, isReadOnly, onRecordPayment }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`border ${borderClass} rounded-xl overflow-hidden`}>
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className={`w-full flex items-center justify-between px-5 py-3 ${bgClass} hover:opacity-90 transition-opacity`}
      >
        <div className={`flex items-center gap-2 font-semibold text-sm ${colorClass}`}>
          <Icon className="h-4 w-4" />
          {title}
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/60 ${colorClass}`}>
            {invoices.length}
          </span>
        </div>
        {collapsed ? <ChevronRight className={`h-4 w-4 ${colorClass}`} /> : <ChevronDown className={`h-4 w-4 ${colorClass}`} />}
      </button>

      {/* Section Body */}
      {!collapsed && (
        invoices.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground bg-card">
            No {title.toLowerCase()} invoices.
          </div>
        ) : (
          <div className="overflow-x-auto bg-card">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Invoice ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Farmer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Generated</th>
                  {!isReadOnly && <th className="px-5 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map(invoice => (
                  <tr key={invoice.invoice_id} className="hover:bg-muted/10 transition-colors" data-testid={`invoice-row-${invoice.invoice_id}`}>
                    <td className="px-5 py-3 text-xs font-mono text-muted-foreground">{invoice.invoice_id}</td>
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{invoice.farmer_name || 'N/A'}</td>
                    <td className="px-5 py-3 text-sm font-mono font-semibold text-foreground">₹{invoice.amount?.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(invoice.generated_at).toLocaleDateString()}</td>
                    {!isReadOnly && (
                      <td className="px-5 py-3 text-right">
                        {invoice.payment_status !== 'Paid' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRecordPayment(invoice)}
                            data-testid={`record-payment-${invoice.invoice_id}`}
                          >
                            <DollarSign className="h-3.5 w-3.5 mr-1" />
                            Record Payment
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'owner';
  const [invoices, setInvoices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentData, setPaymentData] = useState({ amount: '', payment_method: 'Cash' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, bookingsRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/bookings')
      ]);
      setInvoices(invoicesRes.data);
      console.log('[InvoicesPage] fetched invoices:', invoicesRes.data);
      const completedBookings = bookingsRes.data.filter(b => b.status === 'Completed');
      const bookingsWithoutInvoice = completedBookings.filter(
        cb => !invoicesRes.data.some(inv => inv.booking_id === cb.booking_id)
      );
      setBookings(bookingsWithoutInvoice);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (bookingId) => {
    try {
      await api.post(`/invoices/generate/${bookingId}`);
      toast.success('Invoice generated successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate invoice');
    }
  };

  const handleRecordPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({ amount: invoice.amount.toString(), payment_method: 'Cash' });
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/payments', {
        invoice_id: selectedInvoice.invoice_id,
        amount: parseFloat(paymentData.amount),
        payment_method: paymentData.payment_method
      });
      toast.success('Payment recorded successfully');
      setPaymentDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
  }

  // ── Split invoices by payment_status ──
  const pendingInvoices = invoices.filter(i => i.payment_status === 'Pending');
  const partialInvoices = invoices.filter(i => i.payment_status === 'Partially Paid');
  const paidInvoices = invoices.filter(i => i.payment_status === 'Paid');

  const totalPending = pendingInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPartial = partialInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPaid = paidInvoices.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <CreditCard className="h-10 w-10 mr-3 text-primary" />
          Invoices &amp; Payments
        </h1>
        <p className="mt-1 text-muted-foreground">Manage invoices and track payments by status</p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-red-100 p-2 rounded-lg"><AlertCircle className="h-5 w-5 text-red-600" /></div>
          <div>
            <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold font-mono text-red-800">₹{totalPending.toLocaleString()}</p>
            <p className="text-xs text-red-500">{pendingInvoices.length} invoice{pendingInvoices.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-yellow-100 p-2 rounded-lg"><Clock className="h-5 w-5 text-yellow-600" /></div>
          <div>
            <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">Partially Paid</p>
            <p className="text-2xl font-bold font-mono text-yellow-800">₹{totalPartial.toLocaleString()}</p>
            <p className="text-xs text-yellow-500">{partialInvoices.length} invoice{partialInvoices.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div>
          <div>
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Paid</p>
            <p className="text-2xl font-bold font-mono text-green-800">₹{totalPaid.toLocaleString()}</p>
            <p className="text-xs text-green-500">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* ── Pending invoice generation prompt ── */}
      {bookings.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Completed Jobs — Awaiting Invoice
          </h3>
          <div className="space-y-2">
            {bookings.map(booking => (
              <div key={booking.booking_id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-blue-100">
                <div>
                  <p className="text-sm font-medium text-foreground">{booking.farmer_name} — {booking.machine_type}</p>
                  <p className="text-xs text-muted-foreground font-mono">{booking.booking_id}</p>
                </div>
                {!isReadOnly && (
                  <Button size="sm" onClick={() => handleGenerateInvoice(booking.booking_id)} data-testid={`generate-invoice-${booking.booking_id}`}>
                    <Plus className="h-4 w-4 mr-1" /> Generate Invoice
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Three segregated invoice sections ── */}
      <div className="space-y-4">
        <InvoiceSection
          title="Pending Invoices"
          icon={AlertCircle}
          invoices={pendingInvoices}
          colorClass="text-red-700"
          bgClass="bg-red-50"
          borderClass="border-red-200"
          isReadOnly={isReadOnly}
          onRecordPayment={handleRecordPayment}
        />
        <InvoiceSection
          title="Partially Paid Invoices"
          icon={Clock}
          invoices={partialInvoices}
          colorClass="text-yellow-700"
          bgClass="bg-yellow-50"
          borderClass="border-yellow-200"
          isReadOnly={isReadOnly}
          onRecordPayment={handleRecordPayment}
        />
        <InvoiceSection
          title="Paid Invoices"
          icon={CheckCircle}
          invoices={paidInvoices}
          colorClass="text-green-700"
          bgClass="bg-green-50"
          borderClass="border-green-200"
          isReadOnly={isReadOnly}
          onRecordPayment={handleRecordPayment}
        />
      </div>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent data-testid="payment-dialog">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div>
              <Label>Invoice Amount</Label>
              <p className="text-2xl font-bold font-mono text-foreground mt-1">₹{selectedInvoice?.amount.toLocaleString()}</p>
            </div>
            <div>
              <Label htmlFor="amount">Payment Amount *</Label>
              <Input
                id="amount"
                data-testid="payment-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                max={selectedInvoice?.amount}
                value={paymentData.amount}
                onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="payment_method">Payment Method *</Label>
              <Select value={paymentData.payment_method} onValueChange={v => setPaymentData({ ...paymentData, payment_method: v })}>
                <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="submit-payment">Record Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
