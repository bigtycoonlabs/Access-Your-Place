import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Plus, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ManualTopicFormProps {
  onTopicAdded: () => void;
}

export function ManualTopicForm({ onTopicAdded }: ManualTopicFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('Manual Entry');
  const [priorityScore, setPriorityScore] = useState([75]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Please enter a topic title'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('research_queue').insert([{
        topic: title.trim(),
        description: description.trim(),
        source,
        priority_score: priorityScore[0],
        engagement_score: Math.floor(Math.random() * 20) + 80,
        status: 'pending'
      }]);
      if (error) throw error;
      toast.success('Topic added to research queue!');
      setTitle(''); setDescription(''); setSource('Manual Entry'); setPriorityScore([75]);
      onTopicAdded();
    } catch (error: any) {
      toast.error('Failed: ' + (error.message || 'Unknown error'));
    } finally { setSubmitting(false); }
  };

  return (
    <Card className="border-dashed border-2 border-[#d4a574]/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#d4a574]" />Add Topic Manually
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label htmlFor="topic-title">Topic Title *</Label><Input id="topic-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., New STR regulations in Austin" className="mt-1" /></div>
          <div><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." className="mt-1" rows={3} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Source</Label>
              <Select value={source} onValueChange={setSource}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual Entry">Manual Entry</SelectItem>
                  <SelectItem value="Reddit">Reddit</SelectItem>
                  <SelectItem value="BiggerPockets">BiggerPockets</SelectItem>
                  <SelectItem value="News">News Article</SelectItem>
                  <SelectItem value="Government">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Priority: {priorityScore[0]}</Label><Slider value={priorityScore} onValueChange={setPriorityScore} min={1} max={100} className="mt-3" /></div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-[#d4a574] hover:bg-[#c49464]">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : <><Plus className="w-4 h-4 mr-2" />Add to Queue</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
