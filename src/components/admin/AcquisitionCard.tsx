
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, User, Clock, ArrowRight } from 'lucide-react';

const stageLabels: Record<string, { label: string; color: string }> = {
  application_review: { label: 'Application Review', color: 'bg-blue-100 text-blue-800' },
  landlord_negotiation: { label: 'Landlord Negotiation', color: 'bg-yellow-100 text-yellow-800' },
  lease_signing: { label: 'Lease Signing', color: 'bg-purple-100 text-purple-800' },
  property_setup: { label: 'Property Setup', color: 'bg-orange-100 text-orange-800' },
  operations_handoff: { label: 'Operations Handoff', color: 'bg-teal-100 text-teal-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' }
};

const statusLabels: Record<string, { label: string; color: string }> = {
  in_progress: { label: 'In Progress', color: 'bg-blue-500' },
  pending: { label: 'Pending', color: 'bg-yellow-500' },
  awaiting_info: { label: 'Awaiting Info', color: 'bg-orange-500' },
  on_hold: { label: 'On Hold', color: 'bg-gray-500' },
  completed: { label: 'Completed', color: 'bg-green-500' }
};

interface Props {
  acquisition: any;
  onClick: () => void;
}

export function AcquisitionCard({ acquisition, onClick }: Props) {
  const stage = stageLabels[acquisition.workflow_stage] || stageLabels.application_review;
  const status = statusLabels[acquisition.workflow_status] || statusLabels.in_progress;
  const investor = acquisition.investors;

  return (
    <Card className="cursor-pointer hover:shadow-md transition" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[#d4a574]" />
              <h3 className="font-semibold text-[#1a365d]">{acquisition.full_address}</h3>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {investor && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {investor.full_name} {investor.company_name && `(${investor.company_name})`}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(acquisition.updated_at).toLocaleDateString()}
              </span>
            </div>
            {acquisition.assigned_staff && (
              <p className="text-xs text-gray-500 mt-1">Assigned: {acquisition.assigned_staff}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={stage.color}>{stage.label}</Badge>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${status.color}`} />
              <span className="text-xs text-gray-500">{status.label}</span>
            </div>
            {acquisition.acquisition_fee && (
              <p className="text-sm font-semibold text-green-600">${acquisition.acquisition_fee.toLocaleString()}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end mt-2 text-[#d4a574] text-sm">
          View Details <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}
