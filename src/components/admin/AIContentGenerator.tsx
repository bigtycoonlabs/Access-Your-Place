import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, Loader2, FileText, Zap, Brain, CheckCircle, 
  AlertCircle, Copy, Eye, Send, RefreshCw, TrendingUp 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface GeneratedArticle {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
}

export function AIContentGenerator() {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('Market Analysis');
  const [tone, setTone] = useState('professional');
  const [wordCount, setWordCount] = useState('1000');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    setGenerating(true);
    setProgress(0);
    setGeneratedArticle(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('generate-single-article', {
        body: { 
          topic: topic.trim(),
          category,
          tone,
          word_count: parseInt(wordCount)
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        toast.error('Generation failed: ' + error.message);
      } else if (data?.article) {
        setGeneratedArticle(data.article);
        toast.success('Article generated successfully!');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      toast.error('Error: ' + (err.message || 'Generation failed'));
    } finally {
      setGenerating(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleSaveDraft = async () => {
    if (!generatedArticle) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('draft_articles').insert([{
        ...generatedArticle,
        author: 'AI Generated',
        status: 'draft',
        research_sources: ['AI Content Generator']
      }]);

      if (error) throw error;
      toast.success('Article saved as draft!');
      setGeneratedArticle(null);
      setTopic('');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!generatedArticle) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('draft_articles').insert([{
        ...generatedArticle,
        author: 'AI Generated',
        status: 'published',
        research_sources: ['AI Content Generator']
      }]);

      if (error) throw error;
      toast.success('Article published!');
      setGeneratedArticle(null);
      setTopic('');
    } catch (err: any) {
      toast.error('Failed to publish: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Generator Card */}
      <Card className="border-2 border-purple-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-300" />
            AI Content Generator
          </CardTitle>
          <CardDescription className="text-purple-100">
            Generate SEO-optimized blog articles using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="topic-title">Topic / Title *</Label>
            <Textarea id="topic-title" 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              placeholder="e.g., How to maximize ROI on short-term rentals in Austin, TX"
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Market Analysis">Market Analysis</SelectItem>
                  <SelectItem value="Investment Strategy">Investment Strategy</SelectItem>
                  <SelectItem value="Property Management">Property Management</SelectItem>
                  <SelectItem value="Regulations">Regulations</SelectItem>
                  <SelectItem value="Co-Living">Co-Living</SelectItem>
                  <SelectItem value="STR Tips">STR Tips</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Word Count</Label>
              <Select value={wordCount} onValueChange={setWordCount}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">~500 words</SelectItem>
                  <SelectItem value="800">~800 words</SelectItem>
                  <SelectItem value="1000">~1000 words</SelectItem>
                  <SelectItem value="1500">~1500 words</SelectItem>
                  <SelectItem value="2000">~2000 words</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {generating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <Brain className="w-4 h-4 animate-pulse" />
                AI is generating your article...
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button 
            onClick={handleGenerate} 
            disabled={generating || !topic.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" />Generate Article</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Article Preview */}
      {generatedArticle && (
        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50 border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  Generated Article
                </CardTitle>
                <CardDescription>Review and edit before saving</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {previewMode ? 'Edit' : 'Preview'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(generatedArticle.content)}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Title & Meta */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500" htmlFor="title">Title</Label>
                <Input id="title" 
                  value={generatedArticle.title}
                  onChange={(e) => setGeneratedArticle({...generatedArticle, title: e.target.value})}
                  className="font-semibold text-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500" htmlFor="excerpt">Excerpt</Label>
                <Textarea id="excerpt" 
                  value={generatedArticle.excerpt}
                  onChange={(e) => setGeneratedArticle({...generatedArticle, excerpt: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{generatedArticle.category}</Badge>
                {generatedArticle.tags?.map((tag, i) => (
                  <Badge key={i} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <Label className="text-xs text-gray-500" htmlFor="content">Content</Label>
              {previewMode ? (
                <div 
                  className="prose prose-sm max-w-none mt-2 p-4 bg-gray-50 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: generatedArticle.content }}
                />
              ) : (
                <Textarea id="content" 
                  value={generatedArticle.content}
                  onChange={(e) => setGeneratedArticle({...generatedArticle, content: e.target.value})}
                  rows={15}
                  className="mt-1 font-mono text-sm"
                />
              )}
            </div>

            {/* SEO */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                SEO Settings
              </h4>
              <div>
                <Label className="text-xs text-gray-500" htmlFor="seo-title-60">SEO Title ({generatedArticle.seo_title?.length || 0}/60)</Label>
                <Input id="seo-title-60" 
                  value={generatedArticle.seo_title}
                  onChange={(e) => setGeneratedArticle({...generatedArticle, seo_title: e.target.value})}
                  maxLength={60}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500" htmlFor="meta-description-160">Meta Description ({generatedArticle.seo_description?.length || 0}/160)</Label>
                <Textarea id="meta-description-160" 
                  value={generatedArticle.seo_description}
                  onChange={(e) => setGeneratedArticle({...generatedArticle, seo_description: e.target.value})}
                  maxLength={160}
                  rows={2}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setGeneratedArticle(null)}
                className="flex-1"
              >
                Discard
              </Button>
              <Button 
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button 
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Save Draft
              </Button>
              <Button 
                onClick={handlePublish}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips Card */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" />
            Tips for Better Results
          </h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Be specific with your topic - include location, strategy type, or target audience</li>
            <li>• Use keywords you want to rank for in the topic</li>
            <li>• Review and edit the generated content before publishing</li>
            <li>• Add internal links to other articles on your site</li>
            <li>• Include relevant images and infographics</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
