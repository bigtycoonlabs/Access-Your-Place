import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  MessageCircle, Search, Flag, Star, User, Calendar, Filter,
  ThumbsUp, ThumbsDown, AlertTriangle, TrendingUp, BarChart3,
  Brain, Eye, CheckCircle, Clock, RefreshCw, Loader2, FileText,
  MessageSquare, HelpCircle, Target, Zap, ChevronRight
} from 'lucide-react';

interface ConversationLog {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  session_id: string;
  message_type: 'user' | 'assistant';
  message_content: string;
  property_id?: string;
  topic_category?: string;
  flagged_for_review: boolean;
  flag_reason?: string;
  satisfaction_rating?: number;
  staff_notes?: string;
  staff_reviewed_by?: string;
  staff_reviewed_at?: string;
  created_at: string;
}

interface CommonQuestion {
  id: string;
  question_pattern: string;
  topic_category: string;
  occurrence_count: number;
  sample_questions: string[];
  avg_satisfaction: number;
  needs_improvement: boolean;
  improvement_notes?: string;
  last_occurred_at: string;
}

interface ConversationSession {
  session_id: string;
  investor_name: string;
  investor_email: string;
  investor_id: string;
  messages: ConversationLog[];
  started_at: string;
  ended_at: string;
  topics: string[];
  flagged: boolean;
  avg_satisfaction?: number;
}

interface Props {
  staffId: string;
  staffName: string;
}

export function PennyConversationAnalytics({ staffId, staffName }: Props) {
  const [activeTab, setActiveTab] = useState('conversations');
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);
  const [flaggedConversations, setFlaggedConversations] = useState<ConversationLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ConversationLog | null>(null);
  const [staffNotes, setStaffNotes] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch conversation logs
      const { data: logs } = await supabase
        .from('penny_conversation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Group by session
      const sessions: Record<string, ConversationSession> = {};
      (logs || []).forEach(log => {
        if (!sessions[log.session_id]) {
          sessions[log.session_id] = {
            session_id: log.session_id,
            investor_name: log.investor_name || 'Unknown',
            investor_email: log.investor_email || '',
            investor_id: log.investor_id,
            messages: [],
            started_at: log.created_at,
            ended_at: log.created_at,
            topics: [],
            flagged: false
          };
        }
        sessions[log.session_id].messages.push(log);
        if (log.topic_category && !sessions[log.session_id].topics.includes(log.topic_category)) {
          sessions[log.session_id].topics.push(log.topic_category);
        }
        if (log.flagged_for_review) {
          sessions[log.session_id].flagged = true;
        }
        if (new Date(log.created_at) > new Date(sessions[log.session_id].ended_at)) {
          sessions[log.session_id].ended_at = log.created_at;
        }
        if (new Date(log.created_at) < new Date(sessions[log.session_id].started_at)) {
          sessions[log.session_id].started_at = log.created_at;
        }
      });

      setConversations(Object.values(sessions).sort((a, b) => 
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      ));

      // Fetch flagged conversations
      const { data: flagged } = await supabase
        .from('penny_conversation_logs')
        .select('*')
        .eq('flagged_for_review', true)
        .is('staff_reviewed_at', null)
        .order('created_at', { ascending: false });

      setFlaggedConversations(flagged || []);

      // Fetch common questions
      const { data: questions } = await supabase
        .from('penny_common_questions')
        .select('*')
        .order('occurrence_count', { ascending: false })
        .limit(50);

      setCommonQuestions(questions || []);

      // Calculate analytics
      const totalConversations = Object.keys(sessions).length;
      const totalMessages = logs?.length || 0;
      const flaggedCount = (logs || []).filter(l => l.flagged_for_review).length;
      const ratingsCount = (logs || []).filter(l => l.satisfaction_rating).length;
      const avgRating = ratingsCount > 0 
        ? (logs || []).reduce((sum, l) => sum + (l.satisfaction_rating || 0), 0) / ratingsCount
        : 0;

      const topicCounts: Record<string, number> = {};
      (logs || []).forEach(l => {
        if (l.topic_category) {
          topicCounts[l.topic_category] = (topicCounts[l.topic_category] || 0) + 1;
        }
      });

      setAnalytics({
        total_conversations: totalConversations,
        total_messages: totalMessages,
        flagged_count: flaggedCount,
        avg_satisfaction: avgRating.toFixed(1),
        ratings_count: ratingsCount,
        topic_distribution: topicCounts
      });

    } catch (err) {
      console.error('Error fetching conversation data:', err);
    }
    setLoading(false);
  };

  const handleReviewConversation = async () => {
    if (!selectedLog) return;

    try {
      await supabase
        .from('penny_conversation_logs')
        .update({
          staff_notes: staffNotes,
          staff_reviewed_by: staffId,
          staff_reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedLog.id);

      toast({ title: 'Review saved', description: 'Your notes have been saved for this conversation.' });
      setReviewModalOpen(false);
      setSelectedLog(null);
      setStaffNotes('');
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save review', variant: 'destructive' });
    }
  };

  const handleFlagQuestion = async (questionId: string, needsImprovement: boolean, notes: string) => {
    try {
      await supabase
        .from('penny_common_questions')
        .update({
          needs_improvement: needsImprovement,
          improvement_notes: notes
        })
        .eq('id', questionId);

      toast({ title: 'Updated', description: 'Question flagged for improvement.' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update question', variant: 'destructive' });
    }
  };

  const filteredConversations = conversations.filter(session => {
    const matchesSearch = !searchQuery || 
      session.investor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.investor_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.messages.some(m => m.message_content.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTopic = topicFilter === 'all' || session.topics.includes(topicFilter);
    
    return matchesSearch && matchesTopic;
  });

  const topics = ['all', 'deal_analysis', 'market_info', 'pricing', 'location', 'general', 'property_search', 'investment_strategy'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Penny AI Conversation Analytics">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-500" aria-hidden="true" />
            Penny AI Conversation Analytics
          </h2>
          <p className="text-gray-600">Review investor conversations, analyze common questions, and improve Penny's responses</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
          Refresh Data
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-purple-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{analytics?.total_conversations || 0}</p>
            <p className="text-sm text-gray-500">Total Conversations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{analytics?.total_messages || 0}</p>
            <p className="text-sm text-gray-500">Total Messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-8 h-8 mx-auto mb-2 text-amber-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{analytics?.avg_satisfaction || 'N/A'}</p>
            <p className="text-sm text-gray-500">Avg Satisfaction</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Flag className="w-8 h-8 mx-auto mb-2 text-red-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{flaggedConversations.length}</p>
            <p className="text-sm text-gray-500">Needs Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{analytics?.ratings_count || 0}</p>
            <p className="text-sm text-gray-500">Rated Conversations</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            All Conversations
          </TabsTrigger>
          <TabsTrigger value="flagged" className="flex items-center gap-2">
            <Flag className="w-4 h-4" aria-hidden="true" />
            Flagged for Review
            {flaggedConversations.length > 0 && (
              <Badge className="bg-red-500 text-white ml-1">{flaggedConversations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="common" className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
            Common Questions
          </TabsTrigger>
          <TabsTrigger value="topics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            Topic Analytics
          </TabsTrigger>
        </TabsList>

        {/* All Conversations Tab */}
        <TabsContent value="conversations" className="space-y-4">
          {/* Search & Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <Input
                    placeholder="Search by investor name, email, or message content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    aria-label="Search conversations"
                  />
                </div>
                <Select value={topicFilter} onValueChange={setTopicFilter}>
                  <SelectTrigger className="w-[200px]" aria-label="Filter by topic">
                    <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
                    <SelectValue placeholder="Filter by topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map(topic => (
                      <SelectItem key={topic} value={topic}>
                        {topic === 'all' ? 'All Topics' : topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Conversation List */}
          <div className="space-y-3">
            {filteredConversations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium text-gray-600">No Conversations Found</h3>
                  <p className="text-gray-500">Conversations with Penny AI will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              filteredConversations.map(session => (
                <Card 
                  key={session.session_id} 
                  className={`hover:shadow-md transition-shadow cursor-pointer ${session.flagged ? 'border-l-4 border-l-red-500' : ''}`}
                  onClick={() => setSelectedSession(session)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Conversation with ${session.investor_name}`}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSession(session)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-purple-600" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{session.investor_name}</h4>
                            {session.flagged && (
                              <Badge className="bg-red-100 text-red-700">
                                <Flag className="w-3 h-3 mr-1" aria-hidden="true" />
                                Flagged
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{session.investor_email}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {session.topics.map(topic => (
                              <Badge key={topic} variant="outline" className="text-xs">
                                {topic.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {new Date(session.started_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-400">
                          {session.messages.length} messages
                        </p>
                        <ChevronRight className="w-5 h-5 text-gray-400 mt-2 ml-auto" aria-hidden="true" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Flagged for Review Tab */}
        <TabsContent value="flagged" className="space-y-4">
          {flaggedConversations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium text-gray-600">All Caught Up!</h3>
                <p className="text-gray-500">No conversations flagged for review.</p>
              </CardContent>
            </Card>
          ) : (
            flaggedConversations.map(log => (
              <Card key={log.id} className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
                          {log.flag_reason || 'Needs Review'}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Investor:</strong> {log.investor_name} ({log.investor_email})
                      </p>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm">
                          <strong>{log.message_type === 'user' ? 'Question:' : 'Penny Response:'}</strong>
                        </p>
                        <p className="text-gray-700 mt-1">{log.message_content}</p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => { setSelectedLog(log); setReviewModalOpen(true); }}
                      className="bg-purple-500 hover:bg-purple-600"
                    >
                      <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Common Questions Tab */}
        <TabsContent value="common" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Common Questions</CardTitle>
              <CardDescription>Questions frequently asked by investors to Penny AI</CardDescription>
            </CardHeader>
            <CardContent>
              {commonQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <HelpCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p>No common questions tracked yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {commonQuestions.map((q, idx) => (
                    <div 
                      key={q.id} 
                      className={`p-4 rounded-lg border ${q.needs_improvement ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                            <Badge variant="outline">{q.topic_category?.replace(/_/g, ' ')}</Badge>
                            {q.needs_improvement && (
                              <Badge className="bg-amber-100 text-amber-700">
                                <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
                                Needs Improvement
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-gray-900">{q.question_pattern}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" aria-hidden="true" />
                              {q.occurrence_count} occurrences
                            </span>
                            {q.avg_satisfaction && (
                              <span className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-amber-500" aria-hidden="true" />
                                {q.avg_satisfaction.toFixed(1)} avg rating
                              </span>
                            )}
                          </div>
                          {q.improvement_notes && (
                            <p className="text-sm text-amber-700 mt-2 bg-amber-100 p-2 rounded">
                              <strong>Notes:</strong> {q.improvement_notes}
                            </p>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleFlagQuestion(q.id, !q.needs_improvement, '')}
                        >
                          {q.needs_improvement ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                              Mark Resolved
                            </>
                          ) : (
                            <>
                              <Flag className="w-4 h-4 mr-1" aria-hidden="true" />
                              Flag for Improvement
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topic Analytics Tab */}
        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Topic Distribution</CardTitle>
              <CardDescription>Breakdown of conversation topics with Penny AI</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.topic_distribution && Object.keys(analytics.topic_distribution).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(analytics.topic_distribution)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([topic, count]) => {
                      const total = Object.values(analytics.topic_distribution).reduce((sum: number, c) => sum + (c as number), 0);
                      const percentage = Math.round(((count as number) / total) * 100);
                      
                      return (
                        <div key={topic}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium capitalize">{topic.replace(/_/g, ' ')}</span>
                            <span className="text-sm text-gray-500">{count as number} ({percentage}%)</span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p>No topic data available yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Conversation Detail Modal */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-purple-500" aria-hidden="true" />
              Conversation with {selectedSession?.investor_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="space-y-4">
              {selectedSession?.messages
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((msg, idx) => (
                  <div 
                    key={idx}
                    className={`flex ${msg.message_type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.message_type === 'user' 
                          ? 'bg-[#1a365d] text-white' 
                          : 'bg-purple-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.message_type === 'user' ? (
                          <User className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Brain className="w-4 h-4 text-purple-600" aria-hidden="true" />
                        )}
                        <span className="text-xs opacity-75">
                          {msg.message_type === 'user' ? selectedSession?.investor_name : 'Penny AI'}
                        </span>
                        <span className="text-xs opacity-50">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message_content}</p>
                      {msg.flagged_for_review && (
                        <Badge className="mt-2 bg-red-100 text-red-700">
                          <Flag className="w-3 h-3 mr-1" aria-hidden="true" />
                          Flagged
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSession(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Flagged Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>From:</strong> {selectedLog?.investor_name}
              </p>
              <p className="text-gray-800">{selectedLog?.message_content}</p>
            </div>
            <div>
              <label htmlFor="staff-notes" className="block text-sm font-medium mb-2">Staff Notes</label>
              <Textarea
                id="staff-notes"
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                placeholder="Add notes about this conversation for training purposes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
            <Button onClick={handleReviewConversation} className="bg-purple-500 hover:bg-purple-600">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Save Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
