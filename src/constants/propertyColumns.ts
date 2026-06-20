/**
 * PROPERTY_COLUMNS - Shared constant for the `properties` table column names.
 * 
 * CRITICAL: The database column for square footage is `sqft`, NOT `square_feet`.
 * Using `square_feet` in .select() queries causes PostgREST 400 errors and
 * silently returns empty results, breaking deal assignment and portfolio features.
 * 
 * Always import and use this constant instead of hand-typing column names.
 */

// The correct column name for square footage in the `properties` table
export const SQFT_COLUMN = 'sqft';

// Full select string for the properties table - use this in all .select() queries
export const PROPERTY_SELECT_COLUMNS = [
  'id',
  'address',
  'listing_title',
  'listing_description',
  'description',
  'city',
  'state',
  'zip_code',
  'bedrooms',
  'bathrooms',
  'sqft',                    // NOT square_feet
  'monthly_rent',
  'acquisition_fee',
  'property_type',
  'operation_type',
  'is_furnished',
  'is_featured',
  'is_verified',
  'is_published',
  'status',
  'deal_status',
  'workflow_stage',
  'source',
  'landlord_name',
  'landlord_email',
  'landlord_phone',
  'listing_url',
  'photos',
  'units_available',
  'assigned_investor_id',
  'assigned_to',
  'penny_score',
  'penny_recommendation',
  'penny_scored_at',
  'deposits_concessions_notes',
  'created_at',
  'updated_at',
].join(', ');

// Compact select for deal pickers, dropdowns, and assignment modals
export const PROPERTY_SELECT_COMPACT = [
  'id',
  'address',
  'listing_title',
  'city',
  'state',
  'zip_code',
  'bedrooms',
  'bathrooms',
  'sqft',                    // NOT square_feet
  'monthly_rent',
  'acquisition_fee',
  'property_type',
  'operation_type',
  'is_furnished',
  'is_published',
  'status',
  'landlord_name',
  'landlord_email',
  'landlord_phone',
  'listing_url',
  'photos',
  'units_available',
  'assigned_investor_id',
].join(', ');

// Minimal select for search results and quick lookups
export const PROPERTY_SELECT_MINIMAL = [
  'id',
  'address',
  'listing_title',
  'city',
  'state',
  'zip_code',
  'bedrooms',
  'bathrooms',
  'sqft',                    // NOT square_feet
  'monthly_rent',
  'acquisition_fee',
  'property_type',
  'operation_type',
  'listing_url',
  'photos',
  'is_published',
  'status',
].join(', ');

/**
 * Helper to safely get sqft from a property object.
 * Handles both `sqft` (correct DB column) and `square_feet` (legacy frontend field).
 */
export function getPropertySqft(property: any): number | null {
  return property?.sqft ?? property?.square_feet ?? property?.square_footage ?? null;
}

/**
 * Maps CSV column name 'square_feet' to the correct DB column 'sqft'.
 * Use this when building insert payloads from CSV imports or external data.
 */
export const CSV_TO_DB_COLUMN_MAP: Record<string, string> = {
  'square_feet': 'sqft',
  'squarefeet': 'sqft',
  'sqfeet': 'sqft',
  'squarefootage': 'sqft',
  'size': 'sqft',
};
