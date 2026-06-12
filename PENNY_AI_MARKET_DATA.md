# Penny AI Market Data & Deal Integration

## Overview
Penny AI is the AI Success Manager for Access Your Place. She provides investors with deep market insights, regulation information, and access to live deals on the platform.

## API Endpoints

### 1. Chat with Penny
```javascript
const { data } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'chat',
    user_id: 'investor-uuid',
    user_name: 'John Doe',
    message: 'What markets are best for STR investing?',
    conversation_history: [] // Previous messages for context
  }
});

// Response
{
  success: true,
  message: "AI response with market insights...",
  is_new_investor: true,
  deals_available: 5,
  markets_referenced: ['austin', 'nashville']
}
```

### 2. Get Market Data
```javascript
const { data } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'get_market_data',
    market: 'Austin' // or 'austin', 'Austin, TX', etc.
  }
});

// Response
{
  success: true,
  market: {
    name: 'Austin, TX',
    adr: '$179-287',
    occupancy: '51-68%',
    regulations: 'Type 2 STR license required...',
    seasonality: 'Peak: March (SXSW), Oct (ACL)...',
    demandDrivers: ['Tech conferences', 'SXSW', ...],
    avgSetupCost: '$15,000-25,000',
    colivingPotential: 'Excellent - strong demand...'
  }
}
```

### 3. Get Live Deals
```javascript
const { data } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'get_live_deals',
    city: 'Austin',     // Optional: filter by city
    state: 'TX',        // Optional: filter by state
    limit: 10           // Optional: max results (default 10)
  }
});

// Response
{
  success: true,
  deals: [
    {
      id: 'uuid',
      listing_title: '4BR Home in Austin',
      city: 'Austin',
      state: 'TX',
      bedrooms: 4,
      bathrooms: 2,
      monthly_rent: 3500,
      operation_type: 'str',
      is_furnished: false,
      photos: ['url1', 'url2']
    }
  ]
}
```

### 4. Get Suggested Questions
```javascript
const { data } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'get_suggested_questions',
    user_type: 'investor' // or 'staff'
  }
});

// Response
{
  success: true,
  suggestions: [
    "What deals are available in Austin right now?",
    "What's the STR market outlook for Tampa?",
    "How much capital do I need to start?",
    ...
  ]
}
```

---

## Supported Markets

Penny has deep knowledge of the following markets:

| Market | ADR Range | Occupancy | Co-Living Potential |
|--------|-----------|-----------|---------------------|
| Austin, TX | $179-287 | 51-68% | Excellent |
| Nashville, TN | $191-221 | 51-59% | Good |
| Tampa, FL | $135-185 | 65-72% | Very Good |
| Phoenix, AZ | $165-195 | 58-65% | Good |
| Denver, CO | $185-225 | 60-68% | Excellent |
| Atlanta, GA | $144-160 | 51-56% | Very Good |
| Orlando, FL | $145-285 | 70-82% | Moderate |
| Miami, FL | $175-279 | 52-69% | Good |
| Dallas, TX | $130-200 | 52-68% | Excellent |
| San Antonio, TX | $120-175 | 55-65% | Good |
| Jacksonville, FL | $125-165 | 58-68% | Good |
| Charlotte, NC | $140-180 | 54-62% | Excellent |

---

## Market Data Details

For each market, Penny knows:

### Financial Metrics
- **ADR (Average Daily Rate)**: Expected nightly rate range
- **Occupancy Rate**: Typical occupancy percentage
- **Average Setup Cost**: Furnishing and preparation costs

### Regulatory Information
- **Licensing Requirements**: What permits are needed
- **Restrictions**: Caps, zones, or limitations
- **Enforcement Level**: How strictly rules are enforced

### Seasonality
- **Peak Seasons**: When demand is highest
- **Slow Seasons**: When to expect lower bookings
- **Major Events**: Festivals, conferences, sporting events

### Demand Drivers
- Tourism attractions
- Business/corporate travel
- Events and festivals
- Medical tourism
- University events

### Co-Living Potential
- Target demographics
- Demand level
- Best property types

---

## Slow Season Strategies

Penny can advise on these strategies for slow periods:

1. **Furnished Finder**: List for traveling nurses (30-90 day stays)
2. **Corporate Housing**: Partner with relocation companies
3. **Insurance Housing**: Work with insurance companies for displaced families
4. **Monthly Discounts**: Offer 20-40% off for monthly stays
5. **Pet-Friendly Premium**: Allow pets with deposit/fee
6. **Facebook Groups**: Post in local roommate and travel nurse groups

---

## Integration with Live Deals

When investors ask about deals, Penny:

1. **Fetches real data** from the properties table
2. **Filters by mentioned cities** in the conversation
3. **Provides specific property details** when available
4. **Directs to Deals page** for full listings
5. **Recommends booking calls** with acquisition team

### Example Conversation Flow

**Investor**: "What deals are available in Austin?"

**Penny**: 
> Great question! Here's what I know about **Austin, TX**:
> 
> 📊 **Market Stats:**
> - ADR: $179-287
> - Occupancy: 51-68%
> 
> 📍 **Available Deals:** We have 3 properties in Austin right now:
> - **4BR Home in South Austin** - $3,500/mo rent
> - **3BR Condo Downtown** - $2,800/mo rent
> - **5BR House near UT** - $4,200/mo rent
> 
> Would you like me to tell you more about any of these, or discuss the Austin market regulations?

---

## Testing Penny AI

### Quick Test Commands

```javascript
// Test market knowledge
await supabase.functions.invoke('ai-investor-chat', {
  body: { action: 'get_market_data', market: 'Austin' }
});

// Test deal fetching
await supabase.functions.invoke('ai-investor-chat', {
  body: { action: 'get_live_deals', limit: 5 }
});

// Test conversation
await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'chat',
    user_id: 'test',
    user_name: 'Test User',
    message: 'Compare Austin vs Nashville for co-living'
  }
});
```

### Expected Behaviors

1. **New investors** get a welcome message asking about experience, markets, budget, and strategy
2. **Market questions** trigger detailed data with ADR, occupancy, regulations
3. **Deal questions** show actual properties from the database
4. **Regulation questions** provide specific licensing and compliance info
5. **Strategy questions** offer actionable advice with slow season tactics

---

## Troubleshooting

### No Deals Showing
- Check that properties have `is_published = true`
- Verify properties exist in the database
- Check city/state spelling matches

### Market Not Found
- Use common city names (Austin, not ATX)
- Check available markets list above
- Penny will say "I'll need to research that" for unknown markets

### AI Response Issues
- Check GATEWAY_API_KEY is configured
- Verify API gateway connectivity
- Fallback responses will still provide basic info
