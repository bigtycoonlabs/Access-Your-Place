import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Send, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PennyMark } from '@/components/investor/PennyMark';
import { playPennyChime } from '@/lib/pennyChime';

type Msg = { role: 'user' | 'assistant'; content: string };

const GREETING =
  "I'm Penny — your acquisition guide. Ask me anything about furnished-rental arbitrage: a market, the numbers, how a deal comes together, or where to start. The knowledge is free.";

interface Props {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
}

/**
 * The public front door to Penny. Anonymous, read-only: it talks to the
 * penny-public-chat edge function, which grounds her in the free knowledge
 * library and keeps every deal's identity sealed. Built accessible-first —
 * replies are announced to screen readers, focus is managed, targets are 44px.
 */
export default function PennyPublicChat({ open, initialQuery, onClose }: Props) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      const next: Msg[] = [...messagesRef.current, { role: 'user', content: trimmed }];
      setMessages(next);
      setInput('');
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('penny-public-chat', {
          body: { messages: next },
        });
        if (error) throw error;
        // The function returns a friendly `message` on FAILURE as well as on success, so
        // reading it without checking `success` renders "the AI service is not configured"
        // as though Penny had answered the question. A visitor would take that as her
        // reply and leave.
        if (data?.success === false) throw new Error(String(data?.error || 'failed'));
        const reply =
          (data && (data.message as string)) ??
          "I couldn't put that into words just now — try me again?";
        setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      } catch {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: "I couldn't connect just now. Give me another try in a moment." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  // Keep a ref of messages so send() always appends to the latest without stale closures.
  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // On open: greet, focus the input, and send the seeded question once (if any).
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    setMessages([{ role: 'assistant', content: GREETING }]);
    messagesRef.current = [{ role: 'assistant', content: GREETING }];
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    if (initialQuery && initialQuery.trim() && !seededRef.current) {
      seededRef.current = true;
      void send(initialQuery);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Penny's coin-chime the instant her message drops in.
  useEffect(() => {
    if (messages[messages.length - 1]?.role === 'assistant') playPennyChime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="penny-chat-title"
        className="flex h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#d4a574]/30 bg-[#0b1220] shadow-2xl sm:h-[80vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="penny-chat-title" className="flex items-center gap-2 text-lg font-bold text-white">
            <PennyMark size={28} />
            Penny
            <span className="text-sm font-normal text-slate-400">— your acquisition guide</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat with Penny"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation with Penny"
          className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
        >
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-[#d4a574] px-4 py-2.5 text-[15px] leading-relaxed text-[#1a365d]'
                    : 'max-w-[90%] rounded-2xl rounded-bl-sm bg-white/[0.06] px-4 py-2.5 text-[15px] leading-relaxed text-slate-100'
                }
              >
                <span className="sr-only">{m.role === 'user' ? 'You said: ' : 'Penny said: '}</span>
                {m.content.split('\n').map((line, j) => (
                  <p key={j} className={j > 0 ? 'mt-2' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start" aria-live="polite">
              <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] px-4 py-2.5 text-sm text-slate-400">
                Penny is thinking…
              </div>
            </div>
          )}
        </div>

        {/* Sign-up nudge */}
        <div className="border-t border-white/10 bg-white/[0.02] px-5 py-2.5 text-center text-xs text-slate-400">
          Ready to run real numbers and put the team to work?{' '}
          <button
            type="button"
            onClick={() => navigate('/investor/login')}
            className="font-semibold text-[#d4a574] underline-offset-4 hover:underline"
          >
            Start an account <ArrowRight className="inline h-3 w-3" aria-hidden="true" />
          </button>
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-3">
          <label htmlFor="penny-public-input" className="sr-only">
            Type your message to Penny
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 focus-within:border-[#d4a574]/60">
            <input
              id="penny-public-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send(input);
              }}
              placeholder="Ask Penny anything…"
              className="min-h-[44px] flex-1 bg-transparent px-3 text-base text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              aria-label="Send message to Penny"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#d4a574] text-[#1a365d] transition hover:bg-[#e7c9a0] focus:outline-none focus:ring-2 focus:ring-[#d4a574] disabled:opacity-40"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
