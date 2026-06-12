import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { notifyAMAboutAction } from '@/utils/notifyAM';

import { 
  Loader2, AlertTriangle, MessageSquare, Clock, CheckCircle, 
  XCircle, FileText, Upload, Send, Scale, Shield, HelpCircle,
  DollarSign, Home, Users, Wrench, Building, RefreshCw
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
  investorEmail: string;
}

interface Dispute {
  id: string;
  category: string;
  subcategory: string;
  subject: string;
  description: string;
  status: 'submitted' | 'under_review' | 'awaiting_response' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resolution?: string;
  created_at: string;
  updated_at: string;
  messages: DisputeMessage[];
  attachments: string[];
}

interface DisputeMessage {
  id: string;
  sender_type: 'investor' | 'staff';
  sender_name: string;
  message: string;
  created_at: string;
}

const DISPUTE_CATEGORIES = [
  { 
    value: 'operation_delays', 
    label: 'Operation Delays', 
    icon: Clock,
    description: 'Issues with setup timelines, furniture delivery delays, or operational setbacks',
    subcategories: ['Setup Timeline', 'Furniture Delivery', 'Contractor Delays', 'Listing Delays', 'Other']
  },
  { 
    value: 'credit_request', 
    label: 'Credit Requests', 
    icon: DollarSign,
    description: 'Request credits for service issues, compensation, or promotional credits',
    subcategories: ['Service Compensation', 'Promotional Credit', 'Referral Credit Issue', 'Other']
  },
  { 
    value: 'refund_request', 
    label: 'Refund Requests', 
    icon: RefreshCw,
    description: 'Refunds for furniture costs, setup fees, or other charges',
    subcategories: ['Furniture Cost Refund', 'Setup Fee Refund', 'Verification Fee Refund', 'Other']
  },
  { 
    value: 'property_verification', 
    label: 'Property Verification', 
    icon: Home,
    description: 'Disputes about property verification results or processes',
    subcategories: ['Verification Accuracy', 'Verification Timeline', 'Missing Information', 'Other']
  },
  { 
    value: 'corporate_application', 
    label: 'Corporate Applications', 
    icon: Building,
    description: 'Issues with corporate housing applications or community approvals',
    subcategories: ['Application Rejection', 'Application Delays', 'Documentation Issues', 'Other']
  },
  { 
    value: 'operator_dispute', 
    label: 'Operator Disputes', 
    icon: Users,
    description: 'Issues with other operators on the Access Your Place platform',
    subcategories: ['Transaction Dispute', 'Communication Issues', 'Property Condition', 'Access Transfer', 'Other']
  },
  { 
    value: 'vendor_issue', 
    label: 'Vendor Issues', 
    icon: Wrench,
    description: 'Problems with vendors connected through Access Your Place',
    subcategories: ['Service Quality', 'Pricing Dispute', 'No-Show', 'Damage', 'Other']
  },
  { 
    value: 'other', 
    label: 'Other Issues', 
    icon: HelpCircle,
    description: 'Any other issues not covered by the categories above',
    subcategories: ['Platform Issue', 'Billing Issue', 'Account Issue', 'Other']
  }
];

export function DisputeResolutionCenter({ investorId, investorName, investorEmail }: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newDisputeOpen, setNewDisputeOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [newDispute, setNewDispute] = useState({
    category: '',
    subcategory: '',
    subject: '',
    description: '',
    priority: 'medium' as const,
    attachments: [] as File[]
  });
  const { toast } = useToast();

  useEffect(() => {
    loadDisputes();
  }, [investorId]);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-disputes', {
        body: { action: 'get_investor_disputes', investor_id: investorId }
      });
      if (data?.disputes) {
        setDisputes(data.disputes);
      }
    } catch (err) {
      console.error('Error loading disputes:', err);
    }
    setLoading(false);
  };


  const handleSubmitDispute = async () => {
    if (!newDispute.category || !newDispute.subject || !newDispute.description) {
      toast({ 
        title: 'Missing Information', 
        description: 'Please fill in all required fields', 
        variant: 'destructive' 
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-disputes', {
        body: {
          action: 'create',
          investor_id: investorId,
          ...newDispute
        }
      });



      if (data?.success) {
        toast({ 
          title: 'Dispute Submitted', 
          description: 'Our success team will review your case and respond within 24-48 hours.' 
        });
        const categoryLabel = DISPUTE_CATEGORIES.find(c => c.value === newDispute.category)?.label || newDispute.category;
        notifyAMAboutAction(investorId, 'New Dispute', `Submitted a ${newDispute.priority} priority dispute — Category: ${categoryLabel}, Subject: "${newDispute.subject}"`);

        setNewDisputeOpen(false);
        setNewDispute({
          category: '',
          subcategory: '',
          subject: '',
          description: '',
          priority: 'medium',
          attachments: []
        });
        loadDisputes();
      } else {
        throw new Error(data?.error || 'Failed to submit dispute');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleSendReply = async () => {
    if (!selectedDispute || !replyMessage.trim()) return;

    setSendingReply(true);
    try {

      const { data, error } = await supabase.functions.invoke('manage-disputes', {
        body: {
          action: 'add_message',
          dispute_id: selectedDispute.id,
          sender_type: 'investor',
          sender_id: investorId,
          sender_name: investorName,
          message: replyMessage
        }
      });


      if (data?.success) {
        toast({ title: 'Message Sent' });
        setReplyMessage('');
        // Refresh dispute details
        const updated = { ...selectedDispute };
        updated.messages = [...updated.messages, {
          id: Date.now().toString(),
          sender_type: 'investor',
          sender_name: investorName,
          message: replyMessage,
          created_at: new Date().toISOString()
        }];
        setSelectedDispute(updated);
        loadDisputes();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSendingReply(false);
  };

  const openDisputeDetail = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setDetailOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
      submitted: { variant: 'secondary' },
      under_review: { variant: 'default', className: 'bg-blue-500' },
      awaiting_response: { variant: 'default', className: 'bg-yellow-500' },
      resolved: { variant: 'default', className: 'bg-green-500' },
      closed: { variant: 'outline' }
    };
    const labels: Record<string, string> = {
      submitted: 'Submitted',
      under_review: 'Under Review',
      awaiting_response: 'Awaiting Your Response',
      resolved: 'Resolved',
      closed: 'Closed'
    };
    const s = styles[status] || styles.submitted;
    return <Badge variant={s.variant} className={s.className}>{labels[status] || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[priority] || styles.medium}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const selectedCategory = DISPUTE_CATEGORIES.find(c => c.value === newDispute.category);

  const activeDisputes = disputes.filter(d => !['resolved', 'closed'].includes(d.status));
  const resolvedDisputes = disputes.filter(d => ['resolved', 'closed'].includes(d.status));

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12" role="status" aria-label="Loading disputes">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="sr-only">Loading dispute resolution center...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Dispute Resolution Center">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dispute & Issue Resolution</h2>
          <p className="text-gray-600">
            Submit and track disputes, issues, or requests with our success team
          </p>
        </div>
        <Button 
          onClick={() => setNewDisputeOpen(true)}
          className="bg-[#d4a574] hover:bg-[#c49464]"
          aria-label="Submit a new dispute or issue"
        >
          <AlertTriangle className="w-4 h-4 mr-2" aria-hidden="true" />
          Submit New Issue
        </Button>
      </div>

      {/* Stats Overview */}
      <section aria-labelledby="dispute-stats-heading">
        <h3 id="dispute-stats-heading" className="sr-only">Dispute Statistics</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg" aria-hidden="true">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{disputes.length}</p>
                  <p className="text-sm text-muted-foreground">Total Cases</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg" aria-hidden="true">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeDisputes.length}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg" aria-hidden="true">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resolvedDisputes.length}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg" aria-hidden="true">
                  <Scale className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">24-48h</p>
                  <p className="text-sm text-muted-foreground">Response Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Disputes List */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList aria-label="Dispute categories">
          <TabsTrigger value="active">
            Active ({activeDisputes.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({resolvedDisputes.length})
          </TabsTrigger>
          <TabsTrigger value="faq">
            FAQ & Guidelines
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {activeDisputes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p className="font-medium">No active disputes</p>
                  <p className="text-sm">All your issues have been resolved!</p>
                </div>
              ) : (
                <div className="space-y-4" role="list" aria-label="Active disputes">
                  {activeDisputes.map(dispute => (
                    <article 
                      key={dispute.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => openDisputeDetail(dispute)}
                      role="listitem"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openDisputeDetail(dispute)}
                      aria-label={`${dispute.subject} - ${dispute.status}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(dispute.status)}
                            {getPriorityBadge(dispute.priority)}
                          </div>
                          <h4 className="font-semibold text-gray-900">{dispute.subject}</h4>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {dispute.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>
                              Category: {DISPUTE_CATEGORIES.find(c => c.value === dispute.category)?.label || dispute.category}
                            </span>
                            <span>
                              Opened: {new Date(dispute.created_at).toLocaleDateString()}
                            </span>
                            {dispute.messages?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" aria-hidden="true" />
                                {dispute.messages.length} messages
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolved">
          <Card>
            <CardContent className="pt-6">
              {resolvedDisputes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p className="font-medium">No resolved disputes</p>
                  <p className="text-sm">Your resolved cases will appear here</p>
                </div>
              ) : (
                <div className="space-y-4" role="list" aria-label="Resolved disputes">
                  {resolvedDisputes.map(dispute => (
                    <article 
                      key={dispute.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => openDisputeDetail(dispute)}
                      role="listitem"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openDisputeDetail(dispute)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(dispute.status)}
                          </div>
                          <h4 className="font-semibold text-gray-900">{dispute.subject}</h4>
                          {dispute.resolution && (
                            <p className="text-sm text-green-700 bg-green-50 p-2 rounded mt-2">
                              <strong>Resolution:</strong> {dispute.resolution}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Resolved: {new Date(dispute.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>Dispute Resolution Guidelines</CardTitle>
              <CardDescription>
                Understanding our dispute resolution process and terms of service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="process">
                  <AccordionTrigger>How does the dispute resolution process work?</AccordionTrigger>
                  <AccordionContent>
                    <ol className="list-decimal list-inside space-y-2 text-gray-600">
                      <li>Submit your dispute with all relevant details and documentation</li>
                      <li>Our success team reviews your case within 24-48 hours</li>
                      <li>We may request additional information or documentation</li>
                      <li>We review our terms of service and work towards a fair resolution</li>
                      <li>You'll receive a resolution proposal that you can accept or discuss further</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="refunds">
                  <AccordionTrigger>What is the refund policy for furniture costs?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-gray-600">
                      Remaining furniture costs at the end of a setup may be eligible for refund based on:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
                      <li>Unused items that can be returned to vendors</li>
                      <li>Items not delivered or installed</li>
                      <li>Budget overages due to our error</li>
                    </ul>
                    <p className="text-gray-600 mt-2">
                      Refunds are processed within 5-7 business days after approval.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="credits">
                  <AccordionTrigger>How do I request platform credits?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-gray-600">
                      Credits may be issued for service delays, issues, or as goodwill gestures. 
                      Submit a credit request through this portal with:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
                      <li>Description of the issue that warrants credit</li>
                      <li>Any supporting documentation or screenshots</li>
                      <li>The amount of credit you believe is fair</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="verification">
                  <AccordionTrigger>What if I disagree with a property verification?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-gray-600">
                      If you believe a property verification was inaccurate, you can dispute it by providing:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
                      <li>Evidence that contradicts the verification findings</li>
                      <li>Updated documentation or lease terms</li>
                      <li>Communication from the landlord or property manager</li>
                    </ul>
                    <p className="text-gray-600 mt-2">
                      We will re-review the verification and issue a revised report if warranted.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="operators">
                  <AccordionTrigger>How are disputes with other operators handled?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-gray-600">
                      For marketplace transactions between operators:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
                      <li>Both parties will be contacted for their perspective</li>
                      <li>Transaction records and communications are reviewed</li>
                      <li>Escrow funds are held until resolution</li>
                      <li>Our team mediates to find a fair outcome</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="timeline">
                  <AccordionTrigger>What is the typical resolution timeline?</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 text-gray-600">
                      <li><strong>Initial Response:</strong> 24-48 hours</li>
                      <li><strong>Simple Issues:</strong> 3-5 business days</li>
                      <li><strong>Complex Disputes:</strong> 7-14 business days</li>
                      <li><strong>Operator Disputes:</strong> 14-21 business days</li>
                    </ul>
                    <p className="text-gray-600 mt-2">
                      Urgent matters are prioritized and may be resolved faster.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Dispute Dialog */}
      <Dialog open={newDisputeOpen} onOpenChange={setNewDisputeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="new-dispute-description">
          <DialogHeader>
            <DialogTitle>Submit New Dispute or Issue</DialogTitle>
            <DialogDescription id="new-dispute-description">
              Describe your issue and our success team will review it within 24-48 hours
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Category Selection */}
            <div>
              <Label htmlFor="dispute-category">Issue Category *</Label>
              <Select
                value={newDispute.category}
                onValueChange={(value) => setNewDispute({ ...newDispute, category: value, subcategory: '' })}
              >
                <SelectTrigger id="dispute-category" aria-required="true">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {DISPUTE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4" aria-hidden="true" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory && (
                <p className="text-sm text-gray-500 mt-1">{selectedCategory.description}</p>
              )}
            </div>

            {/* Subcategory */}
            {selectedCategory && (
              <div>
                <Label htmlFor="dispute-subcategory">Specific Issue *</Label>
                <Select
                  value={newDispute.subcategory}
                  onValueChange={(value) => setNewDispute({ ...newDispute, subcategory: value })}
                >
                  <SelectTrigger id="dispute-subcategory" aria-required="true">
                    <SelectValue placeholder="Select specific issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCategory.subcategories.map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Priority */}
            <div>
              <Label htmlFor="dispute-priority">Priority Level</Label>
              <Select
                value={newDispute.priority}
                onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => 
                  setNewDispute({ ...newDispute, priority: value })
                }
              >
                <SelectTrigger id="dispute-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - General inquiry</SelectItem>
                  <SelectItem value="medium">Medium - Needs attention</SelectItem>
                  <SelectItem value="high">High - Significant impact</SelectItem>
                  <SelectItem value="urgent">Urgent - Immediate attention needed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="dispute-subject">Subject *</Label>
              <Input
                id="dispute-subject"
                value={newDispute.subject}
                onChange={(e) => setNewDispute({ ...newDispute, subject: e.target.value })}
                placeholder="Brief summary of your issue"
                aria-required="true"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="dispute-description">Detailed Description *</Label>
              <Textarea
                id="dispute-description"
                value={newDispute.description}
                onChange={(e) => setNewDispute({ ...newDispute, description: e.target.value })}
                placeholder="Please provide as much detail as possible including dates, property addresses, amounts, and any relevant context..."
                rows={6}
                aria-required="true"
              />
            </div>

            {/* File Upload Placeholder */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-600">
                Drag and drop files here, or click to upload
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports: PDF, Images, Documents (Max 10MB each)
              </p>
              <Input
                type="file"
                multiple
                className="mt-2"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setNewDispute({ ...newDispute, attachments: files });
                }}
                aria-label="Upload supporting documents"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDisputeOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitDispute} 
              disabled={submitting}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="dispute-detail-description">
          {selectedDispute && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedDispute.status)}
                  {getPriorityBadge(selectedDispute.priority)}
                </div>
                <DialogTitle>{selectedDispute.subject}</DialogTitle>
                <DialogDescription id="dispute-detail-description">
                  Case #{selectedDispute.id.slice(0, 8)} • Opened {new Date(selectedDispute.created_at).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Original Description */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Original Issue</h4>
                  <p className="text-gray-600">{selectedDispute.description}</p>
                </div>

                {/* Resolution (if resolved) */}
                {selectedDispute.resolution && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <h4 className="font-medium text-sm text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" aria-hidden="true" />
                      Resolution
                    </h4>
                    <p className="text-green-700">{selectedDispute.resolution}</p>
                  </div>
                )}

                {/* Message Thread */}
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-3">Communication</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto" role="log" aria-label="Message thread">
                    {selectedDispute.messages?.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No messages yet. Our team will respond soon.
                      </p>
                    ) : (
                      selectedDispute.messages?.map(msg => (
                        <div 
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.sender_type === 'investor' 
                              ? 'bg-[#d4a574]/10 ml-8' 
                              : 'bg-blue-50 mr-8'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">
                              {msg.sender_type === 'investor' ? 'You' : msg.sender_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{msg.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Reply Box (if not resolved) */}
                {!['resolved', 'closed'].includes(selectedDispute.status) && (
                  <div className="border-t pt-4">
                    <Label htmlFor="reply-message" className="sr-only">Reply message</Label>
                    <div className="flex gap-2">
                      <Textarea
                        id="reply-message"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        rows={2}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyMessage.trim()}
                        className="bg-[#d4a574] hover:bg-[#c49464]"
                        aria-label="Send reply"
                      >
                        {sendingReply ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Send className="w-4 h-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
