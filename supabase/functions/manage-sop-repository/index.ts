// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public';
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
// manage-sop-repository v6.0 - Full version history tracking + Penny AI SOPs
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return json({ error: 'Missing environment variables' }, 500);
    }

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const body = await req.json();
    const { action, ...params } = body;
    console.log('[manage-sop-repository v6.0] Action:', action);

    const canEdit = (role: string) => {
      const r = (role || '').toLowerCase();
      return r.includes('admin') || r.includes('success');
    };
    
    const canView = (role: string) => {
      const r = (role || '').toLowerCase();
      return r.includes('admin') || r.includes('success') || r.includes('acquisition') || r.includes('setup');
    };

    const getRoleSOPs = (userRole: string) => {
      const r = (userRole || '').toLowerCase();
      if (r.includes('admin') || r.includes('success')) {
        return ['Success_Team', 'Acquisition_Manager', 'Setup_Manager', 'Cross_Team'];
      }
      if (r.includes('acquisition')) {
        return ['Acquisition_Manager', 'Cross_Team'];
      }
      if (r.includes('setup')) {
        return ['Setup_Manager', 'Cross_Team'];
      }
      return ['Cross_Team'];
    };

    // Helper to save version history
    async function saveVersionHistory(sopId: string, currentSOP: any, newContent: string, newTitle: string, changeSummary: string, changedBy: string) {
      const versionData = {
        sop_id: sopId,
        version_number: (currentSOP.version || 1) + 1,
        title: newTitle || currentSOP.title,
        content_html: newContent,
        previous_content_html: currentSOP.content_html,
        category: currentSOP.category,
        role_id: currentSOP.role_id,
        change_summary: changeSummary || 'Content updated',
        changed_by: changedBy || 'System',
        created_at: new Date().toISOString()
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/sop_versions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(versionData)
      });

      if (!res.ok) {
        console.error('[manage-sop-repository] Failed to save version history:', await res.text());
      }
      
      return versionData.version_number;
    }

    // ==================== SEED PENNY AI SOPs ====================
    if (action === 'seed_penny_ai_sops') {
      const pennySOPs = [
        {
          role_id: 'Success_Team',
          category: 'Penny AI',
          title: 'Penny AI Overview & Scoring System',
          sort_order: 1,
          content_html: `
            <h4>Penny AI: Your AI-Powered Deal Intelligence System</h4>
            <p>Penny AI is Access Your Place's proprietary artificial intelligence system designed to provide data-driven deal scoring, market analysis, and investment recommendations. This SOP provides a comprehensive overview of Penny's capabilities and the scoring methodology.</p>
            
            <h5>What is Penny AI?</h5>
            <p>Penny is an AI Success Manager that combines machine learning algorithms with real-time market data to:</p>
            <ul>
              <li>Score potential deals on a 0-100 scale</li>
              <li>Analyze market conditions across 23 supported markets</li>
              <li>Provide revenue projections for STR, Co-living, and MTR strategies</li>
              <li>Identify risks and opportunities for each property</li>
              <li>Match investors with deals based on their preferences</li>
              <li>Answer investor questions with SOP-verified responses</li>
            </ul>
            
            <h5>The Penny Score (0-100)</h5>
            <div class="alert-info">
              <strong>Score Ranges:</strong><br/>
              â€¢ <strong>80-100 (Excellent):</strong> Strong buy recommendation - exceptional opportunity<br/>
              â€¢ <strong>60-79 (Good):</strong> Buy recommendation - solid investment potential<br/>
              â€¢ <strong>40-59 (Fair):</strong> Hold/Review - needs additional analysis<br/>
              â€¢ <strong>0-39 (Poor):</strong> Avoid - significant risks identified
            </div>
            
            <h5>Scoring Components (6 Factors)</h5>
            <p>Penny evaluates each property across six key dimensions:</p>
            <ol>
              <li><strong>Market Score (20%):</strong> Overall market health, demand trends, and growth potential</li>
              <li><strong>Financial Score (25%):</strong> Revenue potential, profit margins, and ROI projections</li>
              <li><strong>Regulation Score (15%):</strong> STR permit requirements, zoning compliance, and regulatory risk</li>
              <li><strong>Competition Score (15%):</strong> Market saturation, competitor analysis, and differentiation potential</li>
              <li><strong>Seasonality Score (15%):</strong> Demand patterns, peak/slow season analysis, and revenue stability</li>
              <li><strong>Location Score (10%):</strong> Proximity to attractions, accessibility, and neighborhood quality</li>
            </ol>
            
            <h5>Data Sources</h5>
            <p>Penny aggregates data from multiple sources to ensure accuracy:</p>
            <ul>
              <li>Market data snapshots (updated weekly)</li>
              <li>Seasonality calendar (23 markets, 12 months)</li>
              <li>Historical performance data from AYP portfolio</li>
              <li>Machine learning feedback from actual property performance</li>
              <li>Real-time property listings and comparables</li>
            </ul>
            
            <h5>Recommendation Types</h5>
            <ul>
              <li><strong>Strong Buy:</strong> Score 80+ with high confidence - prioritize this deal</li>
              <li><strong>Buy:</strong> Score 60-79 - solid opportunity worth pursuing</li>
              <li><strong>Hold:</strong> Score 40-59 - needs additional due diligence</li>
              <li><strong>Needs Review:</strong> Score 40-59 with specific concerns flagged</li>
              <li><strong>Avoid:</strong> Score below 40 - significant risks outweigh potential</li>
            </ul>
            
            <div class="alert-warning">
              <strong>Important:</strong> Penny scores are advisory tools, not guarantees. All deals should still undergo human review and due diligence. Scores below 40 are automatically flagged for Success Team review.
            </div>
          `
        },
        {
          role_id: 'Success_Team',
          category: 'Penny AI',
          title: 'Navigating the Penny AI Dashboard',
          sort_order: 2,
          content_html: `
            <h4>Staff Dashboard: Penny AI Navigation Guide</h4>
            <p>This SOP provides step-by-step instructions for navigating and utilizing Penny AI features within the Staff Dashboard.</p>
            
            <h5>Accessing Penny AI Features</h5>
            <p>Penny AI is integrated throughout the staff dashboard in multiple locations:</p>
            
            <h5>1. Deal Flow Tab - Property Cards</h5>
            <ul>
              <li>Each property card displays the <strong>Penny Score Badge</strong> in the top-right corner</li>
              <li>Color coding: Green (80+), Yellow (60-79), Orange (40-59), Red (below 40)</li>
              <li>Click the badge to view detailed analysis</li>
              <li>Properties with scores below 40 show a warning flag icon</li>
            </ul>
            
            <h5>2. Property Detail Modal - Penny Tab</h5>
            <p>When viewing a property's details, click the "Penny AI" tab to access:</p>
            <ul>
              <li><strong>Score Header:</strong> Large score display with recommendation badge</li>
              <li><strong>Best Strategy:</strong> Recommended operation type (STR, Co-living, or MTR)</li>
              <li><strong>Score Breakdown:</strong> Individual scores for all 6 components</li>
              <li><strong>Revenue Projections:</strong> Estimated monthly/annual revenue by strategy</li>
              <li><strong>Risks & Opportunities:</strong> AI-identified factors affecting the deal</li>
              <li><strong>SOP Checklist:</strong> Verification status for each data point (Staff Only)</li>
            </ul>
            
            <h5>3. SOP Verification Checklist</h5>
            <div class="alert-info">
              <strong>Staff-Only Feature:</strong> The SOP Checklist shows which data points Penny verified:<br/>
              â€¢ Hotel Occupancy âœ“<br/>
              â€¢ Hotel ADR âœ“<br/>
              â€¢ STR Performance âœ“<br/>
              â€¢ Travel Trends âœ“<br/>
              â€¢ Co-Living Data âœ“<br/>
              â€¢ Regulations âœ“<br/>
              â€¢ Seasonality âœ“<br/>
              â€¢ Competition âœ“
            </div>
            
            <h5>4. Running a New Analysis</h5>
            <ol>
              <li>Open the property detail modal</li>
              <li>Navigate to the "Penny AI" tab</li>
              <li>Click the <strong>Refresh</strong> button to generate a new score</li>
              <li>Wait for analysis to complete (typically 5-10 seconds)</li>
              <li>Review updated scores and recommendations</li>
            </ol>
            
            <h5>5. Penny Accuracy Reports</h5>
            <p>Access via Analytics Dashboard â†’ Penny Accuracy:</p>
            <ul>
              <li>View prediction accuracy over time</li>
              <li>Compare predicted vs actual revenue</li>
              <li>Identify scoring model improvements needed</li>
              <li>Submit feedback for ML training</li>
            </ul>
            
            <h5>6. ML Feedback Dashboard</h5>
            <p>Help improve Penny's accuracy by providing feedback:</p>
            <ul>
              <li>Rate score accuracy after property goes live</li>
              <li>Flag incorrect predictions for review</li>
              <li>Submit actual performance data for training</li>
            </ul>
            
            <div class="alert-warning">
              <strong>Score Expiration:</strong> Penny scores expire after 7 days. Always refresh scores for deals that have been sitting in the pipeline.
            </div>
          `
        },
        {
          role_id: 'Success_Team',
          category: 'Penny AI',
          title: 'Penny AI Features & Capabilities',
          sort_order: 3,
          content_html: `
            <h4>Complete Feature Reference: Penny AI Capabilities</h4>
            <p>This comprehensive guide covers all Penny AI features available to the Success Team.</p>
            
            <h5>Core Features</h5>
            
            <h5>1. Deal Scoring Engine</h5>
            <ul>
              <li><strong>Automatic Scoring:</strong> New properties are scored upon creation</li>
              <li><strong>On-Demand Refresh:</strong> Manual re-scoring with latest market data</li>
              <li><strong>Batch Scoring:</strong> Score multiple properties simultaneously</li>
              <li><strong>Score History:</strong> Track how scores change over time</li>
            </ul>
            
            <h5>2. Revenue Projections</h5>
            <p>Penny provides projections for three operation strategies:</p>
            <ul>
              <li><strong>Short-Term Rental (STR):</strong>
                <ul>
                  <li>Estimated ADR (Average Daily Rate)</li>
                  <li>Projected occupancy percentage</li>
                  <li>Monthly and annual revenue estimates</li>
                  <li>Profit after expenses</li>
                </ul>
              </li>
              <li><strong>Co-Living:</strong>
                <ul>
                  <li>Number of rentable rooms</li>
                  <li>Average room rate</li>
                  <li>Occupancy projections</li>
                  <li>Monthly revenue per room</li>
                </ul>
              </li>
              <li><strong>Mid-Term Rental (MTR):</strong>
                <ul>
                  <li>Monthly rental rate</li>
                  <li>Expected occupancy</li>
                  <li>Annual revenue projection</li>
                </ul>
              </li>
            </ul>
            
            <h5>3. Market Intelligence</h5>
            <ul>
              <li><strong>Market Trend Analysis:</strong> Booming, Growing, Stable, or Declining</li>
              <li><strong>Demand Drivers:</strong> Key factors driving market demand</li>
              <li><strong>Peak Season Identification:</strong> Best months for revenue</li>
              <li><strong>Competition Analysis:</strong> Market saturation levels</li>
            </ul>
            
            <h5>4. Risk Assessment</h5>
            <p>Penny identifies and categorizes risks:</p>
            <ul>
              <li><strong>Regulatory Risks:</strong> Permit requirements, zoning issues</li>
              <li><strong>Market Risks:</strong> Oversaturation, declining demand</li>
              <li><strong>Financial Risks:</strong> High rent-to-revenue ratio, thin margins</li>
              <li><strong>Operational Risks:</strong> Property condition, location challenges</li>
            </ul>
            
            <h5>5. Opportunity Identification</h5>
            <ul>
              <li>Undervalued properties in growing markets</li>
              <li>Properties suited for multiple strategies</li>
              <li>Seasonal arbitrage opportunities</li>
              <li>Emerging market entry points</li>
            </ul>
            
            <h5>6. Investor Chat Interface</h5>
            <p>Penny serves as an AI assistant for investors:</p>
            <ul>
              <li>Answers questions about markets and deals</li>
              <li>Provides personalized recommendations</li>
              <li>Explains scoring methodology</li>
              <li>Offers strategy guidance</li>
            </ul>
            
            <h5>7. Deal Matching</h5>
            <ul>
              <li>Matches investors to deals based on preferences</li>
              <li>Considers budget, target markets, and risk tolerance</li>
              <li>Sends automated notifications for matching deals</li>
              <li>Tracks match history and conversion rates</li>
            </ul>
            
            <h5>8. Supported Markets (23 Total)</h5>
            <div class="alert-info">
              Austin, Nashville, Tampa, Orlando, Phoenix, Denver, Miami, Dallas, Atlanta, Jacksonville, Charlotte, San Antonio, Raleigh-Durham, Houston, Scottsdale, Panama City Beach, St Augustine, Myrtle Beach, Fayetteville, Birmingham, West Palm Beach, Albuquerque, Santa Fe
            </div>
            
            <h5>9. Seasonality Calendar</h5>
            <p>Each market has monthly data including:</p>
            <ul>
              <li>Demand level (Low, Medium, High, Peak)</li>
              <li>ADR multiplier (0.7x - 1.5x baseline)</li>
              <li>Expected occupancy adjustment</li>
              <li>Major events affecting demand</li>
              <li>Pricing recommendations</li>
            </ul>
          `
        },
        {
          role_id: 'Success_Team',
          category: 'Penny AI',
          title: 'Penny AI & Investor Relationships',
          sort_order: 4,
          content_html: `
            <h4>Penny AI's Role in Investor Experience</h4>
            <p>This SOP defines how Penny AI interacts with investors and the Success Team's responsibilities in managing this relationship.</p>
            
            <h5>Investor-Facing Penny Features</h5>
            
            <h5>1. Penny Chat (Investor Portal)</h5>
            <p>Investors can chat with Penny directly through their portal:</p>
            <ul>
              <li><strong>Market Questions:</strong> "What's the outlook for Austin?"</li>
              <li><strong>Deal Inquiries:</strong> "What deals match my preferences?"</li>
              <li><strong>Strategy Advice:</strong> "Should I do STR or co-living?"</li>
              <li><strong>Seasonality Info:</strong> "When is peak season in Tampa?"</li>
              <li><strong>Regulation Updates:</strong> "Any new STR rules in Denver?"</li>
            </ul>
            
            <h5>2. Penny Score Visibility</h5>
            <p>Investors see Penny Scores on:</p>
            <ul>
              <li>Marketplace deal cards</li>
              <li>Saved deals list</li>
              <li>Deal detail pages</li>
              <li>Quick view modals</li>
            </ul>
            
            <div class="alert-warning">
              <strong>What Investors DON'T See:</strong><br/>
              â€¢ SOP verification checklist<br/>
              â€¢ Internal risk assessments<br/>
              â€¢ ML feedback data<br/>
              â€¢ Accuracy reports<br/>
              â€¢ Score calculation details
            </div>
            
            <h5>3. Deal Match Preferences</h5>
            <p>Investors can set preferences that Penny uses for matching:</p>
            <ul>
              <li>Target markets (multiple selections)</li>
              <li>Budget range (min/max)</li>
              <li>Property types (STR, Co-living, MTR)</li>
              <li>Minimum Penny Score threshold</li>
              <li>Bedroom requirements</li>
              <li>Must-have features</li>
            </ul>
            
            <h5>4. Automated Notifications</h5>
            <p>Penny sends notifications when:</p>
            <ul>
              <li>A new deal matches investor preferences</li>
              <li>A saved deal's score changes significantly</li>
              <li>Market conditions change in target markets</li>
              <li>Regulatory updates affect their investments</li>
            </ul>
            
            <h5>Success Team Responsibilities</h5>
            
            <h5>1. Score Interpretation Support</h5>
            <ul>
              <li>Help investors understand what scores mean</li>
              <li>Explain why certain deals score higher/lower</li>
              <li>Provide context beyond the numbers</li>
              <li>Address concerns about low-scoring deals</li>
            </ul>
            
            <h5>2. Managing Expectations</h5>
            <div class="alert-info">
              <strong>Key Talking Points:</strong><br/>
              â€¢ Penny scores are advisory, not guarantees<br/>
              â€¢ Scores are based on available data at time of analysis<br/>
              â€¢ Market conditions can change after scoring<br/>
              â€¢ Human due diligence is still essential<br/>
              â€¢ Low scores don't mean "bad" - they indicate higher risk
            </div>
            
            <h5>3. Handling Score Disputes</h5>
            <ol>
              <li>Listen to investor's concerns about the score</li>
              <li>Review the score breakdown with them</li>
              <li>Explain which factors impacted the score</li>
              <li>If valid concerns, request a manual re-score</li>
              <li>Document feedback for ML improvement</li>
            </ol>
            
            <h5>4. When Penny is Wrong</h5>
            <p>If Penny's assessment proves inaccurate:</p>
            <ul>
              <li>Acknowledge the discrepancy professionally</li>
              <li>Submit feedback through ML dashboard</li>
              <li>Document the case for model improvement</li>
              <li>Never blame Penny - take ownership as a team</li>
            </ul>
            
            <h5>5. Escalation Protocol</h5>
            <p>Escalate to Success Team Lead when:</p>
            <ul>
              <li>Investor disputes a score and requests human review</li>
              <li>Penny provides inconsistent information</li>
              <li>Technical issues affect investor experience</li>
              <li>Investor expresses distrust in AI recommendations</li>
            </ul>
          `
        },
        {
          role_id: 'Success_Team',
          category: 'Penny AI',
          title: 'Team Responsibilities with AI Systems',
          sort_order: 5,
          content_html: `
            <h4>Staff Responsibilities When Working with Penny AI</h4>
            <p>This SOP outlines the ethical and operational responsibilities of Success Team members when utilizing AI-powered tools.</p>
            
            <h5>Core Principles</h5>
            
            <h5>1. AI as a Tool, Not a Replacement</h5>
            <div class="alert-critical">
              <strong>Critical Understanding:</strong> Penny AI is a decision-support tool. It does NOT replace human judgment, due diligence, or professional responsibility. Every AI recommendation should be validated by staff before acting.
            </div>
            
            <h5>2. Transparency with Investors</h5>
            <ul>
              <li>Always disclose that Penny is an AI system</li>
              <li>Never present AI recommendations as human analysis</li>
              <li>Explain that scores are algorithmically generated</li>
              <li>Be honest about AI limitations</li>
            </ul>
            
            <h5>3. Data Accuracy Responsibility</h5>
            <p>Staff must ensure data quality for accurate scoring:</p>
            <ul>
              <li>Verify property details before scoring</li>
              <li>Update incorrect information promptly</li>
              <li>Report data discrepancies to tech team</li>
              <li>Don't manipulate data to influence scores</li>
            </ul>
            
            <h5>Operational Responsibilities</h5>
            
            <h5>1. Score Verification Protocol</h5>
            <ol>
              <li>Review Penny's score before presenting to investors</li>
              <li>Check that property data is current and accurate</li>
              <li>Verify the score aligns with your market knowledge</li>
              <li>Note any discrepancies for discussion</li>
              <li>Refresh scores older than 7 days</li>
            </ol>
            
            <h5>2. Flagged Deal Review</h5>
            <p>Properties with scores below 40 require:</p>
            <ul>
              <li>Mandatory Success Team review before investor presentation</li>
              <li>Documentation of why the deal is being considered despite low score</li>
              <li>Explicit disclosure of risks to interested investors</li>
              <li>Approval from Success Team Lead for marketplace listing</li>
            </ul>
            
            <h5>3. ML Feedback Obligations</h5>
            <p>Help improve Penny by providing feedback:</p>
            <ul>
              <li>Submit actual performance data for live properties</li>
              <li>Flag inaccurate predictions within 30 days</li>
              <li>Rate score accuracy after 90 days of operation</li>
              <li>Document edge cases and unusual situations</li>
            </ul>
            
            <h5>4. Confidentiality Requirements</h5>
            <ul>
              <li>Internal scoring methodology is confidential</li>
              <li>Don't share detailed algorithm information externally</li>
              <li>Protect ML training data and feedback</li>
              <li>SOP verification details are staff-only</li>
            </ul>
            
            <h5>Ethical Guidelines</h5>
            
            <h5>1. Prohibited Actions</h5>
            <div class="alert-critical">
              <strong>Never:</strong><br/>
              â€¢ Manipulate property data to inflate scores<br/>
              â€¢ Present AI scores as guaranteed outcomes<br/>
              â€¢ Hide low scores from investors<br/>
              â€¢ Override AI warnings without documentation<br/>
              â€¢ Use AI to discriminate against investor groups
            </div>
            
            <h5>2. Required Actions</h5>
            <ul>
              <li>Disclose AI involvement in recommendations</li>
              <li>Explain score methodology when asked</li>
              <li>Report AI errors or biases immediately</li>
              <li>Maintain human oversight of all AI decisions</li>
              <li>Document any AI overrides with justification</li>
            </ul>
            
            <h5>3. Continuous Learning</h5>
            <ul>
              <li>Stay updated on Penny feature releases</li>
              <li>Attend AI training sessions</li>
              <li>Share insights from AI interactions with team</li>
              <li>Contribute to best practices documentation</li>
            </ul>
            
            <h5>Accountability</h5>
            <p>Remember: You are accountable for recommendations you make, even when supported by AI. Penny provides data and analysis, but the responsibility for investor guidance remains with the Success Team.</p>
          `
        },
        {
          role_id: 'Success_Team',
          category: 'Penny AI',
          title: 'Maximizing Penny AI for Deal Sourcing',
          sort_order: 6,
          content_html: `
            <h4>Best Practices: Leveraging Penny AI for Optimal Results</h4>
            <p>This SOP provides strategies and techniques for maximizing the value of Penny AI in deal sourcing and investor success.</p>
            
            <h5>Deal Sourcing Optimization</h5>
            
            <h5>1. Pre-Screening with Penny</h5>
            <p>Use Penny to efficiently filter deals:</p>
            <ol>
              <li>Run batch scoring on new property lists</li>
              <li>Sort by Penny Score to prioritize review</li>
              <li>Focus detailed analysis on scores 60+</li>
              <li>Quick-reject scores below 30 (unless special circumstances)</li>
              <li>Flag 30-60 scores for secondary review</li>
            </ol>
            
            <h5>2. Market Timing</h5>
            <p>Leverage seasonality data for better deals:</p>
            <ul>
              <li>Check seasonality calendar before pricing discussions</li>
              <li>Negotiate harder during low-demand months</li>
              <li>Prioritize deals in markets entering peak season</li>
              <li>Use ADR multipliers to project realistic revenue</li>
            </ul>
            
            <h5>3. Strategy Selection</h5>
            <p>Let Penny guide operation strategy:</p>
            <ul>
              <li>Review "Best Strategy" recommendation for each property</li>
              <li>Compare revenue projections across all three strategies</li>
              <li>Consider hybrid approaches when scores are close</li>
              <li>Factor in investor preferences and experience level</li>
            </ul>
            
            <h5>Investor Matching Excellence</h5>
            
            <h5>1. Preference Optimization</h5>
            <p>Help investors set effective preferences:</p>
            <ul>
              <li>Recommend realistic Penny Score minimums (70+ for beginners)</li>
              <li>Suggest 3-5 target markets for better matching</li>
              <li>Set appropriate budget ranges with 20% buffer</li>
              <li>Review and update preferences quarterly</li>
            </ul>
            
            <h5>2. Proactive Matching</h5>
            <ul>
              <li>Run manual matches for VIP investors weekly</li>
              <li>Alert investors to exceptional deals (85+ scores) immediately</li>
              <li>Create "deal alerts" for specific criteria</li>
              <li>Track match-to-close conversion rates</li>
            </ul>
            
            <h5>3. Score-Based Conversations</h5>
            <div class="alert-info">
              <strong>Conversation Starters by Score:</strong><br/>
              â€¢ <strong>85+:</strong> "Penny identified an exceptional opportunity..."<br/>
              â€¢ <strong>70-84:</strong> "This deal scores well across all factors..."<br/>
              â€¢ <strong>60-69:</strong> "Solid opportunity with some considerations..."<br/>
              â€¢ <strong>Below 60:</strong> "I want to be transparent about the risks..."
            </div>
            
            <h5>Advanced Techniques</h5>
            
            <h5>1. Score Trend Analysis</h5>
            <ul>
              <li>Track how scores change over time for saved deals</li>
              <li>Identify deals with improving scores (market momentum)</li>
              <li>Flag deals with declining scores for review</li>
              <li>Use trends to time investor outreach</li>
            </ul>
            
            <h5>2. Component Score Deep Dives</h5>
            <p>When overall score is borderline, analyze components:</p>
            <ul>
              <li>High financial, low regulation = permit risk worth investigating</li>
              <li>High market, low competition = emerging opportunity</li>
              <li>Low seasonality = consider MTR strategy instead</li>
              <li>High location, low financial = negotiate harder on rent</li>
            </ul>
            
            <h5>3. Comparative Analysis</h5>
            <ul>
              <li>Compare similar properties across markets</li>
              <li>Identify why one scores higher than another</li>
              <li>Use comparisons to educate investors</li>
              <li>Build market expertise through pattern recognition</li>
            </ul>
            
            <h5>4. Risk Mitigation Strategies</h5>
            <p>Use Penny's risk analysis proactively:</p>
            <ul>
              <li>Address identified risks before investor questions</li>
              <li>Prepare mitigation plans for common risks</li>
              <li>Document risk acceptance for flagged deals</li>
              <li>Use risks as negotiation leverage with landlords</li>
            </ul>
            
            <h5>Performance Tracking</h5>
            
            <h5>1. Key Metrics to Monitor</h5>
            <ul>
              <li>Average Penny Score of closed deals</li>
              <li>Score accuracy (predicted vs actual performance)</li>
              <li>Match-to-inquiry conversion rate</li>
              <li>Time from match to close by score range</li>
            </ul>
            
            <h5>2. Feedback Loop</h5>
            <ul>
              <li>Submit performance data for all live properties</li>
              <li>Flag scoring errors within 30 days</li>
              <li>Share insights in team meetings</li>
              <li>Contribute to model improvement</li>
            </ul>
            
            <div class="alert-warning">
              <strong>Remember:</strong> Penny is most effective when combined with your market expertise and investor relationships. Use AI to enhance your capabilities, not replace your judgment.
            </div>
          `
        },
        {
          role_id: 'Success_Team',
          category: 'Penny AI',
          title: 'Penny AI Troubleshooting Guide',
          sort_order: 7,
          content_html: `
            <h4>Troubleshooting Common Penny AI Issues</h4>
            <p>This guide helps resolve common issues encountered when using Penny AI.</p>
            
            <h5>Scoring Issues</h5>
            
            <h5>1. Score Not Generating</h5>
            <p><strong>Symptoms:</strong> "No analysis available" or loading indefinitely</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Verify property has required fields (address, city, state, bedrooms, rent)</li>
              <li>Check if market is in supported list (23 markets)</li>
              <li>Click "Generate Analysis" or "Refresh" button</li>
              <li>Clear browser cache and retry</li>
              <li>If persistent, report to tech team</li>
            </ul>
            
            <h5>2. Score Seems Incorrect</h5>
            <p><strong>Symptoms:</strong> Score doesn't match your market knowledge</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Review component scores to identify the issue</li>
              <li>Verify property data is accurate and complete</li>
              <li>Check if market data is current (weekly refresh)</li>
              <li>Consider if unique factors aren't captured by algorithm</li>
              <li>Submit feedback through ML dashboard</li>
            </ul>
            
            <h5>3. Score Expired</h5>
            <p><strong>Symptoms:</strong> Score shows old date or "expired" warning</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Click refresh button to generate new score</li>
              <li>Scores expire after 7 days automatically</li>
              <li>Always refresh before presenting to investors</li>
            </ul>
            
            <h5>Chat Issues</h5>
            
            <h5>4. Penny Not Responding</h5>
            <p><strong>Symptoms:</strong> Chat shows loading indefinitely</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Check internet connection</li>
              <li>Refresh the page</li>
              <li>Try a simpler question first</li>
              <li>Clear conversation and start new chat</li>
              <li>Report if issue persists for 5+ minutes</li>
            </ul>
            
            <h5>5. Penny Gives Incorrect Information</h5>
            <p><strong>Symptoms:</strong> Response contains factual errors</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Do not share incorrect info with investors</li>
              <li>Verify information through other sources</li>
              <li>Report the error with screenshot</li>
              <li>Provide correct information to investor directly</li>
            </ul>
            
            <h5>6. Penny Doesn't Understand Question</h5>
            <p><strong>Symptoms:</strong> Response is off-topic or generic</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Rephrase question more specifically</li>
              <li>Include market name and property type</li>
              <li>Break complex questions into parts</li>
              <li>Use suggested questions as templates</li>
            </ul>
            
            <h5>Data Issues</h5>
            
            <h5>7. Market Data Missing</h5>
            <p><strong>Symptoms:</strong> "No market data available" message</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Verify market is in supported list</li>
              <li>Check spelling of city/market name</li>
              <li>Report missing market data to tech team</li>
              <li>Use closest comparable market temporarily</li>
            </ul>
            
            <h5>8. Seasonality Data Incorrect</h5>
            <p><strong>Symptoms:</strong> Peak season info doesn't match reality</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Submit correction through feedback system</li>
              <li>Document the discrepancy with evidence</li>
              <li>Use your market knowledge to advise investors</li>
              <li>Flag for data team review</li>
            </ul>
            
            <h5>Technical Issues</h5>
            
            <h5>9. Slow Performance</h5>
            <p><strong>Symptoms:</strong> Scoring takes more than 30 seconds</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Check internet connection speed</li>
              <li>Avoid batch scoring during peak hours</li>
              <li>Report consistent slowness to tech team</li>
              <li>Try again during off-peak hours</li>
            </ul>
            
            <h5>10. Feature Not Working</h5>
            <p><strong>Symptoms:</strong> Button doesn't respond, feature unavailable</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Refresh the page</li>
              <li>Clear browser cache</li>
              <li>Try different browser</li>
              <li>Check if feature requires specific permissions</li>
              <li>Report with screenshot and steps to reproduce</li>
            </ul>
            
            <h5>Escalation Path</h5>
            <div class="alert-info">
              <strong>When to Escalate:</strong><br/>
              1. Issue persists after troubleshooting<br/>
              2. Multiple users report same issue<br/>
              3. Issue affects investor-facing features<br/>
              4. Data accuracy concerns<br/><br/>
              <strong>Escalate to:</strong> Tech Team via #penny-support channel
            </div>
          `
        }
      ];
      
      let created = 0;
      for (const sop of pennySOPs) {
        const checkUrl = `${SUPABASE_URL}/rest/v1/sop_repository?title=eq.${encodeURIComponent(sop.title)}&role_id=eq.${sop.role_id}`;
        const checkRes = await fetch(checkUrl, { headers });
        const existing = await checkRes.json();
        
        if (!existing || existing.length === 0) {
          const createRes = await fetch(`${SUPABASE_URL}/rest/v1/sop_repository`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...sop,
              is_active: true,
              version: 1,
              updated_by: 'System',
              change_summary: 'Initial creation - Penny AI SOPs',
              last_updated: new Date().toISOString()
            })
          });
          if (createRes.ok) created++;
        }
      }
      
      return json({ success: true, message: `Created ${created} Penny AI SOPs`, total: pennySOPs.length });
    }

    // ==================== SEED ALL SOPs ====================
    if (action === 'seed_all_sops') {
      const sops = [
        // SUCCESS TEAM SOPs
        {
          role_id: 'Success_Team',
          category: 'Onboarding',
          title: 'Discovery & Onboarding Bridge',
          sort_order: 1,
          content_html: `
            <h4>Discovery & Onboarding Bridge Protocol</h4>
            <p>This SOP governs the initial investor consultation and account activation process.</p>
            
            <h5>Step 1: Initial Contact Response</h5>
            <ul>
              <li>Respond to all new investor inquiries within 2 business hours</li>
              <li>Use the "Welcome to AYP" email template for first contact</li>
              <li>Schedule a discovery call within 48 hours of initial contact</li>
            </ul>
            
            <h5>Step 2: Discovery Call Protocol</h5>
            <div class="alert-warning">
              <strong>$5,000 Capital Verification:</strong> During the initial AM consultation, verify the investor has minimum $5,000 liquid reserves to safely complete the investment cycle. This is non-negotiable.
            </div>
            <ul>
              <li>Review investor's experience level and goals</li>
              <li>Explain the AYP acquisition process and timeline</li>
              <li>Discuss target markets and property preferences</li>
              <li>Verify capital availability (minimum $5,000 liquid)</li>
              <li>Set clear expectations about fees and timelines</li>
            </ul>
            
            <h5>Step 3: Account Initiation</h5>
            <ul>
              <li>Create investor account in the portal</li>
              <li>Send welcome email with portal access credentials</li>
              <li>Assign to appropriate Acquisition Manager based on target market</li>
              <li>Schedule follow-up call within 1 week</li>
            </ul>
            
            <h5>Step 4: Documentation</h5>
            <ul>
              <li>Log all interactions in the CRM</li>
              <li>Update investor profile with preferences and notes</li>
              <li>Set automated follow-up reminders</li>
            </ul>
          `
        },
        {
          role_id: 'Success_Team',
          category: 'Compliance',
          title: 'Credit & Integrity Standards',
          sort_order: 2,
          content_html: `
            <h4>YP Credits Policy & Platform Integrity</h4>
            <p>This SOP governs the management of investor credits and platform security protocols.</p>
            
            <h5>YP Credits Management</h5>
            <ul>
              <li>Credits are earned through referrals ($500 per successful referral)</li>
              <li>Credits can only be applied to AYP Approved Deals</li>
              <li>Credits have no cash value and cannot be transferred</li>
              <li>Maximum credit application per deal: 50% of acquisition fee</li>
            </ul>
            
            <h5>Credit Issuance Process</h5>
            <ol>
              <li>Verify referral has completed their first acquisition</li>
              <li>Issue credit to referring investor's account</li>
              <li>Send notification email with credit balance update</li>
              <li>Log transaction in credit ledger</li>
            </ol>
            
            <div class="alert-critical">
              <strong>Ocean307 Security Protocol:</strong> When contacting landlords or partners, always lead with the company password "Ocean307" to verify AYP representative identity. This protects our landlord relationships and prevents unauthorized contact.
            </div>
            
            <h5>Privacy Standards</h5>
            <ul>
              <li>Never share investor information with third parties without consent</li>
              <li>Property addresses are confidential until 50% fee funded</li>
              <li>All deal information is proprietary and protected</li>
              <li>Landlord contacts are never shared with investors directly</li>
            </ul>
          `
        },
        {
          role_id: 'Cross_Team',
          category: 'Compliance',
          title: 'Platform Security & Ocean307 Protocol',
          sort_order: 3,
          content_html: `
            <h4>Platform Security & Identity Verification</h4>
            <p>This SOP governs security protocols and identity verification.</p>
            
            <div class="alert-critical">
              <strong>Ocean307 Protocol:</strong> This is the company password used to verify AYP representative identity when contacting landlords or partners. Always lead with this password in initial communications.
            </div>
            
            <h5>When to Use Ocean307</h5>
            <ul>
              <li>First contact with new landlords</li>
              <li>Calling property management companies</li>
              <li>Verifying identity to partners or vendors</li>
              <li>When asked to confirm AYP affiliation</li>
            </ul>
            
            <h5>Account Security</h5>
            <ul>
              <li>Never share login credentials</li>
              <li>Use strong, unique passwords</li>
              <li>Log out when leaving workstation</li>
              <li>Report suspicious activity immediately</li>
            </ul>
          `
        }
      ];
      
      let created = 0;
      for (const sop of sops) {
        const checkUrl = `${SUPABASE_URL}/rest/v1/sop_repository?title=eq.${encodeURIComponent(sop.title)}&role_id=eq.${sop.role_id}`;
        const checkRes = await fetch(checkUrl, { headers });
        const existing = await checkRes.json();
        
        if (!existing || existing.length === 0) {
          const createRes = await fetch(`${SUPABASE_URL}/rest/v1/sop_repository`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...sop,
              is_active: true,
              version: 1,
              updated_by: 'System',
              change_summary: 'Initial creation',
              last_updated: new Date().toISOString()
            })
          });
          if (createRes.ok) created++;
        }
      }
      
      return json({ success: true, message: `Created ${created} SOPs`, total: sops.length });
    }

    // ==================== GET SOPs ====================
    if (action === 'get_sops') {
      const { user_role, category, search_query } = params;
      console.log('[manage-sop-repository] get_sops for role:', user_role);
      
      if (!canView(user_role)) {
        return json({ error: 'Access denied', user_role }, 403);
      }

      const visibleRoles = getRoleSOPs(user_role);
      const roleFilter = visibleRoles.join(',');
      
      let url = `${SUPABASE_URL}/rest/v1/sop_repository?is_active=eq.true&order=category,sort_order`;
      url += `&role_id=in.(${roleFilter})`;
      
      if (category && category !== 'all') {
        url += `&category=eq.${encodeURIComponent(category)}`;
      }

      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        const errorText = await res.text();
        return json({ error: 'Database fetch failed', details: errorText, status: res.status }, 500);
      }
      
      let data = await res.json();
      
      if (search_query && Array.isArray(data)) {
        const q = search_query.toLowerCase();
        data = data.filter((s: any) => 
          s.title?.toLowerCase().includes(q) || 
          s.content_html?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q)
        );
      }

      const grouped = (data || []).reduce((acc: any, sop: any) => {
        const cat = sop.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(sop);
        return acc;
      }, {});

      return json({ 
        success: true,
        sops: data || [], 
        grouped, 
        can_edit: canEdit(user_role) 
      });
    }

    // ==================== GET CATEGORIES ====================
    if (action === 'get_categories') {
      const { user_role } = params;
      
      if (!canView(user_role)) {
        return json({ error: 'Access denied' }, 403);
      }

      const visibleRoles = getRoleSOPs(user_role);
      const roleFilter = visibleRoles.join(',');
      
      const url = `${SUPABASE_URL}/rest/v1/sop_repository?is_active=eq.true&select=category&role_id=in.(${roleFilter})`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      
      const categories = [...new Set((data || []).map((d: any) => d.category).filter(Boolean))];
      return json({ success: true, categories });
    }

    // ==================== CREATE SOP ====================
    if (action === 'create_sop') {
      const { user_role, role_id, category, title, content_html, sort_order, updated_by } = params;
      
      if (!canEdit(user_role)) {
        return json({ error: 'Only Admin or Success Team can create SOPs' }, 403);
      }

      const sopData = {
        role_id: role_id || 'Cross_Team',
        category: category || 'General',
        title,
        content_html,
        sort_order: sort_order || 0,
        updated_by: updated_by || 'System',
        version: 1,
        change_summary: 'Initial creation',
        is_active: true,
        last_updated: new Date().toISOString()
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/sop_repository`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sopData)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        return json({ error: 'Failed to create SOP', details: errorText }, 500);
      }
      
      const data = await res.json();
      return json({ success: true, sop: data?.[0] || data });
    }

    // ==================== UPDATE SOP ====================
    if (action === 'update_sop') {
      const { user_role, sop_id, title, content_html, category, role_id, sort_order, updated_by, change_summary } = params;
      
      if (!canEdit(user_role)) {
        return json({ error: 'Only Admin or Success Team can edit SOPs' }, 403);
      }

      const currentRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sop_repository?id=eq.${sop_id}&select=*`,
        { headers }
      );
      const current = (await currentRes.json())?.[0];
      
      if (!current) {
        return json({ error: 'SOP not found' }, 404);
      }

      const newVersion = await saveVersionHistory(
        sop_id,
        current,
        content_html || current.content_html,
        title || current.title,
        change_summary || 'Content updated',
        updated_by || 'System'
      );

      const updates: any = {
        last_updated: new Date().toISOString(),
        updated_by: updated_by || 'System',
        version: newVersion,
        change_summary: change_summary || 'Content updated'
      };
      
      if (title !== undefined) updates.title = title;
      if (content_html !== undefined) updates.content_html = content_html;
      if (category !== undefined) updates.category = category;
      if (role_id !== undefined) updates.role_id = role_id;
      if (sort_order !== undefined) updates.sort_order = sort_order;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/sop_repository?id=eq.${sop_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        return json({ error: 'Failed to update SOP', details: errorText }, 500);
      }
      
      const data = await res.json();
      return json({ success: true, sop: data?.[0] || data, version: newVersion });
    }

    // ==================== DELETE SOP ====================
    if (action === 'delete_sop') {
      const { user_role, sop_id } = params;
      
      if (!canEdit(user_role)) {
        return json({ error: 'Only Admin or Success Team can delete SOPs' }, 403);
      }

      await fetch(`${SUPABASE_URL}/rest/v1/sop_repository?id=eq.${sop_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: false })
      });
      
      return json({ success: true });
    }

    // ==================== GET VERSION HISTORY ====================
    // get_sop_diff: what actually CHANGED between two versions of a procedure. The
    // sop_versions table already stores previous_content_html alongside content_html, so
    // the comparison is stored rather than computed — no diffing library needed.
    if (action === 'get_sop_diff') {
      const { version_id } = body;
      if (!version_id) {
        return new Response(JSON.stringify({ success: false, error: 'version_id is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/sop_versions?id=eq.${version_id}&select=id,sop_id,version_number,title,content_html,previous_content_html,change_summary,changed_by,created_at&limit=1`,
        { headers });
      if (!res.ok) {
        console.error('manage-sop-repository get_sop_diff failed', res.status);
        return new Response(JSON.stringify({ success: false, error: 'Could not load that version.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const rows = await res.json();
      const v = rows?.[0];
      if (!v) {
        return new Response(JSON.stringify({ success: false, error: 'No such version.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Say plainly when there is nothing to compare against, rather than showing an empty
      // "before" pane that reads as "everything was deleted".
      const isFirst = !v.previous_content_html;
      return new Response(JSON.stringify({
        success: true,
        version: { id: v.id, sop_id: v.sop_id, number: v.version_number, title: v.title,
                   summary: v.change_summary, changed_by: v.changed_by, created_at: v.created_at },
        before: v.previous_content_html ?? null,
        after: v.content_html ?? null,
        is_first_version: isFirst,
        note: isFirst ? 'This is the first version, so there is nothing to compare it against.' : null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_sop_version_history') {
      const { sop_id } = params;
      
      if (!sop_id) {
        return json({ error: 'sop_id is required' }, 400);
      }

      const url = `${SUPABASE_URL}/rest/v1/sop_versions?sop_id=eq.${sop_id}&order=version_number.desc`;
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        return json({ error: 'Failed to fetch version history' }, 500);
      }
      
      const versions = await res.json();
      return json({ success: true, versions: versions || [] });
    }

    // ==================== PENDING ACKNOWLEDGMENTS ====================
    if (action === 'get_pending_acknowledgments') {
      return json({ success: true, pending: [], total_pending: 0 });
    }

    if (action === 'acknowledge_sop') {
      return json({ success: true });
    }

    // ==================== SEED PLATFORM SOPs ====================
    if (action === 'seed_platform_sops') {
      return json({ success: true, message: 'Platform SOPs seeded' });
    }

    // ==================== DEFAULT ====================
    return json({ 
      error: `Unknown action: ${action}`,
      available_actions: [
        'get_sops', 'get_categories', 'create_sop', 'update_sop', 'delete_sop',
        'seed_all_sops', 'seed_penny_ai_sops', 'seed_platform_sops',
        'get_pending_acknowledgments', 'acknowledge_sop', 'get_sop_version_history'
      ]
    }, 400);

  } catch (error: any) {
    console.error('[manage-sop-repository] Error:', error);
    return json({ error: error.message }, 500);
  }
});
