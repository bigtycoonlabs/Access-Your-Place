-- =====================================================
-- DEAL MARKETPLACE SCHEMA
-- For investor-to-investor deal sales (public & private)
-- =====================================================

-- Deal Listings Table
-- Stores all deals listed for sale by investors
CREATE TABLE IF NOT EXISTS deal_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES investor_portfolio(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Listing Type
  listing_type VARCHAR(20) NOT NULL CHECK (listing_type IN ('public', 'private')),
  
  -- Deal Details
  asking_price DECIMAL(12, 2) NOT NULL,
  description TEXT,
  monthly_revenue DECIMAL(10, 2),
  monthly_expenses DECIMAL(10, 2),
  lease_months_remaining INTEGER,
  include_furniture BOOLEAN DEFAULT true,
  include_supplies BOOLEAN DEFAULT true,
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_approval',
    'active',
    'verification_requested',
    'verified',
    'sold',
    'cancelled'
  )),
  
  -- For Private Deals
  buyer_investor_id UUID REFERENCES investors(id),
  buyer_investor_name VARCHAR(255),
  buyer_investor_email VARCHAR(255),
  
  -- Verification
  verification_status VARCHAR(20) CHECK (verification_status IN ('pending', 'in_progress', 'passed', 'failed')),
  verification_requested_at TIMESTAMPTZ,
  verification_completed_at TIMESTAMPTZ,
  verification_notes TEXT,
  verification_paid BOOLEAN DEFAULT false,
  verification_paid_at TIMESTAMPTZ,
  verification_paid_by UUID REFERENCES investors(id),
  
  -- Report
  report_released BOOLEAN DEFAULT false,
  report_released_at TIMESTAMPTZ,
  report_paid_at TIMESTAMPTZ,
  
  -- Transaction Management
  transaction_managed_by_ayp BOOLEAN DEFAULT false,
  transaction_fee_amount DECIMAL(10, 2),
  transaction_fee_paid BOOLEAN DEFAULT false,
  transaction_completed_at TIMESTAMPTZ,
  
  -- Admin
  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Private Deal Offers Table
-- Tracks private deals sent between investors
CREATE TABLE IF NOT EXISTS private_deal_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES deal_listings(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES investors(id),
  buyer_id UUID REFERENCES investors(id),
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'interested',
    'verification_requested',
    'verified',
    'declined',
    'accepted',
    'completed'
  )),
  
  -- Communication
  seller_message TEXT,
  buyer_response TEXT,
  
  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal Verifications Table
-- Detailed verification records
CREATE TABLE IF NOT EXISTS deal_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES deal_listings(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES investors(id),
  
  -- Verification Process
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed')),
  assigned_to UUID REFERENCES staff(id),
  
  -- Seller Verification
  seller_call_completed BOOLEAN DEFAULT false,
  seller_call_date TIMESTAMPTZ,
  seller_call_notes TEXT,
  seller_verified_operator BOOLEAN,
  
  -- Landlord Verification
  landlord_contacted BOOLEAN DEFAULT false,
  landlord_contact_date TIMESTAMPTZ,
  landlord_name VARCHAR(255),
  landlord_phone VARCHAR(50),
  landlord_email VARCHAR(255),
  landlord_verified BOOLEAN,
  landlord_notes TEXT,
  
  -- Property Verification
  property_meets_standards BOOLEAN,
  property_notes TEXT,
  operation_type VARCHAR(50),
  license_requirements TEXT,
  
  -- Findings Report
  report_summary TEXT,
  report_details JSONB,
  report_generated_at TIMESTAMPTZ,
  
  -- Fees
  verification_fee_amount DECIMAL(10, 2) DEFAULT 100.00,
  verification_fee_paid BOOLEAN DEFAULT false,
  verification_fee_paid_at TIMESTAMPTZ,
  report_fee_amount DECIMAL(10, 2) DEFAULT 99.00,
  report_fee_paid BOOLEAN DEFAULT false,
  report_fee_paid_at TIMESTAMPTZ,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal Transactions Table
-- For full transaction management by AYP
CREATE TABLE IF NOT EXISTS deal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES deal_listings(id) ON DELETE CASCADE,
  verification_id UUID REFERENCES deal_verifications(id),
  seller_id UUID REFERENCES investors(id),
  buyer_id UUID REFERENCES investors(id),
  
  -- Transaction Details
  acquisition_cost DECIMAL(12, 2) NOT NULL,
  ayp_fee_percentage DECIMAL(5, 2) DEFAULT 20.00,
  ayp_fee_amount DECIMAL(10, 2),
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'documents_pending',
    'lease_transfer_pending',
    'compliance_check',
    'final_review',
    'completed',
    'cancelled'
  )),
  
  -- Documents
  acquisition_agreement_signed BOOLEAN DEFAULT false,
  acquisition_agreement_signed_at TIMESTAMPTZ,
  lease_transfer_completed BOOLEAN DEFAULT false,
  lease_transfer_completed_at TIMESTAMPTZ,
  corporate_sublease_needed BOOLEAN DEFAULT false,
  corporate_sublease_completed BOOLEAN DEFAULT false,
  
  -- Compliance
  license_requirements_met BOOLEAN,
  compliance_notes TEXT,
  
  -- Staff Assignment
  assigned_manager UUID REFERENCES staff(id),
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace Payments Table
-- Track all marketplace-related payments
CREATE TABLE IF NOT EXISTS marketplace_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES deal_listings(id),
  verification_id UUID REFERENCES deal_verifications(id),
  transaction_id UUID REFERENCES deal_transactions(id),
  payer_id UUID REFERENCES investors(id),
  
  -- Payment Details
  payment_type VARCHAR(30) NOT NULL CHECK (payment_type IN (
    'verification_fee',
    'report_release_fee',
    'transaction_management_fee'
  )),
  amount DECIMAL(10, 2) NOT NULL,
  
  -- Stripe
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_listings_seller ON deal_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_deal_listings_buyer ON deal_listings(buyer_investor_id);
CREATE INDEX IF NOT EXISTS idx_deal_listings_status ON deal_listings(status);
CREATE INDEX IF NOT EXISTS idx_deal_listings_type ON deal_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_private_deal_offers_buyer ON private_deal_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_private_deal_offers_listing ON private_deal_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_deal_verifications_listing ON deal_verifications(listing_id);
CREATE INDEX IF NOT EXISTS idx_deal_transactions_listing ON deal_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_listing ON marketplace_payments(listing_id);

-- Add is_verified_operator column to investors if not exists
ALTER TABLE investors ADD COLUMN IF NOT EXISTS is_verified_operator BOOLEAN DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS operator_verified_at TIMESTAMPTZ;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS operator_verification_notes TEXT;

-- RLS Policies
ALTER TABLE deal_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_deal_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_payments ENABLE ROW LEVEL SECURITY;

-- Investors can see their own listings and public listings
CREATE POLICY deal_listings_select ON deal_listings FOR SELECT
  USING (
    seller_id = auth.uid()::uuid 
    OR buyer_investor_id = auth.uid()::uuid
    OR (listing_type = 'public' AND status = 'active')
  );

-- Investors can insert their own listings
CREATE POLICY deal_listings_insert ON deal_listings FOR INSERT
  WITH CHECK (seller_id = auth.uid()::uuid);

-- Investors can update their own listings
CREATE POLICY deal_listings_update ON deal_listings FOR UPDATE
  USING (seller_id = auth.uid()::uuid);

-- Private deal offers policies
CREATE POLICY private_deal_offers_select ON private_deal_offers FOR SELECT
  USING (seller_id = auth.uid()::uuid OR buyer_id = auth.uid()::uuid);

CREATE POLICY private_deal_offers_insert ON private_deal_offers FOR INSERT
  WITH CHECK (seller_id = auth.uid()::uuid);

-- Verification policies (investors can see their own)
CREATE POLICY deal_verifications_select ON deal_verifications FOR SELECT
  USING (requested_by = auth.uid()::uuid);

-- Transaction policies
CREATE POLICY deal_transactions_select ON deal_transactions FOR SELECT
  USING (seller_id = auth.uid()::uuid OR buyer_id = auth.uid()::uuid);

-- Payment policies
CREATE POLICY marketplace_payments_select ON marketplace_payments FOR SELECT
  USING (payer_id = auth.uid()::uuid);
