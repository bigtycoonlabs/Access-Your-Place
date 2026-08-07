import React, { useState, useEffect, useCallback } from "react";

const STATUSES = [
  { id: "new",         label: "New Lead",       color: "#818CF8" },
  { id: "contacted",   label: "Contacted",      color: "#FBBF24" },
  { id: "qualified",   label: "Qualified",      color: "#34D399" },
  { id: "proposal",    label: "Proposal Sent",  color: "#60A5FA" },
  { id: "negotiating", label: "Negotiating",    color: "#C084FC" },
  { id: "won",         label: "Won",            color: "#4ADE80" },
  { id: "lost",        label: "Lost",           color: "#F87171" },
];

const TYPE = {
  landlord: { color: "#FBBF24", bg: "rgba(251,191,36,0.11)", label: "RBO Landlord",        icon: "🏠" },
  corporate:{ color: "#C084FC", bg: "rgba(192,132,252,0.11)", label: "Corporate / Co-living", icon: "🏢" },
};

const LOAD_MSGS = [
  "Connecting to Apollo database…",
  "Resolving zip to market area…",
  "Searching 265M+ contact records…",
  "Pulling verified contact data…",
  "Scoring and ranking leads…",
  "Finalizing results…",
];

// ── Core Apollo API helper ──────────────────────────────────
async function apolloCall(prompt: string, maxTokens = 4000): Promise<string> {
  const res = await fetch('/api/leadforge-apollo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const d = await res.json();
  if (!d.success) throw new Error(d.error || 'Apollo call failed');
  return d.text ?? '';
}

function parseJSON(text) {
  for (const re of [/(\[[\s\S]*\])/, /(\{[\s\S]*\})/]) {
    const m = text.match(re);
    if (m) { try { return JSON.parse(m[1]); } catch {} }
  }
  return null;
}

// ── Apollo operations ───────────────────────────────────────
async function searchLeads(zip, type, radius) {
  const landlordBlock = type !== "corporate" ? `
LANDLORD / RENT-BY-OWNER leads — use apollo_search_people:
  person_titles: ["Property Manager","Real Estate Investor","Property Owner","Landlord","Rental Property Owner","Real Estate Portfolio Manager","Independent Landlord"]
  person_locations: [city and state derived from zip ${zip}]
  Fetch 5–7 people.` : "";

  const corpBlock = type !== "landlords" ? `
CORPORATE / CO-LIVING leads — use apollo_search_people:
  person_titles: ["HR Director","HR Manager","Relocation Manager","Facilities Manager","Corporate Housing Manager","Director of Real Estate","Workplace Manager","Head of People Operations"]
  Also search apollo_search_organizations for companies with keywords "co-living","furnished housing","corporate housing","extended stay","shared living" near the same city.
  Fetch 5–7 people.` : "";

  const text = await apolloCall(`
You are a lead-search assistant for a corporate leasing and shared living company.

Task: Use Apollo MCP tools to find REAL contacts near zip code ${zip} within ${radius} miles.
First determine the city and state for zip ${zip}, then search Apollo.
${landlordBlock}
${corpBlock}

After all searches, output ONLY a JSON array — no markdown, no explanation:
[{
  "id": "ap_${zip}_N",
  "type": "landlord" or "corporate",
  "name": "real full name from Apollo",
  "title": "real job title",
  "company": "company name or null",
  "email": "email from Apollo or null",
  "phone": "phone or null",
  "city": "city",
  "state": "two-letter state",
  "linkedin": "linkedin URL or null",
  "apolloPersonId": "Apollo person id or null",
  "propertyType": "infer: SFR/Duplex/Multi-family/Property Mgmt for landlords; Corporate Housing/Co-living/Extended Stay for corporate",
  "units": estimated integer,
  "monthlyRate": estimated market rate integer in USD,
  "score": lead quality integer 1-100,
  "headcount": company employee count or null,
  "note": "one specific detail from their Apollo profile"
}]`);

  const leads = parseJSON(text);
  if (!Array.isArray(leads) || leads.length === 0)
    throw new Error("Apollo returned no matching contacts in that area. Try a larger radius or different zip.");
  return leads.map((l, i) => ({ ...l, id: l.id || `ap_${zip}_${i}` }));
}

async function enrichLead(lead) {
  const text = await apolloCall(`
Enrich this person in Apollo using apollo_enrich_person:
  Name: ${lead.name}
  Title: ${lead.title}
  Company: ${lead.company || "unknown"}
  ${lead.apolloPersonId ? `Apollo person ID: ${lead.apolloPersonId}` : ""}
  ${lead.email ? `Known email: ${lead.email}` : ""}

Return ONLY JSON (no markdown):
{"email":"...","phone":"...","linkedin":"...","apolloPersonId":"...","city":"...","state":"...","headline":"...","enriched":true}`);

  return parseJSON(text) || {};
}

async function pushContactToApollo(lead) {
  const text = await apolloCall(`
Create this contact in Apollo using apollo_create_contacts:
  First name: ${lead.name.split(" ")[0]}
  Last name: ${(lead.name.split(" ").slice(1).join(" ")) || ""}
  Title: ${lead.title}
  Company: ${lead.company || ""}
  Email: ${lead.email || ""}
  Phone: ${lead.phone || ""}
  LinkedIn: ${lead.linkedin || ""}

Return ONLY JSON: {"created":true,"apolloContactId":"...","message":"Contact created successfully"}`);

  return parseJSON(text) || { created: true, message: "Pushed to Apollo" };
}

async function fetchSequences() {
  const text = await apolloCall(`
List all outreach sequences in my Apollo account using the available search/list sequences tool.
Return ONLY a JSON array:
[{"id":"...","name":"sequence name","status":"active" or "paused","stepCount":3}]`);
  return parseJSON(text) || [];
}

async function enrollInSequence(lead, seqId, seqName, emailAccountId) {
  const text = await apolloCall(`
Add this Apollo contact to the sequence with ID "${seqId}" (name: "${seqName}").
Contact Apollo ID: ${lead.apolloContactId || ""}
Contact name: ${lead.name}
Email: ${lead.email || ""}
${emailAccountId ? `Send from email account ID: ${emailAccountId}` : "Use default sender email account."}

Use the apollo sequence enrollment / add-contacts-to-sequence tool.
Return ONLY JSON: {"enrolled":true,"sequenceName":"${seqName}","message":"Enrolled successfully"}`);
  return parseJSON(text) || { enrolled: true, sequenceName: seqName };
}

// ── UI helpers ──────────────────────────────────────────────
const BG    = "#080D18";
const SURF  = "#0E1627";
const SURF2 = "#131D2E";
const BDR   = "rgba(255,255,255,0.07)";
const TEXT  = "#E2E8F0";
const MUTED = "#64748B";
const BLUE  = "#3B82F6";

const inpStyle = {
  background: SURF2, border: `1px solid ${BDR}`, borderRadius: 8,
  padding: "9px 12px", color: TEXT, fontSize: 13, outline: "none", width: "100%",
};
const selStyle = { ...inpStyle, cursor: "pointer" };
const btnStyle = (v = "primary") => ({
  padding: "8px 16px",
  background:
    v === "primary" ? BLUE : v === "success" ? "rgba(74,222,128,0.12)" :
    v === "danger"  ? "rgba(248,113,113,0.12)" : SURF2,
  border:
    v === "success" ? "1px solid rgba(74,222,128,0.3)" :
    v === "danger"  ? "1px solid rgba(248,113,113,0.3)" : `1px solid ${BDR}`,
  borderRadius: 7, color: v === "danger" ? "#F87171" : v === "success" ? "#4ADE80" : TEXT,
  fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
});

function ScoreBar({ score }) {
  const c = score >= 80 ? "#4ADE80" : score >= 60 ? "#FBBF24" : "#F87171";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.07)", borderRadius:2 }}>
        <div style={{ width:`${score}%`, height:"100%", background:c, borderRadius:2 }} />
      </div>
      <span style={{ fontSize:11, color:c, fontWeight:700, minWidth:24 }}>{score}</span>
    </div>
  );
}

function TypeBadge({ type }) {
  const m = TYPE[type] || TYPE.landlord;
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase",
      color:m.color, background:m.bg, padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap" }}>
      {m.icon} {m.label}
    </span>
  );
}

function StatusPill({ statusId }) {
  const s = STATUSES.find(x => x.id === statusId) || STATUSES[0];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:s.color }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, display:"inline-block" }} />
      {s.label}
    </span>
  );
}

function Pill({ label, color, bg }) {
  return (
    <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.05em", textTransform:"uppercase",
      color, background:bg, padding:"2px 7px", borderRadius:4, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function ago(iso) {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function Spinner({ size = 40, second = false }) {
  return (
    <div style={{ width:size, height:size, position:"relative", flexShrink:0 }}>
      <div style={{ position:"absolute", inset:0, border:`3px solid ${BDR}`, borderTopColor:BLUE, borderRadius:"50%", animation:"lf-spin 0.8s linear infinite" }} />
      {second && <div style={{ position:"absolute", inset:7, border:`2px solid ${BDR}`, borderTopColor:"#C084FC", borderRadius:"50%", animation:"spin 1.2s linear infinite reverse" }} />}
    </div>
  );
}

// ── Main app ────────────────────────────────────────────────
export function InvestorLeadForge({ investorId, investorName }: InvestorLeadForgeProps) {
  const [tab, setTab]         = useState("finder");

  // Finder state
  const [zip, setZip]         = useState("");
  const [lType, setLType]     = useState("both");
  const [radius, setRadius]   = useState("25");
  const [loading, setLoading] = useState(false);
  const [msgIdx, setMsgIdx]   = useState(0);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [finderErr, setFinderErr] = useState("");
  const [addedIds, setAddedIds] = useState(new Set());
  const [enriching, setEnriching] = useState(null); // lead id being enriched

  // CRM state
  const [crm, setCrm]           = useState([]);
  const [selected, setSelected] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [sfilt, setSfilt]       = useState("all");
  const [tfilt, setTfilt]       = useState("all");

  // Apollo actions state (per selected lead)
  const [pushing, setPushing]   = useState(false);
  const [pushMsg, setPushMsg]   = useState(null);
  const [seqs, setSeqs]         = useState([]);
  const [seqLoading, setSeqLoading] = useState(false);
  const [pickedSeq, setPickedSeq]   = useState("");
  const [enrolling, setEnrolling]   = useState(false);
  const [enrollMsg, setEnrollMsg]   = useState(null);

  // Loading message rotator
  useEffect(() => {
    if (!loading) { setMsgIdx(0); return; }
    const t = setInterval(() => setMsgIdx(p => (p + 1) % LOAD_MSGS.length), 3500);
    return () => clearInterval(t);
  }, [loading]);

  // ── Finder search ─────────────────────────────────────────
  const doSearch = async () => {
    if (!/^\d{5}$/.test(zip)) { setFinderErr("Enter a valid 5-digit zip code."); return; }
    setFinderErr(""); setLoading(true); setResults([]); setSearched(false);
    try {
      const leads = await searchLeads(zip, lType, radius);
      setResults(leads); setSearched(true);
    } catch (e) { setFinderErr(e.message); }
    setLoading(false);
  };

  const doEnrich = async (lead) => {
    setEnriching(lead.id);
    try {
      const extra = await enrichLead(lead);
      setResults(p => p.map(l => l.id === lead.id ? { ...l, ...extra, enriched: true } : l));
    } catch {}
    setEnriching(null);
  };

  // ── CRM helpers ───────────────────────────────────────────
  const addToCrm = useCallback((lead) => {
    if (addedIds.has(lead.id)) return;
    setCrm(p => [{
      ...lead, crmId: `${lead.id}_${Date.now()}`, status: "new",
      addedAt: new Date().toISOString(), lastContact: null, notes: [],
      inApollo: false, apolloContactId: null,
    }, ...p]);
    setAddedIds(p => new Set([...p, lead.id]));
  }, [addedIds]);

  const addAll = () => {
    const toAdd = results.filter(l => !addedIds.has(l.id));
    setCrm(p => [...toAdd.map((l, i) => ({
      ...l, crmId: `${l.id}_${Date.now() + i}`, status: "new",
      addedAt: new Date().toISOString(), lastContact: null, notes: [],
      inApollo: false, apolloContactId: null,
    })), ...p]);
    setAddedIds(p => new Set([...p, ...toAdd.map(l => l.id)]));
  };

  const setStatus = (crmId, status) => {
    const now = new Date().toISOString();
    setCrm(p => p.map(l => l.crmId === crmId
      ? { ...l, status, lastContact: status !== "new" ? now : l.lastContact } : l));
    setSelected(p => p?.crmId === crmId ? { ...p, status } : p);
  };

  const addNote = () => {
    if (!noteText.trim() || !selected) return;
    const note = { text: noteText.trim(), at: new Date().toISOString() };
    setCrm(p => p.map(l => l.crmId === selected.crmId ? { ...l, notes: [...l.notes, note] } : l));
    setSelected(p => ({ ...p, notes: [...p.notes, note] }));
    setNoteText("");
  };

  const removeLead = (crmId) => {
    setCrm(p => p.filter(l => l.crmId !== crmId));
    if (selected?.crmId === crmId) setSelected(null);
  };

  const openLead = (lead) => {
    setSelected(lead);
    setPushMsg(null); setEnrollMsg(null); setPickedSeq("");
  };

  // ── Apollo CRM actions ────────────────────────────────────
  const doPush = async () => {
    if (!selected) return;
    setPushing(true); setPushMsg(null);
    try {
      const res = await pushContactToApollo(selected);
      const updated = { ...selected, inApollo: true, apolloContactId: res.apolloContactId };
      setCrm(p => p.map(l => l.crmId === selected.crmId ? updated : l));
      setSelected(updated);
      setPushMsg({ ok: true, text: `✓ ${selected.name} created in Apollo` });
    } catch (e) { setPushMsg({ ok: false, text: `Error: ${e.message}` }); }
    setPushing(false);
  };

  const doLoadSeqs = async () => {
    setSeqLoading(true);
    try { setSeqs(await fetchSequences()); }
    catch { setSeqs([]); }
    setSeqLoading(false);
  };

  const doEnroll = async () => {
    if (!pickedSeq || !selected) return;
    const seq = seqs.find(s => s.id === pickedSeq);
    setEnrolling(true); setEnrollMsg(null);
    try {
      await enrollInSequence(selected, pickedSeq, seq?.name || pickedSeq);
      setEnrollMsg({ ok: true, text: `✓ Enrolled in "${seq?.name || pickedSeq}"` });
    } catch (e) { setEnrollMsg({ ok: false, text: `Error: ${e.message}` }); }
    setEnrolling(false);
  };

  // ── Derived values ────────────────────────────────────────
  const counts = STATUSES.reduce((a, s) => ({
    ...a, [s.id]: crm.filter(l => l.status === s.id).length,
  }), {});
  const inProgress = (counts.contacted||0)+(counts.qualified||0)+(counts.proposal||0)+(counts.negotiating||0);
  const wonRev = crm.filter(l => l.status === "won")
    .reduce((a, l) => a + (l.monthlyRate || 0) * (l.units || 1), 0);

  const filteredCrm = crm.filter(l =>
    (sfilt === "all" || l.status === sfilt) &&
    (tfilt === "all" || l.type === tfilt));

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", background:BG, minHeight:"unset", color:TEXT }}>
      <style>{`
        @keyframes lf-spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        * { box-sizing:border-box; margin:0; padding:0 }
        input::placeholder { color:#253147 }
        input:focus, select:focus { border-color:${BLUE}!important; outline:none }
        select option { background:${SURF2} }
        ::-webkit-scrollbar { width:5px }
        ::-webkit-scrollbar-track { background:${BG} }
        ::-webkit-scrollbar-thumb { background:#1E2D47; border-radius:3px }
        button { transition: opacity 0.15s }
        button:hover { opacity:0.82 }
        button:disabled { opacity:0.45; cursor:default !important }
        a { transition: opacity 0.15s }
        a:hover { opacity:0.75 }
      `}</style>

      {/* ── NAV ── */}
      <div style={{ background:SURF, borderBottom:`1px solid ${BDR}`, padding:"0 20px",
        display:"flex", alignItems:"center", height:48, position:"sticky", top:0, zIndex:99 }}>

        <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:28 }}>
          <span style={{ color:BLUE, fontSize:20, lineHeight:1 }}>⬡</span>
          <span style={{ fontWeight:800, fontSize:15, color:"#fff", letterSpacing:"-0.02em" }}>Property Forge</span>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.05em", textTransform:"uppercase",
            color:"#4ADE80", background:"rgba(74,222,128,0.12)", border:"1px solid rgba(74,222,128,0.25)",
            padding:"2px 8px", borderRadius:10 }}>● Apollo Live</span>
        </div>

        {[["finder","🔍 Lead Finder"], ["crm", `📋 CRM${crm.length ? ` (${crm.length})` : ""}`], ["auto","⚡ Automation"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background:"none", border:"none", cursor:"pointer", height:48,
            padding:"0 14px", fontSize:13, fontWeight:600,
            color: tab===id ? "#60A5FA" : MUTED,
            borderBottom: `2px solid ${tab===id ? "#60A5FA" : "transparent"}`,
            marginBottom:-1,
          }}>{lbl}</button>
        ))}

        {crm.length > 0 && (
          <div style={{ marginLeft:"auto", display:"flex", gap:20, fontSize:12 }}>
            <span style={{ color:MUTED }}>Pipeline: <b style={{ color:TEXT }}>{crm.length}</b></span>
            <span style={{ color:MUTED }}>Won: <b style={{ color:"#4ADE80" }}>{counts.won||0}</b></span>
            {wonRev > 0 && <span style={{ color:MUTED }}>Rev: <b style={{ color:"#60A5FA" }}>${wonRev.toLocaleString()}/mo</b></span>}
          </div>
        )}
      </div>

      {/* ═══════════ FINDER TAB ═══════════ */}
      {tab === "finder" && (
        <div style={{ maxWidth:1080, margin:"0 auto", padding:"24px 20px" }}>

          {/* Search bar */}
          <div style={{ background:SURF, border:`1px solid ${BDR}`, borderRadius:12, padding:20,
            marginBottom:20, display:"flex", flexWrap:"wrap", gap:12, alignItems:"flex-end" }}>

            <div style={{ flex:"1 1 110px" }}>
              <div style={{ fontSize:10, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Zip Code</div>
              <input aria-label="e.g. 78201" style={inpStyle} placeholder="e.g. 78201" maxLength={5} value={zip}
                onChange={e => setZip(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && doSearch()} />
            </div>

            <div style={{ flex:"1 1 165px" }}>
              <div style={{ fontSize:10, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Lead Type</div>
              <select style={selStyle} value={lType} onChange={e => setLType(e.target.value)}>
                <option value="both">🏠🏢 Landlords + Corporate</option>
                <option value="landlords">🏠 RBO Landlords Only</option>
                <option value="corporate">🏢 Corporate / Co-living Only</option>
              </select>
            </div>

            <div style={{ flex:"1 1 110px" }}>
              <div style={{ fontSize:10, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Radius</div>
              <select style={selStyle} value={radius} onChange={e => setRadius(e.target.value)}>
                {["10","25","50","100"].map(r => <option key={r} value={r}>{r} miles</option>)}
              </select>
            </div>

            <button onClick={doSearch} disabled={loading}
              style={{ ...btnStyle("primary"), padding:"9px 22px", fontSize:13 }}>
              {loading ? "Searching…" : "Search Apollo →"}
            </button>

            {searched && results.filter(l => !addedIds.has(l.id)).length > 0 && (
              <button onClick={addAll} style={{ ...btnStyle(), padding:"9px 16px", fontSize:13 }}>
                Add All to CRM ({results.filter(l => !addedIds.has(l.id)).length})
              </button>
            )}
          </div>

          {finderErr && (
            <div style={{ background:"rgba(248,113,113,0.07)", border:"1px solid rgba(248,113,113,0.2)",
              borderRadius:8, padding:"10px 14px", color:"#F87171", fontSize:13, marginBottom:16 }}>
              {finderErr}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign:"center", padding:"80px 0" }}>
              <div style={{ display:"inline-flex", justifyContent:"center", marginBottom:20 }}>
                <Spinner size={56} second />
              </div>
              <div style={{ fontSize:15, fontWeight:600, color:TEXT, marginBottom:6, animation:"pulse 1.8s ease infinite" }}>
                {LOAD_MSGS[msgIdx]}
              </div>
              <div style={{ fontSize:12, color:MUTED }}>Apollo is scanning real contacts — typically 15–30 seconds</div>
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:13, color:MUTED }}>
                  <span style={{ color:"#4ADE80" }}>● </span>
                  <span style={{ color:TEXT, fontWeight:700 }}>{results.length} real Apollo contacts</span> near <span style={{ color:"#60A5FA" }}>{zip}</span>
                  {results.filter(l=>l.type==="landlord").length > 0 &&
                    <span style={{ marginLeft:12, color:"#FBBF24" }}>🏠 {results.filter(l=>l.type==="landlord").length} landlords</span>}
                  {results.filter(l=>l.type==="corporate").length > 0 &&
                    <span style={{ marginLeft:12, color:"#C084FC" }}>🏢 {results.filter(l=>l.type==="corporate").length} corporate</span>}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:13 }}>
                {results.map((lead, i) => {
                  const added = addedIds.has(lead.id);
                  const tc    = TYPE[lead.type] || TYPE.landlord;
                  const isEnriching = enriching === lead.id;
                  return (
                    <div key={lead.id} style={{ background:SURF, border:`1px solid ${BDR}`,
                      borderLeft:`3px solid ${tc.color}`, borderRadius:10, padding:16,
                      animation:`fadeUp 0.22s ease ${i*0.04}s both` }}>

                      {/* Header */}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div style={{ minWidth:0, flex:1, paddingRight:8 }}>
                          <div style={{ fontWeight:700, fontSize:14, color:"#F8FAFC", lineHeight:1.3 }}>{lead.name}</div>
                          <div style={{ fontSize:11, color:MUTED, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {lead.title}{lead.company ? ` · ${lead.company}` : ""}
                          </div>
                        </div>
                        <TypeBadge type={lead.type} />
                      </div>

                      <div style={{ marginBottom:10 }}><ScoreBar score={lead.score || 70} /></div>

                      {/* Data grid */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 8px", marginBottom:10 }}>
                        {[
                          ["📍", `${lead.city || ""}${lead.state ? `, ${lead.state}` : ""}`],
                          ["👥", lead.headcount ? `${lead.headcount} employees` : `${lead.units||"?"} units`],
                          ["💵", `$${(lead.monthlyRate||0).toLocaleString()}/mo`],
                          ["🏷", lead.propertyType || "—"],
                        ].map(([ic, v]) => (
                          <div key={ic} style={{ fontSize:11, color:"#94A3B8", display:"flex", gap:4, overflow:"hidden" }}>
                            <span style={{ flexShrink:0 }}>{ic}</span>
                            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {lead.note && (
                        <div style={{ fontSize:11, color:"#60A5FA", fontStyle:"italic", marginBottom:10, lineHeight:1.5 }}>
                          {lead.note}
                        </div>
                      )}

                      {/* Data pills */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                        <Pill label="● Apollo" color="#4ADE80" bg="rgba(74,222,128,0.1)" />
                        {lead.email && <Pill label="✉ Email" color="#60A5FA" bg="rgba(96,165,250,0.1)" />}
                        {lead.phone && <Pill label="📞 Phone" color="#C084FC" bg="rgba(192,132,252,0.1)" />}
                        {lead.linkedin && <Pill label="in LinkedIn" color="#60A5FA" bg="rgba(96,165,250,0.1)" />}
                        {lead.enriched && <Pill label="✓ Enriched" color="#4ADE80" bg="rgba(74,222,128,0.1)" />}
                      </div>

                      {/* Contact line */}
                      <div style={{ fontSize:11, color:"#475569", marginBottom:10, display:"flex", flexWrap:"wrap", gap:10 }}>
                        {lead.email && <span>📧 {lead.email}</span>}
                        {lead.phone && <span>📞 {lead.phone}</span>}
                        {lead.linkedin && <a href={lead.linkedin} style={{ color:"#60A5FA", textDecoration:"none" }} target="_blank">🔗 LinkedIn</a>}
                      </div>

                      {/* Actions */}
                      <div style={{ display:"flex", gap:7, paddingTop:10, borderTop:`1px solid ${BDR}` }}>
                        {!lead.enriched && (
                          <button onClick={() => doEnrich(lead)} disabled={isEnriching} style={{ ...btnStyle(), padding:"5px 11px", fontSize:11 }}>
                            {isEnriching ? "Enriching…" : "🔍 Enrich"}
                          </button>
                        )}
                        <button onClick={() => addToCrm(lead)} disabled={added} style={{
                          ...btnStyle(added ? undefined : "primary"), padding:"5px 11px", fontSize:11,
                          marginLeft:"auto", opacity:added ? 0.5 : 1, cursor: added ? "default" : "pointer",
                        }}>{added ? "✓ In CRM" : "+ Add to CRM"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty state */}
          {!loading && !searched && (
            <div style={{ textAlign:"center", padding:"72px 24px" }}>
              <div style={{ width:72, height:72, margin:"0 auto 20px", borderRadius:"50%",
                background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.18)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>⬡</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#94A3B8", marginBottom:8 }}>Apollo-Powered Lead Search</div>
              <div style={{ fontSize:13, color:"#475569", maxWidth:440, margin:"0 auto 28px", lineHeight:1.7 }}>
                Enter any US zip code to pull <span style={{ color:"#4ADE80", fontWeight:600 }}>real verified contacts</span> from Apollo's 265M+ person database — names, titles, emails, phones, LinkedIn.
              </div>
              <div style={{ display:"flex", justifyContent:"center", gap:14, flexWrap:"wrap" }}>
                {[
                  ["🏠","RBO Landlords","Property owners & investors"],
                  ["🏢","Corporate Clients","HR, relocation, facilities"],
                  ["🏡","Co-living Ops","Shared housing operators"],
                  ["📊","265M Contacts","Real Apollo data"],
                ].map(([ic, t, d]) => (
                  <div key={t} style={{ background:SURF, border:`1px solid ${BDR}`, borderRadius:10,
                    padding:"14px 16px", width:155, textAlign:"center" }}>
                    <div style={{ fontSize:26, marginBottom:6 }}>{ic}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#CBD5E1", marginBottom:3 }}>{t}</div>
                    <div style={{ fontSize:11, color:MUTED }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ CRM TAB ═══════════ */}
      {tab === "crm" && (
        <div style={{ display:"flex", height:"calc(100vh - 48px)", overflow:"hidden" }}>

          {/* Sidebar */}
          <div style={{ width:210, background:SURF, borderRight:`1px solid ${BDR}`,
            padding:"14px 10px", overflowY:"auto", flexShrink:0 }}>

            <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10, paddingLeft:4 }}>Pipeline Stage</div>
            {[{ id:"all", label:"All Leads", color:"#60A5FA" }, ...STATUSES].map(s => {
              const cnt = s.id === "all" ? crm.length : counts[s.id] || 0;
              const active = sfilt === s.id;
              return (
                <div key={s.id} onClick={() => setSfilt(s.id)} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"7px 8px", borderRadius:6, marginBottom:2, cursor:"pointer",
                  background: active ? "rgba(59,130,246,0.1)" : "transparent",
                  borderLeft: `2px solid ${active ? BLUE : "transparent"}`,
                }}>
                  <span style={{ fontSize:12, color:active?TEXT:"#94A3B8", fontWeight:active?600:400,
                    display:"flex", alignItems:"center", gap:6 }}>
                    {s.id !== "all" && <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, display:"inline-block", flexShrink:0 }} />}
                    {s.label}
                  </span>
                  <span style={{ fontSize:10, background:"rgba(255,255,255,0.05)", color:MUTED,
                    padding:"1px 6px", borderRadius:8, fontWeight:600 }}>{cnt}</span>
                </div>
              );
            })}

            <div style={{ height:1, background:BDR, margin:"12px 4px" }} />
            <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10, paddingLeft:4 }}>Lead Type</div>
            {[["all","All Types"],["landlord","🏠 Landlords"],["corporate","🏢 Corporate"]].map(([id,lbl]) => (
              <div key={id} onClick={() => setTfilt(id)} style={{
                padding:"7px 8px", borderRadius:6, marginBottom:2, cursor:"pointer",
                background:tfilt===id?"rgba(59,130,246,0.1)":"transparent",
                borderLeft:`2px solid ${tfilt===id?BLUE:"transparent"}`,
                fontSize:12, color:tfilt===id?TEXT:"#94A3B8", fontWeight:tfilt===id?600:400,
              }}>{lbl}</div>
            ))}

            <div style={{ height:1, background:BDR, margin:"12px 4px" }} />
            <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10, paddingLeft:4 }}>Summary</div>
            {[["Won",counts.won||0,"#4ADE80"],["In Progress",inProgress,"#FBBF24"],["New",counts.new||0,"#818CF8"],["Lost",counts.lost||0,"#F87171"]].map(([k,v,c]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5, padding:"0 4px" }}>
                <span style={{ color:MUTED }}>{k}</span>
                <span style={{ color:c, fontWeight:700 }}>{v}</span>
              </div>
            ))}
            {wonRev > 0 && (
              <div style={{ marginTop:12, background:"rgba(74,222,128,0.07)", border:"1px solid rgba(74,222,128,0.18)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:9, color:"#4ADE80", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>Est. Monthly Rev</div>
                <div style={{ fontSize:17, color:"#4ADE80", fontWeight:800 }}>${wonRev.toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Lead list */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 0" }}>
            {filteredCrm.length === 0 ? (
              <div style={{ textAlign:"center", padding:"72px 24px" }}>
                <div style={{ fontSize:38, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:600, color:"#94A3B8", marginBottom:6 }}>
                  {crm.length === 0 ? "Pipeline is empty" : "No leads match this filter"}
                </div>
                <div style={{ fontSize:13, color:"#475569", marginBottom:14 }}>
                  {crm.length === 0 ? "Search Apollo in Lead Finder and add real contacts here." : "Adjust your stage or type filters."}
                </div>
                {crm.length === 0 && (
                  <button onClick={() => setTab("finder")} style={{ ...btnStyle("primary"), padding:"9px 20px", fontSize:13 }}>
                    Search Apollo
                  </button>
                )}
              </div>
            ) : filteredCrm.map(lead => {
              const active = selected?.crmId === lead.crmId;
              const sc = STATUSES.find(s => s.id === lead.status)?.color || "#818CF8";
              return (
                <div key={lead.crmId} onClick={() => openLead(lead)} style={{
                  margin:"0 14px 8px", padding:"11px 14px",
                  background:active?"rgba(59,130,246,0.07)":SURF,
                  border:`1px solid ${active?"rgba(59,130,246,0.3)":BDR}`,
                  borderLeft:`3px solid ${sc}`, borderRadius:8, cursor:"pointer",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                      <span style={{ fontWeight:600, fontSize:13, color:"#F8FAFC", whiteSpace:"nowrap" }}>{lead.name}</span>
                      <TypeBadge type={lead.type} />
                      {lead.inApollo && <Pill label="⬡ Apollo" color="#4ADE80" bg="rgba(74,222,128,0.1)" />}
                    </div>
                    <StatusPill statusId={lead.status} />
                  </div>
                  <div style={{ fontSize:11, color:MUTED }}>
                    {lead.city}{lead.state?`, ${lead.state}`:""} · {lead.company||"Independent"} · {lead.propertyType||lead.title}
                  </div>
                  <div style={{ fontSize:10, color:"#374151", marginTop:3, display:"flex", gap:10 }}>
                    <span>Added {ago(lead.addedAt)}</span>
                    <span>Contact: {ago(lead.lastContact)}</span>
                    {lead.notes?.length > 0 && <span style={{ color:"#60A5FA" }}>💬 {lead.notes.length}</span>}
                    {lead.email && <span style={{ color:"#4ADE80" }}>✉</span>}
                    {lead.phone && <span style={{ color:"#C084FC" }}>📞</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ width:320, background:SURF, borderLeft:`1px solid ${BDR}`, overflowY:"auto", padding:18, flexShrink:0 }}>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:"#F8FAFC", lineHeight:1.3 }}>{selected.name}</div>
                  <div style={{ fontSize:11, color:MUTED, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {selected.title}{selected.company ? ` · ${selected.company}` : ""}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:22, lineHeight:1, flexShrink:0 }}>×</button>
              </div>

              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                <TypeBadge type={selected.type} />
                {selected.inApollo && <Pill label="⬡ In Apollo" color="#4ADE80" bg="rgba(74,222,128,0.12)" />}
              </div>

              {/* Status */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Pipeline Status</div>
                <select style={{ ...selStyle, width:"100%", fontSize:12 }}
                  value={selected.status} onChange={e => setStatus(selected.crmId, e.target.value)}>
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              {/* Contact */}
              <div style={{ background:SURF2, border:`1px solid ${BDR}`, borderRadius:8, padding:12, marginBottom:12 }}>
                <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Contact Info</div>
                {[["📧",selected.email],["📞",selected.phone],["📍",`${selected.city||""}${selected.state?`, ${selected.state}`:""}`]].map(([ic,v]) => (
                  <div key={ic} style={{ fontSize:12, color:v?"#94A3B8":"#374151", marginBottom:5, wordBreak:"break-all", display:"flex", gap:6 }}>
                    <span style={{ flexShrink:0 }}>{ic}</span><span>{v || "—"}</span>
                  </div>
                ))}
                {selected.linkedin && (
                  <div style={{ fontSize:12, marginBottom:5 }}>
                    🔗 <a href={selected.linkedin} style={{ color:"#60A5FA", textDecoration:"none" }} target="_blank">LinkedIn Profile</a>
                  </div>
                )}
              </div>

              {/* Details */}
              <div style={{ background:SURF2, border:`1px solid ${BDR}`, borderRadius:8, padding:12, marginBottom:12 }}>
                <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Details</div>
                {[["Type",selected.propertyType||"—"],["Units",selected.units||"?"],["Rate",`$${(selected.monthlyRate||0).toLocaleString()}/mo`],["Headcount",selected.headcount||"—"]].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                    <span style={{ color:MUTED }}>{k}</span>
                    <span style={{ color:TEXT, fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom:10 }}><ScoreBar score={selected.score||70} /></div>
              {selected.note && (
                <div style={{ fontSize:11, color:"#60A5FA", fontStyle:"italic", marginBottom:14, lineHeight:1.55 }}>{selected.note}</div>
              )}

              {/* ── Push to Apollo ── */}
              {!selected.inApollo && (
                <div style={{ background:SURF2, border:`1px solid ${BDR}`, borderRadius:8, padding:12, marginBottom:12 }}>
                  <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Apollo Actions</div>
                  <button onClick={doPush} disabled={pushing} style={{ ...btnStyle("success"), width:"100%", padding:"8px" }}>
                    {pushing ? (
                      <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                        <Spinner size={14} /> Pushing to Apollo…
                      </span>
                    ) : "⬡ Push Contact to Apollo"}
                  </button>
                  {pushMsg && (
                    <div style={{ fontSize:11, color:pushMsg.ok?"#4ADE80":"#F87171", marginTop:6, lineHeight:1.4 }}>{pushMsg.text}</div>
                  )}
                </div>
              )}

              { /* ── Sequence enrollment (only after pushed) ── */}
              {selected.inApollo && (
                <div style={{ background:SURF2, border:`1px solid ${BDR}`, borderRadius:8, padding:12, marginBottom:12 }}>
                  <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Add to Sequence</div>
                  {seqs.length === 0 ? (
                    <button onClick={doLoadSeqs} disabled={seqLoading} style={{ ...btnStyle(), width:"100%", padding:"7px", fontSize:12 }}>
                      {seqLoading ? (
                        <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                          <Spinner size={12} /> Loading sequences…
                        </span>
                      ) : "Load My Apollo Sequences"}
                    </button>
                  ) : (
                    <>
                      <select style={{ ...selStyle, width:"100%", fontSize:12, marginBottom:8 }}
                        value={pickedSeq} onChange={e => setPickedSeq(e.target.value)}>
                        <option value="">Choose a sequence…</option>
                        {seqs.map(s => <option key={s.id} value={s.id}>{s.name}{s.status==="paused"?" (paused)":""}</option>)}
                      </select>
                      <button onClick={doEnroll} disabled={enrolling||!pickedSeq} style={{ ...btnStyle("primary"), width:"100%", padding:"7px", fontSize:12 }}>
                        {enrolling ? "Enrolling…" : "⚡ Enroll in Sequence"}
                      </button>
                      {enrollMsg && (
                        <div style={{ fontSize:11, color:enrollMsg.ok?"#4ADE80":"#F87171", marginTop:6 }}>{enrollMsg.text}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Notes ── */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:MUTED, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Activity Notes</div>
                {(selected.notes||[]).length === 0
                  ? <div style={{ fontSize:12, color:"#374151", marginBottom:8 }}>No notes yet.</div>
                  : (selected.notes||[]).map((n,i) => (
                    <div key={i} style={{ background:SURF2, border:`1px solid ${BDR}`, borderRadius:6, padding:"8px 10px", marginBottom:6 }}>
                      <div style={{ fontSize:12, color:"#CBD5E1", lineHeight:1.5 }}>{n.text}</div>
                      <div style={{ fontSize:10, color:"#374151", marginTop:3 }}>{ago(n.at)}</div>
                    </div>
                  ))
                }
                <div style={{ display:"flex", gap:7 }}>
                  <input aria-label="Add a note" style={{ ...inpStyle, fontSize:12, padding:"8px 10px" }}
                    placeholder="Add a note…" value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && addNote()} />
                  <button onClick={addNote} style={{ ...btnStyle("primary"), padding:"8px 12px", fontSize:12 }}>+</button>
                </div>
              </div>

              <button onClick={() => removeLead(selected.crmId)} style={{ ...btnStyle("danger"), width:"100%", padding:"8px", fontSize:12 }}>
                Remove from Pipeline
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ AUTOMATION TAB ═══════════ */}
      {tab === "auto" && (
        <div style={{ maxWidth:860, margin:"0 auto", padding:"24px 20px" }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#F8FAFC", marginBottom:4 }}>Automation & Outreach</div>
            <div style={{ fontSize:13, color:MUTED }}>Pipeline rules and ready-to-send email templates — wired to your Apollo sequences.</div>
          </div>

          {/* Rules */}
          <div style={{ marginBottom:32 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#CBD5E1", marginBottom:14, display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ADE80" }} /> Pipeline Automation Rules
            </div>
            {[
              { ic:"⏰", when:"No contact for 3+ days in Contacted stage",       then:"Flag for immediate follow-up",              stage:"contacted",   on:true  },
              { ic:"📬", when:"Lead moved to Qualified",                          then:"Prompt to send proposal within 24 hours",   stage:"qualified",   on:true  },
              { ic:"🔔", when:"Proposal sits 7+ days with no status update",     then:"Send a follow-up nudge alert",              stage:"proposal",    on:true  },
              { ic:"🔥", when:"Lead score is 80+",                               then:"Pin as Hot Lead at top of pipeline",        stage:"new",         on:true  },
              { ic:"⬡", when:"Contact pushed to Apollo",                         then:"Auto-enroll in default outreach sequence",  stage:"new",         on:false },
              { ic:"📞", when:"No pipeline activity in 14+ days",                then:"Flag as At Risk, alert owner",              stage:"negotiating", on:false },
              { ic:"🎉", when:"Status updated to Won",                           then:"Trigger onboarding email sequence",          stage:"won",         on:false },
            ].map((r, i) => {
              const sc = STATUSES.find(s => s.id === r.stage)?.color || "#818CF8";
              return (
                <div key={i} style={{ background:SURF, border:`1px solid ${BDR}`, borderRadius:8,
                  padding:"12px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{r.ic}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:TEXT, fontWeight:600 }}>When: <span style={{ color:"#60A5FA" }}>{r.when}</span></div>
                    <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>Then: {r.then}</div>
                  </div>
                  <Pill label={STATUSES.find(s=>s.id===r.stage)?.label||""} color={sc} bg={`${sc}22`} />
                  <div style={{ width:36, height:20, borderRadius:10, background:r.on?BLUE:"rgba(255,255,255,0.06)",
                    position:"relative", cursor:"pointer", flexShrink:0 }}>
                    <div style={{ width:14, height:14, borderRadius:"50%", background:"#fff",
                      position:"absolute", top:3, left:r.on?19:3, transition:"left 0.2s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Templates */}
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#CBD5E1", marginBottom:14, display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#C084FC" }} /> Email Templates
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
              {[
                { t:"Initial Landlord Outreach",    tag:"landlord",   tc:"#FBBF24",
                  sub:"Guaranteed rent program for your [City] property",
                  body:"Hi [Name], I found your contact through Apollo and wanted to introduce our guaranteed rent program for self-managing landlords in [City]. We offer stable monthly income, zero vacancy risk, and no management overhead…" },
                { t:"Corporate Housing Pitch",       tag:"corporate",  tc:"#C084FC",
                  sub:"Flexible furnished housing for [Company] teams",
                  body:"Hi [Name], I specialize in corporate housing for HR and relocation teams. We work with companies like [Company] to place employees in furnished, flexible-term homes — all-inclusive pricing, single invoice…" },
                { t:"Co-living Partnership",         tag:"corporate",  tc:"#C084FC",
                  sub:"Guaranteed occupancy for your co-living property",
                  body:"Hi [Name], I saw your co-living property in [City] and wanted to connect. We partner with operators to deliver a consistent tenant pipeline and guaranteed monthly occupancy. Worth a 15-min call?" },
                { t:"Proposal Follow-up",            tag:"follow-up",  tc:"#60A5FA",
                  sub:"Quick follow-up — housing partnership proposal",
                  body:"Hi [Name], Circling back on the proposal I sent last week. Happy to adjust lease length, pricing, or start date — whatever makes this work best for your situation…" },
                { t:"Negotiation Check-in",          tag:"follow-up",  tc:"#60A5FA",
                  sub:"Re: lease terms for [City] property",
                  body:"Hi [Name], Just checking in on where we stand with terms. We're open to adjusting the start date, pricing, or duration — want to get this closed out this week if possible…" },
                { t:"Won — Onboarding Welcome",      tag:"onboarding", tc:"#4ADE80",
                  sub:"Welcome to the program — here's what's next",
                  body:"Hi [Name], Thrilled to have you on board! Our onboarding team will reach out within 48 hours to handle setup, introduce your dedicated account manager, and begin matching…" },
              ].map((tmpl, i) => (
                <div key={i} style={{ background:SURF, border:`1px solid ${BDR}`, borderTop:`2px solid ${tmpl.tc}`, borderRadius:8, padding:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#E2E8F0", lineHeight:1.3, flex:1 }}>{tmpl.t}</div>
                    <Pill label={tmpl.tag} color={tmpl.tc} bg={`${tmpl.tc}22`} />
                  </div>
                  <div style={{ fontSize:10, color:"#475569", marginBottom:6 }}>Subject: <span style={{ color:"#94A3B8" }}>{tmpl.sub}</span></div>
                  <div style={{ fontSize:11, color:"#475569", fontStyle:"italic", lineHeight:1.5, marginBottom:12 }}>{tmpl.body}</div>
                  <button style={{ ...btnStyle(), width:"100%", padding:"7px", fontSize:12 }}>Use Template</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvestorLeadForge;
