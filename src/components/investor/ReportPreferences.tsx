
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, FileText, Mail, Calendar, BarChart3, 
  PieChart, TrendingUp, Building2, Sparkles, Save,
  Plus, X, CheckCircle, Clock
} from 'lucide-react';

interface Props {
  investorId: string;
}

interface ReportPreferences {
  id: string;
  auto_reports_enabled: boolean;
  report_frequency: string;
  include_revenue_trends: boolean;
  include_occupancy_charts: boolean;
  include_market_comparison: boolean;
  include_top_performers: boolean;
  include_ai_recommendations: boolean;
  include_property_details: boolean;
  email_recipients: string[];
  preferred_format: string;
}

interface Report {
  id: string;
  report_month: number;
  report_year: number;
  status: string;
  generation_completed_at?: string;
  email_sent_at?: string;
  email_status?: string;
}

export function ReportPreferences({ investorId }: Props) {
  const [preferences, setPreferences] = useState<ReportPreferences | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch preferences
      const { data: prefsData } = await supabase.functions.invoke('generate-monthly-report', {
        body: { action: 'get_preferences', investor_id: investorId }
      });
      
      if (prefsData?.preferences) {
        setPreferences(prefsData.preferences);
      }

      // Fetch report history
      const { data: reportsData } = await supabase.functions.invoke('generate-monthly-report', {
        body: { action: 'get_reports', investor_id: investorId }
      });
      
      if (reportsData?.reports) {
        setReports(reportsData.reports);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({ title: 'Error', description: 'Failed to load report settings', variant: 'destructive' });
    }
    setLoading(false);
  }, [investorId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const savePreferences = async () => {
    if (!preferences) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-monthly-report', {
        body: { 
          action: 'update_preferences', 
          investor_id: investorId,
          preferences: {
            auto_reports_enabled: preferences.auto_reports_enabled,
            report_frequency: preferences.report_frequency,
            include_revenue_trends: preferences.include_revenue_trends,
            include_occupancy_charts: preferences.include_occupancy_charts,
            include_market_comparison: preferences.include_market_comparison,
            include_top_performers: preferences.include_top_performers,
            include_ai_recommendations: preferences.include_ai_recommendations,
            include_property_details: preferences.include_property_details,
            email_recipients: preferences.email_recipients,
            preferred_format: preferences.preferred_format
          }
        }
      });

      if (error) throw error;

      toast({ title: 'Saved', description: 'Report preferences updated successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-monthly-report', {
        body: { action: 'generate_report', investor_id: investorId }
      });

      if (error) throw error;

      toast({ 
        title: 'Report Generated', 
        description: 'Your monthly report has been generated successfully.' 
      });
      
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const sendReportEmail = async (reportId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-monthly-report', {
        body: { action: 'send_report_email', report_id: reportId }
      });

      if (error) throw error;

      toast({ title: 'Email Sent', description: 'Report email sent successfully' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const addEmailRecipient = () => {
    if (!newEmail || !preferences) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    
    setPreferences({
      ...preferences,
      email_recipients: [...(preferences.email_recipients || []), newEmail]
    });
    setNewEmail('');
  };

  const removeEmailRecipient = (email: string) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      email_recipients: preferences.email_recipients.filter(e => e !== email)
    });
  };

  const getMonthName = (month: number) => {
    return new Date(2024, month - 1, 1).toLocaleString('default', { month: 'long' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#d4a574]" />
            Monthly Reports
          </h2>
          <p className="text-gray-500">
            Configure automated portfolio reports and view report history
          </p>
        </div>
        <Button
          onClick={generateReport}
          disabled={generating}
          className="bg-[#d4a574] hover:bg-[#c49464]"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          Generate Report Now
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle>Report Settings</CardTitle>
            <CardDescription>Customize your monthly portfolio reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto Reports Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Automatic Reports</Label>
                <p className="text-sm text-gray-500">
                  Receive reports automatically on the 1st of each month
                </p>
              </div>
              <Switch
                checked={preferences?.auto_reports_enabled || false}
                onCheckedChange={(checked) => 
                  setPreferences(prev => prev ? { ...prev, auto_reports_enabled: checked } : null)
                }
              />
            </div>

            <Separator />

            {/* Report Sections */}
            <div className="space-y-4">
              <Label className="text-base">Include in Reports</Label>
              
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Revenue Trends</span>
                  </div>
                  <Switch
                    checked={preferences?.include_revenue_trends || false}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => prev ? { ...prev, include_revenue_trends: checked } : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Occupancy Charts</span>
                  </div>
                  <Switch
                    checked={preferences?.include_occupancy_charts || false}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => prev ? { ...prev, include_occupancy_charts: checked } : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Market Comparison</span>
                  </div>
                  <Switch
                    checked={preferences?.include_market_comparison || false}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => prev ? { ...prev, include_market_comparison: checked } : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Top Performers</span>
                  </div>
                  <Switch
                    checked={preferences?.include_top_performers || false}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => prev ? { ...prev, include_top_performers: checked } : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">AI Recommendations</span>
                  </div>
                  <Switch
                    checked={preferences?.include_ai_recommendations || false}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => prev ? { ...prev, include_ai_recommendations: checked } : null)
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Email Recipients */}
            <div className="space-y-3">
              <Label className="text-base">Additional Email Recipients</Label>
              <p className="text-sm text-gray-500">
                Reports will also be sent to these email addresses
              </p>
              
              <div className="flex gap-2">
                <Input aria-label="email@example.com"
                  type="email"
                  placeholder="email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEmailRecipient()}
                />
                <Button variant="outline" onClick={addEmailRecipient}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {preferences?.email_recipients && preferences.email_recipients.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {preferences.email_recipients.map((email) => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1">
                      {email}
                      <button onClick={() => removeEmailRecipient(email)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={savePreferences} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        {/* Report History Card */}
        <Card>
          <CardHeader>
            <CardTitle>Report History</CardTitle>
            <CardDescription>View and resend previous reports</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Reports Yet</h3>
                <p className="text-gray-500 mt-2">
                  Generate your first report to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div 
                    key={report.id} 
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">
                          {getMonthName(report.report_month)} {report.report_year}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          {report.status === 'completed' ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Generated
                            </Badge>
                          ) : report.status === 'generating' ? (
                            <Badge className="bg-blue-100 text-blue-800">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Generating
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" />
                              {report.status}
                            </Badge>
                          )}
                          
                          {report.email_sent_at && (
                            <Badge variant="outline">
                              <Mail className="w-3 h-3 mr-1" />
                              Emailed
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {report.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendReportEmail(report.id)}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          {report.email_sent_at ? 'Resend' : 'Send Email'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <Calendar className="w-4 h-4" />
        <AlertDescription>
          Automated reports are generated and sent on the 1st of each month at 9:00 AM UTC. 
          Reports include data from the previous month.
        </AlertDescription>
      </Alert>
    </div>
  );
}
