import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Tractor, Fuel } from 'lucide-react';

export default function MachineryPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'owner';
  const canLogDiesel = ['org_admin', 'operator'].includes(user?.role);
  const [machinery, setMachinery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [fuelDialogOpen, setFuelDialogOpen] = useState(false);
  const [selectedMachineForFuel, setSelectedMachineForFuel] = useState(null);
  const [fuelData, setFuelData] = useState({ liters: '', cost_per_liter: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [formData, setFormData] = useState({
    machine_type: '',
    rate_per_hour: '',
    rate_per_acre: ''
  });

  useEffect(() => {
    fetchMachinery();
  }, []);

  const fetchMachinery = async () => {
    try {
      const response = await api.get('/machinery');
      setMachinery(response.data);
    } catch (error) {
      toast.error('Failed to load machinery');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMachine) {
        await api.put(`/machinery/${editingMachine.machinery_id}`, formData);
        toast.success('Machinery updated successfully');
      } else {
        await api.post('/machinery', formData);
        toast.success('Machinery created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchMachinery();
    } catch (error) {
      toast.error('Failed to save machinery');
    }
  };

  const handleDelete = async (machineryId) => {
    if (!window.confirm('Are you sure you want to delete this machinery?')) return;
    try {
      await api.delete(`/machinery/${machineryId}`);
      toast.success('Machinery deleted successfully');
      fetchMachinery();
    } catch (error) {
      toast.error('Failed to delete machinery');
    }
  };

  const handleEdit = (machine) => {
    setEditingMachine(machine);
    setFormData({
      machine_type: machine.machine_type,
      rate_per_hour: machine.rate_per_hour.toString(),
      rate_per_acre: machine.rate_per_acre.toString()
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ machine_type: '', rate_per_hour: '', rate_per_acre: '' });
    setEditingMachine(null);
  };

  const openFuelDialog = (machine) => {
    setSelectedMachineForFuel(machine);
    setFuelData({ liters: '', cost_per_liter: '', date: new Date().toISOString().split('T')[0], notes: '' });
    setFuelDialogOpen(true);
  };

  const handleLogFuel = async (e) => {
    e.preventDefault();
    if (!selectedMachineForFuel) return;
    try {
      const payload = {
        liters: parseFloat(fuelData.liters),
        cost_per_liter: parseFloat(fuelData.cost_per_liter),
        date: fuelData.date,
        notes: fuelData.notes
      };
      const res = await api.post(`/org/machines/${selectedMachineForFuel.machinery_id}/fuel`, payload);
      const totalCost = res.data?.fuel_expense?.total_cost || (payload.liters * payload.cost_per_liter).toFixed(2);
      toast.success(`Diesel logged: ${payload.liters}L × ₹${payload.cost_per_liter} = ₹${totalCost}`);
      setFuelDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to log diesel expense');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-700';
      case 'Booked': return 'bg-blue-100 text-blue-700';
      case 'Under Maintenance': return 'bg-orange-100 text-orange-700';
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
            <Tractor className="h-10 w-10 mr-3 text-primary" />
            Machinery
          </h1>
          <p className="mt-1 text-muted-foreground">Manage machinery master data</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          {!isReadOnly && (
            <DialogTrigger asChild>
              <Button data-testid="add-machinery-button">
                <Plus className="h-4 w-4 mr-2" />
                Add Machinery
              </Button>
            </DialogTrigger>
          )}
          <DialogContent data-testid="machinery-dialog">
            <DialogHeader>
              <DialogTitle>{editingMachine ? 'Edit Machinery' : 'Add New Machinery'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="machine_type">Machine Type *</Label>
                <Input
                  id="machine_type"
                  data-testid="machine-type-input"
                  value={formData.machine_type}
                  onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rate_per_hour">Rate per Hour (₹) *</Label>
                <Input
                  id="rate_per_hour"
                  data-testid="rate-hour-input"
                  type="number"
                  step="0.01"
                  value={formData.rate_per_hour}
                  onChange={(e) => setFormData({ ...formData, rate_per_hour: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rate_per_acre">Rate per Acre (₹) *</Label>
                <Input
                  id="rate_per_acre"
                  data-testid="rate-acre-input"
                  type="number"
                  step="0.01"
                  value={formData.rate_per_acre}
                  onChange={(e) => setFormData({ ...formData, rate_per_acre: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="machinery-submit-button">{editingMachine ? 'Update' : 'Create'}</Button>
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Machine Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Rate/Hour</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Rate/Acre</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Usage Hours</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {machinery.map((machine) => (
                <tr key={machine.machinery_id} className="table-row" data-testid={`machinery-row-${machine.machinery_id}`}>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{machine.machinery_id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{machine.machine_type}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">₹{machine.rate_per_hour}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">₹{machine.rate_per_acre}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{machine.total_usage_hours.toFixed(2)} hrs</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(machine.status)}`}>
                      {machine.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-1">
                    {/* Log Diesel button — visible to org_admin and operators */}
                    {canLogDiesel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => openFuelDialog(machine)}
                        data-testid={`log-diesel-${machine.machinery_id}`}
                        title="Log Diesel/Fuel Expense"
                      >
                        <Fuel className="h-4 w-4 mr-1" />
                        Log Diesel
                      </Button>
                    )}
                    {!isReadOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(machine)}
                          data-testid={`edit-machinery-${machine.machinery_id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(machine.machinery_id)}
                          data-testid={`delete-machinery-${machine.machinery_id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Diesel Modal */}
      <Dialog open={fuelDialogOpen} onOpenChange={setFuelDialogOpen}>
        <DialogContent data-testid="fuel-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-amber-500" />
              Log Diesel Expense — {selectedMachineForFuel?.machine_type}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogFuel} className="space-y-4">
            <div>
              <Label htmlFor="liters">Liters *</Label>
              <Input
                id="liters"
                data-testid="fuel-liters-input"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="e.g. 50"
                value={fuelData.liters}
                onChange={(e) => setFuelData({ ...fuelData, liters: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="cost_per_liter">Cost per Liter (₹) *</Label>
              <Input
                id="cost_per_liter"
                data-testid="fuel-cost-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 95.50"
                value={fuelData.cost_per_liter}
                onChange={(e) => setFuelData({ ...fuelData, cost_per_liter: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="fuel_date">Date *</Label>
              <Input
                id="fuel_date"
                data-testid="fuel-date-input"
                type="date"
                value={fuelData.date}
                onChange={(e) => setFuelData({ ...fuelData, date: e.target.value })}
                required
              />
            </div>
            {fuelData.liters && fuelData.cost_per_liter && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  Estimated Total: <strong>₹{(parseFloat(fuelData.liters) * parseFloat(fuelData.cost_per_liter)).toFixed(2)}</strong>
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="fuel_notes">Notes (optional)</Label>
              <Input
                id="fuel_notes"
                placeholder="e.g. Monthly refuel"
                value={fuelData.notes}
                onChange={(e) => setFuelData({ ...fuelData, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFuelDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="fuel-submit-button">
                <Fuel className="h-4 w-4 mr-2" />
                Log Expense
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
