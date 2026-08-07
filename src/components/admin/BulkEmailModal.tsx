import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, Loader2, Users, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  investorIds: string[];
  onSent: () => void;
}

const templates = [
  { id: 'deal_alert', name: 'New Deal Alert', subject: 'New Investment Opportunity in {{market}}', content: '<h2>Hi {{name}},</h2><p>We have a new deal that matches your criteria!</p><p>Check out the latest opportunities in your preferred markets.</p><p><a href="https://accessyourplace.com/deals">View Deals</a></p>' },
  { id: 'follow_up', name: 'Follow Up', subject: 'Following Up on Your Interest', content: '<h2>Hi {{name}},</h2><p>Just checking in to see if you have any questions about the properties you viewed.</p><p>We\'re here to help!</p>' },
  { id: 'market_update', name: 'Market Update', subject: 'Weekly Market Update', content: '<h2>Hi {{name}},</h2><p>Here\'s your weekly update on the rental arbitrage market.</p><p>New opportunities are available in your target markets.</p>' },
  { id: 'custom', name: 'Custom Email', subject: '', content: '' }
];

export function BulkEmailModal({ open, onClose, investorIds, onSent }: Props) {
  const [template, setTemplate] = useState('custom');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const { toast } = useToast();

  const handleTemplateChange = (id: string) => {
    setTemplate(id);
    const t = templates.find(t => t.id === id);
    if (t && id !== 'custom') {
      setSubject(t.subject);
      setContent(t.content);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      toast({ title: 'Please fill in subject and content', variant: 'destructive' });
      return;
    }

    setSending(true);
    setResult(null);

    const { data, error } = await supabase.functions.invoke('send-bulk-email', {
      body: {
        subject,
        content,
        investor_ids: investorIds,
        staff_name: 'Staff'
      }
    });

    setSending(false);

    if (error) {
      toast({ title: 'Failed to send emails', description: error.message, variant: 'destructive' });
    } else {
      setResult({ sent: data.sent, failed: data.failed });
      toast({ title: `Emails sent: ${data.sent}/${data.total}` });
      if (data.sent > 0) {
        setTimeout(() => {
          onSent();
          onClose();
          setResult(null);
          setSubject('');
          setContent('');
        }, 2000);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#d4a574]" />
            Send Bulk Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-800">
              Sending to <strong>{investorIds.length}</strong> selected investor{investorIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div>
            <Label>Email Template</Label>
            <Select value={template} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="subject-line">Subject Line</Label>
            <Input id="subject-line" 
              value={subject} 
              onChange={e => setSubject(e.target.value)} 
              placeholder="Email subject..."
            />
          </div>

          <div>
            <Label htmlFor="email-content-html">Email Content (HTML)</Label>
            <Textarea id="email-content-html" 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder="Email body..."
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use {'{{name}}'} for investor name, {'{{email}}'} for email
            </p>
          </div>

          {result && (
            <div className={`p-3 rounded-lg ${result.failed > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <p className="font-medium">
                {result.sent} emails sent successfully
                {result.failed > 0 && `, ${result.failed} failed`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sending || !subject.trim() || !content.trim()}
            className="bg-[#d4a574]"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Send Emails</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
