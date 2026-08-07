import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Plus, Phone, Mail, Building, Users, Search, MessageSquare } from 'lucide-react';
import { LandlordDetailModal } from './LandlordDetailModal';
import { LandlordAnalytics } from './LandlordAnalytics';
import { SOPHelpButton } from './SOPHelpButton';

interface LandlordCRMTabProps {
  userRole?: string;
}

export function LandlordCRMTab({ userRole = 'Acquisition_Manager' }: LandlordCRMTabProps) {
  const [landlords, setLandlords] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLandlord, setSelectedLandlord] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchLandlords();
    fetchAnalytics();
    fetchFollowUps();
  }, []);

  const fetchLandlords = async () => {
    const { data } = await supabase.functions.invoke('manage-landlords', { body: { action: 'list' } });
    if (data?.landlords) setLandlords(data.landlords);
  };

  const fetchAnalytics = async () => {
    const { data } = await supabase.functions.invoke('manage-landlords', { body: { action: 'get_analytics' } });
    if (data?.analytics) setAnalytics(data.analytics);
  };

  const fetchFollowUps = async () => {
    const { data } = await supabase.functions.invoke('manage-landlords', { body: { action: 'get_follow_ups' } });
    if (data?.followUps) setFollowUps(data.followUps);
  };

  const filtered = landlords.filter(l => 
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with SOP Help */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1a365d]">Landlord CRM</h2>
          <p className="text-sm text-gray-600">Manage landlord relationships and outreach</p>
        </div>
        <div className="flex gap-2">
          <SOPHelpButton
            sopKey="Landlord Outreach"
            category="Landlord Outreach"
            userRole={userRole}
            buttonText="Outreach SOP"
            ariaLabel="View Landlord Outreach SOP"
          />
          <SOPHelpButton
            sopKey="Ocean307"
            category="Compliance"
            userRole={userRole}
            buttonText="Security SOP"
            ariaLabel="View Ocean307 Security Protocol"
          />
        </div>
      </div>

      <LandlordAnalytics analytics={analytics} followUps={followUps} />
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2"><Building className="w-5 h-5" /> Landlord Contacts</CardTitle>
            <Button onClick={() => setShowAddModal(true)} className="bg-[#d4a574]"><Plus className="w-4 h-4 mr-2" />Add Landlord</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input aria-label="Search landlords" placeholder="Search landlords..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          
          <div className="space-y-3">
            {filtered.map(landlord => (
              <div key={landlord.id} onClick={() => setSelectedLandlord(landlord)} className="border rounded-lg p-4 hover:border-[#d4a574] cursor-pointer transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{landlord.name}</h3>
                    {landlord.company_name && <p className="text-sm text-gray-600">{landlord.company_name}</p>}
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      {landlord.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{landlord.email}</span>}
                      {landlord.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{landlord.phone}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={landlord.status === 'active' ? 'default' : 'secondary'}>{landlord.status}</Badge>
                    <p className="text-xs text-gray-500 mt-1">{landlord.total_communications || 0} comms</p>
                    <p className="text-xs text-gray-500">{(landlord.response_rate || 0).toFixed(0)}% response</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedLandlord && (
        <LandlordDetailModal landlord={selectedLandlord} onClose={() => { setSelectedLandlord(null); fetchLandlords(); }} />
      )}
      
      {showAddModal && (
        <LandlordDetailModal landlord={null} onClose={() => { setShowAddModal(false); fetchLandlords(); }} isNew />
      )}
    </div>
  );
}
