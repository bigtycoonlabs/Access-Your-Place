import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Mail, Send, Eye, Loader2, Search, Users, CheckCircle, XCircle,
  RefreshCw, Play, Clock, Bot, Sparkles, AlertTriangle, BarChart3,
  Building2, Calendar, ChevronDown, Edit3, Save
} from 'lucide-react';

interface Investor {
  id: string;
  full_name: string;
  email: string;
  preferred_markets?: string[];
  status?: string;
}

interface DigestPreview {
  name: string;
  email: string;
  portfolio: number;
  avg_score: number;
  markets: string[];
  alerts: any[];
  is_no_portfolio: boolean;
  new_deals: number;
}

interface BatchLog {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  metadata?: { sent?: number; failed?: number; total?: number; ms?: number };
}

interface SendLog {
  id: string;
  recipient_name: string;
  recipient_email: string;
  status: string;
  created_at: string;
  metadata?: { portfolio?: number; is_no_portfolio?: boolean };
}

export function WeeklyDigestManager() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewData, setPreviewData] = useState<DigestPreview | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchLogs, setBatchLogs] = useState<BatchLog[]>([]);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [sentThisWeek, setSentThisWeek] = useState(0);
  const [failedThisWeek, setFailedThisWeek] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedHtml, setEditedHtml] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load investors for search
  useEffect(() => {
    loadInvestors();
    loadStats();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadInvestors = async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'list_investors', limit: 500 }
      });
      if (data?.investors) {
        setInvestors(data.investors);
      }
    } catch (err) {
      console.error('Failed to load investors:', err);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await supabase.functions.invoke('investor-weekly-digest', {
        body: { action: 'get_digest_stats' }
      });
      if (data?.success) {
        setBatchLogs(data.recent_batches || []);
        setSendLogs(data.recent_sends || []);
        setSentThisWeek(data.total_sent_this_week || 0);
        setFailedThisWeek(data.total_failed_this_week || 0);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
    setStatsLoading(false);
  };

  const filteredInvestors = investors.filter(inv => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (inv.full_name || '').toLowerCase().includes(q) || (inv.email || '').toLowerCase().includes(q);
  });

  const handleSelectInvestor = (inv: Investor) => {
    setSelectedInvestor(inv);
    setSearchQuery(inv.full_name || inv.email);
    setShowDropdown(false);
    setPreviewHtml('');
    setPreviewData(null);
    setIsEditing(false);
  };

  const handlePreview = async () => {
    if (!selectedInvestor) return;
    setPreviewLoading(true);
    setPreviewHtml('');
    setPreviewData(null);
    setIsEditing(false);
    try {
      const { data, error } = await supabase.functions.invoke('investor-weekly-digest', {
        body: { action: 'preview_digest', investor_id: selectedInvestor.id }
      });
      if (error) throw error;
      if (data?.success) {
        setPreviewHtml(data.html || '');
        setEditedHtml(data.html || '');
        setPreviewData(data.preview || null);
        toast({ title: 'Preview generated', description: `Digest preview for ${selectedInvestor.full_name}` });
      } else {
        throw new Error(data?.error || 'Preview failed');
      }
    } catch (err: any) {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
    }
    setPreviewLoading(false);
  };

  const handleSendTest = async () => {
    if (!selectedInvestor) return;
    setSendingTest(true);
    try {
      const body: any = { action: 'send_single_digest', investor_id: selectedInvestor.id };
      // If staff edited the HTML, send the custom version
      if (isEditing && editedHtml !== previewHtml) {
        body.custom_html = editedHtml;
      }
      const { data, error } = await supabase.functions.invoke('investor-weekly-digest', { body });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: data.email_sent ? 'Digest sent!' : 'Digest processed (email delivery pending)',
          description: `Sent to ${selectedInvestor.email}${data.is_no_portfolio ? ' (no portfolio — tips & tricks email)' : ''}`
        });
        loadStats();
      } else {
        throw new Error(data?.error || 'Send failed');
      }
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    }
    setSendingTest(false);
  };

  const handleBatchSend = async () => {
    if (!confirm('This will send weekly digest emails to ALL eligible investors. Are you sure?')) return;
    setSendingBatch(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-weekly-digest', {
        body: { action: 'send_weekly_digests' }
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: 'Batch complete!',
          description: `${data.sent} sent, ${data.failed} failed out of ${data.total_eligible} eligible investors`
        });
        loadStats();
      } else {
        throw new Error(data?.error || 'Batch failed');
      }
    } catch (err: any) {
      toast({ title: 'Batch failed', description: err.message, variant: 'destructive' });
    }
    setSendingBatch(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-purple-900 flex items-center gap-2">
                  Weekly Digest Manager
                  <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                    <Bot className="w-3 h-3 mr-1" />
                    Penny AI Powered
                  </Badge>
                </CardTitle>
                <CardDescription className="text-purple-700">
                  Preview, edit, and send personalized weekly digest emails to investors
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={loadStats}
              variant="outline"
              size="sm"
              disabled={statsLoading}
              className="border-purple-300"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{sentThisWeek}</p>
                <p className="text-xs text-gray-500">Sent This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{failedThisWeek}</p>
                <p className="text-xs text-gray-500">Failed This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{investors.length}</p>
                <p className="text-xs text-gray-500">Total Investors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{batchLogs.length}</p>
                <p className="text-xs text-gray-500">Batch Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">
            <Eye className="w-4 h-4 mr-2" />
            Preview & Send
          </TabsTrigger>
          <TabsTrigger value="batch">
            <Play className="w-4 h-4 mr-2" />
            Batch Operations
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="w-4 h-4 mr-2" />
            Send History
          </TabsTrigger>
        </TabsList>

        {/* Preview & Send Tab */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Investor to Preview</CardTitle>
              <CardDescription>Search for an investor to see what their weekly digest email will look like</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Investor Search */}
              <div className="relative" ref={dropdownRef}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowDropdown(true);
                        if (!e.target.value.trim()) setSelectedInvestor(null);
                      }}
                      onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handlePreview}
                    disabled={!selectedInvestor || previewLoading}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {previewLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</>
                    ) : (
                      <><Eye className="w-4 h-4 mr-2" />Preview Digest</>
                    )}
                  </Button>
                </div>

                {/* Dropdown */}
                {showDropdown && filteredInvestors.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredInvestors.slice(0, 20).map(inv => (
                      <button
                        key={inv.id}
                        onClick={() => handleSelectInvestor(inv)}
                        className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <p className="font-medium text-gray-900 text-sm">{inv.full_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{inv.email}</p>
                        {inv.preferred_markets && inv.preferred_markets.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {inv.preferred_markets.slice(0, 3).map((m, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] h-4">{m}</Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Investor Info */}
              {selectedInvestor && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-purple-900">{selectedInvestor.full_name}</p>
                      <p className="text-sm text-purple-600">{selectedInvestor.email}</p>
                    </div>
                    {previewData && (
                      <div className="flex gap-2">
                        {previewData.is_no_portfolio && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            No Portfolio
                          </Badge>
                        )}
                        <Badge className="bg-purple-100 text-purple-700">
                          {previewData.portfolio} properties
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-700">
                          {previewData.markets.length} markets
                        </Badge>
                        <Badge className="bg-green-100 text-green-700">
                          {previewData.new_deals} new deals
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Preview */}
          {previewHtml && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    Email Preview
                    {previewData?.is_no_portfolio && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">Tips & Tricks Edition</Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(!isEditing);
                        if (!isEditing) setEditedHtml(previewHtml);
                      }}
                      className="border-purple-300"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      {isEditing ? 'View Preview' : 'Edit HTML'}
                    </Button>
                    {isEditing && editedHtml !== previewHtml && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setPreviewHtml(editedHtml); setIsEditing(false); }}
                        className="border-green-300 text-green-700"
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Apply Changes
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSendTest}
                      disabled={sendingTest}
                      className="bg-[#d4a574] hover:bg-[#c49464]"
                    >
                      {sendingTest ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Sending...</>
                      ) : (
                        <><Send className="w-3.5 h-3.5 mr-1.5" />Send Test Now</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <textarea
                    value={editedHtml}
                    onChange={(e) => setEditedHtml(e.target.value)}
                    className="w-full h-[600px] font-mono text-xs border rounded-lg p-4 bg-gray-50"
                    spellCheck={false}
                  />
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-gray-100">
                    <div className="bg-gray-200 px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>To: {selectedInvestor?.email}</span>
                      <span className="mx-2">|</span>
                      <span>From: Penny AI &lt;penny@accessyourplace.com&gt;</span>
                    </div>
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-[600px] bg-white"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Batch Operations Tab */}
        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monday Batch Run</CardTitle>
              <CardDescription>
                Manually trigger the full weekly digest batch. This sends personalized emails to all eligible investors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Before Running Batch</p>
                    <ul className="text-sm text-amber-700 mt-1 space-y-1">
                      <li>- Preview a few investor digests first to verify content quality</li>
                      <li>- Investors without portfolios will receive tips & market intel emails</li>
                      <li>- Investors who unsubscribed from weekly summaries will be skipped</li>
                      <li>- The batch may take several minutes for large investor counts</li>
                      <li>- Penny AI generates personalized tips for each investor</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleBatchSend}
                  disabled={sendingBatch}
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  {sendingBatch ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" />Running Batch...</>
                  ) : (
                    <><Play className="w-5 h-5 mr-2" />Run Weekly Digest Batch</>
                  )}
                </Button>
                <p className="text-sm text-gray-500">
                  {investors.length} total investors ({investors.filter(i => i.status === 'active').length} active)
                </p>
              </div>

              {/* Recent Batch Runs */}
              {batchLogs.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Recent Batch Runs</h4>
                  <div className="space-y-2">
                    {batchLogs.map(log => (
                      <div key={log.id} className="p-3 bg-gray-50 rounded-lg border flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{log.subject}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                            {log.metadata?.ms && ` — ${(log.metadata.ms / 1000).toFixed(1)}s`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {log.metadata?.sent !== undefined && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {log.metadata.sent} sent
                            </Badge>
                          )}
                          {log.metadata?.failed !== undefined && log.metadata.failed > 0 && (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3 mr-1" />
                              {log.metadata.failed} failed
                            </Badge>
                          )}
                          <Badge variant="outline" className={log.status === 'sent' ? 'text-green-600' : 'text-amber-600'}>
                            {log.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Individual Send History</CardTitle>
                  <CardDescription>Recent weekly digest emails sent to individual investors</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadStats} disabled={statsLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sendLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No digest emails sent yet</p>
                  <p className="text-sm">Preview an investor's digest and click "Send Test Now" to get started</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {sendLogs.map(log => (
                      <div key={log.id} className="p-3 bg-gray-50 rounded-lg border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            log.status === 'sent' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {log.status === 'sent' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{log.recipient_name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{log.recipient_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.metadata?.is_no_portfolio && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">
                              No Portfolio
                            </Badge>
                          )}
                          {log.metadata?.portfolio !== undefined && !log.metadata?.is_no_portfolio && (
                            <Badge variant="outline" className="text-[10px]">
                              {log.metadata.portfolio} properties
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WeeklyDigestManager;
