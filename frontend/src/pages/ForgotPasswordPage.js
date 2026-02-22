import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Tractor, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSubmitted(true);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left hero */}
            <div
                className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1758608951432-773ae6a33f56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0cmFjdG9yJTIwaW4lMjBmaWVsZHxlbnwwfHx8fDE3NjgxMzY0NDh8MA&ixlib=rb-4.1.0&q=85')" }}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70" />
                <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                    <Tractor className="h-24 w-24 mb-6" />
                    <h1 className="text-5xl font-bold font-heading mb-4">AgriGear ERP</h1>
                    <p className="text-xl text-center opacity-90">Farm Machinery Management System</p>
                </div>
            </div>

            {/* Right form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Mail className="h-10 w-10 text-primary" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold font-heading text-foreground">Forgot Password</h2>
                        <p className="mt-2 text-muted-foreground">Enter your email to receive a reset link</p>
                    </div>

                    {submitted ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-4">
                            <div className="text-green-700 font-semibold text-lg">Check your email!</div>
                            <p className="text-green-600 text-sm">
                                If an account exists with <strong>{email}</strong>, a password reset link has been sent.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                (Demo mode: check the backend console/terminal for the reset link)
                            </p>
                            <Link to="/login">
                                <Button variant="outline" className="mt-2">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Login
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6" data-testid="forgot-password-form">
                            <div>
                                <Label htmlFor="forgot-email">Email Address</Label>
                                <Input
                                    id="forgot-email"
                                    data-testid="forgot-email-input"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="mt-1"
                                    placeholder="Enter your registered email"
                                />
                            </div>

                            <Button
                                type="submit"
                                data-testid="forgot-submit-button"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </Button>

                            <div className="text-center">
                                <Link to="/login" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to Login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
