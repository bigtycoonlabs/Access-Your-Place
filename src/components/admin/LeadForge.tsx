import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Lead = {
  id: string;
  type: "landlord" | "corporate";
  name: string;
  title?: string;
  company?: string | null;
  availableEmail?: string | null;
  availablePhone?: string | null;
  city?: string;
  state?: string;
  linkedin?: string | null;
  apolloPersonId?: string | null;
  apolloContactId?: string | null;
  propertyType?: string;
  units?: number;
  monthlyRate?: number;
  score?: number;
  headcount?: number | null;
  note?: string;
  status?: string;
  inApollo?: boolean;
};

const statusLabels: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", proposal: "Proposal", negotiating: "Negotiating", won: "Won", lost: "Lost" };
const statuses = Object.keys(statusLabels);

function parseJSON(text: string) {
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  for (const match of [arrayMatch, objectMatch]) {
    if (match) { try { return JSON.parse(match[0]); } catch {} }
  }
  return null;
}

async function apolloCall(prompt: string, maxTokens = 4000) {
  const { data, error } = await supabase.functions.invoke("apollo-leadforge", { body: { prompt, maxTokens } });
  if (error) throw new Error(error.message || "Apollo proxy request failed");
  if (data?.error) throw new Error(data.error);
  if (typeof data?.text !== "string") throw new Error("Apollo proxy returned an invalid response");
  return data.text;
}

async function searchLeads(zip: string, leadType: string, radius: string): Promise<Lead[]> {
  const landlord = leadType !== "corporate" ? `Search the connected Apollo workspace for people titled Property Manager, Real Estate Investor, Property Owner, Landlord, Rental Property Owner near zip ${zip}.` : "";
  const corporate = leadType !== "landlords" ? `Search the connected Apollo workspace for people titled HR Director, Relocation Manager, Facilities Manager, Corporate Housing Manager, Director of Real Estate, Head of People Operations near zip ${zip}. Also search organizations for co-living, furnished housing, corporate housing, extended stay, shared living.` : "";
  const text = await apolloCall(`Use Apollo MCP tools to find Access Your Place leasing prospects from the connected Apollo workspace within ${radius} miles of ${zip}. ${landlord} ${corporate}\nReturn ONLY JSON array with fields: id,type,name,title,company,availableEmail,availablePhone,city,state,linkedin,apolloPersonId,propertyType,units,monthlyRate,score,headcount,note.`);
  const parsed = parseJSON(text);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Apollo returned no matching prospects. Try a larger radius or another zip.");
  return parsed.map((lead, i) => ({ ...lead, id: lead.id || `ap_${zip}_${i}` }));
}

async function enrichLead(lead: Lead) {
  const text = await apolloCall(`Enrich this Apollo workspace person and return ONLY JSON: ${JSON.stringify(lead)}`);
  return parseJSON(text) || {};
}

async function pushToApollo(lead: Lead) {
  const text = await apolloCall(`Create this Apollo workspace contact using apollo_create_contacts and return ONLY JSON {"created":true,"apolloContactId":"..."}: ${JSON.stringify(lead)}`);
  return parseJSON(text) || { created: true };
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "green" | "amber" | "red" }) {
  const tones = { slate: "bg-slate-800 text-slate-200", blue: "bg-blue-900 text-blue-100", green: "bg-emerald-900 text-emerald-100", amber: "bg-amber-900 text-amber-100", red: "bg-red-900 text-red-100" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export default function LeadForge() {
  const [zip, setZip] = useState("");
  const [leadType, setLeadType] = useState("both");
  const [radius, setRadius] = useState("25");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [crm, setCrm] = useState<Lead[]>([]);
  const [active, setActive] = useState<Lead | null>(null);

  const runSearch = async () => {
    if (!/^\d{5}$/.test(zip)) return setError("Enter a valid 5-digit zip code.");
    setLoading(true); setError(""); setResults([]);
    try { setResults(await searchLeads(zip, leadType, radius)); }
    catch (err: any) { setError(err?.message || "Apollo search failed"); }
    finally { setLoading(false); }
  };

  const saveLead = (lead: Lead) => {
    if (crm.some(item => item.id === lead.id)) return;
    const saved = { ...lead, status: "new", inApollo: false };
    setCrm(prev => [saved, ...prev]); setActive(saved);
  };
  const updateActive = (lead: Lead) => { setActive(lead); setCrm(prev => prev.map(item => item.id === lead.id ? lead : item)); };

  return <div className="min-h-screen bg-[#080D18] p-4 text-slate-100"><div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-2xl border border-white/10 bg-[#0E1627] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-2xl font-black">LeadForge</h2><Badge tone="green">Apollo Live</Badge></div><p className="text-sm text-slate-400">Back-office Apollo workspace prospect finder and lightweight CRM for Access Your Place acquisitions.</p></div><div className="text-sm text-slate-300">CRM: <b>{crm.length}</b> · Won: <b>{crm.filter(l => l.status === "won").length}</b></div></div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"><input className="rounded-lg border border-white/10 bg-[#131D2E] px-3 py-2" placeholder="Zip code" value={zip} maxLength={5} onChange={e => setZip(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && runSearch()} /><select className="rounded-lg border border-white/10 bg-[#131D2E] px-3 py-2" value={leadType} onChange={e => setLeadType(e.target.value)}><option value="both">Landlords + Corporate</option><option value="landlords">Landlords Only</option><option value="corporate">Corporate Only</option></select><select className="rounded-lg border border-white/10 bg-[#131D2E] px-3 py-2" value={radius} onChange={e => setRadius(e.target.value)}>{["10","25","50","100"].map(r => <option key={r} value={r}>{r} miles</option>)}</select><button className="rounded-lg bg-blue-600 px-5 py-2 font-bold disabled:opacity-50" onClick={runSearch} disabled={loading}>{loading ? "Searching…" : "Search Apollo"}</button></div>
      {error && <div className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-100">{error}</div>}
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#0E1627] p-5"><h3 className="mb-3 font-bold">Apollo Workspace Results</h3>{loading ? <p className="py-12 text-center text-slate-400">Searching Apollo…</p> : results.length === 0 ? <p className="py-12 text-center text-slate-500">Search a market to find prospects.</p> : <div className="grid gap-3 md:grid-cols-2">{results.map(lead => <article key={lead.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="mb-2 flex justify-between gap-2"><div><h4 className="font-bold">{lead.name}</h4><p className="text-xs text-slate-400">{lead.title || "—"}{lead.company ? ` · ${lead.company}` : ""}</p></div><Badge tone={lead.type === "landlord" ? "amber" : "blue"}>{lead.type}</Badge></div><p className="text-xs text-slate-300">📍 {lead.city || "—"}{lead.state ? `, ${lead.state}` : ""} · ⭐ {lead.score || 70}/100</p><p className="my-2 text-xs italic text-blue-200">{lead.note || lead.propertyType || "Apollo match"}</p><div className="mb-3 text-xs text-slate-400">{lead.availableEmail || "No email on file"} {lead.availablePhone ? ` · ${lead.availablePhone}` : ""}</div><div className="flex gap-2"><button className="rounded border border-white/10 px-3 py-1 text-xs" onClick={async () => setResults(prev => prev.map(item => item.id === lead.id ? { ...item, ...(await enrichLead(lead)) } : item))}>Enrich</button><button className="ml-auto rounded bg-blue-600 px-3 py-1 text-xs font-bold" onClick={() => saveLead(lead)}>Add to CRM</button></div></article>)}</div>}</section>
      <section className="rounded-2xl border border-white/10 bg-[#0E1627] p-5"><h3 className="mb-3 font-bold">Pipeline CRM</h3>{crm.length === 0 ? <p className="py-12 text-center text-slate-500">No saved prospects.</p> : <div className="space-y-2">{crm.map(lead => <button key={lead.id} className={`w-full rounded-xl border p-3 text-left ${active?.id === lead.id ? "border-blue-500 bg-blue-950/30" : "border-white/10 bg-white/[0.03]"}`} onClick={() => setActive(lead)}><div className="flex justify-between gap-3"><div><b>{lead.name}</b><p className="text-xs text-slate-400">{lead.company || "Independent"}</p></div><Badge tone={lead.status === "won" ? "green" : lead.status === "lost" ? "red" : "slate"}>{statusLabels[lead.status || "new"]}</Badge></div></button>)}</div>}{active && <div className="mt-4 rounded-xl border border-white/10 bg-[#131D2E] p-4"><h4 className="font-bold">{active.name}</h4><p className="mb-3 text-xs text-slate-400">{active.availableEmail || "No email on file"} {active.availablePhone ? ` · ${active.availablePhone}` : ""}</p><select className="mb-3 w-full rounded bg-[#0E1627] p-2" value={active.status || "new"} onChange={e => updateActive({ ...active, status: e.target.value })}>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select><button className="w-full rounded bg-emerald-800 px-3 py-2 font-bold disabled:opacity-50" disabled={active.inApollo} onClick={async () => { const pushed = await pushToApollo(active); updateActive({ ...active, inApollo: true, apolloContactId: pushed.apolloContactId }); }}>{active.inApollo ? "In Apollo" : "Push Contact to Apollo"}</button></div>}</section>
    </div>
  </div></div>;
}
