import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'sonner';
import { Users, Phone, Mail, MapPin, Leaf } from 'lucide-react';

export default function FarmersPage() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    try {
      // Fix: Use /org/farmers which returns ALL global farmers directly from users collection
      const response = await api.get('/org/farmers');
      setFarmers(response.data);
    } catch (error) {
      toast.error('Failed to load farmers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading farmers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
          <Users className="h-10 w-10 mr-3 text-primary" />
          Farmers
        </h1>
        <p className="mt-1 text-muted-foreground">Farmers who have booked machinery with your organisation</p>
      </div>

      {/* Stats card */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex items-center gap-4">
        <div className="bg-green-100 text-green-600 p-3 rounded-lg">
          <Leaf className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Total Registered Farmers</p>
          <p className="text-3xl font-bold font-mono text-foreground">{farmers.length}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {farmers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Farmers Yet</h3>
            <p className="text-muted-foreground">No farmers have booked with your organisation yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Village</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Land Size</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {farmers.map((farmer) => (
                  <tr key={farmer.username} className="table-row hover:bg-muted/10 transition-colors" data-testid={`farmer-row-${farmer.username}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
                          {farmer.full_name?.charAt(0)?.toUpperCase() || 'F'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{farmer.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">@{farmer.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {farmer.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {farmer.phone || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {farmer.village || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {farmer.land_size != null ? `${farmer.land_size} acres` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${farmer.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : farmer.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                        {farmer.status}
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
  );
}
