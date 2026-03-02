import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Wrench, CheckCircle, XCircle, UserPlus, Star, AlertTriangle, RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ── Leaflet default icon fix ──────────────────────────────────────────────────
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Red pin for broken machine
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// Blue pin for mechanic
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// ── Star Rating component ─────────────────────────────────────────────────────
function StarRating({ value, onChange, size = 6 }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          className={`h-${size} w-${size} transition-colors ${(hovered || value) >= star ? 'text-yellow-400' : 'text-muted-foreground'}`}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star className={`h-${size} w-${size} ${(hovered || value) >= star ? 'fill-yellow-400' : ''}`} />
        </button>
      ))}
    </div>
  );
}

// ── Mechanic rating badge ─────────────────────────────────────────────────────
function RatingBadge({ avg, count }) {
  if (!count) return <span className="text-xs text-muted-foreground ml-1">(no reviews)</span>;
  return (
    <span className="ml-1 text-xs text-yellow-600 font-semibold">
      ⭐ {avg} <span className="text-muted-foreground font-normal">({count})</span>
    </span>
  );
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const isMechanic = user?.role === 'mechanic';
  const isOrgAdmin = user?.role === 'org_admin';

  const [records, setRecords] = useState([]);
  const [machinery, setMachinery] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [assignMechanicId, setAssignMechanicId] = useState('');

  // Create maintenance form
  const [formData, setFormData] = useState({ machinery_id: '', service_type: '', mechanic_id: '' });

  // Rate mechanic form
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Material request (mechanic)
  const [materialData, setMaterialData] = useState({ maintenance_id: '' });
  const [partsList, setPartsList] = useState([{ part_name: '', quantity: 1 }]);
  const [materialError, setMaterialError] = useState(null);

  // Manager parts review
  const [reviewPartsDialogOpen, setReviewPartsDialogOpen] = useState(false);
  const [reviewPartsRecord, setReviewPartsRecord] = useState(null);

  // Mechanic wages
  const [wages, setWages] = useState([]);

  // Complete job dialog (to enter labor charge)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeJobId, setCompleteJobId] = useState(null);
  const [completeRecord, setCompleteRecord] = useState(null);
  const [laborCharge, setLaborCharge] = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const promises = [api.get('/maintenance'), api.get('/machinery')];
      if (isOrgAdmin) promises.push(api.get('/org/mechanics/available'));

      let wagesIdx = -1;
      if (isMechanic) {
        promises.push(api.get('/wages').catch(() => ({ data: [] })));
        wagesIdx = promises.length - 1;
      }

      const results = await Promise.all(promises);
      setRecords(results[0].data);
      setMachinery(results[1].data);
      if (isOrgAdmin && results[2]) {
        const data = Array.isArray(results[2].data) ? results[2].data : [];
        console.log('[MaintenancePage] available mechanics:', data);
        setMechanics(data);
      }
      if (isMechanic && wagesIdx > -1) {
        setWages(results[wagesIdx].data || []);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isOrgAdmin, isMechanic]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debug: print job list for mechanics
  useEffect(() => {
    if (isMechanic) {
      console.log('MECHANIC JOBS:', records);
      console.log('MECHANIC pending_acceptance:', records.filter(r => r.status === 'pending_acceptance'));
    }
  }, [records, isMechanic]);

  // ── Create maintenance ────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/maintenance', formData);
      toast.success('Maintenance record created');
      setDialogOpen(false);
      setFormData({ machinery_id: '', service_type: '', mechanic_id: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create maintenance');
    }
  };

  // ── Mechanic workflow ─────────────────────────────────────────────────────
  const handleAcceptJob = async (id) => {
    try {
      await api.put(`/maintenance/${id}/accept`);
      toast.success('Job accepted! Get to work 🔧');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept job');
    }
  };

  const handleRejectJob = async (id) => {
    if (!window.confirm('Reject this job? It will be returned to the pending pool.')) return;
    try {
      await api.put(`/maintenance/${id}/reject`);
      toast.info('Job rejected, returned to pool');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject job');
    }
  };

  const handleCompleteJob = (id) => {
    const record = records.find(r => r.maintenance_id === id);
    setCompleteJobId(id);
    setCompleteRecord(record || null);
    setLaborCharge('');
    setCompleteDialogOpen(true);
  };

  // Auto-calculate approved spare parts cost from the record
  const approvedPartsCost = completeRecord?.spare_parts
    ?.filter(p => p.status === 'approved' || p.status === 'provided')
    .reduce((sum, p) => sum + (p.cost || p.estimated_cost || 0), 0) || 0;

  const submitCompleteJob = async () => {
    try {
      await api.put(`/maintenance/${completeJobId}/complete`, {
        labor_charge: parseFloat(laborCharge) || 0,
        spare_parts_cost: approvedPartsCost
      });
      toast.success('Job marked as completed ✅');
      setCompleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete job');
    }
  };

  // ── Manager: Assign mechanic ──────────────────────────────────────────────
  const openAssignDialog = (record) => {
    setSelectedRecord(record);
    setAssignMechanicId('');
    setAssignDialogOpen(true);
  };

  const handleAssignMechanic = async (e) => {
    e.preventDefault();
    if (!assignMechanicId) { toast.error('Please select a mechanic'); return; }
    try {
      await api.put(`/maintenance/${selectedRecord.maintenance_id}/assign`, {
        mechanic_username: assignMechanicId
      });
      toast.success('Mechanic assigned successfully');
      setAssignDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign mechanic');
    }
  };

  // ── Manager: Rate mechanic ────────────────────────────────────────────────
  const openRateDialog = (record) => {
    setSelectedRecord(record);
    setRatingValue(0);
    setRatingFeedback('');
    setRateDialogOpen(true);
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (ratingValue === 0) { toast.error('Please select a star rating'); return; }
    setRatingSubmitting(true);
    try {
      await api.post(`/maintenance/${selectedRecord.maintenance_id}/review`, {
        rating: ratingValue,
        feedback: ratingFeedback
      });
      toast.success(`Rating submitted! ⭐ ${ratingValue}/5`);
      setRateDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  // ── Mechanic: request spare parts ─────────────────────────────────────────
  const handleMechanicPartsRequest = async (e) => {
    e.preventDefault();
    setMaterialError(null);
    const validParts = partsList.filter(p => p.part_name.trim());
    if (validParts.length === 0) { setMaterialError('Add at least one part name'); return; }
    try {
      for (const part of validParts) {
        await api.post(`/mechanic/jobs/${materialData.maintenance_id}/parts`, {
          maintenance_id: materialData.maintenance_id,
          part_name: part.part_name,
          estimated_cost: parseFloat(part.estimated_cost) || 0
        });
      }
      toast.success(`${validParts.length} spare part(s) requested!`);
      setMaterialDialogOpen(false);
      setPartsList([{ part_name: '', quantity: 1, estimated_cost: '' }]);
      setMaterialData({ maintenance_id: '' });
      fetchData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      let errMsg = 'Failed to submit parts request';
      if (Array.isArray(detail)) {
        errMsg = detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
      } else if (typeof detail === 'string') {
        errMsg = detail;
      }
      setMaterialError(errMsg);
      toast.error(errMsg);
    }
  };

  const addPartRow = () => setPartsList(prev => [...prev, { part_name: '', quantity: 1, estimated_cost: '' }]);
  const removePartRow = (idx) => setPartsList(prev => prev.filter((_, i) => i !== idx));
  const updatePartRow = (idx, field, value) => setPartsList(prev => prev.map((p, i) => {
    if (i !== idx) return p;
    // Enforce min=1 for quantity, min=0 for cost
    let safeVal = value;
    if (field === 'quantity') safeVal = Math.max(1, parseInt(value) || 1);
    if (field === 'estimated_cost') safeVal = value === '' ? '' : Math.max(0, parseFloat(value) || 0);
    return { ...p, [field]: safeVal };
  }));

  // ── Manager: approve a single part ──────────────────────────────────
  const handleApproveOnePart = async (part_name) => {
    try {
      await api.put(`/maintenance/${reviewPartsRecord.maintenance_id}/spare-parts/${encodeURIComponent(part_name)}/approve`);
      toast.success(`'${part_name}' approved ✅`);
      fetchData();
      // Update local state immediately so the modal reflects the change
      setReviewPartsRecord(prev => ({
        ...prev,
        spare_parts: prev.spare_parts.map(p =>
          p.part_name === part_name ? { ...p, status: 'approved' } : p
        )
      }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve part');
    }
  };

  // ── Manager: approve spare parts ──────────────────────────────────────────
  const handleApproveParts = async () => {
    try {
      await api.put(`/maintenance/${reviewPartsRecord.maintenance_id}/spare-parts/approve`);
      toast.success('Spare parts approved! ✅');
      setReviewPartsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve parts');
    }
  };

  // ── Status helpers ────────────────────────────────────────────────────────
  const STATUS_COLOR = {
    completed: 'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    pending_acceptance: 'bg-indigo-100 text-indigo-700',
    pending_assignment: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-orange-100 text-orange-700',
    rejected: 'bg-red-100 text-red-700',
    reported: 'bg-amber-100 text-amber-700',
  };

  const STATUS_LABEL = {
    pending_acceptance: 'Awaiting Mechanic Acceptance',
    pending_assignment: 'Pending Assignment',
    in_progress: 'In Progress',
    completed: 'Completed',
    pending: 'Pending',
    rejected: 'Mechanic Rejected — Reassign',
    reported: 'Reported — Awaiting Assignment',
  };

  const statusLabel = (s) => STATUS_LABEL[s] || (s || 'pending').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const statusColor = (status) => STATUS_COLOR[status] || 'bg-gray-100 text-gray-700';

  // ── Geospatial helpers ────────────────────────────────────────────────────
  const getMachineLocation = (record) => {
    const m = machinery.find(m => m.machinery_id === record?.machinery_id);
    if (!m?.location?.coordinates) return null;
    const [lng, lat] = m.location.coordinates;
    const latF = parseFloat(lat);
    const lngF = parseFloat(lng);
    if (isNaN(latF) || isNaN(lngF)) return null;
    return { lat: latF, lng: lngF, label: m.machine_type };
  };

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;
  }

  // ── Partition records ─────────────────────────────────────────────────────
  const jobOffers = isMechanic ? records.filter(r => r.status === 'pending_acceptance') : [];
  const activeJobs = isMechanic ? records.filter(r => r.status === 'in_progress') : [];

  // ── Available machines only ───────────────────────────────────────────────
  const availableMachinery = machinery.filter(m => {
    const s = (m.status || '').toLowerCase();
    return s === 'available' || s === 'active';
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight flex items-center">
            <Wrench className="h-10 w-10 mr-3 text-primary" />
            {isMechanic ? 'My Job Board' : 'Maintenance Log'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isMechanic ? 'View job offers, accept or reject, and mark work complete' : 'Track machine maintenance and assign mechanics'}
          </p>
        </div>
        {isOrgAdmin && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Maintenance
          </Button>
        )}
      </div>

      {/* ── Mechanic: Job Offers ── */}
      {isMechanic && jobOffers.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-indigo-800 mb-3">🔔 New Job Offers ({jobOffers.length})</h2>
          <div className="space-y-3">
            {jobOffers.map(job => (
              <div key={job.maintenance_id} className="bg-white rounded-lg border border-indigo-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{job.machine_type || job.machinery_id}</p>
                  <p className="text-sm text-muted-foreground">{job.service_type} · {job.maintenance_id}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAcceptJob(job.maintenance_id)}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleRejectJob(job.maintenance_id)}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Mechanic: Active Jobs ── */}
      {isMechanic && activeJobs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-blue-800 mb-3">🔧 Active Jobs ({activeJobs.length})</h2>
          <div className="space-y-3">
            {activeJobs.map(job => (
              <div key={job.maintenance_id} className="bg-white rounded-lg border border-blue-200 p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{job.machine_type || job.machinery_id}</p>
                  <p className="text-sm text-muted-foreground">{job.service_type} · {job.maintenance_id}</p>
                  {job.spare_parts?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.spare_parts.map((part, idx) => {
                        const isApproved = part.status === 'approved' || part.status === 'provided';
                        return (
                          <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isApproved ? '✅' : '⏳'} {part.part_name} — {isApproved ? 'Provided by Admin' : 'Pending Admin Approval'}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleCompleteJob(job.maintenance_id)}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Mark Complete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setMaterialData({ maintenance_id: job.maintenance_id }); setPartsList([{ part_name: '', quantity: 1, estimated_cost: '' }]); setMaterialDialogOpen(true); }}>
                    Request Parts
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── All Records Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isMechanic ? 'All My Jobs' : 'All Maintenance Records'}
          </h2>
        </div>
        {records.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No maintenance records found.</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {['ID', 'Machine', 'Service', 'Mechanic', 'Status', 'Cost', 'Rating', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map(record => {
                  const isPendingAssignment = record.status === 'pending_assignment';
                  const isCompleted = record.status === 'completed' || !!record.completed_at;
                  const isRated = !!record.rating;
                  return (
                    <tr key={record.maintenance_id}
                      className={`table-row ${isPendingAssignment ? 'bg-yellow-50/50' : ''}`}
                      data-testid={`maintenance-row-${record.maintenance_id}`}
                    >
                      <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{record.maintenance_id}</td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {record.machine_type || record.machinery_id}
                        {isOrgAdmin && record.spare_parts && record.spare_parts.length > 0 && (
                          <div className="mt-2 text-xs border border-border rounded-md bg-muted/20 p-2">
                            <span className="font-semibold text-muted-foreground block mb-1">Spare Parts Used:</span>
                            <ul className="space-y-1">
                              {record.spare_parts.map((part, i) => (
                                <li key={i} className="text-muted-foreground flex justify-between">
                                  <span>{part.part_name} <span className="opacity-70">(Qty: {part.quantity})</span></span>
                                  <span>₹{part.estimated_cost || 0}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{record.service_type}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {record.mechanic_name || (record.mechanic_id === 'unassigned' ? '—' : record.mechanic_id || '—')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${statusColor(record.status)}`}>
                          {isPendingAssignment && <AlertTriangle className="h-3 w-3" />}
                          {statusLabel(record.status)}
                        </span>
                        {isMechanic && isCompleted && (() => {
                          const wage = wages.find(w => w.booking_id === record.maintenance_id);
                          if (!wage) return null;
                          return wage.payment_status === 'paid'
                            ? <span className="mt-2 block px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 w-fit">Paid</span>
                            : <span className="mt-2 block px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 w-fit">Payment Pending</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono">₹{(record.total_cost || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">
                        {isRated
                          ? <span className="text-yellow-600 font-semibold">{'⭐'.repeat(record.rating)} {record.rating}/5</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        {/* Mechanic: accept/reject */}
                        {isMechanic && record.status === 'pending_acceptance' && (
                          <>
                            <Button size="sm" variant="outline" className="border-green-400 text-green-700" onClick={() => handleAcceptJob(record.maintenance_id)}>Accept</Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRejectJob(record.maintenance_id)}>Reject</Button>
                          </>
                        )}
                        {/* Mechanic: complete (ONLY for in_progress) */}
                        {isMechanic && record.status === 'in_progress' && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleCompleteJob(record.maintenance_id)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Complete
                          </Button>
                        )}
                        {/* Manager: force-complete (ONLY for in_progress) */}
                        {isOrgAdmin && record.status === 'in_progress' && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleCompleteJob(record.maintenance_id)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Complete
                          </Button>
                        )}
                        {/* Reported status: awaiting assignment label */}
                        {record.status === 'reported' && (
                          <span className="text-amber-600 text-xs font-medium italic">Awaiting Assignment</span>
                        )}
                        {/* Mechanic: request parts */}
                        {isMechanic && record.status === 'in_progress' && (
                          <Button size="sm" variant="ghost" onClick={() => { setMaterialData({ ...materialData, maintenance_id: record.maintenance_id }); setMaterialDialogOpen(true); }}>
                            Parts
                          </Button>
                        )}
                        {/* Manager: assign or reassign — also shows for rejected and reported */}
                        {isOrgAdmin && (isPendingAssignment || record.status === 'pending' || record.status === 'rejected' || record.status === 'reported') && (
                          <Button size="sm" variant="outline" onClick={() => openAssignDialog(record)}>
                            <UserPlus className="h-4 w-4 mr-1" />
                            {record.mechanic_id && record.mechanic_id !== 'unassigned' ? 'Reassign' : 'Assign'}
                          </Button>
                        )}
                        {/* Manager: rate after completion */}
                        {isOrgAdmin && isCompleted && !isRated && record.mechanic_id && record.mechanic_id !== 'unassigned' && (
                          <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-700 hover:bg-yellow-50" onClick={() => openRateDialog(record)}>
                            <Star className="h-4 w-4 mr-1" /> Rate
                          </Button>
                        )}
                        {/* Manager: review spare parts */}
                        {isOrgAdmin && record.spare_parts?.some(p => p.status === 'requested') && (
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => { setReviewPartsRecord(record); setReviewPartsDialogOpen(true); }}>
                            Review Parts
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOGS
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* ── Create Maintenance ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="create-maintenance-dialog">
          <DialogHeader><DialogTitle>New Maintenance Job</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Machine *</Label>
              <Select value={formData.machinery_id} onValueChange={(v) => setFormData({ ...formData, machinery_id: v })} required>
                <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                <SelectContent>
                  {availableMachinery.length === 0
                    ? <SelectItem value="none" disabled>No available machines</SelectItem>
                    : availableMachinery.map(m => (
                      <SelectItem key={m.machinery_id} value={m.machinery_id}>{m.machine_type} ({m.machinery_id})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type *</Label>
              <Select value={formData.service_type} onValueChange={(v) => setFormData({ ...formData, service_type: v })} required>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {['Engine Repair', 'Oil Change', 'Tyre Replacement', 'Electrical', 'Hydraulic', 'Scheduled Service', 'Breakdown'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Overview Map — shows selected machine + available mechanics */}
            {formData.machinery_id && (() => {
              const selectedMach = machinery.find(m => m.machinery_id === formData.machinery_id);
              const machLoc = selectedMach?.location?.coordinates;
              const centerLat = machLoc ? parseFloat(machLoc[1]) : 11.0168;
              const centerLng = machLoc ? parseFloat(machLoc[0]) : 76.9558;
              const validCenter = !isNaN(centerLat) && !isNaN(centerLng);
              const mechanicsWithCoords = (mechanics || []).filter(m => {
                const lat = Number(m.lat); const lng = Number(m.lng);
                return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
              });
              return (
                <div>
                  <Label className="mb-1 block">Location: Machine vs Mechanics</Label>
                  <div style={{ height: '250px', width: '100%' }} className="rounded-lg overflow-hidden border border-border relative">
                    <MapContainer center={[centerLat, centerLng]} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {validCenter && machLoc && (
                        <Marker position={[centerLat, centerLng]} icon={redIcon}>
                          <Popup><strong>🔴 {selectedMach?.machine_type}</strong></Popup>
                        </Marker>
                      )}
                      {mechanicsWithCoords.map(m => (
                        <Marker key={m.username} position={[Number(m.lat), Number(m.lng)]} icon={blueIcon}>
                          <Popup><strong>🔵 {m.full_name}</strong><br />@{m.username}</Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                    {!machLoc && (
                      <div className="absolute top-2 left-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded z-10">Machine location not set</div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div>
              <Label>Assign Mechanic (optional)</Label>
              <Select value={formData.mechanic_id} onValueChange={(v) => setFormData({ ...formData, mechanic_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select mechanic (optional)" /></SelectTrigger>
                <SelectContent>
                  {mechanics.length === 0
                    ? <SelectItem value="none" disabled>No active mechanics available</SelectItem>
                    : mechanics.map(m => (
                      <SelectItem key={m.username} value={m.username}>
                        {m.full_name} (@{m.username})
                        {m.total_reviews > 0 && ` ⭐ ${m.average_rating} (${m.total_reviews})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign / Reassign Mechanic (with Map) ── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="assign-mechanic-dialog">
          <DialogHeader>
            <DialogTitle>
              <RefreshCw className="inline h-4 w-4 mr-2 text-muted-foreground" />
              Assign Mechanic — {selectedRecord?.maintenance_id}
            </DialogTitle>
          </DialogHeader>

          {/* Geospatial map */}
          {(() => {
            const machineLoc = getMachineLocation(selectedRecord);
            // STRICT fallback: always a number, never null/NaN
            const centerLat = machineLoc ? machineLoc.lat : 11.0168;
            const centerLng = machineLoc ? machineLoc.lng : 76.9558;

            const mechanicsWithCoords = (mechanics || []).filter(m => {
              const lat = Number(m.lat);
              const lng = Number(m.lng);
              return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
            });

            return (
              <div style={{ height: '300px', width: '100%' }} className="rounded-lg overflow-hidden border border-border mb-4 relative" data-testid="assign-map">
                <MapContainer center={[centerLat, centerLng]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* 🔴 Broken machine pin */}
                  {machineLoc && (
                    <Marker position={[centerLat, centerLng]} icon={redIcon}>
                      <Popup><strong>🔴 Broken Machine</strong><br />{machineLoc.label}</Popup>
                    </Marker>
                  )}
                  {/* 🔵 Mechanic pins — only when coords are valid numbers */}
                  {mechanicsWithCoords.map(m => {
                    const lat = Number(m.lat);
                    const lng = Number(m.lng);
                    return (
                      <Marker key={m.username} position={[lat, lng]} icon={blueIcon}>
                        <Popup>
                          <strong>🔵 {m.full_name}</strong><br />
                          @{m.username}<br />
                          {m.total_reviews > 0 ? `⭐ ${m.average_rating} (${m.total_reviews} reviews)` : 'No reviews yet'}
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
                {!machineLoc && (
                  <div className="absolute top-2 left-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded z-10">
                    Machine location not set — showing Coimbatore city centre
                  </div>
                )}
              </div>
            );
          })()}




          <form onSubmit={handleAssignMechanic} className="space-y-4">
            <div>
              <Label>Select Mechanic *</Label>
              <Select value={assignMechanicId} onValueChange={setAssignMechanicId} required>
                <SelectTrigger><SelectValue placeholder="Choose a mechanic" /></SelectTrigger>
                <SelectContent>
                  {mechanics.map(m => (
                    <SelectItem key={m.username} value={m.username}>
                      {m.full_name} (@{m.username})
                      <RatingBadge avg={m.average_rating} count={m.total_reviews} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Assign Mechanic</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Rate Mechanic ── */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent data-testid="rate-mechanic-dialog">
          <DialogHeader>
            <DialogTitle>
              <Star className="inline h-4 w-4 mr-2 text-yellow-500" />
              Rate Mechanic — {selectedRecord?.mechanic_id}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitRating} className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Job: <span className="font-mono">{selectedRecord?.maintenance_id}</span> · {selectedRecord?.service_type}</p>
              <Label className="mb-2 block">Your Rating *</Label>
              <StarRating value={ratingValue} onChange={setRatingValue} size={8} />
              {ratingValue > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {['', 'Poor', 'Below Average', 'Good', 'Very Good', 'Excellent'][ratingValue]}
                </p>
              )}
            </div>
            <div>
              <Label>Feedback (optional)</Label>
              <textarea
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="Share your experience with this mechanic..."
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={ratingSubmitting || ratingValue === 0} className="bg-yellow-500 hover:bg-yellow-600">
                {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Mechanic: Complete Job ── */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent data-testid="complete-job-dialog">
          <DialogHeader><DialogTitle>Complete Job — Enter Costs</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Labor Charge (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 1500"
                value={laborCharge}
                onChange={(e) => setLaborCharge(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">Your charge for the repair work performed.</p>
            </div>
            <div>
              <Label>Spare Parts Cost (₹) — auto-calculated</Label>
              <input
                type="number"
                step="0.01"
                value={approvedPartsCost}
                readOnly
                tabIndex={-1}
                className="w-full p-2 border border-input rounded-md bg-gray-100 cursor-not-allowed text-gray-500 font-mono text-sm"
                title="This is automatically calculated from approved parts. You cannot edit this value."
              />
              <p className="text-xs text-muted-foreground mt-1">This is auto-calculated from your approved spare parts requests. You cannot edit this value.</p>
            </div>
            {/* Total Cost Preview */}
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Labor Charge</span>
                <span className="font-mono">₹{(parseFloat(laborCharge) || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-muted-foreground">Spare Parts (approved)</span>
                <span className="font-mono">₹{approvedPartsCost.toLocaleString()}</span>
              </div>
              <div className="border-t border-border mt-2 pt-2 flex justify-between items-center">
                <span className="font-semibold text-foreground">Total Cost</span>
                <span className="font-bold font-mono text-lg text-foreground">₹{((parseFloat(laborCharge) || 0) + approvedPartsCost).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={submitCompleteJob}>
                <CheckCircle className="h-4 w-4 mr-1" /> Confirm Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Mechanic: Request Parts ── */}
      <Dialog open={materialDialogOpen} onOpenChange={(open) => { setMaterialDialogOpen(open); if (!open) setMaterialError(null); }}>
        <DialogContent data-testid="material-request-dialog" className="max-w-lg">
          <DialogHeader><DialogTitle>Request Spare Parts</DialogTitle></DialogHeader>
          <form onSubmit={handleMechanicPartsRequest} className="space-y-4">
            {materialError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">{materialError}</div>
            )}
            <div className="space-y-2">
              {partsList.map((part, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    className="flex-1"
                    placeholder="Part name"
                    value={part.part_name}
                    onChange={(e) => updatePartRow(idx, 'part_name', e.target.value)}
                    required
                  />
                  <Input
                    type="number"
                    className="w-20"
                    placeholder="Qty"
                    min={1}
                    value={part.quantity}
                    onChange={(e) => updatePartRow(idx, 'quantity', e.target.value)}
                  />
                  <Input
                    type="number"
                    className="w-28"
                    placeholder="₹ Cost"
                    min={0}
                    value={part.estimated_cost}
                    onChange={(e) => updatePartRow(idx, 'estimated_cost', e.target.value)}
                  />
                  {partsList.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 px-2" onClick={() => removePartRow(idx)}>✕</Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPartRow}>+ Add Another Part</Button>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Request</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Manager: Review Parts ── */}
      <Dialog open={reviewPartsDialogOpen} onOpenChange={setReviewPartsDialogOpen}>
        <DialogContent data-testid="review-parts-dialog">
          <DialogHeader><DialogTitle>Review Spare Parts</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">Mechanic has requested the following parts:</div>
            <ul className="space-y-2 border border-border rounded-md p-3">
              {reviewPartsRecord?.spare_parts?.map((p, idx) => {
                const isApproved = p.status === 'approved';
                return (
                  <li key={idx} className="flex justify-between items-center text-sm gap-2">
                    <div>
                      <span className="font-semibold">{p.part_name}</span>
                      <span className="text-muted-foreground ml-1">(Qty: {p.quantity || 1})</span>
                      {p.estimated_cost ? <span className="text-muted-foreground ml-2">₹{p.estimated_cost}</span> : null}
                    </div>
                    {isApproved ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold whitespace-nowrap">✅ Approved</span>
                    ) : (
                      <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2 whitespace-nowrap" onClick={() => handleApproveOnePart(p.part_name)}>
                        Approve
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReviewPartsDialogOpen(false)}>Close</Button>
              {reviewPartsRecord?.spare_parts?.some(p => p.status !== 'approved') && (
                <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={handleApproveParts}>Approve All</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
