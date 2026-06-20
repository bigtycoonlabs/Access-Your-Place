-- ============================================================================
-- MIGRATION: Add missing columns to the properties table
-- Date: 2026-04-13
-- Description: The properties table schema documented in PROPERTY_EDGE_FUNCTIONS.md
--   is missing many columns that the application codebase actively references.
--   This migration adds all missing columns with appropriate types and defaults.
--
-- IMPORTANT: All new columns are NULLABLE (no NOT NULL constraints) to avoid
--   breaking existing rows or INSERT statements that omit these fields.
--   The only NOT NULL columns in the original schema are: city, state.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FINANCIAL PROJECTION FIELDS
--    Used by: AddDealModal, AMSubmitDealModal, InlineFinancialEditor,
--             FinancialsEditor, PropertyDetailModal
-- ─────────────────────────────────────────────────────────────────────────────

-- Asking price for the property/deal
ALTER TABLE properties ADD COLUMN IF NOT EXISTS asking_price DECIMAL(12, 2) DEFAULT NULL;

-- Square footage (the codebase uses `sqft`; the original schema had `square_feet`)
-- Add `sqft` as a separate column since the TypeScript interface uses `sqft`
-- and marks `square_feet` as @deprecated
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sqft INTEGER DEFAULT NULL;

-- Average Daily Rate during peak season
ALTER TABLE properties ADD COLUMN IF NOT EXISTS adr_peak_season DECIMAL(10, 2) DEFAULT NULL;

-- Average Daily Rate during slow season
ALTER TABLE properties ADD COLUMN IF NOT EXISTS adr_slow_season DECIMAL(10, 2) DEFAULT NULL;

-- Monthly room rate (for co-living / MTR operations)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_room_rate DECIMAL(10, 2) DEFAULT NULL;

-- Average occupancy rate as a percentage (0-100)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS avg_occupancy_rate DECIMAL(5, 2) DEFAULT NULL;

-- Projected yearly revenue
ALTER TABLE properties ADD COLUMN IF NOT EXISTS projected_yearly_revenue DECIMAL(12, 2) DEFAULT NULL;

-- Projected monthly revenue during peak season
ALTER TABLE properties ADD COLUMN IF NOT EXISTS projected_monthly_revenue_peak DECIMAL(10, 2) DEFAULT NULL;

-- Projected monthly revenue during slow season
ALTER TABLE properties ADD COLUMN IF NOT EXISTS projected_monthly_revenue_slow DECIMAL(10, 2) DEFAULT NULL;

-- Description of peak season timing (e.g., "June - September")
ALTER TABLE properties ADD COLUMN IF NOT EXISTS peak_season_description TEXT DEFAULT NULL;

-- Notes about deposits, concessions, or other financial arrangements
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deposits_concessions_notes TEXT DEFAULT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PENNY AI SCORING FIELDS
--    Used by: DealVerificationTab, PennyAccuracyReport, PennyMLFeedbackDashboard,
--             PennyScoreMonitoringDashboard, dealflow types
-- ─────────────────────────────────────────────────────────────────────────────

-- Penny AI deal score (0-100)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS penny_score INTEGER DEFAULT NULL;

-- Penny AI recommendation text
ALTER TABLE properties ADD COLUMN IF NOT EXISTS penny_recommendation TEXT DEFAULT NULL;

-- Timestamp when Penny last scored this property
ALTER TABLE properties ADD COLUMN IF NOT EXISTS penny_scored_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DISPLAY & WORKFLOW FIELDS
--    Used by: DealCarousel, FeaturedDeals, AddDealModal, EditPublishModal,
--             AcquisitionManagerDashboard, DealFlowTab
-- ─────────────────────────────────────────────────────────────────────────────

-- Whether this deal is featured on the homepage
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Photos array (URLs stored as a text array)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

-- Workflow stage for acquisition pipeline tracking
-- Values: 'new', 'researching', 'outreach', 'negotiating', 'approved',
--         'published', 'under_contract', 'closed', 'rejected', 'archived'
ALTER TABLE properties ADD COLUMN IF NOT EXISTS workflow_stage TEXT DEFAULT 'new';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STAFF INTERNAL TRACKING FIELDS
--    Used by: AMSubmitDealModal, AMSubmittedDealsTab, DealFlowTab,
--             StaffInternalNotes, AddressCorrectionTool
-- ─────────────────────────────────────────────────────────────────────────────

-- ID of the acquisition manager who found/submitted this deal
ALTER TABLE properties ADD COLUMN IF NOT EXISTS found_by_am_id TEXT DEFAULT NULL;

-- Display name of the AM who found this deal
ALTER TABLE properties ADD COLUMN IF NOT EXISTS found_by_am_name TEXT DEFAULT NULL;

-- Referral partner name (if deal came via referral)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS referred_by_partner TEXT DEFAULT NULL;

-- Notes from the referral partner
ALTER TABLE properties ADD COLUMN IF NOT EXISTS referral_partner_notes TEXT DEFAULT NULL;

-- Internal staff notes (not visible to investors)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS staff_internal_notes TEXT DEFAULT NULL;

-- Flag indicating the address needs manual correction
ALTER TABLE properties ADD COLUMN IF NOT EXISTS address_needs_update BOOLEAN DEFAULT FALSE;

-- Whether this deal was submitted by a third-party seller
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_third_party_seller BOOLEAN DEFAULT FALSE;

-- ID of the staff member who added this deal
ALTER TABLE properties ADD COLUMN IF NOT EXISTS added_by_staff_id TEXT DEFAULT NULL;

-- Display name of the staff member who added this deal
ALTER TABLE properties ADD COLUMN IF NOT EXISTS added_by_staff_name TEXT DEFAULT NULL;

-- ID of the staff member who submitted this deal (may differ from added_by)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submitted_by_staff_id TEXT DEFAULT NULL;

-- Display name of the staff member who submitted this deal
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submitted_by_staff_name TEXT DEFAULT NULL;

-- Type of submitter: 'acquisition_manager', 'seller', 'staff', etc.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submitted_by_type TEXT DEFAULT NULL;

-- Client name (for seller submissions)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submitted_by_client_name TEXT DEFAULT NULL;

-- Client email (for seller submissions)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submitted_by_client_email TEXT DEFAULT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVESTOR ASSIGNMENT FIELDS
--    Used by: PropertyAssignmentModal, AcquisitionManagerDashboard,
--             QuickAssignPopover
-- ─────────────────────────────────────────────────────────────────────────────

-- ID of the investor this property is assigned to
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_investor_id TEXT DEFAULT NULL;

-- Whether the acquisition fee has been paid
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. LISTING DESCRIPTION ALIAS
--    The TypeScript interface uses both `description` and `listing_description`.
--    The schema already has `listing_description`; add `description` as alias.
-- ─────────────────────────────────────────────────────────────────────────────

-- Some code paths use `description` instead of `listing_description`
ALTER TABLE properties ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. INDEXES for commonly queried financial/workflow columns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_properties_workflow_stage ON properties(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_properties_is_featured ON properties(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_properties_penny_score ON properties(penny_score) WHERE penny_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_asking_price ON properties(asking_price) WHERE asking_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_assigned_investor ON properties(assigned_investor_id) WHERE assigned_investor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_found_by_am ON properties(found_by_am_id) WHERE found_by_am_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_deal_status ON properties(deal_status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. COLUMN SUMMARY
-- ─────────────────────────────────────────────────────────────────────────────
-- 
-- Original schema columns (from PROPERTY_EDGE_FUNCTIONS.md):
--   id, address, listing_title, listing_description, city (NOT NULL),
--   state (NOT NULL), zip_code, bedrooms, bathrooms, square_feet,
--   monthly_rent, acquisition_fee, property_type, operation_type, source,
--   status, deal_status, is_furnished, is_verified, is_published,
--   units_available, landlord_name, landlord_email, landlord_phone,
--   listing_url, property_categories, assigned_to, created_at, updated_at
--
-- New columns added by this migration:
--   FINANCIAL:   asking_price, sqft, adr_peak_season, adr_slow_season,
--                monthly_room_rate, avg_occupancy_rate, projected_yearly_revenue,
--                projected_monthly_revenue_peak, projected_monthly_revenue_slow,
--                peak_season_description, deposits_concessions_notes
--   PENNY AI:    penny_score, penny_recommendation, penny_scored_at
--   DISPLAY:     is_featured, photos, workflow_stage
--   STAFF:       found_by_am_id, found_by_am_name, referred_by_partner,
--                referral_partner_notes, staff_internal_notes, address_needs_update,
--                is_third_party_seller, added_by_staff_id, added_by_staff_name,
--                submitted_by_staff_id, submitted_by_staff_name, submitted_by_type,
--                submitted_by_client_name, submitted_by_client_email
--   ASSIGNMENT:  assigned_investor_id, is_paid
--   ALIAS:       description
--
-- All new columns are NULLABLE with sensible defaults.
-- ============================================================================
