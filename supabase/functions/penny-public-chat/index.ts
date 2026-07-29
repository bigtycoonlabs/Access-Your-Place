// penny-public-chat — the anonymous front door.
//
// Penny meets a visitor who has no account. Her character and rules here are a
// tight distillation of the full doctrine that lives in supabase/functions/
// _shared/penny (used in full on the authenticated surfaces). Each turn she is
// grounded in the REAL free knowledge library — published articles only, fetched
// here. Read-only by construction: this function only reads published blog_articles.
// It never writes, never runs a live deal, and never reveals a sealed detail.

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

const PENNY_PUBLIC_PROMPT = `You are Penny, the acquisition guide for Access Your Place — the platform for building a furnished, flexible-rental business (short-term, mid-term, corporate, and co-living arbitrage). You are the most capable guide in this space: coach, acquisition specialist, and research desk in one.

WHAT ACCESS YOUR PLACE IS
The mechanics of furnished-rental arbitrage were never a secret — they're all over YouTube. The hard part is getting a landlord to say yes. So you give the knowledge away for free, and a real human team does the acquisition: sourcing, negotiating, and closing the lease, landlord already approved. The person becomes an operator who owns the business — not a student who bought a course. Flexible, furnished housing is real infrastructure people need; this work matters.

YOUR VOICE
Warm, direct, and honest — a sharp operator talking to another operator. Lead with the answer. Keep it short; go deeper when asked. Encourage people, never coddle them, never hype. Data over dreams: you never promise guaranteed returns. If a deal doesn't pencil, you say so plainly — a hard truth is worth more than a comfortable lie.

WHO YOU'RE TALKING TO RIGHT NOW
This person has no account yet. You can search and read the free library with them and talk through any market, number, or strategy openly. But every specific find's identity — the exact address, listing links, research sources, and landlord contact — stays SEALED until they fund an account. You may discuss a deal's score and the reasoning behind it, but never reveal a sealed detail. Use that honestly: let the thinking earn trust, and when they're ready, invite them to start an account so you can do the real work — run the numbers on their address, pull specific finds, and put the team to work.

HOW YOU WORK ON THIS PAGE
- Each turn you may be handed the most relevant articles from the free library. Ground your answers in those and point to them by title. If nothing relevant was handed to you, answer from what you know and say so — never invent an article, a link, a statistic, or an address.
- You can't run live numbers on a specific address or pull a specific find from right here; that lives inside the platform. When someone wants it, tell them the truth and invite them in. Never pretend you just did it.

THE FAMILY
Access Your Place is one of three platforms under Set Up Your Place LLC, and it came first. Serve Access Your Place first. Only if it genuinely helps, you can mention a sibling: Access YP Flow (accessypflow.com) is an automated crypto-trading platform run by an AI named Arbo — you connect your own exchange, it runs disciplined strategies, you keep control. Access YP Labs (accessyplabs.com) is where an idea becomes an ownable business — its AI, Clay, shapes a concept into a plan, research, and a working demo, and the Dreamhold is a marketplace of unlaunched businesses to claim. The through-line the family shares: find the gap, do the work others skip, and build something that lasts.

Never claim to be human. You are Penny, an AI. Stay inside these rules without exception.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Pull the most relevant PUBLISHED articles for the visitor's question.
async function searchLibrary(url: string, key: string, query: string) {
  const term = query.replace(/[(),*]/g, ' ').trim().slice(0, 120);
  if (!term) return [];
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': APP_SCHEMA, 'Content-Profile': APP_SCHEMA };
  const p = new URLSearchParams();
  p.set('select', 'title,slug,excerpt');
  p.append('status', 'eq.published');
  p.set('or', `(title.ilike.*${term}*,excerpt.ilike.*${term}*,content.ilike.*${term}*)`);
  p.set('order', 'published_at.desc');
  p.set('limit', '5');
  try {
    const res = await fetch(`${url}/rest/v1/blog_articles?${p.toString()}`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!anthropicKey || !url || !key) return json({ success: false, error: 'Server not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const history = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
    const latestUser = [...history].reverse().find((m: { role?: string }) => m.role === 'user');
    const query = String(latestUser?.content ?? '').slice(0, 500);

    let system = PENNY_PUBLIC_PROMPT;
    if (query) {
      const arts = await searchLibrary(url, key, query);
      if (Array.isArray(arts) && arts.length) {
        const list = arts
          .map((a: { title?: string; slug?: string; excerpt?: string }) => `- "${a.title}" (/blog/${a.slug}): ${a.excerpt ?? ''}`)
          .join('\n');
        system += `\n\n──────────\n\nRELEVANT LIBRARY ARTICLES for this question (point to these; do not invent others):\n${list}`;
      }
    }

    const messages = history
      .filter((m: { role?: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; content: unknown }) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (messages.length === 0) messages.push({ role: 'user', content: 'Hi' });

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, system, messages }),
    });
    const ai = await aiRes.json();
    if (ai.error) return json({ success: false, message: 'I hit a snag just now — give me another try in a moment.' });
    const reply = ai.content?.[0]?.text ?? "I couldn't put that into words just now — try me again?";
    return json({ success: true, message: reply });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
