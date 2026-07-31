import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { supabase } from '@/lib/supabase';

interface StaffLite {
  id?: string;
  name?: string;
  first_name?: string;
  email?: string;
}
interface Msg { who: 'penny' | 'staff'; text: string }
interface Turn { role: 'user' | 'assistant'; content: string }

const GREETING =
  "Hi, I'm Penny. Tell me about the deal \u2014 the address, the numbers, and who the seller or landlord is \u2014 and attach a photo or two. I'll structure it and save a draft for review. Once it's saved, I'll offer to send the seller or landlord their onboarding email; I only send when you say yes.";

/**
 * Self-contained staff deal-intake console. Talks to the deployed
 * penny-deal-intake and upload-deal-photo edge functions via the shared
 * supabase client. Purely additive: renders inside a StaffDashboard tab.
 * Built accessible-first (VoiceOver): labelled controls, live regions,
 * 48px targets, focus returned to the input after each reply.
 */
export function PennyDealIntake({ staffSession }: { staffSession: StaffLite | null }) {
  const staffId = staffSession?.id || '';
  const staffName = staffSession?.name || staffSession?.first_name || staffSession?.email || 'Staff';

  const [messages, setMessages] = useState<Msg[]>([{ who: 'penny', text: GREETING }]);
  const [history, setHistory] = useState<Turn[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState('');
  const [attachStatus, setAttachStatus] = useState('No photos attached yet.');
  const [error, setError] = useState('');
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, thinking]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachStatus(`Uploading ${files.length} photo(s)\u2026`);
    let failed = 0;
    const next = [...photos];
    for (const f of files) {
      try {
        const base64 = await fileToBase64(f);
        const { data, error: upErr } = await supabase.functions.invoke<any>('upload-deal-photo', {
          body: {
            action: 'upload_photo',
            base64_data: base64,
            file_name: f.name,
            content_type: f.type || 'image/jpeg',
            staff_id: staffId,
          },
        });
        if (!upErr && data && data.success && data.url) next.push(data.url);
        else failed++;
      } catch {
        failed++;
      }
    }
    setPhotos(next);
    setAttachStatus(`${next.length} photo(s) attached${failed ? ` (${failed} failed to upload)` : ''}.`);
    e.target.value = '';
  }

  async function send() {
    const text = input.trim();
    setError('');
    if (!text) {
      setError('Type a message for Penny.');
      return;
    }
    if (sending) return;
    setMessages((m) => [...m, { who: 'staff', text }]);
    setInput('');
    setSending(true);
    setThinking('Penny is thinking\u2026');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke<any>('penny-deal-intake', {
        body: {
          message: text,
          conversation_history: history,
          staff_id: staffId,
          staff_name: staffName,
          photo_urls: photos,
        },
      });
      const reply =
        data && data.message
          ? data.message
          : fnErr
          ? 'Sorry \u2014 I hit an error. Please try again.'
          : 'Okay.';
      setMessages((m) => [...m, { who: 'penny', text: reply }]);
      setHistory((h) => [...h, { role: 'user', content: text }, { role: 'assistant', content: reply }]);
      if (data && data.created) {
        setThinking('Draft saved (not public). Photos stay attached to this deal.');
        setPhotos([]);
        setAttachStatus('No photos attached yet.');
      } else {
        setThinking('');
      }
    } catch {
      setMessages((m) => [...m, { who: 'penny', text: 'Network error \u2014 please try again.' }]);
      setThinking('');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <section aria-labelledby="penny-heading" className="max-w-3xl mx-auto">
      <h2 id="penny-heading" className="text-xl font-bold text-slate-800">List a deal with Penny</h2>
      <p className="text-sm text-slate-600 mt-1">
        Tell Penny about the property and attach at least one photo. She structures it, checks the numbers, and
        saves a draft that is not public. After it saves, she offers to send the seller or landlord their
        onboarding email — and only sends when you say yes.
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <div role="log" aria-live="polite" aria-label="Conversation with Penny" className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`px-3.5 py-3 rounded-xl max-w-[92%] ${
                m.who === 'penny' ? 'bg-slate-100 self-start' : 'bg-slate-800 text-white self-end'
              }`}
            >
              <span className="block text-xs font-bold opacity-80 mb-1">
                {m.who === 'penny' ? 'Penny' : staffName}
              </span>
              <span className="whitespace-pre-wrap">{m.text}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
        <div role="status" aria-live="polite" className={`mt-2 text-sm font-semibold text-slate-700 ${thinking ? '' : 'sr-only'}`}>
          {thinking}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="penny-photos" className="block font-semibold text-slate-800">Attach property photos</label>
        <input
          id="penny-photos"
          type="file"
          accept="image/*"
          multiple
          onChange={onFiles}
          className="mt-1.5 block w-full text-sm border border-slate-300 rounded-lg p-2 min-h-[48px]"
        />
        <p aria-live="polite" className="mt-1.5 text-sm text-slate-600">{attachStatus}</p>

        <label htmlFor="penny-msg" className="block font-semibold text-slate-800 mt-3">Message to Penny</label>
        <textarea
          id="penny-msg"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="e.g. New third-party seller deal at 123 Main St, Denton TX 76201…"
          className="mt-1.5 block w-full text-base border border-slate-300 rounded-lg p-3 min-h-[92px]"
        />
        <div role="alert" aria-live="assertive" className={`mt-2 text-sm font-semibold text-red-700 ${error ? '' : 'sr-only'}`}>
          {error}
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="min-h-[48px] px-5 font-bold rounded-lg bg-amber-500 text-slate-900 disabled:opacity-60"
          >
            {sending ? 'Sending\u2026' : 'Send to Penny'}
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-500">Press Enter to send. Use Shift+Enter for a new line.</p>
      </div>
    </section>
  );
}

export default PennyDealIntake;
