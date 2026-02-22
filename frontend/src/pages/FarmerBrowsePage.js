import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Tractor, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React/Webpck
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function FarmerBrowsePage() {
  const [machinery, setMachinery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [formData, setFormData] = useState({
    booking_date: '',
    field_location: '',
    pricing_type: 'hours',
    expected_hours: '',
    expected_acres: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchMachinery();
  }, []);

  const fetchMachinery = async () => {
    try {
      const response = await api.get('/public/machinery');
      setMachinery(response.data);
    } catch (error) {
      toast.error('Failed to load machinery');
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = (machine) => {
    setSelectedMachine(machine);
    setFormData({
      booking_date: '',
      field_location: '',
      pricing_type: 'hours',
      expected_hours: '',
      expected_acres: ''
    });
    setAvailabilityStatus(null);
    setBookingDialogOpen(true);
  };

  const handleDateChange = async (date) => {
    setFormData({ ...formData, booking_date: date });

    if (date && selectedMachine) {
      setCheckingAvailability(true);
      try {
        const response = await api.post('/public/check-availability', {
          machinery_id: selectedMachine.machinery_id,
          date: new Date(date).toISOString()
        });
        setAvailabilityStatus(response.data);
      } catch (error) {
        toast.error('Failed to check availability');
      } finally {
        setCheckingAvailability(false);
      }
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    if (!availabilityStatus?.available) {
      toast.error('Machinery not available on selected date');
      return;
    }

    try {
      const submitData = {
        machinery_id: selectedMachine.machinery_id,
        booking_date: new Date(formData.booking_date).toISOString(),
        field_location: formData.field_location,
        expected_hours: formData.pricing_type === 'hours' ? parseFloat(formData.expected_hours) : null,
        expected_acres: formData.pricing_type === 'acres' ? parseFloat(formData.expected_acres) : null
      };

      await api.post('/bookings', submitData);
      toast.success('Booking request submitted successfully! Awaiting admin approval.');
      setBookingDialogOpen(false);
      navigate('/farmer/bookings');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading machinery...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <Tractor className="h-10 w-10 mr-3 text-primary" />
          Browse Machinery Fleet
        </h1>
        <p className="mt-1 text-muted-foreground">Select machinery and check real-time availability</p>
      </div>

      {/* Map Components */}
      <div className="h-[400px] w-full rounded-xl overflow-hidden shadow-lg border border-border z-0 relative">
        <MapContainer center={[11.0168, 76.9558]} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {machinery.map((machine) => (
            machine.location && machine.location.coordinates ? (
              <Marker
                key={machine.machinery_id}
                position={[machine.location.coordinates[1], machine.location.coordinates[0]]}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold">{machine.machine_type}</h3>
                    <p className="text-sm">Rate: ₹{machine.rate_per_hour}/hr</p>
                    <p className="text-xs text-muted-foreground">{machine.curr_village}</p>
                    <Button size="sm" className="mt-2 w-full" onClick={() => handleBookClick(machine)}>
                      Book
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ) : null
          ))}
        </MapContainer>
      </div>

      {machinery.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Tractor className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Machinery Available</h3>
          <p className="text-muted-foreground">Check back later for available equipment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machinery.map((machine) => (
            <div key={machine.machinery_id} className="bg-card border-l-4 border-l-primary rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow" data-testid={`machine-card-${machine.machinery_id}`}>
              <div className="bg-muted/30 px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-lg font-heading text-foreground">{machine.machine_type}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-1">{machine.machinery_id}</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {machine.status === 'Available' ? (
                    <span className="flex items-center text-green-600 text-sm font-semibold">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Available
                    </span>
                  ) : (
                    <span className="flex items-center text-yellow-600 text-sm font-semibold">
                      <Clock className="h-4 w-4 mr-1" />
                      {machine.status}
                    </span>
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Per Hour
                    </span>
                    <span className="text-lg font-bold font-mono text-foreground">₹{machine.rate_per_hour}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Per Acre
                    </span>
                    <span className="text-lg font-bold font-mono text-foreground">₹{machine.rate_per_acre}</span>
                  </div>
                </div>

                {machine.description && (
                  <p className="text-sm text-muted-foreground border-t border-border pt-4">{machine.description}</p>
                )}

                <Button
                  onClick={() => handleBookClick(machine)}
                  className="w-full mt-4"
                  data-testid={`book-machine-${machine.machinery_id}`}
                >
                  <Tractor className="h-4 w-4 mr-2" />
                  Book Now
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Dialog with Automated Availability Check */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="max-w-md" data-testid="booking-dialog">
          <DialogHeader>
            <DialogTitle>Book {selectedMachine?.machine_type}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBookingSubmit} className="space-y-4">
            <div>
              <Label htmlFor="booking_date">Booking Date *</Label>
              <Input
                id="booking_date"
                data-testid="booking-date-input"
                type="date"
                value={formData.booking_date}
                onChange={(e) => handleDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
              {checkingAvailability && (
                <p className="text-xs text-muted-foreground mt-1">Checking availability...</p>
              )}
              {availabilityStatus && (
                <div className={`text-xs mt-1 flex items-center ${availabilityStatus.available ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {availabilityStatus.available ? (
                    <><CheckCircle className="h-4 w-4 mr-1" /> Available on this date</>
                  ) : (
                    <><XCircle className="h-4 w-4 mr-1" /> {availabilityStatus.reason}</>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="field_location">Field Location *</Label>
              <Input
                id="field_location"
                data-testid="location-input"
                value={formData.field_location}
                onChange={(e) => setFormData({ ...formData, field_location: e.target.value })}
                placeholder="Village, Field No."
                required
              />
            </div>

            <div>
              <Label>Pricing Type *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  type="button"
                  variant={formData.pricing_type === 'hours' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, pricing_type: 'hours', expected_acres: '' })}
                  data-testid="pricing-hours-button"
                >
                  Per Hour
                </Button>
                <Button
                  type="button"
                  variant={formData.pricing_type === 'acres' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, pricing_type: 'acres', expected_hours: '' })}
                  data-testid="pricing-acres-button"
                >
                  Per Acre
                </Button>
              </div>
            </div>

            {formData.pricing_type === 'hours' ? (
              <div>
                <Label htmlFor="expected_hours">Expected Hours *</Label>
                <Input
                  id="expected_hours"
                  data-testid="expected-hours-input"
                  type="number"
                  step="0.5"
                  value={formData.expected_hours}
                  onChange={(e) => setFormData({ ...formData, expected_hours: e.target.value })}
                  placeholder="e.g., 4"
                  required
                />
                {formData.expected_hours && selectedMachine && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated cost: ₹{(parseFloat(formData.expected_hours) * selectedMachine.rate_per_hour).toLocaleString()}
                  </p>
                )}
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
                  placeholder="e.g., 5.5"
                  required
                />
                {formData.expected_acres && selectedMachine && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated cost: ₹{(parseFloat(formData.expected_acres) * selectedMachine.rate_per_acre).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBookingDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                data-testid="confirm-booking-button"
                disabled={!availabilityStatus?.available || checkingAvailability}
              >
                Confirm Booking
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
