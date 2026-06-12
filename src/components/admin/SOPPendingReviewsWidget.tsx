import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  User,
  Eye
} from 'lucide-react';
import { SOPDiffViewer } from './SOPDiffViewer';

interface PendingSOP {
  id: string;
  title: string;
  category: string;
  role_id: string;
  version: number;
  last_updated: string;
  change_summary: string;
  updated_by: string;
  latest_version?: {
    id: string;
    version_number: number;
    change_summary: string;
    changed_by: string;
    created_at: string;
    content_html?: string;
    previous_content_html?: string;
  };
}

interface SOPPendingReviewsWidgetProps {
  staffId: string;
  staffName: string;
  staffRole: string;
  compact?: boolean;
  onNavigateToSOPs?: () => void;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  'Success_Team': { label: 'Success Team', color: 'bg-amber-100 text-amber-800' },
  'Acquisition_Manager': { label: 'Acquisition', color: 'bg-indigo-100 text-indigo-800' },
  'Setup_Manager': { label: 'Setup', color: 'bg-emerald-100 text-emerald-800' },
  'Cross_Team': { label: 'All Teams', color: 'bg-purple-100 text-purple-800' },
};

export function SOPPendingReviewsWidget({ 
  staffId, 
  staffName, 
  staffRole, 
  compact = false,
  onNavigateToSOPs 
}: SOPPendingReviewsWidgetProps) {
  const [pendingSOPs, setPendingSOPs] = useState<PendingSOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [selectedSOPTitle, setSelectedSOPTitle] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const { toast } = useToast();

  // Announce changes to screen readers
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, []);

  useEffect(() => {
    fetchPendingSOPs();
  }, [staffId, staffRole]);

  const fetchPendingSOPs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-sop-repository', {
        body: {
          action: 'get_pending_acknowledgments',
          staff_id: staffId,
          staff_role: staffRole
        }
      });

      if (error) throw error;
      setPendingSOPs(data.pending || []);
      
      const count = data.pending?.length || 0;
      if (count > 0) {
        announce(`${count} SOP update${count !== 1 ? 's' : ''} pending your review`);
      }
    } catch (err: any) {
      console.error('Error fetching pending SOPs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (sop: PendingSOP) => {
    setAcknowledging(sop.id);
    announce(`Acknowledging ${sop.title}`);
    try {
      const { data, error } = await supabase.functions.invoke('manage-sop-repository', {
        body: {
          action: 'acknowledge_sop',
          sop_id: sop.id,
          staff_id: staffId,
          staff_name: staffName,
          staff_role: staffRole
        }
      });

      if (error) throw error;

      toast({
        title: 'SOP Acknowledged',
        description: `You've confirmed reading "${sop.title}"`
      });
      announce(`${sop.title} acknowledged successfully`);

      // Remove from pending list
      setPendingSOPs(prev => prev.filter(s => s.id !== sop.id));
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
      announce('Error acknowledging SOP');
    } finally {
      setAcknowledging(null);
    }
  };

  const handleViewDiff = async (sop: PendingSOP) => {
    announce(`Loading changes for ${sop.title}`);
    try {
      const { data, error } = await supabase.functions.invoke('manage-sop-repository', {
        body: {
          action: 'get_sop_diff',
          version_id: sop.latest_version?.id
        }
      });

      if (error) throw error;

      setSelectedVersion(data.version);
      setSelectedSOPTitle(sop.title);
      setDiffViewerOpen(true);
      announce(`Showing changes for ${sop.title}`);
    } catch (err: any) {
      toast({
        title: 'Error loading diff',
        description: err.message,
        variant: 'destructive'
      });
      announce('Error loading changes');
    }
  };

  if (loading) {
    return (
      <Card className={compact ? 'border-amber-200' : ''}>
        <CardContent className="py-6">
          <div 
            className="flex items-center justify-center gap-2 text-gray-500"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span>Loading SOP updates...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingSOPs.length === 0) {
    return (
      <Card className={compact ? 'border-green-200 bg-green-50' : ''}>
        <CardContent className="py-6">
          <div 
            className="flex items-center justify-center gap-2 text-green-700"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            <span>All SOPs reviewed - you're up to date!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <>
        {/* Screen reader announcements */}
        <div 
          className="sr-only" 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
        >
          {announcement}
        </div>

        <Card 
          className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50"
          role="alert"
          aria-label={`${pendingSOPs.length} SOP updates pending review`}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900">
                    {pendingSOPs.length} SOP Update{pendingSOPs.length !== 1 ? 's' : ''} Pending Review
                  </h3>
                  <p className="text-sm text-amber-700">
                    Please review and acknowledge the updated procedures
                  </p>
                </div>
              </div>
              <Button 
                onClick={onNavigateToSOPs}
                className="bg-amber-600 hover:bg-amber-700"
                aria-label="Review pending SOP updates now"
              >
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <SOPDiffViewer
          open={diffViewerOpen}
          onOpenChange={setDiffViewerOpen}
          version={selectedVersion}
          sopTitle={selectedSOPTitle}
        />
      </>
    );
  }

  return (
    <>
      {/* Screen reader announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
      </div>

      <Card 
        className="border-amber-200"
        role="region"
        aria-label="Pending SOP reviews"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="w-5 h-5 text-amber-600" aria-hidden="true" />
              Pending SOP Reviews
              <Badge 
                variant="destructive" 
                className="ml-2"
                aria-label={`${pendingSOPs.length} pending`}
              >
                {pendingSOPs.length}
              </Badge>
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchPendingSOPs}
              className="text-gray-500"
              aria-label="Refresh pending SOP list"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <ul className="space-y-3" role="list" aria-label="SOPs pending your review">
              {pendingSOPs.map((sop) => (
                <li 
                  key={sop.id}
                  className="border rounded-lg p-4 bg-white hover:border-amber-300 transition-colors"
                >
                  <article aria-labelledby={`sop-title-${sop.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 
                            id={`sop-title-${sop.id}`}
                            className="font-medium text-gray-900 truncate"
                          >
                            {sop.title}
                          </h4>
                          <Badge 
                            className={`text-xs ${roleLabels[sop.role_id]?.color || 'bg-gray-100'}`}
                            aria-label={`Team: ${roleLabels[sop.role_id]?.label || sop.role_id}`}
                          >
                            {roleLabels[sop.role_id]?.label || sop.role_id}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            aria-label={`Version ${sop.version}`}
                          >
                            v{sop.version}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{sop.category}</p>
                        
                        {sop.change_summary && (
                          <div 
                            className="mt-2 p-2 bg-amber-50 rounded text-sm text-amber-800"
                            role="note"
                            aria-label="Change summary"
                          >
                            <strong>What changed:</strong> {sop.change_summary}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            <time dateTime={sop.last_updated}>
                              {new Date(sop.last_updated).toLocaleDateString()}
                            </time>
                          </span>
                          {sop.updated_by && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" aria-hidden="true" />
                              {sop.updated_by}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDiff(sop)}
                        className="text-amber-700 border-amber-300 hover:bg-amber-50"
                        aria-label={`View changes for ${sop.title}`}
                      >
                        <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                        View Changes
                      </Button>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`acknowledge-${sop.id}`}
                            checked={false}
                            onCheckedChange={() => handleAcknowledge(sop)}
                            disabled={acknowledging === sop.id}
                            aria-describedby={`acknowledge-label-${sop.id}`}
                          />
                          <label 
                            id={`acknowledge-label-${sop.id}`}
                            htmlFor={`acknowledge-${sop.id}`}
                            className="text-sm text-gray-700 cursor-pointer"
                          >
                            I have read and understood this update
                          </label>
                        </div>
                        {acknowledging === sop.id && (
                          <Loader2 
                            className="w-4 h-4 animate-spin text-amber-600" 
                            aria-label="Acknowledging..."
                          />
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <SOPDiffViewer
        open={diffViewerOpen}
        onOpenChange={setDiffViewerOpen}
        version={selectedVersion}
        sopTitle={selectedSOPTitle}
      />
    </>
  );
}
