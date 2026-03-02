import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, UserCog, AlertCircle } from 'lucide-react';

export default function OperatorsPage() {
    const { user } = useAuth();
    const isOrgAdmin = user?.role === 'org_admin';
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingOperator, setEditingOperator] = useState(null);

    const emptyForm = {
        username: '', full_name: '', email: '', phone: '',
        skill: 'Intermediate', joining_date: new Date().toISOString().split('T')[0], wage_rate: ''
    };
    const [addForm, setAddForm] = useState(emptyForm);
    const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', status: 'Active' });

    useEffect(() => {
        fetchOperators();
    }, []);

    const fetchOperators = async () => {
        try {
            const res = await api.get('/org/operators');
            setOperators(res.data);
        } catch (error) {
            toast.error('Failed to load operators');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/org/operators', {
                username: addForm.username,
                full_name: addForm.full_name,
                email: addForm.email,
                phone: addForm.phone
            });
            await api.post('/employees', {
                name: addForm.full_name,
                role: "operator",
                skill: addForm.skill,
                joining_date: addForm.joining_date,
                wage_rate: Number(addForm.wage_rate)
            });
            const data = res.data;
            if (data.temp_password) {
                toast.success(`Operator '${addForm.username}' created! Email failed \u2014 Please share credentials manually:\nUsername: ${addForm.username}\nPassword: ${data.temp_password}`, { duration: 20000 });
            } else {
                toast.success(`Operator '${addForm.username}' created! Login credentials emailed to ${addForm.email}`);
            }
            setAddDialogOpen(false);
            setAddForm(emptyForm);
            fetchOperators();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to create operator');
        }
    };

    const openEdit = (op) => {
        setEditingOperator(op);
        setEditForm({ full_name: op.full_name, email: op.email, phone: op.phone || '', status: op.status });
        setEditDialogOpen(true);
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/org/operators/${editingOperator.username}`, editForm);
            toast.success(`Operator '${editingOperator.username}' updated`);
            setEditDialogOpen(false);
            fetchOperators();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update operator');
        }
    };

    const handleDelete = async (username) => {
        if (!window.confirm(`Delete operator "${username}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/org/operators/${username}`);
            toast.success(`Operator '${username}' deleted`);
            fetchOperators();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete operator');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return 'bg-green-100 text-green-700';
            case 'Suspended': return 'bg-red-100 text-red-700';
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
                        <UserCog className="h-10 w-10 mr-3 text-primary" />
                        Operators
                    </h1>
                    <p className="mt-1 text-muted-foreground">Manage field operators for your organization</p>
                </div>
                {isOrgAdmin && (
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="add-operator-button">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Operator
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md" data-testid="add-operator-dialog">
                            <DialogHeader>
                                <DialogTitle>Add New Operator</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAdd} className="space-y-4">
                                <div>
                                    <Label htmlFor="op-username">Username *</Label>
                                    <Input
                                        id="op-username"
                                        data-testid="op-username-input"
                                        value={addForm.username}
                                        onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                                        required
                                        placeholder="e.g. op_ravi"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="op-fullname">Full Name *</Label>
                                    <Input
                                        id="op-fullname"
                                        data-testid="op-fullname-input"
                                        value={addForm.full_name}
                                        onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                                        required
                                        placeholder="e.g. Ravi Kumar"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="op-email">Email *</Label>
                                    <Input
                                        id="op-email"
                                        type="email"
                                        data-testid="op-email-input"
                                        value={addForm.email}
                                        onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="op-phone">Phone</Label>
                                    <Input
                                        id="op-phone"
                                        value={addForm.phone}
                                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="skill">Skill Level *</Label>
                                    <Select value={addForm.skill} onValueChange={(value) => setAddForm({ ...addForm, skill: value })} required>
                                        <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
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
                                        type="date"
                                        value={addForm.joining_date}
                                        onChange={(e) => setAddForm({ ...addForm, joining_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="wage_rate">Hourly Wage (₹/hr) *</Label>
                                    <Input
                                        id="wage_rate"
                                        type="number"
                                        step="0.01"
                                        value={addForm.wage_rate}
                                        onChange={(e) => setAddForm({ ...addForm, wage_rate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => { setAddDialogOpen(false); setAddForm(emptyForm); }}>Cancel</Button>
                                    <Button type="submit" data-testid="op-submit-button">Create Operator</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {operators.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No operators found for your organization.</p>
                    {isOrgAdmin && <p className="text-sm text-muted-foreground mt-1">Click "Add Operator" to create the first one.</p>}
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full">
                            <thead className="bg-muted/30 border-b border-border">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Username</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                                    {isOrgAdmin && <th className="px-6 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {operators.map((op) => (
                                    <tr key={op.username} className="table-row" data-testid={`operator-row-${op.username}`}>
                                        <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{op.username}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-foreground">{op.full_name}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{op.email}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{op.phone || '—'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(op.status)}`}>
                                                {op.status}
                                            </span>
                                        </td>
                                        {isOrgAdmin && (
                                            <td className="px-6 py-4 text-sm text-right space-x-1">
                                                <Button variant="ghost" size="sm" onClick={() => openEdit(op)} data-testid={`edit-op-${op.username}`}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(op.username)} data-testid={`delete-op-${op.username}`}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-md" data-testid="edit-operator-dialog">
                    <DialogHeader>
                        <DialogTitle>Edit Operator: {editingOperator?.username}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div>
                            <Label htmlFor="edit-fullname">Full Name</Label>
                            <Input id="edit-fullname" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                        </div>
                        <div>
                            <Label htmlFor="edit-email">Email</Label>
                            <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                        </div>
                        <div>
                            <Label htmlFor="edit-phone">Phone</Label>
                            <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" data-testid="edit-op-submit">Save Changes</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
