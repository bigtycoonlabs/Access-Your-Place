import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Building, Plus, MapPin, Home, CheckCircle, Clock, X, AlertCircle, Globe, Upload, FileText, Loader2, Trash2 } from 'lucide-react';

interface LandlordProperty {
  id: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  unit_count?: number;
  community_name?: string;
  community_website?: string;
  submission_status?: string;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  photos?: string[];
  submission_notes?: string;
  created_at: string;
  application_handling?: string;
  corporate_app_pdf_url?: string;
  corporate_app_pdf_filename?: string;
  corporate_app_requirements_note?: string;
}

interface Props {
  landlordId: string;
}

export default function LandlordPortalProperties({ landlordId }: Props) {
  const [properties, setProperties] = useState<LandlordProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [savingHandling, setSavingHandling] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState<string | null>(null);
  const [requirementsNote, setRequirementsNote] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const [form, setForm] = useState({
    address: '', city: '', state: '', zip_code: '', unit_count: '1',
    community_name: '', community_website: '', submission_notes: ''
  });

  useEffect(() => { fetchProperties(); }, [landlordId]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'get_landlord_properties', landlord_id: landlordId }
      });
      if (data?.properties) {
        setProperties(data.properties);
        const notes: Record<string, string> = {};
        data.properties.forEach((p: LandlordProperty) => {
          if (p.corporate_app_requirements_note) notes[p.id] = p.corporate_app_requirements_note;
        });
        setRequirementsNote(notes);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address) { toast({ title: 'Error', description: 'Address is required', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'submit_property', landlord_id: landlordId,
          address: form.address, city: form.city, state: form.state, zip_code: form.zip_code,
          unit_count: parseInt(form.unit_count) || 1, community_name: form.community_name,
          community_website: form.community_website, submission_notes: form.submission_notes
        }
      });
      if (data?.success) {
        toast({ title: 'Property Submitted', description: 'Your property is now pending analysis by our team.' });
        setShowAddForm(false);
        setForm({ address: '', city: '', state: '', zip_code: '', unit_count: '1', community_name: '', community_website: '', submission_notes: '' });
        fetchProperties();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to submit property', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleToggleApplicationHandling = async (propertyId: string, newHandling: string) => {
    setSavingHandling(propertyId);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'update_property_application_handling',
          property_id: propertyId,
          landlord_id: landlordId,
          application_handling: newHandling
        }
      });
      if (data?.success && data?.property) {
        setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, ...data.property } : p));
        toast({ title: 'Updated', description: newHandling === 'ayp_team' ? 'Our Success Team will handle the corporate application process.' : 'You will handle the corporate application process for this property.' });
        if (newHandling === 'landlord_handles') setExpandedProperty(propertyId);
      } else {
        toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update setting', variant: 'destructive' });
    }
    setSavingHandling(null);
  };

  const handleUploadPdf = async (propertyId: string, file: File) => {
    setUploadingPdf(propertyId);
    try {
      const filePath = `landlord-apps/${landlordId}/${propertyId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('seller-documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('seller-documents').getPublicUrl(filePath);
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'save_corporate_app_pdf', property_id: propertyId, landlord_id: landlordId, pdf_url: urlData.publicUrl, pdf_filename: file.name }
      });
      if (data?.success && data?.property) {
        setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, ...data.property } : p));
        toast({ title: 'PDF Uploaded', description: 'Corporate application PDF has been saved.' });
      }
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message || 'Failed to upload PDF', variant: 'destructive' });
    }
    setUploadingPdf(null);
  };

  const handleRemovePdf = async (propertyId: string) => {
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'remove_corporate_app_pdf', property_id: propertyId, landlord_id: landlordId }
      });
      if (data?.success) {
        setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, corporate_app_pdf_url: undefined, corporate_app_pdf_filename: undefined } : p));
        toast({ title: 'PDF Removed' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to remove PDF', variant: 'destructive' });
    }
  };

  const handleSaveRequirementsNote = async (propertyId: string) => {
    setSavingHandling(propertyId);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'update_property_application_handling',
          property_id: propertyId,
          landlord_id: landlordId,
          application_handling: 'landlord_handles',
          corporate_app_requirements_note: requirementsNote[propertyId] || ''
        }
      });
      if (data?.success) {
        setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, corporate_app_requirements_note: requirementsNote[propertyId] } : p));
        toast({ title: 'Requirements Saved', description: 'Your application requirements note has been saved.' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save note', variant: 'destructive' });
    }
    setSavingHandling(null);
  };

  const getStatusBadge = (status?: string) => {
    const config: Record<string, { bg: string; icon: any; label: string }> = {
      pending_analysis: { bg: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Pending Analysis' },
      under_review: { bg: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Under Review' },
      approved: { bg: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
      active_inventory: { bg: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Active Inventory' },
      rejected: { bg: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Not Approved' },
    };
    const c = config[status || ''] || config.pending_analysis;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${c.bg}`}>
        <Icon className="w-3.5 h-3.5" /> {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#1a2332]">My Properties</h3>
          <p className="text-sm text-gray-500">Submit properties for analysis and manage application settings</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-[#d4a574] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#c49564] transition-colors flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Property
        </button>
      </div>

      {/* Add Property Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-[#1a2332]">Add New Property</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="community-property-name">Community/Property Name</label>
                <input id="community-property-name" type="text" value={form.community_name} onChange={e => setForm({...form, community_name: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" placeholder="e.g., Sunset Ridge Apartments" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="address">Address *</label>
                <input id="address" type="text" required value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="city">City</label>
                  <input id="city" type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="state">State</label>
                  <input id="state" type="text" value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="zip">Zip</label>
                  <input id="zip" type="text" value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unit-count">Unit Count</label>
                  <input id="unit-count" type="number" min="1" value={form.unit_count} onChange={e => setForm({...form, unit_count: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="community-website">Community Website</label>
                  <input id="community-website" type="url" value={form.community_website} onChange={e => setForm({...form, community_website: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">Notes</label>
                <textarea id="notes" rows={3} value={form.submission_notes} onChange={e => setForm({...form, submission_notes: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" placeholder="Any additional details about the property..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#d4a574] text-white py-2.5 rounded-lg font-medium hover:bg-[#c49564] transition-colors disabled:opacity-50 text-sm">
                  {submitting ? 'Submitting...' : 'Submit Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Properties List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="bg-white rounded-xl border p-6 animate-pulse"><div className="h-5 bg-gray-200 rounded w-1/3 mb-3" /><div className="h-4 bg-gray-100 rounded w-1/2" /></div>)}
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Properties Yet</h3>
          <p className="text-gray-400 mb-4">Add your first property to get started with corporate leasing.</p>
          <button onClick={() => setShowAddForm(true)} className="bg-[#d4a574] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#c49564] transition-colors inline-flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Property
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map(prop => {
            const isLandlordHandles = prop.application_handling === 'landlord_handles';
            const isExpanded = expandedProperty === prop.id;
            const isSaving = savingHandling === prop.id;

            return (
              <div key={prop.id} className="bg-white rounded-xl border border-gray-200 hover:border-[#d4a574]/30 transition-all">
                {/* Property Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[#1a2332]/5 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Home className="w-6 h-6 text-[#1a2332]" />
                      </div>
                      <div>
                        {prop.community_name && <h4 className="font-semibold text-[#1a2332] text-lg">{prop.community_name}</h4>}
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {prop.address}{prop.city ? `, ${prop.city}` : ''}{prop.state ? `, ${prop.state}` : ''} {prop.zip_code || ''}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          {prop.unit_count && <span>{prop.unit_count} unit{prop.unit_count > 1 ? 's' : ''}</span>}
                          {prop.community_website && (
                            <a href={prop.community_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#d4a574] hover:underline">
                              <Globe className="w-3.5 h-3.5" /> Website
                            </a>
                          )}
                          <span className="text-gray-400">Added {new Date(prop.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(prop.submission_status)}
                      {prop.rejection_reason && (
                        <p className="text-xs text-red-500 mt-2 max-w-[200px]">{prop.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Corporate Application Handling Section */}
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 rounded-b-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h5 className="text-sm font-semibold text-[#1a2332]">Corporate Application Process</h5>
                      <p className="text-xs text-gray-500 mt-0.5">Who handles the corporate application and master lease generation?</p>
                    </div>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin text-[#d4a574]" />}
                  </div>

                  {/* Toggle Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleToggleApplicationHandling(prop.id, 'ayp_team')}
                      disabled={isSaving}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        !isLandlordHandles
                          ? 'border-[#d4a574] bg-[#d4a574]/5 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {!isLandlordHandles && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-[#d4a574] rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isLandlordHandles ? 'bg-[#d4a574]/20' : 'bg-gray-100'}`}>
                          <CheckCircle className={`w-4 h-4 ${!isLandlordHandles ? 'text-[#d4a574]' : 'text-gray-400'}`} />
                        </div>
                        <span className={`text-sm font-semibold ${!isLandlordHandles ? 'text-[#1a2332]' : 'text-gray-600'}`}>
                          Our Success Team Handles
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 ml-10">
                        We manage the corporate application and master lease generation process on your behalf.
                      </p>
                    </button>

                    <button
                      onClick={() => handleToggleApplicationHandling(prop.id, 'landlord_handles')}
                      disabled={isSaving}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        isLandlordHandles
                          ? 'border-[#d4a574] bg-[#d4a574]/5 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {isLandlordHandles && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-[#d4a574] rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLandlordHandles ? 'bg-[#d4a574]/20' : 'bg-gray-100'}`}>
                          <Building className={`w-4 h-4 ${isLandlordHandles ? 'text-[#d4a574]' : 'text-gray-400'}`} />
                        </div>
                        <span className={`text-sm font-semibold ${isLandlordHandles ? 'text-[#1a2332]' : 'text-gray-600'}`}>
                          Landlord / Community Handles
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 ml-10">
                        You provide the corporate application PDF or requirements for our clients to complete.
                      </p>
                    </button>
                  </div>

                  {/* Landlord Handles - Expanded Section */}
                  {isLandlordHandles && (
                    <div className="mt-4 p-4 bg-white rounded-xl border border-[#d4a574]/20 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h6 className="text-sm font-semibold text-[#1a2332]">Corporate Application PDF</h6>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Upload the corporate application PDF that our Success Team will share with clients to fill out. The completed application will be returned to you.
                          </p>

                          {prop.corporate_app_pdf_url ? (
                            <div className="mt-3 flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                              <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-green-800 truncate">{prop.corporate_app_pdf_filename || 'corporate_application.pdf'}</p>
                                <a href={prop.corporate_app_pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">View PDF</a>
                              </div>
                              <button onClick={() => handleRemovePdf(prop.id)} className="text-red-400 hover:text-red-600 p-1" title="Remove PDF">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#d4a574] hover:bg-[#d4a574]/5 transition-all">
                                {uploadingPdf === prop.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-[#d4a574]" />
                                ) : (
                                  <Upload className="w-5 h-5 text-gray-400" />
                                )}
                                <span className="text-sm text-gray-600">
                                  {uploadingPdf === prop.id ? 'Uploading...' : 'Click to upload corporate application PDF'}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  disabled={uploadingPdf === prop.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadPdf(prop.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Requirements Note - shown when no PDF uploaded */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h6 className="text-sm font-semibold text-[#1a2332]">
                            {prop.corporate_app_pdf_url ? 'Additional Requirements (Optional)' : 'No PDF? Provide Application Requirements'}
                          </h6>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {prop.corporate_app_pdf_url
                              ? 'Add any additional notes or instructions for the corporate applicant.'
                              : 'If you don\'t have a corporate application PDF, describe what information you need from the corporate company applying for this location.'}
                          </p>
                          <textarea
                            rows={3}
                            value={requirementsNote[prop.id] || ''}
                            onChange={(e) => setRequirementsNote(prev => ({ ...prev, [prop.id]: e.target.value }))}
                            className="w-full mt-2 px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
                            placeholder={prop.corporate_app_pdf_url
                              ? 'e.g., Please also include proof of insurance and business license...'
                              : 'e.g., We need the company name, EIN, proof of insurance, 2 years of financials, and a letter of intent...'}
                          />
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => handleSaveRequirementsNote(prop.id)}
                              disabled={isSaving}
                              className="bg-[#d4a574] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#c49564] transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                              Save Requirements
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
