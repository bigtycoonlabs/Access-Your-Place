import { useState } from 'react';
import { Send, CheckCircle, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function LandlordInquiryForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'inquiry' | 'signup'>('signup');
  const [form, setForm] = useState({
    contact_name: '', company_name: '', email: '', phone: '', password: '', confirm_password: '',
    property_type: '', unit_count: '', location: '', account_type: 'private_landlord',
    corporate_leasing_interest: '', message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (form.password !== form.confirm_password) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (form.password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }

        const { data, error: regErr } = await supabase.functions.invoke('landlord-auth', {
          body: {
            action: 'register',
            email: form.email,
            password: form.password,
            contact_name: form.contact_name,
            company_name: form.company_name || null,
            phone: form.phone || null,
            account_type: form.account_type,
            location: form.location || null,
            unit_count: form.unit_count ? parseInt(form.unit_count) : null,
            property_type: form.property_type || null
          }
        });

        if (regErr || data?.error) {
          setError(data?.error || 'Registration failed. Please try again.');
          setLoading(false);
          return;
        }

        if (data?.session_token) {
          localStorage.setItem('landlord_session', data.session_token);
          localStorage.setItem('landlord_data', JSON.stringify(data.landlord));
          setSuccess(true);
          setTimeout(() => navigate('/landlord/portal'), 2000);
          return;
        }
      } else {
        await supabase.functions.invoke('manage-landlords', {
          body: { action: 'submit_inquiry', inquiry: { ...form, unit_count: form.unit_count ? parseInt(form.unit_count) : null } }
        });
      }
      setSuccess(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <section id="landlord-inquiry" className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-[#1a2332] mb-4">
            {mode === 'signup' ? 'Welcome to the Network!' : 'Thank You!'}
          </h2>
          <p className="text-gray-600 text-lg">
            {mode === 'signup'
              ? 'Your account has been created. Your status is "Pending Verification" — our team will reach out to schedule a Discovery Call. Redirecting to your portal...'
              : "We've received your inquiry and will contact you within 1-2 business days."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="landlord-inquiry" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">
            {mode === 'signup' ? 'Create Your Landlord Portal Account' : 'Partner With Us'}
          </h2>
          <p className="text-gray-600 text-lg">
            {mode === 'signup'
              ? 'Sign up to access the Landlord Operations Portal. Review applications, manage documents, and communicate with your team.'
              : 'Interested in streamlining your corporate leasing? Fill out this quick form and our team will reach out.'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`px-6 py-3 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                mode === 'signup' ? 'bg-[#1a2332] text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Create Account
            </button>
            <button
              type="button"
              onClick={() => setMode('inquiry')}
              className={`px-6 py-3 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                mode === 'inquiry' ? 'bg-[#1a2332] text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Send className="w-4 h-4" /> Just Inquire
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl p-8 space-y-6 border border-gray-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name *</label>
              <input type="text" required value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company/Community Name</label>
              <input type="text" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" />
            </div>
          </div>

          {mode === 'signup' && (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                  <input type="password" required value={form.confirm_password} onChange={e => setForm({...form, confirm_password: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Type *</label>
                <select value={form.account_type} onChange={e => setForm({...form, account_type: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574]">
                  <option value="private_landlord">Private Landlord (Individual Owner)</option>
                  <option value="management_company">Management Company (Multiple Properties)</option>
                </select>
              </div>
            </>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
              <select value={form.property_type} onChange={e => setForm({...form, property_type: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574]">
                <option value="">Select type</option>
                <option value="apartment_community">Apartment Community</option>
                <option value="single_family">Single Family Home</option>
                <option value="multi_family">Multi-Family Property</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Units</label>
              <input type="number" value={form.unit_count} onChange={e => setForm({...form, unit_count: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location (City, State)</label>
            <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" />
          </div>

          {mode === 'inquiry' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Corporate Leasing Interest</label>
                <select value={form.corporate_leasing_interest} onChange={e => setForm({...form, corporate_leasing_interest: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574]">
                  <option value="">Select option</option>
                  <option value="new_program">Starting a new corporate leasing program</option>
                  <option value="existing_program">Have an existing program, looking to streamline</option>
                  <option value="exploring">Just exploring options</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Information</label>
                <textarea rows={3} value={form.message} onChange={e => setForm({...form, message: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" placeholder="Tell us about your property or any specific requirements..." />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="w-full bg-[#d4a574] text-white py-4 rounded-lg font-semibold hover:bg-[#c49564] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-lg">
            {mode === 'signup' ? <UserPlus className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            {loading ? 'Processing...' : mode === 'signup' ? 'Create Account & Join Network' : 'Submit Inquiry'}
          </button>

          {mode === 'signup' && (
            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <button type="button" onClick={() => navigate('/landlord/login')} className="text-[#d4a574] font-medium hover:underline">
                Log in to your portal
              </button>
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
