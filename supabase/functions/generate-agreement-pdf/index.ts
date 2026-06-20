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
// generate-agreement-pdf v2.0 - Complete agreement PDF with full text, signature details, IP, timestamp, hash
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { agreement_id } = await req.json();
    if (!agreement_id) {
      return new Response(JSON.stringify({ success: false, error: 'agreement_id required' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    // Fetch agreement
    const res = await fetch(`${supabaseUrl}/rest/v1/am_agreements?id=eq.${agreement_id}&select=*`, { headers });
    const agreements = await res.json();
    const agreement = Array.isArray(agreements) && agreements.length > 0 ? agreements[0] : null;

    if (!agreement) {
      return new Response(JSON.stringify({ success: false, error: 'Agreement not found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const signedDate = agreement.signed_at ? new Date(agreement.signed_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' }) : 'Not yet signed';
    const sentDate = agreement.sent_at ? new Date(agreement.sent_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : 'N/A';
    const signatureText = agreement.signature_text || '';
    const signatureIp = agreement.signature_ip || 'N/A';
    const signatureHash = agreement.signature_hash || 'N/A';
    const amName = agreement.am_name || 'Unknown';
    const amEmail = agreement.am_email || 'Unknown';
    const mentorName = agreement.mentor_name || 'TBD';
    const status = agreement.status || 'unknown';
    const userAgent = agreement.signer_user_agent || 'N/A';
    const agreementVersion = agreement.agreement_version || '1.0';
    const now = new Date();
    const sentDateObj = agreement.sent_at ? new Date(agreement.sent_at) : now;
    const day = sentDateObj.getDate();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month = monthNames[sentDateObj.getMonth()];
    const year = sentDateObj.getFullYear();

    const statusColor = status === 'signed' ? '#10b981' : status === 'voided' ? '#ef4444' : '#f59e0b';
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    const pdfHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>AM Service Agreement - ${amName}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a1a; line-height: 1.6; font-size: 11pt; margin: 0; padding: 0; }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #1e3a5f; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; z-index: 1000; font-family: Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
  .print-btn:hover { background: #2d5a87; }
  .container { max-width: 800px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #1e3a5f; font-size: 20pt; margin: 0 0 5px; letter-spacing: 2px; }
  .header .subtitle { color: #666; font-size: 10pt; }
  .header .logo { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 20pt; font-weight: bold; margin-bottom: 10px; font-family: Arial, sans-serif; }
  .meta-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px 20px; margin-bottom: 25px; display: flex; flex-wrap: wrap; gap: 20px; }
  .meta-item { flex: 1; min-width: 150px; }
  .meta-label { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; font-family: Arial, sans-serif; }
  .meta-value { font-size: 11pt; color: #1a1a1a; font-weight: bold; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 10pt; font-weight: bold; color: white; font-family: Arial, sans-serif; }
  h2 { color: #1e3a5f; font-size: 14pt; border-bottom: 2px solid #d4a574; padding-bottom: 6px; margin-top: 30px; margin-bottom: 15px; }
  h3 { color: #1e3a5f; font-size: 12pt; margin-top: 20px; margin-bottom: 10px; }
  .party-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px 20px; margin: 15px 0; }
  .party-label { font-weight: bold; color: #1e3a5f; margin-bottom: 5px; }
  .pillar-box { border-left: 4px solid; padding: 12px 16px; margin: 10px 0; border-radius: 0 8px 8px 0; }
  .pillar-1 { border-color: #3b82f6; background: #eff6ff; }
  .pillar-2 { border-color: #10b981; background: #f0fdf4; }
  .pillar-3 { border-color: #f59e0b; background: #fffbeb; }
  .pillar-4 { border-color: #8b5cf6; background: #f5f3ff; }
  .pillar-title { font-weight: bold; margin-bottom: 4px; }
  .pillar-1 .pillar-title { color: #1d4ed8; }
  .pillar-2 .pillar-title { color: #059669; }
  .pillar-3 .pillar-title { color: #d97706; }
  .pillar-4 .pillar-title { color: #7c3aed; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th { background: #1e3a5f; color: white; padding: 10px 12px; text-align: left; font-size: 10pt; font-family: Arial, sans-serif; }
  td { padding: 10px 12px; border: 1px solid #dee2e6; font-size: 10pt; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .commission-rate { color: #d4a574; font-weight: bold; font-size: 14pt; text-align: center; }
  .signature-section { border: 2px solid #1e3a5f; border-radius: 12px; padding: 25px; margin-top: 40px; page-break-inside: avoid; }
  .signature-header { text-align: center; color: #1e3a5f; font-size: 14pt; margin-bottom: 20px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; }
  .sig-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
  .sig-item { flex: 1; min-width: 200px; }
  .sig-label { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif; }
  .sig-value { font-size: 11pt; margin-top: 3px; }
  .sig-name { font-family: 'Brush Script MT', 'Dancing Script', cursive, serif; font-size: 24pt; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; display: inline-block; padding-bottom: 2px; }
  .hash-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-top: 15px; }
  .hash-label { font-size: 9pt; color: #166534; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif; }
  .hash-value { font-family: 'Courier New', monospace; font-size: 8pt; color: #166534; word-break: break-all; margin-top: 4px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80pt; color: rgba(16, 185, 129, 0.06); font-weight: bold; font-family: Arial, sans-serif; pointer-events: none; z-index: -1; }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #999; font-size: 9pt; }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
${status === 'signed' ? '<div class="watermark">SIGNED</div>' : ''}
<div class="container">
  <div class="header">
    <div class="logo">AYP</div>
    <h1>ACQUISITION MANAGER SERVICE AGREEMENT</h1>
    <div class="subtitle">Independent Contractor Agreement &mdash; Version ${agreementVersion}</div>
  </div>

  <div class="meta-box">
    <div class="meta-item"><div class="meta-label">Contractor</div><div class="meta-value">${amName}</div></div>
    <div class="meta-item"><div class="meta-label">Email</div><div class="meta-value" style="font-size:10pt;">${amEmail}</div></div>
    <div class="meta-item"><div class="meta-label">Mentor</div><div class="meta-value">${mentorName}</div></div>
    <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value"><span class="status-badge" style="background:${statusColor};">${statusLabel}</span></div></div>
    <div class="meta-item"><div class="meta-label">Agreement Date</div><div class="meta-value">${month} ${day}, ${year}</div></div>
  </div>

  <p>THIS INDEPENDENT CONTRACTOR AGREEMENT (the &ldquo;Agreement&rdquo;) is made and entered into on this <strong>${day}</strong> day of <strong>${month}</strong>, ${year}, by and between:</p>

  <div class="party-box">
    <div class="party-label">THE COMPANY:</div>
    <div>Set Up Your Place LLC (DBA: Access Your Place / AYP)<br>A Subsidiary of Cooper Family Inc.<br>1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126<br>(Hereinafter referred to as the &ldquo;Company&rdquo; or &ldquo;AYP&rdquo;)</div>
  </div>

  <div class="party-box">
    <div class="party-label">THE CONTRACTOR:</div>
    <div>Name: <strong style="color:#1e3a5f;border-bottom:2px solid #d4a574;">${amName}</strong><br>Email: ${amEmail}<br>(Hereinafter referred to as the &ldquo;Acquisition Manager&rdquo; or &ldquo;AM&rdquo;)</div>
  </div>

  <h2>1. ENGAGEMENT &amp; STATUS</h2>
  <p><strong>1.1 Independent Contractor Status.</strong> The Acquisition Manager is engaged as an independent contractor, not an employee of the Company. The AM shall not be entitled to any employee benefits, including but not limited to health insurance, retirement plans, paid time off, or workers&rsquo; compensation. The AM is solely responsible for their own taxes, insurance, and business expenses.</p>
  <p><strong>1.2 The &ldquo;Standard of Truth&rdquo; Mandate.</strong> The AM acknowledges that AYP operates on a rigorous &ldquo;Standard of Truth.&rdquo; Every deal presented, every financial projection shared, and every claim made to a client must be verifiable and accurate. Any deliberate misrepresentation of property data, financial projections, market conditions, or company capabilities is grounds for immediate termination of this Agreement and forfeiture of any pending commissions.</p>
  <p><strong>1.3 Scope of Work.</strong> The AM shall be responsible for: (a) Sourcing and analyzing potential rental arbitrage properties; (b) Presenting qualified deals to investors through the AYP platform; (c) Managing client relationships from discovery through lease signing; (d) Maintaining accurate records of all transactions and communications.</p>

  <h2>2. TRAINING, CERTIFICATION &amp; OVERSIGHT</h2>
  <p><strong>2.1 The Shadow Phase (AMT Status).</strong> Upon execution of this Agreement, the AM enters the &ldquo;Acquisition Manager in Training&rdquo; (AMT) phase. During this phase:</p>
  <ul>
    <li>All deals must be reviewed and approved by the assigned Certified Mentor before submission</li>
    <li>Commission split during training: <strong>50/50</strong> with the supervising Certified Manager</li>
    <li>The AM has exactly <strong>four (4) months</strong> from the date of this Agreement to complete the 4 Pillars of Certification</li>
    <li>Failure to achieve certification within the deadline results in immediate revocation of platform access</li>
  </ul>

  <p><strong>2.2 The 4 Pillars of Excellence.</strong></p>
  <div class="pillar-box pillar-1"><div class="pillar-title">Pillar 1: MARKET MASTERY (The Analyst)</div><div>Source, negotiate, and submit 3 consecutive qualified deals that pass the Foundation of Truth audit without rejection.</div></div>
  <div class="pillar-box pillar-2"><div class="pillar-title">Pillar 2: THE RAINMAKER (The Hunter)</div><div>Within a 30-day window, generate 3 New Investor Leads and close 2 of them into active investors.</div></div>
  <div class="pillar-box pillar-3"><div class="pillar-title">Pillar 3: THE CONSULTANT (The Guide)</div><div>Complete 3 full-cycle transactions (Discovery Call to Lease Signing) consecutively without error.</div></div>
  <div class="pillar-box pillar-4"><div class="pillar-title">Pillar 4: TECHNICAL PROFICIENCY (The Scholar)</div><div>Pass the Final Certification Exam with a score of 90% or higher, demonstrating mastery of AYP processes, market analysis, and client management.</div></div>

  <p><strong>2.3 Maintenance of Certification.</strong> Once certified, the AM must maintain: minimum 6 closed transactions per quarter, minimum 2 new qualified deals submitted per month, and a client satisfaction rating of 4.5/5.0 or higher.</p>

  <h2>3. COMPENSATION STRUCTURE</h2>
  <table>
    <thead><tr><th>Commission Type</th><th style="text-align:center;">Rate</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td><strong>Finder&rsquo;s Fee</strong></td><td class="commission-rate">15%</td><td>Sourcing and qualifying a deal that results in a closed transaction</td></tr>
      <tr><td><strong>Closing Fee</strong></td><td class="commission-rate">15%</td><td>Managing the client through the closing process to lease signing</td></tr>
      <tr><td><strong>Full-Cycle</strong></td><td class="commission-rate">30%</td><td>End-to-end management from deal sourcing through lease signing</td></tr>
    </tbody>
  </table>
  <p><strong>3.1 Payment Terms.</strong> Commissions are paid within 14 business days of the investor&rsquo;s payment clearing. During the AMT phase, commissions are split 50/50 with the assigned mentor.</p>
  <p><strong>3.2 Clawback Provision.</strong> If a transaction is reversed, disputed, or the investor cancels within 30 days, the AM&rsquo;s commission may be clawed back in full.</p>

  <h2>4. CONFIDENTIALITY &amp; NON-COMPETE</h2>
  <p><strong>4.1 Confidentiality.</strong> The AM agrees to maintain strict confidentiality regarding all proprietary information, including but not limited to: investor databases, deal sourcing methodologies, financial models, client information, and internal processes.</p>
  <p><strong>4.2 Non-Compete.</strong> During the term of this Agreement and for a period of 12 months following termination, the AM shall not directly or indirectly engage in any rental arbitrage deal sourcing or consulting business that competes with AYP within the markets served by the Company.</p>
  <p><strong>4.3 Non-Solicitation.</strong> For 18 months following termination, the AM shall not solicit any AYP clients, investors, or staff members.</p>

  <h2>5. TERMINATION</h2>
  <p><strong>5.1</strong> Either party may terminate this Agreement with 30 days written notice.</p>
  <p><strong>5.2</strong> The Company may terminate immediately for cause, including: violation of the Standard of Truth, failure to achieve certification within the deadline, breach of confidentiality, or conduct detrimental to the Company&rsquo;s reputation.</p>
  <p><strong>5.3</strong> Upon termination, the AM shall immediately return all Company materials, cease use of the AYP platform, and transfer all active client relationships to the Company.</p>

  <h2>6. GOVERNING LAW</h2>
  <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Florida. Any disputes arising under this Agreement shall be resolved through binding arbitration in Miami-Dade County, Florida.</p>

  <h2>7. ENTIRE AGREEMENT</h2>
  <p>This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, warranties, commitments, offers, contracts, and writings. This Agreement may only be modified by a written instrument signed by both parties.</p>

  ${status === 'signed' ? `
  <div class="signature-section">
    <div class="signature-header">DIGITAL SIGNATURE VERIFICATION</div>
    <div class="sig-grid">
      <div class="sig-item"><div class="sig-label">Signed By</div><div class="sig-value"><strong>${amName}</strong></div></div>
      <div class="sig-item"><div class="sig-label">Email</div><div class="sig-value">${amEmail}</div></div>
      <div class="sig-item"><div class="sig-label">Signing Date &amp; Time</div><div class="sig-value">${signedDate}</div></div>
      <div class="sig-item"><div class="sig-label">IP Address</div><div class="sig-value" style="font-family:monospace;">${signatureIp}</div></div>
    </div>
    <div style="text-align:center;margin:20px 0;">
      <div class="sig-label" style="margin-bottom:8px;">Digital Signature</div>
      <div class="sig-name">${signatureText}</div>
    </div>
    <div class="hash-box">
      <div class="hash-label">SHA-256 Verification Hash</div>
      <div class="hash-value">${signatureHash}</div>
    </div>
    <div style="margin-top:12px;text-align:center;">
      <div class="sig-label">User Agent</div>
      <div style="font-size:8pt;color:#666;margin-top:2px;word-break:break-all;">${userAgent}</div>
    </div>
  </div>
  ` : `
  <div class="signature-section" style="border-color:#f59e0b;">
    <div class="signature-header" style="color:#92400e;">AWAITING SIGNATURE</div>
    <p style="text-align:center;color:#666;">This agreement has been sent but has not yet been signed.</p>
    <p style="text-align:center;color:#666;font-size:10pt;">Sent: ${sentDate}</p>
  </div>
  `}

  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} Set Up Your Place LLC (DBA: Access Your Place). All rights reserved.</p>
    <p>This document is confidential and intended only for the named parties. Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}.</p>
    <p style="font-size:8pt;color:#bbb;">Agreement ID: ${agreement_id} | Version: ${agreementVersion}</p>
  </div>
</div>
</body></html>`;

    return new Response(JSON.stringify({ success: true, html: pdfHtml, agreement_id, status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[generate-agreement-pdf v2.0] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

