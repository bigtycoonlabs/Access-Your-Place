import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, CheckCircle2 } from 'lucide-react';

interface Doc {
  id: string; document_name: string; investor_name: string; investor_email: string;
  signature_status: string; signed_at: string | null; document_url: string | null;
  company_signed: boolean; countersigned_by_name: string | null; countersigned_at: string | null;
  can_sign: boolean; why_not: string | null;
}

/**
 * Staff had NO way to countersign a document. The Documents tab is an upload screen and
 * never touched document_signatures, so clients signed and the company side stayed open.
 * Permission is enforced in the database, not by whether a button renders.
 */
export function StaffCountersign({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState('');
  const [announce, setAnnounce] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error: e } = await supabase.functions.invoke('staff-countersign', {
        body: { action: 'list', staff_id: staffId },
      });
      if (e || data?.success === false) throw new Error(data?.error || e?.message || 'Could not load documents');
      setDocs(data.documents || []);
      setAnnounce(`${data.awaiting_you} document${data.awaiting_you === 1 ? '' : 's'} waiting for your signature.`);
    } catch (err: any) {
      setError(err.message);
      setAnnounce(`Could not load documents. ${err.message}`);
    }
    setLoading(false);
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  const sign = async (d: Doc) => {
    const name = (typed[d.id] || '').trim();
    if (!name) { setAnnounce('Type your full name to sign.'); return; }
    setSigning(d.id);
    try {
      const { data, error: e } = await supabase.functions.invoke('staff-countersign', {
        body: { action: 'sign', staff_id: staffId, document_id: d.id, typed_name: name },
      });
      if (e || data?.success === false) throw new Error(data?.error || e?.message || 'Could not sign');
      setAnnounce(`Signed. ${d.document_name} for ${d.investor_name} is now fully executed.`);
      await load();
    } catch (err: any) {
      setAnnounce(`Not signed. ${err.message}`);
      setError(err.message);
    }
    setSigning('');
  };

  const waiting = docs.filter(d => d.can_sign);
  const rest = docs.filter(d => !d.can_sign);

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">{announce}</div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents to sign</CardTitle>
          <CardDescription>
            The client signs first. You sign on behalf of Set Up Your Place LLC. Type your full
            name to sign, the same way you would on paper.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="py-6 text-center text-gray-600"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading documents…</p>}
          {!loading && error && <p className="py-4 text-red-700">{error}</p>}
          {!loading && !error && waiting.length === 0 && (
            <p className="py-6 text-gray-600">Nothing is waiting for your signature right now.</p>
          )}

          <ul className="space-y-4">
            {waiting.map(d => (
              <li key={d.id} className="border rounded-lg p-4">
                <p className="font-medium text-gray-900">{d.document_name}</p>
                <p className="text-sm text-gray-600">{d.investor_name} signed{d.signed_at ? ` on ${new Date(d.signed_at).toLocaleDateString()}` : ''}</p>
                {d.document_url && (
                  <a href={d.document_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center min-h-[44px] text-sm text-blue-700 underline">
                    <FileText className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Read {d.document_name} before signing
                  </a>
                )}
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <label htmlFor={`sig-${d.id}`} className="sr-only">Type your full name to sign {d.document_name}</label>
                  <Input
                    id={`sig-${d.id}`}
                    placeholder="Type your full name"
                    autoCapitalize="words"
                    value={typed[d.id] ?? (staffName && staffName !== 'Staff' ? staffName : '')}
                    onChange={e => setTyped(t => ({ ...t, [d.id]: e.target.value }))}
                    className="min-h-[44px] sm:max-w-xs"
                  />
                  <Button onClick={() => sign(d)} disabled={signing === d.id} className="min-h-[44px]">
                    {signing === d.id ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing…</> : 'Sign this document'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {rest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not yours to sign</CardTitle>
            <CardDescription>Shown so you know where a document went, rather than it simply vanishing.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {rest.map(d => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm border-b pb-2 last:border-0">
                  {d.company_signed && <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />}
                  <span className="font-medium">{d.document_name}</span>
                  <span className="text-gray-600">{d.investor_name}</span>
                  <Badge variant="outline">{d.why_not}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
