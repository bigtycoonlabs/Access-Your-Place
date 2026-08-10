import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Link2, X, Check, Users, Loader2 } from 'lucide-react';

interface LinkSuggestion {
  id: string;
  staff_id: string;
  investor_id: string;
  email: string;
  suggested_at: string;
  staff?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
  };
  investor?: {
    id: string;
    full_name: string;
    email: string;
    company_name?: string;
  };
}

interface AccountLinkSuggestionsBannerProps {
  staffId?: string;
  investorId?: string;
  onLinkAccepted?: () => void;
}

export function AccountLinkSuggestionsBanner({ 
  staffId, 
  investorId,
  onLinkAccepted 
}: AccountLinkSuggestionsBannerProps) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSuggestions();
  }, [staffId, investorId]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      if (staffId) {
        // Fetch suggestions for staff member
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: { action: 'get_link_suggestions', staff_id: staffId }
        });
        
        if (!error && data?.suggestions) {
          setSuggestions(data.suggestions);
        }
      } else if (investorId) {
        // Fetch suggestions for investor
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: { action: 'get_link_suggestions', investor_id: investorId }
        });
        
        if (!error && data?.suggestions) {
          setSuggestions(data.suggestions);
        }
      }
    } catch (err) {
      console.error('Error fetching link suggestions:', err);
    }
    setLoading(false);
  };

  const handleAccept = async (suggestion: LinkSuggestion) => {
    setProcessingId(suggestion.id);
    try {
      if (staffId) {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: { 
            action: 'accept_link_suggestion', 
            suggestion_id: suggestion.id,
            staff_id: staffId
          }
        });
        
        if (error) throw error;
        
        toast({
          title: 'Accounts Linked!',
          description: `Your staff account is now linked to your investor account (${suggestion.investor?.email || suggestion.email}).`
        });
      } else if (investorId) {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: { 
            action: 'accept_link_suggestion', 
            suggestion_id: suggestion.id,
            investor_id: investorId
          }
        });
        
        if (error) throw error;
        
        toast({
          title: 'Accounts Linked!',
          description: `Your investor account is now linked to your staff account (${suggestion.staff?.email || suggestion.email}).`
        });
      }
      
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      onLinkAccepted?.();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to link accounts',
        variant: 'destructive'
      });
    }
    setProcessingId(null);
  };

  const handleDismiss = async (suggestion: LinkSuggestion) => {
    setProcessingId(suggestion.id);
    try {
      if (staffId) {
        await supabase.functions.invoke('manage-staff', {
          body: { 
            action: 'dismiss_link_suggestion', 
            suggestion_id: suggestion.id,
            staff_id: staffId
          }
        });
      } else if (investorId) {
        await supabase.functions.invoke('manage-staff', {
          body: { 
            action: 'dismiss_link_suggestion', 
            suggestion_id: suggestion.id,
            investor_id: investorId
          }
        });
      }
      
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast({
        title: 'Suggestion Dismissed',
        description: 'You can still link accounts manually later.'
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to dismiss suggestion',
        variant: 'destructive'
      });
    }
    setProcessingId(null);
  };

  if (loading || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {suggestions.map((suggestion) => (
        <Card 
          key={suggestion.id} 
          className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-full">
                  <Link2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    Link Account Detected
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Same Email
                    </Badge>
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {staffId ? (
                      <>
                        We found an investor account with your email address: <strong>{suggestion.investor?.full_name || suggestion.email}</strong>
                        {suggestion.investor?.company_name && (
                          <span className="text-gray-500"> ({suggestion.investor.company_name})</span>
                        )}
                      </>
                    ) : (
                      <>
                        We found a staff account with your email address: <strong>
                          {suggestion.staff ? 
                            `${suggestion.staff.first_name} ${suggestion.staff.last_name}` : 
                            suggestion.email
                          }
                        </strong>
                        {suggestion.staff?.department && (
                          <span className="text-gray-500"> ({suggestion.staff.department.replace('_', ' ')})</span>
                        )}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Linking accounts allows you to switch between the staff dashboard and investor portal without logging out.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDismiss(suggestion)}
                  disabled={processingId === suggestion.id}
                  className="text-gray-600"
                >
                  {processingId === suggestion.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-1" />
                      Dismiss
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(suggestion)}
                  disabled={processingId === suggestion.id}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {processingId === suggestion.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Link Accounts
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
