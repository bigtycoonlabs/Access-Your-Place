import { Badge } from '@/components/ui/badge';
import {
  DollarSign, ArrowRight, CheckCircle, XCircle, RotateCcw,
  Clock, User, Store, MessageSquare, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export interface OfferRecord {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  offer_amount: number;
  message?: string;
  offer_type: 'initial' | 'counter_buyer' | 'counter_seller';
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'withdrawn';
  buyer_name?: string;
  buyer_email?: string;
  seller_name?: string;
  seller_email?: string;
  property_address?: string;
  listing_asking_price?: number;
  parent_offer_id?: string;
  responded_at?: string;
  response_message?: string;
  staff_notes?: string;
  expires_at?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  countered: { label: 'Countered', color: 'bg-blue-100 text-blue-700', icon: RotateCcw },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-600', icon: Clock },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-600', icon: XCircle },
};

interface Props {
  offers: OfferRecord[];
  viewerRole?: 'buyer' | 'seller' | 'staff';
  askingPrice?: number;
  compact?: boolean;
}

export function NegotiationTimeline({ offers, viewerRole = 'staff', askingPrice, compact = false }: Props) {
  // Sort offers chronologically (oldest first for timeline)
  const sorted = [...offers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (sorted.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-500">
        <MessageSquare className="w-8 h-8 mx-auto text-gray-300 mb-2" />
        No offers yet
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sorted.map((offer, idx) => {
        const config = STATUS_CONFIG[offer.status] || STATUS_CONFIG.pending;
        const StatusIcon = config.icon;
        const isFromBuyer = offer.offer_type === 'initial' || offer.offer_type === 'counter_buyer';
        const isLast = idx === sorted.length - 1;
        const pctOfAsking = askingPrice ? Math.round((offer.offer_amount / askingPrice) * 100) : null;
        const prevOffer = idx > 0 ? sorted[idx - 1] : null;
        const amountDiff = prevOffer ? offer.offer_amount - prevOffer.offer_amount : 0;

        return (
          <div key={offer.id} className="relative flex gap-3">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[17px] top-10 bottom-0 w-0.5 bg-gray-200" />
            )}

            {/* Timeline dot */}
            <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 ${
              offer.status === 'accepted' ? 'bg-green-100 border-green-400' :
              offer.status === 'rejected' ? 'bg-red-100 border-red-400' :
              offer.status === 'pending' ? 'bg-yellow-100 border-yellow-400' :
              offer.status === 'countered' ? 'bg-blue-100 border-blue-400' :
              'bg-gray-100 border-gray-300'
            }`}>
              {isFromBuyer ? (
                <User className={`w-4 h-4 ${offer.status === 'accepted' ? 'text-green-600' : offer.status === 'rejected' ? 'text-red-600' : 'text-blue-600'}`} />
              ) : (
                <Store className={`w-4 h-4 ${offer.status === 'accepted' ? 'text-green-600' : offer.status === 'rejected' ? 'text-red-600' : 'text-[#d4a574]'}`} />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 ${compact ? 'pb-3' : 'pb-5'}`}>
              <div className={`rounded-lg border p-3 ${
                offer.status === 'accepted' ? 'bg-green-50 border-green-200' :
                offer.status === 'pending' && isLast ? 'bg-yellow-50 border-yellow-200' :
                'bg-white border-gray-200'
              }`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {isFromBuyer ? (viewerRole === 'buyer' ? 'You' : offer.buyer_name || 'Buyer') : (viewerRole === 'seller' ? 'You' : offer.seller_name || 'Seller')}
                    </span>
                    <span className="text-xs text-gray-500">
                      {offer.offer_type === 'initial' ? 'submitted an offer' :
                       offer.offer_type === 'counter_seller' ? 'countered' :
                       'countered'}
                    </span>
                  </div>
                  <Badge className={`text-xs ${config.color}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>

                {/* Amount */}
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xl font-bold text-[#1a365d]">
                    ${offer.offer_amount.toLocaleString()}
                  </span>
                  {pctOfAsking !== null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      pctOfAsking >= 100 ? 'bg-green-100 text-green-700' :
                      pctOfAsking >= 90 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {pctOfAsking}% of asking
                    </span>
                  )}
                  {amountDiff !== 0 && idx > 0 && (
                    <span className={`text-xs flex items-center gap-0.5 ${amountDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {amountDiff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      ${Math.abs(amountDiff).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Message */}
                {offer.message && !compact && (
                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2 italic">
                    "{offer.message}"
                  </p>
                )}

                {/* Response message */}
                {offer.response_message && !compact && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Response: {offer.response_message}
                  </p>
                )}

                {/* Staff notes */}
                {offer.staff_notes && viewerRole === 'staff' && (
                  <p className="text-xs text-purple-600 mt-1.5 bg-purple-50 rounded p-1.5">
                    Staff note: {offer.staff_notes}
                  </p>
                )}

                {/* Timestamp & expiry */}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{new Date(offer.created_at).toLocaleDateString()} at {new Date(offer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {offer.status === 'pending' && offer.expires_at && (
                    <span className="text-yellow-600">
                      Expires {new Date(offer.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
