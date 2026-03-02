import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Shield, CheckCircle, XCircle, Edit, Trash2, Building2, Tractor, Wrench, MessageSquare, Ban, Send } from 'lucide-react';

const TABS = [
    { key: 'orgs', label: 'Org Admins', icon: Building2, desc: 'Org Admins & Owners' },
    { key: 'org_management', label: 'Organizations', icon: Building2, desc: 'Tenant Companies' },
    { key: 'farmers', label: 'Farmers', icon: Tractor, desc: 'Customer accounts' },
    { key: 'mechanics', label: 'Mechanics', icon: Wrench, desc: 'Freelance contractors' },
    { key: 'support', label: 'Support Inbox', icon: MessageSquare, desc: 'User appeals & tickets' },
];

export default function SuperAdminDashboard() {
    const [activeTab, setActiveTab] = useState('orgs');
    const [tabUsers, setTabUsers] = useState({});
    const [pendingUsers, setPendingUsers] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ full_name: '', role: '', email: '', organization_id: '', status: '' });
    const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
    const [suspendingUser, setSuspendingUser] = useState(null);
    const [suspendReason, setSuspendReason] = useState('');
    const [orgsList, setOrgsList] = useState([]);
    const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
    const [createOrgForm, setCreateOrgForm] = useState({ company_name: '', contact_email: '', phone: '', owner_name: '', owner_email: '' });
    const chatBottomRef = useRef(null);

    useEffect(() => { fetchAll(); }, []);
    useEffect(() => { if (activeTab === 'support') fetchTickets(); }, [activeTab]);
    useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selectedTicket]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [orgAdminRes, ownerRes, farmerRes, mechRes, pendingRes, orgsRes] = await Promise.all([
                api.get('/admin/users?role=org_admin'),
                api.get('/admin/users?role=owner'),
                api.get('/admin/users?role=farmer'),
                api.get('/admin/users?role=mechanic'),
                api.get('/admin/users/pending'),
                api.get('/admin/organizations')
            ]);
            setTabUsers({
                orgs: [...orgAdminRes.data, ...ownerRes.data],
                farmers: farmerRes.data,
                mechanics: mechRes.data,
            });
            setPendingUsers(pendingRes.data);
            setOrgsList(orgsRes.data);
        } catch { toast.error('Failed to load users or organizations'); }
        finally { setLoading(false); }
    };

    const fetchTickets = async () => {
        try {
            const res = await api.get('/admin/support/tickets');
            console.log('[Support Inbox] tickets loaded:', res.data); // DEBUG: verify user_info fields
            setTickets(res.data);
            if (selectedTicket) {
                const updated = res.data.find(t => t.username === selectedTicket.username);
                if (updated) setSelectedTicket(updated);
            }
        } catch (err) {
            console.error('[Support Inbox] Failed to fetch tickets:', err?.response?.data || err.message);
        }
    };

    const handleApprove = async (username) => {
        try {
            await api.post(`/admin/users/${username}/approve`);
            toast.success("User Approved! An email has been sent with their credentials.");
            fetchAll();
        }
        catch { toast.error('Failed to approve'); }
    };

    const openEditDialog = (user) => {
        setEditingUser(user);
        setEditForm({ full_name: user.full_name, role: user.role, email: user.email, organization_id: user.organization_id, status: user.status });
        setEditDialogOpen(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try { await api.put(`/admin/users/${editingUser.username}`, editForm); toast.success('Updated'); setEditDialogOpen(false); fetchAll(); }
        catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    };

    const handleDelete = async (username) => {
        if (!window.confirm(`Delete "${username}"? Cannot be undone.`)) return;
        try { await api.delete(`/admin/users/${username}`); toast.success('Deleted'); fetchAll(); }
        catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    };

    const openSuspendDialog = (user) => {
        setSuspendingUser(user);
        setSuspendReason('');
        setSuspendDialogOpen(true);
    };

    const handleSuspendSubmit = async (e) => {
        e.preventDefault();
        if (!suspendReason.trim()) { toast.error('Suspension reason is required'); return; }
        try {
            await api.put(`/admin/users/${suspendingUser.username}/suspend`, { suspension_reason: suspendReason.trim() });
            toast.success(`${suspendingUser.username} suspended`);
            setSuspendDialogOpen(false);
            fetchAll();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to suspend'); }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedTicket) return;
        try {
            if (selectedTicket.username.startsWith('guest_')) {
                await api.post(`/admin/inquiries/${selectedTicket.username}/reply`, { message: replyText.trim() });
                toast.success('Reply emailed to guest successfully');
            } else {
                await api.put(`/admin/support/tickets/${selectedTicket.username}/reply`, { message_text: replyText.trim() });
            }
            setReplyText('');
            await fetchTickets();
        } catch { toast.error('Failed to send reply'); }
    };

    const handleCreateOrgSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/admin/organizations', createOrgForm);
            const data = res.data;
            if (data.temp_password) {
                toast.success(`Organization created! Email failed — Owner credentials: Username: ${data.owner_username}, Password: ${data.temp_password}`, { duration: 15000 });
            } else {
                toast.success(`Organization created! Credentials emailed to ${data.owner_email}`);
            }
            setCreateOrgDialogOpen(false);
            setCreateOrgForm({ company_name: '', contact_email: '', phone: '', owner_name: '', owner_email: '' });
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.detail || err.message || 'Failed to create organization');
        }
    };

    const handleDeleteOrg = async (orgId, orgName) => {
        if (!window.confirm(`⚠️ PERMANENT DELETE\n\nAre you sure you want to delete "${orgName}" (${orgId})?\n\nThis will permanently delete ALL users, machines, bookings, maintenance records, and data for this organization.\n\nThis action CANNOT be undone.`)) return;
        try {
            const res = await api.delete(`/admin/organizations/${orgId}`);
            toast.success(`${res.data.message} (${res.data.total_deleted} documents removed)`);
            setOrgsList(prev => prev.filter(o => o.organization_id !== orgId));
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to delete organization');
        }
    };

    const getStatusColor = (s) => s === 'Active' ? 'bg-green-100 text-green-700' : s === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
    const getRoleBadge = (r) => ({ super_admin: 'bg-purple-100 text-purple-700', org_admin: 'bg-blue-100 text-blue-700', owner: 'bg-indigo-100 text-indigo-700', farmer: 'bg-green-100 text-green-700', mechanic: 'bg-teal-100 text-teal-700' }[r] || 'bg-gray-100 text-gray-700');
    const formatTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return ''; } };

    if (loading) return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading…</div></div>;

    const currentUsers = tabUsers[activeTab] || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
                    <Shield className="h-10 w-10 mr-3 text-primary" />Super Admin Dashboard
                </h1>
                <p className="mt-1 text-muted-foreground">Manage all platform users, roles, approvals, and support tickets</p>
            </div>

            {/* Pending Approvals */}
            {pendingUsers.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                        <XCircle className="h-5 w-5 mr-2" />Pending Approvals ({pendingUsers.length})
                    </h2>
                    <div className="space-y-3">
                        {pendingUsers.map((user) => (
                            <div key={user.username} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                                <div>
                                    <p className="font-medium">{user.full_name}</p>
                                    <p className="text-sm text-muted-foreground">{user.username} · {user.email} · {user.role}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(user.username)}>
                                        <CheckCircle className="h-4 w-4 mr-1" />Approve
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => openEditDialog(user)}><Edit className="h-4 w-4 mr-1" />Edit</Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(user.username)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabbed Sections */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                {/* Tab Header */}
                <div className="flex border-b border-border">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const count = tab.key === 'support' ? tickets.length : (tabUsers[tab.key] || []).length;
                        return (
                            <button key={tab.key} data-testid={`tab-${tab.key}`} onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                                    ? 'border-primary text-primary bg-primary/5'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                                    }`}>
                                <Icon className="h-4 w-4" />
                                <span>{tab.label}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Support Inbox Tab */}
                {activeTab === 'support' && (
                    <div className="flex h-[500px]">
                        {/* Ticket list */}
                        <div className="w-72 border-r border-border overflow-y-auto bg-muted/10">
                            {tickets.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                    <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                    <p className="text-sm font-medium text-muted-foreground">No pending appeals</p>
                                    <p className="text-xs text-muted-foreground mt-1">When suspended users send appeal messages, they'll appear here.</p>
                                </div>
                            )}
                            {tickets.map((ticket) => (
                                <button key={ticket.username} onClick={() => setSelectedTicket(ticket)}
                                    className={`w-full text-left p-4 border-b border-border hover:bg-muted/30 transition-colors ${selectedTicket?.username === ticket.username ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-foreground truncate">
                                                {ticket.user_info?.full_name || ticket.name || ticket.username}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">@{ticket.username}</p>
                                            {(ticket.user_info?.email || ticket.email) && (
                                                <p className="text-xs text-muted-foreground truncate">{ticket.user_info?.email || ticket.email}</p>
                                            )}
                                        </div>
                                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${ticket.status === 'open' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    {ticket.user_info?.suspension_reason && (
                                        <p className="text-xs text-red-600 mt-1 line-clamp-2">
                                            🚫 {ticket.user_info.suspension_reason}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {ticket.messages?.length || 0} message{ticket.messages?.length !== 1 ? 's' : ''}
                                    </p>
                                </button>
                            ))}
                        </div>

                        {/* Thread */}
                        <div className="flex-1 flex flex-col">
                            {!selectedTicket ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                                    <MessageSquare className="h-8 w-8 opacity-30" />
                                    <span>Select a ticket to view the appeal thread</span>
                                </div>
                            ) : (
                                <>
                                    {/* Thread header with full user context */}
                                    <div className="px-4 py-3 border-b border-border bg-muted/10 space-y-1">
                                        <p className="font-semibold text-sm text-foreground">
                                            {selectedTicket.user_info?.full_name || selectedTicket.name || selectedTicket.username}
                                            <span className="font-normal text-muted-foreground ml-1">(@{selectedTicket.username})</span>
                                        </p>
                                        {(selectedTicket.user_info?.email || selectedTicket.email) && (
                                            <p className="text-xs text-muted-foreground">{selectedTicket.user_info?.email || selectedTicket.email}</p>
                                        )}
                                        {selectedTicket.user_info?.suspension_reason && (
                                            <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1">
                                                <span className="font-semibold">Suspension reason: </span>
                                                {selectedTicket.user_info.suspension_reason}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                                        {(selectedTicket.messages || []).length === 0 && (
                                            <p className="text-center text-xs text-muted-foreground py-8">No messages yet in this thread.</p>
                                        )}
                                        {(selectedTicket.messages || []).map((msg, i) => (
                                            <div key={i} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.sender === 'admin' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                                                    <p className={`text-xs font-semibold mb-1 ${msg.sender === 'admin' ? 'text-primary-foreground/70' : 'text-gray-500'}`}>
                                                        {msg.sender === 'admin' ? '🛡 Admin' : `👤 ${selectedTicket.user_info?.full_name || selectedTicket.username}`}
                                                    </p>
                                                    <p>{msg.text}</p>
                                                    <p className={`text-xs mt-1 ${msg.sender === 'admin' ? 'text-primary-foreground/70' : 'text-gray-400'}`}>{formatTime(msg.timestamp)}</p>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatBottomRef} />
                                    </div>
                                    <form onSubmit={handleReply} className="flex gap-2 p-3 border-t border-border bg-white">
                                        <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type a reply to the user…" className="flex-1 text-sm" />
                                        <Button type="submit" size="sm" disabled={!replyText.trim()}><Send className="h-4 w-4" /></Button>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Users / Organizations Table (for non-support tabs) */}
                {activeTab !== 'support' && (
                    <>
                        <div className="px-6 py-3 bg-muted/20 border-b border-border flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                                {TABS.find(t => t.key === activeTab)?.desc}
                            </p>
                            {activeTab === 'org_management' && (
                                <Button size="sm" onClick={() => setCreateOrgDialogOpen(true)}>
                                    <Building2 className="w-4 h-4 mr-2" /> Create Organization
                                </Button>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            {activeTab === 'org_management' ? (
                                <table className="w-full">
                                    <thead className="bg-muted/30 border-b border-border">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Org ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Contact Email</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Phone</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Created At</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {orgsList.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No organizations found.</td></tr>
                                        ) : orgsList.map((org) => (
                                            <tr key={org.organization_id}>
                                                <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{org.organization_id}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-foreground">{org.name}</td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">{org.contact_email}</td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">{org.phone || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">{formatTime(org.created_at)}</td>
                                                <td className="px-6 py-4 text-sm text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteOrg(org.organization_id, org.name)} title="Delete Organization" className="text-destructive hover:text-destructive hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-muted/30 border-b border-border">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Username</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Full Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Email</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Role</th>
                                            {activeTab === 'orgs' && <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Org ID</th>}
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {currentUsers.length === 0 ? (
                                            <tr><td colSpan={activeTab === 'orgs' ? 7 : 6} className="px-6 py-10 text-center text-muted-foreground">No users found.</td></tr>
                                        ) : currentUsers.map((user) => (
                                            <tr key={user.username} data-testid={`user-row-${user.username}`}>
                                                <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{user.username}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-foreground">{user.full_name}</td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                                                <td className="px-6 py-4 text-sm"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadge(user.role)}`}>{user.role}</span></td>
                                                {activeTab === 'orgs' && <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{user.organization_id}</td>}
                                                <td className="px-6 py-4 text-sm"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(user.status)}`}>{user.status}</span></td>
                                                <td className="px-6 py-4 text-sm text-right flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} data-testid={`edit-user-${user.username}`} title="Edit"><Edit className="h-4 w-4" /></Button>
                                                    {user.status !== 'Suspended' && (
                                                        <Button variant="ghost" size="sm" onClick={() => openSuspendDialog(user)} data-testid={`suspend-user-${user.username}`} title="Suspend"><Ban className="h-4 w-4 text-orange-500" /></Button>
                                                    )}
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(user.username)} data-testid={`delete-user-${user.username}`} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Edit User Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-md" data-testid="edit-user-dialog">
                    <DialogHeader><DialogTitle>Edit User: {editingUser?.username}</DialogTitle></DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div><Label>Full Name</Label><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
                        <div><Label>Email</Label><Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                        <div>
                            <Label>Role</Label>
                            <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                    <SelectItem value="org_admin">Org Admin</SelectItem>
                                    <SelectItem value="owner">Owner</SelectItem>
                                    <SelectItem value="farmer">Farmer</SelectItem>
                                    <SelectItem value="mechanic">Mechanic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Organization ID</Label><Input value={editForm.organization_id} onChange={(e) => setEditForm({ ...editForm, organization_id: e.target.value })} /></div>
                        <div>
                            <Label>Status</Label>
                            <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" data-testid="save-user-btn">Save</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create Organization Dialog */}
            <Dialog open={createOrgDialogOpen} onOpenChange={setCreateOrgDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateOrgSubmit} className="space-y-4">
                        <div>
                            <Label>Company Name *</Label>
                            <Input value={createOrgForm.company_name} onChange={(e) => setCreateOrgForm({ ...createOrgForm, company_name: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Contact Email *</Label>
                            <Input type="email" value={createOrgForm.contact_email} onChange={(e) => setCreateOrgForm({ ...createOrgForm, contact_email: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Phone</Label>
                            <Input value={createOrgForm.phone} onChange={(e) => setCreateOrgForm({ ...createOrgForm, phone: e.target.value })} />
                        </div>
                        <div>
                            <Label>Owner Name *</Label>
                            <Input value={createOrgForm.owner_name} onChange={(e) => setCreateOrgForm({ ...createOrgForm, owner_name: e.target.value })} required placeholder="e.g. John Doe" />
                        </div>
                        <div>
                            <Label>Owner Email *</Label>
                            <Input type="email" value={createOrgForm.owner_email} onChange={(e) => setCreateOrgForm({ ...createOrgForm, owner_email: e.target.value })} required placeholder="owner@company.com" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCreateOrgDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">Create</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Suspend Dialog */}
            <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
                <DialogContent className="max-w-md" data-testid="suspend-dialog">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-orange-700">
                            <Ban className="h-5 w-5" />Suspend: {suspendingUser?.username}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSuspendSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="suspension_reason">Reason for Suspension *</Label>
                            <textarea
                                id="suspension_reason"
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                rows={3}
                                required
                                placeholder="Explain why this account is being suspended (the user will see this message)…"
                                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                data-testid="suspension-reason-input"
                            />
                            <p className="text-xs text-muted-foreground mt-1">⚠️ The user will see this reason on their login screen.</p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-orange-600 hover:bg-orange-700" data-testid="confirm-suspend-btn">
                                <Ban className="h-4 w-4 mr-1" />Suspend Account
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
