import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { OutreachRecord, EmailTemplate } from '@/types/dealflow';

interface OutreachPanelProps {
  outreach: OutreachRecord[];
  templates: EmailTemplate[];
  propertyId: string;
  onSendEmail: (templateId: string) => Promise<void>;
  onLogCall: (outcome: string) => Promise<void>;
  onUpdateStatus: (status: string) => Promise<void>;
  currentStatus: string;
}

export function OutreachPanel({ outreach, templates, propertyId, onSendEmail, onLogCall, onUpdateStatus, currentStatus }: OutreachPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);

  const handleSendEmail = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    await onSendEmail(selectedTemplate);
    setSending(false);
  };

  const handleLogCall = async (outcome: string) => {
    setLogging(true);
    await onLogCall(outcome);
    setLogging(false);
  };

  const statusColors: Record<string, string> = {
    good_deal: 'bg-green-500',
    not_responded: 'bg-gray-500',
    waiting_callback: 'bg-yellow-500',
    interested: 'bg-blue-500',
    not_interested: 'bg-red-500'
  };

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4" /> Send Email
        </h4>
        <div className="flex gap-2">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSendEmail} disabled={!selectedTemplate || sending} className="bg-[#d4a574]">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </div>

      {/* Call Logging */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Phone className="w-4 h-4" /> Log Call Outcome
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => handleLogCall('no_answer')} disabled={logging}>No Answer</Button>
          <Button variant="outline" onClick={() => handleLogCall('callback_scheduled')} disabled={logging}>
            <Clock className="w-4 h-4 mr-1" /> Callback
          </Button>
          <Button variant="outline" className="text-green-600 border-green-600" onClick={() => handleLogCall('interested')} disabled={logging}>
            <CheckCircle className="w-4 h-4 mr-1" /> Interested
          </Button>
          <Button variant="outline" className="text-red-600 border-red-600" onClick={() => handleLogCall('not_interested')} disabled={logging}>
            <XCircle className="w-4 h-4 mr-1" /> Not Interested
          </Button>
        </div>
      </div>

      {/* Status Workflow */}
      <div className="p-4 border rounded-lg">
        <h4 className="font-semibold mb-3">Deal Status</h4>
        <div className="flex flex-wrap gap-2">
          {['good_deal', 'not_responded', 'waiting_callback'].map((status) => (
            <Button
              key={status}
              variant={currentStatus === status ? 'default' : 'outline'}
              className={currentStatus === status ? statusColors[status] : ''}
              onClick={() => onUpdateStatus(status)}
            >
              {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>
      </div>

      {/* Outreach History */}
      <div>
        <h4 className="font-semibold mb-3">Outreach History</h4>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {outreach.map((record) => (
            <div key={record.id} className="p-2 border rounded text-sm flex justify-between items-center">
              <div className="flex items-center gap-2">
                {record.contact_method === 'email' ? <Mail className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                <span>{record.contact_method}</span>
                <Badge variant="secondary">{record.status}</Badge>
              </div>
              <span className="text-xs text-gray-500">{new Date(record.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
