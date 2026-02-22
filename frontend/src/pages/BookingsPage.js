import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, CheckCircle, XCircle, FileText, UserCheck, RefreshCw } from 'lucide-react';

export default function BookingsPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'owner';
  const [bookings, setBookings] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [machinery, setMachinery] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    farmer_id: '',
    machinery_id: '',
    operator_id: '',
    booking_date: '',
    field_location: '',
    expected_hours: '',
    expected_acres: '',
    pricing_type: 'hours'
  });

  // Approve Modal
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');

  // Reassign Modal
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignBookingId, setReassignBookingId] = useState(null);
  const [reassignData, setReassignData] = useState({ machinery_id: '', operator_id: '' });
  const [allMachinery, setAllMachinery] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, farmersRes, machineryRes, employeesRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/org/farmers/all'),
        api.get('/machinery'),
        api.get('/employees')
      ]);
      setBookings(bookingsRes.data);
      const farmersData = farmersRes.data;
      const machineryData = machineryRes.data.filter(m => m.status?.toLowerCase() === 'available');
      const operatorsData = employeesRes.data.filter(e => e.role?.toLowerCase() === 'operator');
      setFarmers(farmersData);
      setMachinery(machineryData);
      setAllMachinery(machineryData);
      setOperators(operatorsData);
      console.log('DROPDOWN DATA:', { farmers: farmersData, machinery: machineryData, operators: operatorsData });
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        farmer_id: formData.farmer_id,
        machinery_id: formData.machinery_id,
        operator_id: formData.operator_id || null,
        booking_date: new Date(formData.booking_date).toISOString(),
        field_location: formData.field_location,
        expected_hours: formData.pricing_type === 'hours' ? parseFloat(formData.expected_hours) : null,
        expected_acres: formData.pricing_type === 'acres' ? parseFloat(formData.expected_acres) : null
      };
      await api.post('/bookings', submitData);
      toast.success('Booking created successfully');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  };

  const openApproveDialog = (bookingId) => {
    setSelectedBookingId(bookingId);
    setSelectedOperatorId('');
    setApproveDialogOpen(true);
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOperatorId) {
      toast.error('Please assign an operator');
      return;
    }
    try {
      await api.put(`/bookings/${selectedBookingId}`, {
        approval_status: 'Approved',
        operator_id: selectedOperatorId
      });
      toast.success('Booking approved and operator assigned');
      setApproveDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve booking');
    }
  };

  const handleReject = async (bookingId) => {
    if (!window.confirm('Are you sure you want to reject this booking?')) return;
    try {
      await api.put(`/bookings/${bookingId}`, { approval_status: 'Rejected', status: 'Rejected' });
      toast.success('Booking rejected');
      fetchData();
    } catch (error) {
      toast.error('Failed to reject booking');
    }
  };

  const openReassignDialog = (bookingId) => {
    setReassignBookingId(bookingId);
    setReassignData({ machinery_id: '', operator_id: '' });
    setReassignDialogOpen(true);
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignData.machinery_id || !reassignData.operator_id) {
      toast.error('Select both machinery and operator');
      return;
    }
    try {
      await api.put(`/bookings/${reassignBookingId}/reassign`, reassignData);
      toast.success('Booking reassigned successfully');
      setReassignDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reassign booking');
    }
  };

  const resetForm = () => {
    setFormData({
      farmer_id: '',
      machinery_id: '',
      operator_id: '',
      booking_date: '',
      field_location: '',
      expected_hours: '',
      expected_acres: '',
      pricing_type: 'hours'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'Confirmed': return 'bg-blue-100 text-blue-700';
      case 'Paused': return 'bg-orange-100 text-orange-700';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
            <FileText className="h-10 w-10 mr-3 text-primary" />
            Bookings
          </h1>
          <p className="mt-1 text-muted-foreground">Manage machinery bookings and scheduling</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          {!isReadOnly && (
            <DialogTrigger asChild>
              <Button data-testid="add-booking-button">
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-md" data-testid="booking-dialog">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="farmer_id">Farmer *</Label>
                <Select value={formData.farmer_id} onValueChange={(value) => setFormData({ ...formData, farmer_id: value })} required>
                  <SelectTrigger data-testid="farmer-select">
                    <SelectValue placeholder="Select farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    {farmers.map((farmer) => (
                      <SelectItem key={farmer.username || farmer.farmer_id} value={farmer.username || farmer.farmer_id}>
                        {farmer.full_name || farmer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="machinery_id">Machinery *</Label>
                <Select value={formData.machinery_id} onValueChange={(value) => setFormData({ ...formData, machinery_id: value })} required>
                  <SelectTrigger data-testid="machinery-select">
                    <SelectValue placeholder="Select machinery" />
                  </SelectTrigger>
                  <SelectContent>
                    {machinery.map((machine) => (
                      <SelectItem key={machine.machinery_id} value={machine.machinery_id}>{machine.machine_type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Optional Operator selection during creation */}
              <div>
                <Label htmlFor="operator_id">Operator (Optional)</Label>
                <Select value={formData.operator_id} onValueChange={(value) => setFormData({ ...formData, operator_id: value })}>
                  <SelectTrigger data-testid="operator-select">
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((operator) => (
                      <SelectItem key={operator.employee_id} value={operator.employee_id}>{operator.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="booking_date">Booking Date *</Label>
                <Input
                  id="booking_date"
                  data-testid="booking-date-input"
                  type="date"
                  value={formData.booking_date}
                  onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="field_location">Field Location *</Label>
                <Input
                  id="field_location"
                  data-testid="location-input"
                  value={formData.field_location}
                  onChange={(e) => setFormData({ ...formData, field_location: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Pricing Type *</Label>
                <Select value={formData.pricing_type} onValueChange={(value) => setFormData({ ...formData, pricing_type: value })}>
                  <SelectTrigger data-testid="pricing-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Per Hour</SelectItem>
                    <SelectItem value="acres">Per Acre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.pricing_type === 'hours' ? (
                <div>
                  <Label htmlFor="expected_hours">Expected Hours *</Label>
                  <Input
                    id="expected_hours"
                    data-testid="expected-hours-input"
                    type="number"
                    step="0.1"
                    value={formData.expected_hours}
                    onChange={(e) => setFormData({ ...formData, expected_hours: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="expected_acres">Expected Acres *</Label>
                  <Input
                    id="expected_acres"
                    data-testid="expected-acres-input"
                    type="number"
                    step="0.1"
                    value={formData.expected_acres}
                    onChange={(e) => setFormData({ ...formData, expected_acres: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="booking-submit-button">Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Approve Dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent data-testid="approve-dialog">
            <DialogHeader>
              <DialogTitle>Approve Booking & Assign Operator</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <Label htmlFor="approve_operator">Assign Operator *</Label>
                <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.employee_id} value={op.employee_id}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">Approve Booking</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Farmer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Machine</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Operator</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((booking) => (
                <tr key={booking.booking_id} className="table-row" data-testid={`booking-row-${booking.booking_id}`}>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{booking.booking_id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{booking.farmer_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{booking.machine_type || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{booking.operator_name || 'Not Assigned'}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{new Date(booking.booking_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{booking.field_location}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                    {booking.notes && <div className="text-xs text-red-500 mt-1">{booking.notes}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {!isReadOnly && booking.approval_status === 'Pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openApproveDialog(booking.booking_id)}
                          data-testid={`approve-booking-${booking.booking_id}`}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(booking.booking_id)}
                          data-testid={`reject-booking-${booking.booking_id}`}
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    {!isReadOnly && booking.status === 'Paused' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReassignDialog(booking.booking_id)}
                        data-testid={`reassign-booking-${booking.booking_id}`}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" /> Reassign
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent data-testid="reassign-dialog">
          <DialogHeader>
            <DialogTitle>Reassign Paused Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReassignSubmit} className="space-y-4">
            <div>
              <Label>New Machinery *</Label>
              <Select value={reassignData.machinery_id} onValueChange={(v) => setReassignData({ ...reassignData, machinery_id: v })} required>
                <SelectTrigger><SelectValue placeholder="Select available machinery" /></SelectTrigger>
                <SelectContent>
                  {allMachinery.map(m => (
                    <SelectItem key={m.machinery_id} value={m.machinery_id}>{m.machine_type} ({m.machinery_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Operator *</Label>
              <Select value={reassignData.operator_id} onValueChange={(v) => setReassignData({ ...reassignData, operator_id: v })} required>
                <SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger>
                <SelectContent>
                  {operators.map(op => (
                    <SelectItem key={op.employee_id} value={op.employee_id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Reassign Booking</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
