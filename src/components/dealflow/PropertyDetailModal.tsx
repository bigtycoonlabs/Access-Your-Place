import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building, MapPin, Bed, Bath, Square, DollarSign, User, Mail, Phone, Brain, BarChart3, Shield, TrendingUp, Calendar, Home, FileText } from 'lucide-react';

import { Property, DealAnalytics, OutreachRecord, PropertyNote, EmailTemplate } from '@/types/dealflow';
import { PropertyAnalytics } from './PropertyAnalytics';
import { OutreachPanel } from './OutreachPanel';
import { NotesSection } from './NotesSection';
import { FinancialsEditor } from './FinancialsEditor';
import { StaffInternalNotes } from './StaffInternalNotes';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';
import { PennyAnalysisPanel } from '@/components/investor/PennyAnalysisPanel';

interface PropertyDetailModalProps {
  property: Property | null;
  analytics: DealAnalytics | null;
  outreach: OutreachRecord[];
  notes: PropertyNote[];
  templates: EmailTemplate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendEmail: (templateId: string) => Promise<void>;
  onLogCall: (outcome: string) => Promise<void>;
  onUpdateStatus: (status: string) => Promise<void>;
  onAddNote: (content: string, noteType: string) => Promise<void>;
  onTogglePin: (noteId: string, isPinned: boolean) => Promise<void>;
  staffId?: string;
  staffName?: string;
}

export function PropertyDetailModal({ property, analytics, outreach, notes, templates, open, onOpenChange, onSendEmail, onLogCall, onUpdateStatus, onAddNote, onTogglePin, staffId, staffName }: PropertyDetailModalProps) {
  const [pennyScore, setPennyScore] = useState<number | undefined>(property?.penny_score);
  
  if (!property) return null;

  const typeLabels: Record<string, string> = {
    apartment: 'Apartment Community',
    private_landlord: 'Private Landlord',
    townhome: 'Townhome Community',
    single_family: 'Single Family'
  };

  const sourceLabels: Record<string, string> = {
    third_party_submission: 'Third Party',
    acquisition_team: 'Acquisition Team',
    yp_discovery: 'YP Discovery'
  };

  // Check if score is flagged (below 40)
  const isFlagged = pennyScore !== undefined && pennyScore < 40;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby="property-detail-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" aria-hidden="true" />
            <span>{property.address}</span>
            <PennyScoreBadge 
              score={pennyScore ?? property.penny_score} 
              propertyId={property.id}
              size="md"
              showTooltip={true}
            />
          </DialogTitle>
          <p id="property-detail-desc" className="sr-only">
            Property details for {property.address}, {property.city}, {property.state}
          </p>
          <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Property badges">
            <Badge variant="outline">{typeLabels[property.property_type] || property.property_type}</Badge>
            <Badge variant="secondary">{sourceLabels[property.source] || property.source}</Badge>
            <Badge className={property.is_verified ? 'bg-green-500' : 'bg-yellow-500'}>
              {property.is_verified ? 'Verified' : 'Pending Verification'}
            </Badge>
            {isFlagged && (
              <Badge className="bg-red-500">Flagged - Needs AM Review</Badge>
            )}
            {property.found_by_am_name && (
              <Badge variant="outline" className="text-indigo-600 border-indigo-300 bg-indigo-50">
                <User className="w-3 h-3 mr-1" aria-hidden="true" />
                Found by: {property.found_by_am_name}
              </Badge>
            )}
            {property.referred_by_partner && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
                <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                Referred: {property.referred_by_partner}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Flagged Deal Warning */}
        {isFlagged && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4" role="alert">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-red-600 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-red-800">Deal Flagged by Penny AI</p>
                <p className="text-sm text-red-600 mt-1">
                  This property scored below 40 and is not recommended for listing. 
                  Please review the analysis and consult with the acquisition team before proceeding.
                </p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-7" aria-label="Property detail sections">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" aria-hidden="true" />
              <span>Financials</span>
            </TabsTrigger>
            <TabsTrigger value="staff-notes" className="flex items-center gap-1">
              <Shield className="w-3 h-3" aria-hidden="true" />
              <span>Staff Notes</span>
            </TabsTrigger>
            <TabsTrigger value="penny" className="flex items-center gap-1">
              <Brain className="w-3 h-3" aria-hidden="true" />
              <span>Penny AI</span>
            </TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
            <TabsTrigger value="notes" aria-label={`Notes, ${notes.length} total`}>Notes ({notes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4" role="tabpanel" aria-label="Property details">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  <span>{property.city}, {property.state} {property.zip_code}</span>
                </div>
                <div className="flex gap-4 text-sm" role="group" aria-label="Property specifications">
                  <span className="flex items-center gap-1"><Bed className="w-4 h-4" aria-hidden="true" /> {property.bedrooms} bed</span>
                  <span className="flex items-center gap-1"><Bath className="w-4 h-4" aria-hidden="true" /> {property.bathrooms} bath</span>
                  <span className="flex items-center gap-1"><Square className="w-4 h-4" aria-hidden="true" /> {property.sqft || property.square_feet} sqft</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <DollarSign className="w-5 h-5 text-green-600" aria-hidden="true" />
                  <span aria-label={`Monthly rent: $${property.monthly_rent?.toLocaleString()}`}>
                    ${property.monthly_rent?.toLocaleString()}/mo
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Acquisition Fee:</span> ${property.acquisition_fee?.toLocaleString()}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Units Available:</span> {property.units_available || 1}
                </div>

                {/* Quick Financial Summary */}
                {(property.asking_price || property.adr_peak_season || property.projected_yearly_revenue || property.monthly_room_rate) && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" aria-hidden="true" /> Financial Summary
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {property.asking_price != null && property.asking_price > 0 && (
                        <div>
                          <span className="text-gray-500">Asking Price:</span>{' '}
                          <span className="font-medium text-emerald-800">${Number(property.asking_price).toLocaleString()}</span>
                        </div>
                      )}
                      {property.monthly_room_rate != null && property.monthly_room_rate > 0 && (
                        <div>
                          <span className="text-gray-500">Room Rate:</span>{' '}
                          <span className="font-medium">${Number(property.monthly_room_rate).toLocaleString()}/mo</span>
                        </div>
                      )}
                      {property.adr_peak_season != null && property.adr_peak_season > 0 && (
                        <div>
                          <span className="text-gray-500">ADR Peak:</span>{' '}
                          <span className="font-medium">${Number(property.adr_peak_season).toLocaleString()}</span>
                        </div>
                      )}
                      {property.adr_slow_season != null && property.adr_slow_season > 0 && (
                        <div>
                          <span className="text-gray-500">ADR Slow:</span>{' '}
                          <span className="font-medium">${Number(property.adr_slow_season).toLocaleString()}</span>
                        </div>
                      )}
                      {property.avg_occupancy_rate != null && property.avg_occupancy_rate > 0 && (
                        <div>
                          <span className="text-gray-500">Occupancy:</span>{' '}
                          <span className="font-medium">{property.avg_occupancy_rate}%</span>
                        </div>
                      )}
                      {property.projected_yearly_revenue != null && Number(property.projected_yearly_revenue) > 0 && (
                        <div>
                          <span className="text-gray-500">Yearly Rev:</span>{' '}
                          <span className="font-medium">${Number(property.projected_yearly_revenue).toLocaleString()}</span>
                        </div>
                      )}
                      {property.projected_monthly_revenue_peak != null && Number(property.projected_monthly_revenue_peak) > 0 && (
                        <div>
                          <span className="text-gray-500">Peak Mo Rev:</span>{' '}
                          <span className="font-medium">${Number(property.projected_monthly_revenue_peak).toLocaleString()}</span>
                        </div>
                      )}
                      {property.projected_monthly_revenue_slow != null && Number(property.projected_monthly_revenue_slow) > 0 && (
                        <div>
                          <span className="text-gray-500">Slow Mo Rev:</span>{' '}
                          <span className="font-medium">${Number(property.projected_monthly_revenue_slow).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    {/* Text-based financial notes */}
                    {(property.peak_season_description || property.deposits_concessions_notes) && (
                      <div className="mt-2 pt-2 border-t border-emerald-200 space-y-1">
                        {property.peak_season_description && (
                          <div className="text-xs flex items-start gap-1">
                            <Calendar className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                            <span><span className="text-gray-500">Peak Season:</span> {property.peak_season_description}</span>
                          </div>
                        )}
                        {property.deposits_concessions_notes && (
                          <div className="text-xs flex items-start gap-1">
                            <FileText className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                            <span><span className="text-gray-500">Deposits/Notes:</span> {property.deposits_concessions_notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" aria-hidden="true" /> Landlord Info
                </h4>
                {property.landlord_name && <p className="text-sm">{property.landlord_name}</p>}
                {property.landlord_email && (
                  <p className="text-sm flex items-center gap-1">
                    <Mail className="w-3 h-3" aria-hidden="true" /> 
                    <a href={`mailto:${property.landlord_email}`} className="text-blue-600 hover:underline">{property.landlord_email}</a>
                  </p>
                )}
                {property.landlord_phone && (
                  <p className="text-sm flex items-center gap-1">
                    <Phone className="w-3 h-3" aria-hidden="true" /> 
                    <a href={`tel:${property.landlord_phone}`} className="text-blue-600 hover:underline">{property.landlord_phone}</a>
                  </p>
                )}

                {/* Staff Attribution Summary */}
                {(property.found_by_am_name || property.referred_by_partner) && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <h4 className="font-semibold flex items-center gap-2 text-sm mb-2">
                      <Shield className="w-4 h-4 text-amber-600" aria-hidden="true" /> Staff Info
                    </h4>
                    {property.found_by_am_name && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Found by:</span> {property.found_by_am_name}
                      </p>
                    )}
                    {property.referred_by_partner && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Referred by:</span> {property.referred_by_partner}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Listing Description */}
            {property.listing_description && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm mb-2 text-blue-800">Listing Description</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{property.listing_description}</p>
              </div>
            )}

            {/* Photo Gallery */}
            {property.photos && property.photos.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-2">Property Photos ({property.photos.length})</h4>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Property photos">
                  {property.photos.slice(0, 8).map((photo, idx) => (
                    <div key={idx} className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={photo}
                        alt={`Property photo ${idx + 1} of ${property.photos!.length}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="mt-4" role="tabpanel" aria-label="Financial details">
            <FinancialsEditor
              property={property}
              onUpdate={(updated) => {
                // Could refresh parent data here
              }}
            />
          </TabsContent>

          {/* Staff Internal Notes Tab */}
          <TabsContent value="staff-notes" className="mt-4" role="tabpanel" aria-label="Staff internal notes">
            <StaffInternalNotes
              property={property}
              staffId={staffId}
              staffName={staffName}
              onUpdate={(updated) => {
                // Could refresh parent data here
              }}
            />
          </TabsContent>

          {/* Penny AI Analysis Tab - Staff view with SOP checklist */}
          <TabsContent value="penny" className="mt-4" role="tabpanel" aria-label="Penny AI analysis">
            <PennyAnalysisPanel 
              propertyId={property.id}
              property={property}
              isStaff={true}
              onScoreUpdate={(score) => setPennyScore(score)}
            />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4" role="tabpanel" aria-label="Property analytics">
            <PropertyAnalytics analytics={analytics} monthlyRent={property.monthly_rent} />
          </TabsContent>

          <TabsContent value="outreach" className="mt-4" role="tabpanel" aria-label="Outreach tracking">
            <OutreachPanel outreach={outreach} templates={templates} propertyId={property.id} onSendEmail={onSendEmail} onLogCall={onLogCall} onUpdateStatus={onUpdateStatus} currentStatus={property.status} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4" role="tabpanel" aria-label="Property notes">
            <NotesSection notes={notes} propertyId={property.id} onAddNote={onAddNote} onTogglePin={onTogglePin} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
