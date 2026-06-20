import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Clock, CheckCircle, XCircle, MapPin } from 'lucide-react';

interface InquiryTrackerProps {
  investorEmail: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: 'Submitted', color: 'bg-blue-100 text-blue-800', icon: Clock },
  contacted: { label: 'Contacted', color: 'bg-yellow-100 text-yellow-800', icon: MessageSquare },
  qualified: { label: 'Qualified', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: XCircle }
};

export function InquiryTracker({ investorEmail }: InquiryTrackerProps) {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchInquiries(); }, [investorEmail]);

  const fetchInquiries = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('investor-inquiries', { body: { action: 'list', investor_email: investorEmail } });
    setInquiries(data?.inquiries || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;

  if (inquiries.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600">No inquiries yet</h3>
        <p className="text-gray-500 mt-2">Submit an inquiry on a deal to track it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {inquiries.map(inq => {
        const status = statusConfig[inq.status] || statusConfig.new;
        const StatusIcon = status.icon;
        return (
          <Card key={inq.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{inq.properties?.city}, {inq.properties?.state} {inq.properties?.zip_code}</span>
                    <Badge className={status.color}><StatusIcon className="w-3 h-3 mr-1" />{status.label}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{inq.message || 'No message'}</p>
                  <p className="text-xs text-gray-400">Submitted {new Date(inq.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-500">{inq.properties?.bedrooms} bed / {inq.properties?.bathrooms} bath</p>
                  {inq.contacted_at && <p className="text-green-600 text-xs mt-1">Contacted {new Date(inq.contacted_at).toLocaleDateString()}</p>}
                </div>
              </div>
              {inq.staff_notes && (
                <div className="mt-3 pt-3 border-t bg-gray-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                  <p className="text-xs text-gray-500 font-medium">Staff Notes:</p>
                  <p className="text-sm text-gray-700">{inq.staff_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}