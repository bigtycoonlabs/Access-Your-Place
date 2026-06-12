export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  /** @deprecated Use `sqft` instead - maps to actual DB column */
  square_feet?: number;

  monthly_rent: number;
  property_type: 'apartment' | 'private_landlord' | 'townhome' | 'single_family' | 'condo' | 'multi_family';
  source: 'third_party_submission' | 'third_party' | 'acquisition_team' | 'yp_discovery' | 'penny_ai';
  listing_title?: string;
  listing_description?: string;
  description?: string;
  acquisition_fee: number;
  is_furnished: boolean;
  is_featured: boolean;
  units_available?: number;
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
  listing_url?: string;
  status: 'new' | 'researching' | 'outreach' | 'negotiating' | 'approved' | 'rejected' | 'published';
  deal_status?: string;
  workflow_stage?: string;
  is_verified: boolean;
  is_published: boolean;
  assigned_to?: string;
  assigned_investor_id?: string;
  is_paid?: boolean;
  photos?: string[];
  operation_type?: 'str' | 'coliving' | 'mtr' | 'ltr' | 'both' | 'peerspace';
  property_categories?: string[];
  penny_score?: number;
  penny_recommendation?: string;
  penny_scored_at?: string;
  created_at: string;
  updated_at: string;

  // Financial breakdown fields
  asking_price?: number;
  adr_peak_season?: number;
  adr_slow_season?: number;
  monthly_room_rate?: number;
  deposits_concessions_notes?: string;
  avg_occupancy_rate?: number;
  projected_yearly_revenue?: number;
  projected_monthly_revenue_peak?: number;
  projected_monthly_revenue_slow?: number;
  peak_season_description?: string;


  // Staff internal tracking fields
  found_by_am_id?: string;
  found_by_am_name?: string;
  referred_by_partner?: string;
  referral_partner_notes?: string;
  staff_internal_notes?: string;
  address_needs_update?: boolean;
  is_third_party_seller?: boolean;
  added_by_staff_id?: string;
  added_by_staff_name?: string;
  submitted_by_staff_id?: string;
  submitted_by_staff_name?: string;
}







export interface DealAnalytics {
  id: string;
  property_id: string;
  str_adr: number;
  str_occupancy: number;
  str_yearly_revenue: number;
  coliving_adr: number;
  coliving_occupancy: number;
  coliving_yearly_revenue: number;
  coliving_per_room?: number;
  str_viability_score: number;
  coliving_viability_score: number;
  ai_recommendation?: string;
  last_updated: string;
}

export interface OutreachRecord {
  id: string;
  property_id: string;
  contact_method: 'email' | 'phone' | 'in_person';
  template_used?: string;
  status: 'pending' | 'sent' | 'no_answer' | 'callback_scheduled' | 'interested' | 'not_interested' | 'closed';
  outcome?: string;
  callback_date?: string;
  created_at: string;
}

export interface PropertyNote {
  id: string;
  property_id: string;
  content: string;
  note_type: 'general' | 'negotiation' | 'research' | 'callback';
  author_name: string;
  is_pinned: boolean;
  created_at: string;
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  original_url: string;
  processed_url?: string;
  is_processed: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string;
}

export interface Investor {
  id: string;
  email: string;
  name: string;
  phone?: string;
  company?: string;
  investment_goals?: string[];
  preferred_markets?: string[];
  budget_range?: string;
  is_verified: boolean;
  created_at: string;
}

export interface PropertyAssignment {
  id: string;
  property_id: string;
  investor_id: string;
  assigned_at: string;
  is_paid: boolean;
  payment_date?: string;
  payment_amount?: number;
  notes?: string;
}
