import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, FileText, Home, FolderOpen, MessageSquare, Settings, LogOut,
  Bell, User, Shield, Clock, ChevronRight, AlertCircle
} from 'lucide-react';
import LandlordPortalApplications from '@/components/landlord/LandlordPortalApplications';
import LandlordPortalProperties from '@/components/landlord/LandlordPortalProperties';
import LandlordPortalDocuments from '@/components/landlord/LandlordPortalDocuments';
import LandlordPortalMessages from '@/components/landlord/LandlordPortalMessages';
import { LandlordPennyChat } from '@/components/landlord/LandlordPennyChat';

interface LandlordData {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  phone?: string;
  account_type?: string;
  status?: string;
  assigned_am_name?: string;
  discovery_call_completed?: boolean;
  location?: string;
}

export default function LandlordPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [landlord, setLandlord] = useState<LandlordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('applications');
  const [chatAppId, setChatAppId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ contact_name: '', company_name: '', phone: '', location: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    verifySession();
  }, []);

  const verifySession = async () => {
    const token = localStorage.getItem('landlord_session');
    if (!token) { navigate('/landlord/login'); return; }

    try {
      const { data } = await supabase.functions.invoke('landlord-auth', {
        body: { action: 'verify_session', session_token: token }
      });
      if (data?.landlord) {
        setLandlord(data.landlord);
        setProfileForm({
          contact_name: data.landlord.name || '',
          company_name: data.landlord.company_name || '',
          phone: data.landlord.phone || '',
          location: data.landlord.location || ''
        });
      } else {
        localStorage.removeItem('landlord_session');
        localStorage.removeItem('landlord_data');
        navigate('/landlord/login');
      }
    } catch (err) {
      // Try cached data
      const cached = localStorage.getItem('landlord_data');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setLandlord(parsed);
          setProfileForm({
            contact_name: parsed.name || '',
            company_name: parsed.company_name || '',
            phone: parsed.phone || '',
            location: parsed.location || ''
          });
        } catch { navigate('/landlord/login'); }
      } else {
        navigate('/landlord/login');
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('landlord_session');
    if (token) {
      await supabase.functions.invoke('landlord-auth', { body: { action: 'logout', session_token: token } });
    }
    localStorage.removeItem('landlord_session');
    localStorage.removeItem('landlord_data');
    navigate('/landlord/login');
  };

  const handleSaveProfile = async () => {
    if (!landlord) return;
    setSavingProfile(true);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'update_profile', landlord_id: landlord.id, ...profileForm }
      });
      if (data?.success) {
        setLandlord(data.landlord);
        localStorage.setItem('landlord_data', JSON.stringify(data.landlord));
        toast({ title: 'Profile Updated', description: 'Your profile has been saved.' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save profile', variant: 'destructive' });
    }
    setSavingProfile(false);
  };

  const openChatForApplication = (appId: string) => {
    setChatAppId(appId);
    setActiveTab('messages');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a2332] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Building2 className="w-8 h-8 text-[#d4a574]" />
          </div>
          <p className="text-gray-500">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!landlord) return null;

  const isPending = landlord.status === 'pending_verification';

  const tabs = [
    { id: 'applications', label: 'Applications', icon: FileText, count: 0 },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content link - WCAG 2.1 Level A: Bypass Blocks (2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Top Header */}

      <header className="bg-[#1a2332] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#d4a574] rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">Landlord Portal</h1>
                <p className="text-xs text-gray-400 hidden sm:block">Access Your Place</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-[#d4a574]" />
                <span>{landlord.name}</span>
                {landlord.company_name && <span className="text-gray-400">({landlord.company_name})</span>}
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
                <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Pending Verification Banner */}
      {isPending && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Account Pending Verification</p>
                <p className="text-xs text-yellow-600">Our team will reach out to schedule a Discovery Call. Some features are limited until verification is complete.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AM Assignment Banner */}
      {landlord.assigned_am_name && (
        <div className="bg-[#d4a574]/10 border-b border-[#d4a574]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-[#d4a574]" />
              <span className="text-[#1a2332]">Your Acquisition Manager: <strong>{landlord.assigned_am_name}</strong></span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            {/* Mobile toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-full bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between mb-3"
            >
              <span className="font-medium text-[#1a2332]">
                {tabs.find(t => t.id === activeTab)?.label || 'Menu'}
              </span>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${mobileMenuOpen ? 'rotate-90' : ''}`} />
            </button>

            <nav className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${mobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
              <div className="p-3">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); if (tab.id !== 'messages') setChatAppId(null); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-[#d4a574]/10 text-[#d4a574]'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-[#1a2332]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Account Info */}
              <div className="border-t border-gray-100 p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Account</div>
                <p className="text-sm font-medium text-[#1a2332]">{landlord.name}</p>
                <p className="text-xs text-gray-500">{landlord.email}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isPending ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {isPending ? <Clock className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                    {isPending ? 'Pending Verification' : 'Verified'}
                  </span>
                </div>
                {landlord.account_type === 'management_company' && (
                  <p className="text-xs text-gray-400 mt-1">Management Company Account</p>
                )}
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main id="main-content" className="flex-1 min-w-0" role="main">

            {activeTab === 'applications' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[#1a2332]">Corporate Applications</h2>
                  <p className="text-gray-500 mt-1">Track real-time progress of each application through every stage — from submission to signed lease.</p>
                </div>
                <LandlordPortalApplications
                  landlordId={landlord.id}
                  landlordName={landlord.name}
                  onOpenChat={openChatForApplication}
                />
              </div>
            )}


            {activeTab === 'properties' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[#1a2332]">My Properties</h2>
                  <p className="text-gray-500 mt-1">Submit new properties for analysis and track their approval status.</p>
                </div>
                <LandlordPortalProperties landlordId={landlord.id} />
              </div>
            )}

            {activeTab === 'documents' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[#1a2332]">Document Library</h2>
                  <p className="text-gray-500 mt-1">Your "Rules of Engagement" — property rules, parking maps, HOA bylaws, and more.</p>
                </div>
                <LandlordPortalDocuments landlordId={landlord.id} />
              </div>
            )}

            {activeTab === 'messages' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[#1a2332]">Communication Center</h2>
                  <p className="text-gray-500 mt-1">
                    {chatAppId ? 'Messages about a specific application' : 'Direct communication with your Acquisition Manager and Success Team.'}
                  </p>
                  {chatAppId && (
                    <button onClick={() => setChatAppId(null)} className="text-sm text-[#d4a574] hover:underline mt-1">
                      View all messages
                    </button>
                  )}
                </div>
                <LandlordPortalMessages
                  landlordId={landlord.id}
                  landlordName={landlord.name}
                  applicationId={chatAppId}
                />
              </div>
            )}

            {activeTab === 'settings' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[#1a2332]">Account Settings</h2>
                  <p className="text-gray-500 mt-1">Manage your profile and account preferences.</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="contact-name">Contact Name</label>
                      <input id="contact-name"
                        type="text"
                        value={profileForm.contact_name}
                        onChange={e => setProfileForm({...profileForm, contact_name: e.target.value})}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="company-name">Company Name</label>
                      <input id="company-name"
                        type="text"
                        value={profileForm.company_name}
                        onChange={e => setProfileForm({...profileForm, company_name: e.target.value})}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">Phone</label>
                      <input id="phone"
                        type="tel"
                        value={profileForm.phone}
                        onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="location">Location</label>
                      <input id="location"
                        type="text"
                        value={profileForm.location}
                        onChange={e => setProfileForm({...profileForm, location: e.target.value})}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                    <input id="email" type="email" value={landlord.email} disabled className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500" />
                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact support if needed.</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="bg-[#d4a574] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#c49564] transition-colors disabled:opacity-50 text-sm"
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                {/* Account Status */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
                  <h3 className="font-semibold text-[#1a2332] mb-4">Account Status</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Type</span>
                      <span className="font-medium capitalize">{(landlord.account_type || 'private_landlord').replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Verification Status</span>
                      <span className={`font-medium ${isPending ? 'text-yellow-600' : 'text-green-600'}`}>
                        {isPending ? 'Pending Verification' : 'Verified'}
                      </span>
                    </div>
                    {landlord.assigned_am_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Acquisition Manager</span>
                        <span className="font-medium">{landlord.assigned_am_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Penny for LANDLORDS. Not the operator Penny -- that one is written for the other
          side of the table and is told never to reveal the operator's margin, which would
          put her on the wrong side of her own rule in front of a property owner. */}
      {landlord?.id && (
        <LandlordPennyChat landlordId={landlord.id} landlordName={landlord.name} />
      )}
    </div>
  );
}
