import { CheckCircle, Circle, Clock, AlertCircle, Edit, ArrowRight } from 'lucide-react';

interface TimelineEntry {
  stage: string;
  date: string;
  by?: string;
  notes?: string;
}

interface PortfolioStatusTimelineProps {
  timeline: TimelineEntry[];
  currentStatus: string;
  compact?: boolean;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  submitted: { label: 'Submitted', color: 'text-blue-600', bgColor: 'bg-blue-500', icon: Clock },
  review: { label: 'Under Review', color: 'text-yellow-600', bgColor: 'bg-yellow-500', icon: Clock },
  edited: { label: 'Details Updated', color: 'text-purple-600', bgColor: 'bg-purple-500', icon: Edit },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-500', icon: CheckCircle },
  rejected: { label: 'Needs Changes', color: 'text-red-600', bgColor: 'bg-red-500', icon: AlertCircle },
};

export function PortfolioStatusTimeline({ timeline, currentStatus, compact = false }: PortfolioStatusTimelineProps) {
  const statusToStage = currentStatus === 'active' ? 'approved' : currentStatus === 'rejected' ? 'rejected' : currentStatus === 'pending_approval' ? 'submitted' : 'submitted';
  const timelineStages = new Set(timeline.map(t => t.stage));

  // Build display stages
  const stages = ['submitted', 'review', 'approved'];
  if (timelineStages.has('edited')) stages.splice(2, 0, 'edited');
  if (timelineStages.has('rejected') || statusToStage === 'rejected') {
    const approvedIdx = stages.indexOf('approved');
    if (approvedIdx !== -1) stages[approvedIdx] = 'rejected';
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {stages.map((stageKey, idx) => {
          const config = STAGE_CONFIG[stageKey] || STAGE_CONFIG.submitted;
          const entry = timeline.find(t => t.stage === stageKey);
          const isActive = timelineStages.has(stageKey);
          const isCurrent = stageKey === statusToStage;

          return (
            <div key={stageKey} className="flex items-center gap-1">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  isActive ? config.bgColor + ' text-white' : 'bg-gray-200 text-gray-400'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-current' : ''}`}
                title={`${config.label}${entry ? ` - ${new Date(entry.date).toLocaleDateString()}` : ''}`}
              >
                {isActive ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-2.5 h-2.5" />}
              </div>
              {idx < stages.length - 1 && (
                <div className={`w-4 h-0.5 ${isActive ? 'bg-gray-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <ArrowRight className="w-4 h-4" />Approval Timeline
      </h4>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {stages.map((stageKey) => {
            const config = STAGE_CONFIG[stageKey] || STAGE_CONFIG.submitted;
            const entry = timeline.find(t => t.stage === stageKey);
            const isActive = timelineStages.has(stageKey);
            const isCurrent = stageKey === statusToStage;
            const Icon = config.icon;

            return (
              <div key={stageKey} className="flex items-start gap-3 relative">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 shrink-0 ${
                  isActive ? config.bgColor + ' text-white' : 'bg-gray-200 text-gray-400'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className={`flex-1 ${!isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isActive ? config.color : 'text-gray-400'}`}>
                      {config.label}
                    </span>
                    {isCurrent && isActive && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Current</span>
                    )}
                  </div>
                  {entry && (
                    <div className="mt-0.5">
                      <p className="text-xs text-gray-500">
                        {new Date(entry.date).toLocaleString()}
                        {entry.by && ` by ${entry.by}`}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-gray-600 mt-0.5 bg-gray-50 rounded p-1.5 border">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
