import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Mail, Eye, Send, RefreshCw, Save, Code, AlertCircle, CheckCircle, 
  Smartphone, MessageSquare, Phone, Clock, FileText
} from 'lucide-react';

interface Template {
  id: string;
  template_key: string;
  template_name: string;
  subject: string;
  html_content: string;
  description: string;
  variables: string;
  is_active: boolean;
  last_modified_by?: string;
  updated_at?: string;
}

interface SMSTemplate {
  key: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  maxLength: number;
}

const templateCategories = {
  acquisition: ['first_refusal_approved', 'deal_publicly_available', 'payment_success', 'manager_assigned', 'refusal_expired'],
  documents: ['document_signature_required', 'acquisition_agreement_ready', 'application_approved'],
  notifications: ['new_deal_match', 'new_deal_alert', 'new_article_alert']
};

// SMS Templates (these are defined in the edge function, shown here for reference/editing)
const smsTemplates: SMSTemplate[] = [
  {
    key: 'first_refusal_approved',
    name: 'First Right of Refusal (24hr Alert)',
    description: 'Sent when a deal is approved and investor has 24 hours to claim',
    template: '🏠 URGENT: You have 24 hours to claim "{{property_address}}" before it goes public. Projected: ${{projected_profit}}/mo. View now: {{portal_link}}',
    variables: ['property_address', 'projected_profit', 'portal_link'],
    maxLength: 160
  },
  {
    key: 'first_refusal_reminder',
    name: 'First Refusal Reminder',
    description: 'Sent when only a few hours remain on first right of refusal',
    template: '⏰ REMINDER: Only {{hours_remaining}} hours left to claim "{{property_address}}". Don\'t miss out! {{portal_link}}',
    variables: ['hours_remaining', 'property_address', 'portal_link'],
    maxLength: 160
  },
  {
    key: 'document_signature_required',
    name: 'Document Signature Required',
    description: 'Sent when a document needs investor signature',
    template: '📝 Action Required: "{{document_name}}" needs your signature. Please review and sign: {{signing_link}}',
    variables: ['document_name', 'signing_link', 'portal_link'],
    maxLength: 160
  },
  {
    key: 'application_approved',
    name: 'Application Approved',
    description: 'Sent when investor application is approved',
    template: '✅ Great news! Your application for "{{property_address}}" has been approved. Next steps available in your portal: {{portal_link}}',
    variables: ['property_address', 'portal_link'],
    maxLength: 160
  },
  {
    key: 'acquisition_agreement_ready',
    name: 'Acquisition Agreement Ready',
    description: 'Sent when acquisition agreement is ready for review',
    template: '📋 Your acquisition agreement for "{{property_address}}" is ready for review. Please review and sign: {{portal_link}}',
    variables: ['property_address', 'portal_link'],
    maxLength: 160
  },
  {
    key: 'new_deal_match',
    name: 'New Deal Match',
    description: 'Sent when a new deal matches investor preferences',
    template: '🎯 New deal matching your criteria! "{{property_address}}" - {{bedrooms}}BR, ${{price}}, {{projected_profit}}/mo profit. View: {{portal_link}}',
    variables: ['property_address', 'bedrooms', 'price', 'projected_profit', 'portal_link'],
    maxLength: 160
  },
  {
    key: 'payment_confirmed',
    name: 'Payment Confirmed',
    description: 'Sent when payment is successful',
    template: '💳 Payment of ${{amount}} confirmed for "{{property_address}}". Full address now available in your portal.',
    variables: ['amount', 'property_address'],
    maxLength: 160
  },
  {
    key: 'manager_assigned',
    name: 'Manager Assigned',
    description: 'Sent when acquisition manager is assigned',
    template: '👋 {{manager_name}} has been assigned to your account. They\'ll reach out soon to help with your investment journey!',
    variables: ['manager_name'],
    maxLength: 160
  },
  {
    key: 'deal_publicly_available',
    name: 'Deal Publicly Available',
    description: 'Sent when a deal becomes available to all investors',
    template: '🔓 "{{property_address}}" is now publicly available! {{bedrooms}}BR, ${{projected_profit}}/mo projected. Claim it before others: {{portal_link}}',
    variables: ['property_address', 'bedrooms', 'projected_profit', 'portal_link'],
    maxLength: 160
  },
  {
    key: 'refusal_expired',
    name: 'Refusal Period Expired',
    description: 'Sent to investor when their 24-hour window expires',
    template: '⌛ Your 24-hour window for "{{property_address}}" has expired. The deal is now available to other investors.',
    variables: ['property_address'],
    maxLength: 160
  }
];

export function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [activeTab, setActiveTab] = useState('acquisition');
  const [mainTab, setMainTab] = useState<'email' | 'sms'>('email');
  const [selectedSMS, setSelectedSMS] = useState<SMSTemplate | null>(null);
  const [smsPreviewOpen, setSmsPreviewOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'list' }
      });
      
      if (error) throw error;
      setTemplates(data?.templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast({ title: 'Error loading templates', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSelect = (templateKey: string) => {
    const t = templates.find(x => x.template_key === templateKey);
    setSelected(t ? { ...t } : null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'update',
          id: selected.id,
          subject: selected.subject,
          html_content: selected.html_content,
          template_name: selected.template_name,
          is_active: selected.is_active
        }
      });
      
      if (error || !data?.success) throw new Error('Failed to save');
      
      toast({ title: 'Template saved successfully!' });
      fetchTemplates();
    } catch (err) {
      toast({ title: 'Error saving template', variant: 'destructive' });
    }
    
    setSaving(false);
  };

  const handlePreview = async () => {
    if (!selected) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'preview',
          template_key: selected.template_key,
          html_content: selected.html_content,
          subject: selected.subject
        }
      });
      
      if (error || !data?.success) throw new Error('Failed to preview');
      
      setPreviewHtml(data.preview_html);
      setPreviewSubject(data.preview_subject);
      setPreviewOpen(true);
    } catch (err) {
      toast({ title: 'Error generating preview', variant: 'destructive' });
    }
  };

  const handleTestSend = async () => {
    if (!selected || !testEmail) return;
    setSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'send_test',
          template_key: selected.template_key,
          test_email: testEmail
        }
      });
      
      if (error || !data?.success) throw new Error(data?.error || 'Failed to send');
      
      toast({
        title: 'Test email sent!',
        description: `Check ${testEmail} for the test email`
      });
    } catch (err: any) {
      toast({
        title: 'Error sending test email',
        description: err.message,
        variant: 'destructive'
      });
    }
    
    setSending(false);
  };

  const handleTestSMS = async () => {
    if (!selectedSMS || !testPhone) return;
    setSendingSMS(true);
    
    try {
      // Generate sample message with test data
      let message = selectedSMS.template;
      const sampleData: Record<string, string> = {
        property_address: '123 Main St, Austin, TX',
        projected_profit: '2,500',
        portal_link: 'https://accessyourplace.com/portal',
        hours_remaining: '4',
        document_name: 'Lease Agreement',
        signing_link: 'https://accessyourplace.com/sign',
        bedrooms: '3',
        price: '350,000',
        amount: '499.00',
        manager_name: 'John Smith'
      };
      
      for (const [key, value] of Object.entries(sampleData)) {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      
      // Add [TEST] prefix
      message = '[TEST] ' + message;
      
      const { data, error } = await supabase.functions.invoke('send-sms-notification', {
        body: {
          action: 'send',
          phone_number: testPhone,
          notification_type: 'test',
          message: message
        }
      });
      
      if (error || !data?.success) throw new Error(data?.error || 'Failed to send SMS');
      
      toast({
        title: 'Test SMS sent!',
        description: `Check ${testPhone} for the test message`
      });
    } catch (err: any) {
      toast({
        title: 'Error sending test SMS',
        description: err.message,
        variant: 'destructive'
      });
    }
    
    setSendingSMS(false);
  };

  const handleReset = async () => {
    if (!selected) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'reset',
          template_key: selected.template_key
        }
      });
      
      if (error || !data?.success) throw new Error('Failed to reset');
      
      setSelected(data.template);
      toast({ title: 'Template reset to default' });
      fetchTemplates();
    } catch (err) {
      toast({ title: 'Error resetting template', variant: 'destructive' });
    }
  };

  const getTemplatesForCategory = (category: string) => {
    const keys = templateCategories[category as keyof typeof templateCategories] || [];
    return templates.filter(t => keys.includes(t.template_key));
  };

  const parseVariables = (variablesStr: string): string[] => {
    if (!variablesStr) return [];
    return variablesStr.split(',').map(v => v.trim()).filter(Boolean);
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const getSMSPreview = (template: SMSTemplate) => {
    let preview = template.template;
    const sampleData: Record<string, string> = {
      property_address: '123 Main St, Austin, TX',
      projected_profit: '2,500',
      portal_link: 'https://ayp.com/p',
      hours_remaining: '4',
      document_name: 'Lease Agreement',
      signing_link: 'https://ayp.com/s',
      bedrooms: '3',
      price: '350K',
      amount: '499',
      manager_name: 'John Smith'
    };
    
    for (const [key, value] of Object.entries(sampleData)) {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return preview;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#d4a574]" />
            Notification Templates
          </CardTitle>
          <CardDescription>
            Customize email and SMS notifications sent to investors. Preview and test before going live.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Main Tabs - Email vs SMS */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'email' | 'sms')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            SMS Templates
          </TabsTrigger>
        </TabsList>

        {/* Email Templates Tab */}
        <TabsContent value="email">
          {/* Category Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>

            {['acquisition', 'documents', 'notifications'].map(category => (
              <TabsContent key={category} value={category} className="space-y-4">
                {/* Template Selector */}
                <Card>
                  <CardContent className="pt-6">
                    <Label className="mb-2 block">Select Template to Edit</Label>
                    <Select
                      value={selected?.template_key || ''}
                      onValueChange={handleSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getTemplatesForCategory(category).map(t => (
                          <SelectItem key={t.template_key} value={t.template_key}>
                            <div className="flex items-center gap-2">
                              {t.is_active ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-400" />
                              )}
                              {t.template_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Template Editor */}
                {selected && templateCategories[category as keyof typeof templateCategories]?.includes(selected.template_key) && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{selected.template_name}</CardTitle>
                          <CardDescription>{selected.description}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="active-switch" className="text-sm">Active</Label>
                          <Switch
                            id="active-switch"
                            checked={selected.is_active}
                            onCheckedChange={(v) => setSelected({ ...selected, is_active: v })}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Subject Line */}
                      <div>
                        <Label htmlFor="subject">Subject Line</Label>
                        <Input
                          id="subject"
                          value={selected.subject}
                          onChange={(e) => setSelected({ ...selected, subject: e.target.value })}
                          className="mt-1"
                          placeholder="Email subject..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Use {'{{variable}}'} syntax for dynamic content
                        </p>
                      </div>

                      {/* HTML Content */}
                      <div>
                        <Label htmlFor="html-content">HTML Template</Label>
                        <Textarea
                          id="html-content"
                          value={selected.html_content}
                          onChange={(e) => setSelected({ ...selected, html_content: e.target.value })}
                          rows={16}
                          className="mt-1 font-mono text-sm"
                          placeholder="HTML email content..."
                        />
                      </div>

                      {/* Available Variables */}
                      <div>
                        <Label>Available Variables</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {parseVariables(selected.variables).map(v => (
                            <Badge
                              key={v}
                              variant="outline"
                              className="font-mono text-xs cursor-pointer hover:bg-gray-100"
                              onClick={() => {
                                navigator.clipboard.writeText(`{{${v}}}`);
                                toast({ title: `Copied {{${v}}} to clipboard` });
                              }}
                            >
                              {`{{${v}}}`}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Click a variable to copy it to clipboard
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-3 pt-4 border-t">
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-[#1e3a5f] hover:bg-[#2d5a87]"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={handlePreview}>
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                        <Button variant="outline" onClick={handleReset}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reset to Default
                        </Button>
                      </div>

                      {/* Test Email Section */}
                      <div className="pt-4 border-t">
                        <Label className="mb-2 block" htmlFor="send-test-email">Send Test Email</Label>
                        <div className="flex gap-2">
                          <Input id="send-test-email"
                            placeholder="your@email.com"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            onClick={handleTestSend}
                            disabled={sending || !testEmail}
                            variant="outline"
                          >
                            {sending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-2" />
                                Send Test
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Test emails are sent with sample data and marked with [TEST] in the subject
                        </p>
                      </div>

                      {/* Last Modified */}
                      {selected.updated_at && (
                        <p className="text-xs text-gray-400 pt-4 border-t">
                          Last modified: {new Date(selected.updated_at).toLocaleString()}
                          {selected.last_modified_by && ` by ${selected.last_modified_by}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* SMS Templates Tab */}
        <TabsContent value="sms">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SMS Template List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  SMS Templates
                </CardTitle>
                <CardDescription>
                  View and test SMS notification templates. SMS templates are optimized for 160 characters.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {smsTemplates.map((template) => (
                      <div
                        key={template.key}
                        className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-[#1e3a5f] ${
                          selectedSMS?.key === template.key ? 'border-[#1e3a5f] bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedSMS(template)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {getSMSPreview(template).length} chars
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{template.description}</p>
                        <p className="text-xs font-mono bg-gray-100 p-2 rounded truncate">
                          {template.template.substring(0, 60)}...
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* SMS Template Detail */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedSMS ? selectedSMS.name : 'Select a Template'}
                </CardTitle>
                {selectedSMS && (
                  <CardDescription>{selectedSMS.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {selectedSMS ? (
                  <div className="space-y-6">
                    {/* Template Content */}
                    <div>
                      <Label>Template Content</Label>
                      <div className="mt-2 p-4 bg-gray-50 rounded-lg border font-mono text-sm">
                        {selectedSMS.template}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-500">
                          Character count: {selectedSMS.template.length}
                        </p>
                        {selectedSMS.template.length > 160 && (
                          <Badge variant="destructive" className="text-xs">
                            Exceeds 160 char limit
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Preview with Sample Data */}
                    <div>
                      <Label>Preview with Sample Data</Label>
                      <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-100 rounded-full">
                            <Smartphone className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-800 mb-1">
                              Access Your Place
                            </p>
                            <p className="text-sm text-gray-700">
                              {getSMSPreview(selectedSMS)}
                            </p>
                            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Just now
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Preview length: {getSMSPreview(selectedSMS).length} characters
                      </p>
                    </div>

                    {/* Available Variables */}
                    <div>
                      <Label>Available Variables</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedSMS.variables.map(v => (
                          <Badge
                            key={v}
                            variant="outline"
                            className="font-mono text-xs cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${v}}}`);
                              toast({ title: `Copied {{${v}}} to clipboard` });
                            }}
                          >
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Test SMS Section */}
                    <div className="pt-4 border-t">
                      <Label className="mb-2 block">Send Test SMS</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input aria-label="(555) 123-4567"
                            placeholder="(555) 123-4567"
                            value={testPhone}
                            onChange={(e) => setTestPhone(formatPhoneNumber(e.target.value))}
                            className="pl-10"
                          />
                        </div>
                        <Button
                          onClick={handleTestSMS}
                          disabled={sendingSMS || !testPhone || testPhone.replace(/\D/g, '').length !== 10}
                          variant="outline"
                        >
                          {sendingSMS ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Send Test
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Test SMS will be prefixed with [TEST] and sent to the number above
                      </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">SMS Template Notes</p>
                          <ul className="text-xs space-y-1 text-blue-700">
                            <li>• SMS templates are defined in the edge function code</li>
                            <li>• Keep messages under 160 characters for single SMS</li>
                            <li>• Investors must opt-in to receive SMS notifications</li>
                            <li>• Standard carrier rates may apply to recipients</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <MessageSquare className="w-12 h-12 mb-4 text-gray-300" />
                    <p>Select a template to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Email Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Email Preview
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="bg-gray-100 p-4 rounded-lg">
              <Label className="text-sm text-gray-600">Subject:</Label>
              <p className="font-medium text-lg">{previewSubject}</p>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b flex items-center gap-2">
                <Code className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Email Body Preview</span>
              </div>
              <div className="p-4 bg-white">
                <div
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  className="max-w-[600px] mx-auto"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
