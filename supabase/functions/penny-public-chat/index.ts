// penny-public-chat — the anonymous front door.
//
// Penny meets a visitor who has no account. She reasons from her full doctrine
// (composeSystemPrompt for the visitor surface) and is grounded in the REAL free
// knowledge library via the executor — which reads only published articles and
// strips every sealed identity field in code. This surface is read-only by
// construction: the runtime provides no write/money handler, so even if the model
// tried, there is nothing here to call. No account, no writes, no sealed unseal.

import { composeSystemPrompt } from '../_shared/penny/compose.ts';
import { executeTool, type ToolRuntime, type RuntimeResult } from '../_shared/penny/executor.ts';
import { type ViewerContext } from '../_shared/penny/capability.ts';

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Read-only runtime: knowledge-library reads only. No callFunction handler means
// run_numbers / leadforge / scoring all resolve to 'unavailable' on this surface.
function publicRuntime(url: string, key: string): ToolRuntime {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Accept-Profile': APP_SCHEMA,
    'Content-Profile': APP_SCHEMA,
    'Content-Type': 'application/json',
  };
  return {
    async callFunction(): Promise<RuntimeResult> {
      return { ok: false, error: 'not available on the public surface' };
    },
    async readTable(table, opts): Promise<RuntimeResult> {
      try {
        const params = new URLSearchParams();
        params.set('select', '*');
        if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) params.append(k, `eq.${v}`);
        if (opts.search && opts.search.term) {
          const term = opts.search.term.replace(/[(),*]/g, ' ').trim();
          if (term) {
            const ors = opts.search.columns.map((c) => `${c}.ilike.*${term}*`).join(',');
            params.set('or', `(${ors})`);
          }
        }
        if (opts.order) params.set('order', opts.order);
        params.set('limit', String(opts.limit ?? 8));
        const res = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, { headers });
        if (!res.ok) return { ok: false, error: await res.text() };
        return { ok: true, data: await res.json() };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'read failed' };
      }
    },
  };
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

    const ctx: ViewerContext = { surface: 'public', role: 'visitor' };
    const rt = publicRuntime(url, key);

    // Ground Penny in the real free library — the executor does the safe, sealed read.
    let libraryContext = '';
    if (query) {
      const found = await executeTool('search_knowledge', { query }, ctx, rt);
      if (found.status === 'answered' && Array.isArray(found.data)) {
        const arts = (found.data as Array<{ title?: string; slug?: string; excerpt?: string }>)
          .slice(0, 5)
          .map((a) => `- "${a.title}" (/blog/${a.slug}): ${a.excerpt ?? ''}`)
          .join('\n');
        if (arts) {
          libraryContext =
            `\n\nRELEVANT LIBRARY ARTICLES you can point the person to (use these; do not invent article names or links):\n${arts}`;
        }
      }
    }

    const system = composeSystemPrompt(ctx) + libraryContext;
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
    if (ai.error) {
      return json({ success: false, message: 'I hit a snag just now — give me another try in a moment.' });
    }
    const reply = ai.content?.[0]?.text ?? "I couldn't put that into words just now — try me again?";
    return json({ success: true, message: reply });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
