import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, Save, Loader2, History, Activity, LogIn, Eye, FileText, 
  Mail, Heart, Search, Phone, Calendar, Download, RefreshCw, TrendingUp,
  Clock, Filter, ChevronDown, ChevronUp
} from 'lucide-react';

interface Props {
  investor: any;
  onClose: () => void;
}

interface ActivityLog {
  id: string;
  activity_type: string;
  activity_category: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface ActivitySummary {
  total_activities: number;
  logins: number;
  deal_views: number;
  inquiries: number;
  downloads: number;
  messages: number;
  by_category: Record<string, number>;
  by_day: Record<string, number>;
  last_login: string | null;
  most_active_day: string | null;
}

export function InvestorDetailModal({ investor, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(investor);
  const [commType, setCommType] = useState<string>('note');
  const [commContent, setCommContent] = useState('');
  const [pipelineHistory, setPipelineHistory] = useState<any[]>([]);
  
  // Activity log state
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityCategory, setActivityCategory] = useState('all');
  const [activityExpanded, setActivityExpanded] = useState<string | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    if (investor?.id) { 
      fetchDetails(); 
      fetchPipelineHistory(); 
      fetchActivityTimeline();
      fetchActivitySummary();
    }
  }, [investor?.id]);

  const fetchDetails = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-investor-crm', {
      body: { action: 'get', id: investor.id }
    });
    if (data) setData(data);
    setLoading(false);
  };

  const fetchPipelineHistory = async () => {
    const { data } = await supabase.functions.invoke('manage-investor-pipeline', {
      body: { action: 'get_history', investor_id: investor.id }
    });
    if (data) setPipelineHistory(data);
  };

  const fetchActivityTimeline = async () => {
    setActivityLoading(true);
    const { data } = await supabase.functions.invoke('investor-activity-log', {
      body: { 
        action: 'get_timeline', 
        investor_id: investor.id,
        category: activityCategory !== 'all' ? activityCategory : undefined,
        limit: 100
      }
    });
    if (data?.activities) setActivities(data.activities);
    setActivityLoading(false);
  };

  const fetchActivitySummary = async () => {
    const { data } = await supabase.functions.invoke('investor-activity-log', {
      body: { 
        action: 'get_summary', 
        investor_id: investor.id,
        days: 30
      }
    });
    if (data?.summary) setActivitySummary(data.summary);
  };

  useEffect(() => {
    if (investor?.id) {
      fetchActivityTimeline();
    }
  }, [activityCategory]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.functions.invoke('manage-investor-crm', {
      body: { action: 'update', id: investor.id, ...form }
    });
    toast({ title: 'Investor updated' });
    setSaving(false);
  };

  const logCommunication = async () => {
    if (!commContent.trim()) return;
    await supabase.functions.invoke('manage-investor-crm', {
      body: { action: 'log_communication', communication: { investor_id: investor.id, type: commType, content: commContent, staff_name: 'Staff' } }
    });
    toast({ title: 'Communication logged' });
    setCommContent('');
    fetchDetails();
  };

  const stageColors: Record<string, string> = {
    lead: 'bg-blue-100 text-blue-700',
    qualified: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    closed: 'bg-purple-100 text-purple-700'
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login': return <LogIn className="w-4 h-4 text-green-500" />;
      case 'deal_view': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'inquiry_submitted': return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'document_download': return <Download className="w-4 h-4 text-orange-500" />;
      case 'message_sent': return <Mail className="w-4 h-4 text-indigo-500" />;
      case 'favorite_added': return <Heart className="w-4 h-4 text-red-500" />;
      case 'favorite_removed': return <Heart className="w-4 h-4 text-gray-400" />;
      case 'search_performed': return <Search className="w-4 h-4 text-cyan-500" />;
      case 'profile_updated': return <Save className="w-4 h-4 text-teal-500" />;
      case 'report_viewed': return <FileText className="w-4 h-4 text-amber-500" />;
      case 'call_booked': return <Phone className="w-4 h-4 text-emerald-500" />;
      case 'onboarding_completed': return <TrendingUp className="w-4 h-4 text-green-600" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'authentication': return 'bg-green-100 text-green-700';
      case 'deals': return 'bg-blue-100 text-blue-700';
      case 'inquiries': return 'bg-purple-100 text-purple-700';
      case 'documents': return 'bg-orange-100 text-orange-700';
      case 'messaging': return 'bg-indigo-100 text-indigo-700';
      case 'account': return 'bg-teal-100 text-teal-700';
      case 'reports': return 'bg-amber-100 text-amber-700';
      case 'referrals': return 'bg-pink-100 text-pink-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={!!investor} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#d4a574] rounded-full flex items-center justify-center text-white text-xl font-bold">
              {(investor.name || investor.full_name || 'U').charAt(0)}
            </div>
            <div>
              <p className="text-xl">{investor.name || investor.full_name}</p>
              <p className="text-sm text-gray-500 font-normal">{investor.email}</p>
            </div>
            {investor.pipeline_stage && (
              <Badge className={stageColors[investor.pipeline_stage]}>{investor.pipeline_stage}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-4">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="activity" className="gap-1">
              <Activity className="w-3 h-3" />Activity
            </TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="name">Name</Label><Input id="name" value={form.name || form.full_name || ''} onChange={e => setForm({...form, name: e.target.value, full_name: e.target.value})} /></div>
              <div><Label htmlFor="email">Email</Label><Input id="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><Label htmlFor="company">Company</Label><Input id="company" value={form.company_name || ''} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
              <div><Label htmlFor="budget-min">Budget Min</Label><Input id="budget-min" type="number" value={form.budget_min || form.investment_budget_min || 0} onChange={e => setForm({...form, budget_min: parseInt(e.target.value)})} /></div>
              <div><Label htmlFor="budget-max">Budget Max</Label><Input id="budget-max" type="number" value={form.budget_max || form.investment_budget_max || 0} onChange={e => setForm({...form, budget_max: parseInt(e.target.value)})} /></div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-[#d4a574]">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button>
          </TabsContent>

          {/* Activity Timeline Tab */}
          <TabsContent value="activity" className="mt-4">
            {/* Activity Summary Cards */}
            {activitySummary && (
              <div className="grid grid-cols-6 gap-3 mb-6">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-3 text-center">
                    <LogIn className="w-5 h-5 mx-auto text-green-600 mb-1" />
                    <p className="text-2xl font-bold text-green-700">{activitySummary.logins}</p>
                    <p className="text-xs text-green-600">Logins</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-3 text-center">
                    <Eye className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                    <p className="text-2xl font-bold text-blue-700">{activitySummary.deal_views}</p>
                    <p className="text-xs text-blue-600">Deal Views</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-3 text-center">
                    <MessageSquare className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                    <p className="text-2xl font-bold text-purple-700">{activitySummary.inquiries}</p>
                    <p className="text-xs text-purple-600">Inquiries</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardContent className="p-3 text-center">
                    <Download className="w-5 h-5 mx-auto text-orange-600 mb-1" />
                    <p className="text-2xl font-bold text-orange-700">{activitySummary.downloads}</p>
                    <p className="text-xs text-orange-600">Downloads</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                  <CardContent className="p-3 text-center">
                    <Mail className="w-5 h-5 mx-auto text-indigo-600 mb-1" />
                    <p className="text-2xl font-bold text-indigo-700">{activitySummary.messages}</p>
                    <p className="text-xs text-indigo-600">Messages</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
                  <CardContent className="p-3 text-center">
                    <Activity className="w-5 h-5 mx-auto text-gray-600 mb-1" />
                    <p className="text-2xl font-bold text-gray-700">{activitySummary.total_activities}</p>
                    <p className="text-xs text-gray-600">Total (30d)</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Last Login Info */}
            {activitySummary?.last_login && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Last Login</p>
                  <p className="text-xs text-green-600">{new Date(activitySummary.last_login).toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Filter Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={activityCategory} onValueChange={setActivityCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="deals">Deals</SelectItem>
                    <SelectItem value="inquiries">Inquiries</SelectItem>
                    <SelectItem value="documents">Documents</SelectItem>
                    <SelectItem value="messaging">Messaging</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="reports">Reports</SelectItem>
                    <SelectItem value="referrals">Referrals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={fetchActivityTimeline} disabled={activityLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${activityLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Activity Timeline */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No activity recorded yet</p>
                  <p className="text-sm">Activities will appear here as the investor uses the portal</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => setActivityExpanded(activityExpanded === activity.id ? null : activity.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">{activity.title}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className={`${getCategoryColor(activity.activity_category)} text-xs`}>
                              {activity.activity_category}
                            </Badge>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {formatTimeAgo(activity.created_at)}
                            </span>
                            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                              activityExpanded === activity.id ? 
                                <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{activity.description}</p>
                        )}
                        
                        {/* Expanded metadata */}
                        {activityExpanded === activity.id && activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-medium text-gray-600 mb-2">Details</p>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(activity.metadata).map(([key, value]) => (
                                value && (
                                  <div key={key} className="text-xs">
                                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                                    <span className="text-gray-700 ml-1">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                )
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2"><History className="w-4 h-4" />Pipeline History</h4>
              {pipelineHistory.map((h: any) => (
                <div key={h.id} className="border rounded-lg p-3 bg-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {h.from_stage && <Badge variant="outline">{h.from_stage}</Badge>}
                    <span className="text-gray-400">→</span>
                    <Badge className={stageColors[h.to_stage]}>{h.to_stage}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{h.trigger_type} {h.trigger_reason && `- ${h.trigger_reason}`}</p>
                    <p className="text-xs text-gray-400">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {pipelineHistory.length === 0 && <p className="text-gray-500 text-center py-4">No pipeline history</p>}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data?.communications?.map((c: any) => (
                <div key={c.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between"><Badge variant="outline">{c.type}</Badge><span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span></div>
                  <p className="text-sm mt-1">{c.content}</p>
                </div>
              ))}
              {!data?.communications?.length && <p className="text-gray-500 text-center py-4">No history</p>}
            </div>
          </TabsContent>

          <TabsContent value="deals" className="mt-4">
            <div className="space-y-4">
              <div><h4 className="font-semibold mb-2">Inquiries</h4>
                {data?.inquiries?.map((inq: any) => (
                  <div key={inq.id} className="border rounded p-2 mb-2 text-sm"><p>{inq.properties?.address}</p><Badge variant="outline">{inq.status}</Badge></div>
                )) || <p className="text-gray-500">No inquiries</p>}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="log" className="mt-4 space-y-4">
            <Select value={commType} onValueChange={setCommType}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="call">Call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="meeting">Meeting</SelectItem></SelectContent></Select>
            <Textarea aria-label="Enter details" placeholder="Enter details..." value={commContent} onChange={e => setCommContent(e.target.value)} rows={4} />
            <Button onClick={logCommunication} className="bg-[#d4a574]"><MessageSquare className="w-4 h-4 mr-2" />Log</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
