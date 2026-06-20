import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Clock, CheckCircle, AlertCircle, Info, Download, Upload,
  ChevronDown, ChevronUp, MessageSquare, File, ExternalLink, Eye,
  XCircle, Search, Inbox, FileSignature, ShieldCheck, RefreshCw
} from 'lucide-react';
import ApplicationStatusTracker from './ApplicationStatusTracker';

interface Application {
  id: string;
  client_name: string;
  client_business_name?: string;
  community_name?: string;
  unit_number?: string;
  property_name?: string;
  pdf_url?: string;
  pdf_filename?: string;
  status: string;
  status_notes?: string;
  lease_url?: string;
  lease_filename?: string;
  submitted_by?: string;
  created_at: string;
  updated_at: string;
  // Stage tracking fields
  current_stage?: string;
  stage_received_at?: string;
  stage_under_review_at?: string;
  stage_approved_at?: string;
  stage_denied_at?: string;
  stage_lease_generated_at?: string;
  stage_lease_signed_at?: string;
  stage_history?: Array<{ stage: string; timestamp: string; actor: string }>;
  denial_reason?: string;
}

interface Props {
  landlordId: string;
  landlordName: string;
  onOpenChat?: (applicationId: string) => void;
}

export default function LandlordPortalApplications({ landlordId, landlordName, onOpenChat }: Props) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchApplications();
  }, [landlordId]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'get_applications', landlord_id: landlordId }
      });
      if (data?.applications) setApplications(data.applications);
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchApplications();
    setRefreshing(false);
    toast({ title: 'Refreshed', description: 'Application statuses updated.' });
  };

  const updateStatus = async (appId: string, newStatus: string, notes?: string) => {
    setUpdatingId(appId);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'update_application_status',
          application_id: appId,
          status: newStatus,
          status_notes: notes,
          actor_name: landlordName
        }
      });
      if (data?.success) {
        toast({ title: 'Status Updated', description: `Application marked as "${newStatus}"` });
        fetchApplications();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
    setUpdatingId(null);
  };

  const getCurrentStageLabel = (app: Application): string => {
    const stage = app.current_stage || 'received';
    const labels: Record<string, string> = {
      'received': 'Received',
      'under_review': 'Under Review',
      'approved': 'Approved',
      'denied': 'Denied',
      'lease_generated': 'Lease Generated',
      'lease_signed': 'Lease Signed'
    };
    return labels[stage] || stage;
  };

  const getStageBadge = (app: Application) => {
    const stage = app.current_stage || 'received';
    const config: Record<string, { bg: string; icon: React.ElementType }> = {
      received: { bg: 'bg-blue-100 text-blue-700', icon: Inbox },
      under_review: { bg: 'bg-amber-100 text-amber-700', icon: Search },
      approved: { bg: 'bg-green-100 text-green-700', icon: CheckCircle },
      denied: { bg: 'bg-red-100 text-red-700', icon: XCircle },
      lease_generated: { bg: 'bg-purple-100 text-purple-700', icon: FileSignature },
      lease_signed: { bg: 'bg-emerald-100 text-emerald-700', icon: ShieldCheck },
    };
    const c = config[stage] || config.received;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${c.bg}`}>
        <Icon className="w-3.5 h-3.5" />
        {getCurrentStageLabel(app)}
      </span>
    );
  };

  // Map stage-based filter
  const getFilteredApps = () => {
    if (statusFilter === 'all') return applications;
    if (statusFilter === 'active') {
      return applications.filter(a => {
        const s = a.current_stage || 'received';
        return !['denied', 'lease_signed'].includes(s);
      });
    }
    if (statusFilter === 'completed') {
      return applications.filter(a => a.current_stage === 'lease_signed');
    }
    if (statusFilter === 'denied') {
      return applications.filter(a => a.current_stage === 'denied');
    }
    return applications.filter(a => (a.current_stage || 'received') === statusFilter);
  };

  const filtered = getFilteredApps();

  const counts = {
    all: applications.length,
    active: applications.filter(a => {
      const s = a.current_stage || 'received';
      return !['denied', 'lease_signed'].includes(s);
    }).length,
    received: applications.filter(a => (a.current_stage || 'received') === 'received').length,
    under_review: applications.filter(a => a.current_stage === 'under_review').length,
    approved: applications.filter(a => a.current_stage === 'approved').length,
    lease_generated: applications.filter(a => a.current_stage === 'lease_generated').length,
    lease_signed: applications.filter(a => a.current_stage === 'lease_signed').length,
    denied: applications.filter(a => a.current_stage === 'denied').length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
            <div className="h-2 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1a2332] uppercase tracking-wide">Application Pipeline</h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#d4a574] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Visual pipeline stages */}
        <div className="flex items-center gap-1 mb-4">
          {[
            { stage: 'received', label: 'Received', color: 'bg-blue-500', count: counts.received },
            { stage: 'under_review', label: 'Reviewing', color: 'bg-amber-500', count: counts.under_review },
            { stage: 'approved', label: 'Approved', color: 'bg-green-500', count: counts.approved },
            { stage: 'lease_generated', label: 'Lease Gen.', color: 'bg-purple-500', count: counts.lease_generated },
            { stage: 'lease_signed', label: 'Signed', color: 'bg-emerald-500', count: counts.lease_signed },
          ].map((s, idx) => {
            const total = counts.all || 1;
            const width = Math.max((s.count / total) * 100, s.count > 0 ? 8 : 2);
            return (
              <div
                key={s.stage}
                className={`${s.color} h-3 rounded-full transition-all duration-500 cursor-pointer hover:opacity-80 relative group`}
                style={{ width: `${width}%`, minWidth: s.count > 0 ? '32px' : '8px' }}
                onClick={() => setStatusFilter(s.stage)}
              >
                {/* Tooltip */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1a2332] text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {s.label}: {s.count}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1a2332]" />
                </div>
              </div>
            );
          })}
          {counts.denied > 0 && (
            <div
              className="bg-red-500 h-3 rounded-full transition-all duration-500 cursor-pointer hover:opacity-80 relative group"
              style={{ width: `${Math.max((counts.denied / (counts.all || 1)) * 100, 8)}%`, minWidth: '32px' }}
              onClick={() => setStatusFilter('denied')}
            >
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1a2332] text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Denied: {counts.denied}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1a2332]" />
              </div>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'received', label: 'Received', count: counts.received },
            { key: 'under_review', label: 'Under Review', count: counts.under_review },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'lease_generated', label: 'Lease Generated', count: counts.lease_generated },
            { key: 'completed', label: 'Completed', count: counts.lease_signed },
            ...(counts.denied > 0 ? [{ key: 'denied', label: 'Denied', count: counts.denied }] : []),
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === f.key
                  ? 'bg-[#d4a574] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Applications List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {statusFilter === 'all' ? 'No Applications Yet' : `No ${statusFilter.replace('_', ' ')} Applications`}
          </h3>
          <p className="text-gray-400">
            {statusFilter === 'all'
              ? 'Corporate applications will appear here once submitted by your Acquisition Manager.'
              : 'Try selecting a different filter to see other applications.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(app => (
            <div key={app.id} className="bg-white rounded-xl border border-gray-200 hover:border-[#d4a574]/30 transition-all overflow-hidden">
              {/* Header with compact progress */}
              <div className="p-5">
                <div
                  className="cursor-pointer"
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#1a2332] rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-[#d4a574]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-[#1a2332]">{app.client_name}</h3>
                          {app.pdf_url && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                              <File className="w-3 h-3" /> PDF
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
                          {app.client_business_name && <span>{app.client_business_name}</span>}
                          {app.community_name && <span>at {app.community_name}</span>}
                          {app.unit_number && <span>Unit {app.unit_number}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {getStageBadge(app)}
                      <span className="text-xs text-gray-400 hidden sm:inline">{new Date(app.created_at).toLocaleDateString()}</span>
                      {expandedId === app.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Compact progress bar (always visible) */}
                  <div className="mt-2">
                    <ApplicationStatusTracker
                      application={{
                        current_stage: app.current_stage || 'received',
                        stage_received_at: app.stage_received_at,
                        stage_under_review_at: app.stage_under_review_at,
                        stage_approved_at: app.stage_approved_at,
                        stage_denied_at: app.stage_denied_at,
                        stage_lease_generated_at: app.stage_lease_generated_at,
                        stage_lease_signed_at: app.stage_lease_signed_at,
                        stage_history: app.stage_history,
                        denial_reason: app.denial_reason,
                        status_notes: app.status_notes,
                      }}
                      compact={true}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === app.id && (
                <div className="border-t border-gray-100">
                  {/* Full Status Tracker */}
                  <div className="p-5 bg-gray-50/50">
                    <ApplicationStatusTracker
                      application={{
                        current_stage: app.current_stage || 'received',
                        stage_received_at: app.stage_received_at,
                        stage_under_review_at: app.stage_under_review_at,
                        stage_approved_at: app.stage_approved_at,
                        stage_denied_at: app.stage_denied_at,
                        stage_lease_generated_at: app.stage_lease_generated_at,
                        stage_lease_signed_at: app.stage_lease_signed_at,
                        stage_history: app.stage_history,
                        denial_reason: app.denial_reason,
                        status_notes: app.status_notes,
                      }}
                    />
                  </div>

                  {/* Application Details & Actions */}
                  <div className="p-5 border-t border-gray-100">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Application Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Client:</span><span className="font-medium">{app.client_name}</span></div>
                          {app.client_business_name && <div className="flex justify-between"><span className="text-gray-500">Business:</span><span className="font-medium">{app.client_business_name}</span></div>}
                          {app.community_name && <div className="flex justify-between"><span className="text-gray-500">Community:</span><span className="font-medium">{app.community_name}</span></div>}
                          {app.unit_number && <div className="flex justify-between"><span className="text-gray-500">Unit:</span><span className="font-medium">{app.unit_number}</span></div>}
                          <div className="flex justify-between"><span className="text-gray-500">Submitted:</span><span className="font-medium">{new Date(app.created_at).toLocaleString()}</span></div>
                          {app.submitted_by && <div className="flex justify-between"><span className="text-gray-500">Submitted By:</span><span className="font-medium">{app.submitted_by}</span></div>}
                        </div>

                        {/* PDF Document Section */}
                        {app.pdf_url && (
                          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <File className="w-5 h-5 text-indigo-600" />
                              <h5 className="font-semibold text-indigo-800 text-sm">Application Document</h5>
                            </div>
                            {app.pdf_filename && (
                              <p className="text-xs text-indigo-600 mb-3 truncate">{app.pdf_filename}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={app.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Download PDF
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPdfViewer(showPdfViewer === app.id ? null : app.id);
                                }}
                                className="inline-flex items-center gap-2 bg-white border border-indigo-300 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                                {showPdfViewer === app.id ? 'Hide Preview' : 'Preview PDF'}
                              </button>
                              <a
                                href={app.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-white border border-indigo-300 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Open in New Tab
                              </a>
                            </div>

                            {showPdfViewer === app.id && (
                              <div className="mt-3 rounded-lg overflow-hidden border border-indigo-200 bg-white">
                                <iframe
                                  src={`${app.pdf_url}#toolbar=1&navpanes=0`}
                                  className="w-full h-[500px]"
                                  title={`Application PDF - ${app.client_name}`}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {app.status_notes && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                            <p className="text-sm text-yellow-800"><strong>Notes:</strong> {app.status_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Actions</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {app.current_stage !== 'approved' && app.current_stage !== 'denied' && app.current_stage !== 'lease_generated' && app.current_stage !== 'lease_signed' && (
                            <button
                              onClick={() => updateStatus(app.id, 'approved')}
                              disabled={updatingId === app.id}
                              className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" /> Approve
                            </button>
                          )}
                          {app.current_stage !== 'under_review' && app.current_stage !== 'approved' && app.current_stage !== 'lease_generated' && app.current_stage !== 'lease_signed' && (
                            <button
                              onClick={() => updateStatus(app.id, 'pending')}
                              disabled={updatingId === app.id}
                              className="flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                              <Clock className="w-4 h-4" /> Under Review
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const notes = prompt('What additional information is needed?');
                              if (notes) updateStatus(app.id, 'info_needed', notes);
                            }}
                            disabled={updatingId === app.id}
                            className="flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                          >
                            <Info className="w-4 h-4" /> Info Needed
                          </button>
                          {onOpenChat && (
                            <button
                              onClick={() => onOpenChat(app.id)}
                              className="flex items-center justify-center gap-2 bg-[#d4a574] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#c49564] transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" /> Chat with AM
                            </button>
                          )}
                        </div>

                        {/* Lease section for approved apps */}
                        {(app.current_stage === 'approved' || app.current_stage === 'lease_generated') && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-2">
                            <p className="text-sm text-green-800 font-medium mb-2">
                              {app.current_stage === 'lease_generated' ? 'Lease Has Been Generated' : 'Application Approved'}
                            </p>
                            {app.lease_url ? (
                              <a href={app.lease_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-green-700 text-sm hover:underline">
                                <Download className="w-4 h-4" /> View Lease Document
                              </a>
                            ) : (
                              <p className="text-sm text-green-600">The lease document will appear here once generated by the team.</p>
                            )}
                          </div>
                        )}

                        {/* Completed section */}
                        {app.current_stage === 'lease_signed' && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className="w-5 h-5 text-emerald-600" />
                              <p className="text-sm text-emerald-800 font-semibold">Lease Fully Executed</p>
                            </div>
                            <p className="text-sm text-emerald-600">This application has been completed. The lease is signed and active.</p>
                            {app.lease_url && (
                              <a href={app.lease_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-emerald-700 text-sm hover:underline mt-2">
                                <Download className="w-4 h-4" /> Download Signed Lease
                              </a>
                            )}
                          </div>
                        )}

                        {/* Denied section */}
                        {app.current_stage === 'denied' && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <XCircle className="w-5 h-5 text-red-500" />
                              <p className="text-sm text-red-800 font-semibold">Application Denied</p>
                            </div>
                            {app.denial_reason && (
                              <p className="text-sm text-red-600">Reason: {app.denial_reason}</p>
                            )}
                            {app.status_notes && !app.denial_reason && (
                              <p className="text-sm text-red-600">Notes: {app.status_notes}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
