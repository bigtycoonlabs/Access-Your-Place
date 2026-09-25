import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SignaturePad, type SignatureResult } from '@/components/investor/SignaturePad';
import { FileSignature, CheckCircle, Clock, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { OriginalLanguageNote, getPortalLanguage } from '@/i18n/PortalLanguage';

export interface SignatureRequest {
  id: string;
  corporate_application_id?: string | null;
  document_name: string;
  document_type: string;
  document_url?: string | null;
  document_content?: string | null;
  message?: string | null;
  status: 'pending' | 'viewed' | 'signed' | 'declined' | 'cancelled' | 'expired';
  sent_by_name?: string | null;
  sent_at: string;
  expires_at?: string | null;
  signed_at?: string | null;
  signer_name?: string | null;
  signature_type?: string | null;
  declined_at?: string | null;
}

export const isAwaitingSignature = (r: SignatureRequest) => r.status === 'pending' || r.status === 'viewed';

/** The landlord's signing requests, newest first. */
export function useSignatureRequests(landlordId: string) {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'get_signature_requests', landlord_id: landlordId },
      });
      if (invokeError || data?.success === false) throw new Error(data?.error || invokeError?.message);
      setRequests(data?.signatures || []);
    } catch {
      setError('Documents waiting for your signature could not be loaded. Refresh to try again.');
    }
    setLoading(false);
  }, [landlordId]);

  useEffect(() => { reload(); }, [reload]);
  return { requests, loading, error, reload };
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(getPortalLanguage() === 'es' ? 'es' : undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

interface SignDialogProps {
  request: SignatureRequest | null;
  landlordId: string;
  landlordName: string;
  onClose: () => void;
  onDone: () => void;
}

/** Review a document and sign (or decline) it. */
export function SignDocumentDialog({ request, landlordId, landlordName, onClose, onDone }: SignDialogProps) {
  const { toast } = useToast();
  const [signature, setSignature] = useState<SignatureResult | null>(null);
  const [legalName, setLegalName] = useState(landlordName || '');
  const [initials, setInitials] = useState('');
  const [consent, setConsent] = useState(false);
  const [opened, setOpened] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSignature(null); setConsent(false); setOpened(false); setDeclining(false);
    setReason(''); setError(''); setInitials(''); setLegalName(landlordName || '');
    if (request && request.status === 'pending') {
      supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'mark_signature_viewed', landlord_id: landlordId, signature_id: request.id },
      }).catch(() => { /* viewing is recorded again at signing */ });
    }
  }, [request, landlordId, landlordName]);

  if (!request) return null;
  // A linked document must be opened before signing; text shown here is read in place.
  const mustOpen = !!request.document_url && !request.document_content;
  const canSign = !!signature && consent && legalName.trim().length >= 2 && (!mustOpen || opened) && !busy;

  const sign = async () => {
    if (!signature) return;
    setBusy(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'sign_document',
          landlord_id: landlordId,
          signature_id: request.id,
          signer_name: legalName.trim(),
          signature_type: signature.type,
          signature_image: signature.type === 'drawn' ? signature.signatureImageDataUrl : undefined,
          initials: initials.trim() || undefined,
          consent: true,
        },
      });
      if (invokeError || !data?.success) throw new Error(data?.error || 'Your signature was not saved. Please try again.');
      toast({ title: 'Signed', description: `You signed "${request.document_name}". A copy is kept on your account.` });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your signature was not saved. Please try again.');
    }
    setBusy(false);
  };

  const decline = async () => {
    setBusy(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'decline_signature', landlord_id: landlordId, signature_id: request.id, reason: reason.trim() },
      });
      if (invokeError || !data?.success) throw new Error(data?.error || 'That was not saved. Please try again.');
      toast({ title: 'Sent to the team', description: 'We have your reason and will follow up.' });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That was not saved. Please try again.');
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle translate="no">{request.document_name}</DialogTitle>
          <DialogDescription>
            {request.sent_by_name ? `Sent ${fmt(request.sent_at)} by ${request.sent_by_name}.` : `Sent ${fmt(request.sent_at)}.`}
            {request.expires_at ? ` Please sign by ${fmt(request.expires_at)}.` : ''}
          </DialogDescription>
        </DialogHeader>

        {request.message && <p translate="no" className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{request.message}</p>}

        {(request.document_content || request.document_url) && <OriginalLanguageNote />}
        {request.document_content && (
          <div translate="no" className="border rounded-lg p-4 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-gray-800 bg-white">
            {request.document_content}
          </div>
        )}
        {request.document_url && (
          <a href={request.document_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}
            className="inline-flex items-center gap-2 text-[#1a365d] font-medium hover:underline">
            <ExternalLink className="w-4 h-4" /> Open the document{mustOpen ? ' (required before signing)' : ''}
          </a>
        )}

        {!declining ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sig-legal-name">Your full legal name</Label>
                <Input id="sig-legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <Label htmlFor="sig-initials">Initials (optional)</Label>
                <Input id="sig-initials" value={initials} maxLength={10} onChange={(e) => setInitials(e.target.value.toUpperCase())} />
              </div>
            </div>

            <SignaturePad investorName={legalName} onSignatureChange={setSignature} disabled={busy} />

            <div className="flex items-start gap-2">
              <Checkbox id="sig-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} disabled={busy} />
              <Label htmlFor="sig-consent" className="text-sm font-normal leading-snug">
                I have read this document and agree to sign it electronically. My electronic signature has the same
                legal effect as a handwritten one (ESIGN Act and UETA).
              </Label>
            </div>
            {mustOpen && !opened && <p className="text-sm text-amber-700">Open the document above before signing.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="sig-decline-reason">What needs to change?</Label>
            <Textarea id="sig-decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-2">
          {!declining ? (
            <>
              <Button variant="outline" onClick={() => setDeclining(true)} disabled={busy}>I can't sign this</Button>
              <Button onClick={sign} disabled={!canSign} className="bg-[#1a365d] hover:bg-[#2d4a7c]">
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSignature className="w-4 h-4 mr-2" />}
                Sign document
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setDeclining(false)} disabled={busy}>Back</Button>
              <Button variant="destructive" onClick={decline} disabled={busy || !reason.trim()}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send reason to the team
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  landlordId: string;
  landlordName: string;
}

/** "Waiting for your signature" and the signed record, for the Documents tab. */
export default function LandlordSignatures({ landlordId, landlordName }: Props) {
  const { requests, loading, error, reload } = useSignatureRequests(landlordId);
  const [active, setActive] = useState<SignatureRequest | null>(null);

  const waiting = requests.filter(isAwaitingSignature);
  const done = requests.filter((r) => !isAwaitingSignature(r));

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Checking for documents to sign…</div>;
  }

  return (
    <section aria-labelledby="landlord-signatures-heading" className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 id="landlord-signatures-heading" className="font-semibold text-gray-900 flex items-center gap-2">
        <FileSignature className="w-5 h-5 text-[#d4a574]" />
        {waiting.length ? `Waiting for your signature (${waiting.length})` : 'Signatures'}
      </h3>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && !requests.length && (
        <p className="text-sm text-gray-600">Nothing to sign right now. When we send you a lease or agreement, it will appear here.</p>
      )}

      {waiting.length > 0 && (
        <ul className="space-y-2">
          {waiting.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-amber-50 rounded-lg p-3">
              <div>
                <p translate="no" className="font-medium text-gray-900">{r.document_name}</p>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Sent {fmt(r.sent_at)}{r.expires_at ? ` · sign by ${fmt(r.expires_at)}` : ''}
                </p>
              </div>
              <Button size="sm" onClick={() => setActive(r)} className="bg-[#1a365d] hover:bg-[#2d4a7c]">
                <FileSignature className="w-4 h-4 mr-1" /> Review and sign
              </Button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {done.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span translate="no" className="text-gray-800">{r.document_name}</span>
              {r.status === 'signed' ? (
                <span className="flex items-center gap-1 text-emerald-700"><CheckCircle className="w-4 h-4" /> {r.signer_name ? `Signed ${fmt(r.signed_at)} by ${r.signer_name}` : `Signed ${fmt(r.signed_at)}`}</span>
              ) : r.status === 'declined' ? (
                <span className="flex items-center gap-1 text-gray-600"><XCircle className="w-4 h-4" /> You asked for changes {fmt(r.declined_at)}</span>
              ) : (
                <span className="text-gray-500">Expired. Message us to have it sent again.</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <SignDocumentDialog
        request={active}
        landlordId={landlordId}
        landlordName={landlordName}
        onClose={() => setActive(null)}
        onDone={() => { setActive(null); reload(); }}
      />
    </section>
  );
}
