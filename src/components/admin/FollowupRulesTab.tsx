import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Play,
  History,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Settings,
  Zap
} from 'lucide-react';

interface FollowupRule {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  delay_hours: number;
  max_followups: number;
  email_template_key?: string;
  sms_template?: string;
  push_title?: string;
  push_body?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FollowupLog {
  id: string;
  rule_id: string;
  investor_id: string;
  reference_id: string;
  reference_type: string;
  followup_number: number;
  email_sent: boolean;
  sms_sent: boolean;
  push_sent: boolean;
  sent_at: string;
  followup_rules?: { name: string; trigger_event: string };
  investors?: { email: string; full_name: string };
}

const triggerEventOptions = [
  { value: 'first_refusal_no_response', label: 'First Refusal No Response', description: 'When investor hasn\'t responded to first refusal' },
  { value: 'document_unsigned', label: 'Document Unsigned', description: 'When documents are pending signature' },
  { value: 'payment_pending', label: 'Payment Pending', description: 'When payment is awaiting completion' },
  { value: 'inquiry_no_response', label: 'Inquiry No Response', description: 'When inquiry hasn\'t been addressed' },
  { value: 'application_approved', label: 'Application Approved', description: 'When investor application is approved' },
  { value: 'new_deal_match', label: 'New Deal Match', description: 'When new deal matches investor preferences' },
  { value: 'manager_assigned', label: 'Manager Assigned', description: 'When acquisition manager is assigned' }
];


export function FollowupRulesTab() {
  const [rules, setRules] = useState<FollowupRule[]>([]);
  const [logs, setLogs] = useState<FollowupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');
  const [editingRule, setEditingRule] = useState<FollowupRule | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_event: '',
    delay_hours: 12,
    max_followups: 2,
    email_template_key: '',
    sms_template: '',
    push_title: '',
    push_body: '',
    is_active: true
  });

  useEffect(() => {
    fetchRules();
    fetchLogs();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('process-followups', {
        body: { action: 'get_rules' }
      });
      
      if (fetchError) {
        console.error('[FollowupRulesTab] Error fetching rules:', fetchError);
        setError('Unable to load follow-up rules. The feature may not be configured yet.');
        setRules([]);
      } else if (data?.rules) {
        setRules(data.rules);
      } else {
        setRules([]);
      }
    } catch (err: any) {
      console.error('[FollowupRulesTab] Exception fetching rules:', err);
      setError('Unable to connect to the server. Please try again later.');
      setRules([]);
    }
    
    setLoading(false);
  };


  const fetchLogs = async () => {
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('process-followups', {
        body: { action: 'get_logs', limit: 100 }
      });
      
      if (fetchError) {
        console.error('[FollowupRulesTab] Error fetching logs:', fetchError);
        setLogs([]);
      } else if (data?.logs) {
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error('[FollowupRulesTab] Exception fetching logs:', err);
      setLogs([]);
    }
  };

  const runFollowups = async () => {
    setProcessing(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-followups', {
        body: { action: 'process_all' }
      });
      
      if (invokeError) {
        toast({ title: 'Error processing follow-ups', description: invokeError.message, variant: 'destructive' });
      } else if (data?.success) {
        toast({
          title: 'Follow-ups Processed',
          description: `Sent ${data.followups_sent || 0} follow-up notifications`
        });
        fetchLogs();
      }
    } catch (err: any) {
      toast({ title: 'Error processing follow-ups', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };


  const saveRule = async () => {
    try {
      const ruleData = editingRule 
        ? { ...formData, id: editingRule.id }
        : formData;

      const { data, error: invokeError } = await supabase.functions.invoke('process-followups', {
        body: { action: 'save_rule', rule: ruleData }
      });

      if (invokeError) {
        toast({ title: 'Error saving rule', description: invokeError.message, variant: 'destructive' });
      } else if (data?.success) {
        toast({ title: editingRule ? 'Rule updated' : 'Rule created' });
        setShowEditor(false);
        setEditingRule(null);
        resetForm();
        fetchRules();
      }
    } catch (err: any) {
      toast({ title: 'Error saving rule', description: err.message, variant: 'destructive' });
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-followups', {
        body: { action: 'delete_rule', rule_id: ruleId }
      });

      if (invokeError) {
        toast({ title: 'Error deleting rule', description: invokeError.message, variant: 'destructive' });
      } else if (data?.success) {
        toast({ title: 'Rule deleted' });
        fetchRules();
      }
    } catch (err: any) {
      toast({ title: 'Error deleting rule', description: err.message, variant: 'destructive' });
    }
  };

  const toggleRuleActive = async (rule: FollowupRule) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-followups', {
        body: { 
          action: 'save_rule', 
          rule: { id: rule.id, is_active: !rule.is_active }
        }
      });

      if (invokeError) {
        toast({ title: 'Error updating rule', description: invokeError.message, variant: 'destructive' });
      } else if (data?.success) {
        setRules(rules.map(r => 
          r.id === rule.id ? { ...r, is_active: !r.is_active } : r
        ));
        toast({ title: `Rule ${!rule.is_active ? 'enabled' : 'disabled'}` });
      }
    } catch (err: any) {
      toast({ title: 'Error updating rule', description: err.message, variant: 'destructive' });
    }
  };

  const openEditor = (rule?: FollowupRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        trigger_event: rule.trigger_event,
        delay_hours: rule.delay_hours,
        max_followups: rule.max_followups,
        email_template_key: rule.email_template_key || '',
        sms_template: rule.sms_template || '',
        push_title: rule.push_title || '',
        push_body: rule.push_body || '',
        is_active: rule.is_active
      });
    } else {
      setEditingRule(null);
      resetForm();
    }
    setShowEditor(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_event: '',
      delay_hours: 12,
      max_followups: 2,
      email_template_key: '',
      sms_template: '',
      push_title: '',
      push_body: '',
      is_active: true
    });
  };

  const getTriggerLabel = (event: string) => {
    return triggerEventOptions.find(o => o.value === event)?.label || event;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" aria-hidden="true" />
        <span className="sr-only">Loading follow-up rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1e3a5f] rounded-lg" aria-hidden="true">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Automated Follow-ups</CardTitle>
                <CardDescription>
                  Configure automatic reminder notifications for investor actions
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={runFollowups}
                disabled={processing}
                aria-label="Run follow-ups now"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Run Now
              </Button>
              <Button onClick={() => openEditor()} className="bg-[#1e3a5f] hover:bg-[#2d5a87]">
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                New Rule
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-amber-800">Follow-up Rules Unavailable</p>
                <p className="text-sm text-amber-700 mt-1">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={fetchRules}
                >
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList aria-label="Follow-up sections">
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings className="w-4 h-4" aria-hidden="true" />
            Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="w-4 h-4" aria-hidden="true" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <div className="grid gap-4" role="list" aria-label="Follow-up rules">
            {rules.length === 0 && !error ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mb-4 text-gray-300" aria-hidden="true" />
                  <p className="text-lg font-medium">No follow-up rules</p>
                  <p className="text-sm">Create your first automated follow-up rule</p>
                  <Button onClick={() => openEditor()} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                    Create Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''} role="listitem">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1 text-gray-500">
                            <AlertCircle className="w-4 h-4" aria-hidden="true" />
                            <span>Trigger: {getTriggerLabel(rule.trigger_event)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-4 h-4" aria-hidden="true" />
                            <span>Delay: {rule.delay_hours}h</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <RefreshCw className="w-4 h-4" aria-hidden="true" />
                            <span>Max: {rule.max_followups} follow-ups</span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          {rule.email_template_key && (
                            <Badge variant="outline" className="text-blue-600">
                              <Mail className="w-3 h-3 mr-1" aria-hidden="true" />
                              Email
                            </Badge>
                          )}
                          {rule.sms_template && (
                            <Badge variant="outline" className="text-green-600">
                              <MessageSquare className="w-3 h-3 mr-1" aria-hidden="true" />
                              SMS
                            </Badge>
                          )}
                          {rule.push_title && (
                            <Badge variant="outline" className="text-purple-600">
                              <Smartphone className="w-3 h-3 mr-1" aria-hidden="true" />
                              Push
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => toggleRuleActive(rule)}
                          aria-label={`Toggle ${rule.name} ${rule.is_active ? 'off' : 'on'}`}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditor(rule)}
                          aria-label={`Edit ${rule.name}`}
                        >
                          <Edit className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => deleteRule(rule.id)}
                          className="text-red-600 hover:text-red-700"
                          aria-label={`Delete ${rule.name}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <History className="w-12 h-12 mb-4 text-gray-300" aria-hidden="true" />
                  <p className="text-lg font-medium">No follow-up activity</p>
                  <p className="text-sm">Follow-up logs will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="divide-y" role="list" aria-label="Follow-up activity log">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-gray-50" role="listitem">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {log.followup_rules?.name || 'Unknown Rule'}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                #{log.followup_number}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              {log.investors?.full_name || log.investors?.email || 'Unknown Investor'}
                            </p>
                            <div className="flex gap-2 mt-2">
                              {log.email_sent && (
                                <Badge variant="outline" className="text-xs text-blue-600">
                                  <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                                  Email
                                </Badge>
                              )}
                              {log.sms_sent && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                                  SMS
                                </Badge>
                              )}
                              {log.push_sent && (
                                <Badge variant="outline" className="text-xs text-purple-600">
                                  <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                                  Push
                                </Badge>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">
                            {formatDate(log.sent_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule Editor Modal */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="rule-editor-description">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Follow-up Rule' : 'Create Follow-up Rule'}
            </DialogTitle>
            <DialogDescription id="rule-editor-description">
              Configure automated follow-up notifications for investor actions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., First Refusal 12-Hour Reminder"
                />
              </div>

              <div>
                <Label htmlFor="rule-description">Description</Label>
                <Textarea
                  id="rule-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this rule does..."
                  rows={2}
                />
              </div>
            </div>

            {/* Trigger Settings */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                Trigger Settings
              </h4>

              <div>
                <Label htmlFor="trigger-event">Trigger Event</Label>
                <Select
                  value={formData.trigger_event}
                  onValueChange={(v) => setFormData({ ...formData, trigger_event: v })}
                >
                  <SelectTrigger id="trigger-event">
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerEventOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div>
                          <p>{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delay-hours">Delay (hours)</Label>
                  <Input
                    id="delay-hours"
                    type="number"
                    min="0"
                    value={formData.delay_hours}
                    onChange={(e) => setFormData({ ...formData, delay_hours: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Wait this long after trigger before sending
                  </p>
                </div>

                <div>
                  <Label htmlFor="max-followups">Max Follow-ups</Label>
                  <Input
                    id="max-followups"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.max_followups}
                    onChange={(e) => setFormData({ ...formData, max_followups: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum reminders to send
                  </p>
                </div>
              </div>
            </div>

            {/* SMS Template */}
            <div className="space-y-2">
              <Label htmlFor="sms-template" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-600" aria-hidden="true" />
                SMS Template
              </Label>
              <Textarea
                id="sms-template"
                value={formData.sms_template}
                onChange={(e) => setFormData({ ...formData, sms_template: e.target.value })}
                placeholder="Your reminder message... Use {{portal_link}} for portal URL"
                rows={3}
              />
              <p className="text-xs text-gray-500">
                {formData.sms_template.length}/160 characters (SMS limit)
              </p>
            </div>

            {/* Push Notification */}
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-600" aria-hidden="true" />
                Push Notification
              </h4>

              <div>
                <Label htmlFor="push-title">Title</Label>
                <Input
                  id="push-title"
                  value={formData.push_title}
                  onChange={(e) => setFormData({ ...formData, push_title: e.target.value })}
                  placeholder="e.g., First Refusal Expiring Soon"
                />
              </div>

              <div>
                <Label htmlFor="push-body">Body</Label>
                <Textarea
                  id="push-body"
                  value={formData.push_body}
                  onChange={(e) => setFormData({ ...formData, push_body: e.target.value })}
                  placeholder="Brief notification message..."
                  rows={2}
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Rule Active</p>
                <p className="text-sm text-gray-500">Enable or disable this follow-up rule</p>
              </div>
              <Switch
                id="rule-active"
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                aria-label="Toggle rule active status"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveRule}
              disabled={!formData.name || !formData.trigger_event}
              className="bg-[#1e3a5f] hover:bg-[#2d5a87]"
            >
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
