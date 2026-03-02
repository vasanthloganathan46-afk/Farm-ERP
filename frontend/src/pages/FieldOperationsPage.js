import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle, ClipboardList, AlertTriangle } from 'lucide-react';

export default function FieldOperationsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    actual_hours: '',
    actual_acres: '',
    notes: ''
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings');
      const confirmed = response.data.filter(b => ['Confirmed', 'Paused'].includes(b.status));
      setBookings(confirmed);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteJob = (booking) => {
    setSelectedBooking(booking);
    setFormData({
      actual_hours: booking.expected_hours || '',
      actual_acres: booking.expected_acres || '',
      notes: ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const logData = {
        booking_id: selectedBooking.booking_id,
        operator_id: selectedBooking.operator_id,
        actual_hours: formData.actual_hours ? parseFloat(formData.actual_hours) : null,
        actual_acres: formData.actual_acres ? parseFloat(formData.actual_acres) : null,
        notes: formData.notes
      };
      await api.post('/field-logs', logData);
      toast.success('Job completed successfully');
      setDialogOpen(false);
      fetchBookings();
    } catch (error) {
      toast.error('Failed to complete job');
    }
  };

  const handleReportBreakdown = async (booking) => {
    if (!window.confirm('Are you sure you want to report a breakdown for this machinery? This will pause the job.')) {
      return;
    }
    try {
      await api.post(`/machinery/${booking.machinery_id}/report-breakdown`);
      toast.error('Breakdown reported. Admin has been notified.');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to report breakdown');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <ClipboardList className="h-10 w-10 mr-3 text-primary" />
          Field Operations
        </h1>
        <p className="mt-1 text-muted-foreground">View assigned jobs and log work completed</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Active Jobs</h3>
          <p className="text-muted-foreground">There are no confirmed bookings assigned to you at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookings.map((booking) => {
            const machineUnderMaintenance = booking.machine_status === 'Under Maintenance';
            return (
              <div key={booking.booking_id} className="bg-card border-l-4 border-l-primary rounded-lg shadow-md overflow-hidden" data-testid={`job-card-${booking.booking_id}`}>
                <div className="bg-muted/30 px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">{booking.farmer_name || 'Unknown Farmer'}</h3>
                  {booking.status === 'Paused' && <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Paused</span>}
                  <p className="text-xs text-muted-foreground font-mono mt-1">{booking.booking_id}</p>
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Machine</p>
                    <p className="text-sm font-medium text-foreground">{booking.machine_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm text-foreground">{booking.field_location}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-mono text-foreground">{new Date(booking.booking_date).toLocaleDateString()}</p>
                  </div>
                  {booking.expected_hours && (
                    <div>
                      <p className="text-xs text-muted-foreground">Expected Hours</p>
                      <p className="text-sm font-mono text-foreground">{booking.expected_hours} hrs</p>
                    </div>
                  )}
                  {booking.expected_acres && (
                    <div>
                      <p className="text-xs text-muted-foreground">Expected Acres</p>
                      <p className="text-sm font-mono text-foreground">{booking.expected_acres} acres</p>
                    </div>
                  )}
                  <Button
                    onClick={() => handleCompleteJob(booking)}
                    disabled={booking.status === 'Paused' || machineUnderMaintenance}
                    className={`w-full mt-4 ${booking.status === 'Paused' || machineUnderMaintenance
                        ? 'bg-gray-400 cursor-not-allowed hover:bg-gray-400'
                        : ''
                      }`}
                    data-testid={`complete-job-${booking.booking_id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {booking.status === 'Paused' ? 'Job Paused (Maintenance)' : 'Complete Job'}
                  </Button>

                  {/* Breakdown button — disabled if machine already under maintenance */}
                  {machineUnderMaintenance ? (
                    <div className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 rounded-md">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-700">Maintenance In Progress</span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleReportBreakdown(booking)}
                      variant="destructive"
                      className="w-full mt-2"
                      data-testid={`report-breakdown-${booking.booking_id}`}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Report Breakdown
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="complete-job-dialog">
          <DialogHeader>
            <DialogTitle>Complete Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedBooking?.expected_hours !== null && (
              <div>
                <Label htmlFor="actual_hours">Actual Hours Worked *</Label>
                <Input
                  id="actual_hours"
                  data-testid="actual-hours-input"
                  type="number"
                  step="0.1"
                  value={formData.actual_hours}
                  onChange={(e) => setFormData({ ...formData, actual_hours: e.target.value })}
                  required
                />
              </div>
            )}
            {selectedBooking?.expected_acres !== null && (
              <div>
                <Label htmlFor="actual_acres">Actual Acres Covered *</Label>
                <Input
                  id="actual_acres"
                  data-testid="actual-acres-input"
                  type="number"
                  step="0.1"
                  value={formData.actual_acres}
                  onChange={(e) => setFormData({ ...formData, actual_acres: e.target.value })}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                data-testid="job-notes-input"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes about the work completed"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="submit-field-log">Submit</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
