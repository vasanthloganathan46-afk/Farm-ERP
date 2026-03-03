import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { FileText, Clock, CheckCircle, XCircle, Star, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';

export default function FarmerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Rating state
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedBookingForRating, setSelectedBookingForRating] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

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

  const openRatingModal = (booking) => {
    setSelectedBookingForRating(booking);
    setRatingValue(5);
    setReviewText('');
    setRatingModalOpen(true);
  };

  const submitRating = async () => {
    if (!selectedBookingForRating) return;
    setSubmittingRating(true);
    try {
      const payload = {
        rating: parseInt(ratingValue, 10), // FORCE INTEGER
        review: reviewText || ""
      };
      await api.put(`/bookings/${selectedBookingForRating.booking_id}/rate`, payload);
      toast.success('Rating submitted successfully!');
      setRatingModalOpen(false);
      fetchBookings(); // Refresh the list
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      const safeMsg = typeof errDetail === 'string' ? errDetail : Array.isArray(errDetail) ? errDetail[0]?.msg : error.message || 'Failed to submit rating';
      toast.error(safeMsg);
    } finally {
      setSubmittingRating(false);
    }
  };

  // ── CSV Export ─────────────────────────────────────────────────────
  const exportToCSV = () => {
    if (!bookings || bookings.length === 0) {
      toast.error('No bookings available to export.');
      return;
    }

    // 1. Updated Headers — Actual instead of Expected
    const headers = ['Booking Date', 'Machine', 'Location', 'Operator', 'Status', 'Actual Hours', 'Actual Acres', 'Total Cost', 'Rating'];
    const csvRows = [
      headers.join(','),
      ...bookings.map(b => {
        const date = (b.booking_date || b.created_at) ? new Date(b.booking_date || b.created_at).toLocaleDateString('en-IN') : 'N/A';
        const machine = b.machine_type || b.machine_name || 'Unknown';
        const location = (b.field_location || 'N/A').replace(/,/g, ' ');
        const operator = b.operator_name || 'Unassigned';
        const status = b.status || 'Pending';

        // Use actuals instead of expected — aggressive fallbacks
        const hours = b.actual_hours || b.logged_hours || b.completed_hours || '-';
        const acres = b.actual_acres || b.logged_acres || b.completed_acres || '-';

        // Raw number (no ₹) so Excel can do math
        const cost = Number(b.total_cost || b.cost || b.amount || b.price || b.final_cost || b.total_amount || 0);
        const rating = b.rating || '-';
        return `"${date}","${machine}","${location}","${operator}","${status}","${hours}","${acres}","${cost}","${rating}"`;
      })
    ];

    // Totals
    const totalCost = bookings.reduce((sum, b) => {
      return sum + Number(b.total_cost || b.cost || b.amount || b.price || b.total_amount || 0);
    }, 0);
    csvRows.push(',,,,,,,,');
    csvRows.push(`"TOTALS","-","-","-","-","-","-","${totalCost}","-"`);
    csvRows.push(`"SUMMARY","Total Bookings: ${bookings.length}","","","","","","",""`);

    const csvContent = csvRows.join('\n');

    // 2. UTF-8 BOM so Excel renders ₹ and other symbols correctly
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'My_Bookings_Report.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Booking history exported!');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
            <FileText className="h-10 w-10 mr-3 text-primary" />
            My Bookings
          </h1>
          <p className="mt-1 text-muted-foreground">Track your machinery rental requests and status</p>
        </div>
        {bookings.length > 0 && (
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted/50 transition-colors text-sm"
            title="Download your booking history as a spreadsheet"
          >
            <Download className="h-4 w-4" />
            📥 Export CSV
          </button>
        )}
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
                  <p className="text-sm font-medium text-foreground mt-1">
                    {booking.operator_name ? (
                      <span className="text-gray-900 font-medium bg-gray-100 px-2 py-1 rounded">{booking.operator_name}</span>
                    ) : (
                      <span className="text-gray-400 italic">Yet to be assigned</span>
                    )}
                  </p>
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
                <div>
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p className="text-sm font-bold font-mono text-green-700 mt-1">
                    ₹{Number(booking.total_cost || booking.cost || booking.amount || booking.price || booking.total_amount || 0).toLocaleString()}
                  </p>
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

              {/* Rating Button Section */}
              {booking.status === 'Completed' && !booking.rating && (
                <div className="px-6 py-4 bg-gray-50 border-t border-border flex justify-end">
                  <Button
                    onClick={() => openRatingModal(booking)}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Star className="h-4 w-4" />
                    Rate Job
                  </Button>
                </div>
              )}
              {booking.status === 'Completed' && booking.rating && (
                <div className="px-6 py-4 bg-gray-50 border-t border-border flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">Your Rating</div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= booking.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rating Modal */}
      <Dialog open={ratingModalOpen} onOpenChange={setRatingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Your Experience</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              How would you rate the service for {selectedBookingForRating?.machine_type}?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${star <= ratingValue ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                      }`}
                  />
                </button>
              ))}
            </div>
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium text-foreground">Review (Optional)</label>
              <Textarea
                placeholder="Share your experience (optional)"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="w-full"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingModalOpen(false)}>Cancel</Button>
            <Button onClick={submitRating} disabled={submittingRating}>
              {submittingRating ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
