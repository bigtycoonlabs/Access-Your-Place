import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Phone, Mail, Calendar, Plus, Save } from 'lucide-react';

interface Props {
  landlord: any;
  onClose: () => void;
  isNew?: boolean;
}

export function LandlordDetailModal({ landlord, onClose, isNew }: Props) {
  const [form, setForm] = useState(landlord || { name: '', company_name: '', email: '', phone: '', contact_type: 'individual', status: 'active', notes: '' });
  const [comms, setComms] = useState<any[]>([]);
  const [newComm, setNewComm] = useState({ communication_type: 'call', direction: 'outbound', subject: '', content: '', outcome: '', follow_up_required: false, follow_up_date: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (landlord?.id) fetchComms();
  }, [landlord]);

  const fetchComms = async () => {
    const { data } = await supabase.functions.invoke('manage-landlords', { body: { action: 'get_communications', landlord_id: landlord.id } });
    if (data?.communications) setComms(data.communications);
  };

  const handleSave = async () => {
    setSaving(true);
    const action = isNew ? 'create' : 'update';
    const body = isNew ? { action, landlord: form } : { action, landlord_id: landlord.id, updates: form };
    const { data, error } = await supabase.functions.invoke('manage-landlords', { body });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: isNew ? 'Landlord created' : 'Landlord updated' }); onClose(); }
    setSaving(false);
  };

  const logComm = async () => {
    const { error } = await supabase.functions.invoke('manage-landlords', { body: { action: 'log_communication', communication: { ...newComm, landlord_id: landlord.id } } });
    if (error) toast({ title: 'Error', variant: 'destructive' });
    else { toast({ title: 'Communication logged' }); fetchComms(); setNewComm({ communication_type: 'call', direction: 'outbound', subject: '', content: '', outcome: '', follow_up_required: false, follow_up_date: '' }); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add New Landlord' : `${landlord?.name}`}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="details">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            {!isNew && <TabsTrigger value="communications">Communications</TabsTrigger>}
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><label className="text-sm font-medium">Company</label><Input value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
              <div><label className="text-sm font-medium">Email</label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><label className="text-sm font-medium">Type</label>
                <Select value={form.contact_type} onValueChange={v => setForm({...form, contact_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="property_manager">Property Manager</SelectItem><SelectItem value="community">Community</SelectItem><SelectItem value="corporate">Corporate</SelectItem></SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium">Status</label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="do_not_contact">Do Not Contact</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-sm font-medium">Notes</label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} /></div>
            <Button onClick={handleSave} disabled={saving} className="bg-[#d4a574]"><Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save'}</Button>
          </TabsContent>

          {!isNew && (
            <TabsContent value="communications" className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium">Log New Communication</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newComm.communication_type} onValueChange={v => setNewComm({...newComm, communication_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="call">Call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="meeting">Meeting</SelectItem><SelectItem value="text">Text</SelectItem></SelectContent>
                  </Select>
                  <Select value={newComm.direction} onValueChange={v => setNewComm({...newComm, direction: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="outbound">Outbound</SelectItem><SelectItem value="inbound">Inbound</SelectItem></SelectContent>
                  </Select>
                </div>
                <Input placeholder="Subject" value={newComm.subject} onChange={e => setNewComm({...newComm, subject: e.target.value})} />
                <Textarea placeholder="Details" value={newComm.content} onChange={e => setNewComm({...newComm, content: e.target.value})} rows={2} />
                <div className="flex gap-3 items-center">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newComm.follow_up_required} onChange={e => setNewComm({...newComm, follow_up_required: e.target.checked})} />Follow-up needed</label>
                  {newComm.follow_up_required && <Input type="date" value={newComm.follow_up_date} onChange={e => setNewComm({...newComm, follow_up_date: e.target.value})} className="w-40" />}
                </div>
                <Button onClick={logComm} size="sm"><Plus className="w-4 h-4 mr-1" />Log</Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {comms.map(c => (
                  <div key={c.id} className="border rounded p-3 text-sm">
                    <div className="flex justify-between"><span className="font-medium capitalize">{c.communication_type} ({c.direction})</span><span className="text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span></div>
                    <p className="text-gray-600">{c.subject}</p>
                    {c.content && <p className="text-gray-500 text-xs mt-1">{c.content}</p>}
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
