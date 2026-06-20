
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DraftArticle } from '@/types/admin';
import { Loader2, Bold, Italic, List, Heading2, Calendar, Clock } from 'lucide-react';

interface ArticleEditorModalProps {
  article: DraftArticle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (article: DraftArticle) => Promise<void>;
}

export function ArticleEditorModal({ article, open, onOpenChange, onSave }: ArticleEditorModalProps) {
  const [editedArticle, setEditedArticle] = useState<DraftArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'schedule'>('content');

  useEffect(() => {
    if (article) setEditedArticle({ ...article });
  }, [article]);

  if (!editedArticle) return null;

  const handleSave = async () => {
    setSaving(true);
    await onSave(editedArticle);
    setSaving(false);
  };

  const handleSchedule = async () => {
    if (!editedArticle.scheduled_for) return;
    setSaving(true);
    await onSave({ ...editedArticle, status: 'scheduled' });
    setSaving(false);
  };

  const insertFormat = (tag: string) => {
    const textarea = document.getElementById('editor-content') as HTMLTextAreaElement;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const text = editedArticle.content;
    const selected = text.substring(start, end);
    setEditedArticle({ ...editedArticle, content: text.substring(0, start) + `<${tag}>${selected}</${tag}>` + text.substring(end) });
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Edit Article</DialogTitle></DialogHeader>
        
        <div className="flex gap-2 mb-4">
          <Button variant={activeTab === 'content' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('content')}>Content</Button>
          <Button variant={activeTab === 'seo' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('seo')}>SEO</Button>
          <Button variant={activeTab === 'schedule' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('schedule')}><Calendar className="w-4 h-4 mr-1" />Schedule</Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {activeTab === 'content' && (
            <>
              <div><Label>Title</Label><Input value={editedArticle.title} onChange={(e) => setEditedArticle({ ...editedArticle, title: e.target.value })} /></div>
              <div><Label>Category</Label>
                <Select value={editedArticle.category} onValueChange={(v) => setEditedArticle({ ...editedArticle, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STR Regulations">STR Regulations</SelectItem>
                    <SelectItem value="Co-Living">Co-Living</SelectItem>
                    <SelectItem value="Market Data">Market Data</SelectItem>
                    <SelectItem value="Market Analysis">Market Analysis</SelectItem>
                    <SelectItem value="Investment Strategy">Investment Strategy</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Getting Started">Getting Started</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Excerpt</Label><Textarea value={editedArticle.excerpt} onChange={(e) => setEditedArticle({ ...editedArticle, excerpt: e.target.value })} rows={2} /></div>
              <div><Label>Tags (comma-separated)</Label><Input value={editedArticle.tags?.join(', ') || ''} onChange={(e) => setEditedArticle({ ...editedArticle, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></div>
              <div><Label>Content</Label>
                <div className="flex gap-1 mb-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormat('strong')}><Bold className="w-4 h-4" /></Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormat('em')}><Italic className="w-4 h-4" /></Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormat('h2')}><Heading2 className="w-4 h-4" /></Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertFormat('ul')}><List className="w-4 h-4" /></Button>
                </div>
                <Textarea id="editor-content" value={editedArticle.content} onChange={(e) => setEditedArticle({ ...editedArticle, content: e.target.value })} rows={10} className="font-mono text-sm" />
              </div>
            </>
          )}
          {activeTab === 'seo' && (
            <>
              <div><Label>SEO Title</Label><Input value={editedArticle.seo_title || ''} onChange={(e) => setEditedArticle({ ...editedArticle, seo_title: e.target.value })} /><p className="text-xs text-gray-500 mt-1">{(editedArticle.seo_title || '').length}/60</p></div>
              <div><Label>SEO Description</Label><Textarea value={editedArticle.seo_description || ''} onChange={(e) => setEditedArticle({ ...editedArticle, seo_description: e.target.value })} rows={3} /><p className="text-xs text-gray-500 mt-1">{(editedArticle.seo_description || '').length}/160</p></div>
              <div><Label>SEO Keywords</Label><Input value={editedArticle.seo_keywords?.join(', ') || ''} onChange={(e) => setEditedArticle({ ...editedArticle, seo_keywords: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></div>
            </>
          )}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-purple-600" /><h3 className="font-semibold text-purple-800">Schedule Publication</h3></div>
                <p className="text-sm text-gray-600 mb-4">Set a future date and time for this article to be automatically published.</p>
                <div><Label>Publish Date & Time</Label><Input type="datetime-local" min={getMinDateTime()} value={editedArticle.scheduled_for ? new Date(editedArticle.scheduled_for).toISOString().slice(0, 16) : ''} onChange={(e) => setEditedArticle({ ...editedArticle, scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : '' })} className="max-w-xs" /></div>
                {editedArticle.scheduled_for && <p className="text-sm text-purple-700 mt-3">Will publish: {new Date(editedArticle.scheduled_for).toLocaleString()}</p>}
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600"><strong>Current Status:</strong> {editedArticle.status}</p>
                {editedArticle.status === 'scheduled' && editedArticle.scheduled_for && <p className="text-sm text-purple-600 mt-1">Scheduled for: {new Date(editedArticle.scheduled_for).toLocaleString()}</p>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {activeTab === 'schedule' && editedArticle.scheduled_for && editedArticle.status !== 'published' && (
            <Button onClick={handleSchedule} disabled={saving} className="bg-purple-600 hover:bg-purple-700">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}Schedule</Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-[#d4a574]">{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
