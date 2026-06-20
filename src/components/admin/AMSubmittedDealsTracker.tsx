import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Building2, Clock, CheckCircle, XCircle, Globe, MapPin,
  DollarSign, Home, RefreshCw, ChevronDown, ChevronUp, Send,
  Mail, MailCheck, Eye, AlertTriangle, ArrowRight, Sparkles,
  Calendar, User, Shield, TrendingUp
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  approved_by_staff_name?: string;
  submitted_by_staff_name?: string;
  recipient_type: string;
  email_sent: boolean;
  created_at: string;
}

interface TrackedDeal {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  status: string;
  deal_status: string;
  computed_status: 'pending_review' | 'approved' | 'published' | 'rejected';
  is_verified: boolean;
  is_published: boolean;
  asking_price?: number;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  operation_type?: string;
  photos?: string[];
  created_at: string;
  updated_at?: string;
  approved_by_staff_name?: string;
  approved_at?: string;
  denial_reason?: string;
  found_by_am_name?: string;
  added_by_staff_name?: string;
  timeline: TimelineEvent[];
}

interface Counts {
  total: number;
  pending: number;
  approved: number;
  published: number;
  rejected: number;
}

interface Props {
  staffId: string;
  staffName: string;
}

const STATUS_CONFIG = {
  pending_review: {
    label: 'Pending Review',
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    ringColor: 'ring-amber-500',
    icon: Clock,
    dotColor: 'bg-amber-400',
    description: 'Awaiting Success Team review',
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    ringColor: 'ring-green-500',
    icon: CheckCircle,
    dotColor: 'bg-green-400',
    description: 'Verified by Success Team',
  },
  published: {
    label: 'Published',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    ringColor: 'ring-blue-500',
    icon: Globe,
    dotColor: 'bg-blue-400',
    description: 'Live on marketplace',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    ringColor: 'ring-red-500',
    icon: XCircle,
    dotColor: 'bg-red-400',
    description: 'Denied by Success Team',
  },
};

const TIMELINE_EVENT_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  new_deal_submitted: { label: 'Deal Submitted', icon: Send, color: 'text-amber-600' },
  deal_approved: { label: 'Deal Approved', icon: CheckCircle, color: 'text-green-600' },
  deal_published: { label: 'Deal Published', icon: Globe, color: 'text-blue-600' },
  deal_denied: { label: 'Deal Rejected', icon: XCircle, color: 'text-red-600' },
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function AMSubmittedDealsTracker({ staffId, staffName }: Props) {
  const [deals, setDeals] = useState<TrackedDeal[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, approved: 0, published: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('deal-flow-notifications', {
        body: {
          action: 'get_am_deal_statuses',
          staff_id: staffId,
        }
      });

      if (error) throw error;

      if (data?.deals) {
        setDeals(data.deals);
        setCounts(data.counts || { total: 0, pending: 0, approved: 0, published: 0, rejected: 0 });
      }
    } catch (err: any) {
      console.error('[AMSubmittedDealsTracker] Error:', err);
      toast({
        title: 'Error Loading Deals',
        description: err.message || 'Failed to load submitted deals',
        variant: 'destructive',
      });
    }
    setLoading(false);
  }, [staffId, toast]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // ── Polling-based refresh ──────────────────────────────────────────
  // Supabase Realtime postgres_changes require the target tables to be
  // added to the `supabase_realtime` publication.  In this environment
  // the publication is not configured, so channel subscriptions always
  // time out — producing "Channel timed out" error-log entries.
  //
  // Instead we poll every 20 seconds.  This keeps the deal tracker
  // reasonably fresh without generating any errors.
  useEffect(() => {
    const pollHandle = setInterval(() => {
      fetchDeals();
    }, 20_000);

    return () => clearInterval(pollHandle);
  }, [fetchDeals]);



  const filteredDeals = statusFilter === 'all'
    ? deals
    : deals.filter(d => d.computed_status === statusFilter);

  const getProgressValue = (status: string): number => {
    switch (status) {
      case 'pending_review': return 25;
      case 'approved': return 66;
      case 'published': return 100;
      case 'rejected': return 100;
      default: return 0;
    }
  };

  const getProgressColor = (status: string): string => {
    switch (status) {
      case 'pending_review': return '[&>div]:bg-amber-500';
      case 'approved': return '[&>div]:bg-green-500';
      case 'published': return '[&>div]:bg-blue-500';
      case 'rejected': return '[&>div]:bg-red-500';
      default: return '';
    }
  };

  const toggleExpand = (dealId: string) => {
    setExpandedDealId(prev => prev === dealId ? null : dealId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" aria-hidden="true" />
          <p className="text-sm text-gray-500" role="status">Loading your submitted deals...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="My Submitted Deals Status Tracker">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1a365d] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" aria-hidden="true" />
            My Submitted Deals
          </h2>
          <p className="text-sm text-gray-600">
            Track the status of every deal you've submitted — from review to publication
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDeals} disabled={loading} aria-label="Refresh deal statuses">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" role="list" aria-label="Deal status summary">
        {[
          { key: 'all', label: 'Total', count: counts.total, color: 'indigo', icon: Building2 },
          { key: 'pending_review', label: 'Pending', count: counts.pending, color: 'amber', icon: Clock },
          { key: 'approved', label: 'Approved', count: counts.approved, color: 'green', icon: CheckCircle },
          { key: 'published', label: 'Published', count: counts.published, color: 'blue', icon: Globe },
          { key: 'rejected', label: 'Rejected', count: counts.rejected, color: 'red', icon: XCircle },
        ].map(item => (
          <Card
            key={item.key}
            className={`cursor-pointer transition-all hover:shadow-md ${
              statusFilter === item.key
                ? `ring-2 ring-${item.color}-500 shadow-md`
                : `hover:border-${item.color}-300`
            }`}
            onClick={() => setStatusFilter(item.key)}
            role="listitem"
            tabIndex={0}
            aria-pressed={statusFilter === item.key}
            aria-label={`Filter by ${item.label}: ${item.count} deals`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(item.key); } }}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <item.icon className={`w-5 h-5 mx-auto text-${item.color}-500 mb-1`} aria-hidden="true" />
              <p className={`text-2xl font-bold text-${item.color}-700`}>{item.count}</p>
              <p className="text-[11px] text-gray-500 font-medium">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Progress Overview */}
      {counts.total > 0 && (
        <Card className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border-indigo-100">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1a365d]">Pipeline Overview</h3>
              <span className="text-xs text-gray-500">{counts.total} total deal{counts.total !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-200" role="progressbar" aria-label="Deal pipeline distribution">
              {counts.pending > 0 && (
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${(counts.pending / counts.total) * 100}%` }}
                  title={`${counts.pending} pending`}
                />
              )}
              {counts.approved > 0 && (
                <div
                  className="bg-green-400 transition-all duration-500"
                  style={{ width: `${(counts.approved / counts.total) * 100}%` }}
                  title={`${counts.approved} approved`}
                />
              )}
              {counts.published > 0 && (
                <div
                  className="bg-blue-400 transition-all duration-500"
                  style={{ width: `${(counts.published / counts.total) * 100}%` }}
                  title={`${counts.published} published`}
                />
              )}
              {counts.rejected > 0 && (
                <div
                  className="bg-red-400 transition-all duration-500"
                  style={{ width: `${(counts.rejected / counts.total) * 100}%` }}
                  title={`${counts.rejected} rejected`}
                />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-[11px] text-gray-500 flex-wrap">
              {counts.pending > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                  Pending ({counts.pending})
                </span>
              )}
              {counts.approved > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" aria-hidden="true" />
                  Approved ({counts.approved})
                </span>
              )}
              {counts.published > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" aria-hidden="true" />
                  Published ({counts.published})
                </span>
              )}
              {counts.rejected > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" aria-hidden="true" />
                  Rejected ({counts.rejected})
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deals List */}
      <div className="space-y-3" role="list" aria-label={`Submitted deals, ${filteredDeals.length} shown`} aria-live="polite">
        {filteredDeals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
              <p className="text-gray-500 font-medium">
                {counts.total === 0
                  ? 'No deals submitted yet'
                  : `No ${statusFilter !== 'all' ? STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label.toLowerCase() : ''} deals found`}
              </p>
              {counts.total === 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  Submit a property using the "Submit Property" button to start tracking it here.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredDeals.map(deal => {
            const config = STATUS_CONFIG[deal.computed_status];
            const StatusIcon = config.icon;
            const isExpanded = expandedDealId === deal.id;
            const progressValue = getProgressValue(deal.computed_status);
            const progressColor = getProgressColor(deal.computed_status);
            const firstPhoto = deal.photos?.find(p => p && p.startsWith('http'));

            return (
              <Card
                key={deal.id}
                className={`transition-all hover:shadow-md border-l-4 ${config.borderColor}`}
                role="listitem"
                aria-label={`${deal.title} - ${config.label}`}
              >
                <CardContent className="pt-4 pb-3">
                  {/* Main Row */}
                  <div className="flex items-start gap-4">
                    {/* Photo thumbnail */}
                    {firstPhoto ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 hidden sm:block">
                        <img
                          src={firstPhoto}
                          alt={`${deal.title} photo`}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200 hidden sm:block" aria-hidden="true">
                        <Building2 className="w-6 h-6 text-gray-300" />
                      </div>
                    )}

                    {/* Deal Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`${config.color} text-white text-xs`}>
                          <StatusIcon className="w-3 h-3 mr-1" aria-hidden="true" />
                          {config.label}
                        </Badge>
                        {deal.operation_type && (
                          <Badge variant="outline" className="text-xs">
                            {deal.operation_type === 'coliving' ? 'Co-Living' : deal.operation_type === 'hybrid' ? 'Hybrid' : deal.operation_type.toUpperCase()}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                          <Calendar className="w-3 h-3 inline mr-0.5" aria-hidden="true" />
                          {formatRelativeTime(deal.created_at)}
                        </span>
                      </div>

                      <h3 className="font-semibold text-[#1a365d] truncate">{deal.title}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        {deal.city}, {deal.state} {deal.zip_code || ''}
                      </p>

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                        {deal.asking_price && (
                          <span className="flex items-center gap-0.5">
                            <DollarSign className="w-3 h-3" aria-hidden="true" />
                            ${deal.asking_price.toLocaleString()}
                          </span>
                        )}
                        {deal.monthly_rent && (
                          <span className="flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" aria-hidden="true" />
                            ${deal.monthly_rent.toLocaleString()}/mo
                          </span>
                        )}
                        {deal.bedrooms && (
                          <span className="flex items-center gap-0.5">
                            <Home className="w-3 h-3" aria-hidden="true" />
                            {deal.bedrooms}BR / {deal.bathrooms}BA
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {deal.computed_status !== 'rejected' && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Pipeline Progress</span>
                            <span className={`text-[10px] font-semibold ${config.textColor}`}>{config.description}</span>
                          </div>
                          <div className="relative">
                            <Progress value={progressValue} className={`h-1.5 ${progressColor}`} aria-label={`Pipeline progress: ${progressValue}%`} />
                            {/* Step markers */}
                            <div className="flex justify-between mt-1">
                              <span className={`text-[9px] ${deal.computed_status === 'pending_review' || deal.computed_status === 'approved' || deal.computed_status === 'published' ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>Submitted</span>
                              <span className={`text-[9px] ${deal.computed_status === 'approved' || deal.computed_status === 'published' ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>Approved</span>
                              <span className={`text-[9px] ${deal.computed_status === 'published' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>Published</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {deal.computed_status === 'rejected' && deal.denial_reason && (
                        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg" role="alert">
                          <p className="text-xs font-medium text-red-800 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Reason for Rejection:
                          </p>
                          <p className="text-xs text-red-700 mt-1">{deal.denial_reason}</p>
                        </div>
                      )}

                      {/* Approved By */}
                      {deal.approved_by_staff_name && deal.computed_status !== 'rejected' && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <Shield className="w-3 h-3" aria-hidden="true" />
                          Approved by {deal.approved_by_staff_name}
                          {deal.approved_at && ` on ${new Date(deal.approved_at).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expand/Collapse Timeline Button */}
                  {deal.timeline.length > 0 && (
                    <button
                      className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                      onClick={() => toggleExpand(deal.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`timeline-${deal.id}`}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} status timeline for ${deal.title}`}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                          Hide Timeline
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                          View Status Timeline ({deal.timeline.length} event{deal.timeline.length !== 1 ? 's' : ''})
                        </>
                      )}
                    </button>
                  )}

                  {/* Timeline */}
                  {isExpanded && deal.timeline.length > 0 && (
                    <div
                      id={`timeline-${deal.id}`}
                      className="mt-3 pt-3 border-t border-gray-100"
                      role="list"
                      aria-label={`Status timeline for ${deal.title}`}
                    >
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400" aria-hidden="true" />
                        Status Timeline
                      </h4>
                      <div className="relative ml-3">
                        {/* Vertical line */}
                        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" aria-hidden="true" />

                        {deal.timeline.map((event, idx) => {
                          const eventConfig = TIMELINE_EVENT_CONFIG[event.type] || {
                            label: event.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                            icon: ArrowRight,
                            color: 'text-gray-500',
                          };
                          const EventIcon = eventConfig.icon;
                          const isLast = idx === deal.timeline.length - 1;

                          return (
                            <div
                              key={event.id}
                              className={`relative flex items-start gap-3 ${isLast ? '' : 'pb-4'}`}
                              role="listitem"
                              aria-label={`${eventConfig.label} - ${formatFullDate(event.created_at)}`}
                            >
                              {/* Dot */}
                              <div className={`relative z-10 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0 ${
                                event.type === 'new_deal_submitted' ? 'bg-amber-400' :
                                event.type === 'deal_approved' ? 'bg-green-400' :
                                event.type === 'deal_published' ? 'bg-blue-400' :
                                event.type === 'deal_denied' ? 'bg-red-400' : 'bg-gray-400'
                              }`} aria-hidden="true">
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 -mt-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-semibold ${eventConfig.color} flex items-center gap-1`}>
                                    <EventIcon className="w-3 h-3" aria-hidden="true" />
                                    {eventConfig.label}
                                  </span>
                                  {event.email_sent && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-green-500" aria-label="Email notification sent">
                                            <MailCheck className="w-3 h-3" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">Email notification sent</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>

                                {event.message && (
                                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{event.message}</p>
                                )}

                                {event.approved_by_staff_name && event.type !== 'new_deal_submitted' && (
                                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                                    <User className="w-2.5 h-2.5" aria-hidden="true" />
                                    by {event.approved_by_staff_name}
                                  </p>
                                )}

                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {formatFullDate(event.created_at)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No timeline events - show submission date as the only event */}
                  {deal.timeline.length === 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Send className="w-3 h-3" aria-hidden="true" />
                        <span>Submitted on {formatFullDate(deal.created_at)}</span>
                        <span className="text-gray-300">|</span>
                        <span>No status updates yet — awaiting review</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Footer info */}
      {counts.total > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Showing {filteredDeals.length} of {counts.total} submitted deal{counts.total !== 1 ? 's' : ''}
          {statusFilter !== 'all' && ` (filtered by ${STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label})`}
        </p>
      )}
    </div>
  );
}
