const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, properties, field_mapping } = await req.json();

    if (action === 'validate') {
      // Validate properties before import
      const validationResults = properties.map((prop: any, index: number) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Required fields
        if (!prop.address && !field_mapping?.address) {
          errors.push('Address is required');
        }
        if (!prop.city && !field_mapping?.city) {
          errors.push('City is required');
        }
        if (!prop.state && !field_mapping?.state) {
          errors.push('State is required');
        }

        // Validate price
        const price = parseFloat(prop.acquisition_fee || prop.price || prop.listing_price || prop.asking_price || '0');
        if (price <= 0) {
          warnings.push('Price is missing or invalid');
        }

        // Validate bedrooms/bathrooms
        const bedrooms = parseInt(prop.bedrooms || prop.beds || '0');
        const bathrooms = parseFloat(prop.bathrooms || prop.baths || '0');
        if (bedrooms <= 0) {
          warnings.push('Bedrooms not specified');
        }
        if (bathrooms <= 0) {
          warnings.push('Bathrooms not specified');
        }

        return {
          row: index + 1,
          address: prop.address || prop.street_address || 'Unknown',
          valid: errors.length === 0,
          errors,
          warnings
        };
      });

      const validCount = validationResults.filter((r: any) => r.valid).length;
      const invalidCount = validationResults.filter((r: any) => !r.valid).length;

      return new Response(JSON.stringify({
        success: true,
        total: properties.length,
        valid: validCount,
        invalid: invalidCount,
        results: validationResults
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'import') {
      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as { row: number; address: string; error: string }[]
      };

      for (let i = 0; i < properties.length; i++) {
        const prop = properties[i];
        
        try {
          // Map fields using the provided mapping or default field names
          // v1.1: Use "description" instead of "listing_description" — listing_description is a
          // GENERATED column and cannot be inserted into.
          const rawDescription = prop[field_mapping?.listing_description] || prop.listing_description || prop.description || null;

          const mappedProperty = {
            address: prop[field_mapping?.address] || prop.address || prop.street_address || prop.property_address,
            city: prop[field_mapping?.city] || prop.city,
            state: prop[field_mapping?.state] || prop.state,
            zip_code: prop[field_mapping?.zip_code] || prop.zip_code || prop.zip || prop.postal_code,
            acquisition_fee: parseFloat(prop[field_mapping?.acquisition_fee] || prop[field_mapping?.price] || prop.acquisition_fee || prop.price || prop.listing_price || prop.asking_price || '0'),
            bedrooms: parseInt(prop[field_mapping?.bedrooms] || prop.bedrooms || prop.beds || '0'),
            bathrooms: parseFloat(prop[field_mapping?.bathrooms] || prop.bathrooms || prop.baths || '0'),
            square_feet: parseInt(prop[field_mapping?.square_feet] || prop.square_feet || prop.sqft || prop.sq_ft || '0'),
            property_type: prop[field_mapping?.property_type] || prop.property_type || prop.type || 'single_family',
            year_built: parseInt(prop[field_mapping?.year_built] || prop.year_built || '0') || null,
            lot_size: prop[field_mapping?.lot_size] || prop.lot_size || null,
            listing_title: prop[field_mapping?.listing_title] || prop.listing_title || prop.title || `${prop.bedrooms || '?'}BR Property in ${prop.city || 'Unknown'}`,
            description: rawDescription,
            listing_url: prop[field_mapping?.listing_url] || prop.listing_url || prop.url || prop.link || null,
            mls_number: prop[field_mapping?.mls_number] || prop.mls_number || prop.mls || prop.mls_id || null,
            owner_name: prop[field_mapping?.owner_name] || prop.owner_name || prop.owner || prop.seller_name || null,
            owner_phone: prop[field_mapping?.owner_phone] || prop.owner_phone || prop.phone || prop.contact_phone || null,
            owner_email: prop[field_mapping?.owner_email] || prop.owner_email || prop.email || prop.contact_email || null,
            source: 'csv_import',
            status: 'new',
            deal_status: 'new',
            is_published: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Skip if missing required fields
          if (!mappedProperty.address || !mappedProperty.city || !mappedProperty.state) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              address: mappedProperty.address || 'Unknown',
              error: 'Missing required fields (address, city, or state)'
            });
            continue;
          }

          // Check for duplicates by address
          const { data: existing } = await supabase
            .from('properties')
            .select('id')
            .ilike('address', mappedProperty.address)
            .eq('city', mappedProperty.city)
            .single();

          if (existing) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              address: mappedProperty.address,
              error: 'Duplicate property (already exists in database)'
            });
            continue;
          }

          // Insert the property
          const { data: inserted, error: insertError } = await supabase
            .from('properties')
            .insert(mappedProperty)
            .select()
            .single();

          if (insertError) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              address: mappedProperty.address,
              error: insertError.message
            });
          } else {
            results.imported++;

            // Create initial deal analytics if we have price data
            if (mappedProperty.price > 0) {
              await supabase.from('deal_analytics').insert({
                property_id: inserted.id,
                acquisition_fee: mappedProperty.acquisition_fee,
                created_at: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          results.skipped++;
          results.errors.push({
            row: i + 1,
            address: prop.address || 'Unknown',
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        ...results
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
