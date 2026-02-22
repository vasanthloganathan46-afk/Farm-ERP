import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, UserCircle } from 'lucide-react';

export default function EmployeesPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'owner';
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: '',
    skill: '',
    joining_date: '',
    wage_rate: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.employee_id}`, formData);
        toast.success('Employee updated successfully');
      } else {
        await api.post('/employees', formData);
        toast.success('Employee created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to save employee');
    }
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await api.delete(`/employees/${employeeId}`);
      toast.success('Employee deleted successfully');
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      role: employee.role,
      department: employee.department,
      skill: employee.skill,
      joining_date: employee.joining_date.split('T')[0],
      wage_rate: employee.wage_rate.toString()
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: '',
      department: '',
      skill: '',
      joining_date: '',
      wage_rate: ''
    });
    setEditingEmployee(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
            <UserCircle className="h-10 w-10 mr-3 text-primary" />
            Employees
          </h1>
          <p className="mt-1 text-muted-foreground">Manage employee master data</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          {!isReadOnly && (
            <DialogTrigger asChild>
              <Button data-testid="add-employee-button">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-md" data-testid="employee-dialog">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  data-testid="employee-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })} required>
                  <SelectTrigger data-testid="employee-role-select">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="department">Department *</Label>
                <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })} required>
                  <SelectTrigger data-testid="employee-dept-select">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Field Operations">Field Operations</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Administration">Administration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="skill">Skill Level *</Label>
                <Select value={formData.skill} onValueChange={(value) => setFormData({ ...formData, skill: value })} required>
                  <SelectTrigger data-testid="employee-skill-select">
                    <SelectValue placeholder="Select skill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joining_date">Joining Date *</Label>
                <Input
                  id="joining_date"
                  data-testid="employee-date-input"
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="wage_rate">Wage Rate (₹/job) *</Label>
                <Input
                  id="wage_rate"
                  data-testid="employee-wage-input"
                  type="number"
                  step="0.01"
                  value={formData.wage_rate}
                  onChange={(e) => setFormData({ ...formData, wage_rate: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="employee-submit-button">{editingEmployee ? 'Update' : 'Create'}</Button>
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Skill</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Wage Rate</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((employee) => (
                <tr key={employee.employee_id} className="table-row" data-testid={`employee-row-${employee.employee_id}`}>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{employee.employee_id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{employee.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{employee.role}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{employee.department}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{employee.skill}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">₹{employee.wage_rate}</td>
                  <td className="px-6 py-4 text-sm text-right">

                    {!isReadOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(employee)}
                          data-testid={`edit-employee-${employee.employee_id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(employee.employee_id)}
                          data-testid={`delete-employee-${employee.employee_id}`}
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
    </div>
  );
}
