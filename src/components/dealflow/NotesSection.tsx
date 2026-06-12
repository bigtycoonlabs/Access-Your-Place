import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pin, Send, Loader2 } from 'lucide-react';
import { PropertyNote } from '@/types/dealflow';

interface NotesSectionProps {
  notes: PropertyNote[];
  propertyId: string;
  onAddNote: (content: string, noteType: string) => Promise<void>;
  onTogglePin: (noteId: string, isPinned: boolean) => Promise<void>;
  loading?: boolean;
}

export function NotesSection({ notes, propertyId, onAddNote, onTogglePin, loading }: NotesSectionProps) {
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newNote.trim()) return;
    setSubmitting(true);
    await onAddNote(newNote, noteType);
    setNewNote('');
    setSubmitting(false);
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const typeColors: Record<string, string> = {
    general: 'bg-gray-100 text-gray-800',
    negotiation: 'bg-blue-100 text-blue-800',
    research: 'bg-purple-100 text-purple-800',
    callback: 'bg-orange-100 text-orange-800'
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="flex-1 min-h-[80px]"
        />
      </div>
      <div className="flex gap-2 items-center">
        <Select value={noteType} onValueChange={setNoteType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="negotiation">Negotiation</SelectItem>
            <SelectItem value="research">Research</SelectItem>
            <SelectItem value="callback">Callback</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSubmit} disabled={submitting || !newNote.trim()} className="bg-[#d4a574]">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="ml-2">Add Note</span>
        </Button>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {sortedNotes.map((note) => (
          <div key={note.id} className={`p-3 rounded-lg border ${note.is_pinned ? 'border-[#d4a574] bg-amber-50' : 'bg-white'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <Badge className={typeColors[note.note_type]}>{note.note_type}</Badge>
                <span className="text-xs text-gray-500">{note.author_name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onTogglePin(note.id, !note.is_pinned)}>
                <Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-[#d4a574] text-[#d4a574]' : ''}`} />
              </Button>
            </div>
            <p className="text-sm">{note.content}</p>
            <p className="text-xs text-gray-400 mt-2">{new Date(note.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
