import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, MapPin, MapPinOff, CheckCircle, RefreshCw,
  Search, Save, Bed, Bath, DollarSign, Building2, ChevronDown, ChevronUp
} from 'lucide-react';

interface PropertyWithPendingAddress {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  listing_title: string | null;
  property_type: string;
  status: string;
  address_needs_update: boolean;
  photos: string[] | null;
  created_at: string;
  updated_at: string;
}

interface AddressCorrectionToolProps {
  staffId?: string;
  staffName?: string;
}

export function AddressCorrectionTool({ staffId, staffName }: AddressCorrectionToolProps) {
  const [properties, setProperties] = useState<PropertyWithPendingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ address: '', city: '', state: '', zip_code: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingAddresses();
  }, []);

  const fetchPendingAddresses = async () => {
    setLoading(true);
    try {
      // Fetch properties with address_needs_update = true OR placeholder-style addresses
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, city, state, zip_code, bedrooms, bathrooms, monthly_rent, listing_title, property_type, status, address_needs_update, photos, created_at, updated_at')
        .or('address_needs_update.eq.true,address.eq.(Address pending),address.is.null')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (err: any) {
      console.error('Failed to fetch properties needing address correction:', err);
      toast({
        title: 'Failed to load properties',
        description: err?.message || 'Unknown error',
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  const startEditing = (property: PropertyWithPendingAddress) => {
    setEditingId(property.id);
    setEditForm({
      address: property.address === '(Address pending)' ? '' : property.address || '',
      city: property.city === 'Unknown' ? '' : property.city || '',
      state: property.state === 'XX' ? '' : property.state || '',
      zip_code: property.zip_code || ''
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ address: '', city: '', state: '', zip_code: '' });
  };

  const saveAddress = async (propertyId: string) => {
    if (!editForm.address.trim()) {
      toast({
        title: 'Address required',
        description: 'Please enter a street address.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          address: editForm.address.trim(),
          city: editForm.city.trim() || undefined,
          state: editForm.state.trim() || undefined,
          zip_code: editForm.zip_code.trim() || undefined,
          address_needs_update: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', propertyId);

      if (error) throw error;

      // Log activity
      try {
        await supabase.from('deal_activity_log').insert({
          property_id: propertyId,
          activity_type: 'address_corrected',
          description: `Address updated to: ${editForm.address.trim()}, ${editForm.city.trim()}, ${editForm.state.trim()} ${editForm.zip_code.trim()}`,
          performer_name: staffName || 'Staff',
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error logging activity:', e);
      }

      toast({
        title: 'Address updated',
        description: `Property address updated to "${editForm.address.trim()}"`,
      });

      // Remove from list
      setProperties(prev => prev.filter(p => p.id !== propertyId));
      setEditingId(null);
      setEditForm({ address: '', city: '', state: '', zip_code: '' });
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err?.message || 'Failed to update address',
        variant: 'destructive'
      });
    }
    setSaving(false);
  };

  const bulkDismiss = async () => {
    if (properties.length === 0) return;
    
    const confirmed = window.confirm(
      `Mark all ${properties.length} properties as having correct addresses? This will clear the "address needs update" flag.`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const ids = properties.map(p => p.id);
      const { error } = await supabase
        .from('properties')
        .update({ address_needs_update: false, updated_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;

      toast({
        title: 'All flags cleared',
        description: `${ids.length} properties marked as having correct addresses.`,
      });
      setProperties([]);
    } catch (err: any) {
      toast({
        title: 'Bulk update failed',
        description: err?.message || 'Failed to clear flags',
        variant: 'destructive'
      });
    }
    setSaving(false);
  };

  const filtered = properties.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.listing_title || '').toLowerCase().includes(term) ||
      (p.address || '').toLowerCase().includes(term) ||
      (p.city || '').toLowerCase().includes(term) ||
      (p.state || '').toLowerCase().includes(term) ||
      (p.zip_code || '').toLowerCase().includes(term)
    );
  });

  const typeLabels: Record<string, string> = {
    apartment: 'Apartment',
    private_landlord: 'Private',
    townhome: 'Townhome',
    single_family: 'SFH',
    condo: 'Condo',
    multi_family: 'Multi-Family'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPinOff className="w-5 h-5 text-orange-500" />
              Address Correction Tool
            </CardTitle>
            <CardDescription>
              Properties with placeholder or missing addresses that need correction.
              {properties.length > 0 && (
                <Badge className="ml-2 bg-orange-100 text-orange-700 border-orange-200">
                  {properties.length} pending
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {properties.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={bulkDismiss}
                disabled={saving}
                className="text-gray-500"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Dismiss All
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchPendingAddresses} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        {properties.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by title, city, state, or zip..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Stats */}
        {properties.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
              <p className="text-2xl font-bold text-orange-700">{properties.length}</p>
              <p className="text-xs text-orange-600">Need Address</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-2xl font-bold text-gray-700">
                {properties.filter(p => p.address === '(Address pending)' || !p.address).length}
              </p>
              <p className="text-xs text-gray-500">No Address</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {properties.filter(p => p.address && p.address !== '(Address pending)').length}
              </p>
              <p className="text-xs text-blue-600">Placeholder</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" />
            <p className="text-gray-500 mb-2 font-medium">
              {properties.length === 0
                ? 'All property addresses are up to date!'
                : 'No properties match your search.'}
            </p>
            <p className="text-sm text-gray-400">
              {properties.length === 0
                ? 'No properties currently need address correction.'
                : 'Try adjusting your search term.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((property) => {
              const isEditing = editingId === property.id;
              const isExpanded = expandedId === property.id;
              const hasNoAddress = !property.address || property.address === '(Address pending)';

              return (
                <div
                  key={property.id}
                  className={`border rounded-lg transition-all ${
                    isEditing ? 'ring-2 ring-orange-400 border-orange-300 bg-orange-50/30' : 'bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Photo thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                        {property.photos && property.photos.length > 0 ? (
                          <img
                            src={property.photos[0]}
                            alt={property.listing_title || 'Property'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800 truncate">
                            {property.listing_title || `${property.bedrooms}BR in ${property.city}`}
                          </h3>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {typeLabels[property.property_type] || property.property_type}
                          </Badge>
                          <Badge className={`shrink-0 text-xs ${hasNoAddress ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {hasNoAddress ? 'No Address' : 'Placeholder'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1 text-sm text-orange-600 mb-1">
                          <MapPinOff className="w-3 h-3" />
                          <span className="font-medium">{property.address || '(No address)'}</span>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {property.city}, {property.state} {property.zip_code}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bed className="w-3 h-3" /> {property.bedrooms} bed
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="w-3 h-3" /> {property.bathrooms} bath
                          </span>
                          {property.monthly_rent && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <DollarSign className="w-3 h-3" /> {property.monthly_rent.toLocaleString()}/mo
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {!isEditing ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                              onClick={() => startEditing(property)}
                            >
                              <MapPin className="w-4 h-4 mr-1" /> Fix Address
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400"
                              onClick={() => setExpandedId(isExpanded ? null : property.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => saveAddress(property.id)}
                              disabled={saving}
                            >
                              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Edit Form */}
                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-orange-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="md:col-span-2">
                            <Label htmlFor={`address-${property.id}`} className="text-xs font-medium text-gray-700">
                              Street Address *
                            </Label>
                            <Input
                              id={`address-${property.id}`}
                              placeholder="123 Main St, Apt 4B"
                              value={editForm.address}
                              onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                              className="mt-1"
                              autoFocus
                            />
                          </div>
                          <div>
                            <Label htmlFor={`city-${property.id}`} className="text-xs font-medium text-gray-700">
                              City
                            </Label>
                            <Input
                              id={`city-${property.id}`}
                              placeholder="City"
                              value={editForm.city}
                              onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor={`state-${property.id}`} className="text-xs font-medium text-gray-700">
                                State
                              </Label>
                              <Input
                                id={`state-${property.id}`}
                                placeholder="ST"
                                value={editForm.state}
                                onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                                className="mt-1"
                                maxLength={2}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`zip-${property.id}`} className="text-xs font-medium text-gray-700">
                                ZIP
                              </Label>
                              <Input
                                id={`zip-${property.id}`}
                                placeholder="12345"
                                value={editForm.zip_code}
                                onChange={(e) => setEditForm(prev => ({ ...prev, zip_code: e.target.value }))}
                                className="mt-1"
                                maxLength={10}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isExpanded && !isEditing && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-medium">Property ID:</span> {property.id.slice(0, 8)}...
                          </div>
                          <div>
                            <span className="font-medium">Status:</span> {property.status}
                          </div>
                          <div>
                            <span className="font-medium">Created:</span> {new Date(property.created_at).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-medium">Updated:</span> {new Date(property.updated_at).toLocaleDateString()}
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
      </CardContent>
    </Card>
  );
}
