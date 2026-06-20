import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Loader2, Wrench, User, Mail, Phone, Calendar, 
  MessageSquare, CheckCircle, Clock, ExternalLink, Send, ArrowRight
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
  investorEmail?: string;
  onSMUpdated?: (sm: any) => void;
}

interface SetupManager {
  id: string;
  name: string;
  email: string;
  phone?: string;
  assigned_at: string;
}

interface PendingRequest {
  id: string;
  status: string;
  created_at: string;
  notes?: string;
}

export function SetupManagerSection({ investorId, investorName, investorEmail, onSMUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [setupManager, setSetupManager] = useState<SetupManager | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  
  // Request SM form
  const [requestSMOpen, setRequestSMOpen] = useState(false);
  const [setupNeeds, setSetupNeeds] = useState('');
  const [propertyCount, setPropertyCount] = useState('');
  const [preferredTimeline, setPreferredTimeline] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchSetupManager();
  }, [investorId]);

  const fetchSetupManager = async () => {
    setLoading(true);
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'get_assigned_managers',
          investor_id: investorId
        }
      });

      if (!error && data?.setup_manager) {
        setSetupManager(data.setup_manager);
        onSMUpdated?.(data.setup_manager);
      } else if (!error && data?.pending_sm_request) {
        setPendingRequest(data.pending_sm_request);
      } else {
        // DB fallback
        await fetchSetupManagerFromDB();
      }
    } catch (err) {
      console.error('Edge function failed, trying DB fallback:', err);
      await fetchSetupManagerFromDB();
    }
    setLoading(false);
  };

  const fetchSetupManagerFromDB = async () => {
    try {
      // Check investor_profiles for assigned SM
      const { data: profile } = await supabase
        .from('investor_profiles')
        .select('assigned_setup_manager_id, assigned_setup_manager_name')
        .eq('id', investorId)
        .single();

      if (profile?.assigned_setup_manager_id) {
        // Try to get SM details from staff_users table
        const { data: staff } = await supabase
          .from('staff_users')
          .select('id, full_name, email, phone')
          .eq('id', profile.assigned_setup_manager_id)
          .single();


        if (staff) {
          const sm: SetupManager = {
            id: staff.id,
            name: staff.full_name,
            email: staff.email,
            phone: staff.phone || undefined,
            assigned_at: new Date().toISOString()
          };
          setSetupManager(sm);
          onSMUpdated?.(sm);
          return;
        }

        // Fallback: use name from profile
        if (profile.assigned_setup_manager_name) {
          const sm: SetupManager = {
            id: profile.assigned_setup_manager_id,
            name: profile.assigned_setup_manager_name,
            email: '',
            assigned_at: new Date().toISOString()
          };
          setSetupManager(sm);
          onSMUpdated?.(sm);
          return;
        }
      }

      // Check for pending SM requests
      const { data: requests } = await supabase
        .from('am_assignment_requests')
        .select('*')
        .eq('investor_id', investorId)
        .eq('request_type', 'setup_manager')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (requests && requests.length > 0) {
        setPendingRequest(requests[0]);
      }
    } catch (err) {
      console.error('DB fallback for SM also failed:', err);
    }
  };


  const handleRequestSM = async () => {
    setSubmitting(true);
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('manage-am-assignments', {
        body: {
          action: 'request_sm',
          investor_id: investorId,
          investor_name: investorName,
          investor_email: investorEmail,
          setup_needs: setupNeeds.trim(),
          property_count: propertyCount.trim(),
          preferred_timeline: preferredTimeline.trim(),
          notes: additionalNotes.trim(),
          request_type: 'setup_manager'
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
            request_type: 'setup_manager',
            notes: `Setup needs: ${setupNeeds.trim()}\nProperties: ${propertyCount.trim()}\nTimeline: ${preferredTimeline.trim()}\n${additionalNotes.trim()}`,
            status: 'pending'
          });

        if (insertError) throw new Error(insertError.message);
      }

      toast({ 
        title: 'Request Submitted!', 
        description: 'Our Success Team will match you with a setup manager within 24-48 hours. You\'ll receive a notification once assigned.'
      });
      
      setRequestSMOpen(false);
      setSetupNeeds('');
      setPropertyCount('');
      setPreferredTimeline('');
      setAdditionalNotes('');
      fetchSetupManager();
      
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


  const handleContactSM = () => {
    if (setupManager?.email) {
      window.location.href = `mailto:${setupManager.email}?subject=Question from ${investorName}`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  // Pending request
  if (pendingRequest && !setupManager) {
    return (
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            SM Request Pending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Wrench className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                Your request has been submitted
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Our Success Team is reviewing your request and will match you with a setup manager soon.
              </p>
              <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                <Clock className="w-3 h-3 mr-1" />
                Pending Assignment
              </Badge>
              <p className="text-xs text-gray-400 mt-2">
                Submitted {new Date(pendingRequest.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white/80 rounded-lg border border-emerald-100">
            <p className="text-sm text-gray-600">
              You'll receive a notification once your setup manager is assigned. 
              This usually takes less than 24-48 hours during business days.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No SM assigned
  if (!setupManager) {
    return (
      <>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-600" />
              Request a Setup Manager
            </CardTitle>
            <CardDescription>
              Get matched with a dedicated setup specialist
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/80 rounded-lg p-4 border border-emerald-200">
              <h4 className="font-medium text-gray-900 mb-2">What does a Setup Manager do?</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Furniture sourcing and procurement</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Property setup and staging</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Software and smart home setup</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Vendor coordination and quality inspections</span>
                </li>
              </ul>
            </div>

            <Button 
              onClick={() => setRequestSMOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Request Setup Manager
            </Button>

            <p className="text-xs text-center text-gray-500">
              Our Success Team will match you with the best SM for your setup needs.
            </p>
          </CardContent>
        </Card>

        {/* Request SM Dialog */}
        <Dialog open={requestSMOpen} onOpenChange={setRequestSMOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600" />
                Request a Setup Manager
              </DialogTitle>
              <DialogDescription>
                Tell us about your setup needs so we can match you with the right setup manager.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="setup-needs">What setup services do you need? *</Label>
                <Textarea
                  id="setup-needs"
                  value={setupNeeds}
                  onChange={(e) => setSetupNeeds(e.target.value)}
                  placeholder="e.g., Full furniture setup, smart home installation, staging for STR..."
                  rows={3}
                  aria-required="true"
                />
              </div>

              <div>
                <Label htmlFor="property-count">How many properties need setup?</Label>
                <Input
                  id="property-count"
                  value={propertyCount}
                  onChange={(e) => setPropertyCount(e.target.value)}
                  placeholder="e.g., 1, 2-3, 5+"
                />
              </div>

              <div>
                <Label htmlFor="preferred-timeline">Preferred Timeline</Label>
                <Input
                  id="preferred-timeline"
                  value={preferredTimeline}
                  onChange={(e) => setPreferredTimeline(e.target.value)}
                  placeholder="e.g., Within 2 weeks, ASAP, Flexible"
                />
              </div>

              <div>
                <Label htmlFor="sm-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="sm-notes"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any other information about your setup requirements..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestSMOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRequestSM}
                disabled={submitting || !setupNeeds.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
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

  // SM is assigned
  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-600" />
              Your Setup Manager
            </CardTitle>
            <CardDescription>
              Your dedicated setup specialist
            </CardDescription>
          </div>
          <Badge className="bg-emerald-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Assigned
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-white rounded-lg p-4 border border-emerald-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {setupManager.name?.charAt(0) || 'S'}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900">{setupManager.name}</h3>
              <p className="text-sm text-emerald-600 font-medium">Setup Manager</p>
              
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-emerald-500" />
                  <a href={`mailto:${setupManager.email}`} className="hover:text-emerald-600 hover:underline">
                    {setupManager.email}
                  </a>
                </div>
                {setupManager.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <a href={`tel:${setupManager.phone}`} className="hover:text-emerald-600 hover:underline">
                      {setupManager.phone}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Assigned {new Date(setupManager.assigned_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-emerald-100 flex gap-2">
            <Button 
              onClick={handleContactSM}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Contact Setup Manager
            </Button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-emerald-100/50 rounded-lg">
          <p className="text-sm text-emerald-800">
            <strong>Your Setup Manager helps with:</strong>
          </p>
          <ul className="text-sm text-emerald-700 mt-2 space-y-1">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Furniture sourcing and procurement
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Property setup and staging
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Software and smart home setup
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Vendor coordination
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Quality inspections
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
