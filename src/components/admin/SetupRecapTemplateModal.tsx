import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Send, Mail, MessageSquare, Eye, FileEdit, Copy,
  CheckCircle, Package, ClipboardList, Sparkles, AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface SetupProject {
  id: string;
  property_address: string;
  investor_name?: string;
  investor_email?: string;
  investor_phone?: string;
  investor_id?: string;
  phase: number;
  package_type?: string;
  assigned_manager_name?: string;
  admin_fee_amount?: number;
  admin_fee_paid?: boolean;
  recap_sent?: boolean;
  recap_sent_at?: string;
  recap_type?: string;
  num_properties?: number;
  num_beds?: string;
  num_baths?: string;
  property_type?: string;
  city_state?: string;
  target_start_date?: string;
  intake_form_link?: string;
  [key: string]: any;
}

interface Props {
  project: SetupProject;
  open: boolean;
  onClose: () => void;
  onUpdate: (project: SetupProject) => void;
  staffName: string;
}

const PROPERTY_TYPES = [
  'apartment', 'house', 'condo', 'townhouse', 'studio', 'duplex', 'loft', 'villa'
];

export function SetupRecapTemplateModal({ project, open, onClose, onUpdate, staffName }: Props) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');
  const [previewHtml, setPreviewHtml] = useState('');
  const [copied, setCopied] = useState(false);

  // Template variables - editable
  const [vars, setVars] = useState({
    client_name: '',
    num_properties: '1',
    num_beds: '',
    num_baths: '',
    property_type: 'apartment',
    city_state: '',
    target_start_date: '',
    manager_name: '',
    intake_form_link: '',
  });

  const recapType = project.package_type || 'dfy';
  const isDFY = recapType === 'dfy';

  // Initialize vars from project data
  useEffect(() => {
    if (open) {
      setVars({
        client_name: project.investor_name || '',
        num_properties: String(project.num_properties || 1),
        num_beds: project.num_beds || '',
        num_baths: project.num_baths || '',
        property_type: project.property_type || 'apartment',
        city_state: project.city_state || extractCityState(project.property_address),
        target_start_date: project.target_start_date || '',
        manager_name: project.assigned_manager_name || staffName || '',
        intake_form_link: project.intake_form_link || 'https://accessyourplace.com/portal',
      });
      setActiveView('edit');
      setPreviewHtml('');
    }
  }, [open, project]);

  function extractCityState(address: string): string {
    if (!address) return '';
    const parts = address.split(',').map(s => s.trim());
    if (parts.length >= 3) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    if (parts.length >= 2) return parts.slice(1).join(', ');
    return '';
  }

  // Build plain text preview locally
  const plainTextPreview = useMemo(() => {
    const adminStatus = project.admin_fee_paid ? 'Paid' : 'Pending Payment';
    const adminAmount = project.admin_fee_amount || 2500;
    const cn = vars.client_name || 'there';
    const np = vars.num_properties || '1';
    const nb = vars.num_beds || '[beds]';
    const nba = vars.num_baths || '[baths]';
    const pt = vars.property_type || 'apartment';
    const cs = vars.city_state || '[City, State]';
    const sd = vars.target_start_date || '[Date TBD]';
    const mn = vars.manager_name || 'Your Setup Manager';
    const il = vars.intake_form_link || 'https://accessyourplace.com/portal';

    if (isDFY) {
      return `Hi ${cn},

Just to recap:

You would like ${np} (${nb} bed, ${nba} bath) ${pt} set up in ${cs} for a start date of ${sd}.

• Administration Team (${adminStatus}): $${Number(adminAmount).toLocaleString()}
• On-the-Ground Setup Team and logistics: $3,350
• Furniture Package Fee: This will depend on the furniture and supplies you choose per unit. We can definitely negotiate on furniture, household supplies, and home tech to find the perfect fit for your budget.

Here's how our process works:

1. Please fill out this form so we can gather all the necessary details for your service: ${il}
2. Next, we'll send over a service agreement that needs to be signed, along with your set up and logistics fee paid.
3. After that, we'll dive into product sourcing, which also takes 24 to 48 hours. We'll send you a detailed spreadsheet with all items sourced for the property, along with the furniture package fee. Once that's settled, we'll go ahead and purchase everything.
4. Our on-the-ground setup team will be ready to receive, unbox, and assemble all items as they arrive. This process, including Wi-Fi setup if needed and property photos, takes about 7 to 14 business days. We'll also handle any cleanup, so you don't have to worry about leftover debris or boxes!

For your convenience, you can make payments via Zelle to admin@cooperfamilyinc.net. And feel free to check out our website at accessyourplace.com for more information.

If you have any questions or need anything else, just let me know! Looking forward to working together!

Best,
${mn}`;
    } else {
      return `Hi ${cn},

Just to recap:

You would like ${np} (${nb} bed, ${nba} bath) ${pt} set up in ${cs} for a start date of ${sd}.

• Administration Team (${adminStatus}): $${Number(adminAmount).toLocaleString()}
• Furniture Package Fee: This will depend on the furniture and supplies you choose per unit. We can definitely negotiate on furniture, household supplies, and home tech to find the perfect fit for your budget.

Here's how our process works:

1. Please fill out this form so we can gather all the necessary details for your service: ${il}
2. Next, we'll send over a service agreement that needs to be signed.
3. After that, we'll dive into product sourcing, which also takes 24 to 48 hours. We'll send you a detailed spreadsheet with all items sourced for the property, along with the furniture package fee. Once that's settled, we'll go ahead and purchase everything.
4. Your on-the-ground setup team will need to be ready to receive, unbox, and assemble all items as they arrive. This process, including Wi-Fi setup if needed, takes about 7 to 14 business days. You'll also handle property photos and any cleanup (debris or boxes).

For your convenience, you can make payments via Zelle to admin@cooperfamilyinc.net. And feel free to check out our website at accessyourplace.com for more information.

If you have any questions or need anything else, just let me know! Looking forward to working together!

Best,
${mn}`;
    }
  }, [vars, project.admin_fee_paid, project.admin_fee_amount, isDFY]);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: {
          action: 'preview_recap',
          project_id: project.id,
          recap_type: recapType,
          template_vars: vars,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreviewHtml(data?.preview?.html || '');
      setActiveView('preview');
    } catch (err: any) {
      toast({ title: 'Preview Error', description: err.message, variant: 'destructive' });
    }
    setPreviewing(false);
  };

  const handleSend = async (sendAs: 'email' | 'message') => {
    if (!project.investor_email && sendAs === 'email') {
      toast({ title: 'No Email', description: 'Operator email is required to send via email.', variant: 'destructive' });
      return;
    }
    if (!project.investor_id && sendAs === 'message') {
      toast({ title: 'No Portal Account', description: 'Operator must have a portal account to receive messages.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: {
          action: 'send_recap',
          project_id: project.id,
          recap_type: recapType,
          staff_name: staffName,
          template_vars: vars,
          send_as_message: sendAs === 'message',
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.project) onUpdate(data.project);

      const method = sendAs === 'email' ? 'email' : 'portal message';
      const success = sendAs === 'email' ? data?.email_sent : data?.message_sent;

      toast({
        title: success ? 'Recap Sent!' : 'Recap Saved',
        description: success
          ? `${isDFY ? 'DFY' : 'DIY'} recap sent via ${method} to ${project.investor_name || 'operator'}.`
          : `Recap saved to project. ${sendAs === 'email' ? 'Email delivery may be pending.' : 'Message delivery may be pending.'}`,
      });

      onClose();
    } catch (err: any) {
      toast({ title: 'Send Error', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(plainTextPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied!', description: 'Plain text recap copied to clipboard.' });
  };

  const missingFields = [];
  if (!vars.client_name) missingFields.push('Client Name');
  if (!vars.num_beds) missingFields.push('Beds');
  if (!vars.num_baths) missingFields.push('Baths');
  if (!vars.city_state) missingFields.push('City, State');
  if (!vars.target_start_date) missingFields.push('Start Date');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isDFY ? (
              <Package className="w-5 h-5 text-pink-500" />
            ) : (
              <ClipboardList className="w-5 h-5 text-blue-500" />
            )}
            {isDFY ? 'Done For You (DFY)' : 'Do It Yourself (DIY)'} Recap Template
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>Customize and send the recap to {project.investor_name || 'the operator'}</span>
            {project.recap_sent && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                <CheckCircle className="w-3 h-3 mr-1" />
                Previously sent {project.recap_sent_at ? new Date(project.recap_sent_at).toLocaleDateString() : ''}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* View Toggle */}
        <div className="flex-shrink-0 flex items-center gap-2 border-b pb-2">
          <button
            onClick={() => setActiveView('edit')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeView === 'edit' ? 'bg-[#1a365d] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <FileEdit className="w-4 h-4" />
            Edit Variables
          </button>
          <button
            onClick={handlePreview}
            disabled={previewing}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeView === 'preview' ? 'bg-[#1a365d] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Email Preview
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${isDFY ? 'border-pink-300 text-pink-700 bg-pink-50' : 'border-blue-300 text-blue-700 bg-blue-50'}`}>
              {isDFY ? 'DFY Package' : 'DIY Package'}
            </Badge>
            <Badge variant="outline" className={`text-xs ${project.admin_fee_paid ? 'border-green-300 text-green-700 bg-green-50' : 'border-amber-300 text-amber-700 bg-amber-50'}`}>
              Admin Fee: {project.admin_fee_paid ? 'Paid' : 'Pending'}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'edit' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              {/* Left: Variable Editor */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-[#d4a574]" />
                  <h3 className="font-semibold text-sm text-[#1a365d]">Template Variables</h3>
                </div>

                {missingFields.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800">Missing fields:</p>
                      <p className="text-amber-700">{missingFields.join(', ')}</p>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="var-client-name">Client Name *</Label>
                  <Input
                    id="var-client-name"
                    value={vars.client_name}
                    onChange={e => setVars({ ...vars, client_name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="var-num-props"># Properties</Label>
                    <Input
                      id="var-num-props"
                      type="number"
                      min="1"
                      value={vars.num_properties}
                      onChange={e => setVars({ ...vars, num_properties: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="var-beds"># Beds *</Label>
                    <Input
                      id="var-beds"
                      value={vars.num_beds}
                      onChange={e => setVars({ ...vars, num_beds: e.target.value })}
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <Label htmlFor="var-baths"># Baths *</Label>
                    <Input
                      id="var-baths"
                      value={vars.num_baths}
                      onChange={e => setVars({ ...vars, num_baths: e.target.value })}
                      placeholder="2"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="var-prop-type">Property Type</Label>
                  <Select value={vars.property_type} onValueChange={v => setVars({ ...vars, property_type: v })}>
                    <SelectTrigger id="var-prop-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="var-city-state">City, State *</Label>
                  <Input
                    id="var-city-state"
                    value={vars.city_state}
                    onChange={e => setVars({ ...vars, city_state: e.target.value })}
                    placeholder="Austin, Texas"
                  />
                </div>

                <div>
                  <Label htmlFor="var-start-date">Target Start Date *</Label>
                  <Input
                    id="var-start-date"
                    type="date"
                    value={vars.target_start_date}
                    onChange={e => setVars({ ...vars, target_start_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="var-manager">Setup Manager Name</Label>
                  <Input
                    id="var-manager"
                    value={vars.manager_name}
                    onChange={e => setVars({ ...vars, manager_name: e.target.value })}
                    placeholder="Manager name"
                  />
                </div>

                <div>
                  <Label htmlFor="var-intake-link">Intake Form Link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="var-intake-link"
                      value={vars.intake_form_link}
                      onChange={e => setVars({ ...vars, intake_form_link: e.target.value })}
                      placeholder="https://..."
                      className="flex-1"
                    />
                    {vars.intake_form_link && (
                      <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                        <a href={vars.intake_form_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Auto-populated info */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1 border">
                  <p className="font-medium text-gray-700 mb-1">Auto-populated from project:</p>
                  <p>Admin Fee: <strong>${(project.admin_fee_amount || 2500).toLocaleString()}</strong> ({project.admin_fee_paid ? 'Paid' : 'Pending Payment'})</p>
                  {isDFY && <p>Logistics Fee: <strong>$3,350</strong></p>}
                  <p>Recipient: <strong>{project.investor_email || 'No email on file'}</strong></p>
                  <p>Subject: <strong>Recap & Next Steps: Setting up your property!</strong></p>
                </div>
              </div>

              {/* Right: Plain Text Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-sm text-[#1a365d]">Live Text Preview</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyText}>
                    {copied ? <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy Text'}
                  </Button>
                </div>
                <div className="bg-white border rounded-lg p-4 text-sm font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed text-gray-700">
                  {plainTextPreview}
                </div>
              </div>
            </div>
          )}

          {activeView === 'preview' && (
            <div className="py-4">
              {previewHtml ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-sm text-[#1a365d]">Email Preview</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Subject: Recap & Next Steps: Setting up your property!
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        To: {project.investor_email || 'No email'}
                      </Badge>
                    </div>
                  </div>
                  <div className="border rounded-xl overflow-hidden shadow-sm bg-gray-50">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full border-0"
                      style={{ height: '600px' }}
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <Eye className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">Click "Email Preview" to generate the HTML preview</p>
                  <p className="text-sm text-gray-400 mt-1">This will show exactly how the email will look in the operator's inbox.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex items-center justify-between w-full gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCopyText} size="sm">
                <Copy className="w-4 h-4 mr-1" />
                Copy Text
              </Button>
              <Button variant="outline" onClick={onClose} size="sm">
                Cancel
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {project.investor_id && (
                <Button
                  onClick={() => handleSend('message')}
                  disabled={sending}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
                  Send as Portal Message
                </Button>
              )}
              <Button
                onClick={() => handleSend('email')}
                disabled={sending || !project.investor_email}
                className={isDFY ? 'bg-pink-600 hover:bg-pink-700' : 'bg-blue-600 hover:bg-blue-700'}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Send {isDFY ? 'DFY' : 'DIY'} Recap Email
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
