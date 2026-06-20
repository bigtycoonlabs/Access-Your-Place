import { useState, useEffect, useMemo } from 'react';
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
  DollarSign, TrendingUp, Calendar, Percent, Save, Loader2,
  Sun, Cloud, Home, Calculator, FileText, BarChart3, CheckCircle,
  Building2, Plus, Trash2, Users, Bed, Bath, AlertTriangle, Square
} from 'lucide-react';


interface UnitMixEntry {
  id: string;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  count: number;
  monthly_revenue_per_unit: number;
  notes: string;
}

interface FinancialsEditorProps {
  property: Property;
  onUpdate?: (updatedProperty: Partial<Property>) => void;
}

export function FinancialsEditor({ property, onUpdate }: FinancialsEditorProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [propertyCategory, setPropertyCategory] = useState<'single_family' | 'community'>(
    (property as any).property_category === 'community' ? 'community' : 'single_family'
  );
  const [totalUnits, setTotalUnits] = useState<number>((property as any).total_units || 1);
  const [communityAmenities, setCommunityAmenities] = useState<string>((property as any).community_amenities || '');

  const [unitMix, setUnitMix] = useState<UnitMixEntry[]>(() => {
    const existing = (property as any).unit_mix;
    if (Array.isArray(existing) && existing.length > 0) return existing;
    return [];
  });

  const [formData, setFormData] = useState({
    adr_peak_season: property.adr_peak_season ?? '',
    adr_slow_season: property.adr_slow_season ?? '',
    monthly_room_rate: property.monthly_room_rate ?? '',
    monthly_rent: property.monthly_rent ?? '',
    acquisition_fee: property.acquisition_fee ?? '',
    deposits_concessions_notes: property.deposits_concessions_notes ?? '',
    avg_occupancy_rate: property.avg_occupancy_rate ?? '',
    projected_yearly_revenue: property.projected_yearly_revenue ?? '',
    projected_monthly_revenue_peak: property.projected_monthly_revenue_peak ?? '',
    projected_monthly_revenue_slow: property.projected_monthly_revenue_slow ?? '',
    peak_season_description: property.peak_season_description ?? '',
    asking_price: property.asking_price ?? '',
    sqft: property.sqft ?? '',
  });


  useEffect(() => {
    setFormData({
      adr_peak_season: property.adr_peak_season ?? '',
      adr_slow_season: property.adr_slow_season ?? '',
      monthly_room_rate: property.monthly_room_rate ?? '',
      monthly_rent: property.monthly_rent ?? '',
      acquisition_fee: property.acquisition_fee ?? '',
      deposits_concessions_notes: property.deposits_concessions_notes ?? '',
      avg_occupancy_rate: property.avg_occupancy_rate ?? '',
      projected_yearly_revenue: property.projected_yearly_revenue ?? '',
      projected_monthly_revenue_peak: property.projected_monthly_revenue_peak ?? '',
      projected_monthly_revenue_slow: property.projected_monthly_revenue_slow ?? '',
      peak_season_description: property.peak_season_description ?? '',
      asking_price: property.asking_price ?? '',
      sqft: property.sqft ?? '',
    });
    setPropertyCategory((property as any).property_category === 'community' ? 'community' : 'single_family');
    setTotalUnits((property as any).total_units || 1);
    setCommunityAmenities((property as any).community_amenities || '');
    const existing = (property as any).unit_mix;
    if (Array.isArray(existing) && existing.length > 0) {
      setUnitMix(existing);
    } else {
      setUnitMix([]);
    }
    setHasChanges(false);
  }, [property.id]);


  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addUnitType = () => {
    setUnitMix(prev => [...prev, {
      id: crypto.randomUUID(),
      unit_type: `${prev.length + 1}BR Unit`,
      bedrooms: prev.length + 1,
      bathrooms: 1,
      count: 1,
      monthly_revenue_per_unit: 0,
      notes: ''
    }]);
    setHasChanges(true);
  };

  const updateUnitMix = (id: string, field: keyof UnitMixEntry, value: any) => {
    setUnitMix(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
    setHasChanges(true);
  };

  const removeUnitType = (id: string) => {
    setUnitMix(prev => prev.filter(u => u.id !== id));
    setHasChanges(true);
  };

  // Community revenue calculations
  const communityTotals = useMemo(() => {
    if (propertyCategory !== 'community' || unitMix.length === 0) return null;
    const totalUnitCount = unitMix.reduce((sum, u) => sum + (u.count || 0), 0);
    const totalMonthlyRevenue = unitMix.reduce((sum, u) => sum + ((u.count || 0) * (u.monthly_revenue_per_unit || 0)), 0);
    const totalYearlyRevenue = totalMonthlyRevenue * 12;
    const totalBedrooms = unitMix.reduce((sum, u) => sum + ((u.count || 0) * (u.bedrooms || 0)), 0);
    const totalBathrooms = unitMix.reduce((sum, u) => sum + ((u.count || 0) * (u.bathrooms || 0)), 0);
    return { totalUnitCount, totalMonthlyRevenue, totalYearlyRevenue, totalBedrooms, totalBathrooms };
  }, [unitMix, propertyCategory]);

  const handleSave = async () => {
    // ── Validation: warn about empty/zero key financial projections ──
    const projYearlyVal = parseFloat(String(formData.projected_yearly_revenue)) || 0;
    const monthlyRentVal = parseFloat(String(formData.monthly_rent)) || 0;
    const acqFeeVal = parseFloat(String(formData.acquisition_fee)) || 0;
    const adrPeakVal = parseFloat(String(formData.adr_peak_season)) || 0;

    const missingFields: string[] = [];
    if (projYearlyVal <= 0 && (!communityTotals || communityTotals.totalYearlyRevenue <= 0)) {
      missingFields.push('Projected Yearly Revenue');
    }
    if (monthlyRentVal <= 0) missingFields.push('Monthly Rent');
    if (acqFeeVal <= 0) missingFields.push('Acquisition Fee');
    if (adrPeakVal <= 0) missingFields.push('ADR Peak Season');

    if (missingFields.length > 0) {
      const proceed = window.confirm(
        `The following financial fields are empty or zero:\n\n• ${missingFields.join('\n• ')}\n\nPublishing a deal without these projections may confuse investors. Save anyway?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
        property_category: propertyCategory,
        total_units: propertyCategory === 'community' ? totalUnits : 1,
        unit_mix: propertyCategory === 'community' ? unitMix : [],
        community_amenities: propertyCategory === 'community' ? communityAmenities : null,
      };

      // Convert numeric fields
      const numericFields = [
        'adr_peak_season', 'adr_slow_season', 'monthly_room_rate',
        'monthly_rent', 'acquisition_fee', 'avg_occupancy_rate',
        'projected_yearly_revenue', 'projected_monthly_revenue_peak',
        'projected_monthly_revenue_slow', 'asking_price', 'sqft'
      ];

      for (const field of numericFields) {
        const val = (formData as any)[field];
        if (val === '' || val === null || val === undefined) {
          updateData[field] = null;
        } else {
          const parsed = parseFloat(String(val));
          // Guard against NaN / Infinity reaching the database
          updateData[field] = Number.isNaN(parsed) || !Number.isFinite(parsed) ? null : parsed;
        }
      }


      // Text fields — trim whitespace, send null for empty strings
      updateData.deposits_concessions_notes = formData.deposits_concessions_notes?.trim() || null;
      updateData.peak_season_description = formData.peak_season_description?.trim() || null;



      // If community, auto-calculate totals
      if (propertyCategory === 'community' && communityTotals) {
        updateData.bedrooms = communityTotals.totalBedrooms;
        updateData.bathrooms = communityTotals.totalBathrooms;
        updateData.total_units = communityTotals.totalUnitCount || totalUnits;
        // Auto-fill projected revenue if not manually set
        if (!updateData.projected_yearly_revenue && communityTotals.totalYearlyRevenue > 0) {
          updateData.projected_yearly_revenue = communityTotals.totalYearlyRevenue;
        }
        updateData.projected_revenue_per_unit = unitMix.reduce((acc, u) => {
          acc[u.unit_type] = { count: u.count, revenue: u.monthly_revenue_per_unit, bedrooms: u.bedrooms, bathrooms: u.bathrooms };
          return acc;
        }, {} as Record<string, any>);
      }

      // Try edge function first (v4.0 always returns 200)
      const { data, error } = await supabase.functions.invoke('update-property', {
        body: { id: property.id, ...updateData }
      });

      if (error || (data && !data.success)) {
        // Fallback to direct DB — explicitly include ALL financial fields
        const { error: dbError } = await supabase
          .from('properties')
          .update({
            ...updateData,
            // Explicitly list financial fields to ensure they're never stripped
            adr_peak_season: updateData.adr_peak_season,
            adr_slow_season: updateData.adr_slow_season,
            monthly_room_rate: updateData.monthly_room_rate,
            monthly_rent: updateData.monthly_rent,
            acquisition_fee: updateData.acquisition_fee,
            avg_occupancy_rate: updateData.avg_occupancy_rate,
            projected_yearly_revenue: updateData.projected_yearly_revenue,
            projected_monthly_revenue_peak: updateData.projected_monthly_revenue_peak,
            projected_monthly_revenue_slow: updateData.projected_monthly_revenue_slow,
            deposits_concessions_notes: updateData.deposits_concessions_notes,
            peak_season_description: updateData.peak_season_description,
            asking_price: updateData.asking_price,
            sqft: updateData.sqft,
          })
          .eq('id', property.id);
      }


      // Specific confirmation toast listing saved fields
      const savedFieldsSummary: string[] = [];
      if (updateData.monthly_rent != null) savedFieldsSummary.push(`Rent: $${Number(updateData.monthly_rent).toLocaleString()}`);
      if (updateData.acquisition_fee != null) savedFieldsSummary.push(`Acq Fee: $${Number(updateData.acquisition_fee).toLocaleString()}`);
      if (updateData.projected_yearly_revenue != null) savedFieldsSummary.push(`Yearly Rev: $${Number(updateData.projected_yearly_revenue).toLocaleString()}`);

      toast({
        title: 'Financials saved successfully',
        description: savedFieldsSummary.length > 0
          ? `Updated: ${savedFieldsSummary.join(' | ')}`
          : 'Financial breakdown has been updated successfully.'
      });
      setHasChanges(false);
      onUpdate?.(updateData);
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err?.message || 'Failed to save financial data',
        variant: 'destructive'
      });
    }
    setSaving(false);
  };


  // Calculate derived metrics
  const monthlyRent = parseFloat(String(formData.monthly_rent)) || 0;
  const projYearly = parseFloat(String(formData.projected_yearly_revenue)) || (communityTotals?.totalYearlyRevenue || 0);
  const projMonthlyAvg = projYearly > 0 ? projYearly / 12 : 0;
  const monthlyProfit = projMonthlyAvg - monthlyRent;
  const annualProfit = monthlyProfit * 12;
  const acqFee = parseFloat(String(formData.acquisition_fee)) || 0;
  const roi = acqFee > 0 && annualProfit > 0 ? ((annualProfit / acqFee) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Property Category Toggle */}
      <Card className="border-2 border-indigo-200 bg-indigo-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Property Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              className={`flex-1 p-4 rounded-lg border-2 transition-all text-left ${
                propertyCategory === 'single_family'
                  ? 'border-indigo-500 bg-indigo-100 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => { setPropertyCategory('single_family'); setHasChanges(true); }}
            >
              <div className="flex items-center gap-3">
                <Home className={`w-6 h-6 ${propertyCategory === 'single_family' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div>
                  <p className="font-semibold text-sm">Single-Family Home</p>
                  <p className="text-xs text-gray-500">Individual property with one unit</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              className={`flex-1 p-4 rounded-lg border-2 transition-all text-left ${
                propertyCategory === 'community'
                  ? 'border-indigo-500 bg-indigo-100 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => { setPropertyCategory('community'); setHasChanges(true); }}
            >
              <div className="flex items-center gap-3">
                <Building2 className={`w-6 h-6 ${propertyCategory === 'community' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div>
                  <p className="font-semibold text-sm">Apartment Community</p>
                  <p className="text-xs text-gray-500">Multi-unit with different floor plans</p>
                </div>
              </div>
            </button>
          </div>

          {propertyCategory === 'community' && (
            <div className="space-y-4 mt-4 pt-4 border-t border-indigo-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    Total Units in Community
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g., 24"
                    value={totalUnits}
                    onChange={(e) => { setTotalUnits(parseInt(e.target.value) || 1); setHasChanges(true); }}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    Community Amenities
                  </Label>
                  <Input
                    placeholder="e.g., Pool, Gym, Clubhouse, Laundry"
                    value={communityAmenities}
                    onChange={(e) => { setCommunityAmenities(e.target.value); setHasChanges(true); }}
                  />
                </div>
              </div>

              {/* Unit Mix Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="flex items-center gap-1.5 text-base font-semibold">
                    <Bed className="w-4 h-4 text-indigo-600" />
                    Unit Mix Breakdown
                  </Label>
                  <Button size="sm" variant="outline" onClick={addUnitType} className="text-indigo-600 border-indigo-300 hover:bg-indigo-50">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Unit Type
                  </Button>
                </div>

                {unitMix.length === 0 ? (
                  <div className="text-center py-6 bg-white rounded-lg border border-dashed border-indigo-300">
                    <Building2 className="w-8 h-8 mx-auto text-indigo-300 mb-2" />
                    <p className="text-sm text-gray-500">No unit types defined yet</p>
                    <Button size="sm" variant="ghost" onClick={addUnitType} className="mt-2 text-indigo-600">
                      <Plus className="w-4 h-4 mr-1" />
                      Add your first unit type
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unitMix.map((unit, idx) => (
                      <div key={unit.id} className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className="text-indigo-600 border-indigo-300">
                            Unit Type {idx + 1}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeUnitType(unit.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <Label className="text-xs text-gray-500">Unit Name</Label>
                            <Input
                              placeholder="e.g., 2BR/1BA"
                              value={unit.unit_type}
                              onChange={(e) => updateUnitMix(unit.id, 'unit_type', e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500 flex items-center gap-1">
                              <Bed className="w-3 h-3" /> Bedrooms
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={unit.bedrooms}
                              onChange={(e) => updateUnitMix(unit.id, 'bedrooms', parseInt(e.target.value) || 0)}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500 flex items-center gap-1">
                              <Bath className="w-3 h-3" /> Bathrooms
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={unit.bathrooms}
                              onChange={(e) => updateUnitMix(unit.id, 'bathrooms', parseFloat(e.target.value) || 0)}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500 flex items-center gap-1">
                              <Users className="w-3 h-3" /> # of Units
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              value={unit.count}
                              onChange={(e) => updateUnitMix(unit.id, 'count', parseInt(e.target.value) || 1)}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" /> Revenue/Unit/Mo
                            </Label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                value={unit.monthly_revenue_per_unit || ''}
                                onChange={(e) => updateUnitMix(unit.id, 'monthly_revenue_per_unit', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm pl-5"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-gray-400">
                            Subtotal: {unit.count} units × ${(unit.monthly_revenue_per_unit || 0).toLocaleString()}/mo
                          </span>
                          <span className="font-semibold text-indigo-700">
                            = ${((unit.count || 0) * (unit.monthly_revenue_per_unit || 0)).toLocaleString()}/mo
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Community Totals Summary */}
                    {communityTotals && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4">
                        <h4 className="font-semibold text-indigo-800 text-sm mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Community Revenue Summary
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-indigo-600">Total Units</p>
                            <p className="font-bold text-indigo-900">{communityTotals.totalUnitCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-indigo-600">Total Bedrooms</p>
                            <p className="font-bold text-indigo-900">{communityTotals.totalBedrooms}</p>
                          </div>
                          <div>
                            <p className="text-xs text-indigo-600">Total Bathrooms</p>
                            <p className="font-bold text-indigo-900">{communityTotals.totalBathrooms}</p>
                          </div>
                          <div>
                            <p className="text-xs text-indigo-600">Monthly Revenue</p>
                            <p className="font-bold text-emerald-700">${communityTotals.totalMonthlyRevenue.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-indigo-600">Yearly Revenue</p>
                            <p className="font-bold text-emerald-700">${communityTotals.totalYearlyRevenue.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
          <p className="text-xs text-emerald-600 font-medium">Projected Monthly Avg</p>
          <p className="text-lg font-bold text-emerald-800">
            ${projMonthlyAvg > 0 ? Math.round(projMonthlyAvg).toLocaleString() : '—'}
          </p>
        </div>
        <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-medium">Monthly Profit</p>
          <p className={`text-lg font-bold ${monthlyProfit >= 0 ? 'text-blue-800' : 'text-red-600'}`}>
            {monthlyProfit !== 0 ? `$${Math.round(monthlyProfit).toLocaleString()}` : '—'}
          </p>
        </div>
        <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
          <p className="text-xs text-purple-600 font-medium">Annual Profit</p>
          <p className={`text-lg font-bold ${annualProfit >= 0 ? 'text-purple-800' : 'text-red-600'}`}>
            {annualProfit !== 0 ? `$${Math.round(annualProfit).toLocaleString()}` : '—'}
          </p>
        </div>
        <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-600 font-medium">ROI on Acq Fee</p>
          <p className={`text-lg font-bold ${roi >= 0 ? 'text-amber-800' : 'text-red-600'}`}>
            {roi > 0 ? `${roi.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Rate Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            Rate Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Average Daily Rate - Peak Season
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 150.00"
                  value={formData.adr_peak_season}
                  onChange={(e) => handleChange('adr_peak_season', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                Average Daily Rate - Slow Season
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 95.00"
                  value={formData.adr_slow_season}
                  onChange={(e) => handleChange('adr_slow_season', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Home className="w-3.5 h-3.5 text-indigo-500" />
                Monthly Room Rate (if applicable)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 800.00"
                  value={formData.monthly_room_rate}
                  onChange={(e) => handleChange('monthly_room_rate', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Percent className="w-3.5 h-3.5 text-teal-500" />
                Average Occupancy Rate (%)
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g., 75"
                  value={formData.avg_occupancy_rate}
                  onChange={(e) => handleChange('avg_occupancy_rate', e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Costs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-red-500" />
            Property Costs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Home className="w-3.5 h-3.5 text-gray-500" />
                Monthly Rent for Property
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 2000.00"
                  value={formData.monthly_rent}
                  onChange={(e) => handleChange('monthly_rent', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                Acquisition Fee
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 2500.00"
                  value={formData.acquisition_fee}
                  onChange={(e) => handleChange('acquisition_fee', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              Deposits, Concessions & Special Notes
            </Label>
            <Textarea
              placeholder="e.g., $500 deposit, first month free, pet deposit $300, community amenities include pool and gym..."
              value={formData.deposits_concessions_notes}
              onChange={(e) => handleChange('deposits_concessions_notes', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Revenue Projections */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            Revenue Projections
            {propertyCategory === 'community' && communityTotals && communityTotals.totalYearlyRevenue > 0 && (
              <Badge variant="outline" className="text-indigo-600 border-indigo-300 bg-indigo-50 text-xs ml-2">
                Auto-calculated from unit mix
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {propertyCategory === 'community' && communityTotals && communityTotals.totalYearlyRevenue > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Revenue fields below will be auto-filled from your unit mix breakdown if left empty. Override by entering values manually.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                Projected Yearly Revenue
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={communityTotals?.totalYearlyRevenue ? `Auto: $${communityTotals.totalYearlyRevenue.toLocaleString()}` : 'e.g., 48000.00'}
                  value={formData.projected_yearly_revenue}
                  onChange={(e) => handleChange('projected_yearly_revenue', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Projected Monthly Revenue - Peak
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 5500.00"
                  value={formData.projected_monthly_revenue_peak}
                  onChange={(e) => handleChange('projected_monthly_revenue_peak', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                Projected Monthly Revenue - Slow
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 3000.00"
                  value={formData.projected_monthly_revenue_slow}
                  onChange={(e) => handleChange('projected_monthly_revenue_slow', e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              Peak Season Description
            </Label>
            <Input
              placeholder="e.g., May through September, holidays, spring break..."
              value={formData.peak_season_description}
              onChange={(e) => handleChange('peak_season_description', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

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
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save Financials'}
        </Button>
      </div>
    </div>
  );
}
