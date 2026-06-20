import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, MessageSquare, FileText } from 'lucide-react';
import { DocumentsTab } from './DocumentsTab';

const stages = ['application_review', 'landlord_negotiation', 'lease_signing', 'property_setup', 'operations_handoff', 'completed'];
const stageLabels: Record<string, string> = { application_review: 'Application Review', landlord_negotiation: 'Landlord Negotiation', lease_signing: 'Lease Signing', property_setup: 'Property Setup', operations_handoff: 'Operations Handoff', completed: 'Completed' };

interface Props { acquisition: any; open: boolean; onClose: () => void; onUpdate: () => void; }

export function AcquisitionDetailModal({ acquisition, open, onClose, onUpdate }: Props) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [noteType, setNoteType] = useState<'investor' | 'internal'>('investor');
  const [documents, setDocuments] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (acquisition?.id) fetchDocuments();
  }, [acquisition?.id]);

  const fetchDocuments = async () => {
    const { data } = await supabase.functions.invoke('manage-investor-documents', {
      body: { action: 'list', acquisition_id: acquisition.id }
    });
    setDocuments(data?.documents || []);
  };

  if (!acquisition) return null;
  const currentStageIndex = stages.indexOf(acquisition.workflow_stage);
  const nextStage = stages[currentStageIndex + 1];

  const advanceStage = async () => {
    if (!nextStage) return;
    setSaving(true);
    await supabase.functions.invoke('manage-acquisitions', { body: { action: 'update_stage', id: acquisition.id, stage: nextStage, staff_name: 'Staff' } });
    toast({ title: `Advanced to ${stageLabels[nextStage]}` });
    onUpdate(); setSaving(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await supabase.functions.invoke('manage-acquisitions', { body: { action: 'add_note', id: acquisition.id, note, note_type: noteType, staff_name: 'Staff' } });
    toast({ title: 'Note added' });
    setNote(''); onUpdate(); setSaving(false);
  };

  const updateField = async (field: string, value: any) => {
    await supabase.functions.invoke('manage-acquisitions', { body: { action: 'update', id: acquisition.id, updates: { [field]: value }, staff_name: 'Staff' } });
    onUpdate();
  };

  const toggleChecklist = async (key: string) => {
    const updated = { ...acquisition.setup_checklist, [key]: !acquisition.setup_checklist[key] };
    await supabase.functions.invoke('manage-acquisitions', { body: { action: 'update_checklist', id: acquisition.id, checklist: updated, staff_name: 'Staff' } });
    onUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>{acquisition.full_address}</span>
            {nextStage && <Button onClick={advanceStage} disabled={saving} className="bg-[#d4a574]">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4 mr-1" />Advance</>}</Button>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 mb-4 flex-wrap">{stages.map((s, i) => <Badge key={s} className={`text-xs ${i <= currentStageIndex ? 'bg-[#d4a574]' : 'bg-gray-200 text-gray-600'}`}>{stageLabels[s]}</Badge>)}</div>
        <Tabs defaultValue="details">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="negotiation">Negotiation</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-1" />Docs ({documents.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Status</Label><Select defaultValue={acquisition.workflow_status} onValueChange={v => updateField('workflow_status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="awaiting_info">Awaiting Info</SelectItem><SelectItem value="on_hold">On Hold</SelectItem></SelectContent></Select></div>
              <div><Label>Assigned Staff</Label><Input defaultValue={acquisition.assigned_staff || ''} onBlur={e => updateField('assigned_staff', e.target.value)} /></div>
              <div><Label>Acquisition Fee ($)</Label><Input type="number" defaultValue={acquisition.acquisition_fee || ''} onBlur={e => updateField('acquisition_fee', parseFloat(e.target.value))} /></div>
              <div><Label>Monthly Rent ($)</Label><Input type="number" defaultValue={acquisition.monthly_rent || ''} onBlur={e => updateField('monthly_rent', parseFloat(e.target.value))} /></div>
            </div>
          </TabsContent>
          <TabsContent value="negotiation" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Landlord Name</Label><Input defaultValue={acquisition.landlord_name || ''} onBlur={e => updateField('landlord_name', e.target.value)} /></div>
              <div><Label>Landlord Contact</Label><Input defaultValue={acquisition.landlord_contact || ''} onBlur={e => updateField('landlord_contact', e.target.value)} /></div>
            </div>
            <div><Label>Negotiation Notes</Label><Textarea defaultValue={acquisition.negotiation_notes || ''} onBlur={e => updateField('negotiation_notes', e.target.value)} rows={4} /></div>
          </TabsContent>
          <TabsContent value="setup">
            <div className="grid grid-cols-2 gap-3">{Object.entries(acquisition.setup_checklist || {}).map(([key, val]) => <div key={key} className="flex items-center gap-2 p-3 bg-gray-50 rounded"><Checkbox checked={val as boolean} onCheckedChange={() => toggleChecklist(key)} /><span className="capitalize text-sm">{key.replace(/_/g, ' ')}</span></div>)}</div>
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab acquisitionId={acquisition.id} investorId={acquisition.investor_id} documents={documents} onUpdate={fetchDocuments} />
          </TabsContent>
          <TabsContent value="notes" className="space-y-4">
            <div className="flex gap-2"><Textarea placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} className="flex-1" /><div className="flex flex-col gap-2"><Select value={noteType} onValueChange={(v: any) => setNoteType(v)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="investor">Investor</SelectItem><SelectItem value="internal">Internal</SelectItem></SelectContent></Select><Button onClick={addNote} disabled={saving} className="bg-[#d4a574]"><MessageSquare className="w-4 h-4" /></Button></div></div>
            {noteType === 'investor' && <p className="text-xs text-blue-600 flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>Investor-visible notes will trigger email notification</p>}
            {acquisition.team_notes && <div className="bg-blue-50 p-4 rounded"><h4 className="font-semibold text-blue-900 mb-2">Investor-Visible Notes</h4><pre className="text-sm whitespace-pre-wrap">{acquisition.team_notes}</pre></div>}
            {acquisition.internal_notes && <div className="bg-gray-100 p-4 rounded"><h4 className="font-semibold text-gray-700 mb-2">Internal Notes</h4><pre className="text-sm whitespace-pre-wrap">{acquisition.internal_notes}</pre></div>}
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
