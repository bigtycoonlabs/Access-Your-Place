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

const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY');
const GATEWAY_API_KEY = Deno.env.get('GATEWAY_API_KEY');

// Keywords to filter out community amenity photos
const COMMUNITY_AMENITY_KEYWORDS = [
  'pool', 'swimming', 'clubhouse', 'club house', 'clubroom', 'club room',
  'fitness', 'gym', 'workout', 'exercise', 'dog park', 'pet', 'playground',
  'tennis', 'basketball', 'court', 'bbq', 'grill', 'picnic', 'lounge',
  'lobby', 'leasing', 'office', 'mailroom', 'mail room', 'package',
  'parking', 'garage', 'carport', 'exterior', 'building', 'aerial',
  'community', 'amenity', 'common area', 'rooftop', 'terrace', 'patio',
  'balcony view', 'neighborhood', 'street view', 'entrance', 'sign'
];

// Keywords for interior photos we want
const INTERIOR_KEYWORDS = [
  'living', 'bedroom', 'bathroom', 'kitchen', 'dining', 'closet',
  'laundry', 'washer', 'dryer', 'interior', 'inside', 'room',
  'floor', 'ceiling', 'window', 'door', 'cabinet', 'counter',
  'appliance', 'stove', 'refrigerator', 'sink', 'shower', 'tub'
];

// Analyze photo URL/filename to determine if it's an interior photo
function isLikelyInteriorPhoto(url: string, description?: string): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerDesc = (description || '').toLowerCase();
  const combined = lowerUrl + ' ' + lowerDesc;
  
  // Check for community amenity keywords (exclude these)
  for (const keyword of COMMUNITY_AMENITY_KEYWORDS) {
    if (combined.includes(keyword)) {
      return false;
    }
  }
  
  // Check for interior keywords (prefer these)
  for (const keyword of INTERIOR_KEYWORDS) {
    if (combined.includes(keyword)) {
      return true;
    }
  }
  
  // If no clear indicator, include it (will be filtered by AI later)
  return true;
}

// Use AI to describe a photo for accessibility
async function describePhotoForAccessibility(photoUrl: string, index: number): Promise<string> {
  if (!GATEWAY_API_KEY) {
    return `Property photo ${index + 1}`;
  }

  try {
    const response = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GATEWAY_API_KEY
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Analyze this property photo and provide a detailed accessibility description for a blind user. Focus on:
1. What room or space is shown (living room, bedroom, kitchen, bathroom, etc.)
2. Key features visible (furniture, appliances, fixtures, flooring type)
3. Lighting and overall condition
4. Any notable details that would help someone understand the space

Also determine if this is an INTERIOR photo of a home/apartment unit, or if it's a COMMUNITY AMENITY photo (pool, gym, clubhouse, exterior building, parking, etc.).

Respond in JSON format:
{
  "description": "Detailed description for screen readers",
  "room_type": "living room/bedroom/kitchen/bathroom/other",
  "is_interior": true/false,
  "is_community_amenity": true/false,
  "quality_score": 1-10,
  "key_features": ["feature1", "feature2"]
}

Photo URL: ${photoUrl}`
        }],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Try to parse JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Return as plain description
        return { description: content, is_interior: true, is_community_amenity: false };
      }
    }
  } catch (error: any) {
    console.error('Photo description error:', error.message);
  }

  return { description: `Property photo ${index + 1}`, is_interior: true, is_community_amenity: false };
}

// Batch describe photos with AI
async function batchDescribePhotos(photos: string[]): Promise<any[]> {
  const results: any[] = [];
  
  // Process in batches of 3 to avoid rate limits
  for (let i = 0; i < photos.length; i += 3) {
    const batch = photos.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((url, idx) => describePhotoForAccessibility(url, i + idx))
    );
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + 3 < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// Scrape property photos from Zillow using Apify
async function scrapeZillowPhotos(address: string): Promise<{ photos: any[], source: string, propertyData?: any }> {
  if (!APIFY_API_KEY) {
    console.log('Apify API key not configured');
    return { photos: [], source: 'none' };
  }

  try {
    const actorId = 'maxcopell~zillow-scraper';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_KEY}`;
    
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchType: 'address',
        search: address,
        maxItems: 1,
        proxy: { useApifyProxy: true }
      })
    });

    if (!runResponse.ok) {
      console.log('Apify run failed:', await runResponse.text());
      return { photos: [], source: 'zillow_failed' };
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      return { photos: [], source: 'zillow_no_run' };
    }

    // Wait for completion
    let attempts = 0;
    let runStatus = 'RUNNING';
    
    while (runStatus === 'RUNNING' && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`
      );
      const statusData = await statusResponse.json();
      runStatus = statusData.data?.status || 'FAILED';
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      return { photos: [], source: 'zillow_timeout' };
    }

    const datasetId = runData.data?.defaultDatasetId;
    if (!datasetId) {
      return { photos: [], source: 'zillow_no_dataset' };
    }

    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`
    );
    const results = await resultsResponse.json();

    if (!results || results.length === 0) {
      return { photos: [], source: 'zillow_no_results' };
    }

    const property = results[0];
    const rawPhotos: string[] = [];

    if (property.photos && Array.isArray(property.photos)) {
      for (const p of property.photos) {
        const url = p.url || p.mixedSources?.jpeg?.[0]?.url || (typeof p === 'string' ? p : null);
        if (url && isLikelyInteriorPhoto(url, p.caption || p.description)) {
          rawPhotos.push(url);
        }
      }
    }
    if (property.imgSrc && isLikelyInteriorPhoto(property.imgSrc)) {
      rawPhotos.push(property.imgSrc);
    }

    // Extract property data
    const propertyData = {
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sqft: property.livingArea || property.sqft,
      yearBuilt: property.yearBuilt,
      propertyType: property.homeType || property.propertyType,
      price: property.price,
      rent: property.rentZestimate || property.rent,
      city: property.city,
      state: property.state,
      zipCode: property.zipcode
    };

    return { 
      photos: rawPhotos.slice(0, 25), 
      source: 'zillow',
      propertyData 
    };
  } catch (error: any) {
    console.error('Zillow scrape error:', error.message);
    return { photos: [], source: 'zillow_error' };
  }
}

// Scrape property photos from Realtor.com using Apify
async function scrapeRealtorPhotos(address: string): Promise<{ photos: any[], source: string, propertyData?: any }> {
  if (!APIFY_API_KEY) {
    return { photos: [], source: 'none' };
  }

  try {
    const actorId = 'jupri~realtor-scraper';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_KEY}`;
    
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchType: 'address',
        search: address,
        maxItems: 1
      })
    });

    if (!runResponse.ok) {
      return { photos: [], source: 'realtor_failed' };
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      return { photos: [], source: 'realtor_no_run' };
    }

    let attempts = 0;
    let runStatus = 'RUNNING';
    
    while (runStatus === 'RUNNING' && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`
      );
      const statusData = await statusResponse.json();
      runStatus = statusData.data?.status || 'FAILED';
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      return { photos: [], source: 'realtor_timeout' };
    }

    const datasetId = runData.data?.defaultDatasetId;
    if (!datasetId) {
      return { photos: [], source: 'realtor_no_dataset' };
    }

    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`
    );
    const results = await resultsResponse.json();

    if (!results || results.length === 0) {
      return { photos: [], source: 'realtor_no_results' };
    }

    const property = results[0];
    const rawPhotos: string[] = [];

    if (property.photos && Array.isArray(property.photos)) {
      for (const p of property.photos) {
        const url = p.href || p.url || (typeof p === 'string' ? p : null);
        if (url && isLikelyInteriorPhoto(url, p.tags?.join(' ') || '')) {
          rawPhotos.push(url);
        }
      }
    }
    if (property.primary_photo?.href && isLikelyInteriorPhoto(property.primary_photo.href)) {
      rawPhotos.unshift(property.primary_photo.href);
    }

    const propertyData = {
      bedrooms: property.beds || property.bedrooms,
      bathrooms: property.baths || property.bathrooms,
      sqft: property.sqft,
      yearBuilt: property.year_built,
      propertyType: property.type || property.prop_type,
      price: property.price || property.list_price,
      city: property.city,
      state: property.state,
      zipCode: property.postal_code
    };

    return { 
      photos: rawPhotos.slice(0, 25), 
      source: 'realtor',
      propertyData 
    };
  } catch (error: any) {
    console.error('Realtor scrape error:', error.message);
    return { photos: [], source: 'realtor_error' };
  }
}

// Generate property listing description using AI
async function generateListingDescription(propertyData: any): Promise<string> {
  if (!GATEWAY_API_KEY) {
    return generateFallbackDescription(propertyData);
  }

  try {
    const prompt = `Generate a compelling property listing description for a rental arbitrage deal. Do NOT include the specific address in the description.

Property Details:
- City: ${propertyData.city || 'Unknown'}
- State: ${propertyData.state || 'Unknown'}
- Bedrooms: ${propertyData.bedrooms || 'Unknown'}
- Bathrooms: ${propertyData.bathrooms || 'Unknown'}
- Square Feet: ${propertyData.sqft || 'Unknown'}
- Year Built: ${propertyData.yearBuilt || 'Unknown'}
- Property Type: ${propertyData.propertyType || 'Single Family'}
- Estimated Monthly Rent: ${propertyData.rent || 'TBD'}
- Projected Monthly Revenue: ${propertyData.projectedRevenue || 'TBD'}

Write a professional, enticing description that highlights:
1. Location benefits (without revealing exact address)
2. Property features
3. Investment potential for rental arbitrage
4. Why this is a great opportunity

Keep it under 300 words and make it compelling for investors.`;

    const response = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GATEWAY_API_KEY
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || generateFallbackDescription(propertyData);
    }
  } catch (error: any) {
    console.error('AI description error:', error.message);
  }

  return generateFallbackDescription(propertyData);
}

function generateFallbackDescription(propertyData: any): string {
  return `Excellent rental arbitrage opportunity in ${propertyData.city || 'a prime location'}, ${propertyData.state || ''}!

This ${propertyData.bedrooms || ''}BR/${propertyData.bathrooms || ''}BA property offers strong investment potential with projected monthly revenue of ${propertyData.projectedRevenue || 'competitive returns'}.

Key Features:
â€¢ ${propertyData.sqft ? propertyData.sqft + ' sq ft of living space' : 'Spacious layout'}
â€¢ ${propertyData.propertyType || 'Well-maintained property'}
â€¢ Prime location for short-term rental demand
â€¢ Strong market fundamentals

Contact an acquisition manager to learn more about this opportunity and discuss how it fits your investment strategy.`;
}

// Calculate performance metrics
function calculatePerformanceMetrics(propertyData: any, marketData: any): any {
  const rent = propertyData.rent || 2000;
  const bedrooms = propertyData.bedrooms || 2;
  
  const baseADR = marketData?.adr || (bedrooms <= 1 ? 120 : bedrooms === 2 ? 150 : bedrooms === 3 ? 180 : 220);
  const occupancy = marketData?.occupancy || 0.65;
  
  const monthlyRevenue = Math.round(baseADR * 30 * occupancy);
  const annualRevenue = monthlyRevenue * 12;
  const annualExpenses = rent * 12 * 0.35;
  const annualProfit = annualRevenue - (rent * 12) - annualExpenses;
  const roi = ((annualProfit / (rent * 3)) * 100).toFixed(1);

  return {
    projected_adr: baseADR,
    projected_occupancy: (occupancy * 100).toFixed(0) + '%',
    projected_monthly_revenue: monthlyRevenue,
    projected_annual_revenue: annualRevenue,
    estimated_monthly_expenses: Math.round(rent * 0.35),
    estimated_annual_profit: Math.round(annualProfit),
    estimated_roi: roi + '%',
    startup_cost_estimate: rent * 3,
    break_even_months: Math.ceil((rent * 3) / (monthlyRevenue - rent - (rent * 0.35)))
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, address, city, state, zip_code, property_data, staff_id, photos, include_descriptions } = body;

    // Verify staff member
    if (!staff_id) {
      return new Response(JSON.stringify({ 
        error: 'Staff authentication required',
        success: false 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Action: Scrape property photos with AI filtering
    if (action === 'scrape_photos') {
      if (!address) {
        return new Response(JSON.stringify({ 
          error: 'Address is required',
          success: false 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log(`Staff ${staff_id} scraping photos for: ${address}`);

      // Try Zillow first, then Realtor
      let result = await scrapeZillowPhotos(address);
      
      if (result.photos.length === 0) {
        result = await scrapeRealtorPhotos(address);
      }

      // If we have photos and descriptions are requested, use AI to describe and filter
      let processedPhotos: any[] = [];
      
      if (result.photos.length > 0) {
        if (include_descriptions) {
          // Get AI descriptions for each photo
          const descriptions = await batchDescribePhotos(result.photos);
          
          // Filter out community amenity photos and build processed array
          processedPhotos = result.photos.map((url, idx) => {
            const desc = descriptions[idx] || {};
            return {
              id: `photo-${idx}`,
              url,
              description: typeof desc === 'string' ? desc : desc.description || `Property photo ${idx + 1}`,
              room_type: desc.room_type || 'unknown',
              is_interior: desc.is_interior !== false,
              is_community_amenity: desc.is_community_amenity === true,
              quality_score: desc.quality_score || 5,
              key_features: desc.key_features || [],
              order: idx,
              is_primary: idx === 0,
              selected: true
            };
          }).filter(p => p.is_interior && !p.is_community_amenity);
        } else {
          // Just return URLs without descriptions
          processedPhotos = result.photos.map((url, idx) => ({
            id: `photo-${idx}`,
            url,
            description: `Property photo ${idx + 1}`,
            order: idx,
            is_primary: idx === 0,
            selected: true
          }));
        }
      }

      return new Response(JSON.stringify({
        success: true,
        photos: processedPhotos,
        source: result.source,
        count: processedPhotos.length,
        property_data: result.propertyData,
        message: processedPhotos.length > 0 
          ? `Found ${processedPhotos.length} interior photos from ${result.source}`
          : 'No interior photos found. Try a different address format or check the listing manually.'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Action: Describe photos for accessibility
    if (action === 'describe_photos') {
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'Photos array is required',
          success: false 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log(`Staff ${staff_id} requesting descriptions for ${photos.length} photos`);

      const photoUrls = photos.map(p => typeof p === 'string' ? p : p.url);
      const descriptions = await batchDescribePhotos(photoUrls);
      
      const processedPhotos = photos.map((photo, idx) => {
        const url = typeof photo === 'string' ? photo : photo.url;
        const desc = descriptions[idx] || {};
        return {
          id: photo.id || `photo-${idx}`,
          url,
          description: typeof desc === 'string' ? desc : desc.description || `Property photo ${idx + 1}`,
          room_type: desc.room_type || 'unknown',
          is_interior: desc.is_interior !== false,
          is_community_amenity: desc.is_community_amenity === true,
          quality_score: desc.quality_score || 5,
          key_features: desc.key_features || [],
          order: photo.order ?? idx,
          is_primary: photo.is_primary ?? (idx === 0),
          selected: photo.selected ?? true
        };
      });

      return new Response(JSON.stringify({
        success: true,
        photos: processedPhotos,
        interior_count: processedPhotos.filter(p => p.is_interior && !p.is_community_amenity).length
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Action: Generate listing
    if (action === 'generate_listing') {
      if (!property_data) {
        return new Response(JSON.stringify({ 
          error: 'Property data is required',
          success: false 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log(`Staff ${staff_id} generating listing for property in ${property_data.city}`);

      const description = await generateListingDescription(property_data);
      const metrics = calculatePerformanceMetrics(property_data, null);

      return new Response(JSON.stringify({
        success: true,
        listing: {
          description,
          metrics,
          city: property_data.city,
          state: property_data.state,
          bedrooms: property_data.bedrooms,
          bathrooms: property_data.bathrooms,
          property_type: property_data.propertyType || 'Single Family'
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Action: Full property research (photos + listing + metrics)
    if (action === 'full_research') {
      if (!address) {
        return new Response(JSON.stringify({ 
          error: 'Address is required',
          success: false 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log(`Staff ${staff_id} doing full research for: ${address}`);

      // Scrape photos
      let photoResult = await scrapeZillowPhotos(address);
      if (photoResult.photos.length === 0) {
        photoResult = await scrapeRealtorPhotos(address);
      }

      // Get AI descriptions and filter
      let processedPhotos: any[] = [];
      if (photoResult.photos.length > 0) {
        const descriptions = await batchDescribePhotos(photoResult.photos);
        processedPhotos = photoResult.photos.map((url, idx) => {
          const desc = descriptions[idx] || {};
          return {
            id: `photo-${idx}`,
            url,
            description: typeof desc === 'string' ? desc : desc.description || `Property photo ${idx + 1}`,
            room_type: desc.room_type || 'unknown',
            is_interior: desc.is_interior !== false,
            is_community_amenity: desc.is_community_amenity === true,
            quality_score: desc.quality_score || 5,
            key_features: desc.key_features || [],
            order: idx,
            is_primary: idx === 0,
            selected: true
          };
        }).filter(p => p.is_interior && !p.is_community_amenity);
      }

      // Parse address for property data
      const addressParts = address.split(',').map((p: string) => p.trim());
      const propertyData = {
        city: city || photoResult.propertyData?.city || addressParts[1] || 'Unknown',
        state: state || photoResult.propertyData?.state || addressParts[2]?.split(' ')[0] || 'Unknown',
        zip_code: zip_code || photoResult.propertyData?.zipCode || addressParts[2]?.split(' ')[1] || '',
        bedrooms: property_data?.bedrooms || photoResult.propertyData?.bedrooms || 3,
        bathrooms: property_data?.bathrooms || photoResult.propertyData?.bathrooms || 2,
        sqft: property_data?.sqft || photoResult.propertyData?.sqft,
        yearBuilt: property_data?.yearBuilt || photoResult.propertyData?.yearBuilt,
        rent: property_data?.rent || photoResult.propertyData?.rent || 2000,
        propertyType: property_data?.propertyType || photoResult.propertyData?.propertyType || 'Single Family'
      };

      // Generate description
      const description = await generateListingDescription(propertyData);

      // Calculate metrics
      const metrics = calculatePerformanceMetrics(propertyData, null);

      return new Response(JSON.stringify({
        success: true,
        research: {
          photos: processedPhotos,
          photo_source: photoResult.source,
          photo_count: processedPhotos.length,
          description,
          metrics,
          property_data: propertyData,
          staff_only_address: address
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid action',
      success: false 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Property photos error:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message || 'Server error',
      success: false 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

