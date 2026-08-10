import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

/**
 * Penny for landlords.
 *
 * Deliberately NOT the operator Penny. That one is written for the other side of the table
 * -- it coaches operators on winning a lease FROM a landlord and is told never to reveal the
 * operator's margin. Putting it in front of a landlord would have it holding instructions
 * about what to withhold from the person it is talking to.
 *
 * This one talks to the property owner: they pay nothing, the lease structure is their
 * choice, and when there is nothing for them to do it says so and gets out of the way.
 */

interface Props {
  landlordId: string;
  landlordName?: string;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const OPENERS = [
  'What is happening with my property?',
  'What does this cost me?',
  'How does the master lease work?',
  'Who is going to be leasing my property?',
];

export function LandlordPennyChat({ landlordId, landlordName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Focus the input when it opens, and return focus to the trigger when it closes.
  // Losing focus to the top of the page is silent and disorienting on a screen reader.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else triggerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    setInput('');
    setError('');
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('penny-landlord-chat', {
        body: {
          action: 'chat',
          user_id: landlordId,
          user_name: landlordName,
          message: question,
          conversation_history: messages.slice(-8),
        },
      });
      if (fnError) throw fnError;
      // CHECK success FIRST. This function returns a friendly `message` on FAILURE too
      // ("I'm having some technical trouble"), so reading `message` without checking
      // success renders an error as though Penny had answered -- a landlord would think
      // they had been told something.
      if (data?.success !== true) throw new Error(data?.error || 'failed');
      const reply = data?.reply || data?.message;
      if (!reply) throw new Error('no reply');
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setError(
        'I could not get an answer just then. Nothing is wrong with your property or your account -- it is on our side. Try again, or your contact at Access Your Place can pick this up directly.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#1a3a5c] px-5 py-4 text-white shadow-lg hover:bg-[#24507d] focus:outline-none focus:ring-4 focus:ring-[#1a3a5c]/30"
        style={{ minHeight: 44 }}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">Ask Penny</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex w-[min(92vw,26rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      style={{ maxHeight: 'min(78vh, 40rem)' }}
      role="dialog"
      aria-label="Ask Penny about your property"
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-[#1a3a5c] px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Penny</p>
          <p className="text-xs text-white/80">Here to answer, not to sell you anything</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close Penny"
          className="rounded-lg p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Hello{landlordName ? ` ${landlordName.split(' ')[0]}` : ''}. Ask me anything about your
              property, how we work, or what happens next. Listing with us costs you nothing.
            </p>
            <div className="space-y-2">
              {OPENERS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="block w-full rounded-lg border border-gray-200 px-3 py-3 text-left text-sm text-gray-800 hover:border-[#1a3a5c] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/40"
                  style={{ minHeight: 44 }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl bg-[#1a3a5c] px-4 py-3 text-sm text-white'
                : 'mr-auto max-w-[92%] rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-900'
            }
          >
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </div>
        ))}

        {loading && (
          <p className="text-sm text-gray-500" role="status">
            Penny is looking that up...
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-900" role="status">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <label htmlFor="penny-landlord-input" className="sr-only">
            Ask Penny a question
          </label>
          <input
            id="penny-landlord-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send(input);
            }}
            placeholder="Ask about your property..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-[#1a3a5c] focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/30"
            style={{ minHeight: 44 }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="rounded-lg bg-[#1a3a5c] px-4 text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/40"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
