import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Send a landlord a document to sign in their portal. Tie a lease to one of their corporate
 * applications and the application moves to "lease generated", then to "lease signed" when
 * the landlord signs it.
 *
 * Styled like the rest of the staff workspace: plain controls, 44px targets, one result line.
 */

interface Props {
  staffName: string;
  onDone?: (message: string) => void;
}

const DOC_TYPES = [
  { value: 'lease', label: 'Lease' },
  { value: 'lease_addendum', label: 'Lease addendum' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'disclosure', label: 'Disclosure' },
  { value: 'other', label: 'Other' },
];

const box = { width: '100%', maxWidth: 440, minHeight: 44, fontSize: '1rem', padding: '8px 12px', border: '1px solid #dfe3e8', borderRadius: 6, background: '#fff' } as const;
const lab = { display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 } as const;
const row = { margin: '12px 0' } as const;

export function LandlordSignatureSender({ staffName, onDone }: Props) {
  const [landlords, setLandlords] = useState<{ id: string; name?: string; company_name?: string; email?: string }[]>([]);
  const [apps, setApps] = useState<{ id: string; client_name?: string; community_name?: string; unit_number?: string; current_stage?: string }[]>([]);
  const [landlordId, setLandlordId] = useState('');
  const [appId, setAppId] = useState('');
  const [docType, setDocType] = useState('lease');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [days, setDays] = useState('14');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    supabase.functions.invoke('manage-landlord-portal', { body: { action: 'get_all_portal_landlords' } })
      .then(({ data }) => setLandlords(data?.landlords || []))
      .catch(() => setResult('Not loaded. The landlord list could not be read. Try again shortly.'));
  }, []);

  useEffect(() => {
    setAppId('');
    setApps([]);
    if (!landlordId) return;
    supabase.functions.invoke('manage-landlord-portal', { body: { action: 'get_landlord_applications', landlord_id: landlordId } })
      .then(({ data }) => setApps(data?.applications || []))
      .catch(() => setApps([]));
  }, [landlordId]);

  async function send() {
    setResult('');
    if (!landlordId || !name.trim()) { setResult('Not saved. Choose a landlord and name the document.'); return; }
    if (!url.trim() && !content.trim()) { setResult('Not saved. Add a link to the document, or paste its text.'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'send_for_signature',
          landlord_id: landlordId,
          corporate_application_id: appId || undefined,
          document_type: docType,
          document_name: name.trim(),
          document_url: url.trim() || undefined,
          document_content: content.trim() || undefined,
          message: message.trim() || undefined,
          expires_in_days: Number(days) || undefined,
          sent_by_name: staffName || undefined,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'It did not send');
      const who = landlords.find((l) => l.id === landlordId);
      const msg = `Sent. ${who?.name || who?.email || 'The landlord'} can sign "${name.trim()}" from Documents in their portal, and has a message saying so.`;
      setResult(msg);
      setName(''); setUrl(''); setContent(''); setMessage(''); setAppId('');
      onDone?.(msg);
    } catch (e) {
      setResult(`Not saved. ${e instanceof Error ? e.message : 'It did not send.'}`);
    }
    setBusy(false);
  }

  const failed = /^Not (saved|loaded)/.test(result);

  return (
    <div>
      <div style={row}>
        <label htmlFor="lsig-landlord" style={lab}>Landlord</label>
        <select id="lsig-landlord" value={landlordId} onChange={(e) => setLandlordId(e.target.value)} style={box}>
          <option value="">Choose a landlord with portal access</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>{[l.name, l.company_name, l.email].filter(Boolean).join(' · ')}</option>
          ))}
        </select>
      </div>

      <div style={row}>
        <label htmlFor="lsig-type" style={lab}>What it is</label>
        <select id="lsig-type" value={docType} onChange={(e) => setDocType(e.target.value)} style={box}>
          {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {landlordId && (
        <div style={row}>
          <label htmlFor="lsig-app" style={lab}>For application (optional)</label>
          <p style={{ color: '#5b6672', fontSize: '.85rem', margin: '0 0 4px' }}>
            A lease tied to an application moves it to Lease generated now, and to Lease signed when they sign.
          </p>
          <select id="lsig-app" value={appId} onChange={(e) => setAppId(e.target.value)} style={box}>
            <option value="">Not tied to an application</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {[a.client_name, a.community_name, a.unit_number && `unit ${a.unit_number}`].filter(Boolean).join(' · ')}
                {a.current_stage ? ` (${a.current_stage.replace(/_/g, ' ')})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={row}>
        <label htmlFor="lsig-name" style={lab}>Document name</label>
        <input id="lsig-name" type="text" value={name} onChange={(e) => setName(e.target.value)} style={box} />
      </div>

      <div style={row}>
        <label htmlFor="lsig-url" style={lab}>Link to the document</label>
        <p style={{ color: '#5b6672', fontSize: '.85rem', margin: '0 0 4px' }}>An https link the landlord can open, such as a shared PDF. They must open it before they can sign.</p>
        <input id="lsig-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="none" style={box} />
      </div>

      <div style={row}>
        <label htmlFor="lsig-content" style={lab}>Or paste the text to sign</label>
        <textarea id="lsig-content" value={content} onChange={(e) => setContent(e.target.value)} rows={5}
          style={{ ...box, maxWidth: 600, minHeight: 110 }} />
      </div>

      <div style={row}>
        <label htmlFor="lsig-msg" style={lab}>Note to the landlord (optional)</label>
        <input id="lsig-msg" type="text" value={message} onChange={(e) => setMessage(e.target.value)} style={box} />
      </div>

      <div style={row}>
        <label htmlFor="lsig-days" style={lab}>Days they have to sign</label>
        <input id="lsig-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} style={{ ...box, maxWidth: 120 }} />
      </div>

      <button type="button" onClick={send} disabled={busy}
        style={{ minHeight: 44, padding: '0 16px', borderRadius: 6, border: '1px solid #12263f', background: '#12263f', color: '#fff',
          fontWeight: 600, fontSize: '.92rem', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, marginRight: 8 }}>
        {busy ? 'Sending…' : 'Send for signature'}
      </button>

      {result && (
        <p role="status" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 6,
          background: failed ? '#fff1f2' : '#ecfdf5', border: `1px solid ${failed ? '#9f1239' : '#065f46'}` }}>{result}</p>
      )}
    </div>
  );
}
