import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Sparkles, MapPin, Building2, 
  Bed, Bath, ArrowRight, CheckCircle,
  LogIn, RefreshCw, AlertTriangle,
  Phone, Search, BarChart3, Shield, Bell, Calculator, Users,
  TrendingUp, DollarSign, Lock, Eye
} from 'lucide-react';


interface DealLocatorProps { 
  investorId: string; 
  onBookCall: (data: any) => void; 
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

type CallerType = 'staff' | 'funded_investor' | 'investor' | 'public';

/**
 * Determines the caller_type for the current investor session.
 * Checks localStorage for investorSession and is_funded status.
 * Falls back to fetching funding status from process-account-funding.
 */
async function resolveCallerType(investorId: string): Promise<CallerType> {
  try {
    const stored = localStorage.getItem('investorSession');
    if (!stored) return 'investor';
    
    const parsed = JSON.parse(stored);
    
    // Check if funding status is already cached in session
    if (parsed.is_funded === true) {
      return 'funded_investor';
    }
    
    // process-account-funding was TOMBSTONED on 6 August 2026: it created card payment
    // intents against a third-party gateway the owner does not control. It returns 410 and
    // must stay dead. Calling it produced a CORS failure on every load of this screen.
    //
    // Falling through to the session flag is the safe direction: an unconfirmed caller is
    // treated as NOT funded, so addresses stay hidden rather than being revealed by a
    // failed check. Card funding is retired; the rails are Zelle, wire, Cash App, Bitcoin.
    try {
      const { data, error } = { data: null as any, error: null as any };
      
      if (!error && data?.funding_status?.is_funded) {
        // Cache funding status in session for future use
        try {
          const updatedSession = { ...parsed, is_funded: true };
          localStorage.setItem('investorSession', JSON.stringify(updatedSession));
        } catch { /* ignore cache failure */ }
        return 'funded_investor';
      }
    } catch {
      // If funding check fails, default to unfunded investor
    }
    
    return 'investor';
  } catch {
    return 'investor';
  }
}

export function DealLocator({ investorId, onBookCall }: DealLocatorProps) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [assignedDeals, setAssignedDeals] = useState<any[]>([]);
  const [availableDeals, setAvailableDeals] = useState<any[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [callerType, setCallerType] = useState<CallerType>('investor');
  const [isFunded, setIsFunded] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const features = [
    { icon: Search, title: 'Smart Search', description: 'Find properties matching your criteria', color: 'blue' },
    { icon: Shield, title: 'Verified Deals', description: 'Pre-negotiated with landlord approval', color: 'green' },
    { icon: BarChart3, title: 'Analytics', description: 'Revenue projections & ROI data', color: 'purple' },
    { icon: Calculator, title: 'Deal Calculator', description: 'Instant profitability analysis', color: 'teal' },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
      teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
    };
    return colors[color] || colors.blue;
  };

  // Validate investor session on mount
  useEffect(() => {
    validateSessionAndFetch();
  }, [investorId]);

  const validateSessionAndFetch = async () => {
    // First, validate the investor ID format
    if (!investorId) {
      setSessionError('No investor session found. Please log in to continue.');
      setInitialLoading(false);
      return;
    }

    if (!isValidUUID(investorId)) {
      setSessionError('Your session appears to be invalid. Please log in again.');
      setInitialLoading(false);
      // Clear invalid session data
      localStorage.removeItem('investor');
      return;
    }

    // Resolve caller type before fetching deals
    const resolvedType = await resolveCallerType(investorId);
    setCallerType(resolvedType);
    setIsFunded(resolvedType === 'funded_investor');
    console.log(`[DealLocator] Resolved caller_type: ${resolvedType} for investor ${investorId}`);

    // Session is valid, fetch deals
    await fetchDeals(resolvedType);
  };

  const handleLoginRedirect = () => {
    localStorage.removeItem('investor');
    navigate('/investor/login');
  };

  const fetchDeals = async (resolvedCallerType?: CallerType) => {
    const ct = resolvedCallerType || callerType;
    
    try {
      // Fetch assigned deals (these always show full info via the dedicated edge function)
      const { data: assignedData, error: assignedError } = await supabase.functions.invoke('investor-deal-locator', { 
        body: { action: 'get_assigned_deals', investor_id: investorId } 
      });
      
      if (!assignedError && assignedData?.deals) {
        setAssignedDeals(assignedData.deals);
      }

      // Fetch available published deals using get-properties edge function with caller_type
      // This ensures proper visibility filtering - funded investors see addresses, others see ZIP only
      let availableData: any[] = [];
      let total = 0;

      try {
        const { data: efData, error: efError } = await supabase.functions.invoke('get-properties', {
          body: { 
            status: 'published',
            caller_type: ct,
            caller_investor_id: investorId,
            limit: 6
          }
        });

        if (!efError && efData?.properties) {
          availableData = efData.properties;
          total = efData.total || efData.properties.length;
          console.log(`[DealLocator] Edge function returned ${availableData.length} properties with caller_type=${ct}`);
        } else {
          console.warn('[DealLocator] Edge function returned no data:', efError);
          throw new Error('Edge function failed');
        }
      } catch (efErr) {
        console.warn('[DealLocator] Edge function failed, falling back to DB:', efErr);
        
        // Fallback: Direct DB query with client-side visibility filtering
        const { data: dbData, error: dbError, count } = await supabase
          .from('properties')
          .select('*', { count: 'exact' })
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(6);

        if (!dbError && dbData) {
          // Apply client-side visibility filtering
          availableData = dbData.map((p: any) => {
            const cleaned = { ...p };
            // Always strip landlord contact and internal notes for non-staff
            cleaned.landlord_name = null;
            cleaned.landlord_email = null;
            cleaned.landlord_phone = null;
            cleaned.internal_notes = null;
            cleaned.community_name = null;
            
            // Address visibility: only funded investors with visibility enabled see addresses
            const vis = p.visibility_settings || {};
            if (ct === 'funded_investor' && vis.show_address) {
              // Keep address
            } else {
              cleaned.address = null;
            }
            return cleaned;
          });
          total = count || 0;
          console.log(`[DealLocator] DB fallback returned ${availableData.length} properties (client-side filtered)`);
        }
      }

      setAvailableDeals(availableData);
      setTotalDeals(total);
      
    } catch (error: any) {
      console.error('Fetch error:', error);
      if (error.message?.includes('session') || error.message?.includes('auth')) {
        setSessionError('There was a problem with your session. Please log in again.');
      } else {
        toast({
          title: 'Error loading deals',
          description: 'Unable to load deals. Please try again.',
          variant: 'destructive'
        });
      }
    } finally {
      setInitialLoading(false);
    }
  };

  // Session Error UI
  if (sessionError) {
    return (
      <Card className="max-w-md mx-auto mt-8 border-2 border-red-200">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Session Issue</h3>
          <p className="text-gray-600 mb-6">{sessionError}</p>
          <div className="space-y-3">
            <Button 
              onClick={handleLoginRedirect}
              className="w-full bg-[#1a365d] hover:bg-[#2d4a7c]"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Log In Again
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setSessionError(null);
                setInitialLoading(true);
                validateSessionAndFetch();
              }}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            If this problem persists, please contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  const AssignedDealCard = ({ deal }: { deal: any }) => (
    <Card className="overflow-hidden hover:shadow-lg transition group border-2 border-green-200 bg-green-50/30">
      <div className="h-40 bg-gradient-to-br from-green-200 to-emerald-200 relative">
        {deal.photos?.[0] ? (
          <img src={deal.photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-green-600">
            <Building2 className="w-12 h-12" />
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />Assigned to You
        </Badge>
        {deal.payment_status === 'paid' && (
          <Badge className="absolute top-2 right-2 bg-blue-600">Full Access</Badge>
        )}
        {deal.payment_status === 'pending' && (
          <Badge className="absolute top-2 right-2 bg-yellow-600">Payment Pending</Badge>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-[#1a365d] mb-1">{deal.title || 'Investment Property'}</h3>
        <div className="flex items-center gap-1 text-gray-600 text-sm mb-2">
          <MapPin className="w-3 h-3" />
          {deal.full_address_visible ? (
            <span>{deal.address}, {deal.city}, {deal.state} {deal.zip_code}</span>
          ) : (
            <span>{deal.city}, {deal.state} {deal.zip_code}</span>
          )}
        </div>
        {deal.notes && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{deal.notes}</p>
        )}
        <div className="flex gap-3 text-sm text-gray-500 mb-3">
          {deal.bedrooms && <span className="flex items-center gap-1"><Bed className="w-4 h-4" />{deal.bedrooms}</span>}
          {deal.bathrooms && <span className="flex items-center gap-1"><Bath className="w-4 h-4" />{deal.bathrooms}</span>}
        </div>
        {deal.monthly_rent && (
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-green-100 p-2 rounded">
              <span className="text-gray-500 block">Monthly Rent</span>
              <span className="font-bold text-green-700">${deal.monthly_rent?.toLocaleString()}</span>
            </div>
            <div className="bg-blue-100 p-2 rounded">
              <span className="text-gray-500 block">Status</span>
              <span className="font-bold text-blue-700 capitalize">{deal.assignment_status || 'Active'}</span>
            </div>
          </div>
        )}
        <Button 
          size="sm" 
          className="w-full bg-[#d4a574] hover:bg-[#c49464]" 
          onClick={() => onBookCall({ property: deal, type: 'assigned_deal' })}
        >
          <Phone className="w-3 h-3 mr-2" />Contact About This Deal
        </Button>
      </CardContent>
    </Card>
  );

  const AvailableDealCard = ({ deal }: { deal: any }) => {
    const hasAddress = !!deal.address;
    
    return (
      <Card className="overflow-hidden hover:shadow-lg transition group">
        <div className="h-36 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] relative">
          {deal.photos?.[0] ? (
            <img src={deal.photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <Building2 className="w-10 h-10" />
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-[#d4a574]">
            {deal.operation_type === 'coliving' ? 'Co-Living' : deal.operation_type === 'both' ? 'Both' : 'STR'}
          </Badge>
          {deal.is_verified && (
            <Badge className="absolute top-2 right-2 bg-green-500">
              <CheckCircle className="w-3 h-3 mr-1" />Verified
            </Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
            {deal.listing_title || `${deal.bedrooms}BR in ${deal.city}`}
          </h3>
          <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {hasAddress ? (
              <span className="truncate">{deal.address}, {deal.city}, {deal.state} {deal.zip_code}</span>
            ) : (
              <span>{deal.city}, {deal.state} {deal.zip_code}</span>
            )}
          </div>
          {!hasAddress && !isFunded && (
            <div className="flex items-center gap-1 text-xs text-blue-600 mb-2">
              <Lock className="w-3 h-3" />
              <span>Fund your account to see full address</span>
            </div>
          )}
          <div className="flex gap-3 text-sm text-gray-500 mb-2">
            <span className="flex items-center gap-1"><Bed className="w-4 h-4" />{deal.bedrooms}</span>
            <span className="flex items-center gap-1"><Bath className="w-4 h-4" />{deal.bathrooms}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">${deal.monthly_rent?.toLocaleString()}/mo</span>
            <span className="font-semibold text-[#1a365d]">${deal.acquisition_fee?.toLocaleString()} fee</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Sparkles className="w-6 h-6 text-[#d4a574]" />
              <div>
                <h3 className="font-semibold text-lg">Deal Locator</h3>
                <p className="text-sm text-white/70">Find your next investment property</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isFunded && (
                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30">
                  <Eye className="w-3 h-3 mr-1" />
                  Full Access
                </Badge>
              )}
              <Badge className="bg-white/20 text-white">
                {totalDeals} Available
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Funding status banner */}
          {!isFunded && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Unlock Full Property Addresses</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Fund your investor account to see complete property addresses for faster decision-making. 
                  Currently showing ZIP codes only.
                </p>
              </div>
            </div>
          )}

          {/* Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {features.map((feature, index) => {
              const colors = getColorClasses(feature.color);
              const Icon = feature.icon;
              return (
                <div key={index} className="text-center p-3 rounded-lg bg-gray-50">
                  <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <h5 className="font-medium text-gray-900 text-sm">{feature.title}</h5>
                  <p className="text-xs text-gray-500">{feature.description}</p>
                </div>
              );
            })}
          </div>

          <Button asChild className="w-full bg-[#d4a574] hover:bg-[#c49464]">
            <Link to="/deals">
              Browse All Properties
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Results */}
      {initialLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Assigned Deals Section */}
          {assignedDeals.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Your Assigned Deals ({assignedDeals.length})
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                These properties have been specifically assigned to you by our acquisition team.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedDeals.map(deal => <AssignedDealCard key={deal.id} deal={deal} />)}
              </div>
            </div>
          )}

          {/* Available Deals Preview */}
          {availableDeals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#1a365d]" />
                  Available Properties
                  {isFunded && (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 ml-2">
                      <Eye className="w-3 h-3 mr-1" />
                      Addresses Visible
                    </Badge>
                  )}
                </h3>
                <Button asChild variant="outline" size="sm">
                  <Link to="/deals">
                    View All {totalDeals}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableDeals.slice(0, 6).map(deal => <AvailableDealCard key={deal.id} deal={deal} />)}
              </div>
            </div>
          )}

          {/* Empty State */}
          {assignedDeals.length === 0 && availableDeals.length === 0 && (
            <Card className="border-2 border-dashed">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Properties Available</h3>
                <p className="text-gray-600 mb-6">We're actively sourcing new pre-negotiated opportunities. Check back soon!</p>
                <Button asChild className="bg-[#d4a574] hover:bg-[#c49464]">
                  <Link to="/deals">
                    <Bell className="w-4 h-4 mr-2" />
                    Set Up Deal Alerts
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
