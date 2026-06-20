import { useState } from 'react';
import {
  Inbox, Search, CheckCircle, XCircle, FileSignature, ShieldCheck,
  Clock, ChevronDown, ChevronUp, User
} from 'lucide-react';

interface StageHistoryEntry {
  stage: string;
  timestamp: string;
  actor: string;
}

interface ApplicationStages {
  current_stage: string;
  stage_received_at?: string;
  stage_under_review_at?: string;
  stage_approved_at?: string;
  stage_denied_at?: string;
  stage_lease_generated_at?: string;
  stage_lease_signed_at?: string;
  stage_history?: StageHistoryEntry[];
  denial_reason?: string;
  status_notes?: string;
}

interface Props {
  application: ApplicationStages;
  compact?: boolean;
}

interface StageConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  timestampKey: keyof ApplicationStages;
  description: string;
}

const STAGES: StageConfig[] = [
  {
    key: 'received',
    label: 'Received',
    icon: Inbox,
    timestampKey: 'stage_received_at',
    description: 'Application has been submitted and received'
  },
  {
    key: 'under_review',
    label: 'Under Review',
    icon: Search,
    timestampKey: 'stage_under_review_at',
    description: 'Application is being reviewed by the team'
  },
  {
    key: 'decision',
    label: 'Decision',
    icon: CheckCircle,
    timestampKey: 'stage_approved_at',
    description: 'Application has been approved or denied'
  },
  {
    key: 'lease_generated',
    label: 'Lease Generated',
    icon: FileSignature,
    timestampKey: 'stage_lease_generated_at',
    description: 'Master lease document has been generated'
  },
  {
    key: 'lease_signed',
    label: 'Lease Signed',
    icon: ShieldCheck,
    timestampKey: 'stage_lease_signed_at',
    description: 'Lease has been fully executed and signed'
  }
];

function getStageIndex(currentStage: string): number {
  const mapping: Record<string, number> = {
    'received': 0,
    'under_review': 1,
    'approved': 2,
    'denied': 2,
    'lease_generated': 3,
    'lease_signed': 4
  };
  return mapping[currentStage] ?? 0;
}

function isDenied(currentStage: string): boolean {
  return currentStage === 'denied';
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getRelativeTime(ts?: string): string {
  if (!ts) return '';
  const now = new Date();
  const then = new Date(ts);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(ts);
}

export default function ApplicationStatusTracker({ application, compact = false }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const currentStageIndex = getStageIndex(application.current_stage);
  const denied = isDenied(application.current_stage);

  const getDecisionTimestamp = (): string | undefined => {
    if (denied) return application.stage_denied_at as string | undefined;
    return application.stage_approved_at as string | undefined;
  };

  const getStageStatus = (stageIdx: number): 'completed' | 'current' | 'denied' | 'upcoming' => {
    if (denied && stageIdx === 2) return 'denied';
    if (denied && stageIdx > 2) return 'upcoming';
    if (stageIdx < currentStageIndex) return 'completed';
    if (stageIdx === currentStageIndex) return 'current';
    return 'upcoming';
  };

  const getStageTimestamp = (stage: StageConfig, stageIdx: number): string | undefined => {
    if (stageIdx === 2) {
      // Decision stage - check both approved and denied
      return (application.stage_approved_at || application.stage_denied_at) as string | undefined;
    }
    return application[stage.timestampKey] as string | undefined;
  };

  // Calculate progress percentage
  const totalStages = STAGES.length;
  const progressPercent = denied
    ? ((2 + 1) / totalStages) * 100
    : ((currentStageIndex + 1) / totalStages) * 100;

  const history = Array.isArray(application.stage_history) ? application.stage_history : [];

  const stageLabels: Record<string, string> = {
    'received': 'Received',
    'under_review': 'Under Review',
    'approved': 'Approved',
    'denied': 'Denied',
    'lease_generated': 'Lease Generated',
    'lease_signed': 'Lease Signed'
  };

  if (compact) {
    return (
      <div className="w-full">
        {/* Compact progress bar */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                denied ? 'bg-red-500' : currentStageIndex === totalStages - 1 ? 'bg-green-500' : 'bg-[#d4a574]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
            {denied ? 'Denied' : `${currentStageIndex + 1}/${totalStages}`}
          </span>
        </div>
        {/* Stage dots */}
        <div className="flex items-center justify-between">
          {STAGES.map((stage, idx) => {
            const status = getStageStatus(idx);
            const ts = getStageTimestamp(stage, idx);
            return (
              <div key={stage.key} className="flex flex-col items-center" style={{ width: `${100 / totalStages}%` }}>
                <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                  status === 'completed' ? 'bg-green-500 border-green-500' :
                  status === 'current' ? 'bg-[#d4a574] border-[#d4a574] ring-4 ring-[#d4a574]/20' :
                  status === 'denied' ? 'bg-red-500 border-red-500' :
                  'bg-white border-gray-300'
                }`} />
                <span className={`text-[10px] mt-1 text-center leading-tight ${
                  status === 'current' ? 'font-semibold text-[#1a2332]' :
                  status === 'denied' ? 'font-semibold text-red-600' :
                  status === 'completed' ? 'text-green-700' :
                  'text-gray-400'
                }`}>
                  {idx === 2 && denied ? 'Denied' : stage.label}
                </span>
                {ts && (
                  <span className="text-[9px] text-gray-400 mt-0.5">{getRelativeTime(ts)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-[#1a2332] to-[#2a3a4f]">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-semibold text-sm">Application Progress</h4>
            <p className="text-gray-400 text-xs mt-0.5">
              {denied
                ? 'This application has been denied'
                : currentStageIndex === totalStages - 1
                  ? 'Application process complete!'
                  : `Currently at: ${STAGES[currentStageIndex]?.label || 'Unknown'}`
              }
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
            denied ? 'bg-red-500/20 text-red-300' :
            currentStageIndex === totalStages - 1 ? 'bg-green-500/20 text-green-300' :
            'bg-[#d4a574]/20 text-[#d4a574]'
          }`}>
            {denied ? 'Denied' : `Step ${currentStageIndex + 1} of ${totalStages}`}
          </div>
        </div>
        {/* Full-width progress bar */}
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              denied ? 'bg-red-400' : currentStageIndex === totalStages - 1 ? 'bg-green-400' : 'bg-[#d4a574]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stage Steps */}
      <div className="px-5 py-5">
        <div className="relative">
          {STAGES.map((stage, idx) => {
            const status = getStageStatus(idx);
            const Icon = idx === 2 && denied ? XCircle : stage.icon;
            const ts = getStageTimestamp(stage, idx);
            const isLast = idx === STAGES.length - 1;

            return (
              <div key={stage.key} className="relative flex gap-4">
                {/* Vertical line connector */}
                {!isLast && (
                  <div className="absolute left-[19px] top-[40px] w-0.5 h-[calc(100%-24px)]">
                    <div className={`w-full h-full ${
                      status === 'completed' ? 'bg-green-400' :
                      status === 'current' ? 'bg-gradient-to-b from-[#d4a574] to-gray-200' :
                      status === 'denied' ? 'bg-gradient-to-b from-red-400 to-gray-200' :
                      'bg-gray-200'
                    }`} />
                  </div>
                )}

                {/* Icon circle */}
                <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  status === 'completed'
                    ? 'bg-green-100 border-2 border-green-400 shadow-sm shadow-green-100'
                    : status === 'current'
                      ? 'bg-[#d4a574]/10 border-2 border-[#d4a574] shadow-md shadow-[#d4a574]/20 ring-4 ring-[#d4a574]/10'
                      : status === 'denied'
                        ? 'bg-red-100 border-2 border-red-400 shadow-sm shadow-red-100'
                        : 'bg-gray-50 border-2 border-gray-200'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    status === 'completed' ? 'text-green-600' :
                    status === 'current' ? 'text-[#d4a574]' :
                    status === 'denied' ? 'text-red-500' :
                    'text-gray-300'
                  }`} />
                </div>

                {/* Content */}
                <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className={`text-sm font-semibold ${
                        status === 'completed' ? 'text-green-700' :
                        status === 'current' ? 'text-[#1a2332]' :
                        status === 'denied' ? 'text-red-700' :
                        'text-gray-400'
                      }`}>
                        {idx === 2 && denied ? 'Denied' : idx === 2 && application.stage_approved_at ? 'Approved' : stage.label}
                      </h5>
                      <p className={`text-xs mt-0.5 ${
                        status === 'upcoming' ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        {idx === 2 && denied
                          ? (application.denial_reason || 'Application was not approved')
                          : stage.description
                        }
                      </p>
                    </div>
                    {ts && (
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-xs font-medium ${
                          status === 'completed' ? 'text-green-600' :
                          status === 'current' ? 'text-[#d4a574]' :
                          status === 'denied' ? 'text-red-500' :
                          'text-gray-400'
                        }`}>
                          {getRelativeTime(ts)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {formatTimestamp(ts)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Current stage indicator */}
                  {status === 'current' && !denied && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg w-fit">
                      <div className="w-2 h-2 bg-[#d4a574] rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-[#d4a574]">Current Stage</span>
                    </div>
                  )}

                  {/* Denied indicator */}
                  {status === 'denied' && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg w-fit">
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-600">Process Stopped</span>
                    </div>
                  )}

                  {/* Completed checkmark */}
                  {status === 'completed' && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg w-fit">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs font-medium text-green-600">Completed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage History Toggle */}
      {history.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-5 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="font-medium">Stage History</span>
              <span className="text-xs text-gray-400">({history.length} transitions)</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHistory && (
            <div className="px-5 pb-4">
              <div className="space-y-2">
                {[...history].reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg text-sm"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      entry.stage === 'denied' ? 'bg-red-400' :
                      entry.stage === 'approved' ? 'bg-green-400' :
                      entry.stage === 'lease_signed' ? 'bg-green-500' :
                      'bg-[#d4a574]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[#1a2332]">
                        {stageLabels[entry.stage] || entry.stage}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {entry.actor && entry.actor !== 'system' && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {entry.actor}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
