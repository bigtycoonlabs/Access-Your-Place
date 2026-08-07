import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { GripVertical, Plus, Trash2, Save, Eye, Palette, Image, BarChart3, Table, FileText, Home, TrendingUp, Building2, Loader2 } from 'lucide-react';

const AVAILABLE_SECTIONS = [
  { id: 'market_overview', name: 'Market Overview', icon: Home, description: 'General market conditions and trends' },
  { id: 'rental_data', name: 'Rental Data', icon: TrendingUp, description: 'Long-term rental rates and occupancy' },
  { id: 'str_metrics', name: 'STR Metrics', icon: BarChart3, description: 'Short-term rental performance data' },
  { id: 'deal_listings', name: 'Deal Listings', icon: Building2, description: 'Current available properties' },
  { id: 'charts', name: 'Charts & Graphs', icon: BarChart3, description: 'Visual data representations' },
  { id: 'recommendations', name: 'AI Recommendations', icon: FileText, description: 'Personalized investment insights' },
  { id: 'market_comparison', name: 'Market Comparison', icon: Table, description: 'Compare multiple markets' },
];

interface Template {
  id?: string;
  name: string;
  description: string;
  sections: string[];
  colors: { primary: string; secondary: string; accent: string };
  branding: { logo_url: string | null; company_name: string; tagline: string };
  data_points: string[];
  is_default_weekly: boolean;
  is_default_monthly: boolean;
  is_active: boolean;
}

export function ReportTemplateBuilder() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const defaultTemplate: Template = {
    name: '', description: '', sections: ['market_overview', 'rental_data', 'str_metrics'],
    colors: { primary: '#1a365d', secondary: '#d4a574', accent: '#2d4a7c' },
    branding: { logo_url: null, company_name: 'Access Your Place', tagline: 'Rental Arbitrage Investment Platform' },
    data_points: ['avg_rent', 'occupancy_rate', 'adr', 'revpar'], is_default_weekly: false, is_default_monthly: false, is_active: true
  };

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-market-reports', { body: { action: 'get_templates' } });
    setTemplates(data?.templates || []);
    setLoading(false);
  };

  const saveTemplate = async () => {
    if (!selected?.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.functions.invoke('manage-market-reports', { body: { action: 'save_template', ...selected } });
    if (error) toast({ title: 'Save failed', variant: 'destructive' });
    else { toast({ title: 'Template saved!' }); fetchTemplates(); }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    await supabase.functions.invoke('manage-market-reports', { body: { action: 'delete_template', template_id: id } });
    toast({ title: 'Template deleted' }); fetchTemplates(); setSelected(null);
  };

  const toggleSection = (sectionId: string) => {
    if (!selected) return;
    const sections = selected.sections.includes(sectionId) 
      ? selected.sections.filter(s => s !== sectionId) 
      : [...selected.sections, sectionId];
    setSelected({ ...selected, sections });
  };

  const moveSection = (from: number, to: number) => {
    if (!selected) return;
    const sections = [...selected.sections];
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    setSelected({ ...selected, sections });
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="flex items-center justify-between">Templates <Button size="sm" onClick={() => setSelected(defaultTemplate)}><Plus className="w-4 h-4 mr-1" />New</Button></CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {templates.map(t => (
            <div key={t.id} onClick={() => setSelected(t)} className={`p-3 rounded-lg cursor-pointer border transition ${selected?.id === t.id ? 'border-[#d4a574] bg-[#d4a574]/10' : 'hover:bg-gray-50'}`}>
              <p className="font-medium">{t.name}</p>
              <div className="flex gap-1 mt-1">
                {t.is_default_weekly && <Badge variant="secondary" className="text-xs">Weekly</Badge>}
                {t.is_default_monthly && <Badge variant="secondary" className="text-xs">Monthly</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {selected && (
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Edit Template</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label htmlFor="template-name">Template Name</Label><Input id="template-name" value={selected.name} onChange={e => setSelected({...selected, name: e.target.value})} /></div>
              <div><Label htmlFor="description">Description</Label><Input id="description" value={selected.description} onChange={e => setSelected({...selected, description: e.target.value})} /></div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-3" htmlFor="brand-colors"><Palette className="w-4 h-4" />Brand Colors</Label>
              <div className="flex gap-4">
                {(['primary', 'secondary', 'accent'] as const).map(c => (
                  <div key={c} className="flex items-center gap-2">
                    <input id="brand-colors" type="color" value={selected.colors[c]} onChange={e => setSelected({...selected, colors: {...selected.colors, [c]: e.target.value}})} className="w-10 h-10 rounded cursor-pointer" />
                    <span className="text-sm capitalize">{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-3"><Image className="w-4 h-4" />Branding</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label className="text-xs" htmlFor="company-name">Company Name</Label><Input id="company-name" value={selected.branding.company_name} onChange={e => setSelected({...selected, branding: {...selected.branding, company_name: e.target.value}})} /></div>
                <div><Label className="text-xs" htmlFor="logo-url">Logo URL</Label><Input id="logo-url" value={selected.branding.logo_url || ''} onChange={e => setSelected({...selected, branding: {...selected.branding, logo_url: e.target.value}})} placeholder="https://..." /></div>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Report Sections (drag to reorder)</Label>
              <div className="space-y-2">
                {selected.sections.map((sId, idx) => {
                  const section = AVAILABLE_SECTIONS.find(s => s.id === sId);
                  if (!section) return null;
                  return (
                    <div key={sId} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                      <section.icon className="w-5 h-5 text-[#d4a574]" />
                      <span className="flex-1 font-medium">{section.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => idx > 0 && moveSection(idx, idx - 1)}>↑</Button>
                      <Button size="sm" variant="ghost" onClick={() => idx < selected.sections.length - 1 && moveSection(idx, idx + 1)}>↓</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleSection(sId)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {AVAILABLE_SECTIONS.filter(s => !selected.sections.includes(s.id)).map(s => (
                  <Button key={s.id} size="sm" variant="outline" onClick={() => toggleSection(s.id)}><Plus className="w-3 h-3 mr-1" />{s.name}</Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={selected.is_default_weekly} onCheckedChange={v => setSelected({...selected, is_default_weekly: v})} /><Label>Default for Weekly</Label></div>
              <div className="flex items-center gap-2"><Switch checked={selected.is_default_monthly} onCheckedChange={v => setSelected({...selected, is_default_monthly: v})} /><Label>Default for Monthly</Label></div>
            </div>

            <div className="flex gap-3">
              <Button onClick={saveTemplate} disabled={saving} className="bg-[#d4a574]">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save Template</Button>
              {selected.id && <Button variant="destructive" onClick={() => deleteTemplate(selected.id!)}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
