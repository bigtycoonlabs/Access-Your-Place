import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * PaymentMethodPanel
 *
 * Renders the payment rails from the single canonical source
 * (company_payment_methods, via the get-payment-methods edge function).
 *
 * Nothing here is hardcoded. If the owner retires a rail or changes a
 * destination, this panel follows without a deploy.
 *
 * ACCESSIBILITY IS THE PRIMARY CONSTRAINT, not decoration:
 *  - Every destination is a labelled, readonly, selectable text field, so a
 *    screen reader user can hear it, and can also select it manually if the
 *    clipboard is unavailable.
 *  - Every copy control has an explicit accessible name naming WHAT it copies
 *    ("Copy Bitcoin wallet address"), never a bare "Copy".
 *  - Copy results are announced through an aria-live region. A silent copy is
 *    indistinguishable from a failed copy without sight.
 *  - Copy failures are reported honestly rather than showing a success state.
 *  - Controls meet a 44px minimum target.
 *
 * A dropped character in a wallet address or routing number sends a client's
 * money somewhere unrecoverable, so the destination values are never
 * paraphrased, reformatted, or line-wrapped for looks.
 */

interface PaymentField {
  key: string;
  label: string;
  value: string;
}

interface PaymentMethod {
  id: string;
  method_type: string;
  label: string;
  instructions: string;
  fields: PaymentField[];
  recipient_note: string | null;
  network: string | null;
  display_order: number;
}

export default function PaymentMethodPanel() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const announceTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-payment-methods', { body: {} });
        if (cancelled) return;

        if (error || !data?.success) {
          setLoadError(
            'We could not load payment details right now. Please refresh, or contact your acquisition manager rather than sending funds to an address from another source.',
          );
          setMethods([]);
        } else {
          setMethods(Array.isArray(data.methods) ? data.methods : []);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            'We could not load payment details right now. Please refresh, or contact your acquisition manager rather than sending funds to an address from another source.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (announceTimer.current) window.clearTimeout(announceTimer.current);
    };
  }, []);

  const announce = useCallback((message: string) => {
    setAnnouncement('');
    // Re-setting after a tick guarantees the live region fires even when the
    // same message repeats (copying the same field twice).
    announceTimer.current = window.setTimeout(() => setAnnouncement(message), 60);
  }, []);

  const handleCopy = useCallback(
    async (field: PaymentField, methodLabel: string) => {
      try {
        if (!navigator?.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(field.value);
        announce(`${field.label} for ${methodLabel} copied to clipboard.`);
      } catch {
        // Never claim success we did not achieve.
        announce(
          `Could not copy the ${field.label}. Select the text in the ${field.label} field and copy it manually.`,
        );
      }
    },
    [announce],
  );

  return (
    <section aria-labelledby="payment-methods-heading" className="space-y-4">
      <h2 id="payment-methods-heading" className="text-xl font-semibold text-slate-900">
        How to pay
      </h2>

      <p className="text-sm text-slate-600">
        Choose the method that suits you. After sending, attach a screenshot of the completed payment so our
        team can confirm it and credit your account.
      </p>

      {/* Announcements for screen reader users. Visually hidden, always present. */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading payment methods…
        </p>
      )}

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {!loading && !loadError && methods.length === 0 && (
        <Alert>
          <AlertDescription>
            No payment methods are currently available. Please contact your acquisition manager.
          </AlertDescription>
        </Alert>
      )}

      {methods.map((method) => (
        <Card key={method.id}>
          <CardHeader>
            <CardTitle className="text-lg">{method.label}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {method.instructions && (
              <p className="text-sm leading-relaxed text-slate-700">{method.instructions}</p>
            )}

            {/* Shown BEFORE the account fields, so a client understands the name
                mismatch before sending rather than after. */}
            {method.recipient_note && (
              <Alert>
                <AlertDescription className="text-sm leading-relaxed">
                  {method.recipient_note}
                </AlertDescription>
              </Alert>
            )}

            {method.network && (
              <p className="text-sm font-medium text-slate-800">Network: {method.network}</p>
            )}

            <div className="space-y-3">
              {method.fields.map((field) => {
                const inputId = `${method.id}-${field.key}`;
                return (
                  <div key={field.key} className="space-y-1">
                    <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
                      {field.label}
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        id={inputId}
                        readOnly
                        value={field.value}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full min-h-[44px] rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900"
                      />
                      <Button
                        type="button"
                        onClick={() => handleCopy(field, method.label)}
                        aria-label={`Copy ${field.label} for ${method.label}`}
                        className="min-h-[44px] shrink-0"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {method.method_type === 'bitcoin' && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm leading-relaxed">
                  Use the Copy button rather than typing this address. Bitcoin transfers cannot be reversed,
                  and a single altered character sends the funds somewhere unrecoverable.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
