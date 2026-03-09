'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import ConfirmModal from '@/components/confirm-modal';

type Confession = {
  id: string;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  confession_id: string;
};

export default function ConfessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  
  const [confession, setConfession] = useState<Confession | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myComments, setMyComments] = useState<string[]>([]);
  
  // Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Load local comments to allow deletion
    const storedComments = localStorage.getItem('my_comments');
    if (storedComments) {
      setMyComments(JSON.parse(storedComments));
    }

    fetchData();

    // Realtime comments
    const channel = supabase
      .channel(`comments-${resolvedParams.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'comments',
        filter: `confession_id=eq.${resolvedParams.id}`
      }, (payload: any) => {
        setComments((prev) => {
          // Prevent duplicates if we already added it manually
          if (prev.some(c => c.id === payload.new.id)) return prev;
          return [...prev, payload.new as Comment];
        });
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'comments',
        filter: `confession_id=eq.${resolvedParams.id}`
      }, (payload: any) => {
        setComments((prev) => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedParams.id]);

  async function fetchData() {
    try {
      // Fetch Confession
      const { data: confessionData, error: confessionError } = await supabase
        .from('confessions')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();
      
      if (confessionError) throw confessionError;
      setConfession(confessionData);

      // Fetch Comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('confession_id', resolvedParams.id)
        .order('created_at', { ascending: true });
        
      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const commentContent = newComment.trim();
    if (!commentContent) return;
    
    setIsSubmitting(true);
    setNewComment('');
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ 
          content: commentContent,
          confession_id: resolvedParams.id
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Immediately add to UI without refreshing
      if (data) {
        // Save ID to local storage so user can delete their comment later
        const updatedComments = [...myComments, data.id];
        setMyComments(updatedComments);
        localStorage.setItem('my_comments', JSON.stringify(updatedComments));

        setComments((prev) => {
          if (prev.some(c => c.id === data.id)) return prev;
          return [...prev, data as Comment];
        });
      }
      
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Failed to post comment.');
      // Restore input if failed
      setNewComment(commentContent);
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmDelete(id: string) {
    setCommentToDelete(id);
    setDeleteModalOpen(true);
  }

  async function handleConfirmedDelete() {
    if (!commentToDelete) return;
    setIsDeleting(true);

    // Optimistic UI update
    setComments(prev => prev.filter(c => c.id !== commentToDelete));
    
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentToDelete);
      if (error) throw error;
      
      // Remove from local storage
      const updatedComments = myComments.filter(commentId => commentId !== commentToDelete);
      setMyComments(updatedComments);
      localStorage.setItem('my_comments', JSON.stringify(updatedComments));
      
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Failed to delete comment.');
      fetchData(); // restore on fail
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
      setCommentToDelete(null);
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-4 md:p-8 pt-12 text-center text-neutral-500 animate-pulse">
        Loading confession...
      </main>
    );
  }

  if (!confession) {
    return (
      <main className="max-w-2xl mx-auto p-4 md:p-8 pt-12 text-center text-neutral-400">
        <p>Confession not found.</p>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block">
          Return Home
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-4 md:p-8 pt-6 md:pt-12">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft size={18} /> Back to feed
      </Link>

      <article className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 md:p-8 mb-8">
        <p className="text-white text-xl md:text-2xl leading-relaxed whitespace-pre-wrap break-words">
          {confession.content}
        </p>
        <div className="text-neutral-500 text-sm mt-8" suppressHydrationWarning>
          Posted {formatDistanceToNow(new Date(confession.created_at), { addSuffix: true })}
        </div>
      </article>

      <section className="bg-neutral-950/50 border border-neutral-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-bold text-neutral-200 mb-6 flex items-center gap-2">
          Comments ({comments.length})
        </h3>

        <div className="space-y-6 mb-8">
          {comments.length === 0 ? (
            <p className="text-neutral-600 italic">No comments yet. Be the first to reply!</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="group relative pr-8">
                {myComments.includes(comment.id) && (
                  <button 
                    onClick={() => confirmDelete(comment.id)}
                    className="absolute top-0 right-0 p-1 text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete your comment"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <p className="text-neutral-300 whitespace-pre-wrap leading-relaxed break-words text-base">
                  {comment.content}
                </p>
                <div className="text-xs text-neutral-600 mt-2" suppressHydrationWarning>
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleCommentSubmit} className="relative mt-4">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write an anonymous reply..."
            className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-full py-3 pl-6 pr-14 focus:outline-none focus:border-indigo-500 transition-colors"
            required
            maxLength={500}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      </section>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        isDeleting={isDeleting}
        onConfirm={handleConfirmedDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </main>
  );
}
