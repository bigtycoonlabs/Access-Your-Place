import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, Info } from 'lucide-react';

/**
 * What a landlord sees first.
 *
 * The point of this screen is trust. A landlord has handed us their building and wants to
 * know one thing: is anybody actually working on it. So it leads with where each property
 * stands in plain words, says outright when nothing is needed from them, and states the
 * commercial truth without being asked -- they pay nothing.
 *
 * Every status string comes from ayp_landlord_overview, the same source Penny reads, so the
 * screen and the assistant can never disagree.
 */

interface Props {
  landlordId: string;
  landlordName?: string;
}

interface Property {
  id: string;
  address: string;
  city?: string;
  state?: string;
  units?: number;
  stage: string;
  stage_detail: string;
  lease_preference: string;
  onboarding_style: string;
  needs_from_you: string[];
}

const LEASE_CHOICES = [
  {
    value: 'master_lease',
    title: 'Use the Access Your Place master lease',
    detail: 'We hold the lease with you and place the operator underneath it. Your agreement is with us.',
  },
  {
    value: 'direct_with_partner',
    title: 'Lease directly with the partner we bring',
    detail: 'We find and verify the operator, introduce you, and step back. Your agreement is with them.',
  },
  {
    value: 'open_to_both',
    title: 'Open to either',
    detail: 'Show us both and we will decide when there is a real partner on the table.',
  },
];

const ONBOARDING_CHOICES = [
  { value: 'we_handle_paperwork', title: 'You handle the paperwork', detail: 'We prepare everything and walk you through it.' },
  { value: 'landlord_handles', title: 'I will handle it', detail: 'Send us what you need and we will supply it.' },
  { value: 'their_own_process', title: 'Use my own process', detail: 'We fit into however you already onboard a tenant.' },
];

export function LandlordHome({ landlordId, landlordName }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [contact, setContact] = useState<string | null>(null);
  const [saving, setSaving] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'landlord_overview', landlord_id: landlordId },
      });
      if (fnErr) throw fnErr;
      if (!data?.success) throw new Error(data?.error || 'load failed');
      setProperties(data.properties || []);
      setContact(data.your_contact || null);
    } catch {
      // A failed read is NOT "you have no properties". Those are different facts and a
      // landlord would act on them very differently.
      setError('We could not load your properties just now. This is on our side, not yours -- nothing has changed with your listing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (landlordId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  const choose = async (propertyId: string, field: 'lease_preference' | 'onboarding_style', value: string) => {
    setSaving(propertyId + field);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'set_lease_preference', property_id: propertyId, landlord_id: landlordId, [field]: value },
      });
      if (data?.success) await load();
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-gray-600" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading your properties...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {landlordName ? `Hello ${landlordName.split(' ')[0]}` : 'Your properties'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Listing with us costs you nothing. We find a corporate lease partner for your property and
          verify them before you ever speak to them.
          {contact ? ` ${contact} is your contact here.` : ''}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          {error}
        </p>
      )}

      {!error && properties.length === 0 && (
        <p className="rounded-lg bg-gray-50 px-4 py-4 text-sm text-gray-700">
          You have not added a property yet. When you do, this page will show exactly where it stands.
        </p>
      )}

      {properties.map((p) => (
        <section key={p.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900">
            {p.address}
            {p.city ? `, ${p.city}` : ''} {p.state || ''}
          </h3>

          <p className="mt-3 text-sm font-medium text-[#1a3a5c]">{p.stage}</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">{p.stage_detail}</p>

          {/* Saying "nothing is needed" out loud matters as much as listing what is. A
              landlord who is told to wait, and trusts that, is better served than one given
              busywork to look attentive. */}
          {p.needs_from_you.length === 0 ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Nothing is needed from you right now. We will come to you when there is something to decide.</span>
            </p>
          ) : (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900">When you have a moment</p>
              <ul className="mt-2 space-y-1">
                {p.needs_from_you.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-sm text-gray-700">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 border-t border-gray-100 pt-5">
            <h4 className="text-sm font-medium text-gray-900">How would you like the lease handled?</h4>
            <p className="mt-1 text-sm text-gray-600">
              There is no wrong answer here, and you can change it any time before anything is signed.
            </p>
            <div className="mt-3 space-y-2">
              {LEASE_CHOICES.map((c) => {
                const active = p.lease_preference === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => choose(p.id, 'lease_preference', c.value)}
                    disabled={saving === p.id + 'lease_preference'}
                    aria-pressed={active}
                    className={`block w-full rounded-lg border px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/40 ${
                      active ? 'border-[#1a3a5c] bg-[#1a3a5c]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ minHeight: 44 }}
                  >
                    <span className="block text-sm font-medium text-gray-900">
                      {c.title}
                      {active ? ' -- selected' : ''}
                    </span>
                    <span className="mt-0.5 block text-sm text-gray-600">{c.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-5">
            <h4 className="text-sm font-medium text-gray-900">And the paperwork?</h4>
            <div className="mt-3 space-y-2">
              {ONBOARDING_CHOICES.map((c) => {
                const active = p.onboarding_style === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => choose(p.id, 'onboarding_style', c.value)}
                    disabled={saving === p.id + 'onboarding_style'}
                    aria-pressed={active}
                    className={`block w-full rounded-lg border px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/40 ${
                      active ? 'border-[#1a3a5c] bg-[#1a3a5c]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ minHeight: 44 }}
                  >
                    <span className="block text-sm font-medium text-gray-900">
                      {c.title}
                      {active ? ' -- selected' : ''}
                    </span>
                    <span className="mt-0.5 block text-sm text-gray-600">{c.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
