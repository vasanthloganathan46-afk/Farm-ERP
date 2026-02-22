import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function FarmerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings');
      setBookings(response.data);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'Confirmed': return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'Pending': return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'Rejected': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'Confirmed': return 'bg-blue-100 text-blue-700';
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
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
          <FileText className="h-10 w-10 mr-3 text-primary" />
          My Bookings
        </h1>
        <p className="mt-1 text-muted-foreground">Track your machinery rental requests and status</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Bookings Yet</h3>
          <p className="text-muted-foreground">Start by browsing our machinery fleet and creating your first booking.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.booking_id} className="bg-card border-l-4 border-l-primary rounded-lg shadow-md overflow-hidden" data-testid={`booking-card-${booking.booking_id}`}>
              <div className="bg-muted/30 px-6 py-4 border-b border-border flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-foreground">{booking.machine_type || 'Machine'}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{booking.booking_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(booking.status)}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Booking Date</p>
                  <p className="text-sm font-medium font-mono text-foreground mt-1">{new Date(booking.booking_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="text-sm font-medium text-foreground mt-1">{booking.field_location}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Operator</p>
                  <p className="text-sm font-medium text-foreground mt-1">{booking.operator_name || 'To be assigned'}</p>
                </div>
                {booking.expected_hours && (
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Hours</p>
                    <p className="text-sm font-medium font-mono text-foreground mt-1">{booking.expected_hours} hrs</p>
                  </div>
                )}
                {booking.expected_acres && (
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Acres</p>
                    <p className="text-sm font-medium font-mono text-foreground mt-1">{booking.expected_acres} acres</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Approval Status</p>
                  <p className="text-sm font-medium text-foreground mt-1">{booking.approval_status}</p>
                </div>
              </div>
              {booking.status === 'Pending' && booking.approval_status === 'Pending' && (
                <div className="px-6 pb-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    <Clock className="h-4 w-4 inline mr-2" />
                    Awaiting admin approval. You'll be notified once approved.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
