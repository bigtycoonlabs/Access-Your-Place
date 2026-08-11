import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Loader2, DollarSign, Percent, TrendingUp, BarChart3, Save, X, Home, AlertTriangle, Square, Calendar, FileText
} from 'lucide-react';

/**

 * Safely coerce a number to a DB-safe value.
 * Returns `null` for undefined/NaN/Infinity, preserves `0` as a valid number.
 * All financial columns on the properties table are NULLABLE (added via ALTER TABLE).
 */
function safeNum(value: number | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  return Number.isNaN(value) || !Number.isFinite(value) ? null : value;
}



interface FinancialData {
  monthly_rent?: number;
  acquisition_fee?: number;
  avg_occupancy_rate?: number;
  adr_peak_season?: number;
  adr_slow_season?: number;
  monthly_room_rate?: number;
  projected_yearly_revenue?: number;
  projected_monthly_revenue_peak?: number;
  projected_monthly_revenue_slow?: number;
  sqft?: number;
  peak_season_description?: string;
  deposits_concessions_notes?: string;
}

interface InlineFinancialEditorProps {
  property: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId?: string;
  staffName?: string;
  onSaved: () => void;
}

export function InlineFinancialEditor({ property, open, onOpenChange, staffId, staffName, onSaved }: InlineFinancialEditorProps) {
  const [form, setForm] = useState<FinancialData>({});
  const [saving, setSaving] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const { toast } = useToast();

  // Re-initialize form when property changes
  useEffect(() => {
    if (property) {
      setForm({
        monthly_rent: property.monthly_rent || 0,
        acquisition_fee: property.acquisition_fee || 0,
        avg_occupancy_rate: property.avg_occupancy_rate || 0,
        adr_peak_season: property.adr_peak_season || 0,
        adr_slow_season: property.adr_slow_season || 0,
        monthly_room_rate: property.monthly_room_rate || 0,
        projected_yearly_revenue: property.projected_yearly_revenue || 0,
        projected_monthly_revenue_peak: property.projected_monthly_revenue_peak || 0,
        projected_monthly_revenue_slow: property.projected_monthly_revenue_slow || 0,
        sqft: property.sqft || 0,
        peak_season_description: property.peak_season_description || '',
        deposits_concessions_notes: property.deposits_concessions_notes || '',
      });
      setValidationWarnings([]);
    }
  }, [property]);

  // Live validation warnings
  useEffect(() => {
    const warnings: string[] = [];
    if (!form.monthly_rent || form.monthly_rent <= 0) warnings.push('Monthly Rent is empty');
    if (!form.acquisition_fee || form.acquisition_fee <= 0) warnings.push('Acquisition Fee is empty');
    if (!form.projected_yearly_revenue || form.projected_yearly_revenue <= 0) warnings.push('Projected Yearly Revenue is empty');
    if (!form.adr_peak_season || form.adr_peak_season <= 0) warnings.push('ADR Peak Season is empty');
    setValidationWarnings(warnings);
  }, [form]);

  const calcMonthlyRevenue = () => {
    const adr = form.adr_peak_season || 0;
    const occ = (form.avg_occupancy_rate || 0) / 100;
    return Math.round(adr * occ * 30);
  };

  const calcNetMonthly = () => calcMonthlyRevenue() - (form.monthly_rent || 0);

  const handleSave = async () => {
    if (!property) return;

    // Validation: warn about empty/zero key financial projections
    if (validationWarnings.length > 0) {
      const proceed = window.confirm(
        `The following financial fields are empty or zero:\n\n• ${validationWarnings.join('\n• ')}\n\nPublishing a deal without these projections may confuse investors. Save anyway?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    try {
      // Explicitly build the financial update payload.

      // Use safeNum() instead of `|| null` so that explicit 0 values are
      // preserved (e.g. $0 acquisition fee) rather than silently converted to null.
      const financialPayload: Record<string, any> = {
        monthly_rent: safeNum(form.monthly_rent),
        acquisition_fee: safeNum(form.acquisition_fee),
        avg_occupancy_rate: safeNum(form.avg_occupancy_rate),
        adr_peak_season: safeNum(form.adr_peak_season),
        adr_slow_season: safeNum(form.adr_slow_season),
        monthly_room_rate: safeNum(form.monthly_room_rate),
        projected_yearly_revenue: safeNum(form.projected_yearly_revenue),
        projected_monthly_revenue_peak: safeNum(form.projected_monthly_revenue_peak),
        projected_monthly_revenue_slow: safeNum(form.projected_monthly_revenue_slow),
        sqft: safeNum(form.sqft),
        peak_season_description: form.peak_season_description?.trim() || null,
        deposits_concessions_notes: form.deposits_concessions_notes?.trim() || null,
      };


      const { data, error } = await supabase.functions.invoke('update-property', {
        body: {
          id: property.id,
          ...financialPayload,
          updated_by_staff_id: staffId,
          updated_by_staff_name: staffName
        }
      });
      if (error || data?.error) {
        // Fallback to direct DB — explicitly include ALL financial fields
        const { error: dbError } = await supabase.from('properties').update({
          ...financialPayload,
          updated_at: new Date().toISOString()
        }).eq('id', property.id);
        if (dbError) throw dbError;
      }

      // Specific confirmation toast listing saved fields
      const savedSummary: string[] = [];
      if (financialPayload.monthly_rent) savedSummary.push(`Rent: $${financialPayload.monthly_rent.toLocaleString()}`);
      if (financialPayload.acquisition_fee) savedSummary.push(`Acq Fee: $${financialPayload.acquisition_fee.toLocaleString()}`);
      if (financialPayload.projected_yearly_revenue) savedSummary.push(`Yearly Rev: $${financialPayload.projected_yearly_revenue.toLocaleString()}`);

      toast({
        title: 'Financials Saved Successfully',
        description: savedSummary.length > 0
          ? `${property.listing_title || property.address}: ${savedSummary.join(' | ')}`
          : `Financial details for "${property.listing_title || property.address}" have been saved.`
      });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message || 'Could not update financials', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Edit Financial Details
          </DialogTitle>
          <DialogDescription>
            {property.listing_title || property.address} — {property.city}, {property.state}
          </DialogDescription>
        </DialogHeader>

        {/* Validation Warnings Banner */}
        {validationWarnings.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Missing financial projections:</p>
              <p className="text-xs text-amber-700 mt-0.5">{validationWarnings.join(' · ')}</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-green-600" />
                <span className="text-[10px] text-green-700 font-medium">Est. Monthly Rev</span>
              </div>
              <p className="text-lg font-bold text-green-800">${calcMonthlyRevenue().toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1 mb-1">
                <Home className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] text-blue-700 font-medium">Monthly Rent</span>
              </div>
              <p className="text-lg font-bold text-blue-800">${(form.monthly_rent || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${calcNetMonthly() >= 0 ? 'from-emerald-50 to-green-50 border-emerald-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] font-medium">Net Monthly</span>
              </div>
              <p className={`text-lg font-bold ${calcNetMonthly() >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                ${calcNetMonthly().toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1 mb-1">
                <BarChart3 className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] text-amber-700 font-medium">Acq. Fee</span>
              </div>
              <p className="text-lg font-bold text-amber-800">${(form.acquisition_fee || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Core Fields */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#d4a574]" /> Core Financial Details
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs" htmlFor="monthly-property-rent">Monthly Property Rent ($)</Label>
              <Input id="monthly-property-rent" type="number" min={0} step={50} value={form.monthly_rent || ''} onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} placeholder="1500" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="acquisition-fee">Acquisition Fee ($)</Label>
              <Input id="acquisition-fee" type="number" min={0} step={100} value={form.acquisition_fee || ''} onChange={(e) => setForm({ ...form, acquisition_fee: Number(e.target.value) })} placeholder="2500" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1" htmlFor="avg-occupancy-rate"><Percent className="w-3 h-3" /> Avg Occupancy Rate (%)</Label>
              <Input id="avg-occupancy-rate" type="number" min={0} max={100} step={1} value={form.avg_occupancy_rate || ''} onChange={(e) => setForm({ ...form, avg_occupancy_rate: Number(e.target.value) })} placeholder="75" />
            </div>
          </div>

          {/* Size and room rate. There is no asking price on a property: the
              acquisition fee entered above is the price of the operation. */}
          <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2 pt-2">
            <Home className="w-4 h-4 text-[#d4a574]" /> Property Detail
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1" htmlFor="square-footage"><Square className="w-3 h-3" /> Square Footage</Label>
              <Input id="square-footage" type="number" min={0} step={10} value={form.sqft || ''} onChange={(e) => setForm({ ...form, sqft: Number(e.target.value) })} placeholder="1500" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="avg-room-rate-month">Avg Room Rate ($/month)</Label>
              <Input id="avg-room-rate-month" type="number" min={0} step={25} value={form.monthly_room_rate || ''} onChange={(e) => setForm({ ...form, monthly_room_rate: Number(e.target.value) })} placeholder="850" />
            </div>
          </div>

          <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2 pt-2">
            <TrendingUp className="w-4 h-4 text-[#d4a574]" /> Average Daily Rate (ADR)
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs" htmlFor="adr-peak-season">ADR - Peak Season ($)</Label>
              <Input id="adr-peak-season" type="number" min={0} step={5} value={form.adr_peak_season || ''} onChange={(e) => setForm({ ...form, adr_peak_season: Number(e.target.value) })} placeholder="180" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="adr-slow-season">ADR - Slow Season ($)</Label>
              <Input id="adr-slow-season" type="number" min={0} step={5} value={form.adr_slow_season || ''} onChange={(e) => setForm({ ...form, adr_slow_season: Number(e.target.value) })} placeholder="120" />
            </div>
            <div>
              {/* Spacer for alignment */}
            </div>
          </div>

          <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2 pt-2">
            <BarChart3 className="w-4 h-4 text-[#d4a574]" /> Revenue Projections
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs" htmlFor="projected-yearly-revenue">Projected Yearly Revenue ($)</Label>
              <Input id="projected-yearly-revenue" type="number" min={0} step={500} value={form.projected_yearly_revenue || ''} onChange={(e) => setForm({ ...form, projected_yearly_revenue: Number(e.target.value) })} placeholder="48000" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="monthly-revenue-peak">Monthly Revenue - Peak ($)</Label>
              <Input id="monthly-revenue-peak" type="number" min={0} step={100} value={form.projected_monthly_revenue_peak || ''} onChange={(e) => setForm({ ...form, projected_monthly_revenue_peak: Number(e.target.value) })} placeholder="5400" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="monthly-revenue-slow">Monthly Revenue - Slow ($)</Label>
              <Input id="monthly-revenue-slow" type="number" min={0} step={100} value={form.projected_monthly_revenue_slow || ''} onChange={(e) => setForm({ ...form, projected_monthly_revenue_slow: Number(e.target.value) })} placeholder="3200" />
            </div>
          </div>

          {/* Season & Notes */}
          <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2 pt-2">
            <Calendar className="w-4 h-4 text-[#d4a574]" /> Season & Notes
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1" htmlFor="peak-season-description"><Calendar className="w-3 h-3" /> Peak Season Description</Label>
              <Input id="peak-season-description" value={form.peak_season_description || ''} onChange={(e) => setForm({ ...form, peak_season_description: e.target.value })} placeholder="e.g., May through September" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1" htmlFor="deposits-concessions-notes"><FileText className="w-3 h-3" /> Deposits / Concessions Notes</Label>
              <Input id="deposits-concessions-notes" value={form.deposits_concessions_notes || ''} onChange={(e) => setForm({ ...form, deposits_concessions_notes: e.target.value })} placeholder="e.g., First/last month, pet deposit $300" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Financials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

