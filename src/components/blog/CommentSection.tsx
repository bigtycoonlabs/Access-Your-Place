import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  article_slug: string;
  user_name: string;
  user_email: string;
  comment_text: string;
  parent_comment_id: string | null;
  is_approved: boolean;
  created_at: string;
  replies?: Comment[];
}

interface CommentSectionProps {
  articleSlug: string;
}

export function CommentSection({ articleSlug }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
  }, [articleSlug]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('article_slug', articleSlug)
        .eq('is_approved', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const nested = nestComments(data || []);
      setComments(nested);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const nestComments = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies!.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  return (
    <div className="mt-12 border-t pt-8">
      <h2 className="text-2xl font-bold mb-6">Comments</h2>
      <CommentForm articleSlug={articleSlug} onSuccess={fetchComments} toast={toast} />
      {loading ? (
        <p className="text-gray-500 mt-6">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 mt-6">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="mt-8 space-y-6">
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} articleSlug={articleSlug} onReply={fetchComments} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentForm({ articleSlug, parentId, onSuccess, toast }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !text) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        article_slug: articleSlug,
        user_name: name,
        user_email: email,
        comment_text: text,
        parent_comment_id: parentId || null,
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Comment submitted for moderation' });
      setName('');
      setEmail('');
      setText('');
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit comment', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input aria-label="Your Name" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Your Email" type="email" placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Textarea aria-label="Your comment" placeholder="Your comment..." value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : parentId ? 'Post Reply' : 'Post Comment'}</Button>
    </form>
  );
}

function CommentItem({ comment, articleSlug, onReply, toast }: any) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div className="border-l-2 border-gray-200 pl-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{comment.user_name}</p>
          <p className="text-sm text-gray-500">{new Date(comment.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <p className="mt-2 text-gray-700">{comment.comment_text}</p>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowReplyForm(!showReplyForm)}>Reply</Button>
      {showReplyForm && (
        <div className="mt-4 ml-4">
          <CommentForm articleSlug={articleSlug} parentId={comment.id} onSuccess={() => { setShowReplyForm(false); onReply(); }} toast={toast} />
        </div>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 ml-4 space-y-4">
          {comment.replies.map((reply: Comment) => (
            <CommentItem key={reply.id} comment={reply} articleSlug={articleSlug} onReply={onReply} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}
