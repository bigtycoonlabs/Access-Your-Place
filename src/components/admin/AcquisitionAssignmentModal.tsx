import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, DollarSign, Calendar, Mail, UserPlus, CheckCircle } from 'lucide-react';

interface Props {
  property: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export function AcquisitionAssignmentModal({ property, open, onOpenChange, onAssigned }: Props) {
  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'existing' | 'invite'>('existing');
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [acquisitionFee, setAcquisitionFee] = useState('2500');
  const [closingDate, setClosingDate] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) fetchInvestors();
  }, [open]);

  const fetchInvestors = async () => {
    const { data } = await supabase.from('investors').select('id, name, email, company').order('name');
    if (data) setInvestors(data);
  };

  const handleAssign = async () => {
    if (!selectedInvestor) { toast({ title: 'Select an investor', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-acquisition-workflow', {
        body: { action: 'assign_investor', property_id: property.id, investor_id: selectedInvestor, data: { amount: parseFloat(acquisitionFee), closing_date: closingDate } }
      });
      if (error) throw error;
      toast({ title: 'Investor Assigned', description: 'Acquisition workflow started' });
      onAssigned();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail) { toast({ title: 'Email required', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('investor_invitations').insert({
        email: inviteEmail, name: inviteName, phone: invitePhone, property_id: property.id, invitation_token: crypto.randomUUID()
      });
      if (error) throw error;
      toast({ title: 'Invitation Sent', description: `Invite sent to ${inviteEmail}` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Acquisition</DialogTitle>
          <DialogDescription>Assign this deal to an investor and start the acquisition workflow</DialogDescription>
        </DialogHeader>
        
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <h4 className="font-semibold">{property?.title || property?.address}</h4>
            <p className="text-sm text-gray-600">{property?.city}, {property?.state} {property?.zip_code}</p>
          </CardContent>
        </Card>

        <div className="flex gap-2 mb-4">
          <Button variant={mode === 'existing' ? 'default' : 'outline'} onClick={() => setMode('existing')} className="flex-1"><User className="w-4 h-4 mr-2" />Existing Investor</Button>
          <Button variant={mode === 'invite' ? 'default' : 'outline'} onClick={() => setMode('invite')} className="flex-1"><UserPlus className="w-4 h-4 mr-2" />Invite New</Button>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-4">
            <div>
              <Label>Select Investor</Label>
              <Select value={selectedInvestor} onValueChange={setSelectedInvestor}>
                <SelectTrigger><SelectValue placeholder="Choose investor..." /></SelectTrigger>
                <SelectContent>{investors.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.email})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="flex items-center gap-1" htmlFor="acquisition-fee"><DollarSign className="w-4 h-4" />Acquisition Fee</Label><Input id="acquisition-fee" type="number" value={acquisitionFee} onChange={e => setAcquisitionFee(e.target.value)} /></div>
              <div><Label className="flex items-center gap-1" htmlFor="closing-date"><Calendar className="w-4 h-4" />Closing Date</Label><Input id="closing-date" type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} /></div>
            </div>
            <Button onClick={handleAssign} disabled={loading || !selectedInvestor} className="w-full bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}Assign & Start Workflow
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><Label className="flex items-center gap-1" htmlFor="email"><Mail className="w-4 h-4" />Email *</Label><Input id="email" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="investor@email.com" /></div>
            <div><Label htmlFor="name">Name</Label><Input id="name" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="John Smith" /></div>
            <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="(555) 123-4567" /></div>
            <Button onClick={handleInvite} disabled={loading || !inviteEmail} className="w-full bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}Send Invitation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
