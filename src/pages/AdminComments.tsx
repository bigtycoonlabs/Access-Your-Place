import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface Comment {
  id: string;
  article_slug: string;
  user_name: string;
  user_email: string;
  comment_text: string;
  is_approved: boolean;
  created_at: string;
}

export default function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const { toast } = useToast();

  const ADMIN_PASSWORD = 'admin123'; // Change this in production

  useEffect(() => {
    if (authenticated) {
      fetchAllComments();
    }
  }, [authenticated]);

  const fetchAllComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({ is_approved: true })
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Comment approved' });
      fetchAllComments();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve comment', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Comment deleted' });
      fetchAllComments();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete comment', variant: 'destructive' });
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 w-96">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <Input aria-label="Enter admin password"
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && password === ADMIN_PASSWORD && setAuthenticated(true)}
          />
          <Button className="mt-4 w-full" onClick={() => password === ADMIN_PASSWORD ? setAuthenticated(true) : toast({ title: 'Error', description: 'Invalid password', variant: 'destructive' })}>
            Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Comment Moderation</h1>
        <div className="space-y-4">
          {comments.map(comment => (
            <Card key={comment.id} className={`p-6 ${comment.is_approved ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold">{comment.user_name} ({comment.user_email})</p>
                  <p className="text-sm text-gray-500">{comment.article_slug} - {new Date(comment.created_at).toLocaleString()}</p>
                  <p className="mt-2">{comment.comment_text}</p>
                  <p className="text-sm mt-2 font-medium">{comment.is_approved ? 'Approved' : 'Pending Approval'}</p>
                </div>
                <div className="flex gap-2">
                  {!comment.is_approved && (
                    <Button onClick={() => handleApprove(comment.id)} size="sm">Approve</Button>
                  )}
                  <Button onClick={() => handleDelete(comment.id)} variant="destructive" size="sm">Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
