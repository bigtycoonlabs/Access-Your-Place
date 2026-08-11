/**
 * RequestSetupForm
 *
 * Setup is a service in its own right. An operator can ask us to launch a property they
 * already own, whether they found it themselves or acquired it through us.
 *
 * Before this existed there was no request path at all: a setup project could only be
 * created by a staff member by hand, and the operator's empty state told them to wait
 * for their acquisition manager. That is a wall in front of a service we sell
 * separately, and it is why the setup_projects table has never held a row.
 *
 * Identity comes from the session on the server, never from a field here, so nobody can
 * raise a request in somebody else's name.
 */
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

function getInvestorSessionToken(): string | null {
  try {
    const direct = window.localStorage.getItem('investorSessionToken');
    if (direct) return direct;
    const raw = window.localStorage.getItem('investorSession');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.session_token || parsed?.token || null;
  } catch {
    return null;
  }
}

interface Props {
  onRequested?: () => void;
}

export function RequestSetupForm({ onRequested }: Props) {
  const [form, setForm] = useState({
    property_address: '',
    city_state: '',
    num_properties: '1',
    num_beds: '',
    property_type: 'apartment',
    target_start_date: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const { toast } = useToast();

  const submit = async () => {
    if (!form.property_address.trim()) {
      setAnnouncement('The property address is required.');
      toast({
        title: 'Address needed',
        description: 'Tell us the address of the property you want launched.',
        variant: 'destructive',
      });
      return;
    }

    const token = getInvestorSessionToken();
    if (!token) {
      window.location.href = '/investor/login?redirect=/investor/portal';
      return;
    }

    setSubmitting(true);
    setAnnouncement('Sending your request.');
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'request_setup', session_token: token, request: form },
      });

      // Never report this as sent unless the function says it saved. A request that
      // silently failed would leave somebody waiting for a call that is not coming.
      if (error || !data?.success) {
        const message =
          data?.message ||
          'We could not save your request. Please try again, or email success@accessyourplace.com.';
        setAnnouncement(message);
        toast({ title: 'Request not sent', description: message, variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      setDone(true);
      setAnnouncement(
        'Your request is in. A setup manager will contact you to run the consultation and scope the launch.',
      );
      if (!data.staff_notified) {
        // Said out loud rather than hidden: the project saved but the alert did not.
        toast({
          title: 'Request saved',
          description:
            'Your request saved, but our alert to the team did not go out. Please email success@accessyourplace.com so nobody misses it.',
        });
      }
      onRequested?.();
    } catch {
      const message = 'We could not save your request. Please try again, or email success@accessyourplace.com.';
      setAnnouncement(message);
      toast({ title: 'Request not sent', description: message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h3 className="text-lg font-semibold text-emerald-900">Your request is in</h3>
        <p role="status" aria-live="polite" className="mt-2 text-emerald-800">
          A setup manager will contact you to run the consultation and scope the launch.
          Nothing is charged until you have agreed the scope.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="request-setup-heading" className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 id="request-setup-heading" className="text-lg font-semibold text-[#1a2332]">
        Ask us to launch a property
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        You do not need to have acquired it through us. Furniture, freight, junk removal,
        technology install and styling, from sourcing to a guest checking in. One unit or
        an entire building, across the US and into Mexico.
      </p>

      <p aria-live="polite" role="status" className="sr-only">{announcement}</p>

      <div className="mt-5 grid gap-4">
        <div>
          <Label htmlFor="setup-address">Property address</Label>
          <Input
            id="setup-address"
            value={form.property_address}
            onChange={(e) => setForm({ ...form, property_address: e.target.value })}
            placeholder="1900 Euclid Ave, Unit 801"
            autoCapitalize="words"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="setup-city">City and state</Label>
            <Input
              id="setup-city"
              value={form.city_state}
              onChange={(e) => setForm({ ...form, city_state: e.target.value })}
              placeholder="Cleveland, OH"
            />
          </div>
          <div>
            <Label htmlFor="setup-units">How many units</Label>
            <Input
              id="setup-units"
              type="number"
              min={1}
              value={form.num_properties}
              onChange={(e) => setForm({ ...form, num_properties: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="setup-beds">Bedrooms per unit</Label>
            <Input
              id="setup-beds"
              type="number"
              min={0}
              value={form.num_beds}
              onChange={(e) => setForm({ ...form, num_beds: e.target.value })}
              placeholder="2"
            />
          </div>
          <div>
            <Label htmlFor="setup-type">Property type</Label>
            <select
              id="setup-type"
              value={form.property_type}
              onChange={(e) => setForm({ ...form, property_type: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="apartment">Apartment</option>
              <option value="condo">Condo</option>
              <option value="townhome">Townhome</option>
              <option value="single_family">Single family</option>
              <option value="high_rise">High rise</option>
              <option value="building">Entire building</option>
            </select>
          </div>
          <div>
            <Label htmlFor="setup-date">Target start date</Label>
            <Input
              id="setup-date"
              type="date"
              value={form.target_start_date}
              onChange={(e) => setForm({ ...form, target_start_date: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="setup-notes">Anything we should know</Label>
          <Textarea
            id="setup-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Lease starts 1 September. Building has a service elevator that needs booking. This is a teardown of an existing operation."
          />
        </div>

        <Button
          onClick={submit}
          disabled={submitting}
          className="h-12 w-full bg-[#1a365d] text-lg hover:bg-[#12283f]"
        >
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {submitting ? 'Sending your request' : 'Request a setup'}
        </Button>
        <p className="text-xs leading-relaxed text-gray-600">
          Nothing is charged now. A setup manager runs the consultation and scopes the launch
          with you before anything is agreed.
        </p>
      </div>
    </section>
  );
}

export default RequestSetupForm;
