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
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const body = await req.json();
    const { action = 'create', property, propertyId } = body;

    if (action === 'create') {
      if (!property) {
        return new Response(
          JSON.stringify({ error: 'Property data is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Build the insert object with only valid columns
      const insertData: Record<string, any> = {
        address: property.address || '',
        city: property.city || '',
        state: property.state || '',
        zip_code: property.zip_code || property.zipCode || '',
        price: parseFloat(property.price) || 0,
        bedrooms: parseInt(property.bedrooms) || 0,
        bathrooms: parseFloat(property.bathrooms) || 0,
        sqft: parseInt(property.sqft || property.square_feet || property.squareFeet) || 0,
        property_type: property.property_type || property.propertyType || 'Single Family',
        status: property.status || 'active',
        photos: property.photos || [],
        description: property.description || '',
        monthly_rent: parseFloat(property.monthly_rent || property.monthlyRent) || 0,
        operation_type: property.operation_type || property.operationType || 'str',
        featured: property.featured || false,
        is_featured: property.is_featured || property.isFeatured || false,
        is_furnished: property.is_furnished || property.isFurnished || false,
        is_published: property.is_published !== undefined ? property.is_published : true,
        is_verified: property.is_verified || property.isVerified || false,
        listing_title: property.listing_title || property.listingTitle || property.title || '',
        title: property.title || property.listing_title || property.listingTitle || '',
        landlord_name: property.landlord_name || property.landlordName || '',
        landlord_email: property.landlord_email || property.landlordEmail || '',
        landlord_phone: property.landlord_phone || property.landlordPhone || '',
        listing_url: property.listing_url || property.listingUrl || '',
        internal_notes: property.internal_notes || property.internalNotes || '',
        acquisition_fee: parseFloat(property.acquisition_fee || property.acquisitionFee) || 0,
        source: property.source || 'manual',
        property_categories: property.property_categories || property.propertyCategories || [],
        workflow_stage: property.workflow_stage || property.workflowStage || 'new_lead',
        workflow_stage_entered_at: new Date().toISOString(),
        deal_status: property.deal_status || property.dealStatus || 'active',
        units_available: parseInt(property.units_available || property.unitsAvailable) || 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert property using REST API
      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(insertData)
      });

      if (!insertResponse.ok) {
        const errorText = await insertResponse.text();
        console.error('Insert error:', errorText);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create property', 
            details: errorText
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const insertedProperties = await insertResponse.json();
      const newProperty = Array.isArray(insertedProperties) ? insertedProperties[0] : insertedProperties;

      console.log('Property created successfully:', newProperty?.id);

      // Trigger Penny AI scoring
      let pennyScore = null;
      let pennyRecommendation = null;
      try {
        const scoringResponse = await fetch(`${supabaseUrl}/functions/v1/penny-deal-scoring`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            action: 'score',
            propertyId: newProperty.id,
            property: newProperty
          })
        });

        if (scoringResponse.ok) {
          const scoringResult = await scoringResponse.json();
          pennyScore = scoringResult.score;
          pennyRecommendation = scoringResult.recommendation;

          // Update the property with Penny score
          await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${newProperty.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
              penny_score: pennyScore,
              penny_recommendation: pennyRecommendation,
              penny_scored_at: new Date().toISOString()
            })
          });
            
          console.log('Penny score applied:', pennyScore);
        } else {
          console.log('Penny scoring returned non-OK status:', scoringResponse.status);
        }
      } catch (scoringError) {
        console.error('Penny scoring error (non-fatal):', scoringError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          property: {
            ...newProperty,
            penny_score: pennyScore,
            penny_recommendation: pennyRecommendation
          },
          message: 'Property created successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (action === 'update') {
      if (!propertyId) {
        return new Response(
          JSON.stringify({ error: 'Property ID is required for update' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      // Only include fields that are provided
      if (property.address !== undefined) updateData.address = property.address;
      if (property.city !== undefined) updateData.city = property.city;
      if (property.state !== undefined) updateData.state = property.state;
      if (property.zip_code !== undefined || property.zipCode !== undefined) 
        updateData.zip_code = property.zip_code || property.zipCode;
      if (property.price !== undefined) updateData.price = parseFloat(property.price);
      if (property.bedrooms !== undefined) updateData.bedrooms = parseInt(property.bedrooms);
      if (property.bathrooms !== undefined) updateData.bathrooms = parseFloat(property.bathrooms);
      if (property.sqft !== undefined || property.square_feet !== undefined) 
        updateData.sqft = parseInt(property.sqft || property.square_feet);
      if (property.property_type !== undefined || property.propertyType !== undefined) 
        updateData.property_type = property.property_type || property.propertyType;
      if (property.status !== undefined) updateData.status = property.status;
      if (property.photos !== undefined) updateData.photos = property.photos;
      if (property.description !== undefined) updateData.description = property.description;
      if (property.monthly_rent !== undefined || property.monthlyRent !== undefined) 
        updateData.monthly_rent = parseFloat(property.monthly_rent || property.monthlyRent);
      if (property.operation_type !== undefined || property.operationType !== undefined) 
        updateData.operation_type = property.operation_type || property.operationType;
      if (property.featured !== undefined) updateData.featured = property.featured;
      if (property.is_featured !== undefined || property.isFeatured !== undefined) 
        updateData.is_featured = property.is_featured || property.isFeatured;
      if (property.is_furnished !== undefined || property.isFurnished !== undefined) 
        updateData.is_furnished = property.is_furnished || property.isFurnished;
      if (property.is_published !== undefined) updateData.is_published = property.is_published;
      if (property.is_verified !== undefined || property.isVerified !== undefined) 
        updateData.is_verified = property.is_verified || property.isVerified;
      if (property.listing_title !== undefined || property.listingTitle !== undefined) 
        updateData.listing_title = property.listing_title || property.listingTitle;
      if (property.title !== undefined) updateData.title = property.title;
      if (property.landlord_name !== undefined || property.landlordName !== undefined) 
        updateData.landlord_name = property.landlord_name || property.landlordName;
      if (property.landlord_email !== undefined || property.landlordEmail !== undefined) 
        updateData.landlord_email = property.landlord_email || property.landlordEmail;
      if (property.landlord_phone !== undefined || property.landlordPhone !== undefined) 
        updateData.landlord_phone = property.landlord_phone || property.landlordPhone;
      if (property.listing_url !== undefined || property.listingUrl !== undefined) 
        updateData.listing_url = property.listing_url || property.listingUrl;
      if (property.internal_notes !== undefined || property.internalNotes !== undefined) 
        updateData.internal_notes = property.internal_notes || property.internalNotes;
      if (property.acquisition_fee !== undefined || property.acquisitionFee !== undefined) 
        updateData.acquisition_fee = parseFloat(property.acquisition_fee || property.acquisitionFee);
      if (property.source !== undefined) updateData.source = property.source;
      if (property.property_categories !== undefined || property.propertyCategories !== undefined) 
        updateData.property_categories = property.property_categories || property.propertyCategories;
      if (property.workflow_stage !== undefined || property.workflowStage !== undefined) {
        updateData.workflow_stage = property.workflow_stage || property.workflowStage;
        updateData.workflow_stage_entered_at = new Date().toISOString();
      }
      if (property.deal_status !== undefined || property.dealStatus !== undefined) 
        updateData.deal_status = property.deal_status || property.dealStatus;
      if (property.units_available !== undefined || property.unitsAvailable !== undefined) 
        updateData.units_available = parseInt(property.units_available || property.unitsAvailable);

      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${propertyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        return new Response(
          JSON.stringify({ error: 'Failed to update property', details: errorText }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const updatedProperties = await updateResponse.json();
      const updatedProperty = Array.isArray(updatedProperties) ? updatedProperties[0] : updatedProperties;

      return new Response(
        JSON.stringify({
          success: true,
          property: updatedProperty,
          message: 'Property updated successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (action === 'rescore') {
      if (!propertyId) {
        return new Response(
          JSON.stringify({ error: 'Property ID is required for rescoring' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Fetch the property
      const fetchResponse = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${propertyId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!fetchResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Property not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const properties = await fetchResponse.json();
      const existingProperty = properties[0];

      if (!existingProperty) {
        return new Response(
          JSON.stringify({ error: 'Property not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Trigger Penny AI scoring
      const scoringResponse = await fetch(`${supabaseUrl}/functions/v1/penny-deal-scoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          action: 'score',
          propertyId: existingProperty.id,
          property: existingProperty
        })
      });

      if (!scoringResponse.ok) {
        const errorText = await scoringResponse.text();
        return new Response(
          JSON.stringify({ error: 'Penny scoring failed', details: errorText }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const scoringResult = await scoringResponse.json();

      // Update the property with new Penny score
      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${propertyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          penny_score: scoringResult.score,
          penny_recommendation: scoringResult.recommendation,
          penny_scored_at: new Date().toISOString()
        })
      });

      const updatedProperties = await updateResponse.json();
      const updatedProperty = Array.isArray(updatedProperties) ? updatedProperties[0] : updatedProperties;

      return new Response(
        JSON.stringify({
          success: true,
          property: updatedProperty,
          score: scoringResult.score,
          recommendation: scoringResult.recommendation,
          message: 'Property rescored successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (action === 'list') {
      const { limit = 50, offset = 0, workflow_stage, deal_status, city, state } = body;
      
      let url = `${supabaseUrl}/rest/v1/properties?order=created_at.desc&limit=${limit}&offset=${offset}`;
      
      if (workflow_stage) url += `&workflow_stage=eq.${workflow_stage}`;
      if (deal_status) url += `&deal_status=eq.${deal_status}`;
      if (city) url += `&city=ilike.%25${encodeURIComponent(city)}%25`;
      if (state) url += `&state=eq.${state}`;
      
      const listResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'count=exact'
        }
      });
      
      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        return new Response(
          JSON.stringify({ error: 'Failed to list properties', details: errorText }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      const properties = await listResponse.json();
      const totalCount = listResponse.headers.get('content-range')?.split('/')[1] || properties.length;
      
      return new Response(
        JSON.stringify({
          success: true,
          properties,
          total: parseInt(totalCount),
          limit,
          offset
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (action === 'delete') {
      if (!propertyId) {
        return new Response(
          JSON.stringify({ error: 'Property ID is required for deletion' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${propertyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        return new Response(
          JSON.stringify({ error: 'Failed to delete property', details: errorText }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Property deleted successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: create, update, rescore, list, or delete' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
