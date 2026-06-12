import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, UserCheck, User, Mail, Phone, Calendar, 
  MessageSquare, RefreshCw, CheckCircle, Clock, AlertTriangle,
  UserPlus, ArrowRight, Shield, Send, HelpCircle
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
  investorEmail?: string;
  currentAM?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  onAMUpdated?: (am: any) => void;
  onNavigateToMessages?: () => void;
}

export function AcquisitionManagerSection({ investorId, investorName, investorEmail, currentAM, onAMUpdated, onNavigateToMessages }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amInfo, setAmInfo] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  
  // Request AM form
  const [requestAMOpen, setRequestAMOpen] = useState(false);
  const [investmentGoals, setInvestmentGoals] = useState('');
  const [preferredMarkets, setPreferredMarkets] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [existingAMName, setExistingAMName] = useState('');
  const [hasExistingAM, setHasExistingAM] = useState(false);
  
  // Request different AM
  const [requestChangeOpen, setRequestChangeOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [preferredAMName, setPreferredAMName] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadAMInfo();
  }, [investorId]);

  const loadAMInfo = async () => {
    setLoading(true);
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('investor-auth', {
        body: { 
          action: 'get_am_info', 
          investor_id: investorId 
        }
      });

      if (!error && data?.am) {
        setAmInfo(data.am);
        if (data.pending_request) {
          setPendingRequest(data.pending_request);
        }
      } else {
        // DB fallback: query investor_profiles for AM assignment
        await loadAMInfoFromDB();
      }
    } catch (err) {
      console.error('Edge function failed, trying DB fallback:', err);
      await loadAMInfoFromDB();
    } finally {
      setLoading(false);
    }
  };

  const loadAMInfoFromDB = async () => {
    try {
      // Check investor_profiles for assigned AM
      const { data: profile } = await supabase
        .from('investor_profiles')
        .select('assigned_acquisition_manager_id, assigned_acquisition_manager_name')
        .eq('id', investorId)

      if (profile?.assigned_acquisition_manager_id) {
        const { data: staff } = await supabase
          .from('staff_users')
          .select('id, full_name, email, phone')
          .eq('id', profile.assigned_acquisition_manager_id)
          .single();

        if (staff) {
          setAmInfo({
            id: staff.id,
            name: staff.full_name,
            email: staff.email,
            phone: staff.phone,
            assigned_at: null
          });
          return;
        }
        
        // Fallback: use the name from profile
        if (profile.assigned_acquisition_manager_name) {
          setAmInfo({
            id: profile.assigned_acquisition_manager_id,
            name: profile.assigned_acquisition_manager_name,
            email: null,
            phone: null,
            assigned_at: null
          });
          return;
        }
      }

      // Check for pending AM requests

      const { data: requests } = await supabase
        .from('am_assignment_requests')
        .select('*')
        .eq('investor_id', investorId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (requests && requests.length > 0) {
        setPendingRequest(requests[0]);
      }
    } catch (err) {
      console.error('DB fallback also failed:', err);
    }
  };

  const handleRequestAM = async () => {
    setSubmitting(true);
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('manage-am-assignments', {
        body: {
          action: 'request_am',
          investor_id: investorId,
          investor_name: investorName,
          investor_email: investorEmail,
          investment_goals: investmentGoals.trim(),
          preferred_markets: preferredMarkets.trim(),
          notes: additionalNotes.trim(),
          existing_am_name: hasExistingAM ? existingAMName.trim() : null,
          request_type: 'acquisition_manager'
        }
      });

      if (error || data?.error) {
        // DB fallback: insert request directly
        const { error: insertError } = await supabase
          .from('am_assignment_requests')
          .insert({
            investor_id: investorId,
            investor_name: investorName,
            investor_email: investorEmail,
            request_type: 'acquisition_manager',
            investment_goals: investmentGoals.trim(),
            preferred_markets: preferredMarkets.trim(),
            notes: additionalNotes.trim(),
            existing_am_name: hasExistingAM ? existingAMName.trim() : null,
            status: 'pending'
          });

        if (insertError) throw new Error(insertError.message);
      }

      toast({ 
        title: 'Request Submitted!', 
        description: 'Our Success Team will match you with an acquisition manager within 24-48 hours. You\'ll receive a notification once assigned.'
      });
      
      setRequestAMOpen(false);
      setInvestmentGoals('');
      setPreferredMarkets('');
      setAdditionalNotes('');
      setExistingAMName('');
      setHasExistingAM(false);
      loadAMInfo();
      
      if (onAMUpdated) {
        onAMUpdated(data);
      }
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to submit request. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChange = async () => {
    if (!changeReason.trim()) {
      toast({ 
        title: 'Missing Information', 
        description: 'Please provide a reason for requesting a different acquisition manager.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'request_am_change',
          investor_id: investorId,
          investor_name: investorName,
          current_am_id: amInfo?.id,
          reason: changeReason.trim(),
          preferred_am_name: preferredAMName.trim() || null
        }
      });

      if (error || data?.error) {
        // DB fallback
        const { error: insertError } = await supabase
          .from('am_assignment_requests')
          .insert({
            investor_id: investorId,
            investor_name: investorName,
            investor_email: investorEmail,
            request_type: 'am_change',
            notes: `Reason: ${changeReason.trim()}${preferredAMName ? `\nPreferred AM: ${preferredAMName}` : ''}`,
            current_am_id: amInfo?.id,
            status: 'pending'
          });

        if (insertError) throw new Error(insertError.message);
      }

      toast({ 
        title: 'Request Submitted', 
        description: 'Our Success Team will review your request and get back to you within 24-48 hours.'
      });
      
      setRequestChangeOpen(false);
      setChangeReason('');
      setPreferredAMName('');
      loadAMInfo();
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to submit request.', 
        variant: 'destructive' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = () => {
    if (onNavigateToMessages) {
      onNavigateToMessages();
    } else {
      // Fallback: try to find the messages tab trigger
      const messagesTab = document.querySelector('[value="messages"]') as HTMLElement;
      if (messagesTab) {
        messagesTab.click();
      } else if (amInfo?.email) {
        window.location.href = `mailto:${amInfo.email}?subject=Question from ${investorName}`;
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#d4a574]" />
          <p className="mt-2 text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // No AM assigned yet
  if (!amInfo && !pendingRequest) {
    return (
      <>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-600" />
              Request an Acquisition Manager
            </CardTitle>
            <CardDescription>
              Get matched with a dedicated acquisition manager to help you find deals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/80 rounded-lg p-4 border border-amber-200">
              <h4 className="font-medium text-gray-900 mb-2">Why request an Acquisition Manager?</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Get personalized deal recommendations based on your goals</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Direct messaging with your dedicated team member</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Faster response times on inquiries and negotiations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Required before purchasing deals on our platform</span>
                </li>
              </ul>
            </div>

            <Button 
              onClick={() => setRequestAMOpen(true)}
              className="w-full bg-[#d4a574] hover:bg-[#c49464]"
            >
              <Send className="w-4 h-4 mr-2" />
              Request Acquisition Manager
            </Button>

            <p className="text-xs text-center text-gray-500">
              Our Success Team will match you with the best AM for your investment goals within 24-48 hours.
            </p>
          </CardContent>
        </Card>

        {/* Request AM Dialog */}
        <Dialog open={requestAMOpen} onOpenChange={setRequestAMOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#d4a574]" />
                Request an Acquisition Manager
              </DialogTitle>
              <DialogDescription>
                Tell us about your investment goals so we can match you with the right acquisition manager.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Already working with someone? */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">
                      Already working with an acquisition manager?
                    </p>
                    <div className="mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasExistingAM}
                          onChange={(e) => setHasExistingAM(e.target.checked)}
                          className="rounded border-blue-300"
                        />
                        <span className="text-sm text-blue-700">
                          Yes, I've been working with someone
                        </span>
                      </label>
                      {hasExistingAM && (
                        <Input
                          value={existingAMName}
                          onChange={(e) => setExistingAMName(e.target.value)}
                          placeholder="Enter their first and last name"
                          className="mt-2"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="investment-goals">What are your investment goals? *</Label>
                <Textarea
                  id="investment-goals"
                  value={investmentGoals}
                  onChange={(e) => setInvestmentGoals(e.target.value)}
                  placeholder="e.g., Building a portfolio of 5 STR properties, passive income of $10k/month, etc."
                  rows={3}
                  aria-required="true"
                />
              </div>

              <div>
                <Label htmlFor="preferred-markets">Preferred Markets (Optional)</Label>
                <Input
                  id="preferred-markets"
                  value={preferredMarkets}
                  onChange={(e) => setPreferredMarkets(e.target.value)}
                  placeholder="e.g., Austin TX, Nashville TN, Orlando FL"
                />
              </div>

              <div>
                <Label htmlFor="am-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="am-notes"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any other information that would help us match you with the right AM..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestAMOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRequestAM}
                disabled={submitting || !investmentGoals.trim()}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Submit Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Pending request
  if (pendingRequest && !amInfo) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            AM Request Pending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                Your request has been submitted
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Our Success Team is reviewing your request and will match you with an acquisition manager soon.
              </p>
              <Badge className="mt-2 bg-blue-100 text-blue-700">
                <Clock className="w-3 h-3 mr-1" />
                Pending Assignment
              </Badge>
              <p className="text-xs text-gray-400 mt-2">
                Submitted {new Date(pendingRequest.requested_at || pendingRequest.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white/80 rounded-lg border border-blue-100">
            <p className="text-sm text-gray-600">
              You'll receive a notification once your acquisition manager is assigned. 
              This usually takes less than 24-48 hours during business days.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // AM is assigned
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-600" />
                Your Acquisition Manager
              </CardTitle>
              <CardDescription>
                Your dedicated team member for deal acquisition
              </CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              Assigned
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1a365d] to-[#2d5a87] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white">
                {amInfo.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'AM'}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{amInfo.name}</h3>
              <p className="text-sm text-gray-500">Acquisition Manager</p>
              
              <div className="mt-3 space-y-2">
                {amInfo.email && (
                  <a 
                    href={`mailto:${amInfo.email}`}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#d4a574]"
                  >
                    <Mail className="w-4 h-4" />
                    {amInfo.email}
                  </a>
                )}
                {amInfo.phone && (
                  <a 
                    href={`tel:${amInfo.phone}`}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#d4a574]"
                  >
                    <Phone className="w-4 h-4" />
                    {amInfo.phone}
                  </a>
                )}
              </div>

              {amInfo.assigned_at && (
                <p className="text-xs text-gray-400 mt-3">
                  Assigned {new Date(amInfo.assigned_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSendMessage}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Message
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://calendly.com/investyourplaces', '_blank')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Call
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setRequestChangeOpen(true)}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Request Different AM
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Request AM Change Dialog */}
      <AlertDialog open={requestChangeOpen} onOpenChange={setRequestChangeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Different Acquisition Manager</AlertDialogTitle>
            <AlertDialogDescription>
              We're sorry to hear you'd like a different acquisition manager. 
              Please let us know the reason so we can better serve you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="change-reason">Reason for Request *</Label>
              <Textarea
                id="change-reason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Please explain why you'd like a different acquisition manager..."
                rows={3}
                aria-required="true"
              />
            </div>
            
            <div>
              <Label htmlFor="preferred-am">Preferred AM Name (Optional)</Label>
              <Input
                id="preferred-am"
                value={preferredAMName}
                onChange={(e) => setPreferredAMName(e.target.value)}
                placeholder="If you have someone specific in mind..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank if you'd like us to assign someone new
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setChangeReason('');
              setPreferredAMName('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestChange}
              disabled={submitting || !changeReason.trim()}
              className="bg-[#1a365d]"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Submit Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

