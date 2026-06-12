import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ExternalLink, Plus, Loader2, Search, Zap } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ManualTopicForm } from './ManualTopicForm';

interface DiscoveredTopic {
  id: string;
  title: string;
  content: string;
  description?: string;
  source: string;
  source_url: string;
  engagement_score: number;
  relevance_score: number;
  trending_score: number;
  priority_score: number;
  added_to_queue: boolean;
  discovered_at: string;
}

interface TopicDiscoveryTabProps {
  discoveredTopics: DiscoveredTopic[];
  discovering: boolean;
  onDiscoverTopics: () => void;
  onAddToQueue: (topic: DiscoveredTopic) => void;
}

export function TopicDiscoveryTab({
  discoveredTopics,
  discovering,
  onDiscoverTopics,
  onAddToQueue
}: TopicDiscoveryTabProps) {
  const [generatingArticles, setGeneratingArticles] = useState(false);
  
  const handleGenerateArticles = async () => {
    setGeneratingArticles(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-article-generation');
      if (error) {
        toast.error('Failed to generate articles. Check edge function setup.');
        return;
      }
      toast.success(`Generated ${data.articlesGenerated || 0} articles!`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate articles');
    } finally {
      setGeneratingArticles(false);
    }
  };

  const getPriorityBadge = (score: number) => {
    if (score >= 85) return <Badge className="bg-red-100 text-red-800">High Priority</Badge>;
    if (score >= 70) return <Badge className="bg-orange-100 text-orange-800">Medium</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
  };

  const highPriority = discoveredTopics.filter(t => t.priority_score >= 85).length;
  const inQueue = discoveredTopics.filter(t => t.added_to_queue).length;

  return (
    <div className="space-y-6">
      {/* Manual Topic Entry Form */}
      <ManualTopicForm onTopicAdded={onDiscoverTopics} />

      {/* Topic Discovery Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>AI Topic Discovery</CardTitle>
              <CardDescription>Auto-discover trending topics using AI</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={onDiscoverTopics} disabled={discovering} className="bg-[#d4a574]">
                {discovering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Discovering...</> : <><Search className="w-4 h-4 mr-2" />Discover Topics</>}
              </Button>
              <Button onClick={handleGenerateArticles} disabled={generatingArticles} className="bg-green-600 hover:bg-green-700">
                {generatingArticles ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Zap className="w-4 h-4 mr-2" />Generate Articles</>}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-2xl font-bold">{discoveredTopics.length}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Topics Discovered</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-600" />
                <span className="text-2xl font-bold">{highPriority}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">High Priority</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold">{inQueue}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Added to Queue</p>
            </div>
          </div>

          <div className="space-y-4">
            {discoveredTopics.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No topics discovered yet</p>
                <p className="text-sm text-gray-500 mt-1">Use the form above to add topics manually or click "Discover Topics"</p>
              </div>
            ) : (
              discoveredTopics.sort((a, b) => b.priority_score - a.priority_score).map(topic => (
                <div key={topic.id} className="border p-4 rounded-lg bg-white">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{topic.title}</h3>
                        {getPriorityBadge(topic.priority_score)}
                        {topic.added_to_queue && <Badge className="bg-green-100 text-green-800">In Queue</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{topic.content}</p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Source: {topic.source}</span>
                        <span>Priority: {topic.priority_score}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {topic.source_url && (
                        <Button size="sm" variant="outline" onClick={() => window.open(topic.source_url, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      {!topic.added_to_queue && (
                        <Button size="sm" className="bg-[#d4a574]" onClick={() => onAddToQueue(topic)}>
                          <Plus className="w-4 h-4 mr-1" />Add
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}