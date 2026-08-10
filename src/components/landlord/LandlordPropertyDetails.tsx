import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * What a landlord knows about their own building that we do not.
 *
 * Community rules, property rules and who to call when something breaks. This is the
 * information that stops an operator getting it wrong in month one, and the landlord is the
 * only person who has it.
 *
 * Framed as "so a partner knows before they move in" rather than as a form to complete,
 * because that is why it is being asked for.
 */

interface Props {
  landlordId: string;
  property: {
    id: string;
    address?: string;
    community_name?: string;
    community_rules_note?: string;
    property_rules_note?: string;
    maintenance_contact_name?: string;
    maintenance_contact_phone?: string;
    maintenance_contact_email?: string;
    maintenance_notes?: string;
  };
  onSaved?: () => void;
}

export function LandlordPropertyDetails({ landlordId, property, onSaved }: Props) {
  const [form, setForm] = useState({
    community_rules_note: property.community_rules_note || '',
    property_rules_note: property.property_rules_note || '',
    maintenance_contact_name: property.maintenance_contact_name || '',
    maintenance_contact_phone: property.maintenance_contact_phone || '',
    maintenance_contact_email: property.maintenance_contact_email || '',
    maintenance_notes: property.maintenance_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      const { data, error } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'save_property_details',
          landlord_id: landlordId,
          property_id: property.id,
          ...form,
        },
      });
      if (error) throw error;
      // The result is READ, not assumed from the absence of a thrown error. A handler can
      // return success:false with a reason and still resolve cleanly.
      if (!data?.success) throw new Error(data?.error || 'save failed');
      setStatus('Saved. Any partner we bring will see this before they ever move in.');
      onSaved?.();
    } catch {
      setStatus('We could not save that. Nothing was changed -- please try again, or tell your contact and they will add it for you.');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    id: keyof typeof form,
    label: string,
    help: string,
    opts: { multiline?: boolean; type?: string } = {},
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      <p id={`${id}-help`} className="mt-0.5 text-sm text-gray-600">
        {help}
      </p>
      {opts.multiline ? (
        <textarea
          id={id}
          value={form[id]}
          aria-describedby={`${id}-help`}
          onChange={(e) => setForm({ ...form, [id]: e.target.value })}
          rows={4}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1a3a5c] focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/30"
        />
      ) : (
        <input
          id={id}
          type={opts.type || 'text'}
          value={form[id]}
          aria-describedby={`${id}-help`}
          onChange={(e) => setForm({ ...form, [id]: e.target.value })}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1a3a5c] focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/30"
          style={{ minHeight: 44 }}
        />
      )}
    </div>
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900">
        About {property.community_name || property.address || 'this property'}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        None of this is required. It is the things you know about your building that we do not, and
        it is what stops a partner getting something wrong in their first month.
      </p>

      <div className="mt-5 space-y-5">
        {field(
          'community_rules_note',
          'Community rules',
          'Quiet hours, amenity access, parking, guest policy, anything an HOA or management office enforces.',
          { multiline: true },
        )}
        {field(
          'property_rules_note',
          'Property rules',
          'Anything specific to this building or unit -- pets, smoking, alterations, storage.',
          { multiline: true },
        )}

        <div className="border-t border-gray-100 pt-5">
          <h4 className="text-sm font-medium text-gray-900">Who to call when something breaks</h4>
          <p className="mt-0.5 text-sm text-gray-600">
            So a partner is not guessing at midnight. We will not share this until there is a signed
            lease.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {field('maintenance_contact_name', 'Name', 'Person or company.')}
            {field('maintenance_contact_phone', 'Phone', 'Best number to reach them.', { type: 'tel' })}
          </div>
          <div className="mt-4">
            {field('maintenance_contact_email', 'Email', 'Optional.', { type: 'email' })}
          </div>
          <div className="mt-4">
            {field(
              'maintenance_notes',
              'Anything else about maintenance',
              'Preferred vendors, what you handle yourself, what you would rather the operator handle.',
              { multiline: true },
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#1a3a5c] px-5 py-3 text-sm font-medium text-white hover:bg-[#24507d] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/40"
          style={{ minHeight: 44 }}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </span>
          ) : (
            'Save'
          )}
        </button>
        {status && (
          <p className="text-sm text-gray-700" role="status">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
