import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, Send, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function IssueReportForm() {
  const [issueType, setIssueType] = useState('');
  const [page, setPage] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await supabase.functions.invoke('submit-issue-report', {
        body: { issueType, page, description }
      });
      setSubmitted(true);
      setIssueType(''); setPage(''); setDescription('');
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
          <p className="text-gray-600 mb-4">Your report helps us improve the platform.</p>
          <Button onClick={() => setSubmitted(false)}>Report Another Issue</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-[#d4a574]" />
          Report an Issue
        </CardTitle>
        <p className="text-sm text-gray-600">Help us test our platform by reporting bugs or features that aren't working.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select value={issueType} onValueChange={setIssueType}>
            <SelectTrigger><SelectValue placeholder="Issue Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug / Error</SelectItem>
              <SelectItem value="feature">Feature Not Working</SelectItem>
              <SelectItem value="ui">Display Issue</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Which page?" value={page} onChange={(e) => setPage(e.target.value)} />
          <Textarea placeholder="Describe the issue..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          <Button type="submit" disabled={!issueType || !description || submitting} className="w-full bg-[#d4a574]">
            <Send className="w-4 h-4 mr-2" />{submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
