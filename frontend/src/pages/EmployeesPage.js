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
      await api.delete(`/org/employees/${employeeId}`);
      toast.success('Employee deleted successfully');
      setEmployees(prev => prev.filter(e => e.employee_id !== employeeId && e._id !== employeeId && e.id !== employeeId));
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
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                    {employee.role === 'org_admin' ? (
                      <span className="font-bold text-blue-700">₹{employee.monthly_salary || employee.wage_rate || 0} / mo</span>
                    ) : employee.role === 'operator' ? (
                      <span className="font-semibold text-green-700">₹{employee.hourly_wage || employee.wage_rate || 0} / hr</span>
                    ) : (
                      <span>₹{employee.wage_rate || 0}</span>
                    )}
                  </td>
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
                    {user?.role === 'owner' && (
                      <button
                        onClick={() => handleDelete(employee.employee_id)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Delete
                      </button>
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
