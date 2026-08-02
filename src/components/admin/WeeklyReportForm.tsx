
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  ClipboardCheck, Users, Handshake, Building2, MessageSquare,
  Loader2, Calendar, CheckCircle, AlertCircle, Eye
} from 'lucide-react';

interface WeeklyReport {
  id: string;
  staff_id: string;
  staff_name: string;
  week_start: string;
  week_end: string;
  client_volume: number;
  closings: number;
  new_inventory: number;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_feedback: string | null;
  created_at: string;
  updated_at: string;
}

interface WeeklyReportFormProps {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
}

export function WeeklyReportForm({ staffId, staffName, isAdmin }: WeeklyReportFormProps) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [formData, setFormData] = useState({
    client_volume: '', closings: '', new_inventory: '', notes: ''
  });
  const { toast } = useToast();

  // Calculate current week info
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isFriday = dayOfWeek === 5;
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'get_weekly_reports', staff_id: staffId, is_admin: isAdmin }
    });
    if (data?.reports) {
      // Client-side safety filter: when not admin (e.g. AM), only show own reports
      // even if the edge function returns records for other staff (defense-in-depth)
      const allReports = data.reports as WeeklyReport[];
      const filteredReports = !isAdmin ? allReports.filter(r => r.staff_id === staffId) : allReports;
      setReports(filteredReports);
      
      // Pre-fill form if current week report exists (always check own reports)
      const currentWeekReport = filteredReports.find((r: WeeklyReport) =>
        r.staff_id === staffId && r.week_start === weekStart.toISOString().split('T')[0]
      );
      if (currentWeekReport) {
        setFormData({
          client_volume: currentWeekReport.client_volume.toString(),
          closings: currentWeekReport.closings.toString(),
          new_inventory: currentWeekReport.new_inventory.toString(),
          notes: currentWeekReport.notes || ''
        });
      }
    }
    setLoading(false);
  }, [staffId, isAdmin]);


  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: {
        action: 'submit_weekly_report',
        staff_id: staffId,
        staff_name: staffName,
        ...formData
      }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Report Submitted', description: `Weekly report for ${weekLabel} saved.` });
      loadData();
    }
    setSubmitting(false);
  };

  const handleReview = async () => {
    if (!selectedReport) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: {
        action: 'review_weekly_report',
        staff_id: staffId,
        report_id: selectedReport.id,
        reviewed_by: staffName,
        admin_feedback: reviewFeedback
      }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Report Reviewed' });
      setShowReviewModal(false);
      loadData();
    }
    setSubmitting(false);
  };

  const currentWeekSubmitted = reports.some(r =>
    r.staff_id === staffId && r.week_start === weekStart.toISOString().split('T')[0]
  );

  return (
    <div className="space-y-6">
      {/* Current Week Form */}
      <Card className={isFriday ? 'border-amber-300 bg-amber-50/30' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#1a365d]" />
                Weekly Report
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                {weekLabel}
                {isFriday && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs ml-2">
                    <AlertCircle className="w-3 h-3 mr-1" /> Due Today
                  </Badge>
                )}
              </CardDescription>
            </div>
            {currentWeekSubmitted && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                <CheckCircle className="w-3 h-3 mr-1" /> Submitted
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-4 h-4 text-blue-500" />
                Active Clients Engaged
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.client_volume}
                onChange={(e) => setFormData({ ...formData, client_volume: e.target.value })}
                placeholder="0"
                className="text-center text-lg font-semibold"
              />
              <p className="text-xs text-gray-400 mt-1">How many active clients did you engage this week?</p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Handshake className="w-4 h-4 text-emerald-500" />
                Deals Closed (Signed Lease)
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.closings}
                onChange={(e) => setFormData({ ...formData, closings: e.target.value })}
                placeholder="0"
                className="text-center text-lg font-semibold"
              />
              <p className="text-xs text-gray-400 mt-1">How many deals moved to 'Signed Lease' this week?</p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-4 h-4 text-purple-500" />
                New Inventory Submitted
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.new_inventory}
                onChange={(e) => setFormData({ ...formData, new_inventory: e.target.value })}
                placeholder="0"
                className="text-center text-lg font-semibold"
              />
              <p className="text-xs text-gray-400 mt-1">How many new Landlords/Properties were submitted?</p>
            </div>
          </div>
          <div className="mb-4">
            <Label className="flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              Notes & Blockers
            </Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Blockers, wins, or assistance needed from Success Team..."
              rows={3}
            />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#1a365d] w-full sm:w-auto">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {currentWeekSubmitted ? 'Update Report' : 'Submit Report'}
          </Button>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No reports submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Week</th>
                    {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600">Staff</th>}
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Clients</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Closings</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Inventory</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.map(report => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-medium">
                        {new Date(report.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(report.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      {isAdmin && <td className="px-4 py-3">{report.staff_name}</td>}
                      <td className="px-4 py-3 text-center font-semibold text-blue-700">{report.client_volume}</td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-700">{report.closings}</td>
                      <td className="px-4 py-3 text-center font-semibold text-purple-700">{report.new_inventory}</td>
                      <td className="px-4 py-3 text-center">
                        {report.reviewed_at ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">Reviewed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Pending</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedReport(report);
                            setReviewFeedback(report.admin_feedback || '');
                            setShowReviewModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review/View Dialog */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-lg" aria-describedby="review-report-desc">
          <DialogHeader>
            <DialogTitle>Weekly Report Details</DialogTitle>
            <DialogDescription id="review-report-desc">
              {selectedReport?.staff_name} - {selectedReport && `${new Date(selectedReport.week_start).toLocaleDateString()} to ${new Date(selectedReport.week_end).toLocaleDateString()}`}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{selectedReport.client_volume}</p>
                    <p className="text-xs text-gray-500">Clients</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{selectedReport.closings}</p>
                    <p className="text-xs text-gray-500">Closings</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">{selectedReport.new_inventory}</p>
                    <p className="text-xs text-gray-500">Inventory</p>
                  </CardContent>
                </Card>
              </div>
              {selectedReport.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">Staff Notes:</p>
                  <p className="text-sm text-gray-600">{selectedReport.notes}</p>
                </div>
              )}
              {isAdmin && (
                <div>
                  <Label>Admin Feedback</Label>
                  <Textarea
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    placeholder="Provide feedback on this report..."
                    rows={3}
                  />
                </div>
              )}
              {selectedReport.admin_feedback && !isAdmin && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-700 mb-1">Manager Feedback:</p>
                  <p className="text-sm text-blue-600">{selectedReport.admin_feedback}</p>
                  {selectedReport.reviewed_by && (
                    <p className="text-xs text-blue-400 mt-2">— {selectedReport.reviewed_by}</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>Close</Button>
            {isAdmin && (
              <Button onClick={handleReview} disabled={submitting} className="bg-[#1a365d]">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Feedback
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
