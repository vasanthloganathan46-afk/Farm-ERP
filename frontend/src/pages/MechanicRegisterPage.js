import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Wrench, UserPlus } from 'lucide-react';

export default function MechanicRegisterPage() {
    const [formData, setFormData] = useState({
        full_name: '', email: '', phone: '', password: '', confirmPassword: '', skills: '', hourly_rate: ''
    });
    const [loading, setLoading] = useState(false);
    const [registered, setRegistered] = useState(null); // { username }
    const navigate = useNavigate();

    const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/auth/register-mechanic', {
                full_name: formData.full_name,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                skills: formData.skills,
                hourly_rate: parseFloat(formData.hourly_rate)
            });
            setRegistered({ username: res.data.username });
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    if (registered) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted p-8">
                <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                            <Wrench className="h-8 w-8 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold font-heading text-foreground">Application Submitted!</h2>
                    <p className="text-muted-foreground">Your mechanic account is <strong>pending approval</strong> by the Super Admin. You'll be able to log in once approved.</p>
                    <div className="bg-muted rounded-lg p-4">
                        <p className="text-lg font-mono font-bold text-foreground">{registered.username}</p>
                        <p className="text-xs text-muted-foreground mt-1">Save your username — you'll need it to log in after approval</p>
                    </div>
                    <Button className="w-full" onClick={() => navigate('/login')}>
                        Go to Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex">
            {/* Left hero */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-900 to-teal-700 relative">
                <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                    <Wrench className="h-24 w-24 mb-6 opacity-90" />
                    <h1 className="text-5xl font-bold font-heading mb-4">Join as a Mechanic</h1>
                    <p className="text-xl text-center opacity-90">Freelance machinery repair & maintenance</p>
                    <p className="text-lg text-center opacity-80 mt-4 max-w-md">
                        Get hired by farm machinery companies, manage jobs, and grow your repair business
                    </p>
                </div>
            </div>

            {/* Right form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-muted">
                <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl shadow-lg border border-border">
                    <div className="text-center">
                        <div className="flex justify-center mb-4 lg:hidden">
                            <Wrench className="h-16 w-16 text-primary" />
                        </div>
                        <h2 className="text-3xl font-bold font-heading text-foreground flex items-center justify-center">
                            <UserPlus className="h-8 w-8 mr-2 text-primary" />
                            Mechanic Registration
                        </h2>
                        <p className="mt-2 text-muted-foreground">Create your freelance mechanic account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4" data-testid="mechanic-register-form">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="full_name">Full Name *</Label>
                                <Input id="full_name" value={formData.full_name} onChange={update('full_name')} required placeholder="Your full name" />
                            </div>
                            <div>
                                <Label htmlFor="email">Email *</Label>
                                <Input id="email" type="email" value={formData.email} onChange={update('email')} required placeholder="you@example.com" />
                            </div>
                            <div>
                                <Label htmlFor="phone">Phone *</Label>
                                <Input id="phone" type="tel" value={formData.phone} onChange={update('phone')} required placeholder="+91-9876543210" />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="skills">Skills / Specialization *</Label>
                            <textarea
                                id="skills"
                                value={formData.skills}
                                onChange={update('skills')}
                                required
                                rows={2}
                                placeholder="e.g. Tractor engine repair, hydraulics, welding, electrical systems..."
                                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div>
                            <Label htmlFor="hourly_rate">Hourly Rate (₹) *</Label>
                            <Input
                                id="hourly_rate"
                                type="number"
                                step="1"
                                min="0"
                                value={formData.hourly_rate}
                                onChange={update('hourly_rate')}
                                required
                                placeholder="e.g. 500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="password">Password *</Label>
                                <Input id="password" type="password" value={formData.password} onChange={update('password')} required placeholder="Min 6 characters" />
                            </div>
                            <div>
                                <Label htmlFor="confirmPassword">Confirm *</Label>
                                <Input id="confirmPassword" type="password" value={formData.confirmPassword} onChange={update('confirmPassword')} required placeholder="Repeat password" />
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading} data-testid="mechanic-register-button">
                            {loading ? 'Creating Account...' : 'Register as Mechanic'}
                        </Button>
                    </form>

                    <div className="text-center text-sm space-y-1">
                        <div>
                            <span className="text-muted-foreground">Already have an account? </span>
                            <Link to="/login" className="text-primary font-medium hover:underline">Login here</Link>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Registering as a farmer? </span>
                            <Link to="/farmer-register" className="text-primary font-medium hover:underline">Farmer Registration</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
