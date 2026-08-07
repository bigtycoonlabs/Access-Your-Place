import React, { useState, useRef, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { playPennyChime } from '@/lib/pennyChime';

interface StaffLite {
  id?: string;
  name?: string;
  first_name?: string;
  email?: string;
}

type Msg = { role: 'user' | 'assistant'; content: string };

const OPENER =
  'I\'m right here. Tell me what you\'d like to do — or say "show my opportunities" and I\'ll pull them up.';

/**
 * Penny's staff agent chat. Posts the running conversation to the
 * penny-staff-chat edge function, which reasons over the live desk and can take
 * guarded next steps (it always confirms before changing anything). Built
 * accessible-first: the log is a polite live region, every turn is labelled for
 * screen readers, Enter sends, and the send target meets 44px.
 */
export function PennyStaffChat({ staffSession }: { staffSession: StaffLite | null }) {
  const staffId = staffSession?.id || '';
  const staffName = staffSession?.name || staffSession?.first_name || staffSession?.email || 'Staff';

  // Penny has now reported "your session isn't identifying you" four times running, and
  // three server-side theories for why have each been wrong. The one thing never
  // actually observed is whether this browser is sending a staff id AT ALL — everything
  // so far has been inference from server behaviour.
  //
  // So state it on the page. If the id is missing this is also a real, permanently
  // useful warning: Penny, commissions and timesheets all need it, and until now the
  // only symptom was Penny sounding confused.
  const identityMissing = !staffId;
  const idTail = staffId ? staffId.slice(-6) : '';

  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: OPENER }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [spoken, setSpoken] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, busy]);

  // Penny's coin-chime the instant her reply drops in.
  useEffect(() => {
    if (messages[messages.length - 1]?.role === 'assistant') playPennyChime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // STREAMING.
  //
  // Penny used to go silent and then return everything at once. On a screen reader that
  // is indistinguishable from being broken.
  //
  // Now she reports what she is actually doing while she does it. Two separate channels,
  // deliberately:
  //
  //   progress  — everything, on screen, updating freely. aria-hidden.
  //   announced — only milestones, spoken, at most one every 4 seconds.
  //
  // Announcing every event would turn a screen reader into a firehose and is worse than
  // silence. Announcing nothing leaves a blind user with no idea whether anything is
  // happening. So: show everything, speak the meaningful parts, and never more often than
  // a person can absorb.
  const announceAt = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  function announce(text: string, force = false) {
    const now = Date.now();
    if (!force && now - announceAt.current < 4000) return;
    announceAt.current = now;
    setSpoken(text);
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setProgress('');
    announce('Stopped.', true);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError('');
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setProgress('');
    setSpoken('');
    announceAt.current = 0;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/penny-staff-chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ messages: next, staff_id: staffId, staff_name: staffName, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let replied = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          let ev: any;
          try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }

          if (ev.type === 'status') {
            setProgress(ev.text || 'Working');
          } else if (ev.type === 'tool') {
            const label = ev.label || 'Working on that';
            if (ev.state === 'running') {
              setProgress(label);
              announce(label);
            } else if (ev.state === 'failed') {
              // A failure is a milestone. Forced past the throttle, because a tool that
              // did not work is exactly what a person must not miss.
              setProgress(`${label} — failed`);
              announce(`${label} failed.`, true);
            } else if (ev.state === 'needs_confirmation') {
              setProgress(`${label} — waiting for your confirmation`);
              announce('Penny needs you to confirm before she does that.', true);
            } else {
              setProgress(`${label} — done`);
            }
          } else if (ev.type === 'message') {
            replied = true;
            setMessages((m) => [...m, { role: 'assistant', content: ev.text || "I didn't catch that — can you say it again?" }]);
          } else if (ev.type === 'error') {
            replied = true;
            setMessages((m) => [...m, { role: 'assistant', content: ev.text }]);
            announce('Penny hit a problem.', true);
          }
        }
      }
      // Reaching the end of the stream without a reply is a failure, and it is reported
      // as one rather than leaving an empty turn that looks like nothing was asked.
      if (!replied) {
        setMessages((m) => [...m, { role: 'assistant', content: 'That did not come back properly. Nothing was left half-done — try again.' }]);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError('Something went wrong reaching Penny. Try again in a moment.');
      setMessages((m) => [...m, { role: 'assistant', content: 'I hit a snag just now — give me a moment and try again.' }]);
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress('');
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <section aria-label="Chat with Penny" className="rounded-xl border border-slate-200 bg-white p-4">
      {/* PROGRESS — everything, on screen, updating freely. aria-hidden because a region
          that changes this often would flood a screen reader. */}
      {busy && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <p aria-hidden="true" className="text-sm text-slate-600">
            {progress ? `${progress}…` : 'Thinking…'}
          </p>
          {/* A Stop control is always present while she is working. Being unable to
              interrupt is its own kind of trap. */}
          <button
            type="button"
            onClick={stop}
            className="min-h-[44px] shrink-0 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800"
          >
            Stop
          </button>
        </div>
      )}

      {/* ANNOUNCED — milestones only, at most one every 4 seconds, politely. This is the
          channel a screen reader actually reads. Failures bypass the throttle. */}
      <p role="status" aria-live="polite" className="sr-only">{spoken}</p>

      {/* Announced politely rather than assertively: informative, not an emergency. */}
      <p role="status" aria-live="polite" className="mb-3 text-sm">
        {identityMissing ? (
          <span className="block rounded-md bg-amber-50 px-3 py-2 text-amber-900">
            Your session is not sending an account id, so Penny cannot tell who you are.
            Sign out and back in to fix it. If it keeps happening after signing back in,
            the session is not storing the id.
          </span>
        ) : (
          <span className="block text-slate-500">
            Signed in as {staffName}. Account id ending {idTail} is being sent to Penny.
          </span>
        )}
      </p>
      <div
        ref={logRef}
        className="max-h-[50vh] overflow-y-auto space-y-3"
        role="log"
        aria-live="polite"
        aria-label="Conversation with Penny"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span className="sr-only">{m.role === 'user' ? 'You said: ' : 'Penny said: '}</span>
            <div
              className={
                m.role === 'user'
                  ? 'inline-block rounded-2xl bg-slate-800 text-white px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap text-left'
                  : 'inline-block rounded-2xl bg-slate-100 text-slate-800 px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap'
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="text-left text-sm text-slate-500" role="status">
            Penny is thinking…
          </div>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <label htmlFor="penny-staff-input" className="sr-only">
          Message Penny
        </label>
        <textarea
          id="penny-staff-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Ask Penny to pull up your opportunities…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
          disabled={busy}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !input.trim()}
          className="rounded-lg bg-slate-800 text-white px-4 min-h-[44px] text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default PennyStaffChat;
