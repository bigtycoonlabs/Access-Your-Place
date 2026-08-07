import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/dealflow';
import {
  Save, Loader2, UserCheck, Handshake, FileText, Shield, Eye, EyeOff,
  User, Building, Clock, AlertTriangle
} from 'lucide-react';

interface StaffInternalNotesProps {
  property: Property;
  staffId?: string;
  staffName?: string;
  onUpdate?: (updatedProperty: Partial<Property>) => void;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
}

export function StaffInternalNotes({ property, staffId, staffName, onUpdate }: StaffInternalNotesProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [formData, setFormData] = useState({
    found_by_am_id: property.found_by_am_id ?? '',
    found_by_am_name: property.found_by_am_name ?? '',
    referred_by_partner: property.referred_by_partner ?? '',
    referral_partner_notes: property.referral_partner_notes ?? '',
    staff_internal_notes: property.staff_internal_notes ?? '',
    internal_notes: property.internal_notes ?? '',
  });

  useEffect(() => {
    setFormData({
      found_by_am_id: property.found_by_am_id ?? '',
      found_by_am_name: property.found_by_am_name ?? '',
      referred_by_partner: property.referred_by_partner ?? '',
      referral_partner_notes: property.referral_partner_notes ?? '',
      staff_internal_notes: property.staff_internal_notes ?? '',
      internal_notes: property.internal_notes ?? '',
    });
    setHasChanges(false);
  }, [property.id]);

  useEffect(() => {
    fetchStaffMembers();
  }, []);

  const fetchStaffMembers = async () => {
    setLoadingStaff(true);
    try {
      // Try to get staff from the staff table
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, department')
        .order('first_name');

      if (!error && data) {
        setStaffMembers(data);
      }
    } catch (err) {
      console.log('Could not fetch staff members:', err);
    }
    setLoadingStaff(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAMSelect = (staffMemberId: string) => {
    if (staffMemberId === 'none') {
      setFormData(prev => ({ ...prev, found_by_am_id: '', found_by_am_name: '' }));
    } else if (staffMemberId === 'custom') {
      setFormData(prev => ({ ...prev, found_by_am_id: 'custom' }));
    } else {
      const member = staffMembers.find(s => s.id === staffMemberId);
      if (member) {
        setFormData(prev => ({
          ...prev,
          found_by_am_id: member.id,
          found_by_am_name: `${member.first_name} ${member.last_name}`.trim()
        }));
      }
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        found_by_am_id: formData.found_by_am_id || null,
        found_by_am_name: formData.found_by_am_name || null,
        referred_by_partner: formData.referred_by_partner || null,
        referral_partner_notes: formData.referral_partner_notes || null,
        staff_internal_notes: formData.staff_internal_notes || null,
        internal_notes: formData.internal_notes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', property.id);

      if (error) {
        // Fallback to edge function
        const { data, error: efError } = await supabase.functions.invoke('update-property', {
          body: { id: property.id, ...updateData }
        });
        if (efError || data?.error) throw error;
      }

      toast({
        title: 'Staff notes saved',
        description: 'Internal staff notes have been updated successfully.'
      });
      setHasChanges(false);
      onUpdate?.(updateData);
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err?.message || 'Failed to save staff notes',
        variant: 'destructive'
      });
    }
    setSaving(false);
  };

  const acquisitionManagers = staffMembers.filter(
    s => s.department === 'acquisition_managers' || s.department === 'success_managers'
  );

  return (
    <div className="space-y-6">
      {/* Staff-Only Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <EyeOff className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-amber-800">Staff-Only Information</p>
          <p className="text-xs text-amber-600">
            This information is only visible to staff members and will never be shown to investors or on the marketplace.
          </p>
        </div>
        <Badge className="bg-amber-200 text-amber-800 border-0 ml-auto flex-shrink-0">
          <Shield className="w-3 h-3 mr-1" />
          Internal Only
        </Badge>
      </div>

      {/* Acquisition Manager Attribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Acquisition Manager Attribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              Which Acquisition Manager Found This Property?
            </Label>
            {acquisitionManagers.length > 0 ? (
              <Select
                value={formData.found_by_am_id || 'none'}
                onValueChange={handleAMSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select acquisition manager..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {acquisitionManagers.map(am => (
                    <SelectItem key={am.id} value={am.id}>
                      {am.first_name} {am.last_name} ({am.email})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Other (enter manually)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input aria-label="Enter acquisition manager name"
                  placeholder="Enter acquisition manager name..."
                  value={formData.found_by_am_name}
                  onChange={(e) => handleChange('found_by_am_name', e.target.value)}
                />
                {loadingStaff && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading staff list...
                  </p>
                )}
              </div>
            )}
          </div>

          {formData.found_by_am_id === 'custom' && (
            <div>
              <Label className="mb-1.5" htmlFor="custom-am-name">Custom AM Name</Label>
              <Input id="custom-am-name"
                placeholder="Enter acquisition manager name..."
                value={formData.found_by_am_name}
                onChange={(e) => handleChange('found_by_am_name', e.target.value)}
              />
            </div>
          )}

          {formData.found_by_am_name && formData.found_by_am_id !== 'custom' && formData.found_by_am_id !== 'none' && formData.found_by_am_id && (
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-indigo-800">{formData.found_by_am_name}</p>
                  <p className="text-xs text-indigo-600">Acquisition Manager</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Partner Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Handshake className="w-4 h-4 text-emerald-600" />
            Referral Partner Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5" htmlFor="referred-by-partner-name-company">
              <Building className="w-3.5 h-3.5 text-emerald-500" />
              Referred By (Partner Name / Company)
            </Label>
            <Input id="referred-by-partner-name-company"
              placeholder="e.g., John Smith, ABC Realty, Partner Network..."
              value={formData.referred_by_partner}
              onChange={(e) => handleChange('referred_by_partner', e.target.value)}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5" htmlFor="referral-partner-notes">
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              Referral Partner Notes
            </Label>
            <Textarea id="referral-partner-notes"
              placeholder="Details about the referral arrangement, commission terms, partner contact info, etc."
              value={formData.referral_partner_notes}
              onChange={(e) => handleChange('referral_partner_notes', e.target.value)}
              rows={3}
            />
          </div>

          {formData.referred_by_partner && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2">
                <Handshake className="w-4 h-4 text-emerald-600" />
                <p className="text-sm text-emerald-800">
                  This property was referred by: <strong>{formData.referred_by_partner}</strong>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Staff Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            Staff Internal Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5" htmlFor="internal-notes-staff-only">
              <Shield className="w-3.5 h-3.5 text-gray-500" />
              Internal Notes (Staff Only)
            </Label>
            <Textarea id="internal-notes-staff-only"
              placeholder="Any internal notes about this property that should only be visible to staff..."
              value={formData.staff_internal_notes}
              onChange={(e) => handleChange('staff_internal_notes', e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5" htmlFor="legacy-internal-notes">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              Legacy Internal Notes
            </Label>
            <Textarea id="legacy-internal-notes"
              placeholder="Additional internal notes..."
              value={formData.internal_notes}
              onChange={(e) => handleChange('internal_notes', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">
              This field is for backward compatibility with older notes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated Info */}
      {(property.found_by_am_name || property.referred_by_partner) && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {property.found_by_am_name && (
            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
              <UserCheck className="w-3 h-3" />
              Found by: {property.found_by_am_name}
            </span>
          )}
          {property.referred_by_partner && (
            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
              <Handshake className="w-3 h-3" />
              Referred by: {property.referred_by_partner}
            </span>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Unsaved changes
            </Badge>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save Staff Notes'}
        </Button>
      </div>
    </div>
  );
}
