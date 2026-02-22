import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { CreditCard, DollarSign, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function FarmerInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'UPI'
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/invoices');
      setInvoices(response.data);
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.amount.toString(),
      payment_method: 'UPI'
    });
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
      toast.success('Payment recorded successfully!');
      setPaymentDialogOpen(false);
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Partially Paid': return 'bg-yellow-100 text-yellow-700';
      case 'Pending': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <CreditCard className="h-10 w-10 mr-3 text-primary" />
          My Invoices
        </h1>
        <p className="mt-1 text-muted-foreground">View and pay your machinery rental invoices</p>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Invoices Yet</h3>
          <p className="text-muted-foreground">Invoices will appear here after your bookings are completed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div key={invoice.invoice_id} className="bg-card border-l-4 border-l-primary rounded-lg shadow-md overflow-hidden" data-testid={`invoice-card-${invoice.invoice_id}`}>
              <div className="bg-muted/30 px-6 py-4 border-b border-border flex justify-between items-center">
                <div>
                  <h3 className="font-semibold font-mono text-foreground">{invoice.invoice_id}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Generated: {new Date(invoice.generated_at).toLocaleDateString()}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(invoice.payment_status)}`}>
                  {invoice.payment_status}
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Due</p>
                    <p className="text-3xl font-bold font-mono text-foreground mt-1">₹{invoice.amount.toLocaleString()}</p>
                    {invoice.payment_status !== 'Paid' && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Auto-generated from completed booking
                      </p>
                    )}
                  </div>
                  {invoice.payment_status !== 'Paid' && (
                    <Button 
                      onClick={() => handlePayNow(invoice)}
                      data-testid={`pay-invoice-${invoice.invoice_id}`}
                      size="lg"
                    >
                      <DollarSign className="h-5 w-5 mr-2" />
                      Pay Now
                    </Button>
                  )}
                  {invoice.payment_status === 'Paid' && (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-6 w-6 mr-2" />
                      <span className="font-semibold">Payment Complete</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent data-testid="payment-dialog">
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div>
              <Label>Invoice Amount</Label>
              <p className="text-3xl font-bold font-mono text-foreground mt-2">₹{selectedInvoice?.amount.toLocaleString()}</p>
            </div>
            <div>
              <Label htmlFor="amount">Payment Amount *</Label>
              <Input
                id="amount"
                data-testid="payment-amount-input"
                type="number"
                step="0.01"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="payment_method">Payment Method *</Label>
              <Select value={paymentData.payment_method} onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}>
                <SelectTrigger data-testid="payment-method-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Payment Information</p>
              <p>For demo purposes, any payment will be recorded. In production, integrate with actual payment gateway.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="confirm-payment-button">Confirm Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
