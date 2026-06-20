import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Mail, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Sequence {
  id?: string;
  name: string;
  trigger_stage: string;
  trigger_type: string;
  delay_days: number;
  email_subject: string;
  email_body: string;
  is_active: boolean;
}

interface AutomationRulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function AutomationRulesModal({ open, onClose }: AutomationRulesModalProps) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [editing, setEditing] = useState<Sequence | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadSequences();
  }, [open]);

  const loadSequences = async () => {
    const { data } = await supabase.functions.invoke('manage-investor-pipeline', {
      body: { action: 'get_sequences' }
    });
    setSequences(data || []);
  };

  const handleSave = async () => {
    if (!editing) return;
    setLoading(true);
    await supabase.functions.invoke('manage-investor-pipeline', {
      body: { action: 'save_sequence', sequence: editing }
    });
    toast({ title: 'Sequence saved' });
    setEditing(null);
    loadSequences();
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.functions.invoke('manage-investor-pipeline', {
      body: { action: 'delete_sequence', id }
    });
    toast({ title: 'Sequence deleted' });
    loadSequences();
  };

  const newSequence = (): Sequence => ({
    name: '', trigger_stage: 'lead', trigger_type: 'stage_enter',
    delay_days: 0, email_subject: '', email_body: '', is_active: true
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Email Automation Rules
          </DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="space-y-4">
            <Input placeholder="Sequence name" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={editing.trigger_stage} onValueChange={v => setEditing({...editing, trigger_stage: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={editing.trigger_type} onValueChange={v => setEditing({...editing, trigger_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage_enter">On Stage Enter</SelectItem>
                  <SelectItem value="days_inactive">Days Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input type="number" placeholder="Delay (days)" value={editing.delay_days} onChange={e => setEditing({...editing, delay_days: parseInt(e.target.value) || 0})} />
            <Input placeholder="Email subject" value={editing.email_subject} onChange={e => setEditing({...editing, email_subject: e.target.value})} />
            <Textarea placeholder="Email body (use {{name}}, {{email}})" value={editing.email_body} onChange={e => setEditing({...editing, email_body: e.target.value})} rows={5} />
            <div className="flex items-center gap-2">
              <Switch checked={editing.is_active} onCheckedChange={v => setEditing({...editing, is_active: v})} />
              <span>Active</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={() => setEditing(newSequence())} className="w-full"><Plus className="w-4 h-4 mr-2" />Add Sequence</Button>
            {sequences.map(seq => (
              <Card key={seq.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className={`w-4 h-4 ${seq.is_active ? 'text-green-500' : 'text-gray-400'}`} />
                    <div>
                      <p className="font-medium">{seq.name}</p>
                      <p className="text-xs text-gray-500">Stage: {seq.trigger_stage} • {seq.trigger_type}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(seq)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(seq.id!)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
