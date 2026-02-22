import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Tractor, Calendar, FileText, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function FarmerDashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, invoicesRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/invoices')
      ]);
      setBookings(bookingsRes.data);
      setInvoices(invoicesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const pendingBookings = bookings.filter(b => b.approval_status === 'Pending');
  const confirmedBookings = bookings.filter(b => b.status === 'Confirmed');
  const completedBookings = bookings.filter(b => b.status === 'Completed');
  const pendingInvoices = invoices.filter(i => i.payment_status !== 'Paid');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight">Welcome, {user?.full_name}!</h1>
        <p className="mt-1 text-muted-foreground">Manage your bookings and machinery rentals</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/farmer/browse">
          <Button className="w-full h-24 text-lg" data-testid="browse-fleet-button">
            <Tractor className="h-8 w-8 mr-3" />
            Browse Machinery Fleet
          </Button>
        </Link>
        <Link to="/farmer/bookings">
          <Button variant="outline" className="w-full h-24 text-lg" data-testid="my-bookings-button">
            <FileText className="h-8 w-8 mr-3" />
            My Bookings
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Pending Approval</p>
              <p className="text-3xl font-bold font-heading text-foreground mt-2">{pendingBookings.length}</p>
            </div>
            <div className="bg-yellow-100 text-yellow-600 p-3 rounded-lg">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Confirmed Jobs</p>
              <p className="text-3xl font-bold font-heading text-foreground mt-2">{confirmedBookings.length}</p>
            </div>
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Completed</p>
              <p className="text-3xl font-bold font-heading text-foreground mt-2">{completedBookings.length}</p>
            </div>
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Pending Payment</p>
              <p className="text-3xl font-bold font-heading text-foreground mt-2">{pendingInvoices.length}</p>
            </div>
            <div className="bg-orange-100 text-accent p-3 rounded-lg">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold font-heading">Recent Bookings</h3>
        </div>
        <div className="p-6">
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <Tractor className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No bookings yet. Browse our fleet to get started!</p>
              <Link to="/farmer/browse">
                <Button className="mt-4">Browse Machinery</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.slice(0, 5).map((booking) => (
                <div key={booking.booking_id} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-foreground">{booking.machine_type || 'Machine'}</p>
                    <p className="text-sm text-muted-foreground mt-1">{booking.field_location}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">{new Date(booking.booking_date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                    booking.status === 'Completed' ? 'bg-green-100 text-green-700' :
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

      {/* Pending Invoices */}
      {pendingInvoices.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold font-heading flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-accent" />
              Pending Payments
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {pendingInvoices.map((invoice) => (
                <div key={invoice.invoice_id} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-foreground font-mono">{invoice.invoice_id}</p>
                    <p className="text-sm text-muted-foreground mt-1">Amount: ₹{invoice.amount.toLocaleString()}</p>
                  </div>
                  <Link to="/farmer/invoices">
                    <Button size="sm">Pay Now</Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
