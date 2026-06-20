import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Calendar, Save } from 'lucide-react';

interface Props {
  investorId: string;
  preferredMarkets: string[];
}

const markets = ['Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX', 'Phoenix, AZ', 'Denver, CO', 'Nashville, TN', 'Atlanta, GA', 'Tampa, FL', 'Orlando, FL', 'Miami, FL', 'Charlotte, NC'];
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function MarketReportSettings({ investorId, preferredMarkets }: Props) {
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    frequency: 'none',
    day_of_week: 1,
    day_of_month: 1,
    markets: preferredMarkets || [],
    is_active: true
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSchedule();
  }, [investorId]);

  const loadSchedule = async () => {
    const { data } = await supabase.functions.invoke('manage-market-reports', {
      body: { action: 'get_schedule', investor_id: investorId }
    });
    if (data?.schedule) {
      setSchedule(data.schedule);
      setForm({
        frequency: data.schedule.frequency || 'none',
        day_of_week: data.schedule.day_of_week || 1,
        day_of_month: data.schedule.day_of_month || 1,
        markets: data.schedule.markets || preferredMarkets || [],
        is_active: data.schedule.is_active ?? true
      });
    }
    setLoading(false);
  };

  const toggleMarket = (m: string) => {
    setForm(f => ({
      ...f,
      markets: f.markets.includes(m) ? f.markets.filter(x => x !== m) : [...f.markets, m]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { data } = await supabase.functions.invoke('manage-market-reports', {
      body: { action: 'save_schedule', investor_id: investorId, ...form }
    });
    setSaving(false);
    if (data?.schedule) {
      setSchedule(data.schedule);
      toast({ title: 'Saved!', description: 'Report schedule updated.' });
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Market Report Settings</CardTitle>
        <CardDescription>Configure automated market reports for your preferred markets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Label>Enable Automated Reports</Label><p className="text-sm text-muted-foreground">Receive market analysis reports automatically</p></div>
          <Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Frequency</Label>
            <Select value={form.frequency} onValueChange={v => setForm({...form, frequency: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.frequency === 'weekly' && (
            <div>
              <Label>Day of Week</Label>
              <Select value={String(form.day_of_week)} onValueChange={v => setForm({...form, day_of_week: Number(v)})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{days.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.frequency === 'monthly' && (
            <div>
              <Label>Day of Month</Label>
              <Select value={String(form.day_of_month)} onValueChange={v => setForm({...form, day_of_month: Number(v)})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({length: 28}, (_, i) => <SelectItem key={i+1} value={String(i+1)}>{i+1}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label className="mb-2 block">Markets to Include</Label>
          <div className="flex flex-wrap gap-2">
            {markets.map(m => (
              <Badge key={m} variant={form.markets.includes(m) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleMarket(m)}>{m}</Badge>
            ))}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#d4a574]">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
