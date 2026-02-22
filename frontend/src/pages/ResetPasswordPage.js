import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Tractor, KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { token, new_password: newPassword });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid or expired reset link.');
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
                                <KeyRound className="h-10 w-10 text-primary" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold font-heading text-foreground">Reset Password</h2>
                        <p className="mt-2 text-muted-foreground">Enter your new password below</p>
                    </div>

                    {success ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
                            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                            <div className="text-green-700 font-semibold text-lg">Password Reset!</div>
                            <p className="text-green-600 text-sm">Your password has been updated successfully.</p>
                            <p className="text-xs text-muted-foreground">Redirecting to login in 3 seconds...</p>
                            <Link to="/login"><Button variant="outline">Go to Login</Button></Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6" data-testid="reset-password-form">
                            <div>
                                <Label htmlFor="new-password">New Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="new-password"
                                        data-testid="new-password-input"
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        placeholder="Min. 6 characters"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                <Input
                                    id="confirm-password"
                                    data-testid="confirm-password-input"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Re-enter your new password"
                                    className="mt-1"
                                />
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                                )}
                            </div>

                            {/* Strength indicator */}
                            {newPassword.length > 0 && (
                                <div className="space-y-1">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4].map((level) => (
                                            <div
                                                key={level}
                                                className={`h-1.5 flex-1 rounded-full transition-colors ${newPassword.length >= level * 3
                                                        ? level <= 1 ? 'bg-red-400' : level <= 2 ? 'bg-orange-400' : level <= 3 ? 'bg-yellow-400' : 'bg-green-500'
                                                        : 'bg-muted'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {newPassword.length < 6 ? 'Too short' : newPassword.length < 9 ? 'Weak' : newPassword.length < 12 ? 'Good' : 'Strong'}
                                    </p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                data-testid="reset-submit-button"
                                className="w-full"
                                disabled={loading || (confirmPassword.length > 0 && newPassword !== confirmPassword)}
                            >
                                {loading ? 'Resetting...' : 'Set New Password'}
                            </Button>

                            <div className="text-center">
                                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                                    Request a new reset link
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
