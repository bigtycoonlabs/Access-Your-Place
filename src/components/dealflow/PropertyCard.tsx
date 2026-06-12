import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Bed, Bath, DollarSign, Eye, Edit, Sparkles, CheckCircle, Trash2, Star, Image, Building2, Users, AlertTriangle, UserPlus, FileText, MapPinOff, Lock } from 'lucide-react';



import { Property, DealAnalytics } from '@/types/dealflow';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';
import { QuickAssignPopover } from './QuickAssignPopover';

interface PropertyCardProps {
  property: Property;
  analytics?: DealAnalytics | null;
  onViewDetails: () => void;
  onEditPublish: () => void;
  onDelete?: () => void;
  onManagePhotos?: () => void;
  onQuickAssign?: () => void;
  onAssigned?: () => void;
  staffId?: string;
  staffName?: string;
  showQuickAssign?: boolean;
  /** The role of the current staff user viewing the card */
  userRole?: string;
  /** Whether the current AM user owns this deal (submitted or found by them) */
  isOwnDeal?: boolean;
  /** Callback for AMs to open a view-only modal on deals they don't own */
  onViewOnly?: () => void;
}


export function PropertyCard({ property, analytics, onViewDetails, onEditPublish, onDelete, onManagePhotos, onQuickAssign, onAssigned, staffId, staffName, showQuickAssign = false, userRole, isOwnDeal, onViewOnly }: PropertyCardProps) {


  const [popoverOpen, setPopoverOpen] = useState(false);

  const typeLabels: Record<string, string> = { 
    apartment: 'Apartment', 
    private_landlord: 'Private', 
    townhome: 'Townhome', 
    single_family: 'SFH',
    condo: 'Condo',
    multi_family: 'Multi-Family'
  };
  
  const sourceLabels: Record<string, { label: string; icon: any; className: string }> = { 
    third_party: { label: 'Third Party', icon: Users, className: 'bg-purple-100 text-purple-800' },
    third_party_submission: { label: 'Third Party', icon: Users, className: 'bg-purple-100 text-purple-800' },
    acquisition_team: { label: 'YP Team', icon: Building2, className: 'bg-blue-100 text-blue-800' },
    yp_discovery: { label: 'AI Found', icon: Sparkles, className: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white' },
    penny_ai: { label: 'Penny AI', icon: Sparkles, className: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white' }
  };
  
  const statusColors: Record<string, string> = { 
    new: 'bg-gray-500', 
    researching: 'bg-blue-500', 
    outreach: 'bg-yellow-500', 
    negotiating: 'bg-orange-500', 
    approved: 'bg-green-500', 
    rejected: 'bg-red-500', 
    published: 'bg-emerald-600' 
  };

  const viabilityScore = analytics ? Math.max(analytics.str_viability_score || 0, analytics.coliving_viability_score || 0) : 0;
  const viabilityColor = viabilityScore >= 70 ? 'text-green-600' : viabilityScore >= 50 ? 'text-yellow-600' : 'text-red-600';
  const photoCount = property.photos?.length || 0;
  
  const sourceInfo = sourceLabels[property.source] || { label: property.source, icon: Building2, className: 'bg-gray-100 text-gray-800' };
  const SourceIcon = sourceInfo.icon;

  // Get Penny Score
  const pennyScore = (property as any).penny_score ?? analytics?.penny_score ?? null;
  const isFlagged = pennyScore !== null && pennyScore < 40;

  // Whether this property is already assigned
  const isAssigned = !!property.assigned_investor_id || !!property.assigned_to;

  return (
    <Card 
      className={`hover:shadow-lg transition-all hover:scale-[1.02] border-l-4 relative group ${isFlagged ? 'border-l-red-500 bg-red-50/30' : ''}`}
      style={{ borderLeftColor: isFlagged ? undefined : (property.source === 'yp_discovery' || property.source === 'penny_ai' ? '#8B5CF6' : property.source === 'third_party' ? '#9333ea' : '#d4a574') }}
      role="article"
      aria-label={`Property: ${property.listing_title || property.address}. ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms, $${property.monthly_rent?.toLocaleString()} per month. Status: ${property.status}. ${property.is_verified ? 'Verified' : 'Unverified'}. ${isFlagged ? 'Flagged by Penny AI.' : ''}`}
      tabIndex={0}
    >

      {/* Featured Badge */}
      {property.is_featured && (
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-amber-500 text-white">
            <Star className="w-3 h-3 mr-1 fill-white" aria-hidden="true" />
            Featured
          </Badge>
        </div>
      )}

      {/* Flagged Warning Badge */}
      {isFlagged && (
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-red-500 text-white">
            <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
            Flagged - Do Not List
          </Badge>
        </div>
      )}
      
      {/* Action Buttons - top right on hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {showQuickAssign && (
          <Button 
            size="sm" 
            variant="secondary"
            className="bg-[#1a365d] text-white hover:bg-[#2d4a7a] shadow-sm"
            onClick={(e) => { 
              e.stopPropagation(); 
              setPopoverOpen(true);
            }}
            title={isAssigned ? 'Reassign to investor' : 'Assign to investor'}
            aria-label="Quick assign to investor"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
        {onManagePhotos && (
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={(e) => { e.stopPropagation(); onManagePhotos(); }} 
            title="Manage Photos"
            aria-label="Manage photos"
          >
            <Image className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
        {onDelete && (
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete property"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Quick Assign Popover */}
      {popoverOpen && (
        <div className="absolute top-2 right-2 z-[70]">
          <QuickAssignPopover
            property={property}
            onOpenFullModal={() => {
              setPopoverOpen(false);
              onQuickAssign?.();
            }}
            onAssigned={() => {
              setPopoverOpen(false);
              onAssigned?.();
            }}
            onClose={() => setPopoverOpen(false)}
            staffId={staffId}
            staffName={staffName}
          />
        </div>
      )}
      
      <CardContent className={`p-4 ${property.is_featured || isFlagged || property.address_needs_update ? 'pt-10' : ''}`}>
        {/* Address Pending Badge */}
        {property.address_needs_update && !property.is_featured && !isFlagged && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="bg-orange-500 text-white">
              <MapPinOff className="w-3 h-3 mr-1" aria-hidden="true" />
              Address Pending
            </Badge>
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
          <div className="flex gap-1 flex-wrap">
            <Badge variant="outline">{typeLabels[property.property_type] || property.property_type}</Badge>
            <Badge className={sourceInfo.className}>
              <SourceIcon className="w-3 h-3 mr-1" aria-hidden="true" />
              {sourceInfo.label}
            </Badge>
            {photoCount > 0 && (
              <Badge variant="outline" className="text-gray-600">
                <Image className="w-3 h-3 mr-1" aria-hidden="true" />
                {photoCount}
              </Badge>
            )}
            {isAssigned && (
              <Badge className="bg-teal-100 text-teal-800 border-teal-200">
                <UserPlus className="w-3 h-3 mr-1" aria-hidden="true" />
                Assigned
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PennyScoreBadge 
              score={pennyScore} 
              propertyId={property.id}
              size="sm"
              showLabel={false}
            />
            <Badge className={statusColors[property.status] || 'bg-gray-500'}>{property.status}</Badge>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg mb-1 truncate">
          {property.listing_title || `${property.bedrooms}BR in ${property.city}`}
        </h3>
        
        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
          <MapPin className="w-3 h-3" aria-hidden="true" />
          {property.city}, {property.state} {property.zip_code}
        </div>
        
        {/* Admin-only: Full address indicator */}
        <div className={`text-xs mb-2 truncate ${property.address_needs_update ? 'text-orange-500 font-medium' : 'text-gray-400'}`} title={property.address}>
          {property.address_needs_update && <MapPinOff className="w-3 h-3 inline mr-1" />}
          Address: {property.address}
          {property.address_needs_update && <span className="ml-1 text-orange-600">(needs update)</span>}
        </div>

        {/* Address Pending Warning */}
        {property.address_needs_update && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-3 text-xs text-orange-700 flex items-start gap-2">
            <MapPinOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Address needs correction</span>
              <p>This property was restored without a street address. Please update it via Edit or the Address Correction tool.</p>
            </div>
          </div>
        )}


        <div className="flex gap-3 text-sm text-gray-700 mb-3">
          <span className="flex items-center gap-1">
            <Bed className="w-4 h-4" aria-hidden="true" /> {property.bedrooms}
          </span>
          <span className="flex items-center gap-1">
            <Bath className="w-4 h-4" aria-hidden="true" /> {property.bathrooms}
          </span>
          <span className="flex items-center gap-1 font-semibold text-green-600">
            <DollarSign className="w-4 h-4" aria-hidden="true" /> {property.monthly_rent?.toLocaleString()}/mo
          </span>
        </div>

        {analytics && (
          <div className="space-y-2 mb-3">
            {/* Primary Financial Metrics */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-blue-50 rounded text-center">
                <p className="font-bold text-blue-600">${analytics.str_adr || 0}/nt</p>
                <p className="text-gray-500">Avg Daily Rate</p>
              </div>
              <div className="p-2 bg-purple-50 rounded text-center">
                <p className="font-bold text-purple-600">${Math.round((analytics.str_yearly_revenue || 0) / 12).toLocaleString()}</p>
                <p className="text-gray-500">Proj. Rev/mo</p>
              </div>
              <div className="p-2 bg-gray-50 rounded text-center">
                <p className={`font-bold ${viabilityColor}`}>{viabilityScore}%</p>
                <p className="text-gray-500">Score</p>
              </div>
            </div>
            {/* Co-Living Room Rate (if applicable) */}
            {(property.operation_type === 'coliving' || property.operation_type === 'both' || property.operation_type === 'hybrid') && analytics.coliving_per_room > 0 && (
              <div className="flex items-center justify-between text-xs bg-purple-50 rounded px-2 py-1.5 border border-purple-100">
                <span className="text-purple-700 font-medium flex items-center gap-1">
                  <Users className="w-3 h-3" aria-hidden="true" />
                  Co-Living Room Rate
                </span>
                <span className="font-bold text-purple-700">${analytics.coliving_per_room}/mo</span>
              </div>
            )}
            {/* Monthly Profit Estimate */}
            {analytics.str_yearly_revenue > 0 && property.monthly_rent > 0 && (
              <div className={`flex items-center justify-between text-xs rounded px-2 py-1.5 border ${
                (analytics.str_yearly_revenue / 12) - property.monthly_rent > 0 
                  ? 'bg-emerald-50 border-emerald-100' 
                  : 'bg-red-50 border-red-100'
              }`}>
                <span className="text-gray-600 font-medium">Est. Monthly Profit</span>
                <span className={`font-bold ${
                  (analytics.str_yearly_revenue / 12) - property.monthly_rent > 0 
                    ? 'text-emerald-700' 
                    : 'text-red-600'
                }`}>
                  ${Math.round((analytics.str_yearly_revenue / 12) - property.monthly_rent).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Research Notes (internal_notes) */}
        {(property as any).internal_notes && (
          <div className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-2 mb-3">
            <p className="font-medium text-amber-800 mb-0.5 flex items-center gap-1">
              <FileText className="w-3 h-3" aria-hidden="true" />
              Research Notes
            </p>
            <p className="text-amber-700 line-clamp-2">{(property as any).internal_notes}</p>
          </div>
        )}


        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>Fee: ${property.acquisition_fee?.toLocaleString() || '2,500'}</span>
          {property.units_available && property.units_available > 1 && <span>{property.units_available} units</span>}
          {property.is_verified ? (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">Unverified</Badge>
          )}
        </div>

        {/* Flagged Warning Message */}
        {isFlagged && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-2 mb-3 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Penny Score below 40</span>
              <p>This deal requires AM review before listing. Market conditions or data may not support profitability.</p>
            </div>
          </div>
        )}

        {/* 
          AM Role-Based Access Control:
          - AMs can VIEW all deals (Details button always visible)
          - AMs can only EDIT deals they submitted or found (isOwnDeal)
          - AMs see a "View" button on non-own deals → opens ViewOnlyPropertyModal
          - Success Team / Admin can edit all deals
          - Quick assign is controlled separately by showQuickAssign prop
        */}
        {(() => {
          const isAM = userRole === 'Acquisition_Manager';
          // AMs can only see Edit on their own deals; success team sees Edit on all
          const showEditButton = !isAM || isOwnDeal;
          // AMs see a "View" button on non-own deals to open the read-only modal
          const showViewOnlyButton = isAM && !isOwnDeal && !!onViewOnly;
          
          return (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1" 
                onClick={onViewDetails}
                aria-label="View details"
              >
                <Eye className="w-4 h-4 mr-1" aria-hidden="true" /> Details
              </Button>
              {showQuickAssign && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#1a365d] text-[#1a365d] hover:bg-[#1a365d] hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverOpen(true);
                  }}
                  aria-label="Assign to investor"
                  title="Assign to investor"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                </Button>
              )}
              {showEditButton && (
                <Button 
                  size="sm" 
                  className={`flex-1 ${isFlagged ? 'bg-red-500 hover:bg-red-600' : 'bg-[#d4a574] hover:bg-[#c49464]'}`}
                  onClick={onEditPublish}
                  aria-label={isAM ? 'Edit your deal details' : 'Edit and publish property'}
                >
                  <Edit className="w-4 h-4 mr-1" aria-hidden="true" /> {isFlagged ? 'Review' : isAM ? 'Edit Details' : 'Edit'}
                </Button>
              )}
              {showViewOnlyButton && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-100"
                  onClick={onViewOnly}
                  aria-label="View deal in read-only mode"
                  title="View deal details (read-only)"
                >
                  <Lock className="w-4 h-4 mr-1" aria-hidden="true" /> View
                </Button>
              )}
            </div>
          );
        })()}

      </CardContent>
    </Card>
  );
}

