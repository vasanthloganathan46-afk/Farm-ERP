import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Tractor, UserPlus } from 'lucide-react';

export default function FarmerRegisterPage() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    village: '',
    land_size: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/register-farmer', {
        ...formData,
        land_size: parseFloat(formData.land_size)
      });
      const username = res.data.username;
      toast.success(
        `Registration submitted successfully!\n\nYour username: ${username}\n\nYour account is pending admin approval. You will receive your login credentials once approved.`,
        { duration: 15000 }
      );
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero */}
      <div
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1758608951432-773ae6a33f56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0cmFjdG9yJTIwaW4lMjBmaWVsZHxlbnwwfHx8fDE3NjgxMzY0NDh8MA&ixlib=rb-4.1.0&q=85')"
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70" />
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <Tractor className="h-24 w-24 mb-6" />
          <h1 className="text-5xl font-bold font-heading mb-4">Join AgriGear</h1>
          <p className="text-xl text-center opacity-90">Self-Service Farm Machinery Rental</p>
          <p className="text-lg text-center opacity-80 mt-4 max-w-md">Browse fleet, book machinery, and manage everything from your dashboard</p>
        </div>
      </div>

      {/* Right side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted">
        <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl shadow-lg border border-border">
          <div className="text-center">
            <div className="flex justify-center mb-4 lg:hidden">
              <Tractor className="h-16 w-16 text-primary" />
            </div>
            <h2 className="text-3xl font-bold font-heading text-foreground flex items-center justify-center">
              <UserPlus className="h-8 w-8 mr-2 text-primary" />
              Farmer Registration
            </h2>
            <p className="mt-2 text-muted-foreground">Create your account to start booking</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="farmer-register-form">
            <div>
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                data-testid="farmer-fullname-input"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                placeholder="Your full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                data-testid="farmer-email-input"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="your@email.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                data-testid="farmer-phone-input"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="+91-9876543210"
              />
            </div>

            <div>
              <Label htmlFor="village">Village *</Label>
              <Input
                id="village"
                data-testid="farmer-village-input"
                value={formData.village}
                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                required
                placeholder="Your village name"
              />
            </div>

            <div>
              <Label htmlFor="land_size">Land Size (Acres) *</Label>
              <Input
                id="land_size"
                data-testid="farmer-landsize-input"
                type="number"
                step="0.1"
                value={formData.land_size}
                onChange={(e) => setFormData({ ...formData, land_size: e.target.value })}
                required
                placeholder="10.5"
              />
            </div>

            <Button
              type="submit"
              data-testid="farmer-register-button"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Register Now'}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/login" className="text-primary font-medium hover:underline">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
