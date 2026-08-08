import React, { useState, useRef, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { playPennyChime } from '@/lib/pennyChime';

interface StaffLite {
  id?: string;
  name?: string;
  first_name?: string;
  email?: string;
}

type Msg = { role: 'user' | 'assistant'; content: string };

// Penny opened with the same sentence every single time. A colleague who greets you with
// an identical scripted line every morning stops reading as a person and starts reading as
// a kiosk — and the owner said so.
//
// These vary, and more importantly they OPEN DIFFERENTLY: some offer, some ask, some just
// get out of the way. Nothing here claims to know anything — the honest version of variety
// is tone, never invented facts.
const OPENERS = [
  "Morning. What are we doing first?",
  "Right — where do you want to start?",
  "I'm here. What's on your mind?",
  "Ready when you are.",
  "What do you need?",
  "Go ahead — I'm listening.",
  "What's first today?",
  "Tell me where you want to dig in.",
];

// Seeded on the hour so it stays stable across a re-render but changes through the day.
// Random per render would make the greeting flicker, which is worse than repetition.
function pickOpener(seed: string): string {
  let h = 0;
  const key = seed + new Date().toISOString().slice(0, 13);
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return OPENERS[h % OPENERS.length];
}

/**
 * Penny's staff agent chat. Posts the running conversation to the
 * penny-staff-chat edge function, which reasons over the live desk and can take
 * guarded next steps (it always confirms before changing anything). Built
 * accessible-first: the log is a polite live region, every turn is labelled for
 * screen readers, Enter sends, and the send target meets 44px.
 */
export function PennyStaffChat({
  staffSession,
  ask,
  onAsked,
}: {
  staffSession: StaffLite | null;
  /** A question queued from the briefing chips. Sent as if the person typed it. */
  ask?: string;
  onAsked?: () => void;
}) {
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

  const [messages, setMessages] = useState<Msg[]>(
    () => [{ role: 'assistant', content: pickOpener(staffSession?.id || 'anon') }],
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [spoken, setSpoken] = useState('');
  const [live, setLive] = useState('');
  // Attachments staged for the next message. Photos go to Penny as images; documents are
  // read to text in the browser so nothing is uploaded anywhere just to be read.
  const [photos, setPhotos] = useState<{ name: string; dataUrl: string }[]>([]);
  const [docs, setDocs] = useState<{ name: string; text: string }[]>([]);
  const [reading, setReading] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
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
    setLive('');
    announce('Stopped.', true);
  }

  // Fires when the briefing hands over a question. Guarded on busy so a tap during a
  // turn queues rather than colliding with it.
  useEffect(() => {
    if (ask && !busy) {
      void sendText(ask);
      onAsked?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  // Reads a file to text IN THE BROWSER. Nothing is uploaded to storage just so Penny can
  // read it — a spreadsheet of client records should not be sitting in a bucket because
  // someone wanted a summary.
  async function readDocument(file: File): Promise<string> {
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // Every sheet, named, with its row count — Penny is told to say what she received,
      // and she cannot do that from a wall of undifferentiated cells.
      return wb.SheetNames.map((sheet) => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false }) as unknown[][];
        const body = rows.slice(0, 200).map((r) => r.join(' | ')).join('\n');
        return `### SHEET: ${sheet} (${rows.length} rows)\n${body}${rows.length > 200 ? `\n… ${rows.length - 200} more rows not shown` : ''}`;
      }).join('\n\n');
    }
    if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json')) {
      return await file.text();
    }
    // Honest refusal beats a broken parse that produces confident nonsense.
    return `[${file.name} could not be read here. Penny can read spreadsheets (.xlsx, .xls), CSV, text, markdown and JSON. For a PDF or Word file, export or paste the text.]`;
  }

  async function onFiles(list: FileList | null) {
    if (!list || !list.length) return;
    setError('');
    const files = Array.from(list).slice(0, 10);
    setReading(`Reading ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      for (const f of files) {
        if (f.type.startsWith('image/')) {
          if (f.size > 8 * 1024 * 1024) {
            setError(`${f.name} is larger than 8MB and was skipped.`);
            continue;
          }
          const dataUrl: string = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = () => rej(new Error('read failed'));
            r.readAsDataURL(f);
          });
          setPhotos((p) => [...p, { name: f.name, dataUrl }].slice(0, 8));
        } else {
          const text = await readDocument(f);
          setDocs((d) => [...d, { name: f.name, text }]);
        }
      }
      announce('Attached. Say what you want done with them.', true);
    } catch {
      setError('One of those files could not be read. Nothing was attached from it.');
    } finally {
      setReading('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    await sendText(text);
  }

  async function sendText(text: string) {
    if (!text || busy) return;
    setError('');
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setBusy(true);
    setProgress('');
    setSpoken('');
    setLive('');
    announceAt.current = 0;

    // Cleared as soon as they are sent, so the next message does not silently resend the
    // same photos - which would cost money and confuse her.
    const sentPhotos = photos.length;
    const sentDocs = docs.length;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/penny-staff-chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          messages: next,
          staff_id: staffId,
          staff_name: staffName,
          stream: true,
          images: photos.map((p) => p.dataUrl),
          document_text: docs.map((d) => `--- ${d.name} ---\n${d.text}`).join('\n\n') || undefined,
          document_name: docs.map((d) => d.name).join(', ') || undefined,
        }),
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
          } else if (ev.type === 'delta') {
            // Text as it is generated. Shown immediately, NOT announced — announcing
            // every token turns a screen reader into a firehose. The finished reply is
            // announced once, at the end.
            setLive((t) => t + ev.text);
          } else if (ev.type === 'retract') {
            // The guard tripped mid-stream. Pull the partial text off screen at once.
            setLive('');
            announce('Penny stopped that reply.', true);
          } else if (ev.type === 'message') {
            replied = true;
            setLive('');
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
      setLive('');
      if (sentPhotos || sentDocs) { setPhotos([]); setDocs([]); }
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
        {/* Penny's words as they arrive, in the conversation where she is speaking —
            not above a scrolling panel where a phone never shows them. aria-hidden
            because the finished reply is announced once when it lands. */}
        {live && (
          <div className="text-left">
            <span className="sr-only">Penny said: </span>
            <div aria-hidden="true" className="inline-block rounded-2xl bg-slate-100 text-slate-800 px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap">
              {live}
            </div>
          </div>
        )}
        {busy && !live && (
          // NO role="status" here. This sits inside a role="log" that is already
          // aria-live, and a live region nested in a live region gets announced twice.
          <div aria-hidden="true" className="text-left text-sm text-slate-500">
            Penny is thinking…
          </div>
        )}
      </div>

      {/* ATTACHMENTS, above the composer where the person is looking. Announced as a list
          so a screen reader gives the count before the contents. */}
      {(photos.length > 0 || docs.length > 0 || reading) && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p role="status" aria-live="polite" className="text-sm font-medium text-slate-800">
            {reading
              ? reading
              : `Attached: ${photos.length} photo${photos.length === 1 ? '' : 's'}, ${docs.length} file${docs.length === 1 ? '' : 's'}. Say what you want done with them.`}
          </p>
          {(photos.length > 0 || docs.length > 0) && (
            <ul className="mt-1 space-y-1">
              {photos.map((f, i) => (
                <li key={`p${i}`} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                  <span className="truncate">Photo {i + 1}: {f.name}</span>
                  <button
                    type="button"
                    onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                    className="min-h-[44px] shrink-0 px-2 text-sm text-slate-600 underline"
                  >
                    Remove photo {i + 1}
                  </button>
                </li>
              ))}
              {docs.map((f, i) => (
                <li key={`d${i}`} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                  <span className="truncate">File: {f.name}</span>
                  <button
                    type="button"
                    onClick={() => setDocs((x) => x.filter((_, j) => j !== i))}
                    className="min-h-[44px] shrink-0 px-2 text-sm text-slate-600 underline"
                  >
                    Remove {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* PROGRESS AND STOP, directly above the composer.
          These used to render at the TOP of the panel, above a max-h-[50vh] scrolling
          log — so on a phone they were off-screen and the owner reported there was no
          Stop button at all. It was there; it was just somewhere he could never see it.
          Controls belong next to the thing the person is looking at. */}
      {busy && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
          <p aria-hidden="true" className="text-sm text-slate-600">
            {progress ? `${progress}…` : 'Thinking…'}
          </p>
          <button
            type="button"
            onClick={stop}
            className="min-h-[44px] shrink-0 rounded-md border border-slate-400 bg-white px-4 text-sm font-medium text-slate-900"
          >
            Stop
          </button>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <label htmlFor="penny-staff-input" className="sr-only">
          Message Penny
        </label>
        {/* A real labelled input, not an icon with a click handler. Staff could not send
            Penny a photo at all before this, which made her no use to the person standing
            in the unit holding a phone. */}
        <label
          htmlFor="penny-attach"
          className="flex min-h-[44px] cursor-pointer items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800"
        >
          Attach
        </label>
        <input
          ref={fileRef}
          id="penny-attach"
          type="file"
          multiple
          accept="image/*,.csv,.txt,.md,.json,.xlsx,.xls"
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
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
