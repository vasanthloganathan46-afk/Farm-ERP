import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Tractor, CheckCircle, Clock, ClipboardList, User, Mail, Phone, Shield, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function OperatorDashboard() {
    const { user } = useAuth();
    const [fieldLogs, setFieldLogs] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [wages, setWages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [logsRes, bookingsRes, wagesRes] = await Promise.all([
                    api.get('/field-logs').catch(() => ({ data: [] })),
                    api.get('/bookings').catch(() => ({ data: [] })),
                    api.get('/wages').catch(() => ({ data: [] })),
                ]);
                setFieldLogs(logsRes.data);
                setBookings(bookingsRes.data);
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

    const completedOps = fieldLogs.length;
    const assignedBookings = bookings.filter(b => b.status === 'Confirmed' || b.status === 'In Progress');
    const completedBookings = bookings.filter(b => b.status === 'Completed');
    const totalHours = fieldLogs.reduce((sum, log) => sum + (log.actual_hours || 0), 0);
    const totalEarnings = wages.reduce((sum, w) => sum + (w.wage_amount || 0), 0);

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight">
                    Welcome, {user?.full_name || 'Operator'}!
                </h1>
                <p className="mt-1 text-muted-foreground">Your operator dashboard — track your assignments and field operations</p>
            </div>

            {/* Profile Overview */}
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                <h2 className="text-lg font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Profile Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Role</p>
                        <p className="font-medium capitalize mt-1">{user?.role || 'Operator'}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Total Earnings */}
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-green-700 font-medium">Total Earnings</p>
                            <p className="text-3xl font-bold font-mono text-green-800 mt-2">₹{totalEarnings.toLocaleString()}</p>
                        </div>
                        <div className="bg-green-200 text-green-700 p-3 rounded-lg">
                            <DollarSign className="h-6 w-6" />
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Active Assignments</p>
                            <p className="text-3xl font-bold font-heading text-foreground mt-2">{assignedBookings.length}</p>
                        </div>
                        <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                            <ClipboardList className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Completed Jobs</p>
                            <p className="text-3xl font-bold font-heading text-foreground mt-2">{completedBookings.length}</p>
                        </div>
                        <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                            <CheckCircle className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Field Logs Filed</p>
                            <p className="text-3xl font-bold font-heading text-foreground mt-2">{completedOps}</p>
                        </div>
                        <div className="bg-orange-100 text-accent p-3 rounded-lg">
                            <Tractor className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Total Hours Logged</p>
                            <p className="text-3xl font-bold font-mono text-foreground mt-2">{totalHours.toFixed(1)}</p>
                        </div>
                        <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
                            <Clock className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Assignments */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold font-heading">Recent Assignments</h3>
                </div>
                <div className="p-6">
                    {bookings.length === 0 ? (
                        <div className="text-center py-8">
                            <Tractor className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No assignments yet. Check back soon!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {bookings.slice(0, 5).map((booking) => (
                                <div key={booking.booking_id} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                                    <div>
                                        <p className="font-medium text-foreground">{booking.machine_type || 'Machine'}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{booking.field_location}</p>
                                        <p className="text-xs font-mono text-muted-foreground mt-1">{new Date(booking.booking_date).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${booking.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                        booking.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {booking.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Job History — Completed */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold font-heading flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" /> Job History — Completed
                    </h3>
                </div>
                <div className="p-6">
                    {completedBookings.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No completed jobs yet. Keep up the great work!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/30">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Machine</th>
                                        <th className="px-4 py-3 text-left font-semibold">Location</th>
                                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                                        <th className="px-4 py-3 text-left font-semibold">Hours</th>
                                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {completedBookings.map((booking) => (
                                        <tr key={booking.booking_id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-4 py-3 font-medium text-foreground">{booking.machine_type || 'Machine'}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{booking.field_location || '—'}</td>
                                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{new Date(booking.booking_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                            <td className="px-4 py-3 text-muted-foreground font-mono">{booking.actual_hours || booking.expected_hours || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-green-100 text-green-700">
                                                    Completed
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
