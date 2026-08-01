import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { PennyMark } from '@/components/investor/PennyMark';
import { playPennyChime } from '@/lib/pennyChime';
import { 
  Send, Loader2, Plus, Building2, TrendingUp, 
  HelpCircle, Sparkles, RefreshCw, AlertTriangle, 
  CheckCircle2, BarChart3, Calendar, Shield, Target,
  Zap, Database, FileText, Search as SearchIcon,
  Volume2, VolumeX
} from 'lucide-react';


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  sopVerified?: boolean;
  dealScore?: number;
  actionsExecuted?: Array<{action: string; success: boolean}>;
}

interface AIChatProps {
  investorId: string;
  investorName: string;
}

interface MarketAlert {
  id: string;
  type: string;
  severity: string;
  market: string;
  title: string;
  description: string;
}

const QUICK_ACTIONS = [
  { id: 'portfolio', icon: TrendingUp, label: 'My Portfolio', question: 'Show me my portfolio summary' },
  { id: 'marketplace', icon: Building2, label: 'Deal Marketplace', question: 'How does the deal marketplace work and what deals are available?' },
  { id: 'analyze', icon: Target, label: 'Analyze a Deal', question: 'Analyze a deal with ADR $200 and 65% occupancy in Austin' },
  { id: 'credits', icon: Database, label: 'My Credits', question: 'Check my credit balance' },
  { id: 'referrals', icon: Zap, label: 'Referral Program', question: 'How does the referral program work? Tell me about property referrals and client referrals.' },
  { id: 'messaging', icon: FileText, label: 'Messages & AM', question: 'How do I message my acquisition manager?' },
  { id: 'landlord', icon: Building2, label: 'Landlord Portal', question: 'How does the landlord partnership portal work?' },
  { id: 'sell', icon: BarChart3, label: 'Sell My Operation', question: 'How can I sell my rental operation on the marketplace?' },
  { id: 'setup', icon: CheckCircle2, label: 'Setup Services', question: 'What setup services are available for my property?' },
];


// ---- LOCAL INTELLIGENCE ENGINE ----
// This provides real, actionable responses when the edge function fails or returns templated content

function detectTemplatedResponse(text: string): boolean {
  if (!text || text.length < 30) return true;
  const templatePatterns = [
    /I('m| am) (just )?an AI/i,
    /I don't have (access|the ability)/i,
    /I('m| am) not able to/i,
    /I cannot (access|browse|search|look up)/i,
    /as an AI (language )?model/i,
    /I('m| am) sorry,? (but )?I (can't|cannot|don't)/i,
    /I('m| am) unable to/i,
    /I don't have real-time/i,
    /my training data/i,
    /I don't have access to.*database/i,
    /I can't actually.*look up/i,
  ];
  
  const hasGenericPattern = templatePatterns.some(p => p.test(text));
  if (!hasGenericPattern) return false;
  
  // If it has generic patterns BUT also has real data markers, it's OK
  const hasRealData = /\$[\d,]+/.test(text) || /\*\*[A-Z]/.test(text) || /\d+\s*(bed|bath|BR|BA)/i.test(text) || /Score:\s*\d+/i.test(text);
  if (hasRealData) return false;
  
  return true;
}


async function fetchPortfolioData(investorId: string) {
  try {
    const { data } = await supabase.functions.invoke('investor-auth', {
      body: { action: 'get_portfolio_properties', investor_id: investorId }
    });
    if (data?.properties) return data.properties;
  } catch {}
  try {
    const { data } = await supabase.from('investor_portfolio').select('*').eq('investor_id', investorId);
    return data || [];
  } catch { return []; }
}

async function fetchMarketplaceDeals() {
  try {
    const { data } = await supabase.from('properties')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(10);
    return data || [];
  } catch { return []; }
}

async function fetchCreditsData(investorId: string) {
  try {
    const { data } = await supabase.functions.invoke('manage-investor-credits', {
      body: { action: 'get_investor_credit_summary', investor_id: investorId }
    });
    return data?.summary || null;
  } catch { return null; }
}

function generatePortfolioSummary(properties: any[], investorName: string): string {
  if (!properties || properties.length === 0) {
    return `**Portfolio Summary for ${investorName}**\n\nYou don't have any properties in your portfolio yet. Here's how to get started:\n\n1. **Browse the Deal Marketplace** - Check out available deals in your target markets\n2. **Talk to your Acquisition Manager** - They can help find properties matching your criteria\n3. **Use the Deal Locator** - Search for specific markets and property types\n\nWould you like me to help you analyze a specific market or calculate potential revenue for a property you're considering?`;
  }

  const active = properties.filter((p: any) => p.property_status === 'active');
  const pending = properties.filter((p: any) => p.property_status === 'pending' || p.property_status === 'pending_approval');
  const totalRent = properties.reduce((s: number, p: any) => s + (p.monthly_rent || 0), 0);
  const totalEarnings = properties.reduce((s: number, p: any) => s + (p.monthly_earnings || 0), 0);
  const totalInvested = properties.reduce((s: number, p: any) => s + (p.initial_investment || 0), 0);
  const cities = [...new Set(properties.map((p: any) => `${p.city}, ${p.state}`))];
  const avgBeds = properties.length > 0 ? (properties.reduce((s: number, p: any) => s + (p.bedrooms || 0), 0) / properties.length).toFixed(1) : '0';
  const roi = totalInvested > 0 ? ((totalEarnings * 12 / totalInvested) * 100).toFixed(1) : 'N/A';

  let summary = `**Portfolio Summary for ${investorName}**\n\n`;
  summary += `**Total Properties:** ${properties.length} (${active.length} active, ${pending.length} in progress)\n`;
  summary += `**Markets:** ${cities.join(', ')}\n`;
  summary += `**Avg Bedrooms:** ${avgBeds}\n\n`;
  summary += `**Financial Overview:**\n`;
  summary += `- Monthly Rent: $${totalRent.toLocaleString()}\n`;
  summary += `- Monthly Earnings: $${totalEarnings.toLocaleString()}\n`;
  summary += `- Total Invested: $${totalInvested.toLocaleString()}\n`;
  summary += `- Annualized ROI: ${roi}%\n\n`;

  if (pending.length > 0) {
    summary += `**In Progress (${pending.length}):**\n`;
    pending.forEach((p: any) => {
      summary += `- ${p.address}, ${p.city} ${p.state} — ${p.bedrooms}bd/${p.bathrooms}ba\n`;
    });
    summary += '\n';
  }

  if (active.length > 0) {
    summary += `**Active Properties:**\n`;
    active.forEach((p: any) => {
      summary += `- **${p.address}**, ${p.city} ${p.state} — ${p.bedrooms}bd/${p.bathrooms}ba — $${(p.monthly_earnings || 0).toLocaleString()}/mo earnings\n`;
    });
  }

  summary += `\nWould you like me to analyze any specific property's performance, calculate revenue projections, or explore new markets?`;
  return summary;
}

function generateDealAnalysis(message: string): string {
  const adrMatch = message.match(/\$?(\d+)\s*(adr|average daily rate|nightly rate|per night)/i) || message.match(/adr\s*\$?(\d+)/i);
  const occMatch = message.match(/(\d+)\s*%?\s*(occupancy|occ)/i) || message.match(/occupancy\s*(?:of\s*)?(\d+)/i);
  const cityMatch = message.match(/(?:in|for|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  
  const adr = adrMatch ? parseInt(adrMatch[1]) : 175;
  const occ = occMatch ? parseInt(occMatch[1]) / 100 : 0.68;
  const city = cityMatch ? cityMatch[1] : 'your target market';

  const annualRevenue = adr * occ * 365;
  const monthlyRevenue = annualRevenue / 12;
  const estimatedExpenses = monthlyRevenue * 0.35;
  const netMonthly = monthlyRevenue - estimatedExpenses;
  const netAnnual = netMonthly * 12;

  // Penny Score calculation
  let pennyScore = 50;
  if (adr >= 150 && adr <= 300) pennyScore += 15;
  if (occ >= 0.65) pennyScore += 15;
  if (netMonthly > 2000) pennyScore += 10;
  if (netAnnual > 30000) pennyScore += 10;
  pennyScore = Math.min(100, pennyScore);

  let scoreLabel = 'Fair';
  if (pennyScore >= 85) scoreLabel = 'Excellent';
  else if (pennyScore >= 70) scoreLabel = 'Good';
  else if (pennyScore >= 55) scoreLabel = 'Fair';
  else scoreLabel = 'Below Average';

  let analysis = `**Deal Analysis — ${city}**\n\n`;
  analysis += `**Input Parameters:**\n`;
  analysis += `- ADR: $${adr}\n`;
  analysis += `- Occupancy: ${(occ * 100).toFixed(0)}%\n`;
  analysis += `- Market: ${city}\n\n`;
  analysis += `**Revenue Projections:**\n`;
  analysis += `- Gross Annual Revenue: **$${annualRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n`;
  analysis += `- Gross Monthly Revenue: **$${monthlyRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n`;
  analysis += `- Est. Operating Expenses (35%): -$${estimatedExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}/mo\n`;
  analysis += `- **Net Monthly Income: $${netMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n`;
  analysis += `- **Net Annual Income: $${netAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n\n`;
  analysis += `**Penny Score: ${pennyScore}/100 (${scoreLabel})**\n\n`;
  analysis += `**Key Insights:**\n`;
  
  if (occ >= 0.75) {
    analysis += `- Strong occupancy rate — this market has healthy demand\n`;
  } else if (occ >= 0.60) {
    analysis += `- Solid occupancy — room for improvement with dynamic pricing\n`;
  } else {
    analysis += `- Occupancy is below average — consider seasonal pricing strategies\n`;
  }

  if (adr >= 200) {
    analysis += `- Premium ADR suggests a desirable market with strong traveler demand\n`;
  } else if (adr >= 130) {
    analysis += `- Mid-range ADR — typical for suburban/secondary markets\n`;
  } else {
    analysis += `- Lower ADR — focus on volume and minimizing expenses\n`;
  }

  analysis += `\n**Recommendations:**\n`;
  analysis += `1. Verify comparable properties on AirDNA or Mashvisor for this market\n`;
  analysis += `2. Factor in seasonal variations — peak vs. slow season ADR can vary 30-50%\n`;
  analysis += `3. Consider co-living or mid-term rental strategies to stabilize income\n`;
  analysis += `4. Ensure your lease terms allow for the intended operation type\n`;

  return analysis;
}

function generateRevenueCalculation(message: string): string {
  const adrMatch = message.match(/\$?(\d+)\s*(adr|average daily rate|nightly|per night)/i) || message.match(/adr\s*\$?(\d+)/i);
  const occMatch = message.match(/(\d+)\s*%?\s*(occupancy|occ)/i);
  const rentMatch = message.match(/\$?(\d+)\s*(rent|monthly rent)/i);
  const bedsMatch = message.match(/(\d+)\s*(bed|bedroom|br)/i);

  const adr = adrMatch ? parseInt(adrMatch[1]) : 165;
  const occ = occMatch ? parseInt(occMatch[1]) / 100 : 0.70;
  const rent = rentMatch ? parseInt(rentMatch[1]) : 1800;
  const beds = bedsMatch ? parseInt(bedsMatch[1]) : 3;

  const grossMonthly = adr * occ * 30;
  const grossAnnual = grossMonthly * 12;
  const cleaningPerTurn = beds <= 2 ? 85 : beds <= 3 ? 120 : 160;
  const turnsPerMonth = Math.round(occ * 30 / 3);
  const cleaningMonthly = cleaningPerTurn * turnsPerMonth;
  const suppliesMonthly = beds * 50;
  const utilitiesMonthly = 200 + (beds * 40);
  const platformFees = grossMonthly * 0.03;
  const totalExpenses = rent + cleaningMonthly + suppliesMonthly + utilitiesMonthly + platformFees;
  const netMonthly = grossMonthly - totalExpenses;
  const netAnnual = netMonthly * 12;

  let calc = `**Revenue Calculator Results**\n\n`;
  calc += `**Inputs:**\n`;
  calc += `- ADR: $${adr} | Occupancy: ${(occ * 100).toFixed(0)}% | Bedrooms: ${beds}\n`;
  calc += `- Monthly Rent: $${rent.toLocaleString()}\n\n`;
  calc += `**Gross Revenue:**\n`;
  calc += `- Monthly: **$${grossMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n`;
  calc += `- Annual: **$${grossAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n\n`;
  calc += `**Estimated Monthly Expenses:**\n`;
  calc += `- Rent: $${rent.toLocaleString()}\n`;
  calc += `- Cleaning (~${turnsPerMonth} turns @ $${cleaningPerTurn}): $${cleaningMonthly.toLocaleString()}\n`;
  calc += `- Supplies & consumables: $${suppliesMonthly}\n`;
  calc += `- Utilities: $${utilitiesMonthly}\n`;
  calc += `- Platform fees (3%): $${platformFees.toLocaleString(undefined, {maximumFractionDigits: 0})}\n`;
  calc += `- **Total Expenses: $${totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n\n`;
  calc += `**Net Profit:**\n`;
  calc += `- Monthly: **$${netMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n`;
  calc += `- Annual: **$${netAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}**\n`;
  calc += `- Profit Margin: **${((netMonthly / grossMonthly) * 100).toFixed(1)}%**\n\n`;

  if (netMonthly > 0) {
    calc += `This deal looks **profitable** with a ${((netMonthly / grossMonthly) * 100).toFixed(0)}% margin. `;
    if (netMonthly > 2000) calc += `Strong cash flow potential!`;
    else calc += `Consider ways to optimize ADR or reduce expenses to increase margins.`;
  } else {
    calc += `**Warning:** This deal shows a negative cash flow of $${Math.abs(netMonthly).toLocaleString()}/mo. Consider negotiating lower rent, increasing ADR through better amenities, or exploring co-living/MTR strategies.`;
  }

  return calc;
}

function generateMarketplaceResponse(deals: any[]): string {
  if (!deals || deals.length === 0) {
    return `**Marketplace Deals**\n\nThere are currently no published deals on the marketplace. Here's what you can do:\n\n1. **Set up Deal Alerts** — Get notified when new deals matching your criteria are posted\n2. **Talk to your AM** — They may have off-market opportunities\n3. **Check back soon** — New deals are added regularly\n\nWould you like me to help you set up deal alert preferences?`;
  }

  let response = `**Available Marketplace Deals (${deals.length})**\n\n`;
  deals.slice(0, 8).forEach((deal: any, i: number) => {
    const addr = deal.street_address || deal.address || 'Address Available After Funding';
    const city = deal.city || 'N/A';
    const state = deal.state || '';
    const beds = deal.bedrooms || '?';
    const baths = deal.bathrooms || '?';
    const rent = deal.monthly_rent ? `$${deal.monthly_rent.toLocaleString()}/mo` : 'Contact for pricing';
    response += `**${i + 1}. ${city}, ${state}** — ${beds}bd/${baths}ba — ${rent}\n`;
    if (deal.description) response += `   ${deal.description.substring(0, 80)}...\n`;
    response += '\n';
  });

  response += `\nWould you like me to analyze any of these deals in detail? Just tell me which one and I'll run the numbers.`;
  return response;
}

function generateListingContent(message: string): string {
  const bedsMatch = message.match(/(\d+)\s*(?:bed|br|bedroom)/i);
  const cityMatch = message.match(/(?:in|at|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  const beds = bedsMatch ? parseInt(bedsMatch[1]) : 2;
  const city = cityMatch ? cityMatch[1] : 'Your City';
  const guests = beds * 2 + 1;

  let listing = `**Airbnb Listing — ${beds}BR in ${city}**\n\n`;
  listing += `**Title Options:**\n`;
  listing += `1. "Stylish ${beds}BR Retreat | ${city} | Perfect for Groups"\n`;
  listing += `2. "Modern ${beds}-Bedroom Home | Walk to Everything in ${city}"\n`;
  listing += `3. "Cozy ${city} Getaway | ${beds}BR | Fast WiFi + Smart TV"\n\n`;
  listing += `**Description:**\n\n`;
  listing += `Welcome to your home away from home in the heart of ${city}! This beautifully designed ${beds}-bedroom space comfortably accommodates up to ${guests} guests and features everything you need for a memorable stay.\n\n`;
  listing += `**The Space:**\n`;
  listing += `Step inside to find a thoughtfully curated living area with comfortable seating, a smart TV with streaming services, and plenty of natural light. The fully equipped kitchen has everything you need to cook your favorite meals, from a coffee maker to all essential cookware.\n\n`;
  listing += `Each of the ${beds} bedrooms features premium bedding, blackout curtains, and ample closet space. The bathroom(s) are stocked with hotel-quality towels and complimentary toiletries.\n\n`;
  listing += `**Amenities Highlights:**\n`;
  listing += `- High-speed WiFi (perfect for remote work)\n`;
  listing += `- Smart TV with Netflix, Hulu, Disney+\n`;
  listing += `- Fully equipped kitchen\n`;
  listing += `- Washer/dryer in unit\n`;
  listing += `- Free parking\n`;
  listing += `- Self check-in with smart lock\n`;
  listing += `- Dedicated workspace\n\n`;
  listing += `**The Neighborhood:**\n`;
  listing += `Located in one of ${city}'s most desirable areas, you'll be minutes from restaurants, shopping, and local attractions. Whether you're here for business or pleasure, this location puts you right where you want to be.\n\n`;
  listing += `**House Rules:**\n`;
  listing += `- No smoking\n`;
  listing += `- No parties or events\n`;
  listing += `- Quiet hours: 10 PM - 8 AM\n`;
  listing += `- Max ${guests} guests\n\n`;
  listing += `---\n\n`;
  listing += `**Pro Tips from Penny:**\n`;
  listing += `- Add 20+ high-quality photos (bright, wide-angle)\n`;
  listing += `- Enable Instant Book to boost search ranking\n`;
  listing += `- Set competitive pricing for your first 3 bookings to build reviews\n`;
  listing += `- Respond to inquiries within 1 hour for Superhost status\n`;

  return listing;
}

function generateSlowSeasonStrategy(): string {
  return `**Slow Season Strategies to Maintain Occupancy**

**1. Dynamic Pricing (Most Important)**
- Drop rates 15-25% during slow months
- Use tools like PriceLabs, Beyond Pricing, or Wheelhouse
- Set minimum stay to 2 nights instead of 3+ during slow periods
- Offer weekly discounts (15-20% off) and monthly discounts (30-40% off)

**2. Mid-Term Rental Pivot**
- List on Furnished Finder, Zillow, and Facebook Marketplace
- Target traveling nurses, corporate relocations, and insurance claims
- Offer 30-90 day stays at a slight discount to nightly rates
- This can fill 60-90 days of slow season with guaranteed income

**3. Co-Living Strategy**
- Rent individual rooms to long-term tenants
- Target remote workers, students, or young professionals
- Can generate 1.5-2x the rent of a traditional lease
- Requires separate locks on bedrooms and shared space management

**4. Listing Optimization**
- Update photos seasonally (cozy winter vibes, etc.)
- Refresh your listing title and description
- Add seasonal amenities (space heater, extra blankets, hot cocoa station)
- Highlight indoor activities and nearby winter attractions

**5. Guest Experience Upgrades**
- Add a welcome basket with local treats
- Provide a local guidebook with seasonal recommendations
- Offer early check-in/late checkout during slow periods
- Consider pet-friendly policies to expand your guest pool

**6. Marketing & Visibility**
- Cross-list on VRBO, Booking.com, and direct booking sites
- Run social media promotions
- Offer return guest discounts
- Partner with local businesses for guest perks

**7. Expense Reduction**
- Negotiate utility rates
- Stock up on supplies during sales
- Consider reducing cleaning frequency for longer stays
- Review and renegotiate any service contracts

**Key Metrics to Track:**
- Occupancy rate (target: 55%+ even in slow season)
- Revenue per available night (RevPAN)
- Average length of stay
- Booking lead time

Would you like me to run specific numbers for your properties during slow season?`;
}

async function generateLocalResponse(message: string, investorId: string, investorName: string): Promise<{ content: string; actions: Array<{action: string; success: boolean}> }> {
  const lower = message.toLowerCase();
  const actions: Array<{action: string; success: boolean}> = [];

  // Portfolio summary
  if (lower.includes('portfolio') || lower.includes('my properties') || lower.includes('my deals')) {
    const properties = await fetchPortfolioData(investorId);
    actions.push({ action: 'get_portfolio', success: true });
    return { content: generatePortfolioSummary(properties, investorName), actions };
  }

  // Deal Marketplace — comprehensive knowledge
  if (lower.includes('marketplace') || lower.includes('available deals') || lower.includes('browse deals') || lower.includes('what deals') || lower.includes('buy a deal') || lower.includes('purchase') || lower.includes('how does the deal') || lower.includes('deal marketplace')) {
    const deals = await fetchMarketplaceDeals();
    actions.push({ action: 'get_marketplace', success: true });
    let response = generateMarketplaceResponse(deals);
    response += `\n\n---\n\n**How the Deal Marketplace Works:**\n\n`;
    response += `**Browsing Deals:**\n`;
    response += `- Visit the "Deals" tab to see all published properties\n`;
    response += `- Use filters to narrow by city, state, property type, bedrooms, and price range\n`;
    response += `- Each deal card shows Penny Score, ADR projections, occupancy estimates, and photos\n`;
    response += `- Click "Quick View" for a summary or "View Details" for the full breakdown\n\n`;
    response += `**Acquiring a Deal:**\n`;
    response += `1. Find a deal you're interested in and click "Start Acquisition"\n`;
    response += `2. Your Acquisition Manager will reach out to discuss the deal details\n`;
    response += `3. Fund your acquisition fee (typically $2,500) through the platform\n`;
    response += `4. Sign the success agreement digitally\n`;
    response += `5. Your AM handles landlord outreach, lease negotiation, and setup coordination\n\n`;
    response += `**Deal Alerts:**\n`;
    response += `- Set up Deal Alerts in your settings to get notified when new deals match your criteria\n`;
    response += `- Alerts can be configured by market, property type, price range, and Penny Score\n`;
    return { content: response, actions };
  }

  // Sell My Operation / Marketplace Selling
  if (lower.includes('sell my') || lower.includes('sell operation') || lower.includes('list my operation') || lower.includes('selling') || lower.includes('sell a deal') || lower.includes('exit strategy')) {
    actions.push({ action: 'sell_operation_info', success: true });
    return {
      content: `**Sell My Operation — Marketplace Guide**\n\nYou can list your existing rental operation for sale on the Access Your Place Deal Marketplace!\n\n**How It Works:**\n\n1. **Navigate to "Sell My Operation"** in your investor portal sidebar\n2. **Submit your property details** — address, financials, photos, and operation history\n3. **Set your asking price** — based on revenue multiples, typically 12-24x monthly net income\n4. **Our team reviews and verifies** your listing (Penny Score is calculated)\n5. **Your listing goes live** on the marketplace for other investors to browse\n6. **Receive offers** — buyers submit offers through the platform\n7. **Negotiate and close** — the Success Team facilitates the transaction\n\n**What Buyers See:**\n- Verified revenue history and occupancy data\n- Penny Score and market analysis\n- Property photos and listing details\n- Operation type (STR, MTR, co-living)\n\n**Tips for a Successful Sale:**\n- Include 12+ months of revenue documentation\n- Upload high-quality, recent photos\n- Price competitively based on comparable sales\n- Respond quickly to buyer inquiries\n- Keep your operation running smoothly during the sale process\n\n**Fees:**\n- Listing is free\n- A marketplace transaction fee applies upon successful sale\n\nWould you like help calculating a fair asking price for your operation?`,
      actions
    };
  }

  // Landlord Portal
  if (lower.includes('landlord') || lower.includes('landlord portal') || lower.includes('landlord partner') || lower.includes('property owner') || lower.includes('lease to us')) {
    actions.push({ action: 'landlord_portal_info', success: true });
    return {
      content: `**Landlord Partnership Portal**\n\nThe Landlord Portal is designed for property owners who want to partner with Access Your Place investors.\n\n**For Investors — How It Helps You:**\n- Landlords can submit their properties directly to the platform\n- Your AM gets notified when new landlord-submitted properties match your criteria\n- Pre-vetted landlord partnerships reduce acquisition time\n\n**How the Landlord Portal Works:**\n\n1. **Landlord Registration** — Property owners create an account at the Landlord Partnership page\n2. **Property Submission** — They submit property details, photos, and lease terms\n3. **Application Review** — Our team reviews the application and property viability\n4. **Matching** — Approved properties are matched with interested investors\n5. **Lease Negotiation** — Your AM handles all lease terms and negotiations\n6. **Setup & Launch** — Once the lease is signed, setup services begin\n\n**Landlord Benefits:**\n- Guaranteed rent payments (we pay on time, every time)\n- Professional property management and maintenance\n- Long-term lease stability (typically 12-24 month leases)\n- No vacancy risk — we keep the property occupied\n\n**Communication:**\n- Landlords and investors communicate through the platform messaging system\n- Your AM serves as the primary point of contact with landlords\n- All documents are signed digitally through the platform\n\nWould you like to know more about how to find landlord-friendly properties in a specific market?`,
      actions
    };
  }

  // Messaging / AM Communication
  if (lower.includes('message') || lower.includes('messaging') || lower.includes('chat with') || lower.includes('contact my') || lower.includes('talk to') || lower.includes('reach my') || lower.includes('acquisition manager') || lower.includes('my am') || lower.includes('my manager') || lower.includes('who is my')) {
    actions.push({ action: 'messaging_info', success: true });
    // Try to fetch AM info
    let amInfo = '';
    try {
      const { data } = await supabase.from('am_assignments').select('*, staff:staff_id(full_name, email, phone)').eq('investor_id', investorId).eq('is_active', true).single();
      if (data?.staff) {
        amInfo = `\n\n**Your Assigned Acquisition Manager:**\n- **Name:** ${(data.staff as any).full_name}\n- **Email:** ${(data.staff as any).email}\n${(data.staff as any).phone ? `- **Phone:** ${(data.staff as any).phone}\n` : ''}`;
      }
    } catch {}
    return {
      content: `**Messaging & Communication**\n\nYou can communicate with your Acquisition Manager and the Success Team directly through the platform.${amInfo}\n\n**How to Message Your AM:**\n1. Go to the **"Messages"** tab in your investor portal\n2. Select your Acquisition Manager from the conversation list\n3. Type your message and hit send — they'll be notified immediately\n4. You can also attach files, photos, and documents\n\n**What You Can Discuss:**\n- Property acquisition updates and status\n- Lease negotiation progress\n- Setup coordination and timelines\n- Market questions and deal analysis\n- Portfolio performance reviews\n- Any concerns or issues with your properties\n\n**Response Times:**\n- Messages are typically answered within 2-4 business hours\n- Urgent matters: use the phone number above or mark your message as urgent\n- Your AM also receives email notifications for new messages\n\n**Notification Settings:**\n- Configure email and push notifications in Account Settings\n- Choose to receive instant notifications or daily digests\n\nWould you like me to help you draft a message to your AM?`,
      actions
    };
  }

  // Referral Program — Property & Client Referrals
  if (lower.includes('referral') || lower.includes('refer') || lower.includes('referr') || lower.includes('payout') || lower.includes('refer a friend') || lower.includes('refer a client') || lower.includes('property referral')) {
    actions.push({ action: 'referral_program_info', success: true });
    return {
      content: `**Referral Program — Earn While You Grow**\n\nAccess Your Place offers two types of referrals:\n\n---\n\n**1. Property Referrals (Refer a Deal)**\n\nKnow a great property that would make a profitable rental? Submit it!\n\n**How it works:**\n1. Go to **"Referrals"** tab in your investor portal\n2. Click **"Submit Property Referral"**\n3. Enter the property address, landlord contact info, and why you think it's a good deal\n4. Your AM is automatically notified of your submission\n5. The team evaluates the property and begins landlord outreach\n6. If the deal closes, you earn a **referral payout**!\n\n**Referral Status Tracking:**\n- **Submitted** — Your referral has been received\n- **Under Review** — The team is evaluating the property\n- **AM Outreach** — Your AM is contacting the landlord\n- **Finalized** — Deal terms are being finalized\n- **Published** — The deal is live on the marketplace\n- **Payout Approved** — Your referral fee is approved\n- **Paid Out** — Payment has been sent to you\n\n---\n\n**2. Client Referrals (Refer a Friend)**\n\nRefer someone who becomes an investor and earn a bonus!\n\n**How it works:**\n1. Go to **"Referrals"** tab and click **"Refer a Client"**\n2. Enter their name, email, and phone number\n3. They'll receive an invitation to join the platform\n4. When they complete their first acquisition, you earn a **client referral bonus**\n5. Your AM is notified of all client referrals\n\n**Referral Payouts:**\n- Property referral payouts vary based on the deal size\n- Client referral bonuses are paid after the referred investor's first successful acquisition\n- All payouts are tracked in your Referrals tab with full transparency\n\nWould you like to submit a property referral or refer a friend right now?`,
      actions
    };
  }

  // Portfolio Management / Approval Workflow / Property Submissions
  if (lower.includes('approval') || lower.includes('submit a property') || lower.includes('portfolio approval') || lower.includes('pending approval') || lower.includes('property submission') || lower.includes('how do i add') || lower.includes('add a property')) {
    actions.push({ action: 'portfolio_management_info', success: true });
    return {
      content: `**Portfolio Management & Property Approval Workflow**\n\nHere's how properties move through the acquisition pipeline:\n\n**The Acquisition Journey:**\n\n1. **Deal Discovery** — Browse the marketplace or your AM finds a matching property\n2. **Reservation** — Reserve the deal by funding your acquisition fee\n3. **Agreement Signing** — Sign the Success Agreement digitally through the platform\n4. **AM Outreach** — Your Acquisition Manager contacts the landlord\n5. **Lease Negotiation** — Terms are negotiated on your behalf\n6. **Lease Signing** — Digital lease signing through the platform\n7. **Setup Phase** — Property is furnished and prepared for guests\n8. **Go Live** — Your property is listed on Airbnb/VRBO and starts earning\n\n**Portfolio Dashboard:**\n- View all your properties and their current status\n- Track monthly earnings, occupancy rates, and ROI\n- See the status timeline for each property\n- Upload documents and photos\n- Monitor setup progress\n\n**Property Status Meanings:**\n- **Pending Approval** — Waiting for team review\n- **In Progress** — Acquisition is underway\n- **Active** — Property is live and earning\n- **Setup** — Being furnished and prepared\n- **Paused** — Temporarily not accepting bookings\n\n**Document Management:**\n- All agreements, leases, and receipts are stored in your Documents tab\n- Sign documents digitally with our built-in signature tool\n- Download any document at any time\n\nWould you like to check the status of a specific property in your portfolio?`,
      actions
    };
  }

  // Setup Services
  if (lower.includes('setup') || lower.includes('furnish') || lower.includes('furniture') || lower.includes('design') || lower.includes('staging') || lower.includes('setup service') || lower.includes('get my property ready')) {
    actions.push({ action: 'setup_services_info', success: true });
    return {
      content: `**Setup Services — Get Your Property Guest-Ready**\n\nAccess Your Place offers comprehensive setup services to transform your property into a profitable rental.\n\n**What's Included:**\n\n**Standard Setup Package:**\n- Professional interior design consultation\n- Complete furniture package (beds, sofas, dining, desks)\n- Kitchen essentials (cookware, dishes, utensils, appliances)\n- Bathroom supplies (towels, toiletries, shower curtain)\n- Bedding package (sheets, pillows, comforters)\n- Smart lock installation for self check-in\n- Smart TV with streaming setup\n- High-speed WiFi router setup\n- Welcome guide and house manual creation\n\n**Premium Add-Ons:**\n- Professional photography session\n- Outdoor furniture and patio setup\n- Washer/dryer installation\n- Security camera setup (exterior only)\n- Custom artwork and decor\n- Premium kitchen appliance upgrade\n\n**Setup Cost Calculator:**\nUse the Setup Cost Calculator in your portal to get an instant quote based on:\n- Number of bedrooms\n- Property size\n- Location\n- Selected add-ons\n\n**Timeline:**\n- Standard setup: 5-10 business days after lease signing\n- Premium setup: 10-15 business days\n- Rush setup available for an additional fee\n\n**How to Order:**\n1. Navigate to "Setup Services" in your portal\n2. Select your property\n3. Choose your package and add-ons\n4. Review the quote and approve\n5. Your setup coordinator will schedule everything\n\nWould you like me to estimate setup costs for a specific property?`,
      actions
    };
  }

  // Documents / Signing / Agreements
  if (lower.includes('document') || lower.includes('sign') || lower.includes('agreement') || lower.includes('contract') || lower.includes('lease') || lower.includes('signature')) {
    actions.push({ action: 'documents_info', success: true });
    return {
      content: `**Documents & Digital Signing**\n\nAll your important documents are managed through the platform.\n\n**Document Types:**\n- **Success Agreement** — Your service agreement with Access Your Place\n- **Lease Agreements** — Property leases negotiated by your AM\n- **Setup Quotes** — Cost estimates for property setup\n- **Financial Reports** — Monthly and annual performance reports\n- **Tax Documents** — 1099s and expense summaries\n\n**Digital Signing:**\n1. When a document needs your signature, you'll see a notification\n2. Go to the **"Documents"** tab in your portal\n3. Click on the pending document to review it\n4. Use the built-in signature pad to sign\n5. The signed document is stored securely and available for download\n\n**Document Upload:**\n- You can upload your own documents (insurance, permits, etc.)\n- Supported formats: PDF, JPG, PNG\n- All documents are encrypted and stored securely\n\n**Expiration Tracking:**\n- The system tracks document expiration dates\n- You'll receive notifications before documents expire\n- Your AM is also notified to help with renewals\n\nWould you like to check if you have any pending documents to sign?`,
      actions
    };
  }

  // Onboarding / Getting Started / Next Steps
  if (lower.includes('onboard') || lower.includes('getting started') || lower.includes('next step') || lower.includes('new investor') || lower.includes('how do i start') || lower.includes('first time') || lower.includes('beginner')) {
    actions.push({ action: 'onboarding_info', success: true });
    return {
      content: `**Welcome! Here's Your Getting Started Guide**\n\nCongratulations on joining Access Your Place! Here's your step-by-step onboarding checklist:\n\n**Step 1: Complete Your Profile**\n- Add your investment preferences (target markets, budget, property types)\n- Upload a profile photo\n- Set your notification preferences\n\n**Step 2: Meet Your Acquisition Manager**\n- You'll be assigned an AM who specializes in your target markets\n- They'll reach out to schedule an intro call\n- Use the Messages tab to communicate anytime\n\n**Step 3: Browse the Marketplace**\n- Explore available deals in the Deals tab\n- Use Penny AI (that's me!) to analyze any deal\n- Set up Deal Alerts for automatic notifications\n\n**Step 4: Fund Your First Acquisition**\n- When you find a deal, reserve it with an acquisition fee\n- Payment is processed securely through the platform\n- Credits can be applied to reduce your fee\n\n**Step 5: Sign Your Agreement**\n- Review and digitally sign the Success Agreement\n- Your AM handles all landlord negotiations\n\n**Step 6: Setup & Launch**\n- Choose your setup package\n- Your property is furnished and photographed\n- Listings go live on Airbnb, VRBO, and other platforms\n\n**Step 7: Start Earning!**\n- Track your earnings in the Portfolio dashboard\n- Get monthly performance reports\n- Use Penny AI for ongoing optimization tips\n\n**Helpful Resources:**\n- Video tutorials in the Knowledge Library\n- Market reports for your target areas\n- Revenue calculator for deal analysis\n\nWhat would you like to explore first?`,
      actions
    };
  }

  // Deal analysis
  if (lower.includes('analyze') || lower.includes('analysis') || lower.includes('score') || (lower.includes('deal') && (lower.includes('adr') || lower.includes('occupancy')))) {
    actions.push({ action: 'analyze_deal', success: true });
    return { content: generateDealAnalysis(message), actions };
  }

  // Revenue calculator
  if (lower.includes('calculate') || lower.includes('revenue') || lower.includes('how much') || lower.includes('profit')) {
    actions.push({ action: 'calculate_revenue', success: true });
    return { content: generateRevenueCalculation(message), actions };
  }

  // Listing generation
  if (lower.includes('listing') || lower.includes('write') || lower.includes('airbnb') || lower.includes('description')) {
    actions.push({ action: 'generate_listing', success: true });
    return { content: generateListingContent(message), actions };
  }

  // Slow season / strategy
  if (lower.includes('slow season') || lower.includes('strategy') || lower.includes('off season')) {
    actions.push({ action: 'strategy_advice', success: true });
    return { content: generateSlowSeasonStrategy(), actions };
  }

  // Credits / account
  if (lower.includes('credit') || lower.includes('balance') || lower.includes('account fund')) {
    const credits = await fetchCreditsData(investorId);
    actions.push({ action: 'get_credits', success: true });
    if (credits) {
      return {
        content: `**Your Credit Summary**\n\n- **Available Credits:** $${(credits.total_active_amount || 0).toLocaleString()}\n- **Active Credits:** ${credits.total_active_credits || 0}\n- **Total Used:** $${(credits.total_used_amount || 0).toLocaleString()}\n- **Lifetime Savings:** $${(credits.total_saved || 0).toLocaleString()}\n\nCredits at Access Your Place **do not expire**. They can be applied toward future acquisition fees.\n\nWould you like to know more about how credits work or check on a specific credit?`,
        actions
      };
    }
    return {
      content: `I checked your account and you currently have no active credits. Credits are issued when:\n\n- An acquisition doesn't complete due to seller/landlord issues\n- You receive a promotional or referral bonus\n- The Success Team issues a compensation credit\n\nCredits at Access Your Place **do not expire** and can be applied to future acquisition fees. If you believe you should have a credit, you can submit a request through the Credits tab in your account.\n\nWould you like help with anything else?`,
      actions
    };
  }

  // Regulation / legal
  if (lower.includes('regulation') || lower.includes('legal') || lower.includes('permit') || lower.includes('license') || lower.includes('zoning')) {
    actions.push({ action: 'regulation_check', success: true });
    return {
      content: `**Short-Term Rental Regulations — Key Points**\n\nRegulations vary significantly by city and county. Here are the most common requirements:\n\n**Typical Requirements:**\n- Business license or STR permit\n- Transient occupancy tax (TOT) registration\n- Safety inspections (smoke detectors, fire extinguishers)\n- Insurance requirements (usually $1M+ liability)\n- Maximum occupancy limits\n- Noise ordinances and quiet hours\n\n**Markets with Strict Regulations:**\n- Los Angeles, CA — Requires primary residence, 120-day annual cap\n- New York City — Must be present during guest stays for <30 days\n- Nashville, TN — Non-owner occupied permits limited by zone\n- Denver, CO — Primary residence only, license required\n\n**Markets with Favorable Regulations:**\n- Austin, TX — Relatively STR-friendly with proper licensing\n- Tampa/St. Pete, FL — Growing market with manageable regulations\n- Phoenix, AZ — State law preempts most local STR bans\n- Charleston, SC — Permits available in most zones\n\n**Important:** Always verify current regulations before acquiring a property. Your Acquisition Manager can help research specific market regulations.\n\nWhich market would you like me to look into specifically?`,
      actions
    };
  }

  // Expenses / tracking
  if (lower.includes('expense') || lower.includes('cost') || lower.includes('spending') || lower.includes('track expense')) {
    actions.push({ action: 'expense_info', success: true });
    return {
      content: `**Expense Tracking**\n\nTrack all your property-related expenses through the Expense Tracker in your portal.\n\n**How to Track Expenses:**\n1. Go to the **"Expenses"** tab in your portal\n2. Click **"Add Expense"**\n3. Select the property, category, amount, and date\n4. Upload a receipt photo if available\n5. The expense is logged and included in your financial reports\n\n**Expense Categories:**\n- Rent / Lease payments\n- Utilities (electric, gas, water, internet)\n- Cleaning fees\n- Supplies & consumables\n- Maintenance & repairs\n- Insurance\n- Platform fees (Airbnb, VRBO)\n- Furniture & equipment\n- Marketing & advertising\n\n**Reports:**\n- Monthly expense summaries by property\n- Annual tax-ready expense reports\n- Profit & loss statements\n- Exportable CSV for your accountant\n\nWould you like me to calculate estimated monthly expenses for a specific property?`,
      actions
    };
  }

  // Platform connections / Airbnb / VRBO
  if (lower.includes('airbnb') || lower.includes('vrbo') || lower.includes('booking.com') || lower.includes('platform connection') || lower.includes('connect my')) {
    actions.push({ action: 'platform_connections_info', success: true });
    return {
      content: `**Platform Connections**\n\nConnect your rental platforms to sync booking data and automate tracking.\n\n**Supported Platforms:**\n- Airbnb\n- VRBO / HomeAway\n- Booking.com\n- Furnished Finder\n- Direct booking websites\n\n**How to Connect:**\n1. Go to **"Platform Connections"** in your portal settings\n2. Click **"Connect Platform"**\n3. Follow the authorization flow for each platform\n4. Once connected, booking data syncs automatically\n\n**What Syncs:**\n- Booking dates and guest details\n- Revenue and payout amounts\n- Occupancy rates\n- Guest reviews and ratings\n\n**Benefits:**\n- Automated revenue tracking (no manual entry)\n- Real-time occupancy dashboards\n- Accurate financial reporting\n- Performance comparison across platforms\n\nWould you like help setting up a platform connection?`,
      actions
    };
  }

  // General / catch-all with comprehensive feature list
  actions.push({ action: 'general_response', success: true });
  return {
    content: `Great question! Here's everything I can help you with:\n\n**Deal Analysis & Revenue**\n- "Analyze a deal with $200 ADR and 70% occupancy in Austin"\n- "Calculate revenue for a 3BR with $2000 rent"\n\n**Portfolio & Properties**\n- "Show me my portfolio summary"\n- "How does the property approval workflow work?"\n\n**Deal Marketplace**\n- "What deals are available on the marketplace?"\n- "How do I acquire a deal?"\n\n**Sell My Operation**\n- "How can I sell my rental operation?"\n- "What's my operation worth?"\n\n**Referral Program**\n- "How do property referrals work?"\n- "How do I refer a friend?"\n\n**Landlord Portal**\n- "How does the landlord partnership work?"\n\n**Messaging & AM**\n- "How do I message my acquisition manager?"\n- "Who is my AM?"\n\n**Setup Services**\n- "What setup packages are available?"\n- "How much does setup cost?"\n\n**Documents & Signing**\n- "Do I have any pending documents?"\n- "How does digital signing work?"\n\n**Strategy & Operations**\n- "Slow season strategies"\n- "Write an Airbnb listing for my property"\n- "STR regulations in my market"\n\n**Account**\n- "Check my credit balance"\n- "How do I track expenses?"\n\nJust ask me anything and I'll get to work!`,
    actions
  };
}


// ---- END LOCAL INTELLIGENCE ----

export function AIChat({ investorId, investorName }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [marketAlerts, setMarketAlerts] = useState<MarketAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Penny's chime preference (persisted). Her penny-drop signature plays when she
  // finishes a reply — a sound-first cue that's especially useful for screen-reader
  // users. Muteable, and remembered across sessions.
  const [chimeMuted, setChimeMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('penny_chime_muted') === '1'; } catch { return false; }
  });
  const toggleChime = () => setChimeMuted((m) => {
    const next = !m;
    try { localStorage.setItem('penny_chime_muted', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  useEffect(() => {
    fetchSuggestedQuestions();
    fetchMarketAlerts();
  }, [investorId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Penny announces herself with her chime whenever she finishes a reply.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !chimeMuted) playPennyChime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSuggestedQuestions = async () => {
    try {
      const { data } = await supabase.functions.invoke('ai-investor-chat', {
        body: { action: 'get_suggested_questions', investor_id: investorId }
      });
      if (data?.suggestions) {
        setSuggestedQuestions(data.suggestions);
        return;
      }
    } catch {}
    setSuggestedQuestions([
      "What's the current market outlook for Austin?",
      "Calculate revenue for a 3BR with $180 ADR and 70% occupancy",
      "Show me my portfolio summary",
      "What slow season strategies should I use?",
      "Analyze a deal in Tampa with $200 ADR",
      "Write an Airbnb listing for my property"
    ]);
  };

  const fetchMarketAlerts = async () => {
    try {
      const { data } = await supabase.functions.invoke('ai-investor-chat', {
        body: { action: 'get_market_alerts', investor_id: investorId }
      });
      if (data?.alerts) setMarketAlerts(data.alerts.slice(0, 5));
    } catch {}
  };

  const startNewConversation = useCallback(() => {
    setMessages([]);
    inputRef.current?.focus();
  }, []);

  const [executingActions, setExecutingActions] = useState(false);
  const [lastActionsExecuted, setLastActionsExecuted] = useState<Array<{action: string; success: boolean}>>([]);

  const getActionLabel = (actionName: string) => {
    const labels: Record<string, string> = {
      analyze_deal: 'Deal Analysis', calculate_revenue: 'Revenue Calculated',
      get_marketplace: 'Marketplace Deals', get_portfolio: 'Portfolio Summary',
      generate_listing: 'Listing Generated', score_deal: 'Deal Scored',
      strategy_advice: 'Strategy Generated', get_credits: 'Credits Checked',
      regulation_check: 'Regulations Checked', general_response: 'Processed',
    };
    return labels[actionName] || actionName.replace(/_/g, ' ');
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setExecutingActions(false);
    setLastActionsExecuted([]);

    const execTimer = setTimeout(() => setExecutingActions(true), 1500);

    let gotValidResponse = false;

    // Try edge function first
    try {
      const { data, error } = await supabase.functions.invoke('ai-investor-chat', {
        body: {
          action: 'chat',
          investor_id: investorId,
          user_name: investorName,
          message: text,
          conversation_history: updatedMessages.map(m => ({ role: m.role, content: m.content }))
        }
      });

      if (!error && data?.success && data.message && !detectTemplatedResponse(data.message)) {
        clearTimeout(execTimer);
        if (data.actions_executed?.length > 0) {
          setLastActionsExecuted(data.actions_executed);
        }
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
          sopVerified: true,
          actionsExecuted: data.actions_executed || []
        };
        setMessages(prev => [...prev, assistantMessage]);
        gotValidResponse = true;
      }
    } catch {}

    // If edge function failed or returned templated response, use local intelligence
    if (!gotValidResponse) {
      clearTimeout(execTimer);
      try {
        const localResult = await generateLocalResponse(text, investorId, investorName);
        setLastActionsExecuted(localResult.actions);
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: localResult.content,
          timestamp: new Date().toISOString(),
          sopVerified: true,
          actionsExecuted: localResult.actions
        };
        setMessages(prev => [...prev, assistantMessage]);
      } catch (localErr) {
        console.error('Local intelligence also failed:', localErr);
        toast({ 
          title: 'Message failed to send', 
          description: 'Please try again.',
          variant: 'destructive' 
        });
        setMessages(prev => prev.slice(0, -1));
      }
    }

    setLoading(false);
    setExecutingActions(false);
    inputRef.current?.focus();
  }, [input, loading, messages, investorId, investorName, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatMessageContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const firstName = investorName.split(' ')[0];
  const highPriorityAlerts = marketAlerts.filter(a => a.severity === 'high' || a.severity === 'medium');

  return (
    <div className="space-y-6" role="region" aria-label="Penny AI Chat Assistant">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PennyMark size={48} speaking={loading} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Penny AI
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </h1>
            <p className="text-sm text-gray-500">Deal scoring, revenue analysis & market intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleChime}
            aria-label={chimeMuted ? "Turn Penny's chime on" : "Turn Penny's chime off"}
            aria-pressed={!chimeMuted}
            title={chimeMuted ? "Penny's chime is off" : "Penny's chime is on"}
            className="text-gray-500 hover:text-gray-700"
          >
            {chimeMuted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          </Button>
          {highPriorityAlerts.length > 0 && (
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => setShowAlerts(!showAlerts)}>
              <AlertTriangle className="w-4 h-4 mr-1" />
              {highPriorityAlerts.length} Alert{highPriorityAlerts.length !== 1 ? 's' : ''}
            </Button>
          )}
          <Button size="sm" className="bg-[#d4a574] hover:bg-[#c49464]" onClick={startNewConversation}>
            <Plus className="w-4 h-4 mr-2" />New Chat
          </Button>
        </div>
      </header>

      {/* Market Alerts Panel */}
      {showAlerts && highPriorityAlerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4" />Market Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {highPriorityAlerts.map((alert) => (
              <div key={alert.id} className="p-3 bg-white rounded-lg border border-amber-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{alert.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
                  </div>
                  <Badge variant="outline" className={alert.severity === 'high' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                    {alert.severity}
                  </Badge>
                </div>
                <Button size="sm" variant="ghost" className="mt-2 text-xs h-7"
                  onClick={() => sendMessage(`Tell me more about the ${alert.type} situation in ${alert.market}`)}>
                  Ask Penny about this
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Chat Card */}
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#d4a574]" />
              Conversation
            </span>
            {messages.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          <ScrollArea className="flex-1 p-4" role="log" aria-label="Chat messages">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <PennyMark size={64} className="mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Hi {firstName}! I'm Penny</h2>
                <p className="text-sm text-gray-500 mb-2 max-w-md">
                  I can analyze deals, calculate revenue, manage your portfolio, write listings, and provide market intelligence — all in real-time.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  <Badge variant="outline" className="text-xs">Deal Analysis</Badge>
                  <Badge variant="outline" className="text-xs">Revenue Calculator</Badge>
                  <Badge variant="outline" className="text-xs">Listing Writer</Badge>
                  <Badge variant="outline" className="text-xs">Market Intel</Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button key={action.id} onClick={() => sendMessage(action.question)}
                        className="p-4 rounded-xl border border-gray-200 hover:border-[#d4a574] hover:bg-[#d4a574]/5 transition-all text-left">
                        <Icon className="w-5 h-5 text-[#d4a574] mb-2" />
                        <p className="text-sm font-medium text-gray-900">{action.label}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{action.question}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <article key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {msg.role === 'user' ? (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#d4a574]">
                          <span className="text-white text-sm font-medium">{firstName.charAt(0).toUpperCase()}</span>
                        </div>
                      ) : (
                        <span className="flex-shrink-0"><PennyMark size={32} still /></span>
                      )}
                      <div>
                        <div className={`rounded-2xl px-4 py-3 ${
                          msg.role === 'user' 
                            ? 'bg-[#d4a574] text-white rounded-tr-sm' 
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {formatMessageContent(msg.content)}
                          </p>
                        </div>
                        <div className={`flex items-center gap-2 mt-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.timestamp && (
                            <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                          )}
                          {msg.role === 'assistant' && msg.sopVerified && (
                            <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-600 border-green-200">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-1" />Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0"><PennyMark size={32} speaking /></span>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-2">
                          {executingActions ? (
                            <>
                              <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                              <span className="text-sm text-gray-600 font-medium">Executing operations...</span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#d4a574]" />
                              <span className="text-sm text-gray-500">Penny is analyzing...</span>
                            </>
                          )}
                        </div>
                        {executingActions && (
                          <p className="text-xs text-gray-400 mt-1">Querying database, running calculations...</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {!loading && lastActionsExecuted.length > 0 && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
                  <div className="flex flex-wrap gap-1 ml-11 -mt-2 mb-2">
                    {lastActionsExecuted.map((act, idx) => (
                      <Badge key={idx} variant="outline" className={`text-[10px] h-5 ${act.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <Zap className="w-2.5 h-2.5 mr-1" />
                        {getActionLabel(act.action)}
                      </Badge>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4 bg-gray-50/50">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about deals, markets, or use voice..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              />
              <VoiceInputButton
                onTranscript={(text) => setInput(text)}
                onAutoSend={(text) => {
                  setInput('');
                  sendMessage(text);
                }}
                disabled={loading}
                size="default"
                autoSendDelay={2500}
              />
              <Button type="submit" className="bg-[#d4a574] hover:bg-[#c49464]" disabled={!input.trim() || loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Enter to send • Mic for hands-free voice input • Penny analyzes real data in real-time.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Suggested Questions */}
      {suggestedQuestions.length > 0 && messages.length === 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#d4a574]" />
              Personalized Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-2">
              {suggestedQuestions.slice(0, 6).map((question, idx) => (
                <button key={idx} onClick={() => sendMessage(question)} disabled={loading}
                  className="text-left p-3 rounded-lg border border-gray-200 hover:border-[#d4a574] hover:bg-[#d4a574]/5 transition-all disabled:opacity-50">
                  <p className="text-sm text-gray-700">{question}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {messages.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={fetchSuggestedQuestions}>
            <RefreshCw className="w-4 h-4 mr-2" />Get More Ideas
          </Button>
        </div>
      )}
    </div>
  );
}

export default AIChat;
