# Property Management Edge Functions

Complete edge functions for managing properties/deals in the deal flow system.

## Database Schema Required

```sql
-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT,
  listing_title TEXT,
  listing_description TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  bedrooms INTEGER DEFAULT 3,
  bathrooms DECIMAL DEFAULT 2,
  square_feet INTEGER,
  monthly_rent DECIMAL DEFAULT 0,
  acquisition_fee DECIMAL DEFAULT 2500,
  property_type TEXT DEFAULT 'single_family',
  operation_type TEXT DEFAULT 'str',
  source TEXT DEFAULT 'acquisition_team',
  status TEXT DEFAULT 'new',
  deal_status TEXT DEFAULT 'new',
  is_furnished BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  units_available INTEGER DEFAULT 1,
  landlord_name TEXT,
  landlord_email TEXT,
  landlord_phone TEXT,
  listing_url TEXT,
  property_categories TEXT[] DEFAULT '{}',
  assigned_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal analytics table
CREATE TABLE IF NOT EXISTS deal_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  str_adr DECIMAL DEFAULT 0,
  str_occupancy DECIMAL DEFAULT 0,
  str_yearly_revenue DECIMAL DEFAULT 0,
  coliving_adr DECIMAL DEFAULT 0,
  coliving_occupancy DECIMAL DEFAULT 0,
  coliving_yearly_revenue DECIMAL DEFAULT 0,
  str_viability_score INTEGER DEFAULT 0,
  coliving_viability_score INTEGER DEFAULT 0,
  ai_recommendation TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property photos table
CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  original_url TEXT,
  processed_url TEXT,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outreach tracking table
CREATE TABLE IF NOT EXISTS outreach_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  contact_method TEXT DEFAULT 'email',
  template_used TEXT,
  status TEXT DEFAULT 'pending',
  outcome TEXT,
  callback_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outreach notes table
CREATE TABLE IF NOT EXISTS outreach_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',
  author_name TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_source ON properties(source);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_zip ON properties(zip_code);
CREATE INDEX IF NOT EXISTS idx_deal_analytics_property ON deal_analytics(property_id);
```

---

## 1. add-property

**Purpose**: Add a new property/deal to the database

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Build property object with all fields
    const property = {
      address: body.address || null,
      listing_title: body.listing_title || body.title || `${body.bedrooms || 3}BR in ${body.city}`,
      listing_description: body.description || body.listing_description || null,
      city: body.city,
      state: body.state?.toUpperCase() || 'TX',
      zip_code: body.zip_code || null,
      bedrooms: parseInt(body.bedrooms) || 3,
      bathrooms: parseFloat(body.bathrooms) || 2,
      square_feet: body.square_feet || null,
      monthly_rent: parseFloat(body.monthly_rent) || 0,
      acquisition_fee: parseFloat(body.acquisition_fee) || 2500,
      property_type: body.property_type || 'single_family',
      operation_type: body.operation_type || 'str',
      source: body.source || 'acquisition_team',
      status: body.status || 'new',
      deal_status: body.deal_status || body.status || 'new',
      is_furnished: body.is_furnished || false,
      is_verified: body.is_verified || false,
      is_published: body.is_published || false,
      units_available: body.units_available || 1,
      landlord_name: body.landlord_name || null,
      landlord_email: body.landlord_email || null,
      landlord_phone: body.landlord_phone || null,
      listing_url: body.listing_url || null,
      property_categories: body.property_categories || [],
      assigned_to: body.assigned_to || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Insert property
    const response = await fetch(`${supabaseUrl}/rest/v1/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(property)
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to insert property')
    }

    const insertedProperty = Array.isArray(data) ? data[0] : data

    // Create initial analytics record
    if (insertedProperty?.id) {
      await fetch(`${supabaseUrl}/rest/v1/deal_analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          property_id: insertedProperty.id,
          str_adr: 0,
          str_occupancy: 0,
          str_yearly_revenue: 0,
          coliving_adr: 0,
          coliving_occupancy: 0,
          coliving_yearly_revenue: 0,
          str_viability_score: 0,
          coliving_viability_score: 0
        })
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      property: insertedProperty,
      message: 'Property added successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Add property error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 2. get-properties

**Purpose**: Fetch properties with optional filters

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Build query URL with filters
    let url = `${supabaseUrl}/rest/v1/properties?select=*,deal_analytics(*),property_photos(*)&order=created_at.desc`
    
    if (body.status) url += `&status=eq.${body.status}`
    if (body.source) url += `&source=eq.${body.source}`
    if (body.property_type) url += `&property_type=eq.${body.property_type}`
    if (body.is_published !== undefined) url += `&is_published=eq.${body.is_published}`
    if (body.zip_code) url += `&zip_code=eq.${body.zip_code}`
    if (body.city) url += `&city=ilike.*${body.city}*`
    if (body.address) url += `&or=(address.ilike.*${body.address}*,listing_title.ilike.*${body.address}*)`
    if (body.limit) url += `&limit=${body.limit}`

    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    const properties = await response.json()

    return new Response(JSON.stringify({ 
      properties: properties || [],
      count: properties?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Get properties error:', error)
    return new Response(JSON.stringify({ 
      properties: [], 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 3. update-property

**Purpose**: Update an existing property

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { id, ...updates } = body
    
    if (!id) {
      throw new Error('Property ID is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString()

    const response = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    })

    const data = await response.json()

    return new Response(JSON.stringify({ 
      success: true, 
      property: Array.isArray(data) ? data[0] : data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 4. delete-property

**Purpose**: Delete a property and all related data

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { property_id } = await req.json()
    
    if (!property_id) {
      throw new Error('Property ID is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Delete related records first (if not using CASCADE)
    await fetch(`${supabaseUrl}/rest/v1/deal_analytics?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/property_photos?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/outreach_tracking?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/outreach_notes?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    // Delete the property
    const response = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${property_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Property deleted successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 5. clear-all-properties

**Purpose**: Clear all properties from the database (admin only)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { confirm } = await req.json()
    
    if (confirm !== 'DELETE_ALL_PROPERTIES') {
      throw new Error('Confirmation required. Send { confirm: "DELETE_ALL_PROPERTIES" }')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Get count before deletion
    const countRes = await fetch(`${supabaseUrl}/rest/v1/properties?select=id`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const properties = await countRes.json()
    const deletedCount = properties?.length || 0

    // Delete all related records first
    await fetch(`${supabaseUrl}/rest/v1/deal_analytics?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/property_photos?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/outreach_tracking?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/outreach_notes?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    // Delete all properties
    await fetch(`${supabaseUrl}/rest/v1/properties?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully deleted ${deletedCount} properties and all related data`,
      deleted_count: deletedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## Deployment Instructions

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Create each function with the names:
   - `add-property`
   - `get-properties`
   - `update-property`
   - `delete-property`
   - `clear-all-properties`
4. Copy and paste the code for each function
5. Deploy

## Testing

Test the functions using the Staff Dashboard:
- **Add Deal** button opens the AddDealModal
- **Delete** button on each property card
- **Clear All Deals** button (admin only) removes all sample data
