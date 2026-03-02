import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Wrench, CheckCircle, Clock, AlertTriangle, User, Mail, Phone, Shield, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function MechanicDashboard() {
    const { user } = useAuth();
    const [records, setRecords] = useState([]);
    const [wages, setWages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [maintenanceRes, wagesRes] = await Promise.all([
                    api.get('/maintenance').catch(() => ({ data: [] })),
                    api.get('/wages').catch(() => ({ data: [] })),
                ]);
                setRecords(maintenanceRes.data);
                setWages(wagesRes.data);
            } catch {
                toast.error('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
    }

    const pendingJobs = records.filter(r => r.status === 'pending_acceptance');
    const activeJobs = records.filter(r => r.status === 'in_progress');
    const completedJobs = records.filter(r => r.status === 'completed');
    const totalEarnings = wages.reduce((sum, w) => sum + (w.wage_amount || 0), 0);
    const pendingPayments = wages.filter(w => w.payment_status === 'pending');
    const pendingPaymentAmount = pendingPayments.reduce((sum, w) => sum + (w.wage_amount || 0), 0);

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight">
                    Welcome, {user?.full_name || 'Mechanic'}!
                </h1>
                <p className="mt-1 text-muted-foreground">Your mechanic dashboard — manage repairs and track earnings</p>
            </div>

            {/* Profile Overview */}
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                <h2 className="text-lg font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Profile Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Role</p>
                        <p className="font-medium capitalize mt-1">{user?.role || 'Mechanic'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</p>
                        <p className="font-medium mt-1">{user?.email || 'Not provided'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</p>
                        <p className="font-medium mt-1">{user?.phone || 'Not provided'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Status</p>
                        <p className="font-medium text-green-600 mt-1">Active</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Job Offers</p>
                            <p className="text-3xl font-bold font-heading text-foreground mt-2">{pendingJobs.length}</p>
                        </div>
                        <div className="bg-indigo-100 text-indigo-600 p-3 rounded-lg">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Active Repairs</p>
                            <p className="text-3xl font-bold font-heading text-foreground mt-2">{activeJobs.length}</p>
                        </div>
                        <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                            <Wrench className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Completed</p>
                            <p className="text-3xl font-bold font-heading text-foreground mt-2">{completedJobs.length}</p>
                        </div>
                        <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                            <CheckCircle className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Total Earnings</p>
                            <p className="text-3xl font-bold font-mono text-foreground mt-2">₹{totalEarnings.toLocaleString()}</p>
                        </div>
                        <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                            <DollarSign className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Pending Pay</p>
                            <p className="text-3xl font-bold font-mono text-foreground mt-2">₹{pendingPaymentAmount.toLocaleString()}</p>
                        </div>
                        <div className="bg-orange-100 text-accent p-3 rounded-lg">
                            <Clock className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Job Offers Alert */}
            {pendingJobs.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                    <h3 className="text-lg font-semibold text-indigo-800 mb-2">🔔 You have {pendingJobs.length} pending job offer{pendingJobs.length > 1 ? 's' : ''}!</h3>
                    <p className="text-sm text-indigo-700 mb-3">Head to the Job Board to accept or reject these offers.</p>
                    <Link to="/maintenance">
                        <Button className="bg-indigo-600 hover:bg-indigo-700">Go to Job Board</Button>
                    </Link>
                </div>
            )}

            {/* Recent Completed Jobs */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold font-heading">Recent Repairs</h3>
                </div>
                <div className="p-6">
                    {records.length === 0 ? (
                        <div className="text-center py-8">
                            <Wrench className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No repair jobs yet. Check the Job Board for new offers!</p>
                            <Link to="/maintenance">
                                <Button className="mt-4">Go to Job Board</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {records.slice(0, 5).map((record) => (
                                <div key={record.maintenance_id} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                                    <div>
                                        <p className="font-medium text-foreground">{record.machine_type || record.machinery_id}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{record.service_type}</p>
                                        <p className="text-xs font-mono text-muted-foreground mt-1">{record.maintenance_id}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${record.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                record.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                    record.status === 'pending_acceptance' ? 'bg-indigo-100 text-indigo-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {record.status === 'pending_acceptance' ? 'Awaiting Acceptance' :
                                                record.status === 'in_progress' ? 'In Progress' :
                                                    record.status === 'completed' ? 'Completed' :
                                                        record.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </span>
                                        {record.total_cost > 0 && (
                                            <p className="text-sm font-mono text-muted-foreground mt-1">₹{record.total_cost.toLocaleString()}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
